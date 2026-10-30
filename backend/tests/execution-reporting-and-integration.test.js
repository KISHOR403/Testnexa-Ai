/**
 * Unified Test Execution Engine — System Integration & Reporting Tests
 *
 * Covers:
 * 1. Mixed execution runs (manual + automated Playwright cases)
 * 2. Immutable test snapshots (modifying source suite does not alter test run snapshot)
 * 3. Append-only retest history (multiple attempts on a test case preserve all historical records)
 * 4. Playwright execution processing via job queue
 * 5. Multi-tenant workspace isolation
 * 6. Private evidence access controls & directory traversal protection
 * 7. System health execution engine telemetry
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const supabaseService = require('../src/services/supabaseData.service');
const jobQueue = require('../src/services/runner/jobQueue.service');
const artifactStorage = require('../src/utils/artifactStorage');
const adminController = require('../src/controllers/admin.controller');

describe('Unified Execution Engine — System Integration & Reporting', () => {
    const testWorkspaceId = 'ws-integration-reporting-001';
    const unauthorizedWorkspaceId = 'ws-integration-reporting-999';
    const testUserId = 'usr-qa-lead-777';
    let originalSuite;
    let mixedRun;

    before(async () => {
        // Enforce disk fallback to guarantee offline determinism
        supabaseService.workspacesTableAvailable = false;
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;

        // Create an approved test suite with mixed test cases (manual + automated mapping)
        originalSuite = await supabaseService.createSession({
            workspaceId: testWorkspaceId,
            userId: testUserId,
            title: 'Authentication & Checkout Flow',
            status: 'Approved',
            suiteData: {
                testSuiteName: 'Checkout & Payment Suite',
                feature: 'Stripe Integration & Cart Checkout',
                functional: [
                    {
                        id: 'TC-MANUAL-001',
                        title: 'Verify tactile swipe gesture on mobile keypad during OTP entry',
                        type: 'Functional',
                        priority: 'High',
                        steps: [{ action: 'Swipe down', expected: 'Keypad closes' }],
                        expectedResult: 'OTP keypad dismissed gracefully'
                    },
                    {
                        id: 'TC-AUTO-002',
                        title: 'Verify cart total calculation with 10% coupon code',
                        type: 'Functional',
                        priority: 'Critical',
                        playwrightBinding: {
                            framework: 'playwright',
                            version: '1.40.0',
                            spec: "test('Cart calculation', async ({ page }) => { expect(100).toBe(100); });"
                        }
                    }
                ],
                negative: [
                    {
                        id: 'TC-AUTO-003',
                        title: 'Verify expired card rejection message on payment gateway',
                        type: 'Negative',
                        priority: 'Critical',
                        playwrightBinding: {
                            framework: 'playwright',
                            version: '1.40.0',
                            spec: "test('Expired card', async ({ page }) => { expect(true).toBe(true); });"
                        }
                    }
                ]
            }
        });
    });

    it('1. Creates a mixed execution run with immutable case snapshots', async () => {
        mixedRun = await supabaseService.createTestRun({
            workspaceId: testWorkspaceId,
            suiteId: originalSuite.id,
            name: 'Sprint 42 Mixed Smoke Run',
            executionType: 'mixed',
            createdBy: testUserId,
            selectedCaseIds: ['TC-MANUAL-001', 'TC-AUTO-002', 'TC-AUTO-003']
        });

        assert.ok(mixedRun?.id, 'Mixed run must be created with a valid UUID');
        assert.equal(mixedRun.executionType, 'mixed');
        assert.equal(mixedRun.summary.total, 3);
        assert.equal(mixedRun.status, 'pending');

        const runCases = await supabaseService.getRunCases(mixedRun.id);
        assert.equal(runCases.length, 3, 'Should snapshot all 3 selected cases');

        const manualCase = runCases.find(c => c.testCaseId === 'TC-MANUAL-001');
        assert.equal(manualCase.executionType, 'manual');
        assert.equal(manualCase.status, 'not_run');

        const autoCase = runCases.find(c => c.testCaseId === 'TC-AUTO-002');
        assert.equal(autoCase.executionType, 'automated');
        assert.ok(autoCase.caseSnapshot.automationMapping, 'Automation metadata must be preserved in snapshot');
    });

    it('2. Preserves snapshot immutability when original test suite is mutated', async () => {
        // Mutate original suite
        await supabaseService.updateSession(originalSuite.id, {
            title: 'Mutated Suite Name',
            suiteData: {
                testSuiteName: 'Completely Changed Suite',
                functional: [] // All cases removed from source suite
            }
        });

        // Verify test run snapshot remains completely intact
        const runCases = await supabaseService.getRunCases(mixedRun.id);
        assert.equal(runCases.length, 3, 'Run cases must remain unchanged despite source suite deletion');
        const manualCase = runCases.find(c => c.testCaseId === 'TC-MANUAL-001');
        assert.equal(manualCase.caseSnapshot.title, 'Verify tactile swipe gesture on mobile keypad during OTP entry');
    });

    it('3. Records manual execution progress and preserves append-only attempt history', async () => {
        const runCases = await supabaseService.getRunCases(mixedRun.id);
        const manualCase = runCases.find(c => c.testCaseId === 'TC-MANUAL-001');

        // First attempt: Fails due to gesture lag
        const res1 = await supabaseService.recordTestExecution({
            runId: mixedRun.id,
            runCaseId: manualCase.id,
            testCaseId: manualCase.testCaseId,
            status: 'failed',
            actualResult: 'Keypad remained stuck open after rapid swipe',
            notes: 'Investigating touchscreen event debounce threshold',
            executedBy: testUserId,
            durationMs: 4500
        });

        assert.equal(res1.execution.attemptNumber, 1);
        assert.equal(res1.execution.status, 'failed');

        // Second attempt: Retest passes
        const res2 = await supabaseService.recordTestExecution({
            runId: mixedRun.id,
            runCaseId: manualCase.id,
            testCaseId: manualCase.testCaseId,
            status: 'passed',
            actualResult: 'Keypad dismissed smoothly within 120ms',
            notes: 'Retest verified after firmware gesture patch',
            executedBy: testUserId,
            durationMs: 2800
        });

        assert.equal(res2.execution.attemptNumber, 2);
        assert.equal(res2.execution.status, 'passed');

        // Verify full attempt history is retained
        const history = await supabaseService.getCaseExecutions(manualCase.id);
        assert.equal(history.length, 2, 'Must retain all execution attempts');
        assert.equal(history[0].status, 'failed');
        assert.equal(history[0].attemptNumber, 1);
        assert.equal(history[1].status, 'passed');
        assert.equal(history[1].attemptNumber, 2);
    });

    it('4. Executes Playwright automated cases in the mixed run via queue', async () => {
        const job = await jobQueue.submitJob({
            workspaceId: testWorkspaceId,
            runId: mixedRun.id,
            targetEnvironment: {
                baseUrl: 'https://test-staging.local'
            },
            createdBy: testUserId
        });

        assert.ok(job?.id, 'Automation job must be queued');
        assert.equal(job.status, 'queued');

        // Process queue
        await jobQueue.processNextJob();

        const updatedJob = await jobQueue.getJob(job.id, testWorkspaceId);
        assert.equal(updatedJob.status, 'completed');

        // Check updated run metrics
        const updatedRun = await supabaseService.getTestRunById(mixedRun.id, testWorkspaceId);
        assert.ok(updatedRun.summary.passed >= 1, 'Should have recorded passed executions');
    });

    it('5. Enforces multi-tenant workspace isolation on test runs and jobs', async () => {
        // Attempt to access test run using an unauthorized workspace ID
        const unauthorizedRun = await supabaseService.getTestRunById(mixedRun.id, unauthorizedWorkspaceId);
        assert.equal(unauthorizedRun, null, 'Cross-workspace test run access must be denied');

        // Accessing using authorized workspace succeeds
        const authorizedRun = await supabaseService.getTestRunById(mixedRun.id, testWorkspaceId);
        assert.ok(authorizedRun && authorizedRun.id === mixedRun.id, 'Authorized workspace access must succeed');
    });

    it('6. Secures execution evidence storage with private store and directory traversal protection', async () => {
        const dummyBuffer = Buffer.from('PNG_MOCK_EVIDENCE_BYTES_FOR_INSPECTION');
        const saved = await artifactStorage.saveArtifactBuffer({
            workspaceId: testWorkspaceId,
            runId: mixedRun.id,
            name: 'otp-keypad-failure.png',
            data: dummyBuffer,
            mimeType: 'image/png'
        });

        assert.ok(saved.name, 'Artifact must have a generated file name');
        assert.ok(saved.storagePath, 'Artifact must be saved to private disk store');
        assert.equal(saved.sizeBytes, dummyBuffer.length);

        // Verify authorized workspace can retrieve the file
        const retrieved = artifactStorage.getArtifactBuffer(saved.storagePath);
        assert.ok(retrieved && retrieved.data, 'Authorized file buffer must exist on disk');
        assert.equal(retrieved.data.toString(), dummyBuffer.toString());

        // Verify traversal path returns null safely without leaking host files
        const nullRetrieved = artifactStorage.getArtifactBuffer('../../../nonexistent.png');
        assert.equal(nullRetrieved, null, 'Traversal path must return null');
    });

    it('7. Exposes Execution Engine operational telemetry in Admin Health Probe', async () => {
        let responseData = null;
        const mockReq = { user: { email: 'admin@testnexa.ai' } };
        const mockRes = {
            json: (obj) => { responseData = obj; return mockRes; },
            status: () => mockRes
        };

        await adminController.getSystemHealth(mockReq, mockRes);
        assert.ok(responseData?.success, 'Admin health check must succeed');
        assert.ok(responseData?.data?.executionEngine, 'Health check must include executionEngine');
        assert.equal(responseData.data.executionEngine.status, 'operational');
        assert.ok(responseData.data.executionEngine.adapter.includes('Playwright'));
    });
});
