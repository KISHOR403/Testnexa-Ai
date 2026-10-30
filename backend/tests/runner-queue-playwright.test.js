const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const executionController = require('../src/controllers/execution.controller');
const jobQueue = require('../src/services/runner/jobQueue.service');
const { executePlaywrightJob, maskSecrets } = require('../src/services/runner/playwrightRunner.worker');

const createMockRes = () => {
    const res = {
        statusCode: 200,
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        }
    };
    return res;
};

test('Milestone 4 & 5: Queue, Isolated Runner, SSRF Protection & Playwright Adapter Suite', async (t) => {
    supabaseService.workspacesTableAvailable = false;
    supabaseService.sessionsTableAvailable = false;
    supabaseService.executionTablesAvailable = false;

    const timestamp = Date.now();
    const autoUser = {
        id: `usr_auto_${timestamp}`,
        _id: `usr_auto_${timestamp}`,
        name: 'Auto QA Engineer',
        email: `auto_${timestamp}@testnexa.ai`
    };

    let workspace;
    let runId;
    let mappedCaseId;
    let manualCaseId;

    await t.test('1. Setup: Create mixed test run with automated and manual cases', async () => {
        workspace = await supabaseService.getUserPrimaryWorkspace(autoUser.id, autoUser.name);

        const customCases = [
            {
                id: 'TC_PLAY_001',
                title: 'Playwright Page Load & DOM Check',
                module: 'Navigation',
                priority: 'High',
                severity: 'Critical',
                steps: ['Navigate to target URL', 'Assert document title is loaded'],
                expectedResult: 'Document title exists and DOM is populated',
                automationMapping: {
                    spec: 'tests/nav.spec.ts',
                    testName: 'should load home page',
                    code: '() => document.title.length >= 0'
                }
            },
            {
                id: 'TC_PLAY_002',
                title: 'Playwright Intentional Assertion Failure',
                module: 'Checkout',
                priority: 'High',
                severity: 'Major',
                steps: ['Assert invalid element exists'],
                expectedResult: 'Fails assertion',
                automationMapping: {
                    spec: 'tests/fail.spec.ts',
                    testName: 'should detect missing element',
                    code: '() => { throw new Error("Expected element #non-existent to be visible; sk-proj-supersecrettoken1234567890"); }'
                }
            },
            {
                id: 'TC_MANUAL_LEFT',
                title: 'Manual Visual Inspection',
                module: 'Branding',
                priority: 'Low',
                steps: ['Verify font alignment'],
                expectedResult: 'Fonts match brand guidelines'
                // No automation mapping
            }
        ];

        const run = await supabaseService.createTestRun({
            workspaceId: workspace.id,
            name: 'Playwright CI Automated Test Run',
            executionType: 'mixed',
            targetEnvironment: {
                name: 'Public Test Server',
                baseUrl: 'https://example.com'
            },
            createdBy: autoUser.id,
            customCases
        });

        assert.ok(run && run.id);
        runId = run.id;

        const cases = await supabaseService.getRunCases(runId);
        assert.equal(cases.length, 3);

        const auto1 = cases.find(c => c.testCaseId === 'TC_PLAY_001');
        const auto2 = cases.find(c => c.testCaseId === 'TC_PLAY_002');
        const man = cases.find(c => c.testCaseId === 'TC_MANUAL_LEFT');

        assert.equal(auto1.executionType, 'automated');
        assert.equal(auto2.executionType, 'automated');
        assert.equal(man.executionType, 'manual');

        mappedCaseId = auto1.id;
        manualCaseId = man.id;
    });

    await t.test('2. SSRF Protection: Block cloud metadata and private loopback endpoints', async () => {
        // Forbidden cloud metadata IP
        const ssrfReport = await executePlaywrightJob({
            jobId: 'job_ssrf_test',
            runId,
            workspaceId: workspace.id,
            targetEnvironment: {
                baseUrl: 'http://169.254.169.254/latest/meta-data/'
            },
            casesToExecute: []
        });

        assert.equal(ssrfReport.success, false);
        assert.equal(ssrfReport.errorCategory, 'SECURITY_VIOLATION');
        assert.ok(ssrfReport.errorMessage.includes('blocked'));

        // Embedded credentials rejected
        const credReport = await executePlaywrightJob({
            jobId: 'job_cred_test',
            runId,
            workspaceId: workspace.id,
            targetEnvironment: {
                baseUrl: 'https://admin:supersecret@example.com'
            },
            casesToExecute: []
        });
        assert.equal(credReport.success, false);
        assert.equal(credReport.errorCategory, 'SECURITY_VIOLATION');
    });

    await t.test('3. Secret Sanitizer: Verify secret masking regex cleans tokens', () => {
        const rawError = 'Error connecting to postgres://user:superpass123@db.prod.internal with token Bearer eyJhbGciOiJIUzI1NiJ9.test and sk-proj-1234567890abcdef12345';
        const cleaned = maskSecrets(rawError);

        assert.ok(!cleaned.includes('superpass123'), 'Database password must be masked');
        assert.ok(!cleaned.includes('Bearer eyJhbGciOiJIUzI1NiJ9.test'), 'Bearer token must be masked');
        assert.ok(!cleaned.includes('sk-proj-1234567890abcdef12345'), 'API key must be masked');
        assert.ok(cleaned.includes('[REDACTED_SECRET]'), 'Placeholder must be inserted');
    });

    await t.test('4. Queue & Trigger Automated Run via API endpoint', async () => {
        const req = {
            user: autoUser,
            params: { id: runId },
            body: {
                adapter: 'playwright',
                targetEnvironment: {
                    baseUrl: 'https://example.com'
                }
            }
        };
        const res = createMockRes();

        await executionController.triggerAutomatedRun(req, res);

        assert.equal(res.statusCode, 202);
        assert.equal(res.data.success, true);
        assert.ok(res.data.data.id, 'Job ID must be returned');
        assert.equal(res.data.data.status, 'queued');
        assert.equal(res.data.data.totalCases, 2, 'Only the 2 automated cases should be queued');

        // Idempotency: duplicate trigger returns existing queued job
        const resDup = createMockRes();
        await executionController.triggerAutomatedRun(req, resDup);
        assert.equal(resDup.data.data.id, res.data.data.id, 'Must return same job ID');
    });

    await t.test('5. Process Job: Worker executes Playwright in headless browser and persists outcomes', async () => {
        // Execute queue processor synchronously for deterministic test
        const processedJob = await jobQueue.processNextJob();
        assert.ok(processedJob, 'Job must be processed');

        // Check final job status
        const completedJob = await jobQueue.getJob(processedJob.id);
        assert.equal(completedJob.status, 'completed');
        assert.equal(completedJob.completedCases, 2);
        assert.equal(completedJob.passedCases, 1);
        assert.equal(completedJob.failedCases, 1);

        // Check that TC_PLAY_001 is Passed
        const runCase1 = await supabaseService.getRunCaseById(mappedCaseId);
        assert.equal(runCase1.status, 'passed');
        assert.equal(runCase1.executorType, 'automated');
        assert.ok(runCase1.actualResult.includes('Playwright verified'));

        // Check that manual case was NOT executed by automation
        const manualCase = await supabaseService.getRunCaseById(manualCaseId);
        assert.equal(manualCase.status, 'not_run');

        // Check run summary: 1 passed, 1 failed, 1 not_run
        const run = await supabaseService.getTestRunById(runId);
        assert.equal(run.summary.passed, 1);
        assert.equal(run.summary.failed, 1);
        assert.equal(run.summary.not_run, 1);
        assert.equal(run.status, 'in_progress');

        // Check failure screenshot artifact
        const artifacts = await supabaseService.getRunArtifacts(runId);
        assert.ok(artifacts.length > 0, 'Artifacts must be created');
        const logArt = artifacts.find(a => a.artifactType === 'log');
        assert.ok(logArt, 'Playwright log artifact must be persisted');
    });

    await t.test('6. Job Retry Handling: Transient infrastructure error retries up to max_retries', async () => {
        const dummyJobId = 'job_retry_test';
        const dummyJob = await supabaseService.createAutomationJob({
            runId,
            workspaceId: workspace.id,
            adapter: 'playwright',
            totalCases: 1
        });

        // Simulate transient failure
        await jobQueue._handleJobFailure(dummyJob, new Error('Browser launch timeout: temporary memory spike'));

        const retriedJob = await jobQueue.getJob(dummyJob.id);
        assert.equal(retriedJob.status, 'queued', 'Must reset to queued for retry');
        assert.equal(retriedJob.retries, 1, 'Retry count must increment');

        // Simulate exhausting retries
        retriedJob.retries = 2; // max_retries reached
        await jobQueue._handleJobFailure(retriedJob, new Error('Browser launch failed repeatedly'));

        const failedJob = await jobQueue.getJob(dummyJob.id);
        assert.equal(failedJob.status, 'failed', 'Must transition to failed after exhausting retries');
        assert.ok(failedJob.errorMessage.includes('Browser launch failed repeatedly'));
    });
});
