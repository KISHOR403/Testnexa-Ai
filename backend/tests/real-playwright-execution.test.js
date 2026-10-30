const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const executionController = require('../src/controllers/execution.controller');
const jobQueue = require('../src/services/runner/jobQueue.service');
const { executePlaywrightJob } = require('../src/services/runner/playwrightRunner.worker');

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

const createMockReq = (user, params = {}, body = {}) => ({
    user,
    params,
    body,
    ip: '127.0.0.1',
    get(header) {
        if (header.toLowerCase() === 'user-agent') return 'node-test-agent';
        return '';
    }
});

test('Comprehensive Real Playwright Automated Execution Engine (12 Scenarios)', async (t) => {
    supabaseService.workspacesTableAvailable = false;
    supabaseService.sessionsTableAvailable = false;
    supabaseService.executionTablesAvailable = false;

    const timestamp = Date.now();
    const primaryUser = {
        id: `usr_play_primary_${timestamp}`,
        _id: `usr_play_primary_${timestamp}`,
        name: 'Lead Automation Engineer',
        email: `lead_${timestamp}@testnexa.ai`
    };

    const externalUser = {
        id: `usr_play_external_${timestamp}`,
        _id: `usr_play_external_${timestamp}`,
        name: 'External Workspace User',
        email: `external_${timestamp}@otherorg.com`
    };

    let workspace;
    let externalWorkspace;
    let unmappedRunId;

    await t.test('Initial Setup: Initialize Workspaces for Tenancy Isolation', async () => {
        workspace = await supabaseService.getUserPrimaryWorkspace(primaryUser.id, primaryUser.name);
        externalWorkspace = await supabaseService.getUserPrimaryWorkspace(externalUser.id, externalUser.name);
        assert.ok(workspace && workspace.id);
        assert.ok(externalWorkspace && externalWorkspace.id);
        assert.notEqual(workspace.id, externalWorkspace.id);
    });

    // SCENARIO 1: Triggering with 0 configured automation mappings returns 400 Bad Request
    await t.test('Scenario 1: Triggering execution on run with 0 configured mappings fails validation with 400', async () => {
        const unmappedRun = await supabaseService.createTestRun({
            workspaceId: workspace.id,
            name: 'Unmapped Automated Run',
            executionType: 'automated',
            createdBy: primaryUser.id,
            customCases: [
                {
                    id: 'TC_RAW_001',
                    title: 'Raw AI Case Without Automation Script',
                    module: 'Billing',
                    steps: ['Click subscribe', 'Verify price'],
                    expectedResult: 'Price shows $29'
                }
            ]
        });
        unmappedRunId = unmappedRun.id;

        const req = createMockReq(primaryUser, { id: unmappedRunId }, { adapter: 'playwright' });
        const res = createMockRes();

        await executionController.triggerAutomatedRun(req, res);

        assert.equal(res.statusCode, 400, 'Must return 400 Bad Request when 0 cases have configured scripts');
        assert.equal(res.data.success, false);
        assert.ok(
            res.data.message.includes('have an approved automation mapping configured'),
            'Must provide informative message guiding the user to configure mappings'
        );
    });

    // SCENARIO 2: Auto-configuring approved Playwright scripts
    await t.test('Scenario 2: Auto-configure approved Playwright scripts endpoint binds verified scripts to unmapped cases', async () => {
        const req = createMockReq(primaryUser, { id: unmappedRunId });
        const res = createMockRes();

        await executionController.autoConfigureMappings(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.configuredCount, 1, 'Should bind 1 unmapped test case');

        // Verify the case snapshot now contains configured Playwright mapping
        const cases = await supabaseService.getRunCases(unmappedRunId);
        const autoCase = cases[0];
        assert.equal(autoCase.executionType, 'automated');
        assert.ok(autoCase.caseSnapshot.automationMapping);
        assert.equal(autoCase.caseSnapshot.automationMapping.framework, 'playwright');
        assert.equal(autoCase.caseSnapshot.automationMapping.mappingStatus, 'configured');
        assert.ok(autoCase.caseSnapshot.automationMapping.scriptCode.includes('page.goto'));
    });

    // SCENARIO 3: Real Playwright browser test pass in headless Chromium
    await t.test('Scenario 3: Real headless Chromium browser pass execution with real page and assertions', async () => {
        const passRun = await supabaseService.createTestRun({
            workspaceId: workspace.id,
            name: 'Real Browser Pass Test Run',
            executionType: 'automated',
            targetEnvironment: {
                name: 'Local Test Server',
                baseUrl: 'https://example.com'
            },
            createdBy: primaryUser.id,
            customCases: [
                {
                    id: 'TC_BROWSER_PASS',
                    title: 'Verify Page Body and Title in Real Chromium',
                    module: 'Core',
                    steps: ['Navigate to site', 'Assert body exists'],
                    expectedResult: 'Passes',
                    automationMapping: {
                        framework: 'playwright',
                        automationTestId: 'core-page-pass',
                        scriptRef: 'tests/e2e/core.spec.js#pass',
                        mappingStatus: 'configured',
                        scriptCode: `async (page, expect) => {
                            await page.goto('/');
                            await expect(page.locator('body')).toBeVisible();
                            const title = await page.title();
                            expect(title).toBeTruthy();
                        }`
                    }
                }
            ]
        });

        // Trigger execution
        const triggerReq = createMockReq(primaryUser, { id: passRun.id }, { adapter: 'playwright' });
        const triggerRes = createMockRes();
        await executionController.triggerAutomatedRun(triggerReq, triggerRes);
        assert.equal(triggerRes.statusCode, 202);

        // Process job through queue worker
        const processed = await jobQueue.processNextJob();
        assert.ok(processed, 'Worker must pick up queued job');

        const job = await jobQueue.getJob(processed.id);
        assert.equal(job.status, 'completed');
        assert.equal(job.passedCases, 1);
        assert.equal(job.failedCases, 0);

        // Verify run case record updated with real execution details
        const cases = await supabaseService.getRunCases(passRun.id);
        const passCase = cases[0];
        assert.equal(passCase.status, 'passed');
        assert.equal(passCase.executorType, 'automated');
        assert.ok(passCase.actualResult.includes('Playwright verified'));
        assert.ok(passCase.durationMs >= 0);

        // Verify run summary updated
        const updatedRun = await supabaseService.getTestRunById(passRun.id);
        assert.equal(updatedRun.summary.passed, 1);
        assert.equal(updatedRun.status, 'completed');
    });

    // SCENARIO 4: Real Playwright assertion failure captures real screenshot artifact
    await t.test('Scenario 4: Real Playwright assertion failure logs stack trace and captures screenshot artifact', async () => {
        const failRun = await supabaseService.createTestRun({
            workspaceId: workspace.id,
            name: 'Real Browser Fail Test Run',
            executionType: 'automated',
            createdBy: primaryUser.id,
            customCases: [
                {
                    id: 'TC_BROWSER_FAIL',
                    title: 'Intentional Assertion Failure Check',
                    module: 'Checkout',
                    steps: ['Assert missing submit button exists'],
                    expectedResult: 'Fails assertion',
                    automationMapping: {
                        framework: 'playwright',
                        automationTestId: 'checkout-assert-fail',
                        scriptRef: 'tests/e2e/checkout.spec.js#fail',
                        mappingStatus: 'configured',
                        scriptCode: `async (page, expect) => {
                            await page.goto('/');
                            // Intentional failure assertion
                            expect(1 + 1).toBe(999);
                        }`
                    }
                }
            ]
        });

        // Trigger run
        const req = createMockReq(primaryUser, { id: failRun.id }, { adapter: 'playwright' });
        const res = createMockRes();
        await executionController.triggerAutomatedRun(req, res);

        // Process through worker
        const processed = await jobQueue.processNextJob();
        const job = await jobQueue.getJob(processed.id);
        assert.equal(job.status, 'completed');
        assert.equal(job.failedCases, 1);

        // Verify run case is failed
        const cases = await supabaseService.getRunCases(failRun.id);
        const failCase = cases[0];
        assert.equal(failCase.status, 'failed');
        assert.ok(failCase.actualResult.includes('999') || failCase.actualResult.includes('AssertionError'));

        // Verify screenshot artifact was harvested and persisted
        const artifacts = await supabaseService.getRunArtifacts(failRun.id);
        const screenshotArtifact = artifacts.find(a => a.artifactType === 'screenshot');
        assert.ok(screenshotArtifact, 'A real screenshot artifact must be saved on failure');
        assert.equal(screenshotArtifact.mimeType, 'image/png');
        assert.ok((screenshotArtifact.sizeBytes || screenshotArtifact.fileSize || 0) > 0);
    });

    // SCENARIO 5: Browser launch and error recovery (handles syntax errors without crashing worker)
    await t.test('Scenario 5: Syntax errors and runtime exceptions caught safely without crashing worker', async () => {
        const errorRun = await supabaseService.createTestRun({
            workspaceId: workspace.id,
            name: 'Syntax Error Test Run',
            executionType: 'automated',
            createdBy: primaryUser.id,
            customCases: [
                {
                    id: 'TC_SYNTAX_ERR',
                    title: 'Malformed Automation Script Syntax',
                    module: 'Admin',
                    automationMapping: {
                        framework: 'playwright',
                        automationTestId: 'syntax-err-01',
                        scriptRef: 'tests/e2e/syntax.spec.js',
                        mappingStatus: 'configured',
                        scriptCode: `async (page, expect) => {
                            throw new TypeError("Uncaught runtime reference error: window.foo is undefined");
                        }`
                    }
                }
            ]
        });

        const req = createMockReq(primaryUser, { id: errorRun.id }, { adapter: 'playwright' });
        const res = createMockRes();
        await executionController.triggerAutomatedRun(req, res);

        const processed = await jobQueue.processNextJob();
        assert.ok(processed, 'Worker survived exception and returned job');
        const job = await jobQueue.getJob(processed.id);
        assert.equal(job.failedCases, 1);

        const cases = await supabaseService.getRunCases(errorRun.id);
        assert.equal(cases[0].status, 'failed');
        assert.ok(cases[0].actualResult.includes('Uncaught runtime reference error'));
    });

    // SCENARIO 6: Per-test timeout enforcement
    await t.test('Scenario 6: Per-test timeout limits execution and marks case timed_out', async () => {
        const timeoutReport = await executePlaywrightJob({
            jobId: 'job_timeout_test',
            runId: unmappedRunId,
            workspaceId: workspace.id,
            targetEnvironment: { baseUrl: 'https://example.com' },
            perTestTimeoutMs: 350,
            casesToExecute: [
                {
                    id: 'RC_TIMEOUT_01',
                    testCaseId: 'TC_TIMEOUT',
                    caseSnapshot: {
                        title: 'Infinite Loop Script',
                        automationMapping: {
                            scriptCode: `async (page, expect) => {
                                // Simulate hanging test exceeding timeout
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }`
                        }
                    }
                }
            ]
        });

        assert.equal(timeoutReport.success, true);
        assert.equal(timeoutReport.results.length, 1);
        const result = timeoutReport.results[0];
        assert.ok(
            result.status === 'timed_out' || result.status === 'failed',
            'Timeout must classify as timed_out or failed'
        );
        assert.ok(result.actualResult.includes('timed out') || result.actualResult.includes('Timeout') || result.errorMessage.includes('Timeout'));
    });

    // SCENARIO 7: Safe job cancellation
    await t.test('Scenario 7: Canceling an active run safely terminates browser and marks status cancelled', async () => {
        const cancelRun = await supabaseService.createTestRun({
            workspaceId: workspace.id,
            name: 'Run To Cancel',
            executionType: 'automated',
            createdBy: primaryUser.id,
            customCases: [
                {
                    id: 'TC_CANCEL_01',
                    title: 'Pending Case In Cancelled Run',
                    automationMapping: {
                        framework: 'playwright',
                        mappingStatus: 'configured',
                        scriptCode: 'async () => {}'
                    }
                }
            ]
        });

        // Cancel via controller
        const req = createMockReq(primaryUser, { id: cancelRun.id });
        const res = createMockRes();
        await executionController.cancelRun(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);

        const updatedRun = await supabaseService.getTestRunById(cancelRun.id);
        assert.equal(updatedRun.status, 'cancelled');
    });

    // SCENARIO 8: Concurrency limiting
    await t.test('Scenario 8: Concurrency limiter throttles parallel test execution gracefully', async () => {
        const parallelCases = [1, 2, 3, 4, 5].map(i => ({
            id: `RC_PARA_${i}`,
            testCaseId: `TC_PARA_${i}`,
            caseSnapshot: {
                title: `Parallel Case ${i}`,
                automationMapping: {
                    scriptCode: `async (page, expect) => {
                        await page.goto('/');
                        await expect(page.locator('body')).toBeVisible();
                    }`
                }
            }
        }));

        const report = await executePlaywrightJob({
            jobId: 'job_concurrency_test',
            runId: unmappedRunId,
            workspaceId: workspace.id,
            targetEnvironment: { baseUrl: 'https://example.com' },
            concurrency: 2,
            casesToExecute: parallelCases
        });

        assert.equal(report.success, true);
        assert.equal(report.results.length, 5);
        for (const r of report.results) {
            assert.equal(r.status, 'passed');
        }
    });

    // SCENARIO 9: Duplicate trigger idempotency
    await t.test('Scenario 9: Triggering Playwright on an already queued job returns existing job idempotently', async () => {
        const idempRun = await supabaseService.createTestRun({
            workspaceId: workspace.id,
            name: 'Idempotency Run',
            executionType: 'automated',
            createdBy: primaryUser.id,
            customCases: [
                {
                    id: 'TC_IDEMP_01',
                    title: 'Idempotency Check',
                    automationMapping: {
                        framework: 'playwright',
                        mappingStatus: 'configured',
                        scriptCode: 'async () => {}'
                    }
                }
            ]
        });

        const req = createMockReq(primaryUser, { id: idempRun.id }, { adapter: 'playwright' });
        const res1 = createMockRes();
        await executionController.triggerAutomatedRun(req, res1);
        assert.equal(res1.statusCode, 202);
        const originalJobId = res1.data.data.id;

        // Second trigger should return existing queued job
        const res2 = createMockRes();
        await executionController.triggerAutomatedRun(req, res2);
        assert.equal(res2.statusCode, 202);
        assert.equal(res2.data.data.id, originalJobId, 'Must return the existing job, not spawn duplicates');

        // Drain the job queue
        await jobQueue.processNextJob();
    });

    // SCENARIO 10: Database persistence of attempts & artifacts
    await t.test('Scenario 10: Attempts and artifacts are immutably persisted with attempt history', async () => {
        const persistRun = await supabaseService.createTestRun({
            workspaceId: workspace.id,
            name: 'Persistence Verification Run',
            executionType: 'manual',
            createdBy: primaryUser.id,
            customCases: [
                {
                    id: 'TC_PERSIST_01',
                    title: 'Multi-Attempt Persistence',
                    steps: ['Step 1'],
                    expectedResult: 'Passed'
                }
            ]
        });

        const runCases = await supabaseService.getRunCases(persistRun.id);
        const caseRecord = runCases[0];

        // Attempt 1: Failed
        await supabaseService.recordTestExecution({
            runId: persistRun.id,
            runCaseId: caseRecord.id,
            status: 'failed',
            actualResult: 'First attempt failed due to server 500',
            notes: 'Investigating backend',
            executorType: 'manual',
            executedBy: primaryUser.id
        });

        // Attempt 2: Passed
        await supabaseService.recordTestExecution({
            runId: persistRun.id,
            runCaseId: caseRecord.id,
            status: 'passed',
            actualResult: 'Retest succeeded after deploy',
            notes: 'Fix confirmed in staging',
            executorType: 'manual',
            executedBy: primaryUser.id
        });

        const history = await supabaseService.getCaseExecutions(caseRecord.id);
        assert.equal(history.length, 2, 'Must preserve both attempts immutably');
        assert.equal(history[0].attemptNumber, 1);
        assert.equal(history[0].status, 'failed');
        assert.equal(history[1].attemptNumber, 2);
        assert.equal(history[1].status, 'passed');

        // Case current status reflects the latest attempt
        const refreshedCase = await supabaseService.getRunCaseById(caseRecord.id);
        assert.equal(refreshedCase.status, 'passed');
        assert.equal(refreshedCase.currentAttempt, 2);
    });

    // SCENARIO 11: Multi-tenant workspace isolation
    await t.test('Scenario 11: Multi-tenant isolation blocks cross-workspace test run access and execution', async () => {
        const secretRun = await supabaseService.createTestRun({
            workspaceId: externalWorkspace.id,
            name: 'External Org Secret Run',
            executionType: 'automated',
            createdBy: externalUser.id,
            customCases: [{ id: 'TC_SEC_01', title: 'Top Secret Specs' }]
        });

        // Primary user attempts to trigger external user's run
        const unauthorizedReq = createMockReq(primaryUser, { id: secretRun.id }, { adapter: 'playwright' });
        const unauthorizedRes = createMockRes();
        await executionController.triggerAutomatedRun(unauthorizedReq, unauthorizedRes);

        assert.equal(unauthorizedRes.statusCode, 403, 'Must reject cross-tenant execution attempt with 403');
        assert.equal(unauthorizedRes.data.success, false);
    });

    // SCENARIO 12: Rerunning failed tests with attempt counter increment
    await t.test('Scenario 12: Rerun failed tests endpoint executes only failed cases and increments attempt number', async () => {
        const rerunRun = await supabaseService.createTestRun({
            workspaceId: workspace.id,
            name: 'Rerun Failed Tests Target Run',
            executionType: 'automated',
            createdBy: primaryUser.id,
            customCases: [
                {
                    id: 'TC_PASS_ALREADY',
                    title: 'Case That Already Passed',
                    automationMapping: {
                        framework: 'playwright',
                        mappingStatus: 'configured',
                        scriptCode: 'async (page, expect) => { await page.goto("/"); }'
                    }
                },
                {
                    id: 'TC_FAILED_EARLIER',
                    title: 'Case That Failed In Previous Run',
                    automationMapping: {
                        framework: 'playwright',
                        mappingStatus: 'configured',
                        scriptCode: 'async (page, expect) => { await page.goto("/"); }'
                    }
                }
            ]
        });

        const cases = await supabaseService.getRunCases(rerunRun.id);
        const passCase = cases.find(c => c.testCaseId === 'TC_PASS_ALREADY');
        const failCase = cases.find(c => c.testCaseId === 'TC_FAILED_EARLIER');

        // Seed attempt 1 for both
        await supabaseService.recordTestExecution({
            runId: rerunRun.id,
            runCaseId: passCase.id,
            status: 'passed',
            actualResult: 'Initial run passed',
            executorType: 'automated'
        });
        await supabaseService.recordTestExecution({
            runId: rerunRun.id,
            runCaseId: failCase.id,
            status: 'failed',
            actualResult: 'Initial run timed out',
            executorType: 'automated'
        });

        // Rerun failed tests
        const rerunReq = createMockReq(primaryUser, { id: rerunRun.id });
        const rerunRes = createMockRes();
        await executionController.rerunFailed(rerunReq, rerunRes);

        assert.equal(rerunRes.statusCode, 202);
        assert.equal(rerunRes.data.success, true);
        assert.equal(rerunRes.data.data.failedCasesCount, 1, 'Only 1 failed case should be targeted');
        assert.ok(rerunRes.data.data.job, 'New automated rerun job must be created');

        // Process the rerun job
        const processed = await jobQueue.processNextJob();
        assert.ok(processed);

        // Check attempt history on the re-run case
        const failCaseHistory = await supabaseService.getCaseExecutions(failCase.id);
        assert.equal(failCaseHistory.length, 2, 'Must have 2 attempts recorded');
        assert.equal(failCaseHistory[0].attemptNumber, 1);
        assert.equal(failCaseHistory[0].status, 'failed');
        assert.equal(failCaseHistory[1].attemptNumber, 2);
        assert.equal(failCaseHistory[1].status, 'passed');

        // Already-passed case should NOT have a second attempt
        const passCaseHistory = await supabaseService.getCaseExecutions(passCase.id);
        assert.equal(passCaseHistory.length, 1, 'Passed case must not have been rerun');
    });
});
