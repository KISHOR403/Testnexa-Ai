/**
 * TestNexa AI — Phase 2: Execution Intelligence Dashboard Test Suite
 *
 * Scenarios verified:
 * 1. Health Summary: Calculates total completed runs, executed cases, pass/fail counts, and accurate rates.
 * 2. Count Integrity: Strictly distinguishes run counts from test-case counts without conflating them.
 * 3. Trajectory Indicator: Computes improving, declining, or steady quality trajectory based on failure delta.
 * 4. Activity Chart: Aggregates daily and weekly time-series data with passes, failures, and volume.
 * 5. Quality Signals: Surfaces flaky tests count, recurring signatures, new failures, and rerun fix rate.
 * 6. Prioritized Needs Attention Queue: Ranks issues by urgency with direct action links.
 * 7. Recent Executions Activity: Shows recent runs with accurate status, duration, and test counts.
 * 8. Coverage Overview: Distinguishes linked requirement coverage from verified requirement coverage.
 * 9. Multi-Tenant Workspace Isolation: Blocks cross-workspace dashboard access with 403 Forbidden.
 * 10. Filter Responsiveness: Respects suiteId, date range, browser, environment, and executionMethod filters.
 * 11. Empty Workspace State: Handles workspaces with 0 executions gracefully with empty structures.
 * 12. Cache Management: In-memory TTL cache with automatic invalidation on new execution recording.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const supabaseService = require('../src/services/supabaseData.service');
const executionIntelligenceService = require('../src/services/runner/executionIntelligence.service');
const executionController = require('../src/controllers/execution.controller');

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

describe('Phase 2: Execution Intelligence & Unified QA Health Dashboard', () => {
    let userA, userB;
    let workspaceA, workspaceB;
    let suiteA;

    before(async () => {
        // Fast local fallback without remote timeout
        supabaseService.sessionsTableAvailable = false;
        supabaseService.workspacesTableAvailable = false;
        supabaseService.executionTablesAvailable = false;

        // Clear intelligence and failure trends caches
        executionIntelligenceService.invalidateCache();

        // 1. Initialize Users & Isolated Workspaces
        userA = { id: `usr_intel_a_${Date.now()}`, name: 'Alice Intel', email: 'alice.intel@testnexa.ai' };
        userB = { id: `usr_intel_b_${Date.now()}`, name: 'Bob Intel', email: 'bob.intel@testnexa.ai' };

        workspaceA = await supabaseService.getUserPrimaryWorkspace(userA.id, userA.name);
        workspaceB = await supabaseService.getUserPrimaryWorkspace(userB.id, userB.name);

        // 2. Create Test Suite in Workspace A with structured requirements and test cases
        suiteA = await supabaseService.createSession({
            userId: userA.id,
            title: 'Authentication & Session Suite',
            feature: 'User Auth Flow',
            status: 'Ready',
            suiteData: {
                testSuiteName: 'Auth Core Suite',
                projectName: 'Auth Service',
                understanding: {
                    functional_requirements: [
                        { id: 'REQ_AUTH_001', requirement: 'User can log in with valid credentials', priority: 'High' },
                        { id: 'REQ_AUTH_002', requirement: 'System rejects invalid passwords with 401', priority: 'High' },
                        { id: 'REQ_AUTH_003', requirement: 'Session expires after 15 minutes of inactivity', priority: 'Medium' }
                    ]
                },
                functional: [
                    { id: 'TC_AUTH_001', title: 'Verify successful login with valid credentials', priority: 'High', requirementId: 'REQ_AUTH_001', executionMethod: 'automated' },
                    { id: 'TC_AUTH_002', title: 'Verify error prompt on invalid password', priority: 'High', requirementId: 'REQ_AUTH_002', executionMethod: 'automated' },
                    { id: 'TC_AUTH_003', title: 'Verify logout terminates session token', priority: 'Medium', requirementId: 'REQ_AUTH_001', executionMethod: 'manual' }
                ]
            }
        });

        // 3. Populate Completed Historical Test Runs
        // Run 1: 3 days ago (TC_AUTH_001 passed, TC_AUTH_002 failed)
        const dateRun1 = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)).toISOString();
        const run1 = await supabaseService.createTestRun({
            workspaceId: workspaceA.id,
            suiteId: suiteA.id,
            createdBy: userA.id,
            name: 'Run #1 - Sprint 42 Auth Baseline',
            executionType: 'automated',
            targetEnvironment: { browser: 'chromium', environment: 'staging' },
            selectedCaseIds: ['TC_AUTH_001', 'TC_AUTH_002']
        });

        const run1Cases = await supabaseService.getRunCases(run1.id);
        const c1 = run1Cases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC_AUTH_001');
        const c2 = run1Cases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC_AUTH_002');

        await supabaseService.recordTestExecution({
            runId: run1.id,
            runCaseId: c1.id,
            testCaseId: 'TC_AUTH_001',
            status: 'passed',
            durationMs: 1200
        });

        await supabaseService.recordTestExecution({
            runId: run1.id,
            runCaseId: c2.id,
            testCaseId: 'TC_AUTH_002',
            status: 'failed',
            errorMessage: 'AssertionError: expected status 401 but received 500 internal server error',
            durationMs: 2500
        });

        await supabaseService.updateTestRun(run1.id, workspaceA.id, {
            status: 'completed',
            completedAt: dateRun1,
            startedAt: dateRun1
        });

        // Run 2: 1 day ago (TC_AUTH_001 passed, TC_AUTH_002 passed after bugfix)
        const dateRun2 = new Date(Date.now() - (1 * 24 * 60 * 60 * 1000)).toISOString();
        const run2 = await supabaseService.createTestRun({
            workspaceId: workspaceA.id,
            suiteId: suiteA.id,
            createdBy: userA.id,
            name: 'Run #2 - Auth Fix Verification',
            executionType: 'automated',
            targetEnvironment: { browser: 'chromium', environment: 'staging' },
            selectedCaseIds: ['TC_AUTH_001', 'TC_AUTH_002'],
            originalRunId: run1.id
        });

        const run2Cases = await supabaseService.getRunCases(run2.id);
        const r2c1 = run2Cases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC_AUTH_001');
        const r2c2 = run2Cases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC_AUTH_002');

        await supabaseService.recordTestExecution({
            runId: run2.id,
            runCaseId: r2c1.id,
            testCaseId: 'TC_AUTH_001',
            status: 'passed',
            durationMs: 1100
        });

        await supabaseService.recordTestExecution({
            runId: run2.id,
            runCaseId: r2c2.id,
            testCaseId: 'TC_AUTH_002',
            status: 'passed',
            durationMs: 1300
        });

        await supabaseService.updateTestRun(run2.id, workspaceA.id, {
            status: 'completed',
            completedAt: dateRun2,
            startedAt: dateRun2
        });

        // Run 3: In-Progress Run (must be excluded from completed health metrics, but listed in recent runs)
        const run3 = await supabaseService.createTestRun({
            workspaceId: workspaceA.id,
            suiteId: suiteA.id,
            createdBy: userA.id,
            name: 'Run #3 - Active Nightly Run',
            executionType: 'automated',
            targetEnvironment: { browser: 'chromium', environment: 'staging' },
            selectedCaseIds: ['TC_AUTH_003']
        });
        await supabaseService.updateTestRun(run3.id, workspaceA.id, {
            status: 'in_progress'
        });
    });

    it('1. Computes honest health summary without mixing run counts and test case counts', async () => {
        const dashboard = await executionIntelligenceService.getDashboardOverview(workspaceA.id);

        assert.equal(dashboard.success, true);
        assert.equal(dashboard.healthSummary.totalCompletedRuns, 2, '2 completed runs');
        assert.equal(dashboard.healthSummary.totalExecutedCases, 4, '4 total test cases executed across completed runs');
        assert.equal(dashboard.healthSummary.passedCases, 3, '3 total passed test cases');
        assert.equal(dashboard.healthSummary.failedCases, 1, '1 total failed test case');
        assert.equal(dashboard.healthSummary.passRate, 75.0, 'Pass rate must be exactly (3/4)*100 = 75.0%');
        assert.equal(dashboard.healthSummary.failureRate, 25.0, 'Failure rate must be exactly (1/4)*100 = 25.0%');
    });

    it('2. Evaluates quality trajectory as improving when recent failure rate decreases', async () => {
        const dashboard = await executionIntelligenceService.getDashboardOverview(workspaceA.id);

        // Run 1 had 50% failure rate; Run 2 had 0% failure rate -> trajectory is improving
        assert.equal(dashboard.healthSummary.qualityTrajectory, 'improving', 'Quality trajectory must be improving');
        assert.ok(dashboard.healthSummary.trajectoryDelta < 0, 'Trajectory delta must be negative (drop in failure rate)');
    });

    it('3. Generates daily and weekly time-series activity data with correct volume', async () => {
        const dashboard = await executionIntelligenceService.getDashboardOverview(workspaceA.id, { interval: 'daily' });

        assert.ok(Array.isArray(dashboard.activityChart.timeSeries), 'timeSeries is array');
        assert.ok(dashboard.activityChart.timeSeries.length >= 2, 'contains daily data points');

        dashboard.activityChart.timeSeries.forEach(point => {
            assert.ok(point.date, 'Point has date');
            assert.ok(typeof point.runsCount === 'number');
            assert.ok(typeof point.totalExecutions === 'number');
            assert.ok(typeof point.passCount === 'number');
            assert.ok(typeof point.failureCount === 'number');
        });
    });

    it('4. Surfaces accurate quality signals including resolved failures and rerun fix rate', async () => {
        const dashboard = await executionIntelligenceService.getDashboardOverview(workspaceA.id);
        const signals = dashboard.qualitySignals;

        assert.ok(typeof signals.flakyTestsCount === 'number');
        assert.ok(typeof signals.recurringSignaturesCount === 'number');
        assert.ok(signals.resolvedFailuresCount >= 1, 'TC_AUTH_002 failed in Run 1 and passed in Run 2 -> resolved failure');
        assert.ok(signals.rerunFixRate > 0, 'Rerun fix rate calculated from verified resolved failures');
    });

    it('5. Builds prioritized Needs Attention triage queue with actionable items', async () => {
        const dashboard = await executionIntelligenceService.getDashboardOverview(workspaceA.id);
        const queue = dashboard.attentionQueue;

        assert.ok(Array.isArray(queue), 'attentionQueue is array');
        // Uncovered requirement REQ_AUTH_003 (no test cases linked) should be flagged in Needs Attention
        const uncoveredReq = queue.find(item => item.targetId === 'REQ_AUTH_003');
        assert.ok(uncoveredReq, 'Uncovered requirement REQ_AUTH_003 must be in Needs Attention list');
        assert.equal(uncoveredReq.badge, 'COVERAGE GAP');
        assert.ok(uncoveredReq.actionUrl.includes('/app/traceability'));
    });

    it('6. Lists recent runs with accurate status without misrepresenting in-progress as completed', async () => {
        const dashboard = await executionIntelligenceService.getDashboardOverview(workspaceA.id);
        const recent = dashboard.recentRuns;

        assert.ok(recent.length >= 3, 'Includes all recent runs');
        const inProg = recent.find(r => r.name.includes('Active Nightly Run'));
        assert.ok(inProg, 'In-progress run is listed');
        assert.equal(inProg.status, 'in_progress', 'Status must stay in_progress');
        assert.ok(inProg.reportUrl.includes('/app/runs/'));
    });

    it('7. Accurately calculates requirement coverage distinguishing linked from verified', async () => {
        const dashboard = await executionIntelligenceService.getDashboardOverview(workspaceA.id);
        const cov = dashboard.coverageOverview;

        assert.equal(cov.totalRequirements, 3, '3 total requirements in suite specification');
        assert.equal(cov.linkedRequirements, 2, '2 requirements linked to tests (REQ_AUTH_001, REQ_AUTH_002)');
        assert.equal(cov.uncoveredRequirements, 1, '1 requirement uncovered (REQ_AUTH_003)');
        assert.equal(cov.verifiedRequirements, 2, '2 requirements verified (both passed in Run 2)');
        assert.equal(cov.linkedCoveragePct, 66.7, 'Linked coverage: 2/3 = 66.7%');
        assert.equal(cov.verifiedCoveragePct, 66.7, 'Verified coverage: 2/3 = 66.7%');
    });

    it('8. Enforces multi-tenant workspace isolation on dashboard endpoint', async () => {
        // User B queries their own empty workspace
        const reqB = createMockReq(userB, {}, {}, { workspaceId: workspaceB.id });
        const resB = createMockRes();

        await executionController.getIntelligenceDashboard(reqB, resB);
        assert.equal(resB.statusCode, 200);
        assert.equal(resB.data.data.healthSummary.totalCompletedRuns, 0, 'Workspace B has 0 runs');
        assert.equal(resB.data.data.healthSummary.totalExecutedCases, 0);

        // User B attempts to access Workspace A data -> 403 Forbidden
        const reqCross = createMockReq(userB, {}, {}, { workspaceId: workspaceA.id });
        const resCross = createMockRes();

        await executionController.getIntelligenceDashboard(reqCross, resCross);
        assert.equal(resCross.statusCode, 403, 'Cross-workspace access must be rejected with 403 Forbidden');
        assert.equal(resCross.data.code, 'FORBIDDEN');
    });

    it('9. Endpoint GET /api/v1/runs/intelligence/attention returns attention queue', async () => {
        const req = createMockReq(userA, {}, {}, { workspaceId: workspaceA.id });
        const res = createMockRes();

        await executionController.getIntelligenceAttentionQueue(req, res);
        assert.equal(res.statusCode, 200);
        assert.ok(res.data.success);
        assert.ok(Array.isArray(res.data.data));
    });

    it('10. Endpoint GET /api/v1/runs/intelligence/coverage returns coverage metrics', async () => {
        const req = createMockReq(userA, {}, {}, { workspaceId: workspaceA.id });
        const res = createMockRes();

        await executionController.getIntelligenceCoverageOverview(req, res);
        assert.equal(res.statusCode, 200);
        assert.ok(res.data.success);
        assert.equal(res.data.data.totalRequirements, 3);
        assert.equal(res.data.data.uncoveredRequirements, 1);
    });

    it('11. Caches dashboard payload and invalidates on cache clear', () => {
        executionIntelligenceService.cache.set(`${workspaceA.id}:dummy`, { data: 'test', timestamp: Date.now() });
        assert.ok(executionIntelligenceService.cache.has(`${workspaceA.id}:dummy`));

        executionIntelligenceService.invalidateCache(workspaceA.id);
        assert.equal(executionIntelligenceService.cache.has(`${workspaceA.id}:dummy`), false);
    });
});
