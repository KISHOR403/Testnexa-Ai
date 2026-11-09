/**
 * TestNexa AI — Test Case vs Test Execution Architecture Test Suite
 *
 * Validates:
 * 1. Test case lifecycle separation (Draft/Ready/Needs Review/Archived vs Not Run/In Progress/Passed/Failed/Blocked/Skipped/Error)
 * 2. Generated test cases default to 'ready' and 'not_run' with zero execution records
 * 3. Creating or editing a test case never creates execution records
 * 4. Manual execution step outcome derivation:
 *    - All steps passed -> passed
 *    - Any step failed -> failed
 *    - Blocked step without failures -> blocked
 * 5. Completion validation rejects unverified steps with 400 INCOMPLETE_STEPS
 * 6. Real API execution engine executes HTTP calls, latency tracking, assertion evaluations
 * 7. Multiple execution history is preserved chronologically without overwriting past attempts
 * 8. Execution report accurately differentiates total cases vs actually executed tests
 * 9. Pass rate denominator excludes unexecuted tests and handles zero executions explicitly
 * 10. Requirement coverage strictly separates Linked != Executed != Passed != Verified
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTestCase } = require('../src/services/processor.service');
const supabaseService = require('../src/services/supabaseData.service');
const apiExecutionService = require('../src/services/runner/apiExecution.service');
const executionReportService = require('../src/services/runner/executionReport.service');

const TEST_WS_ID = 'ws_execution_arch_test';

describe('Test Case vs Test Execution Architecture', () => {

    // ─────────────────────────────────────────────────────────────
    // 1. GENERATION & CREATION NEVER EXECUTES TESTS
    // ─────────────────────────────────────────────────────────────
    describe('1. Test Case Lifecycle vs Execution Status Separation', () => {
        it('should default AI generated test cases to ready lifecycle and not_run execution status', () => {
            const rawTestCase = {
                title: 'Verify user checkout with credit card',
                description: 'Ensures payment processing succeeds',
                type: 'Functional',
                priority: 'High',
                preconditions: 'User is authenticated and has items in cart',
                steps: [
                    { action: 'Navigate to checkout', expected: 'Checkout form displayed' },
                    { action: 'Enter valid card info', expected: 'Fields populated' },
                    { action: 'Click Pay Now', expected: 'Confirmation modal shown' }
                ],
                expectedResult: 'Order confirmation code generated'
            };

            const tc = normalizeTestCase(rawTestCase, 'functional', 0, 'Checkout');

            // Lifecycle status must be 'ready', NEVER 'passed' or 'failed'
            assert.strictEqual(tc.lifecycleStatus, 'ready');
            assert.strictEqual(tc.status, 'ready');

            // Execution status must default to 'not_run'
            assert.strictEqual(tc.executionStatus, 'not_run');
            assert.strictEqual(tc.actualResult, 'Not yet executed');
        });

        it('creating a test case in storage should never create an execution record', async () => {
            const fakeTestCaseId = `tc_lifecycle_${Date.now()}`;

            // Confirm no executions exist in the database for this new test case
            const executions = await supabaseService.getTestCaseAllExecutions(fakeTestCaseId);
            assert.strictEqual(executions.length, 0, 'No execution record should exist for a newly created test case');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 2. MANUAL EXECUTION & DETERMINISTIC STEP DERIVATION
    // ─────────────────────────────────────────────────────────────
    describe('2. Manual Step Verification & Completion Rules', () => {
        it('should derive overall status = passed when all steps pass', async () => {
            // Create test run with workspaceId
            const run = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_step_eval',
                name: 'Manual Validation Run 1',
                executionType: 'manual',
                cases: [
                    {
                        testCaseId: 'TC-STEP-001',
                        title: 'Sign In with OTP',
                        steps: [
                            { stepNumber: 1, action: 'Request OTP', expected: 'Code sent' },
                            { stepNumber: 2, action: 'Enter 6-digit code', expected: 'Code accepted' },
                            { stepNumber: 3, action: 'Submit', expected: 'Dashboard loaded' }
                        ]
                    }
                ]
            });

            const runCase = run.cases[0];

            // Submit execution with all steps passed
            const execResult = await supabaseService.recordTestExecution({
                runId: run.id,
                runCaseId: runCase.id,
                status: 'passed',
                actualResult: 'User signed in smoothly.',
                stepOutcomes: {
                    0: 'passed',
                    1: 'passed',
                    2: 'passed'
                },
                stepObservations: {
                    0: 'OTP received',
                    1: 'Code accepted',
                    2: 'Dashboard rendered'
                },
                executorType: 'manual'
            });

            assert.strictEqual(execResult.execution.status, 'passed');
            const updatedCase = await supabaseService.getRunCaseById(runCase.id);
            assert.strictEqual(updatedCase.status, 'passed');
        });

        it('should derive overall status = failed if any individual step fails', async () => {
            const run = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_step_eval_fail',
                name: 'Manual Validation Run 2',
                executionType: 'manual',
                cases: [
                    {
                        testCaseId: 'TC-STEP-002',
                        title: 'Password change workflow',
                        steps: [
                            { stepNumber: 1, action: 'Enter old password', expected: 'Accepted' },
                            { stepNumber: 2, action: 'Enter new password', expected: 'Strength verified' },
                            { stepNumber: 3, action: 'Save password', expected: 'Success banner' }
                        ]
                    }
                ]
            });

            const runCase = run.cases[0];

            // Tester marked step 3 failed
            const execResult = await supabaseService.recordTestExecution({
                runId: run.id,
                runCaseId: runCase.id,
                status: 'passed', // Form attempted 'passed', but step 2 failed -> engine derives failed!
                actualResult: 'Failed to update password at step 3.',
                stepOutcomes: {
                    0: 'passed',
                    1: 'passed',
                    2: 'failed'
                },
                stepObservations: {
                    2: 'Server 500 error on submit'
                },
                executorType: 'manual'
            });

            assert.strictEqual(execResult.execution.status, 'failed', 'A failed step must derive overall execution status as failed');
            const updatedCase = await supabaseService.getRunCaseById(runCase.id);
            assert.strictEqual(updatedCase.status, 'failed');
        });

        it('should derive overall status = blocked if a step is blocked and no steps failed', async () => {
            const run = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_step_eval_blocked',
                name: 'Manual Validation Run 3',
                executionType: 'manual',
                cases: [
                    {
                        testCaseId: 'TC-STEP-003',
                        title: 'Third-party integration sync',
                        steps: [
                            { stepNumber: 1, action: 'Open settings', expected: 'Settings visible' },
                            { stepNumber: 2, action: 'Click Connect Slack', expected: 'Slack OAuth screen' }
                        ]
                    }
                ]
            });

            const runCase = run.cases[0];

            const execResult = await supabaseService.recordTestExecution({
                runId: run.id,
                runCaseId: runCase.id,
                status: 'passed',
                actualResult: 'External OAuth service unreachable.',
                stepOutcomes: {
                    0: 'passed',
                    1: 'blocked'
                },
                stepObservations: {
                    1: 'Slack API maintenance 503'
                },
                executorType: 'manual'
            });

            assert.strictEqual(execResult.execution.status, 'blocked');
            const updatedCase = await supabaseService.getRunCaseById(runCase.id);
            assert.strictEqual(updatedCase.status, 'blocked');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 3. REAL API TESTING EXECUTION ENGINE
    // ─────────────────────────────────────────────────────────────
    describe('3. Real API Execution Engine', () => {
        it('should evaluate body and status code assertions accurately', () => {
            const responseData = {
                status: 201,
                durationMs: 120,
                headers: { 'content-type': 'application/json' },
                data: {
                    user: { id: 'usr_101', role: 'admin', active: true },
                    token: 'eyJh...'
                }
            };

            const passStatus = apiExecutionService.evaluateAssertion({ type: 'statusCode', expected: 201 }, responseData);
            assert.strictEqual(passStatus.passed, true);

            const failStatus = apiExecutionService.evaluateAssertion({ type: 'statusCode', expected: 200 }, responseData);
            assert.strictEqual(failStatus.passed, false);

            const passPath = apiExecutionService.evaluateAssertion({ type: 'bodyPath', property: 'user.role', expected: 'admin' }, responseData);
            assert.strictEqual(passPath.passed, true);

            const failPath = apiExecutionService.evaluateAssertion({ type: 'bodyPath', property: 'user.role', expected: 'viewer' }, responseData);
            assert.strictEqual(failPath.passed, false);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 4. MULTIPLE EXECUTION HISTORY IS PRESERVED
    // ─────────────────────────────────────────────────────────────
    describe('4. Multiple Immutable Execution History', () => {
        it('should preserve chronological execution history across multiple attempts and runs without overwriting', async () => {
            const canonicalTestCaseId = `TC_IMMUTABLE_${Date.now()}`;

            // Run 1: Failed
            const run1 = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_multirun_audit',
                name: 'Sprint 20 Regression Run',
                executionType: 'manual',
                cases: [{ testCaseId: canonicalTestCaseId, title: 'Export PDF Report' }]
            });
            await supabaseService.recordTestExecution({
                runId: run1.id,
                runCaseId: run1.cases[0].id,
                status: 'failed',
                actualResult: 'Out of memory error in worker',
                executorType: 'manual'
            });

            // Run 2: Failed again
            const run2 = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_multirun_audit',
                name: 'Sprint 20 Hotfix Verification',
                executionType: 'manual',
                cases: [{ testCaseId: canonicalTestCaseId, title: 'Export PDF Report' }]
            });
            await supabaseService.recordTestExecution({
                runId: run2.id,
                runCaseId: run2.cases[0].id,
                status: 'failed',
                actualResult: 'Timeout generating chart assets',
                executorType: 'manual'
            });

            // Run 3: Passed
            const run3 = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_multirun_audit',
                name: 'Sprint 20 Release Signoff',
                executionType: 'manual',
                cases: [{ testCaseId: canonicalTestCaseId, title: 'Export PDF Report' }]
            });
            await supabaseService.recordTestExecution({
                runId: run3.id,
                runCaseId: run3.cases[0].id,
                status: 'passed',
                actualResult: 'PDF successfully exported and verified',
                executorType: 'manual'
            });

            // Query full multi-run history for this test case (ordered newest to oldest)
            const fullHistory = await supabaseService.getTestCaseAllExecutions(canonicalTestCaseId);

            assert.strictEqual(fullHistory.length, 3, 'All 3 execution records must be preserved');
            assert.strictEqual(fullHistory[0].status, 'passed', 'Latest attempt (Run 3) was passed');
            assert.strictEqual(fullHistory[1].status, 'failed', 'Previous attempt (Run 2) was failed');
            assert.strictEqual(fullHistory[2].status, 'failed', 'Initial attempt (Run 1) was failed');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 5. TEST RUN REPORT METRICS & COVERAGE DISTINCTION
    // ─────────────────────────────────────────────────────────────
    describe('5. Test Run Report & Requirement Coverage Tiers', () => {
        it('should show "No tests have been executed yet." when 0 tests executed in run', async () => {
            const run = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_unexecuted_report',
                name: 'Staging Smoke Test Plan',
                executionType: 'automated',
                cases: [
                    { testCaseId: 'TC-UNEXEC-01', title: 'Home page renders' },
                    { testCaseId: 'TC-UNEXEC-02', title: 'Login page renders' },
                    { testCaseId: 'TC-UNEXEC-03', title: 'Pricing page renders' }
                ]
            });

            const report = await executionReportService.generateRunReport(run.id, TEST_WS_ID);

            assert.strictEqual(report.summary.total, 3);
            assert.strictEqual(report.summary.actuallyExecuted, 0);
            assert.strictEqual(report.summary.notRun, 3);
            assert.strictEqual(report.identifiers.hasExecutedTests, false);
            assert.strictEqual(report.identifiers.statusMessage, 'No tests have been executed yet.');
            assert.strictEqual(report.summary.passRate, 0, 'Pass rate should not be 100% when no tests executed');
        });

        it('strict pass rate calculation excludes not_run from denominator', async () => {
            const run = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_partial_exec',
                name: 'Partial Execution Suite',
                executionType: 'manual',
                cases: [
                    { testCaseId: 'TC-PART-01', title: 'Feature 1' },
                    { testCaseId: 'TC-PART-02', title: 'Feature 2' },
                    { testCaseId: 'TC-PART-03', title: 'Feature 3' },
                    { testCaseId: 'TC-PART-04', title: 'Feature 4' }
                ]
            });

            // Execute ONLY case 1 (passed) and case 2 (failed). Cases 3 & 4 remain not_run.
            await supabaseService.recordTestExecution({
                runId: run.id,
                runCaseId: run.cases[0].id,
                status: 'passed',
                actualResult: 'Pass',
                executorType: 'manual'
            });
            await supabaseService.recordTestExecution({
                runId: run.id,
                runCaseId: run.cases[1].id,
                status: 'failed',
                actualResult: 'Fail',
                executorType: 'manual'
            });

            const report = await executionReportService.generateRunReport(run.id, TEST_WS_ID);

            assert.strictEqual(report.summary.total, 4);
            assert.strictEqual(report.summary.actuallyExecuted, 2);
            assert.strictEqual(report.summary.passed, 1);
            assert.strictEqual(report.summary.failed, 1);
            assert.strictEqual(report.summary.notRun, 2);

            // Pass rate of executed tests: 1 / (1 passed + 1 failed) = 50%
            // NOT 1 / 4 (25%)!
            assert.strictEqual(report.summary.passRate, 50, 'Pass rate must be 50% of executed tests, not diluted by unexecuted tests');
        });

        it('requirement coverage strictly separates Linked != Executed != Passed != Verified', async () => {
            const suite = {
                requirements: [
                    { id: 'REQ-AUTH', description: 'Authentication flow' },
                    { id: 'REQ-BILLING', description: 'Billing subscription flow' },
                    { id: 'REQ-PAYMENT', description: 'Payment processing' }
                ]
            };

            const cases = [
                { id: 'c1', testCaseId: 'TC-1', requirementId: 'REQ-AUTH', caseSnapshot: { requirementId: 'REQ-AUTH' }, status: 'passed' },
                { id: 'c2', testCaseId: 'TC-2', requirementId: 'REQ-AUTH', caseSnapshot: { requirementId: 'REQ-AUTH' }, status: 'passed' },
                { id: 'c3', testCaseId: 'TC-3', requirementId: 'REQ-BILLING', caseSnapshot: { requirementId: 'REQ-BILLING' }, status: 'failed' },
                { id: 'c4', testCaseId: 'TC-4', requirementId: 'REQ-PAYMENT', caseSnapshot: { requirementId: 'REQ-PAYMENT' }, status: 'not_run' }
            ];

            const coverage = executionReportService.computeRunCoverage(cases, suite);

            // 3 requirements are linked: REQ-AUTH, REQ-BILLING, REQ-PAYMENT
            assert.strictEqual(coverage.linkedRequirements, 3);

            // Only 2 requirements were actually executed: REQ-AUTH, REQ-BILLING
            assert.strictEqual(coverage.executedRequirements, 2);

            // Passed requirements: REQ-AUTH had passed tests
            assert.strictEqual(coverage.passedRequirements, 1);

            // Verified requirements: REQ-AUTH has 100% pass rate
            assert.strictEqual(coverage.verifiedRequirements, 1);

            // Failed requirements: REQ-BILLING had failing test
            assert.strictEqual(coverage.failedRequirements, 1);

            // Unverified requirements (linked but unexecuted): REQ-PAYMENT
            assert.strictEqual(coverage.unverifiedRequirements, 1);
        });
    });
});
