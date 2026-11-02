/**
 * TestNexa AI — Phase 2: Rerun Execution Engine Test Suite
 *
 * Scenarios verified:
 * 1. Rerun all failed tests: Creates a new execution with only failed/blocked cases.
 * 2. Rerun selected tests: Creates a new execution with specific chosen cases.
 * 3. Rerun a single test: Creates a new execution targeting exactly one test case.
 * 4. No failed tests available: Rejects rerun with 400 when original run has 0 failed cases.
 * 5. Invalid original execution: Rejects rerun with 404 when original runId is invalid.
 * 6. Unauthorized workspace access: Rejects cross-workspace rerun attempts.
 * 7. Missing Playwright mapping: Rejects automated rerun when target cases lack valid scripts.
 * 8. Worker unavailable: Handles queue / worker execution error gracefully without crashing.
 * 9. Duplicate submission: Detects and rejects duplicate active rerun requests for the same run.
 * 10. Manual rerun: Creates new manual execution, allows new step outcomes, and records result.
 * 11. Original execution remains unchanged: Original test run cases, statuses, and counts are intact.
 * 12. New execution links to original: Sets originalRunId, parentRunId, rerunType, and selectedCaseIds.
 * 13. Correct result persistence: Records new attempts in test_executions for the new run.
 * 14. Correct rerun history & comparison: Tracks lineage history and calculates terminal state transitions (Fixed, Still Failing).
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const supabaseService = require('../src/services/supabaseData.service');
const rerunExecutionService = require('../src/services/runner/rerunExecution.service');
const executionController = require('../src/controllers/execution.controller');
const jobQueue = require('../src/services/runner/jobQueue.service');

const createMockReq = (user, params = {}, body = {}, query = {}) => ({
    user: { id: user.id, _id: user.id, name: user.name, email: user.email },
    params,
    body,
    query,
    headers: {}
});

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

describe('Phase 2: Rerun Execution Engine & Traceable Lineage Suite', () => {
    const primaryWorkspaceId = 'ws-rerun-tenant-primary';
    const unauthorizedWorkspaceId = 'ws-rerun-tenant-intruder';
    const primaryUserId = 'usr-qa-engineer-01';
    const intruderUserId = 'usr-intruder-02';

    let parentSuite;
    let initialRun;
    let initialCases = [];

    before(async () => {
        // Enforce in-memory & disk fallback for deterministic test isolation
        supabaseService.workspacesTableAvailable = false;
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;

        // Register workspaces
        supabaseService.inMemoryWorkspaces.set(primaryWorkspaceId, {
            id: primaryWorkspaceId,
            name: 'Primary QA Workspace',
            owner_id: primaryUserId,
            members: [{ user_id: primaryUserId, role: 'owner' }]
        });
        supabaseService.inMemoryWorkspaces.set(unauthorizedWorkspaceId, {
            id: unauthorizedWorkspaceId,
            name: 'Unauthorized Workspace',
            owner_id: intruderUserId,
            members: [{ user_id: intruderUserId, role: 'owner' }]
        });

        // 1. Create original Test Suite
        parentSuite = await supabaseService.createSession({
            workspaceId: primaryWorkspaceId,
            userId: primaryUserId,
            title: 'Checkout & Payment Test Suite',
            status: 'Approved',
            suiteData: {
                functional: [
                    {
                        id: 'TC-CHK-PASS',
                        title: 'Verify valid credit card payment',
                        type: 'Functional',
                        priority: 'Critical',
                        steps: [
                            { step: 1, action: 'Enter card info', expectedResult: 'Card accepted' },
                            { step: 2, action: 'Click Pay Now', expectedResult: 'Payment processed' }
                        ],
                        expectedResult: 'Payment processed successfully',
                        automationMapping: {
                            framework: 'playwright',
                            automationTestId: 'test_card_payment',
                            scriptSource: 'custom',
                            scriptCode: 'async (page, expect) => { await page.goto("/"); }',
                            mappingStatus: 'configured'
                        }
                    },
                    {
                        id: 'TC-CHK-FAIL-1',
                        title: 'Verify expired card displays validation banner',
                        type: 'Negative',
                        priority: 'High',
                        steps: [
                            { step: 1, action: 'Enter expired date', expectedResult: 'Validation error' }
                        ],
                        expectedResult: 'Payment rejected with clear message',
                        automationMapping: {
                            framework: 'playwright',
                            automationTestId: 'test_expired_card',
                            scriptSource: 'custom',
                            scriptCode: 'async (page, expect) => { await page.goto("/"); }',
                            mappingStatus: 'configured'
                        }
                    },
                    {
                        id: 'TC-CHK-FAIL-2',
                        title: 'Verify order total recalculation on quantity update',
                        type: 'Functional',
                        priority: 'Medium',
                        steps: [
                            { step: 1, action: 'Change quantity to 3', expectedResult: 'Total tripled' }
                        ],
                        expectedResult: 'Subtotal and tax update instantaneously',
                        automationMapping: {
                            framework: 'playwright',
                            automationTestId: 'test_qty_calc',
                            scriptSource: 'custom',
                            scriptCode: 'async (page, expect) => { await page.goto("/"); }',
                            mappingStatus: 'configured'
                        }
                    },
                    {
                        id: 'TC-CHK-MANUAL',
                        title: 'Verify physical packaging invoice layout and fonts',
                        type: 'Validation',
                        priority: 'Low',
                        executionMethod: 'manual',
                        steps: [
                            { step: 1, action: 'Inspect printed invoice font', expectedResult: 'Clean serif font' }
                        ],
                        expectedResult: 'Packing slip font conforms to branding style guide'
                    }
                ]
            }
        });

        // 2. Create the initial execution run
        initialRun = await supabaseService.createTestRun({
            workspaceId: primaryWorkspaceId,
            suiteId: parentSuite.id,
            name: 'Sprint 42 Release Verification',
            executionType: 'mixed',
            createdBy: primaryUserId
        });

        initialCases = await supabaseService.getRunCases(initialRun.id);

        const passCase = initialCases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC-CHK-PASS');
        const failCase1 = initialCases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC-CHK-FAIL-1');
        const failCase2 = initialCases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC-CHK-FAIL-2');
        const manualCase = initialCases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC-CHK-MANUAL');

        // Record initial execution results
        await supabaseService.recordTestExecution({
            runId: initialRun.id,
            runCaseId: passCase.id,
            status: 'passed',
            actualResult: 'Card accepted with confirmation #98124',
            durationMs: 1400,
            executorType: 'automated',
            executedBy: primaryUserId
        });

        await supabaseService.recordTestExecution({
            runId: initialRun.id,
            runCaseId: failCase1.id,
            status: 'failed',
            actualResult: 'Timeout waiting for banner element',
            errorMessage: 'TimeoutError: locator.waitFor() exceeded 30000ms',
            durationMs: 30000,
            executorType: 'automated',
            executedBy: primaryUserId
        });

        await supabaseService.recordTestExecution({
            runId: initialRun.id,
            runCaseId: failCase2.id,
            status: 'failed',
            actualResult: 'Price displayed $40 instead of $60',
            errorMessage: 'AssertionError: expected $60.00 but got $40.00',
            durationMs: 2500,
            executorType: 'automated',
            executedBy: primaryUserId
        });

        await supabaseService.recordTestExecution({
            runId: initialRun.id,
            runCaseId: manualCase.id,
            status: 'passed',
            actualResult: 'Typography and margins match specification',
            durationMs: 12000,
            executorType: 'manual',
            executedBy: primaryUserId
        });
    });

    // 1. Rerun all failed tests
    it('1. Rerun all failed tests: creates a new execution with only failed cases', async () => {
        const result = await rerunExecutionService.createRerunExecution({
            runId: initialRun.id,
            workspaceId: primaryWorkspaceId,
            userId: primaryUserId,
            scope: 'failed'
        });

        assert.ok(result.newRunId, 'New execution run ID must be returned');
        assert.notEqual(result.newRunId, initialRun.id, 'Must create a brand new execution record');
        assert.equal(result.originalRunId, initialRun.id, 'Must reference the original execution ID');
        assert.equal(result.parentRunId, initialRun.id, 'Must reference parent execution ID');
        assert.equal(result.rerunType, 'failed');
        assert.equal(result.rerunCasesCount, 2, 'Only the 2 failed cases must be queued in this rerun');

        // Inspect cases inside the new run
        const rerunCases = await supabaseService.getRunCases(result.newRunId);
        assert.equal(rerunCases.length, 2);
        const rerunCaseIds = rerunCases.map(c => c.testCaseId || c.caseSnapshot?.id);
        assert.ok(rerunCaseIds.includes('TC-CHK-FAIL-1'), 'Failed case 1 must be present');
        assert.ok(rerunCaseIds.includes('TC-CHK-FAIL-2'), 'Failed case 2 must be present');
        assert.ok(!rerunCaseIds.includes('TC-CHK-PASS'), 'Already passed case must NOT be included');
        assert.ok(!rerunCaseIds.includes('TC-CHK-MANUAL'), 'Passed manual case must NOT be included');

        // Mark completed to allow subsequent test isolation
        await supabaseService.updateTestRun(result.newRunId, primaryWorkspaceId, { status: 'completed' });
    });

    // 2. Rerun selected tests
    it('2. Rerun selected tests: creates a new execution with only chosen test cases', async () => {
        const result = await rerunExecutionService.createRerunExecution({
            runId: initialRun.id,
            workspaceId: primaryWorkspaceId,
            userId: primaryUserId,
            scope: 'selected',
            caseIds: ['TC-CHK-PASS', 'TC-CHK-FAIL-1']
        });

        assert.ok(result.newRunId);
        assert.equal(result.originalRunId, initialRun.id);
        assert.equal(result.rerunType, 'selected');
        assert.equal(result.rerunCasesCount, 2, 'Only the 2 chosen cases must be queued');

        const rerunCases = await supabaseService.getRunCases(result.newRunId);
        assert.equal(rerunCases.length, 2);
        const ids = rerunCases.map(c => c.testCaseId);
        assert.ok(ids.includes('TC-CHK-PASS'));
        assert.ok(ids.includes('TC-CHK-FAIL-1'));
        assert.ok(!ids.includes('TC-CHK-FAIL-2'));

        await supabaseService.updateTestRun(result.newRunId, primaryWorkspaceId, { status: 'completed' });
    });

    // 3. Rerun a single test
    it('3. Rerun a single test: creates a new execution for exactly one case', async () => {
        const result = await rerunExecutionService.createRerunExecution({
            runId: initialRun.id,
            workspaceId: primaryWorkspaceId,
            userId: primaryUserId,
            scope: 'single',
            caseId: 'TC-CHK-FAIL-2'
        });

        assert.ok(result.newRunId);
        assert.equal(result.originalRunId, initialRun.id);
        assert.equal(result.rerunType, 'single');
        assert.equal(result.rerunCasesCount, 1, 'Only the targeted single case must be queued');

        const rerunCases = await supabaseService.getRunCases(result.newRunId);
        assert.equal(rerunCases.length, 1);
        assert.equal(rerunCases[0].testCaseId, 'TC-CHK-FAIL-2');

        await supabaseService.updateTestRun(result.newRunId, primaryWorkspaceId, { status: 'completed' });
    });

    // 4. No failed tests available
    it('4. No failed tests available: rejects with 400 when execution has 0 failed cases', async () => {
        // Create an all-passed run
        const allPassedRun = await supabaseService.createTestRun({
            workspaceId: primaryWorkspaceId,
            name: 'All Passed Execution Run',
            executionType: 'automated',
            createdBy: primaryUserId,
            customCases: [
                { id: 'TC-ALREADY-PASSED', title: 'Flawless test', automationMapping: { mappingStatus: 'configured', scriptCode: 'async () => {}' } }
            ]
        });
        const cases = await supabaseService.getRunCases(allPassedRun.id);
        await supabaseService.recordTestExecution({
            runId: allPassedRun.id,
            runCaseId: cases[0].id,
            status: 'passed',
            durationMs: 1000
        });

        await assert.rejects(
            async () => {
                await rerunExecutionService.createRerunExecution({
                    runId: allPassedRun.id,
                    workspaceId: primaryWorkspaceId,
                    userId: primaryUserId,
                    scope: 'failed'
                });
            },
            {
                message: 'No failed test cases to rerun'
            }
        );
    });

    // 5. Invalid original execution
    it('5. Invalid original execution: returns 404 when original run is not found', async () => {
        await assert.rejects(
            async () => {
                await rerunExecutionService.createRerunExecution({
                    runId: 'tr_non_existent_99999',
                    workspaceId: primaryWorkspaceId,
                    userId: primaryUserId,
                    scope: 'failed'
                });
            },
            {
                statusCode: 404
            }
        );
    });

    // 6. Unauthorized workspace access
    it('6. Unauthorized workspace access: blocks cross-workspace rerun attempts', async () => {
        const req = createMockReq({ id: intruderUserId }, { id: initialRun.id }, { scope: 'failed' });
        const res = createMockRes();

        await executionController.rerun(req, res);
        assert.equal(res.statusCode, 403, 'Must return 403 Forbidden for unauthorized user/workspace');
        assert.equal(res.data.success, false);
    });

    // 7. Missing Playwright mapping
    it('7. Missing Playwright mapping: rejects automated rerun when target cases lack valid scripts', async () => {
        const unmappedRun = await supabaseService.createTestRun({
            workspaceId: primaryWorkspaceId,
            name: 'Run with Unmapped Automation Case',
            executionType: 'automated',
            createdBy: primaryUserId,
            customCases: [
                {
                    id: 'TC-UNMAPPED-FAIL',
                    title: 'Case with no automation code',
                    automationMapping: null
                }
            ]
        });
        const cases = await supabaseService.getRunCases(unmappedRun.id);
        await supabaseService.recordTestExecution({
            runId: unmappedRun.id,
            runCaseId: cases[0].id,
            status: 'failed',
            durationMs: 100
        });

        await assert.rejects(
            async () => {
                await rerunExecutionService.createRerunExecution({
                    runId: unmappedRun.id,
                    workspaceId: primaryWorkspaceId,
                    userId: primaryUserId,
                    scope: 'failed'
                });
            },
            (err) => {
                return err.message.includes('No configured and valid Playwright scripts discovered');
            }
        );
    });

    // 8. Worker unavailable / failure handling
    it('8. Worker unavailable: handles queue failure gracefully without crashing', async () => {
        // Dedicated run for worker outage test
        const workerOutageRun = await supabaseService.createTestRun({
            workspaceId: primaryWorkspaceId,
            name: 'Worker Outage Test Run',
            executionType: 'automated',
            createdBy: primaryUserId,
            customCases: [
                {
                    id: 'TC-OUTAGE-FAIL',
                    title: 'Case to test worker outage',
                    automationMapping: {
                        framework: 'playwright',
                        mappingStatus: 'configured',
                        scriptCode: 'async () => {}'
                    }
                }
            ]
        });
        const cases = await supabaseService.getRunCases(workerOutageRun.id);
        await supabaseService.recordTestExecution({
            runId: workerOutageRun.id,
            runCaseId: cases[0].id,
            status: 'failed',
            durationMs: 1000
        });

        // Temporarily stub submitJob to simulate queue outage
        const originalSubmit = jobQueue.submitJob;
        jobQueue.submitJob = async () => {
            throw new Error('Automation worker cluster is currently offline');
        };

        try {
            const result = await rerunExecutionService.createRerunExecution({
                runId: workerOutageRun.id,
                workspaceId: primaryWorkspaceId,
                userId: primaryUserId,
                scope: 'failed'
            });

            assert.ok(result.newRunId, 'New run is still created to record the attempt');
            assert.ok(result.jobError, 'Job error message is recorded');
            assert.equal(result.run.status, 'failed', 'Run status transitions to failed on queue error');
        } finally {
            jobQueue.submitJob = originalSubmit;
        }
    });

    // 9. Duplicate submission
    it('9. Duplicate submission: detects and rejects concurrent active rerun for same scope', async () => {
        const dupTestRun = await supabaseService.createTestRun({
            workspaceId: primaryWorkspaceId,
            name: 'Duplicate Submission Target Run',
            executionType: 'automated',
            createdBy: primaryUserId,
            customCases: [
                {
                    id: 'TC-DUP-FAIL',
                    title: 'Case for duplicate testing',
                    automationMapping: {
                        framework: 'playwright',
                        mappingStatus: 'configured',
                        scriptCode: 'async () => {}'
                    }
                }
            ]
        });
        const cases = await supabaseService.getRunCases(dupTestRun.id);
        await supabaseService.recordTestExecution({
            runId: dupTestRun.id,
            runCaseId: cases[0].id,
            status: 'failed',
            durationMs: 1000
        });

        // Create an in-flight rerun
        const first = await rerunExecutionService.createRerunExecution({
            runId: dupTestRun.id,
            workspaceId: primaryWorkspaceId,
            userId: primaryUserId,
            scope: 'failed'
        });

        // Set status to 'running'
        await supabaseService.updateTestRun(first.newRunId, primaryWorkspaceId, {
            status: 'running'
        });

        // Try submitting second rerun for 'failed' on the same run
        await assert.rejects(
            async () => {
                await rerunExecutionService.createRerunExecution({
                    runId: dupTestRun.id,
                    workspaceId: primaryWorkspaceId,
                    userId: primaryUserId,
                    scope: 'failed'
                });
            },
            {
                statusCode: 409
            }
        );

        // Cancel the in-flight run
        await supabaseService.cancelTestRun(first.newRunId, primaryWorkspaceId);
    });

    // 10. Manual rerun
    it('10. Manual rerun: creates manual execution and allows new step outcomes', async () => {
        const manualOnlyRun = await supabaseService.createTestRun({
            workspaceId: primaryWorkspaceId,
            name: 'Manual Inspection Run',
            executionType: 'manual',
            createdBy: primaryUserId,
            customCases: [
                {
                    id: 'TC-MANUAL-INVOICE',
                    title: 'Inspect invoice margins',
                    executionType: 'manual',
                    steps: [
                        { step: 1, action: 'Measure top margin', expectedResult: '20mm' },
                        { step: 2, action: 'Measure bottom margin', expectedResult: '15mm' }
                    ]
                }
            ]
        });
        const mCases = await supabaseService.getRunCases(manualOnlyRun.id);
        await supabaseService.recordTestExecution({
            runId: manualOnlyRun.id,
            runCaseId: mCases[0].id,
            status: 'failed',
            actualResult: 'Top margin was 10mm (defect)',
            durationMs: 5000
        });

        // Trigger manual rerun
        const rerunResult = await rerunExecutionService.createRerunExecution({
            runId: manualOnlyRun.id,
            workspaceId: primaryWorkspaceId,
            userId: primaryUserId,
            scope: 'failed'
        });

        assert.equal(rerunResult.executionType, 'manual');
        const newRunCases = await supabaseService.getRunCases(rerunResult.newRunId);
        assert.equal(newRunCases.length, 1);
        assert.equal(newRunCases[0].status, 'not_run');

        // Record tester's retest outcome in the new manual run
        await supabaseService.recordTestExecution({
            runId: rerunResult.newRunId,
            runCaseId: newRunCases[0].id,
            status: 'passed',
            actualResult: 'Re-tested on printer firmware v2.4: Margins exactly 20mm',
            stepOutcomes: { 0: 'passed', 1: 'passed' },
            stepObservations: { 0: 'Verified with physical ruler: 20mm' },
            durationMs: 7200,
            executedBy: primaryUserId
        });

        const verifiedCase = await supabaseService.getRunCaseById(newRunCases[0].id);
        assert.equal(verifiedCase.status, 'passed');
        assert.equal(verifiedCase.currentAttempt, 1, 'First attempt in the new rerun record');

        await supabaseService.updateTestRun(rerunResult.newRunId, primaryWorkspaceId, { status: 'completed' });
    });

    // 11. Original execution remains unchanged
    it('11. Original execution remains completely unchanged after rerun creation', async () => {
        const origRun = await supabaseService.getTestRunById(initialRun.id, primaryWorkspaceId);
        const origCases = await supabaseService.getRunCases(initialRun.id);

        assert.equal(origRun.summary.total, 4, 'Original total cases must remain 4');
        assert.equal(origRun.summary.passed, 2, 'Original passed count must remain 2');
        assert.equal(origRun.summary.failed, 2, 'Original failed count must remain 2');

        const f1 = origCases.find(c => c.testCaseId === 'TC-CHK-FAIL-1');
        assert.equal(f1.status, 'failed', 'Original case status must stay failed');

        const f1History = await supabaseService.getCaseExecutions(f1.id);
        assert.equal(f1History.length, 1, 'Original execution attempts must not be cleared');
        assert.equal(f1History[0].status, 'failed');
    });

    // 12. New execution links to original
    it('12. New execution contains traceable linkage metadata (originalRunId, parentRunId, rerunType)', async () => {
        const rerunResult = await rerunExecutionService.createRerunExecution({
            runId: initialRun.id,
            workspaceId: primaryWorkspaceId,
            userId: primaryUserId,
            scope: 'selected',
            caseIds: ['TC-CHK-FAIL-1']
        });

        const rerun = await supabaseService.getTestRunById(rerunResult.newRunId, primaryWorkspaceId);
        assert.equal(rerun.originalRunId, initialRun.id);
        assert.equal(rerun.parentRunId, initialRun.id);
        assert.equal(rerun.rerunType, 'selected');
        assert.equal(rerun.isRerun, true);
        assert.deepEqual(rerun.selectedCaseIds, ['TC-CHK-FAIL-1']);

        // Check relationships API
        const rels = await rerunExecutionService.getRerunRelationships(rerun.id, primaryWorkspaceId);
        assert.ok(rels);
        assert.equal(rels.isRerun, true);
        assert.equal(rels.originalRun?.id, initialRun.id);
        assert.equal(rels.parentRun?.id, initialRun.id);

        await supabaseService.updateTestRun(rerunResult.newRunId, primaryWorkspaceId, { status: 'completed' });
    });

    // 13. Correct result persistence in the rerun
    it('13. Correct result persistence: new attempts are recorded under the new rerun run', async () => {
        const rerunResult = await rerunExecutionService.createRerunExecution({
            runId: initialRun.id,
            workspaceId: primaryWorkspaceId,
            userId: primaryUserId,
            scope: 'single',
            caseId: 'TC-CHK-FAIL-1'
        });

        const newCases = await supabaseService.getRunCases(rerunResult.newRunId);
        const targetCase = newCases[0];

        await supabaseService.recordTestExecution({
            runId: rerunResult.newRunId,
            runCaseId: targetCase.id,
            status: 'passed',
            actualResult: 'Element locator updated, test passes smoothly',
            durationMs: 1800,
            executorType: 'automated',
            executedBy: primaryUserId
        });

        const updated = await supabaseService.getRunCaseById(targetCase.id);
        assert.equal(updated.status, 'passed');

        const newHistory = await supabaseService.getCaseExecutions(targetCase.id);
        assert.equal(newHistory.length, 1);
        assert.equal(newHistory[0].status, 'passed');
        assert.equal(newHistory[0].runId, rerunResult.newRunId);

        await supabaseService.updateTestRun(rerunResult.newRunId, primaryWorkspaceId, { status: 'completed' });
    });

    // 14. Correct rerun history and comparison transitions
    it('14. Correct rerun history and terminal state comparison (Fixed, Still Failing)', async () => {
        // Retrieve full rerun history for original run
        const history = await rerunExecutionService.getRerunHistory(initialRun.id, primaryWorkspaceId);
        assert.ok(Array.isArray(history));
        assert.ok(history.length >= 2, 'History must include original run plus created reruns');
        assert.equal(history[0].id, initialRun.id, 'Original run must be first in chronological lineage');

        // Create a rerun with 2 failed cases
        const rerunResult = await rerunExecutionService.createRerunExecution({
            runId: initialRun.id,
            workspaceId: primaryWorkspaceId,
            userId: primaryUserId,
            scope: 'failed'
        });

        const rerunCases = await supabaseService.getRunCases(rerunResult.newRunId);
        const c1 = rerunCases.find(c => c.testCaseId === 'TC-CHK-FAIL-1');
        const c2 = rerunCases.find(c => c.testCaseId === 'TC-CHK-FAIL-2');

        // Case 1 passes (Fixed)
        await supabaseService.recordTestExecution({
            runId: rerunResult.newRunId,
            runCaseId: c1.id,
            status: 'passed',
            actualResult: 'Bug fixed, passed on rerun',
            durationMs: 1900
        });

        // Case 2 still fails (Still Failing)
        await supabaseService.recordTestExecution({
            runId: rerunResult.newRunId,
            runCaseId: c2.id,
            status: 'failed',
            actualResult: 'Still wrong price calculation',
            durationMs: 2100
        });

        // Run compareRerun
        const comparison = await rerunExecutionService.compareRerun(rerunResult.newRunId, primaryWorkspaceId);
        assert.ok(comparison);
        assert.equal(comparison.originalRunId, initialRun.id);
        assert.equal(comparison.terminalStateReached, true);
        assert.equal(comparison.summary.totalCompared, 2);
        assert.equal(comparison.summary.fixedCount, 1, '1 case should have transitioned to Fixed');
        assert.equal(comparison.summary.stillFailingCount, 1, '1 case should be Still Failing');
        assert.equal(comparison.summary.verdict, 'PARTIALLY_FIXED');

        const comp1 = comparison.comparisons.find(c => c.testCaseId === 'TC-CHK-FAIL-1');
        assert.equal(comp1.originalStatus, 'failed');
        assert.equal(comp1.rerunStatus, 'passed');
        assert.equal(comp1.transition, 'fixed');
        assert.equal(comp1.isFixed, true);

        const comp2 = comparison.comparisons.find(c => c.testCaseId === 'TC-CHK-FAIL-2');
        assert.equal(comp2.originalStatus, 'failed');
        assert.equal(comp2.rerunStatus, 'failed');
        assert.equal(comp2.transition, 'still_failing');
        assert.equal(comp2.isFixed, false);
    });

    it('15. Comprehensive Classification: Regression (Passed -> Failed), Blocked, Skipped, and Still Passing', async () => {
        // Setup original run with 4 cases: 1 passed, 1 failed, 1 failed, 1 passed
        const origRun = await supabaseService.createTestRun({
            workspaceId: primaryWorkspaceId,
            suiteId: parentSuite.id,
            name: 'Original Multi-State Run',
            executionType: 'manual',
            cases: [
                { id: 'TC-STATE-1', title: 'State Test 1', priority: 'High', executionType: 'manual' },
                { id: 'TC-STATE-2', title: 'State Test 2', priority: 'High', executionType: 'manual' },
                { id: 'TC-STATE-3', title: 'State Test 3', priority: 'Medium', executionType: 'manual' },
                { id: 'TC-STATE-4', title: 'State Test 4', priority: 'Low', executionType: 'manual' }
            ]
        });
        const origCases = await supabaseService.getRunCases(origRun.id);

        // Record original: TC-STATE-1 passed, TC-STATE-2 failed, TC-STATE-3 failed, TC-STATE-4 passed
        await supabaseService.recordTestExecution({
            runId: origRun.id,
            runCaseId: origCases[0].id,
            status: 'passed',
            actualResult: 'Passed initial check',
            durationMs: 500
        });
        await supabaseService.recordTestExecution({
            runId: origRun.id,
            runCaseId: origCases[1].id,
            status: 'failed',
            actualResult: 'Original error: element not found',
            errorMessage: 'NoSuchElementError: #submit-btn',
            durationMs: 1200
        });
        await supabaseService.recordTestExecution({
            runId: origRun.id,
            runCaseId: origCases[2].id,
            status: 'failed',
            actualResult: 'Original timeout',
            errorMessage: 'TimeoutError: 30000ms exceeded',
            durationMs: 30000
        });
        await supabaseService.recordTestExecution({
            runId: origRun.id,
            runCaseId: origCases[3].id,
            status: 'passed',
            actualResult: 'Passed initially',
            durationMs: 800
        });

        await supabaseService.updateTestRun(origRun.id, { status: 'completed' });

        // Save an artifact for original TC-STATE-2
        await supabaseService.saveArtifact({
            runId: origRun.id,
            runCaseId: origCases[1].id,
            name: 'orig-failure.png',
            storagePath: 'runs/orig-failure.png',
            artifactType: 'screenshot',
            mimeType: 'image/png'
        });

        // Create rerun for selected cases (TC-STATE-1, TC-STATE-2, TC-STATE-3, TC-STATE-4)
        const rerunResult = await rerunExecutionService.createRerunExecution({
            runId: origRun.id,
            workspaceId: primaryWorkspaceId,
            scope: 'selected',
            caseIds: ['TC-STATE-1', 'TC-STATE-2', 'TC-STATE-3', 'TC-STATE-4']
        });

        const rerunCases = await supabaseService.getRunCases(rerunResult.newRunId);

        // Record rerun:
        // TC-STATE-1: was passed -> now failed (REGRESSION!)
        await supabaseService.recordTestExecution({
            runId: rerunResult.newRunId,
            runCaseId: rerunCases.find(c => c.testCaseId === 'TC-STATE-1').id,
            status: 'failed',
            actualResult: 'Regression: unexpected 500 error',
            errorMessage: 'InternalServerError: Database deadlock',
            durationMs: 1500
        });
        // TC-STATE-2: was failed -> now blocked
        await supabaseService.recordTestExecution({
            runId: rerunResult.newRunId,
            runCaseId: rerunCases.find(c => c.testCaseId === 'TC-STATE-2').id,
            status: 'blocked',
            actualResult: 'Blocked by downstream auth API outage',
            durationMs: 200
        });
        // TC-STATE-3: was failed -> now skipped
        await supabaseService.recordTestExecution({
            runId: rerunResult.newRunId,
            runCaseId: rerunCases.find(c => c.testCaseId === 'TC-STATE-3').id,
            status: 'skipped',
            notes: 'Skipped due to test environment maintenance',
            durationMs: 0
        });
        // TC-STATE-4: was passed -> now passed (STILL PASSING)
        await supabaseService.recordTestExecution({
            runId: rerunResult.newRunId,
            runCaseId: rerunCases.find(c => c.testCaseId === 'TC-STATE-4').id,
            status: 'passed',
            actualResult: 'Passed check again smoothly',
            durationMs: 750
        });

        await supabaseService.updateTestRun(rerunResult.newRunId, { status: 'completed' });

        // Compare from original run providing ?rerunId=
        const comp = await rerunExecutionService.compareRerun(origRun.id, primaryWorkspaceId, rerunResult.newRunId);

        assert.ok(comp);
        assert.equal(comp.terminalStateReached, true);
        assert.equal(comp.summary.regressionCount, 1, 'TC-STATE-1 must be classified as Regression');
        assert.equal(comp.summary.blockedCount, 1, 'TC-STATE-2 must be classified as Blocked');
        assert.equal(comp.summary.skippedCount, 1, 'TC-STATE-3 must be classified as Skipped');
        assert.equal(comp.summary.stillPassingCount, 1, 'TC-STATE-4 must be classified as Still Passing');
        assert.equal(comp.summary.verdict, 'REGRESSIONS_DETECTED');

        const regCase = comp.comparisons.find(c => c.testCaseId === 'TC-STATE-1');
        assert.equal(regCase.transition, 'regression');
        assert.equal(regCase.isRegression, true);

        // Verify diagnostic details preserved
        const blockedCase = comp.comparisons.find(c => c.testCaseId === 'TC-STATE-2');
        assert.equal(blockedCase.transition, 'blocked');
        assert.ok(blockedCase.originalDetails.artifacts.length > 0, 'Original artifact should be linked in diagnostics');

        // Verify original execution remains immutable
        const originalRunAfter = await supabaseService.getTestRunById(origRun.id);
        const originalCasesAfter = await supabaseService.getRunCases(origRun.id);
        assert.ok(['completed', 'failed'].includes(originalRunAfter.status), 'Original run status should remain intact');
        assert.equal(originalCasesAfter.find(c => c.testCaseId === 'TC-STATE-1').status, 'passed', 'Original run case must stay immutable');
    });

    it('16. In-Progress/Pending State & Relationship Enforcement', async () => {
        // Original run with 2 failed cases
        const origRun = await supabaseService.createTestRun({
            workspaceId: primaryWorkspaceId,
            suiteId: parentSuite.id,
            name: 'Original Run For Pending Test',
            executionType: 'manual',
            cases: [
                { id: 'TC-PEND-1', title: 'Pending Case 1', priority: 'High', executionType: 'manual' },
                { id: 'TC-PEND-2', title: 'Pending Case 2', priority: 'Low', executionType: 'manual' }
            ]
        });
        const origCases = await supabaseService.getRunCases(origRun.id);

        for (const c of origCases) {
            await supabaseService.recordTestExecution({
                runId: origRun.id,
                runCaseId: c.id,
                status: 'failed',
                actualResult: 'Failed initially',
                durationMs: 500
            });
        }
        await supabaseService.updateTestRun(origRun.id, { status: 'completed' });

        // Create rerun but leave in-progress
        const rerunResult = await rerunExecutionService.createRerunExecution({
            runId: origRun.id,
            workspaceId: primaryWorkspaceId,
            scope: 'failed'
        });

        // Comparison while rerun is active
        const pendingComp = await rerunExecutionService.compareRerun(rerunResult.newRunId, primaryWorkspaceId);
        assert.equal(pendingComp.terminalStateReached, false);
        assert.equal(pendingComp.summary.verdict, 'IN_PROGRESS');
        assert.equal(pendingComp.summary.pendingCount, 2);

        // Cross-workspace comparison should throw 403
        await assert.rejects(
            async () => {
                await rerunExecutionService.compareRerun(rerunResult.newRunId, unauthorizedWorkspaceId);
            },
            { statusCode: 403 }
        );

        // Comparing completely unrelated runs should throw 400
        const unrelatedRun = await supabaseService.createTestRun({
            workspaceId: primaryWorkspaceId,
            suiteId: parentSuite.id,
            name: 'Unrelated Standalone Run',
            executionType: 'manual',
            cases: [{ id: 'TC-UNRELATED-1', title: 'Unrelated', priority: 'Medium' }]
        });

        await assert.rejects(
            async () => {
                await rerunExecutionService.compareRerun(origRun.id, primaryWorkspaceId, unrelatedRun.id);
            },
            { statusCode: 400 }
        );

        // Mark rerun completed to clean up
        await supabaseService.updateTestRun(rerunResult.newRunId, { status: 'completed' });
    });

    it('17. Added and Omitted Test Cases Classification & Duration Deltas', async () => {
        // Original run with TC-BASE-1, TC-BASE-2, TC-BASE-3
        const origRun = await supabaseService.createTestRun({
            workspaceId: primaryWorkspaceId,
            suiteId: parentSuite.id,
            name: 'Original Run for Added/Omitted Test',
            executionType: 'manual',
            cases: [
                { id: 'TC-BASE-1', title: 'Base Test 1', priority: 'High', executionType: 'manual' },
                { id: 'TC-BASE-2', title: 'Base Test 2', priority: 'Medium', executionType: 'manual' },
                { id: 'TC-BASE-3', title: 'Base Test 3', priority: 'Low', executionType: 'manual' }
            ]
        });
        const origCases = await supabaseService.getRunCases(origRun.id);
        for (const c of origCases) {
            await supabaseService.recordTestExecution({
                runId: origRun.id,
                runCaseId: c.id,
                status: 'failed',
                actualResult: 'Failed initially',
                durationMs: 1000
            });
        }
        await supabaseService.updateTestRun(origRun.id, { status: 'completed' });

        // Create rerun targeting only TC-BASE-1 (omitting TC-BASE-2 and TC-BASE-3)
        const rerunResult = await rerunExecutionService.createRerunExecution({
            runId: origRun.id,
            workspaceId: primaryWorkspaceId,
            scope: 'selected',
            caseIds: ['TC-BASE-1']
        });

        // Add a new synthetic case directly to rerun to test `added` classification
        const newRunCaseId = 'trc_added_' + Date.now();
        supabaseService.inMemoryTestRunCases.set(newRunCaseId, {
            id: newRunCaseId,
            run_id: rerunResult.newRunId,
            test_case_id: 'TC-NEW-ADDED',
            case_snapshot: { id: 'TC-NEW-ADDED', title: 'Newly Added Scenario', priority: 'High' },
            execution_type: 'manual',
            status: 'passed',
            actual_result: 'Passed cleanly',
            duration_ms: 1200
        });

        const rerunCases = await supabaseService.getRunCases(rerunResult.newRunId);
        // Execute TC-BASE-1 to passed
        await supabaseService.recordTestExecution({
            runId: rerunResult.newRunId,
            runCaseId: rerunCases.find(c => c.testCaseId === 'TC-BASE-1').id,
            status: 'passed',
            actualResult: 'Passed on rerun in 400ms',
            durationMs: 400
        });
        await supabaseService.updateTestRun(rerunResult.newRunId, { status: 'completed' });

        const comparison = await rerunExecutionService.compareRerun(rerunResult.newRunId, primaryWorkspaceId);
        assert.ok(comparison);

        // Check omitted cases: TC-BASE-2 and TC-BASE-3
        const omitted2 = comparison.comparisons.find(c => c.testCaseId === 'TC-BASE-2');
        assert.ok(omitted2, 'TC-BASE-2 should be present in comparison as omitted');
        assert.equal(omitted2.transition, 'omitted');
        assert.equal(omitted2.rerunStatus, 'omitted');

        const omitted3 = comparison.comparisons.find(c => c.testCaseId === 'TC-BASE-3');
        assert.ok(omitted3, 'TC-BASE-3 should be present in comparison as omitted');
        assert.equal(omitted3.transition, 'omitted');

        // Check added case: TC-NEW-ADDED
        const added = comparison.comparisons.find(c => c.testCaseId === 'TC-NEW-ADDED');
        assert.ok(added, 'TC-NEW-ADDED should be present in comparison as added');
        assert.equal(added.transition, 'added');
        assert.equal(added.transitionLabel, 'New Test');

        // Check duration delta on TC-BASE-1 (400ms - 1000ms = -600ms)
        const base1 = comparison.comparisons.find(c => c.testCaseId === 'TC-BASE-1');
        assert.equal(base1.transition, 'fixed');
        assert.equal(base1.durationDiffMs, -600);
    });
});
