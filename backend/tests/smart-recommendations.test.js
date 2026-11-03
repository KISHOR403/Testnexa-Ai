const { describe, it, beforeEach } = require('node:test');
const assert = require('assert');
const smartRecommendationsService = require('../src/services/recommendations/smartRecommendations.service');
const supabaseService = require('../src/services/supabaseData.service');
const aiService = require('../src/services/ai.service');

describe('Smart Test Recommendations Engine', () => {
    const testUserId = 'user_rec_test_123';
    const testSuiteId = 'suite_rec_test_456';

    const sampleSuiteData = {
        testSuiteName: 'Checkout & Payment Suite',
        understanding: {
            functional_requirements: [
                { id: 'REQ_001', title: 'User authentication on checkout', description: 'User must log in or checkout as guest.' },
                { id: 'REQ_002', title: 'Payment card processing', description: 'System charges valid Visa and MasterCard credit cards.' },
                { id: 'REQ_003', title: 'Order confirmation notification', description: 'Customer receives confirmation email with invoice.' }
            ]
        },
        functional: [
            {
                id: 'TC_FUNC_001',
                title: 'Verify successful checkout with valid Visa credit card',
                requirementId: 'REQ_002',
                type: 'Functional',
                priority: 'High',
                steps: ['Add item to cart', 'Proceed to checkout', 'Enter Visa details', 'Click Pay'],
                expectedResult: 'Payment succeeds and receipt is displayed'
            }
        ],
        negative: [],
        edge: [],
        security: [],
        nonFunctional: []
    };

    beforeEach(async () => {
        // Fast local fallback without remote timeout
        supabaseService.sessionsTableAvailable = false;
        supabaseService.workspacesTableAvailable = false;
        supabaseService.executionTablesAvailable = false;

        // Seed test session in memory directly
        supabaseService.inMemorySessions.set(testSuiteId, {
            id: testSuiteId,
            _id: testSuiteId,
            user_id: testUserId,
            userId: testUserId,
            title: 'Checkout & Payment Suite',
            suite_data: sampleSuiteData,
            suiteData: sampleSuiteData,
            status: 'Generated',
            requirement: 'Checkout flow with payment card processing and order notifications.'
        });
    });

    it('1. should calculate token Jaccard similarity accurately', () => {
        const text1 = 'Verify successful checkout with valid Visa credit card';
        const text2 = 'Verify successful checkout with valid Visa card';
        const simHigh = smartRecommendationsService.calculateSimilarity(text1, text2);
        assert.ok(simHigh >= 0.7, `Expected similarity >= 0.7, got ${simHigh}`);

        const text3 = 'Check SQL injection payload in credit card field';
        const simLow = smartRecommendationsService.calculateSimilarity(text1, text3);
        assert.ok(simLow < 0.3, `Expected low similarity, got ${simLow}`);
    });

    it('2. should extract requirements and test cases correctly from suiteData', async () => {
        const session = await supabaseService.getSession(testSuiteId, testUserId);
        const reqs = smartRecommendationsService.extractSuiteRequirements(session);
        const cases = smartRecommendationsService.extractSuiteTestCases(session);

        assert.strictEqual(reqs.length, 3);
        assert.strictEqual(reqs[0].id, 'REQ_001');
        assert.strictEqual(cases.length, 1);
        assert.strictEqual(cases[0].id, 'TC_FUNC_001');
        assert.strictEqual(cases[0].requirementId, 'REQ_002');
    });

    it('3. should analyze coverage gaps and identify untested requirements and shallow coverage', async () => {
        const session = await supabaseService.getSession(testSuiteId, testUserId);
        const reqs = smartRecommendationsService.extractSuiteRequirements(session);
        const cases = smartRecommendationsService.extractSuiteTestCases(session);

        const gaps = smartRecommendationsService.analyzeCoverageGaps(reqs, cases);

        assert.strictEqual(gaps.totalRequirements, 3);
        assert.strictEqual(gaps.untestedRequirements, 2, 'REQ_001 and REQ_003 have 0 cases');
        assert.strictEqual(gaps.shallowCoverageCount, 1, 'REQ_002 only has 1 functional test, missing negative/edge');
    });

    it('4. should generate smart recommendations with AI, detecting duplicates and scoring gaps', async () => {
        // Mock callAI
        const originalCallAI = aiService.callAI;
        aiService.callAI = async () => {
            return JSON.stringify({
                analysisSummary: {
                    requirementsAnalyzed: 3,
                    existingTestCasesReviewed: 1,
                    potentialCoverageGapsIdentified: 3,
                    keyObservations: 'Critical coverage gaps found in payment error handling and untested authentication.'
                },
                recommendations: [
                    {
                        title: 'Verify card declined on insufficient funds error',
                        category: 'Negative',
                        priority: 'High',
                        relatedRequirementId: 'REQ_002',
                        relatedRequirementTitle: 'Payment card processing',
                        recommendationReason: 'Ensures user receives actionable error message when card balance is insufficient.',
                        coverageGapAddressed: 'Payment requirement currently lacks negative decline scenarios.',
                        preconditions: 'User has test card with insufficient funds.',
                        steps: ['Enter checkout', 'Submit payment with insufficient funds test card', 'Verify error prompt'],
                        expectedResult: 'Informative error prompt is shown and order remains unplaced.',
                        testData: 'Card: 4000-0000-0000-0002',
                        assumptions: 'Gateway returns standard 402 code'
                    },
                    {
                        title: 'Verify successful checkout with valid Visa credit card', // Deliberate duplicate
                        category: 'Positive',
                        priority: 'Medium',
                        relatedRequirementId: 'REQ_002',
                        relatedRequirementTitle: 'Payment card processing',
                        recommendationReason: 'Redundant happy path test',
                        coverageGapAddressed: 'None',
                        preconditions: 'Valid card',
                        steps: ['Add item to cart', 'Proceed to checkout', 'Enter Visa details', 'Click Pay'],
                        expectedResult: 'Success',
                        testData: 'Visa 4000-0000-0000-0001'
                    },
                    {
                        title: 'Verify guest checkout with expired session token',
                        category: 'Security',
                        priority: 'Critical',
                        relatedRequirementId: 'REQ_001',
                        relatedRequirementTitle: 'User authentication on checkout',
                        recommendationReason: 'Prevents checkout hijacking and unauthenticated order submission.',
                        coverageGapAddressed: 'REQ_001 is completely untested.',
                        preconditions: 'User token expired 10 minutes prior.',
                        steps: ['Attempt guest checkout with stale session', 'Click finalize order'],
                        expectedResult: 'Session renewal prompted, unauthenticated checkout prevented.',
                        testData: 'Expired JWT token'
                    }
                ]
            });
        };

        try {
            const res = await smartRecommendationsService.generateRecommendations({
                suiteId: testSuiteId,
                userId: testUserId,
                limit: 5
            });

            assert.strictEqual(res.recommendations.length, 3);

            // Verify duplicate detection flagged recommendation #2
            const duplicateRec = res.recommendations.find(r => r.title.includes('Verify successful checkout with valid Visa credit card'));
            assert.ok(duplicateRec.isDuplicate, 'Expected identical scenario to be flagged as isDuplicate = true');
            assert.strictEqual(duplicateRec.coverageStatus, 'Potential Duplicate');

            // Verify unique negative recommendation
            const negativeRec = res.recommendations.find(r => r.category === 'Negative');
            assert.ok(!negativeRec.isDuplicate);
            assert.strictEqual(negativeRec.priority, 'High');
            assert.strictEqual(negativeRec.status, 'pending');

            // Verify persistence in session
            const stored = await supabaseService.getRecommendationSessionBySuite(testSuiteId, testUserId);
            assert.ok(stored);
            assert.strictEqual(stored.recommendations.length, 3);
        } finally {
            aiService.callAI = originalCallAI;
        }
    });

    it('5. should allow updating recommendation status (accept, reject) and editing fields', async () => {
        const stored = await supabaseService.getRecommendationSessionBySuite(testSuiteId, testUserId);
        assert.ok(stored && stored.recommendations.length > 0);
        const targetRec = stored.recommendations.find(r => !r.isDuplicate);

        // Accept recommendation
        const accepted = await smartRecommendationsService.updateRecommendationStatus(targetRec.id, testUserId, {
            status: 'accepted'
        });
        assert.strictEqual(accepted.status, 'accepted');

        // Edit recommendation fields
        const edited = await smartRecommendationsService.updateRecommendationStatus(targetRec.id, testUserId, {
            editedFields: {
                title: 'Customized title for declined card test',
                priority: 'Critical'
            }
        });
        assert.strictEqual(edited.title, 'Customized title for declined card test');
        assert.strictEqual(edited.priority, 'Critical');
    });

    it('6. should convert accepted recommendation into a Draft test case in the suite', async () => {
        const stored = await supabaseService.getRecommendationSessionBySuite(testSuiteId, testUserId);
        const targetRec = stored.recommendations.find(r => !r.isDuplicate);

        // Convert to draft
        const convertRes = await smartRecommendationsService.convertRecommendationsToDraftCases({
            suiteId: testSuiteId,
            userId: testUserId,
            recommendationIds: [targetRec.id]
        });

        assert.strictEqual(convertRes.convertedCount, 1);
        assert.strictEqual(convertRes.results[0].success, true);
        const newCase = convertRes.draftCases[0];

        // Strict 13-field checks
        assert.ok(newCase.id.startsWith('TC_'));
        assert.strictEqual(newCase.status, 'Draft', 'Converted recommendation must strictly be Draft status');
        assert.strictEqual(newCase.title, 'Customized title for declined card test');
        assert.strictEqual(newCase.actualResult, 'Not yet executed');
        assert.strictEqual(newCase._source, 'smart_recommendation');

        // Verify suiteData in database received the new case
        const updatedSession = await supabaseService.getSession(testSuiteId, testUserId);
        const suiteCases = smartRecommendationsService.extractSuiteTestCases(updatedSession);
        assert.strictEqual(suiteCases.length, 2, 'Suite should now have 2 test cases');

        // Verify recommendation status is now 'converted'
        const recAfter = await supabaseService.getRecommendation(targetRec.id, testUserId);
        assert.strictEqual(recAfter.status, 'converted');
        assert.strictEqual(recAfter.convertedTestCaseId, newCase.id);

        // Verify duplicate conversion is prevented
        const secondConvert = await smartRecommendationsService.convertRecommendationsToDraftCases({
            suiteId: testSuiteId,
            userId: testUserId,
            recommendationIds: [targetRec.id]
        });
        assert.strictEqual(secondConvert.convertedCount, 0);
        assert.strictEqual(secondConvert.results[0].success, false);
    });

    it('7. should enforce workspace isolation and reject unauthorized access', async () => {
        const unauthorizedUserId = 'attacker_user_999';

        await assert.rejects(async () => {
            await smartRecommendationsService.generateRecommendations({
                suiteId: testSuiteId,
                userId: unauthorizedUserId
            });
        }, /not found or access denied/i);

        const stored = await supabaseService.getRecommendationSessionBySuite(testSuiteId, testUserId);
        const targetRec = stored.recommendations[0];

        await assert.rejects(async () => {
            await smartRecommendationsService.updateRecommendationStatus(targetRec.id, unauthorizedUserId, {
                status: 'accepted'
            });
        }, /access denied/i);
    });

    it('8. should test controller endpoints with mock req/res', async () => {
        const recommendationsController = require('../src/controllers/recommendations.controller');

        const mockReq = (body = {}, params = {}, query = {}, userId = testUserId) => ({
            user: { id: userId, _id: userId },
            body,
            params,
            query
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

        // A. Test missing suiteId in generate
        const res1 = mockRes();
        await recommendationsController.generateRecommendations(mockReq({}), res1);
        assert.strictEqual(res1.statusCode, 400);
        assert.strictEqual(res1.body.code, 'MISSING_PARAM');

        // B. Test getSuiteRecommendations
        const res2 = mockRes();
        await recommendationsController.getSuiteRecommendations(mockReq({}, { suiteId: testSuiteId }), res2);
        assert.strictEqual(res2.statusCode, 200);
        assert.strictEqual(res2.body.success, true);
        assert.ok(res2.body.data);

        // C. Test invalid status enum in update
        const stored = await supabaseService.getRecommendationSessionBySuite(testSuiteId, testUserId);
        const rec = stored.recommendations[0];
        const res3 = mockRes();
        await recommendationsController.updateRecommendation(mockReq({ status: 'INVALID_STATUS' }, { id: rec.id }), res3);
        assert.strictEqual(res3.statusCode, 400);
        assert.strictEqual(res3.body.code, 'INVALID_STATUS');

        // D. Test valid status update
        const res4 = mockRes();
        await recommendationsController.updateRecommendation(mockReq({ status: 'rejected' }, { id: rec.id }), res4);
        assert.strictEqual(res4.statusCode, 200);
        assert.strictEqual(res4.body.data.status, 'rejected');

        // E. Test convertToDrafts validation
        const res5 = mockRes();
        await recommendationsController.convertToDrafts(mockReq({ suiteId: testSuiteId, recommendationIds: [] }), res5);
        assert.strictEqual(res5.statusCode, 400);
        assert.strictEqual(res5.body.code, 'INVALID_REQUEST');
    });
});
