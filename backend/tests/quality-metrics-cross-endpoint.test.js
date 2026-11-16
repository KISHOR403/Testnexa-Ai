const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseService = require('../src/services/supabaseData.service');
const qualityMetricsService = require('../src/services/qualityMetrics.service');
const intelligenceService = require('../src/services/intelligence.service');
const intelligenceController = require('../src/controllers/intelligence.controller');

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

describe('Cross-Endpoint Quality Metrics and Authoring Activity Verification', () => {
    const testUserId = 'test_cross_metric_user_789';
    let suiteId1 = null;
    let suiteId2 = null;

    before(async () => {
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;

        // Suite 1: 5 cases, 2 requirements. 0 approved.
        // REQ-A: 1 linked test (triggers single_test_requirement)
        // REQ-B: 3 linked tests (functional only, high priority -> triggers no_negative_or_security_test)
        // TC-5: unlinked (triggers unlinked_test_case)
        // All 5 pending (triggers review_backlog)
        // TC-4: unset priority (triggers missing_priority)
        const s1 = await supabaseService.createSession({
            userId: testUserId,
            title: 'Checkout & Payments Suite',
            status: 'active',
            requirement: 'Checkout payment processing and order confirmation.',
            context: 'web',
            depth: 'Standard',
            suiteData: {
                testSuiteName: 'Checkout Suite',
                requirements: [
                    { id: 'REQ-A', title: 'Payment Method Tokenization', priority: 'Medium' },
                    { id: 'REQ-B', title: 'High Value Fraud Check', priority: 'High' }
                ],
                testCases: [
                    {
                        id: 'TC-101',
                        title: 'Tokenize valid credit card',
                        type: 'Functional',
                        priority: 'Medium',
                        steps: ['Enter valid card number', 'Submit tokenization request'],
                        expectedResult: 'Payment token returned',
                        requirementId: 'REQ-A',
                        approval_status: 'pending'
                    },
                    {
                        id: 'TC-102',
                        title: 'Fraud check triggers verification',
                        type: 'Functional',
                        priority: 'High',
                        steps: ['Submit transaction over threshold'],
                        expectedResult: 'Risk evaluation flags transaction',
                        requirementId: 'REQ-B',
                        approval_status: 'pending'
                    },
                    {
                        id: 'TC-103',
                        title: 'Fraud check logs risk score',
                        type: 'Functional',
                        priority: 'High',
                        steps: ['Check evaluation audit log'],
                        expectedResult: 'Risk score written to event table',
                        requirementId: 'REQ-B',
                        approval_status: 'pending'
                    },
                    {
                        id: 'TC-104',
                        title: 'Order confirmation email generated',
                        type: 'Functional',
                        priority: '', // unset priority
                        steps: ['Finalize successful payment'],
                        expectedResult: 'Email dispatched to user',
                        requirementId: 'REQ-B',
                        approval_status: 'pending'
                    },
                    {
                        id: 'TC-105',
                        title: 'Promo banner displayed',
                        type: 'Functional',
                        priority: 'Low',
                        steps: ['Navigate to checkout summary'],
                        expectedResult: 'Banner visible',
                        requirementId: null, // unlinked
                        approval_status: 'pending'
                    }
                ]
            }
        });
        suiteId1 = s1.id || s1._id;

        // Suite 2: 2 cases, 1 requirement.
        const s2 = await supabaseService.createSession({
            userId: testUserId,
            title: 'User Profile Suite',
            status: 'active',
            requirement: 'User profile management.',
            context: 'web',
            depth: 'Standard',
            suiteData: {
                testSuiteName: 'Profile Suite',
                requirements: [
                    { id: 'REQ-C', title: 'Profile update', priority: 'Medium' }
                ],
                testCases: [
                    {
                        id: 'TC-201',
                        title: 'Update display name',
                        type: 'Functional',
                        priority: 'Medium',
                        steps: ['Input new name', 'Click Save Profile'],
                        expectedResult: 'Name updated successfully',
                        requirementId: 'REQ-C',
                        approval_status: 'approved'
                    },
                    {
                        id: 'TC-202',
                        title: 'Update avatar image',
                        type: 'Functional',
                        priority: 'Medium',
                        steps: ['Select PNG file', 'Click Upload'],
                        expectedResult: 'Avatar image updated',
                        requirementId: 'REQ-C',
                        approval_status: 'pending'
                    }
                ]
            }
        });
        suiteId2 = s2.id || s2._id;

        // Record some immutable events into case_events store
        await supabaseService.recordCaseEvent({
            userId: testUserId,
            suiteId: suiteId1,
            caseId: null,
            type: 'suite_created',
            source: 'test'
        });
        await supabaseService.recordCaseEvent({
            userId: testUserId,
            suiteId: suiteId1,
            caseId: 'TC-101',
            type: 'case_generated',
            source: 'test'
        });
        await supabaseService.recordCaseEvent({
            userId: testUserId,
            suiteId: suiteId2,
            caseId: 'TC-201',
            type: 'case_approved',
            source: 'test'
        });
    });

    it('1. Quality Metrics strictly counts approval ONLY when approval_status === "approved"', async () => {
        const metricsS1 = await qualityMetricsService.getQualityMetrics({
            suiteId: suiteId1,
            userId: testUserId
        });

        assert.equal(metricsS1.cases, 5);
        assert.equal(metricsS1.approvedCount, 0, 'Pending cases must strictly report 0 approved');
        assert.equal(metricsS1.approvalPct, 0);
        assert.equal(metricsS1.notApprovedCount, 5);

        const metricsS2 = await qualityMetricsService.getQualityMetrics({
            suiteId: suiteId2,
            userId: testUserId
        });
        assert.equal(metricsS2.cases, 2);
        assert.equal(metricsS2.approvedCount, 1, 'Only TC-201 is approved');
        assert.equal(metricsS2.approvalPct, 50);
        assert.equal(metricsS2.notApprovedCount, 1);
    });

    it('2. Evaluates all 5 deterministic quality gap discovery rules', async () => {
        const metrics = await qualityMetricsService.getQualityMetrics({
            suiteId: suiteId1,
            userId: testUserId
        });

        assert.ok(Array.isArray(metrics.rulesChecked));
        assert.equal(metrics.rulesChecked.length, 5);

        const gapKeys = metrics.gaps.map(g => g.key);

        // Rule 1: single_test_requirement (REQ-A has 1 test)
        assert.ok(gapKeys.includes('single_test_requirement'), 'Should detect REQ-A with single test');
        const singleGap = metrics.gaps.find(g => g.key === 'single_test_requirement');
        assert.equal(singleGap.count, 1);
        assert.equal(singleGap.items[0].id, 'REQ-A');

        // Rule 2: no_negative_or_security_test (REQ-B is High priority and has only Functional tests)
        assert.ok(gapKeys.includes('no_negative_or_security_test'), 'Should detect REQ-B lacking negative/security');

        // Rule 3: unlinked_test_case (TC-105 is not linked)
        assert.ok(gapKeys.includes('unlinked_test_case'), 'Should detect TC-105 unlinked');

        // Rule 4: review_backlog (all 5 cases are pending)
        assert.ok(gapKeys.includes('review_backlog'), 'Should detect review backlog');
        const backlogGap = metrics.gaps.find(g => g.key === 'review_backlog');
        assert.equal(backlogGap.count, 5);

        // Rule 5: missing_priority (TC-104 has unset priority)
        assert.ok(gapKeys.includes('missing_priority'), 'Should detect TC-104 missing priority');
    });

    it('3. GET /api/v1/intelligence/overview matches canonical quality metrics', async () => {
        const req = {
            query: { suite_id: suiteId1 },
            user: { _id: testUserId }
        };
        const res = createMockRes();
        await intelligenceController.getOverview(req, res);

        assert.equal(res.statusCode, 200);
        const data = res.data.data;

        assert.equal(data.totals.cases, 5);
        assert.equal(data.review.approved, 0);
        assert.equal(data.review.approvalPct, 0);
        assert.equal(data.review.notApproved, 5);
        assert.equal(data.traceability.requirementsLinked, 2);
        assert.equal(data.traceability.linkedPct, 100);
        assert.equal(data.traceability.verifiedPct, 0); // test execution disabled
        assert.equal(data.gaps.length, 5);
    });

    it('4. GET /api/v1/intelligence/activity returns timezone-adjusted buckets and matching period totals', async () => {
        const req = {
            query: { suite_id: 'all', days: 14, tz: 'America/New_York' },
            user: { _id: testUserId }
        };
        const res = createMockRes();
        await intelligenceController.getActivity(req, res);

        assert.equal(res.statusCode, 200);
        const data = res.data.data;

        assert.equal(data.days, 14);
        assert.equal(data.tz, 'America/New_York');
        assert.ok(Array.isArray(data.activity));
        assert.equal(data.activity.length, 14);

        // Verify period totals equal sum of buckets
        const sumSuites = data.activity.reduce((acc, b) => acc + b.suitesCreated, 0);
        const sumGenerated = data.activity.reduce((acc, b) => acc + b.casesGenerated, 0);
        const sumApproved = data.activity.reduce((acc, b) => acc + b.casesApproved, 0);

        assert.equal(data.periodTotals.suitesCreated, sumSuites);
        assert.equal(data.periodTotals.casesGenerated, sumGenerated);
        assert.equal(data.periodTotals.casesApproved, sumApproved);
        assert.ok(sumSuites >= 1);
        assert.ok(sumGenerated >= 1);
        assert.ok(sumApproved >= 1);
    });
});
