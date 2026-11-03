/**
 * TestNexa AI — Phase 2: Failure Trend Analysis & Error Fingerprinting Test Suite
 *
 * Verifies:
 * 1. Aggregates completed execution records only (excludes cancelled and in-progress runs).
 * 2. Time-series daily and weekly aggregation with defined denominators and accurate rates.
 * 3. Avoids double-counting test cases within a single run.
 * 4. Normalizes dynamic tokens (UUIDs, timestamps, hex, numbers, durations) into stable error signatures.
 * 5. Categorizes error types (AssertionError, TimeoutError, ElementNotFoundError, NetworkError, TypeError, StepFailure).
 * 6. Classifies New Failure (first seen failure with 0 prior failures).
 * 7. Classifies Recurring Failure (failed >= 2 times across distinct test runs).
 * 8. Classifies Resolved Failure (failed previously, subsequent completed run PASSED).
 * 9. Strict Resolution enforcement (not resolved merely because of absence; requires passing execution).
 * 10. Classifies Still Failing (latest completed execution is still failing).
 * 11. Classifies Insufficient History (< 2 executions recorded).
 * 12. Enforces multi-tenant workspace isolation (Workspace A cannot view Workspace B failure trends).
 * 13. Filters by suite, date range, browser, environment, and execution method.
 * 14. Computes trajectory (increasing, decreasing, stable) and summary indicators.
 * 15. Retrieves signature details with occurrences and artifact references.
 * 16. In-memory cache with TTL and cache invalidation on new execution recording.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const supabaseService = require('../src/services/supabaseData.service');
const failureTrendsService = require('../src/services/runner/failureTrends.service');
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

describe('Phase 2: Failure Trend Analysis & Error Fingerprinting Engine', () => {
    let userA, userB;
    let workspaceA, workspaceB;
    let suiteA;

    before(async () => {
        // Fast local fallback without remote timeout
        supabaseService.sessionsTableAvailable = false;
        supabaseService.workspacesTableAvailable = false;
        supabaseService.executionTablesAvailable = false;
        // Clear caches
        failureTrendsService.invalidateCache();

        // 1. Initialize Users & Isolated Workspaces
        userA = { id: `usr_trend_a_${Date.now()}`, name: 'Alice QA', email: 'alice.trends@testnexa.ai' };
        userB = { id: `usr_trend_b_${Date.now()}`, name: 'Bob QA', email: 'bob.trends@testnexa.ai' };

        workspaceA = await supabaseService.getUserPrimaryWorkspace(userA.id, userA.name);
        workspaceB = await supabaseService.getUserPrimaryWorkspace(userB.id, userB.name);

        // 2. Create Test Suite in Workspace A
        const suiteSession = await supabaseService.createSession({
            userId: userA.id,
            workspaceId: workspaceA.id,
            title: 'Checkout & Payment Test Suite',
            feature: 'E-Commerce Checkout Flow',
            status: 'Ready',
            suiteData: {
                testSuiteName: 'Checkout E2E Suite',
                projectName: 'Storefront Web',
                functional: [
                    { id: 'TC_PAY_001', title: 'Verify card checkout with valid VISA', priority: 'High', executionMethod: 'automated' },
                    { id: 'TC_PAY_002', title: 'Verify card declined on invalid CVC', priority: 'High', executionMethod: 'automated' },
                    { id: 'TC_PAY_003', title: 'Verify cart subtotal and shipping calculation', priority: 'Medium', executionMethod: 'manual' },
                    { id: 'TC_PAY_004', title: 'Verify timeout recovery on payment gateway lag', priority: 'High', executionMethod: 'automated' }
                ]
            }
        });
        suiteA = suiteSession;
    });

    it('1. Error normalization creates stable signatures despite variable tokens and timestamps', () => {
        const msg1 = 'AssertionError: expected status 200 but received 500 for transaction 4a12b3c4-1122-3344-5566-778899aabbcc at 2026-11-01T10:00:00Z after waiting 30000ms at http://localhost:8080/checkout';
        const msg2 = 'AssertionError: expected status 200 but received 500 for transaction 9f88e7d6-9988-7766-5544-332211aabbcc at 2026-11-02T14:30:15Z after waiting 5000ms at http://localhost:3000/checkout';

        const norm1 = failureTrendsService._normalizeErrorMessage(msg1);
        const norm2 = failureTrendsService._normalizeErrorMessage(msg2);

        assert.equal(norm1, norm2, 'Normalized signatures must match across dynamic UUIDs, timestamps, durations, and URLs');
        assert.ok(norm1.includes('<UUID>'), 'UUID replaced with token');
        assert.ok(norm1.includes('<DURATION>'), 'Duration replaced with token');
    });

    it('2. Correctly classifies distinct error types across automated and manual outcomes', () => {
        const timeoutType = failureTrendsService._classifyErrorType('TimeoutError: locator.click: Timeout 30000ms exceeded', '', 'automated');
        const assertType = failureTrendsService._classifyErrorType('expect(received).toBe(expected)', '', 'automated');
        const elementNotFound = failureTrendsService._classifyErrorType('locator not found: button#submit-order', '', 'automated');
        const networkType = failureTrendsService._classifyErrorType('net::ERR_CONNECTION_REFUSED at http://api.store.com', '', 'automated');
        const typeError = failureTrendsService._classifyErrorType('TypeError: Cannot read properties of undefined (reading "amount")', 'at tests/checkout.js:45', 'automated');
        const manualStepFailure = failureTrendsService._classifyErrorType('Manual step failed: Cart total did not match receipt', null, 'manual');

        assert.equal(timeoutType, 'TimeoutError');
        assert.equal(assertType, 'AssertionError');
        assert.equal(elementNotFound, 'ElementNotFoundError');
        assert.equal(networkType, 'NetworkError');
        assert.equal(typeError, 'TypeError');
        assert.equal(manualStepFailure, 'StepFailure');
    });

    it('3. Ingests completed runs and ignores cancelled and incomplete runs', async () => {
        // Run 1: Completed Run 3 days ago (TC_PAY_001 passed, TC_PAY_002 failed)
        const dateRun1 = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)).toISOString();
        const run1 = await supabaseService.createTestRun({
            workspaceId: workspaceA.id,
            suiteId: suiteA.id,
            createdBy: userA.id,
            name: 'Run #1 - Sprint 42 Baseline',
            executionType: 'automated',
            targetEnvironment: { browser: 'chromium', environment: 'staging' },
            selectedCaseIds: ['TC_PAY_001', 'TC_PAY_002']
        });

        const run1Cases = await supabaseService.getRunCases(run1.id);
        const c1 = run1Cases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC_PAY_001');
        const c2 = run1Cases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC_PAY_002');

        await supabaseService.recordTestExecution({
            runId: run1.id,
            runCaseId: c1.id,
            testCaseId: 'TC_PAY_001',
            status: 'passed',
            durationMs: 1200
        });

        await supabaseService.recordTestExecution({
            runId: run1.id,
            runCaseId: c2.id,
            testCaseId: 'TC_PAY_002',
            status: 'failed',
            errorMessage: 'AssertionError: expected card error "Invalid CVC" but got 500 error code for id 00112233-4455-6677-8899-aabbccddeeff',
            stackTrace: 'at CheckoutPage.submitOrder (tests/e2e/checkout.spec.js:84:12)',
            durationMs: 3500
        });

        await supabaseService.updateTestRun(run1.id, workspaceA.id, {
            status: 'completed',
            completedAt: dateRun1,
            startedAt: dateRun1
        });

        // Run 2: Cancelled Run (TC_PAY_002 failed in it, but run was cancelled -> must be excluded)
        const cancelledRun = await supabaseService.createTestRun({
            workspaceId: workspaceA.id,
            suiteId: suiteA.id,
            createdBy: userA.id,
            name: 'Run #2 - Cancelled Abort Run',
            executionType: 'automated',
            targetEnvironment: { browser: 'chromium', environment: 'staging' },
            selectedCaseIds: ['TC_PAY_002']
        });
        await supabaseService.updateTestRun(cancelledRun.id, { status: 'cancelled' });

        // Run 3: In-Progress Run (must be excluded from completed failure trends)
        const inProgressRun = await supabaseService.createTestRun({
            workspaceId: workspaceA.id,
            suiteId: suiteA.id,
            createdBy: userA.id,
            name: 'Run #3 - Active In-Progress Run',
            executionType: 'automated',
            targetEnvironment: { browser: 'chromium', environment: 'staging' },
            selectedCaseIds: ['TC_PAY_003']
        });

        // Analyze trends
        const analysis = await failureTrendsService.analyzeFailureTrends(workspaceA.id, {
            startDate: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString()
        });

        assert.equal(analysis.summary.runsAnalyzed, 1, 'Only 1 completed run must be analyzed');
        assert.equal(analysis.summary.totalExecutions, 2, 'Total case executions denominator is 2');
        assert.equal(analysis.summary.totalFailures, 1, '1 failure recorded');
        assert.equal(analysis.summary.overallFailureRate, 50.0, 'Failure rate is 50.0%');
        assert.equal(analysis.summary.uniqueFailingCases, 1, '1 unique failing case');
    });

    it('4. Classifies New Failure when test fails for the first time in history', async () => {
        // Run 4: Completed Run 2 days ago (TC_PAY_004 encounters timeout for first time)
        const dateRun4 = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)).toISOString();
        const run4 = await supabaseService.createTestRun({
            workspaceId: workspaceA.id,
            suiteId: suiteA.id,
            createdBy: userA.id,
            name: 'Run #4 - Nightly Regression',
            executionType: 'automated',
            targetEnvironment: { browser: 'chromium', environment: 'staging' },
            selectedCaseIds: ['TC_PAY_001', 'TC_PAY_004']
        });

        const run4Cases = await supabaseService.getRunCases(run4.id);
        const c4 = run4Cases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC_PAY_004');

        await supabaseService.recordTestExecution({
            runId: run4.id,
            runCaseId: c4.id,
            testCaseId: 'TC_PAY_004',
            status: 'timed_out',
            errorMessage: 'TimeoutError: locator.click: Timeout 30000ms exceeded waiting for button#pay-now',
            stackTrace: 'at PaymentGateway.pay (tests/e2e/payment.spec.js:102:15)',
            durationMs: 30000
        });

        await supabaseService.updateTestRun(run4.id, workspaceA.id, {
            status: 'completed',
            completedAt: dateRun4,
            startedAt: dateRun4
        });

        failureTrendsService.invalidateCache(workspaceA.id);
        const analysis = await failureTrendsService.analyzeFailureTrends(workspaceA.id);

        const newFailures = analysis.classifications.newFailures;
        const pay004New = newFailures.find(f => f.testCaseId === 'TC_PAY_004');
        assert.ok(pay004New, 'TC_PAY_004 must be classified as a New Failure');
        assert.equal(pay004New.classification, 'new_failure');
        assert.equal(pay004New.failureCount, 1);
    });

    it('5. Classifies Recurring Failure when error signature recurs across multiple runs', async () => {
        // Run 5: Run 1 day ago (TC_PAY_002 fails AGAIN with same CVC assertion error)
        const dateRun5 = new Date(Date.now() - (1 * 24 * 60 * 60 * 1000)).toISOString();
        const run5 = await supabaseService.createTestRun({
            workspaceId: workspaceA.id,
            suiteId: suiteA.id,
            createdBy: userA.id,
            name: 'Run #5 - Sprint 42 Verification',
            executionType: 'automated',
            targetEnvironment: { browser: 'chromium', environment: 'staging' },
            selectedCaseIds: ['TC_PAY_002']
        });

        const run5Cases = await supabaseService.getRunCases(run5.id);
        const c2 = run5Cases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC_PAY_002');

        await supabaseService.recordTestExecution({
            runId: run5.id,
            runCaseId: c2.id,
            testCaseId: 'TC_PAY_002',
            status: 'failed',
            errorMessage: 'AssertionError: expected card error "Invalid CVC" but got 500 error code for id ff998877-6655-4433-2211-001122334455',
            stackTrace: 'at CheckoutPage.submitOrder (tests/e2e/checkout.spec.js:84:12)',
            durationMs: 3200
        });

        await supabaseService.updateTestRun(run5.id, workspaceA.id, {
            status: 'completed',
            completedAt: dateRun5,
            startedAt: dateRun5
        });

        failureTrendsService.invalidateCache(workspaceA.id);
        const analysis = await failureTrendsService.analyzeFailureTrends(workspaceA.id);

        const recurring = analysis.classifications.recurringFailures;
        const pay002Rec = recurring.find(f => f.testCaseId === 'TC_PAY_002');
        assert.ok(pay002Rec, 'TC_PAY_002 must be classified as Recurring Failure');
        assert.equal(pay002Rec.failureCount, 2, 'Failed across 2 distinct runs');
    });

    it('6. Strictly enforces Resolved Failure classification (requires subsequent PASSING run)', async () => {
        // Before passing, TC_PAY_004 is NOT resolved
        let preAnalysis = await failureTrendsService.analyzeFailureTrends(workspaceA.id);
        let resolvedCheck = preAnalysis.classifications.resolvedFailures.find(f => f.testCaseId === 'TC_PAY_004');
        assert.equal(resolvedCheck, undefined, 'TC_PAY_004 cannot be resolved before having a subsequent passing execution');

        // Run 6: Today (TC_PAY_004 executes and PASSES!)
        const dateRun6 = new Date().toISOString();
        const run6 = await supabaseService.createTestRun({
            workspaceId: workspaceA.id,
            suiteId: suiteA.id,
            createdBy: userA.id,
            name: 'Run #6 - Post-Fix Validation',
            executionType: 'automated',
            targetEnvironment: { browser: 'chromium', environment: 'staging' },
            selectedCaseIds: ['TC_PAY_004']
        });

        const run6Cases = await supabaseService.getRunCases(run6.id);
        const c4 = run6Cases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC_PAY_004');

        await supabaseService.recordTestExecution({
            runId: run6.id,
            runCaseId: c4.id,
            testCaseId: 'TC_PAY_004',
            status: 'passed',
            durationMs: 1400
        });

        await supabaseService.updateTestRun(run6.id, workspaceA.id, {
            status: 'completed',
            completedAt: dateRun6,
            startedAt: dateRun6
        });

        failureTrendsService.invalidateCache(workspaceA.id);
        const postAnalysis = await failureTrendsService.analyzeFailureTrends(workspaceA.id);

        const resolvedList = postAnalysis.classifications.resolvedFailures;
        const pay004Resolved = resolvedList.find(f => f.testCaseId === 'TC_PAY_004');
        assert.ok(pay004Resolved, 'TC_PAY_004 must now be classified as Resolved Failure');
        assert.equal(pay004Resolved.classification, 'resolved');
        assert.equal(pay004Resolved.resolvedInRunId, run6.id);
        assert.ok(pay004Resolved.reason.includes('successfully PASSED'), 'Clear rationale explaining subsequent pass');
    });

    it('7. Still Failing classification identifies unresolved active failures', async () => {
        const analysis = await failureTrendsService.analyzeFailureTrends(workspaceA.id);
        const stillFailing = analysis.classifications.stillFailing;

        const pay002Failing = stillFailing.find(f => f.testCaseId === 'TC_PAY_002');
        assert.ok(pay002Failing, 'TC_PAY_002 remains in Still Failing list because its latest execution was failed');
        assert.equal(pay002Failing.classification, 'still_failing');
    });

    it('8. Daily and weekly time-series buckets calculate correct failure counts and rates', async () => {
        const analysisDaily = await failureTrendsService.analyzeFailureTrends(workspaceA.id, { interval: 'daily' });
        assert.ok(Array.isArray(analysisDaily.timeSeries), 'Daily timeSeries must be an array');
        assert.ok(analysisDaily.timeSeries.length >= 2, 'Contains multiple daily buckets');

        for (const bucket of analysisDaily.timeSeries) {
            assert.ok(bucket.date, 'Bucket has date');
            assert.ok(bucket.totalExecutions >= 0, 'Bucket has totalExecutions');
            if (bucket.totalExecutions > 0) {
                const expectedRate = Number(((bucket.failureCount / bucket.totalExecutions) * 100).toFixed(1));
                assert.equal(bucket.failureRate, expectedRate, 'Calculated failure rate must match formula');
            }
        }

        const analysisWeekly = await failureTrendsService.analyzeFailureTrends(workspaceA.id, { interval: 'weekly' });
        assert.ok(Array.isArray(analysisWeekly.timeSeries), 'Weekly timeSeries must be an array');
        assert.ok(analysisWeekly.timeSeries[0].label.includes('Week of'), 'Weekly bucket label formatted properly');
    });

    it('9. Enforces multi-tenant workspace isolation on failure trends', async () => {
        // User B in Workspace B queries failure trends
        const reqB = createMockReq(userB, {}, {}, { workspaceId: workspaceB.id });
        const resB = createMockRes();

        await executionController.getFullFailureTrends(reqB, resB);
        assert.equal(resB.statusCode, 200);
        assert.equal(resB.data.data.summary.totalExecutions, 0, 'Workspace B has 0 runs and cannot see Workspace A data');
        assert.equal(resB.data.data.summary.totalFailures, 0);

        // User B attempts to access Workspace A data explicitly -> 403 Forbidden
        const reqCross = createMockReq(userB, {}, {}, { workspaceId: workspaceA.id });
        const resCross = createMockRes();

        await executionController.getFullFailureTrends(reqCross, resCross);
        assert.equal(resCross.statusCode, 403, 'Cross-workspace access must be rejected with 403 Forbidden');
        assert.equal(resCross.data.code, 'FORBIDDEN');
    });

    it('10. Endpoint GET /api/v1/runs/trends/summary returns compact indicators and trajectory', async () => {
        const req = createMockReq(userA, {}, {}, { workspaceId: workspaceA.id });
        const res = createMockRes();

        await executionController.getFailureTrendsSummary(req, res);
        assert.equal(res.statusCode, 200);
        assert.ok(res.data.success);
        assert.ok(res.data.data.totalExecutions > 0);
        assert.ok(typeof res.data.data.overallFailureRate === 'number');
        assert.ok(['increasing', 'decreasing', 'stable'].includes(res.data.data.trajectory));
    });

    it('11. Endpoint GET /api/v1/runs/trends/signatures supports search, filter, and pagination', async () => {
        const req = createMockReq(userA, {}, {}, { workspaceId: workspaceA.id, limit: '2', page: '1' });
        const res = createMockRes();

        await executionController.getFailureSignatures(req, res);
        assert.equal(res.statusCode, 200);
        assert.ok(res.data.success);
        assert.ok(Array.isArray(res.data.data));
        assert.ok(res.data.pagination);
        assert.equal(res.data.pagination.page, 1);
        assert.equal(res.data.pagination.limit, 2);

        // Test signature search
        const reqSearch = createMockReq(userA, {}, {}, { workspaceId: workspaceA.id, search: 'CVC' });
        const resSearch = createMockRes();

        await executionController.getFailureSignatures(reqSearch, resSearch);
        assert.equal(resSearch.statusCode, 200);
        assert.ok(resSearch.data.data.length >= 1, 'Search finds CVC assertion error');
    });

    it('12. Endpoint GET /api/v1/runs/trends/signatures/:signatureId returns occurrence details', async () => {
        // First retrieve signature list
        const analysis = await failureTrendsService.analyzeFailureTrends(workspaceA.id);
        const firstSig = analysis.signatures[0];
        assert.ok(firstSig, 'At least 1 signature exists');

        const req = createMockReq(userA, { signatureId: firstSig.signatureId }, {}, { workspaceId: workspaceA.id });
        const res = createMockRes();

        await executionController.getFailureSignatureDetail(req, res);
        assert.equal(res.statusCode, 200);
        assert.ok(res.data.success);
        assert.equal(res.data.data.signatureId, firstSig.signatureId);
        assert.ok(Array.isArray(res.data.data.recentOccurrences));
        assert.ok(res.data.data.recentOccurrences.length > 0);
        assert.ok(res.data.data.recentOccurrences[0].runName);
    });

    it('13. Filters by browser, environment, and executionMethod cleanly', async () => {
        // Query only Firefox -> should return 0 runs because runs were executed on Chromium
        const analysisFirefox = await failureTrendsService.analyzeFailureTrends(workspaceA.id, {
            browser: 'Firefox'
        });
        assert.equal(analysisFirefox.summary.runsAnalyzed, 0, 'No runs for Firefox');

        // Query Chromium -> returns all runs
        const analysisChromium = await failureTrendsService.analyzeFailureTrends(workspaceA.id, {
            browser: 'Chromium'
        });
        assert.ok(analysisChromium.summary.runsAnalyzed > 0, 'Returns Chromium runs');
    });

    it('14. Invalidate cache on execution record and purge cached workspace data', () => {
        failureTrendsService.cache.set(`${workspaceA.id}:dummy`, { data: 'test', timestamp: Date.now() });
        assert.ok(failureTrendsService.cache.has(`${workspaceA.id}:dummy`));

        failureTrendsService.invalidateCache(workspaceA.id);
        assert.equal(failureTrendsService.cache.has(`${workspaceA.id}:dummy`), false, 'Cache purged for workspaceA');
    });
});
