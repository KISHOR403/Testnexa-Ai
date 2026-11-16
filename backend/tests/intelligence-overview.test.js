const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseService = require('../src/services/supabaseData.service');
const traceabilityService = require('../src/services/traceability.service');
const intelligenceService = require('../src/services/intelligence.service');
const intelligenceController = require('../src/controllers/intelligence.controller');
const { requireFeature } = require('../src/middleware/featureFlag.middleware');

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

describe('QA Health & Authoring Intelligence Overview Verification', () => {
    const testUserId = 'test_intel_user_456';
    let testSessionId = null;

    before(async () => {
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;

        // Create a fixture test suite with requirements and test cases
        const created = await supabaseService.createSession({
            userId: testUserId,
            title: 'Authentication & Session Security Suite',
            status: 'active',
            requirement: 'Users must log in with email and password, verify OTP, and reset forgotten password securely.',
            context: 'web',
            depth: 'Standard',
            suiteData: {
                testSuiteName: 'Auth Security Suite',
                requirements: [
                    {
                        id: 'REQ-001',
                        title: 'Email and password authentication',
                        priority: 'High',
                        source_quote: 'Users must log in with email and password'
                    },
                    {
                        id: 'REQ-002',
                        title: 'Two-factor OTP verification',
                        priority: 'Critical',
                        source_quote: 'verify OTP'
                    },
                    {
                        id: 'REQ-003',
                        title: 'Forgot password reset flow',
                        priority: 'Medium',
                        source_quote: 'reset forgotten password securely'
                    }
                ],
                testCases: [
                    {
                        id: 'TC-001',
                        title: 'Successful login with valid credentials',
                        type: 'Functional',
                        priority: 'High',
                        steps: ['Enter email', 'Enter password', 'Click login'],
                        expectedResult: 'Dashboard displayed',
                        requirementId: 'REQ-001',
                        is_approved: true
                    },
                    {
                        id: 'TC-002',
                        title: 'Login attempt with invalid password',
                        type: 'Negative',
                        priority: 'High',
                        steps: ['Enter email', 'Enter wrong password', 'Click login'],
                        expectedResult: 'Error message displayed',
                        requirementId: 'REQ-001',
                        is_approved: true
                    },
                    {
                        id: 'TC-003',
                        title: 'OTP verification with valid code',
                        type: 'Functional',
                        priority: 'Critical',
                        steps: ['Enter OTP 123456', 'Click submit'],
                        expectedResult: 'Access granted',
                        requirementId: 'REQ-002',
                        is_approved: false
                    },
                    {
                        id: 'TC-004',
                        title: 'Password reset link generation',
                        type: 'Functional',
                        priority: 'Medium',
                        steps: ['Request reset link'],
                        expectedResult: 'Email sent',
                        requirementId: 'REQ-003',
                        is_approved: false
                    }
                ],
                summary: { total: 4 }
            }
        });
        testSessionId = created.id;
    });

    beforeEach(() => {
        intelligenceService.invalidateIntelligenceCache();
    });

    it('1. Guarantees 100% agreement between Traceability and Intelligence metrics', async () => {
        const traceSummary = await traceabilityService.getTraceabilitySummary(testSessionId, testUserId);
        const intelOverview = await intelligenceService.getIntelligenceOverview(testSessionId, testUserId);

        assert.equal(intelOverview.traceability.requirementsTotal, traceSummary.total);
        assert.equal(intelOverview.traceability.requirementsLinked, traceSummary.linked);
        assert.equal(intelOverview.traceability.linkedPct, traceSummary.linkedPercent);
        assert.equal(intelOverview.traceability.verifiedPct, traceSummary.verifiedPercent);
    });

    it('2. Computes authoring totals, review progress, and test mix accurately', async () => {
        const overview = await intelligenceService.getIntelligenceOverview(testSessionId, testUserId);

        // Totals
        assert.equal(overview.totals.suites, 1);
        assert.equal(overview.totals.cases, 4);
        assert.equal(overview.totals.requirements, 3);

        // Review: 2 approved (TC-001, TC-002), 2 unapproved (TC-003, TC-004) -> 50%
        assert.equal(overview.review.approved, 2);
        assert.equal(overview.review.notApproved, 2);
        assert.equal(overview.review.approvalPct, 50);

        // Test mix
        assert.equal(overview.byType.functional, 3);
        assert.equal(overview.byType.negative, 1);
        assert.equal(overview.byType.edge, 0);

        // Priority mix: 2 High, 1 Critical (sum to 3 high), 1 Medium -> 3 high, 1 medium, 0 low
        assert.equal(overview.byPriority.high, 3);
        assert.equal(overview.byPriority.medium, 1);
        assert.equal(overview.byPriority.low, 0);
    });

    it('3. Applies authoring gap rules deterministically (single_test, missing_negative, review_target)', async () => {
        const overview = await intelligenceService.getIntelligenceOverview(testSessionId, testUserId);
        const gapTypes = overview.gaps.map(g => g.type);

        // REQ-002 is Critical with only 1 linked test (TC-003) -> triggers 'single_test'
        assert.ok(gapTypes.includes('single_test'), 'Should detect single test gap on critical requirement');

        // REQ-002 has only 1 Functional test (no Negative/Edge) -> triggers 'missing_negative_or_security'
        assert.ok(gapTypes.includes('missing_negative_or_security'), 'Should detect missing negative validation');

        // TC-003 and TC-004 are not approved -> triggers 'review_target'
        assert.ok(gapTypes.includes('review_target'), 'Should detect cases awaiting review');
    });

    it('4. Provides 30-day activity array with accurate date structures', async () => {
        const overview = await intelligenceService.getIntelligenceOverview(testSessionId, testUserId);

        assert.equal(Array.isArray(overview.activity), true);
        assert.equal(overview.activity.length, 30);
        assert.ok(overview.activity[29].date, 'Last item should be today');
        assert.ok(typeof overview.activity[29].suitesCreated === 'number');
        assert.ok(typeof overview.activity[29].casesApproved === 'number');
    });

    it('5. In-memory cache returns cached data and invalidates on call', async () => {
        const first = await intelligenceService.getIntelligenceOverview(testSessionId, testUserId);
        const second = await intelligenceService.getIntelligenceOverview(testSessionId, testUserId);
        assert.strictEqual(first, second, 'Should return cached instance');

        intelligenceService.invalidateIntelligenceCache(testUserId, testSessionId);
        const third = await intelligenceService.getIntelligenceOverview(testSessionId, testUserId);
        assert.notStrictEqual(first, third, 'Should return fresh computation after invalidation');
        assert.deepEqual(first, third, 'Data values should match');
    });

    it('6. requireFeature("testRuns") guards execution intelligence endpoints with HTTP 501', async () => {
        delete process.env.FEATURE_TEST_RUNS; // default false

        const middleware = requireFeature('testRuns');
        let nextCalled = false;
        const res = createMockRes();
        const req = { originalUrl: '/api/v1/runs/intelligence/dashboard' };

        middleware(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, false, 'Should not proceed to execution controller');
        assert.equal(res.statusCode, 501);
        assert.equal(res.data.code, 'FEATURE_DISABLED');
        assert.equal(res.data.feature, 'testRuns');
    });

    it('7. intelligenceController.getOverview validates input and returns structured response', async () => {
        const req = {
            query: { suite_id: testSessionId },
            user: { id: testUserId }
        };
        const res = createMockRes();

        await intelligenceController.getOverview(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.ok(res.data.data.totals);
        assert.equal(res.data.data.features.testRuns, false);
    });
});
