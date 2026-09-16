const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const copilotService = require('../src/services/copilot.service');
const copilotController = require('../src/controllers/copilot.controller');
const { copilotRateLimiter } = require('../src/middleware/rateLimiter.middleware');

// Helper to mock Express req / res
const createMockRes = () => {
    const res = {
        statusCode: 200,
        headers: {},
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        setHeader(name, val) {
            this.headers[name] = val;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        }
    };
    return res;
};

test('QA Copilot Backend Architecture & Authorization Suite', async (t) => {
    const mockSuite = {
        title: 'Payment Processing with 3D Secure',
        requirement: 'Process credit card transactions using 3D Secure 2.0 authentication. Require billing address verification and cardholder challenge for transactions over $100.',
        feature: 'Payment Processing with 3D Secure',
        functional: [
            {
                id: 'TC-001',
                title: 'Successful 3D Secure Credit Card Payment',
                type: 'Functional',
                priority: 'High',
                steps: [{ action: 'Submit valid card details and complete 3DS challenge', expected: 'Payment authorized and receipt returned' }],
                expectedResult: 'Transaction processed successfully'
            }
        ],
        negative: [
            {
                id: 'TC-002',
                title: 'Invalid CVV Rejection',
                type: 'Negative',
                priority: 'High',
                steps: [{ action: 'Submit card with incorrect CVV', expected: 'Error code ERR_INVALID_CVV returned' }],
                expectedResult: 'Transaction rejected'
            }
        ],
        edge: [
            {
                id: 'TC-003',
                title: 'Zero Dollar Card Verification Auth Hold',
                type: 'Edge Case',
                priority: 'Medium',
                steps: [{ action: 'Initiate $0 auth hold verification', expected: 'Temporary auth token issued' }],
                expectedResult: 'Card verification passes'
            }
        ],
        quality: {
            coverageConfidence: 94,
            ambiguityScore: 'Low'
        }
    };

    await t.test('1. Grounded context extraction isolates targeted data', async () => {
        const context = copilotService.buildAnalysisContext({
            suiteData: mockSuite,
            requirement: mockSuite.requirement,
            testCaseId: 'TC-001',
            action: 'review_test_case',
            contextScope: 'test_case'
        });

        assert.equal(context.suiteTitle, 'Payment Processing with 3D Secure');
        assert.equal(context.totalCount, 3);
        assert.equal(context.targetTest.id, 'TC-001');
        assert.match(context.scopedContent, /TARGET TEST CASE:/);
        assert.match(context.scopedContent, /TC-001/);
    });

    await t.test('2. Deterministic analysis generates structured QA output (not chat bubbles)', async () => {
        const result = await copilotService.runCopilotAnalysis({
            suiteData: mockSuite,
            requirement: mockSuite.requirement,
            testCaseId: 'TC-001',
            action: 'review_test_case',
            contextScope: 'test_case'
        });

        assert.equal(result.success, true);
        assert.ok(result.data.title);
        assert.ok(result.data.summary);
        assert.ok(Array.isArray(result.data.findings));
        assert.ok(result.data.findings.length > 0);
        assert.ok(result.data.findings[0].severity);
        assert.ok(result.data.findings[0].whyItMatters);
        assert.ok(result.data.proposedImprovement);
        assert.equal(result.data.proposedImprovement.testCaseId, 'TC-001');
    });

    await t.test('3. Security analysis identifies unaddressed boundaries and suggests structured test', async () => {
        const result = await copilotService.runCopilotAnalysis({
            suiteData: mockSuite,
            requirement: mockSuite.requirement,
            action: 'analyze_security',
            contextScope: 'risks'
        });

        assert.equal(result.success, true);
        assert.ok(result.data.suggestedTests.length > 0);
        const suggested = result.data.suggestedTests[0];
        assert.equal(suggested.type, 'Security');
        assert.ok(suggested.title);
        assert.ok(suggested.steps.length > 0);
        assert.ok(suggested.expectedResult);
    });

    await t.test('4. Cross-user test suite access is strictly DENIED', async () => {
        const req = {
            user: { _id: '507f191e810c19729de860ea', id: '507f191e810c19729de860ea' },
            body: {
                testSuiteId: '000000000000000000000000', // Non-existent or unauthorized suite
                action: 'review_coverage'
            }
        };
        const res = createMockRes();

        await copilotController.analyzeSuite(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'SUITE_NOT_FOUND_OR_DENIED');
    });

    await t.test('5. Rate limiter rejects requests exceeding limit with 429 and Retry-After', async () => {
        const testUser = 'user_rate_limit_test_' + Date.now();
        let wasRejected = false;
        let retryAfterVal = null;

        for (let i = 0; i < 45; i++) {
            const req = {
                user: { id: testUser },
                ip: '127.0.0.1'
            };
            const res = createMockRes();
            let nextCalled = false;

            copilotRateLimiter(req, res, () => { nextCalled = true; });

            if (!nextCalled) {
                if (res.statusCode === 429) {
                    wasRejected = true;
                    retryAfterVal = res.headers['Retry-After'];
                    break;
                }
            }
        }

        assert.equal(wasRejected, true, 'Rate limiter must enforce limit and return 429');
        assert.ok(retryAfterVal !== null, 'Rate limiter must set Retry-After header');
    });

    await t.test('6. Add suggested test case endpoint marks metadata with copilot source', async () => {
        const req = {
            user: { id: 'test_user_guest' },
            body: {
                testCase: {
                    title: 'Enforce rate limiting on repeated reset dispatches',
                    type: 'Security',
                    priority: 'High',
                    steps: [{ action: 'Dispatch 6 requests', expected: '6th request throttled' }],
                    expectedResult: 'HTTP 429 returned'
                }
            }
        };
        const res = createMockRes();

        await copilotController.addSuggestedtestCase(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.testCase.source, 'copilot');
        assert.equal(res.data.data.testCase.generatedBy, 'copilot');
        assert.equal(res.data.data.testCase.title, 'Enforce rate limiting on repeated reset dispatches');
    });
});
