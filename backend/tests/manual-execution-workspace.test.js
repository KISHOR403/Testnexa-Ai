/**
 * TestNexa AI — Manual Execution Workspace 2.0 Test Suite
 *
 * Validates:
 * 1. Centralized execution status calculation engine:
 *    - Strict precedence hierarchy: failed > error > blocked > skipped > passed > in_progress > not_run
 *    - Incomplete steps validation: Rejects completion request with INCOMPLETE_STEPS when steps are unverified
 *    - Non-step test cases require documented actual verification to complete as passed
 * 2. Defect management subsystem:
 *    - Defect logging from failed test step / case
 *    - Cross-run and case defect filtering
 *    - Defect lifecycle update (open -> in_progress -> resolved)
 * 3. Draft persistence and autosave:
 *    - Draft saving and retrieval via Supabase data service
 *    - Drafts do not falsely alter official run summary or case status
 * 4. Immutable execution history:
 *    - Re-executions create chronological historical attempt records
 *    - Prior attempts and tester observations are permanently preserved
 * 5. Execution report summary metrics:
 *    - Pass rate denominator strictly excludes unexecuted tests
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const executionStatusEngine = require('../src/services/runner/executionStatusEngine.service');
const defectService = require('../src/services/defect.service');
const supabaseService = require('../src/services/supabaseData.service');
const executionReportService = require('../src/services/runner/executionReport.service');

const TEST_WS_ID = 'ws_manual_workspace_2_test';
const TEST_USER_ID = 'usr_manual_tester_1';

describe('Manual Execution Workspace 2.0 Architecture', () => {

    // ─────────────────────────────────────────────────────────────
    // 1. CENTRALIZED EXECUTION STATUS ENGINE PRECEDENCE
    // ─────────────────────────────────────────────────────────────
    describe('1. Execution Status Engine Precedence & Evaluation', () => {
        it('should evaluate to passed when all required steps are passed', () => {
            const steps = [
                { stepNumber: 1, action: 'Open login page', status: 'passed' },
                { stepNumber: 2, action: 'Enter credentials', status: 'passed' },
                { stepNumber: 3, action: 'Click submit', status: 'passed' }
            ];

            const result = executionStatusEngine.evaluateExecutionStatus(steps);
            assert.strictEqual(result.derivedStatus, 'passed');
            assert.strictEqual(result.isComplete, true);
            assert.strictEqual(result.metrics.passed, 3);
            assert.strictEqual(result.metrics.failed, 0);
            assert.strictEqual(result.metrics.incomplete, 0);
        });

        it('should enforce strict precedence: any failed step marks overall outcome as failed', () => {
            const steps = [
                { stepNumber: 1, action: 'Open login page', status: 'passed' },
                { stepNumber: 2, action: 'Enter credentials', status: 'failed', actual: 'Server 500 error' },
                { stepNumber: 3, action: 'Click submit', status: 'passed' }
            ];

            const result = executionStatusEngine.evaluateExecutionStatus(steps);
            assert.strictEqual(result.derivedStatus, 'failed');
            assert.strictEqual(result.isComplete, true);
            assert.strictEqual(result.metrics.failed, 1);
            assert.strictEqual(result.metrics.passed, 2);
        });

        it('should enforce strict precedence: blocked steps without failures yield blocked', () => {
            const steps = [
                { stepNumber: 1, action: 'Setup environment', status: 'passed' },
                { stepNumber: 2, action: 'Access test database', status: 'blocked', actual: 'Database unreachable' },
                { stepNumber: 3, action: 'Run migration', status: 'pending' }
            ];

            const result = executionStatusEngine.evaluateExecutionStatus(steps);
            assert.strictEqual(result.derivedStatus, 'blocked');
            assert.strictEqual(result.isComplete, false);
            assert.strictEqual(result.metrics.blocked, 1);
            assert.strictEqual(result.metrics.incomplete, 1);
        });

        it('should evaluate to skipped when all steps are explicitly skipped', () => {
            const steps = [
                { stepNumber: 1, action: 'Feature A', status: 'skipped' },
                { stepNumber: 2, action: 'Feature B', status: 'skipped' }
            ];

            const result = executionStatusEngine.evaluateExecutionStatus(steps);
            assert.strictEqual(result.derivedStatus, 'skipped');
            assert.strictEqual(result.isComplete, true);
            assert.strictEqual(result.metrics.skipped, 2);
        });

        it('should mark in_progress when steps remain pending or incomplete', () => {
            const steps = [
                { stepNumber: 1, action: 'Step 1', status: 'passed' },
                { stepNumber: 2, action: 'Step 2', status: 'pending' }
            ];

            const result = executionStatusEngine.evaluateExecutionStatus(steps);
            assert.strictEqual(result.derivedStatus, 'in_progress');
            assert.strictEqual(result.isComplete, false);
            assert.strictEqual(result.metrics.incomplete, 1);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 2. COMPLETION VALIDATION ENGINE
    // ─────────────────────────────────────────────────────────────
    describe('2. Completion Request Validation & Constraints', () => {
        it('should reject request to complete as passed when unverified steps exist', () => {
            const steps = [
                { stepNumber: 1, action: 'Step 1', status: 'passed' },
                { stepNumber: 2, action: 'Step 2', status: 'pending' }
            ];

            const validation = executionStatusEngine.validateCompletionRequest({
                requestedStatus: 'passed',
                steps,
                actualResult: 'Tested partially'
            });

            assert.strictEqual(validation.valid, false);
            assert.strictEqual(validation.code, 'INCOMPLETE_STEPS');
            assert.ok(validation.error.includes('remain incomplete'));
        });

        it('should reject non-step test cases attempting to pass without documented observations', () => {
            const validation = executionStatusEngine.validateCompletionRequest({
                requestedStatus: 'passed',
                steps: [],
                actualResult: '' // empty actual result
            });

            assert.strictEqual(validation.valid, false);
            assert.strictEqual(validation.code, 'MISSING_ACTUAL_RESULT');
        });

        it('should allow non-step test cases to pass when meaningful observations are recorded', () => {
            const validation = executionStatusEngine.validateCompletionRequest({
                requestedStatus: 'passed',
                steps: [],
                actualResult: 'Verified payment confirmation modal rendered with order ID #9821'
            });

            assert.strictEqual(validation.valid, true);
            assert.strictEqual(validation.finalStatus, 'passed');
        });

        it('should prevent user from recording status passed when a step failed', () => {
            const steps = [
                { stepNumber: 1, action: 'Step 1', status: 'passed' },
                { stepNumber: 2, action: 'Step 2', status: 'failed', actual: 'Crash' }
            ];

            const validation = executionStatusEngine.validateCompletionRequest({
                requestedStatus: 'passed',
                steps,
                actualResult: 'Attempted override'
            });

            assert.strictEqual(validation.valid, false);
            assert.strictEqual(validation.code, 'INVALID_STATUS_OVERRIDE');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 3. DEFECT MANAGEMENT SUBSYSTEM
    // ─────────────────────────────────────────────────────────────
    describe('3. Defect Management Subsystem', () => {
        let createdDefectId = null;

        it('should create a defect linked to a failed step and test execution', async () => {
            const defectData = {
                title: 'Order button does not submit cart form',
                description: 'Clicking order button triggers network timeout 504 on staging build #89',
                severity: 'critical',
                priority: 'P0',
                stepNumber: 3,
                expectedResult: 'HTTP 200 with order confirmation payload',
                actualResult: 'HTTP 504 Gateway Timeout after 30000ms',
                evidence: [
                    { name: 'console_error.log', mimeType: 'text/plain' }
                ]
            };

            const defect = await defectService.createDefect({
                workspaceId: TEST_WS_ID,
                runId: 'run_manual_defect_test',
                runCaseId: 'rc_manual_defect_case',
                testCaseId: 'TC-PAY-003',
                defectData,
                user: { id: TEST_USER_ID, name: 'Aditya QA' }
            });

            assert.ok(defect.id);
            assert.strictEqual(defect.title, defectData.title);
            assert.strictEqual(defect.severity, 'critical');
            assert.strictEqual(defect.priority, 'P0');
            assert.strictEqual(defect.stepNumber, 3);
            assert.strictEqual(defect.status, 'open');
            assert.strictEqual(defect.evidence.length, 1);

            createdDefectId = defect.id;
        });

        it('should list defects filtered by runId and runCaseId', async () => {
            const defectsForRun = await defectService.listDefects({
                workspaceId: TEST_WS_ID,
                runId: 'run_manual_defect_test'
            });

            assert.ok(Array.isArray(defectsForRun));
            assert.ok(defectsForRun.length >= 1);
            assert.ok(defectsForRun.some(d => d.id === createdDefectId));

            const defectsForCase = await defectService.listDefects({
                workspaceId: TEST_WS_ID,
                runCaseId: 'rc_manual_defect_case'
            });

            assert.ok(Array.isArray(defectsForCase));
            assert.strictEqual(defectsForCase[0].id, createdDefectId);
        });

        it('should update defect status and priority', async () => {
            const updated = await defectService.updateDefect({
                defectId: createdDefectId,
                updates: {
                    status: 'in_progress',
                    notes: 'Assigned to backend payment gateway team'
                },
                user: { id: TEST_USER_ID, name: 'Aditya QA' }
            });

            assert.strictEqual(updated.status, 'in_progress');
            assert.strictEqual(updated.notes, 'Assigned to backend payment gateway team');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 4. AUTOSAVE DRAFT PERSISTENCE
    // ─────────────────────────────────────────────────────────────
    describe('4. Draft Persistence & Recovery Engine', () => {
        it('should save and retrieve a manual execution draft without corrupting run records', async () => {
            const run = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_draft_val',
                name: 'Draft Validation Test Run',
                executionType: 'manual',
                cases: [
                    {
                        testCaseId: 'TC-DRAFT-01',
                        title: 'Draft autosave validation',
                        steps: [
                            { stepNumber: 1, action: 'Step 1', expected: 'Outcome 1' },
                            { stepNumber: 2, action: 'Step 2', expected: 'Outcome 2' }
                        ]
                    }
                ]
            });

            const runCase = run.cases[0];

            const draftPayload = {
                formStatus: 'in_progress',
                actualResult: 'Steps 1 completed without anomalies.',
                notes: 'Tested on Safari 17.4 macOS Sonoma',
                stepOutcomes: {
                    0: { status: 'passed', actual: 'UI rendered properly' }
                }
            };

            await supabaseService.saveCaseDraft(runCase.id, draftPayload);

            const retrieved = await supabaseService.getCaseDraft(runCase.id);
            assert.ok(retrieved);
            assert.strictEqual(retrieved.actualResult, draftPayload.actualResult);
            assert.strictEqual(retrieved.notes, draftPayload.notes);
            assert.strictEqual(retrieved.stepOutcomes[0].status, 'passed');

            // The case status in run should reflect in_progress while remaining a draft
            const refreshedCase = await supabaseService.getRunCaseById(runCase.id);
            assert.strictEqual(refreshedCase.status, 'in_progress');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 5. IMMUTABLE EXECUTION HISTORY & REPORT CALCULATIONS
    // ─────────────────────────────────────────────────────────────
    describe('5. Immutable History Preservation & Report Accuracy', () => {
        it('should preserve multi-run historical attempts without silent overwriting', async () => {
            const run = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_multi_attempt',
                name: 'History Preservation Run',
                executionType: 'manual',
                cases: [
                    {
                        testCaseId: 'TC-HIST-SEARCH',
                        title: 'Product search bar test',
                        steps: [
                            { stepNumber: 1, action: 'Type query', expected: 'Dropdown visible' }
                        ]
                    }
                ]
            });

            const runCase = run.cases[0];

            // First attempt: failed
            const attempt1 = await supabaseService.recordTestExecution({
                runId: run.id,
                runCaseId: runCase.id,
                testCaseId: 'TC-HIST-SEARCH',
                workspaceId: TEST_WS_ID,
                status: 'failed',
                actualResult: 'Search input did not accept query string',
                durationMs: 1200,
                executorType: 'manual',
                user: { id: TEST_USER_ID, name: 'Tester A' }
            });

            assert.strictEqual(attempt1.execution.attemptNumber, 1);
            assert.strictEqual(attempt1.execution.status, 'failed');

            // Second re-test attempt: passed
            const attempt2 = await supabaseService.recordTestExecution({
                runId: run.id,
                runCaseId: runCase.id,
                testCaseId: 'TC-HIST-SEARCH',
                workspaceId: TEST_WS_ID,
                status: 'passed',
                actualResult: 'Query input accepted; autocomplete dropdown rendered',
                durationMs: 950,
                executorType: 'manual',
                user: { id: TEST_USER_ID, name: 'Tester A' }
            });

            assert.strictEqual(attempt2.execution.attemptNumber, 2);
            assert.strictEqual(attempt2.execution.status, 'passed');

            // Fetch historical timeline
            const history = await supabaseService.getTestCaseExecutionHistory('TC-HIST-SEARCH');
            assert.ok(Array.isArray(history));
            assert.ok(history.length >= 2);
            // Must contain both attempts
            const statuses = history.map(h => h.status);
            assert.ok(statuses.includes('failed'));
            assert.ok(statuses.includes('passed'));
        });

        it('should generate execution report with pass rate strictly calculated from executed tests', async () => {
            const run = await supabaseService.createTestRun({
                workspaceId: TEST_WS_ID,
                testSuiteId: 'suite_report_calc',
                name: 'Pass Rate Calculation Run',
                executionType: 'manual',
                cases: [
                    { testCaseId: 'TC-REP-01', title: 'Case 1' },
                    { testCaseId: 'TC-REP-02', title: 'Case 2' },
                    { testCaseId: 'TC-REP-03', title: 'Case 3' },
                    { testCaseId: 'TC-REP-04', title: 'Case 4' }
                ]
            });

            // Execute case 1 (pass) and case 2 (fail); leave case 3 and 4 not_run
            await supabaseService.recordTestExecution({
                runId: run.id,
                runCaseId: run.cases[0].id,
                testCaseId: 'TC-REP-01',
                workspaceId: TEST_WS_ID,
                status: 'passed',
                actualResult: 'Case 1 passed'
            });

            await supabaseService.recordTestExecution({
                runId: run.id,
                runCaseId: run.cases[1].id,
                testCaseId: 'TC-REP-02',
                workspaceId: TEST_WS_ID,
                status: 'failed',
                actualResult: 'Case 2 failed'
            });

            const report = await executionReportService.generateRunReport(run.id, TEST_WS_ID);
            // Total = 4, Passed = 1, Failed = 1, Not Run = 2
            // Evaluated = 2. Pass rate = (1 / 2) * 100 = 50%, NOT (1 / 4) * 100 = 25%
            assert.strictEqual(report.summary.total, 4);
            assert.strictEqual(report.summary.passed, 1);
            assert.strictEqual(report.summary.failed, 1);
            assert.strictEqual(report.summary.notRun, 2);
            assert.strictEqual(report.summary.passRate, 50);
        });
    });
});
