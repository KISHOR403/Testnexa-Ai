const { describe, it, beforeEach } = require('node:test');
const assert = require('assert');
const maintenanceIntelligenceService = require('../src/services/runner/maintenanceIntelligence.service');
const supabaseService = require('../src/services/supabaseData.service');
const aiService = require('../src/services/ai.service');

describe('Test Maintenance Intelligence Engine', () => {
    const workspaceA = 'ws_maint_alpha_111';
    const workspaceB = 'ws_maint_beta_222';
    const suiteA = 'suite_maint_alpha_456';
    const userA = 'user_maint_tester_789';
    const userB = 'user_maint_unauthorized_999';

    beforeEach(async () => {
        // Force fast local in-memory operation
        supabaseService.sessionsTableAvailable = false;
        supabaseService.workspacesTableAvailable = false;
        supabaseService.executionTablesAvailable = false;

        // Reset in-memory test data
        supabaseService.inMemoryTestRuns.clear();
        supabaseService.inMemoryTestRunCases.clear();
        supabaseService.inMemoryTestExecutions.clear();
        supabaseService.inMemoryMaintenanceFindings.clear();
        maintenanceIntelligenceService.invalidateCache();

        // Seed workspaces
        supabaseService.inMemoryWorkspaces.set(workspaceA, {
            id: workspaceA,
            name: 'Workspace Alpha',
            owner_id: userA
        });
        supabaseService.inMemoryWorkspaces.set(workspaceB, {
            id: workspaceB,
            name: 'Workspace Beta',
            owner_id: userB
        });

        // Seed workspace members
        supabaseService.inMemoryWorkspaceMembers.set(`${workspaceA}:${userA}`, {
            workspaceId: workspaceA,
            workspace_id: workspaceA,
            userId: userA,
            user_id: userA,
            role: 'owner',
            status: 'active'
        });
        supabaseService.inMemoryWorkspaceMembers.set(`${workspaceB}:${userB}`, {
            workspaceId: workspaceB,
            workspace_id: workspaceB,
            userId: userB,
            user_id: userB,
            role: 'owner',
            status: 'active'
        });

        // Seed suite
        supabaseService.inMemorySessions.set(suiteA, {
            id: suiteA,
            _id: suiteA,
            user_id: userA,
            userId: userA,
            workspace_id: workspaceA,
            title: 'Authentication & Checkout E2E Suite',
            suite_data: {
                testSuiteName: 'Authentication & Checkout E2E Suite',
                testCases: []
            }
        });
    });

    it('1. should detect broken locator and extract target selector from Playwright error', async () => {
        // Seed Run 1 with broken locator failure
        const runId1 = 'run_maint_001';
        supabaseService.inMemoryTestRuns.set(runId1, {
            id: runId1,
            workspace_id: workspaceA,
            suite_id: suiteA,
            suiteName: 'Authentication & Checkout E2E Suite',
            status: 'failed',
            completed_at: new Date(Date.now() - 3600000).toISOString()
        });

        const runCaseId1 = 'runcase_locator_fail_1';
        supabaseService.inMemoryTestRunCases.set(runCaseId1, {
            id: runCaseId1,
            run_id: runId1,
            test_case_id: 'TC_AUTH_001',
            status: 'failed',
            actual_result: 'Timeout 5000ms exceeded waiting for locator(\'button#submit-login\')',
            duration_ms: 5200,
            execution_type: 'automated',
            case_snapshot: {
                title: 'User login with credentials',
                priority: 'Critical',
                errorMessage: 'Timeout 5000ms exceeded waiting for locator(\'button#submit-login\')',
                stackTrace: 'Error: Timeout 5000ms exceeded waiting for locator(\'button#submit-login\')\n    at LoginPage.submit (tests/e2e/login.spec.js:42:15)'
            }
        });

        const result = await maintenanceIntelligenceService.scanWorkspaceMaintenance(workspaceA);

        assert.ok(result.findings.length >= 1);
        const locatorFinding = result.findings.find(f => f.issueType === 'BROKEN_LOCATOR');
        assert.ok(locatorFinding, 'Expected a BROKEN_LOCATOR finding');
        assert.strictEqual(locatorFinding.locator, 'button#submit-login');
        assert.strictEqual(locatorFinding.classification, 'Needs Maintenance');
        assert.strictEqual(locatorFinding.severity, 'Critical');
        assert.ok(locatorFinding.recommendedAction.includes('button#submit-login'));
    });

    it('2. should distinguish Environment Issue from Application Defect and Automation Failure', async () => {
        // Run 1: Environment connection failure
        const runIdEnv = 'run_maint_env_01';
        supabaseService.inMemoryTestRuns.set(runIdEnv, {
            id: runIdEnv,
            workspace_id: workspaceA,
            suite_id: suiteA,
            status: 'failed',
            completed_at: new Date(Date.now() - 7200000).toISOString()
        });

        // Run 2: Same test failing with DNS / network failure
        const runIdEnv2 = 'run_maint_env_02';
        supabaseService.inMemoryTestRuns.set(runIdEnv2, {
            id: runIdEnv2,
            workspace_id: workspaceA,
            suite_id: suiteA,
            status: 'failed',
            completed_at: new Date(Date.now() - 3600000).toISOString()
        });

        supabaseService.inMemoryTestRunCases.set('rc_env_1', {
            id: 'rc_env_1',
            run_id: runIdEnv,
            test_case_id: 'TC_API_CONN',
            status: 'failed',
            actual_result: 'net::ERR_CONNECTION_REFUSED at http://api.internal.local',
            duration_ms: 1200,
            case_snapshot: { title: 'Health check integration' }
        });
        supabaseService.inMemoryTestRunCases.set('rc_env_2', {
            id: 'rc_env_2',
            run_id: runIdEnv2,
            test_case_id: 'TC_API_CONN',
            status: 'failed',
            actual_result: 'status 502 Bad Gateway: connection refused upstream',
            duration_ms: 1500,
            case_snapshot: { title: 'Health check integration' }
        });

        // Also add Application Defect test (failing 2 times with assertion error)
        const runIdApp1 = 'run_maint_app_01';
        const runIdApp2 = 'run_maint_app_02';
        supabaseService.inMemoryTestRuns.set(runIdApp1, { id: runIdApp1, workspace_id: workspaceA, suite_id: suiteA, status: 'failed', completed_at: new Date(Date.now() - 7000000).toISOString() });
        supabaseService.inMemoryTestRuns.set(runIdApp2, { id: runIdApp2, workspace_id: workspaceA, suite_id: suiteA, status: 'failed', completed_at: new Date(Date.now() - 3500000).toISOString() });

        supabaseService.inMemoryTestRunCases.set('rc_app_1', {
            id: 'rc_app_1',
            run_id: runIdApp1,
            test_case_id: 'TC_DISCOUNT_CALC',
            status: 'failed',
            actual_result: 'AssertionError: expected $80.00 to be $75.00',
            case_snapshot: { title: 'Discount calculation logic' }
        });
        supabaseService.inMemoryTestRunCases.set('rc_app_2', {
            id: 'rc_app_2',
            run_id: runIdApp2,
            test_case_id: 'TC_DISCOUNT_CALC',
            status: 'failed',
            actual_result: 'expect(received).toBe(expected) - received 80, expected 75',
            case_snapshot: { title: 'Discount calculation logic' }
        });

        const result = await maintenanceIntelligenceService.scanWorkspaceMaintenance(workspaceA);

        const envFinding = result.findings.find(f => f.testCaseId === 'TC_API_CONN');
        assert.ok(envFinding);
        assert.strictEqual(envFinding.classification, 'Environment Issue');
        assert.strictEqual(envFinding.issueType, 'ENVIRONMENT_FAILURE');

        const appFinding = result.findings.find(f => f.testCaseId === 'TC_DISCOUNT_CALC');
        assert.ok(appFinding);
        assert.strictEqual(appFinding.classification, 'Application Defect Suspected');
        assert.strictEqual(appFinding.issueType, 'APPLICATION_DEFECT');
    });

    it('3. should detect outdated or missing automation mappings', async () => {
        const runId = 'run_maint_outdated_01';
        supabaseService.inMemoryTestRuns.set(runId, {
            id: runId,
            workspace_id: workspaceA,
            suite_id: suiteA,
            status: 'completed',
            completed_at: new Date().toISOString()
        });

        // Case A: Missing script reference
        supabaseService.inMemoryTestRunCases.set('rc_nomap_1', {
            id: 'rc_nomap_1',
            run_id: runId,
            test_case_id: 'TC_NO_MAP',
            status: 'passed',
            execution_type: 'automated',
            case_snapshot: {
                title: 'Automated test without mapping',
                isAutomated: true,
                automationMapping: {} // empty scriptRef
            }
        });

        // Case B: Mapping points to non-existent spec file
        supabaseService.inMemoryTestRunCases.set('rc_badmap_2', {
            id: 'rc_badmap_2',
            run_id: runId,
            test_case_id: 'TC_BAD_MAP',
            status: 'passed',
            execution_type: 'automated',
            case_snapshot: {
                title: 'Test with deleted spec reference',
                isAutomated: true,
                automationMapping: {
                    scriptRef: 'tests/e2e/deleted-checkout-flow.spec.js#TC_CHECKOUT_DELETED'
                }
            }
        });

        const result = await maintenanceIntelligenceService.scanWorkspaceMaintenance(workspaceA);

        const missingMapFinding = result.findings.find(f => f.testCaseId === 'TC_NO_MAP');
        assert.ok(missingMapFinding);
        assert.strictEqual(missingMapFinding.issueType, 'OUTDATED_MAPPING');

        const badMapFinding = result.findings.find(f => f.testCaseId === 'TC_BAD_MAP');
        assert.ok(badMapFinding);
        assert.strictEqual(badMapFinding.issueType, 'OUTDATED_MAPPING');
        assert.strictEqual(badMapFinding.severity, 'Critical');
    });

    it('4. should detect execution performance degradation', async () => {
        const tcId = 'TC_SLOW_REPORT';
        // Baseline runs: 1200ms, 1300ms, 1250ms
        const r1 = 'run_perf_1', r2 = 'run_perf_2', r3 = 'run_perf_3';
        supabaseService.inMemoryTestRuns.set(r1, { id: r1, workspace_id: workspaceA, suite_id: suiteA, status: 'completed', completed_at: new Date(Date.now() - 86400000).toISOString() });
        supabaseService.inMemoryTestRuns.set(r2, { id: r2, workspace_id: workspaceA, suite_id: suiteA, status: 'completed', completed_at: new Date(Date.now() - 43200000).toISOString() });
        supabaseService.inMemoryTestRuns.set(r3, { id: r3, workspace_id: workspaceA, suite_id: suiteA, status: 'completed', completed_at: new Date().toISOString() });

        supabaseService.inMemoryTestRunCases.set('rc_perf_1', { id: 'rc_perf_1', run_id: r1, test_case_id: tcId, status: 'passed', duration_ms: 1200, execution_type: 'automated', case_snapshot: { title: 'Generate PDF report' } });
        supabaseService.inMemoryTestRunCases.set('rc_perf_2', { id: 'rc_perf_2', run_id: r2, test_case_id: tcId, status: 'passed', duration_ms: 1300, execution_type: 'automated', case_snapshot: { title: 'Generate PDF report' } });
        // Sudden spike: 8500ms (> 2.0x baseline and +7250ms delta)
        supabaseService.inMemoryTestRunCases.set('rc_perf_3', { id: 'rc_perf_3', run_id: r3, test_case_id: tcId, status: 'passed', duration_ms: 8500, execution_type: 'automated', case_snapshot: { title: 'Generate PDF report' } });

        const result = await maintenanceIntelligenceService.scanWorkspaceMaintenance(workspaceA);

        const perfFinding = result.findings.find(f => f.testCaseId === tcId && f.issueType === 'PERFORMANCE_REGRESSION');
        assert.ok(perfFinding, 'Expected PERFORMANCE_REGRESSION finding');
        assert.strictEqual(perfFinding.classification, 'Potential Maintenance Risk');
        assert.strictEqual(perfFinding.metrics.baselineDurationMs, 1250);
    });

    it('5. should update finding status and preserve resolution notes', async () => {
        // First scan to generate findings
        const runId = 'run_status_test';
        supabaseService.inMemoryTestRuns.set(runId, { id: runId, workspace_id: workspaceA, suite_id: suiteA, status: 'failed', completed_at: new Date().toISOString() });
        supabaseService.inMemoryTestRunCases.set('rc_status_1', {
            id: 'rc_status_1',
            run_id: runId,
            test_case_id: 'TC_STATUS_001',
            status: 'failed',
            actual_result: 'waiting for locator("input#otp")',
            case_snapshot: { title: 'OTP verification input' }
        });

        const initial = await maintenanceIntelligenceService.scanWorkspaceMaintenance(workspaceA);
        const targetFinding = initial.findings[0];
        assert.ok(targetFinding);
        assert.strictEqual(targetFinding.status, 'open');

        // Mark as investigating
        const updated1 = await maintenanceIntelligenceService.updateFindingStatus(workspaceA, targetFinding.id, {
            status: 'investigating',
            resolutionNotes: 'Investigating locator rename after Sprint 4 UI refresh',
            userId: userA
        });
        assert.strictEqual(updated1.status, 'investigating');
        assert.strictEqual(updated1.resolutionNotes, 'Investigating locator rename after Sprint 4 UI refresh');

        // Mark as resolved
        const updated2 = await maintenanceIntelligenceService.updateFindingStatus(workspaceA, targetFinding.id, {
            status: 'resolved',
            resolutionNotes: 'Updated selector to page.getByLabel("One-time passcode")',
            userId: userA
        });
        assert.strictEqual(updated2.status, 'resolved');
        assert.ok(updated2.resolvedAt);
    });

    it('6. should run on-demand AI analysis to generate resilient locator suggestions', async () => {
        // Mock callAI
        const originalCallAI = aiService.callAI;
        aiService.callAI = async () => {
            return JSON.stringify({
                explanation: 'The static selector "button#submit-login" timed out because the login form was rewritten with dynamic ID generation.',
                suggestedSelectors: [
                    "page.getByRole('button', { name: 'Log in' })",
                    "page.getByTestId('login-submit-button')"
                ],
                recommendedFix: 'Refactor test step to use accessible role selector page.getByRole instead of CSS ID.'
            });
        };

        try {
            const runId = 'run_ai_test';
            supabaseService.inMemoryTestRuns.set(runId, { id: runId, workspace_id: workspaceA, suite_id: suiteA, status: 'failed', completed_at: new Date().toISOString() });
            supabaseService.inMemoryTestRunCases.set('rc_ai_1', {
                id: 'rc_ai_1',
                run_id: runId,
                test_case_id: 'TC_AI_LOCATOR',
                status: 'failed',
                actual_result: 'waiting for locator("button#submit-login")',
                case_snapshot: { title: 'AI locator test' }
            });

            const initial = await maintenanceIntelligenceService.scanWorkspaceMaintenance(workspaceA);
            const targetFinding = initial.findings[0];

            const analyzed = await maintenanceIntelligenceService.analyzeFindingWithAI(workspaceA, targetFinding.id, userA);
            assert.ok(analyzed.aiAnalysis);
            assert.strictEqual(analyzed.aiAnalysis.suggestedSelectors.length, 2);
            assert.ok(analyzed.aiAnalysis.explanation.includes('dynamic ID generation'));
        } finally {
            aiService.callAI = originalCallAI;
        }
    });

    it('7. should enforce workspace isolation between Workspace A and Workspace B', async () => {
        // Seed finding in Workspace A
        const runIdA = 'run_iso_a';
        supabaseService.inMemoryTestRuns.set(runIdA, { id: runIdA, workspace_id: workspaceA, suite_id: suiteA, status: 'failed', completed_at: new Date().toISOString() });
        supabaseService.inMemoryTestRunCases.set('rc_iso_a', {
            id: 'rc_iso_a',
            run_id: runIdA,
            test_case_id: 'TC_ISO_A',
            status: 'failed',
            actual_result: 'waiting for locator("span.alert")',
            case_snapshot: { title: 'Workspace A Private Test' }
        });

        const scanA = await maintenanceIntelligenceService.scanWorkspaceMaintenance(workspaceA);
        assert.strictEqual(scanA.findings.length, 1);
        const findingAId = scanA.findings[0].id;

        // Workspace B scan must return 0 findings
        const scanB = await maintenanceIntelligenceService.scanWorkspaceMaintenance(workspaceB);
        assert.strictEqual(scanB.findings.length, 0);

        // Workspace B attempting to get finding of Workspace A directly returns null
        const crossGet = await maintenanceIntelligenceService.getFindingById(workspaceB, findingAId);
        assert.strictEqual(crossGet, null);
    });

    it('8. should test controller endpoints with access control and validation', async () => {
        const maintenanceController = require('../src/controllers/maintenance.controller');

        const mockReq = (user, query = {}, params = {}, body = {}) => ({
            user: { id: user, _id: user },
            query,
            params,
            body
        });

        const mockRes = () => {
            const res = {
                statusCode: 200,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    this.body = payload;
                    return this;
                }
            };
            return res;
        };

        // A. Valid overview
        const res1 = mockRes();
        await maintenanceController.getMaintenanceOverview(mockReq(userA, { workspaceId: workspaceA }), res1);
        assert.strictEqual(res1.statusCode, 200);
        assert.strictEqual(res1.body.success, true);
        assert.ok(res1.body.data.summary);

        // B. Forbidden access (userB accessing workspaceA)
        const res2 = mockRes();
        await maintenanceController.getMaintenanceOverview(mockReq(userB, { workspaceId: workspaceA }), res2);
        assert.strictEqual(res2.statusCode, 403);
        assert.strictEqual(res2.body.code, 'FORBIDDEN');

        // C. Invalid status in update
        const scan = await maintenanceIntelligenceService.scanWorkspaceMaintenance(workspaceA);
        if (scan.findings.length > 0) {
            const findingId = scan.findings[0].id;
            const res3 = mockRes();
            await maintenanceController.updateFinding(mockReq(userA, {}, { id: findingId, workspaceId: workspaceA }, { status: 'INVALID_STATUS' }), res3);
            assert.strictEqual(res3.statusCode, 400);
            assert.strictEqual(res3.body.code, 'INVALID_STATUS');
        }
    });
});
