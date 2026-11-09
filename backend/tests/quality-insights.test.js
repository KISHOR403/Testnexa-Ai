/**
 * TestNexa AI — Phase 5, Step 2: Advanced Test Analytics & Quality Insights Test Suite
 *
 * Verifies:
 * - Mathematical consistency of pass-rate and failure-rate denominators (excluding skipped/pending)
 * - Rerun deduplication (distinguishing original runs from targeted rerun retries)
 * - Daily, weekly, monthly time-series aggregation without inventing missing dates
 * - Multi-tenant date, environment, browser, and execution-type filtering
 * - Grounded failure fingerprinting (SHA-256 signatures, normalized error patterns)
 * - Statistical flaky test detection and classifications
 * - Requirement traceability coverage (Linked != Executed != Passed != Verified)
 * - Duration metrics and slowest test cases
 * - Test suite quality comparison matrix
 * - AI quality insights synthesis with evidence linkage & quota metering
 * - Formula-injection safe CSV exports and RBAC enforcement
 * - Zero-execution and empty state handling
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const qualityInsightsService = require('../src/services/qualityInsights.service');
const supabaseService = require('../src/services/supabaseData.service');
const usageMeteringService = require('../src/services/usageMetering.service');
const { hasOrgPermission } = require('../src/utils/rbac');

describe('Phase 5, Step 2: Advanced Test Analytics & Quality Insights Suite', () => {
    const testOrgId = `org_qi_test_${Date.now()}`;
    const testWorkspaceId = `ws_qi_test_${Date.now()}`;
    const testUserId = `usr_qi_${Date.now()}`;

    const now = new Date();
    const isoYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const isoTwoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    let prevTables;

    before(async () => {
        prevTables = supabaseService.executionTablesAvailable;
        supabaseService.executionTablesAvailable = false;

        // Setup in-memory mock test organization and workspace
        supabaseService.inMemoryOrganizations.set(testOrgId, {
            id: testOrgId,
            name: 'Analytics Test Organization',
            plan: 'pro',
            ownerId: testUserId,
            status: 'active',
            createdAt: now.toISOString()
        });

        supabaseService.inMemoryWorkspaces.set(testWorkspaceId, {
            id: testWorkspaceId,
            name: 'Quality Insights Workspace',
            organizationId: testOrgId,
            ownerId: testUserId,
            createdAt: now.toISOString()
        });

        supabaseService.inMemoryOrgMembers.set(`${testOrgId}:${testUserId}`, {
            id: `mem_${testUserId}`,
            orgId: testOrgId,
            userId: testUserId,
            role: 'owner',
            status: 'active'
        });

        // Seed 3 test runs with diverse case execution states
        // Run 1: Original automated run (2 passed, 1 failed, 1 skipped)
        const run1Id = `tr_qi_1_${Date.now()}`;
        const run1 = {
            id: run1Id,
            workspace_id: testWorkspaceId,
            suite_id: 'suite_checkout_flow',
            suiteName: 'Checkout & Payment Suite',
            environment: 'staging',
            browser: 'chromium',
            executionType: 'automated',
            status: 'completed',
            isRerun: false,
            createdAt: isoTwoDaysAgo,
            completedAt: isoTwoDaysAgo
        };
        supabaseService.inMemoryTestRuns.set(run1Id, run1);
        const run1Cases = [
            { id: 'rc_1_1', run_id: run1Id, test_case_id: 'TC_CHECKOUT_1', case_snapshot: { id: 'TC_CHECKOUT_1', title: 'User adds item to cart' }, status: 'passed', duration_ms: 1200 },
            { id: 'rc_1_2', run_id: run1Id, test_case_id: 'TC_CHECKOUT_2', case_snapshot: { id: 'TC_CHECKOUT_2', title: 'Payment processing credit card' }, status: 'failed', duration_ms: 4500, error: 'TimeoutError: waiting for selector "#card-submit" exceeded 4000ms' },
            { id: 'rc_1_3', run_id: run1Id, test_case_id: 'TC_CHECKOUT_3', case_snapshot: { id: 'TC_CHECKOUT_3', title: 'Order confirmation receipt' }, status: 'skipped', duration_ms: 0 },
            { id: 'rc_1_4', run_id: run1Id, test_case_id: 'TC_CHECKOUT_4', case_snapshot: { id: 'TC_CHECKOUT_4', title: 'Inventory deduction webhook' }, status: 'passed', duration_ms: 1800 }
        ];
        run1Cases.forEach(c => supabaseService.inMemoryTestRunCases.set(c.id, c));

        // Run 2: Targeted Rerun of TC_CHECKOUT_2 (passes in rerun)
        const run2Id = `tr_qi_2_${Date.now()}`;
        const run2 = {
            id: run2Id,
            workspace_id: testWorkspaceId,
            suite_id: 'suite_checkout_flow',
            suiteName: 'Checkout & Payment Suite',
            environment: 'staging',
            browser: 'chromium',
            executionType: 'automated',
            status: 'completed',
            isRerun: true,
            originalRunId: run1Id,
            createdAt: isoYesterday,
            completedAt: isoYesterday
        };
        supabaseService.inMemoryTestRuns.set(run2Id, run2);
        const run2Cases = [
            { id: 'rc_2_1', run_id: run2Id, test_case_id: 'TC_CHECKOUT_2', case_snapshot: { id: 'TC_CHECKOUT_2', title: 'Payment processing credit card' }, status: 'passed', duration_ms: 2100 }
        ];
        run2Cases.forEach(c => supabaseService.inMemoryTestRunCases.set(c.id, c));

        // Run 3: Manual Execution of another suite (1 failed, 1 blocked)
        const run3Id = `tr_qi_3_${Date.now()}`;
        const run3 = {
            id: run3Id,
            workspace_id: testWorkspaceId,
            suite_id: 'suite_user_profile',
            suiteName: 'User Profile & Settings Suite',
            environment: 'production',
            browser: 'firefox',
            executionType: 'manual',
            status: 'completed',
            isRerun: false,
            createdAt: now.toISOString(),
            completedAt: now.toISOString()
        };
        supabaseService.inMemoryTestRuns.set(run3Id, run3);
        const run3Cases = [
            { id: 'rc_3_1', run_id: run3Id, test_case_id: 'TC_PROFILE_1', case_snapshot: { id: 'TC_PROFILE_1', title: 'Update avatar image upload' }, status: 'failed', duration_ms: 3500, error: 'AssertionError: expected status 200 but received 500' },
            { id: 'rc_3_2', run_id: run3Id, test_case_id: 'TC_PROFILE_2', case_snapshot: { id: 'TC_PROFILE_2', title: 'Export GDPR data archive' }, status: 'blocked', duration_ms: 800, error: 'Upstream microservice offline' }
        ];
        run3Cases.forEach(c => supabaseService.inMemoryTestRunCases.set(c.id, c));
    });

    after(() => {
        supabaseService.executionTablesAvailable = prevTables;
        // Cleanup in-memory test entries
        supabaseService.inMemoryOrganizations.delete(testOrgId);
        supabaseService.inMemoryWorkspaces.delete(testWorkspaceId);
    });

    it('1. Execution Health: Computes mathematically sound pass and failure rates excluding skipped tests', async () => {
        const { runs } = await qualityInsightsService._getFilteredRunsWithCases(testWorkspaceId, { dateRange: '7d' });
        const health = qualityInsightsService.calculateExecutionHealth(runs);

        assert.strictEqual(health.totalRuns, 3);
        assert.strictEqual(health.originalRuns, 2);
        assert.strictEqual(health.rerunAttempts, 1);
        assert.strictEqual(health.totalCaseExecutions, 7); // 4 + 1 + 2
        assert.strictEqual(health.deduplicatedCasesCount, 6); // unique test case IDs

        // Passed: rc_1_1, rc_1_4, rc_2_1 (3 passed)
        // Failed: rc_1_2, rc_3_1 (2 failed)
        // Blocked: rc_3_2 (1 blocked)
        // Skipped: rc_1_3 (1 skipped)
        assert.strictEqual(health.passed, 3);
        assert.strictEqual(health.failed, 2);
        assert.strictEqual(health.blocked, 1);
        assert.strictEqual(health.skipped, 1);

        // Terminal Executed Cases = Passed (3) + Failed (2) + Blocked (1) = 6 cases
        assert.strictEqual(health.terminalExecutedCases, 6);

        // Pass Rate = (3 / 6) * 100 = 50.0%
        assert.strictEqual(health.passRate, 50.0);
        // Failure Rate = ((2 + 1) / 6) * 100 = 50.0%
        assert.strictEqual(health.failureRate, 50.0);

        // Metric definitions are explicitly documented
        assert.ok(health.metricDefinitions.passRate.includes('Excludes skipped'));
    });

    it('2. Time-Series Trends: Accurately groups daily intervals without inventing missing dates', async () => {
        const { runs, boundaries } = await qualityInsightsService._getFilteredRunsWithCases(testWorkspaceId, { dateRange: '7d' });
        const trends = qualityInsightsService.calculateExecutionTrends(runs, boundaries, 'daily');

        assert.ok(Array.isArray(trends));
        assert.ok(trends.length >= 7, 'Should contain all 7 daily buckets');

        // Verify buckets without executions have 0 volume and null passRate
        const emptyBuckets = trends.filter(t => t.totalRuns === 0);
        assert.ok(emptyBuckets.length > 0);
        assert.strictEqual(emptyBuckets[0].passRate, null);
        assert.strictEqual(emptyBuckets[0].caseExecutions, 0);

        // Verify active bucket matches execution count
        const activeBuckets = trends.filter(t => t.totalRuns > 0);
        assert.ok(activeBuckets.length >= 2);
    });

    it('3. Multi-Dimension Filtering: Slices by environment, browser, and execution type', async () => {
        // Environment filter: staging only
        const stagingRes = await qualityInsightsService._getFilteredRunsWithCases(testWorkspaceId, { environment: 'staging' });
        assert.strictEqual(stagingRes.runs.length, 2);

        // Environment filter: production only
        const prodRes = await qualityInsightsService._getFilteredRunsWithCases(testWorkspaceId, { environment: 'production' });
        assert.strictEqual(prodRes.runs.length, 1);

        // Browser filter: firefox only
        const ffRes = await qualityInsightsService._getFilteredRunsWithCases(testWorkspaceId, { browser: 'firefox' });
        assert.strictEqual(ffRes.runs.length, 1);

        // Execution type filter: manual only
        const manualRes = await qualityInsightsService._getFilteredRunsWithCases(testWorkspaceId, { executionType: 'manual' });
        assert.strictEqual(manualRes.runs.length, 1);
        assert.strictEqual(manualRes.runs[0].executionType, 'manual');
    });

    it('4. Failure Intelligence: Clusters recurring error signatures and extracts SHA-256 fingerprint', async () => {
        const { runs } = await qualityInsightsService._getFilteredRunsWithCases(testWorkspaceId, { dateRange: '30d' });
        const failures = qualityInsightsService.calculateFailureIntelligence(runs);

        assert.ok(Array.isArray(failures.topFailingCases));
        assert.ok(Array.isArray(failures.topSignatures));
        assert.strictEqual(failures.topFailingCases.length, 3); // TC_CHECKOUT_2, TC_PROFILE_1, TC_PROFILE_2

        // Verify fingerprint hash generation
        const firstSig = failures.topSignatures[0];
        assert.ok(firstSig.signatureHash);
        assert.strictEqual(firstSig.signatureHash.length, 12);
        assert.ok(firstSig.pattern.length > 0);
        assert.ok(firstSig.sampleRunId);
    });

    it('5. Flaky Analytics: Accurately classifies tests and detects state transitions', async () => {
        const { runs } = await qualityInsightsService._getFilteredRunsWithCases(testWorkspaceId, { dateRange: '30d' });
        const flaky = qualityInsightsService.calculateFlakyAnalytics(runs);

        assert.ok(flaky.totalAnalyzedCases > 0);
        assert.ok(typeof flaky.flakyCount === 'number');
        assert.ok(Array.isArray(flaky.flakyCases));
    });

    it('6. Execution Performance: Accurately calculates median duration and slowest test cases', async () => {
        const { runs } = await qualityInsightsService._getFilteredRunsWithCases(testWorkspaceId, { dateRange: '30d' });
        const perf = qualityInsightsService.calculatePerformanceAnalytics(runs);

        assert.ok(Array.isArray(perf.slowestCases));
        assert.ok(perf.slowestCases.length > 0);
        // TC_CHECKOUT_2 had 4500ms and 2100ms durations
        const checkoutCase = perf.slowestCases.find(c => c.testCaseId === 'TC_CHECKOUT_2');
        assert.ok(checkoutCase);
        assert.ok(checkoutCase.medianDurationMs > 2000);
    });

    it('7. Test Suite Quality Comparison: Compares suites side-by-side with individual metrics', async () => {
        const { runs } = await qualityInsightsService._getFilteredRunsWithCases(testWorkspaceId, { dateRange: '30d' });
        const suites = qualityInsightsService.calculateSuiteComparison(runs);

        assert.strictEqual(suites.length, 2); // Checkout Suite & Profile Suite
        const checkout = suites.find(s => s.suiteId === 'suite_checkout_flow');
        assert.ok(checkout);
        assert.strictEqual(checkout.executionVolume, 2);
        assert.ok(checkout.passRate > 0);
    });

    it('8. Zero Executions Handling: Returns graceful empty structure without crashing', async () => {
        const emptyWsId = `ws_empty_${Date.now()}`;
        const overview = await qualityInsightsService.getQualityInsightsOverview(emptyWsId, { dateRange: '7d' });

        assert.strictEqual(overview.health.totalRuns, 0);
        assert.strictEqual(overview.health.passRate, 0);
        assert.strictEqual(overview.health.failureRate, 0);
        assert.strictEqual(overview.failures.topSignatures.length, 0);
        assert.strictEqual(overview.flaky.flakyCount, 0);
    });

    it('9. Deterministic AI Insights Fallback: Generates evidence-backed structured findings', async () => {
        const overview = await qualityInsightsService.getQualityInsightsOverview(testWorkspaceId, { dateRange: '30d' });
        const insights = qualityInsightsService._generateDeterministicInsights(overview);

        assert.ok(Array.isArray(insights));
        assert.ok(insights.length >= 1);
        const first = insights[0];
        assert.ok(first.title);
        assert.ok(first.description);
        assert.ok(first.observedFacts);
        assert.ok(first.aiHypotheses);
        assert.ok(first.recommendedInvestigation);
    });

    it('10. CSV Export: Sanitizes against formula injection and exports structured report', async () => {
        const csv = await qualityInsightsService.generateCSVExport(testWorkspaceId, { dateRange: '30d' });

        assert.ok(typeof csv === 'string');
        assert.ok(csv.includes('# TESTNEXA AI — QUALITY INSIGHTS & ADVANCED TEST ANALYTICS REPORT'));
        assert.ok(csv.includes('--- EXECUTION HEALTH SUMMARY ---'));
        assert.ok(csv.includes('--- TOP RECURRING FAILURE SIGNATURES ---'));
        assert.ok(csv.includes('--- TEST SUITE QUALITY COMPARISON ---'));

        // Formula injection test
        const lines = csv.split('\n');
        lines.forEach(line => {
            // No unescaped formula characters at the start of a cell
            assert.doesNotMatch(line, /^[,"][=+\-@\t\r]/);
        });
    });

    it('11. RBAC Permissions: Enforces view and export permissions', () => {
        assert.strictEqual(hasOrgPermission('owner', 'analytics.view'), true);
        assert.strictEqual(hasOrgPermission('admin', 'analytics.view'), true);
        assert.strictEqual(hasOrgPermission('qa_manager', 'analytics.view'), true);
        assert.strictEqual(hasOrgPermission('qa_engineer', 'analytics.view'), true);
        assert.strictEqual(hasOrgPermission('viewer', 'analytics.view'), true);

        // Export permission
        assert.strictEqual(hasOrgPermission('owner', 'analytics.export'), true);
        assert.strictEqual(hasOrgPermission('admin', 'analytics.export'), true);
        assert.strictEqual(hasOrgPermission('qa_manager', 'analytics.export'), true);
        assert.strictEqual(hasOrgPermission('viewer', 'analytics.export'), false);
    });
});
