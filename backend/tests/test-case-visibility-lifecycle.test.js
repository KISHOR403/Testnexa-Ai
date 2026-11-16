const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const supabaseService = require('../src/services/supabaseData.service');
const testCaseController = require('../src/controllers/testCase.controller');
const {
    isValidGeneratedTestCase,
    isEligibleGeneratedSuite,
    extractValidTestCasesFromSession
} = require('../src/utils/testCaseManagement.validation');

const createMockRes = () => {
    const res = {
        statusCode: 200,
        headers: {},
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        },
        setHeader(k, v) {
            this.headers[k] = v;
        }
    };
    return res;
};

describe('Test Case Visibility & Generation Lifecycle Verification', () => {
    const runSuffix = Date.now();
    const userA = 'user-lifecycle-a-' + runSuffix;
    const userB = 'user-lifecycle-b-' + runSuffix;
    let draftSessionId = null;
    let processingSessionId = null;
    let failedSessionId = null;
    let generatedSessionId = null;
    let runId = null;

    before(async () => {
        // Enforce resilient disk/in-memory mode for standalone testing
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;
    });

    it('Scenario 1: Save a requirement draft — it is rejected by database guard and cannot appear in Test Cases', async () => {
        // User saves requirement draft in AI Workspace -> Database Guard blocks 0-case drafts
        let guardError = null;
        try {
            await supabaseService.createSession({
                userId: userA,
                title: 'Draft Checkout Requirement',
                requirement: 'Customers can add items to cart, enter shipping address, and choose delivery speed.',
                context: 'web',
                depth: 'Standard',
                status: 'Draft',
                suiteData: {}, // Empty suite data
                summary: { total: 0 }
            });
        } catch (err) {
            guardError = err;
        }

        assert.ok(guardError, 'Database guard must reject drafts with 0 test cases');
        assert.equal(guardError.code, 'ZERO_TEST_CASES');

        // Verify via API controller
        const req = { user: { _id: userA, id: userA }, query: {} };
        const res = createMockRes();
        await testCaseController.listTestCases(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.length, 0, 'No test cases should be returned');
        assert.equal(res.data.suites.length, 0, 'Draft session should not appear in suite tree');
        assert.equal(res.data.summary.total, 0);
    });

    it('Scenario 2: Start AI generation — 0-case processing session is rejected by database guard', async () => {
        let guardError = null;
        try {
            await supabaseService.createSession({
                userId: userA,
                title: 'Processing AI Generation Suite',
                requirement: 'AI is currently analyzing requirements and generating test specifications.',
                status: 'Processing',
                suiteData: {},
                summary: { total: 0 }
            });
        } catch (err) {
            guardError = err;
        }

        assert.ok(guardError, 'Database guard must reject processing sessions with 0 test cases');

        const req = { user: { _id: userA, id: userA }, query: {} };
        const res = createMockRes();
        await testCaseController.listTestCases(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.length, 0, 'Processing generation session must not appear in test cases');
    });

    it('Scenario 3: Generation fails — failed session with 0 cases is rejected by database guard', async () => {
        let guardError = null;
        try {
            await supabaseService.createSession({
                userId: userA,
                title: 'Failed Generation Suite',
                requirement: 'Requirement that failed during AI synthesis.',
                status: 'Failed',
                suiteData: {},
                summary: { total: 0 }
            });
        } catch (err) {
            guardError = err;
        }

        assert.ok(guardError, 'Database guard must reject failed session with 0 test cases');

        const req = { user: { _id: userA, id: userA }, query: {} };
        const res = createMockRes();
        await testCaseController.listTestCases(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.length, 0, 'No test cases should appear from failed generation');
    });

    it('Scenario 4: Generation succeeds and valid test cases are persisted — they MUST appear', async () => {
        const generatedSession = await supabaseService.createSession({
            userId: userA,
            title: 'E-Commerce Payment Suite',
            requirement: 'User can complete payment via credit card or PayPal.',
            context: 'web',
            depth: 'Standard',
            status: 'NeedsReview',
            suiteData: {
                testSuiteName: 'E-Commerce Payment Suite',
                feature: 'Payment Processing',
                functional: [
                    {
                        id: 'TC_PAY_001',
                        title: 'Successful credit card payment',
                        type: 'Functional',
                        priority: 'Critical',
                        lifecycle: 'needs-review',
                        status: 'NeedsReview',
                        executionMethod: 'Manual',
                        requirementId: 'REQ-PAY-01',
                        preconditions: ['User is on checkout step 3', 'Cart total is $49.99'],
                        steps: [
                            { step: 1, action: 'Select Credit Card payment option', expected: 'Card input fields displayed' },
                            { step: 2, action: 'Enter valid card credentials and click Pay Now', expected: 'Processing spinner shown' }
                        ],
                        expectedResult: 'Payment is confirmed and Order Confirmation page renders with receipt.'
                    }
                ],
                negative: [
                    {
                        id: 'TC_PAY_002',
                        title: 'Declined card with invalid CVV displays error',
                        type: 'Negative',
                        priority: 'High',
                        lifecycle: 'needs-review',
                        status: 'NeedsReview',
                        executionMethod: 'Manual',
                        requirementId: 'REQ-PAY-02',
                        preconditions: ['User on payment page'],
                        steps: [
                            { step: 1, action: 'Enter valid card number and expired/invalid CVV', expected: 'CVV field validation triggers' }
                        ],
                        expectedResult: 'Transaction is rejected with descriptive error message.'
                    }
                ],
                edge: [
                    {
                        id: 'TC_PAY_003',
                        title: 'Zero dollar promotion voucher checkout',
                        type: 'Edge',
                        priority: 'Medium',
                        lifecycle: 'needs-review',
                        status: 'NeedsReview',
                        executionMethod: 'Manual',
                        preconditions: ['100% discount coupon applied'],
                        steps: [
                            { step: 1, action: 'Click Complete Free Order', expected: 'Bypasses payment gateway' }
                        ],
                        expectedResult: 'Order completes without charging any credit card.'
                    }
                ]
            },
            summary: { total: 3, functional: 1, negative: 1, edge: 1, highPriority: 2 }
        });
        generatedSessionId = generatedSession.id;

        assert.equal(isEligibleGeneratedSuite(generatedSession), true, 'Successfully generated session must be eligible');

        const req = { user: { _id: userA, id: userA }, query: {} };
        const res = createMockRes();
        await testCaseController.listTestCases(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.length, 3, 'Must return all 3 successfully generated test cases');
        assert.equal(res.data.summary.total, 3);
        assert.equal(res.data.summary.needsReview, 3);

        const tc1 = res.data.data.find(c => c.id === 'TC_PAY_001');
        assert.ok(tc1);
        assert.equal(tc1.title, 'Successful credit card payment');
        assert.equal(tc1.priority, 'Critical');
        assert.equal(tc1.type, 'Functional');
        assert.equal(tc1.steps.length, 2);
    });

    it('Scenario 5: Generated test case is never executed — it must still appear with Not Executed', async () => {
        const req = { user: { _id: userA, id: userA }, query: { suiteId: generatedSessionId } };
        const res = createMockRes();
        await testCaseController.listTestCases(req, res);

        assert.equal(res.statusCode, 200);
        const tc1 = res.data.data.find(c => c.id === 'TC_PAY_001');
        assert.ok(tc1, 'Unexecuted test case must be visible');
        assert.equal(tc1.executionStatus, 'not_executed', 'Execution status must be strictly not_executed');
        assert.equal(tc1.latestExecution, null);
        assert.notEqual(tc1.executionStatus, 'passed', 'Must NEVER be automatically marked as passed');
        assert.equal(res.data.summary.notExecuted, 3);
    });

    it('Scenario 6: Generated test case is approved — it must remain visible with approved/ready status', async () => {
        // User approves test case TC_PAY_001
        const currentSession = await supabaseService.getSession(generatedSessionId, userA);
        const updatedSuiteData = {
            ...currentSession.suiteData,
            functional: currentSession.suiteData.functional.map(c =>
                c.id === 'TC_PAY_001' ? { ...c, lifecycle: 'ready', status: 'Ready' } : c
            )
        };
        await supabaseService.updateSession(generatedSessionId, userA, {
            suiteData: updatedSuiteData,
            status: 'Ready'
        });

        const req = { user: { _id: userA, id: userA }, query: { suiteId: generatedSessionId } };
        const res = createMockRes();
        await testCaseController.listTestCases(req, res);

        assert.equal(res.statusCode, 200);
        const tc1 = res.data.data.find(c => c.id === 'TC_PAY_001');
        assert.ok(tc1, 'Approved test case must remain visible');
        assert.equal(tc1.lifecycle, 'ready', 'Lifecycle should be ready/approved');
        assert.equal(tc1.executionStatus, 'not_executed', 'Execution status remains independent not_executed');
        assert.equal(res.data.summary.ready, 1);
        assert.equal(res.data.summary.needsReview, 2);
    });

    it('Scenario 7: Generated test case is manually executed — its execution status updates to Passed', async () => {
        // Create execution run for the generated suite
        const runPayload = {
            suiteId: generatedSessionId,
            userId: userA,
            workspaceId: 'ws-lifecycle-a',
            name: 'Manual Sanity Run #1',
            status: 'completed',
            executionType: 'manual',
            completedAt: new Date().toISOString()
        };
        const createdRun = await supabaseService.createTestRun(runPayload);
        runId = createdRun.id;

        // Execute TC_PAY_001 with 'passed' verdict
        const targetRunCase = createdRun.cases.find(c => c.testCaseId === 'TC_PAY_001');
        assert.ok(targetRunCase, 'Run case for TC_PAY_001 must exist');
        await supabaseService.updateRunCase(targetRunCase.id, {
            status: 'passed',
            actual_result: 'Order confirmation receipt rendered with zero errors',
            duration_ms: 4200,
            executed_at: new Date().toISOString()
        });

        const req = { user: { _id: userA, id: userA }, query: { suiteId: generatedSessionId } };
        const res = createMockRes();
        await testCaseController.listTestCases(req, res);

        assert.equal(res.statusCode, 200);
        const tc1 = res.data.data.find(c => c.id === 'TC_PAY_001');
        assert.ok(tc1);
        assert.equal(tc1.executionStatus, 'passed', 'Execution status must update to passed after run');
        assert.ok(tc1.latestExecution);
        assert.equal(tc1.latestExecution.status, 'passed');

        // Other test cases in the suite remain not_executed
        const tc2 = res.data.data.find(c => c.id === 'TC_PAY_002');
        assert.equal(tc2.executionStatus, 'not_executed');

        assert.equal(res.data.summary.passed, 1);
        assert.equal(res.data.summary.notExecuted, 2);
    });

    it('Scenario 8: A suite is successfully generated in one transaction — only the resulting valid test cases become visible', async () => {
        // Successful generation creates a suite with valid cases in one atomic write
        const checkoutSuite = await supabaseService.createSession({
            userId: userA,
            status: 'active',
            title: 'Generated Checkout Suite',
            requirement: 'Checkout flow specifications with delivery options',
            suiteData: {
                testSuiteName: 'Generated Checkout Suite',
                feature: 'Checkout Flow',
                functional: [
                    {
                        id: 'TC_CHK_001',
                        title: 'Delivery speed options calculate correct surcharge',
                        type: 'Functional',
                        priority: 'High',
                        lifecycle: 'needs-review',
                        status: 'NeedsReview',
                        steps: [{ step: 1, action: 'Select Next Day Express', expected: 'Cart total increases by $15.00' }],
                        expectedResult: 'Express shipping cost is accurately added.'
                    }
                ]
            },
            summary: { total: 1, functional: 1 }
        });
        assert.ok(checkoutSuite);
        const checkoutSessionId = checkoutSuite.id;

        const req = { user: { _id: userA, id: userA }, query: {} };
        const res = createMockRes();
        await testCaseController.listTestCases(req, res);

        assert.equal(res.statusCode, 200);
        // Total valid cases now: 3 (from Payment Suite) + 1 (from newly generated Checkout Suite) = 4
        assert.equal(res.data.data.length, 4, 'Valid test cases now appear once generated');
        const newlyGenerated = res.data.data.find(c => c.id === 'TC_CHK_001');
        assert.ok(newlyGenerated, 'Newly generated test case must be visible');
        assert.equal(newlyGenerated.suiteId, checkoutSessionId);
        assert.equal(newlyGenerated.executionStatus, 'not_executed');
    });

    it('Disqualifies incomplete, empty, or placeholder test case records', () => {
        assert.equal(isValidGeneratedTestCase(null), false);
        assert.equal(isValidGeneratedTestCase({}), false);
        assert.equal(isValidGeneratedTestCase({ id: '' }), false);
        assert.equal(isValidGeneratedTestCase({ id: 'temp', title: 'temp' }), false);
        assert.equal(isValidGeneratedTestCase({ id: 'placeholder', title: 'placeholder' }), false);
        assert.equal(isValidGeneratedTestCase({ id: 'TC-01', title: '' }), false);
        assert.equal(isValidGeneratedTestCase({ id: 'TC-01', title: 'Untitled' }), false);
        assert.equal(isValidGeneratedTestCase({ id: 'TC-01', title: 'Valid Scenario', steps: [], expectedResult: '' }), false);

        assert.equal(isValidGeneratedTestCase({
            id: 'TC-VALID-01',
            title: 'Verify secure authentication session expiry',
            steps: [{ step: 1, action: 'Wait 15 minutes', expected: 'Token expires' }],
            expectedResult: 'Session times out and login screen prompts user'
        }), true);
    });

    it('Multi-tenant isolation: User B cannot see User A generated test cases', async () => {
        const reqB = { user: { _id: userB, id: userB }, query: {} };
        const resB = createMockRes();
        await testCaseController.listTestCases(reqB, resB);

        assert.equal(resB.statusCode, 200);
        assert.equal(resB.data.success, true);
        assert.equal(resB.data.data.length, 0, 'User B must see 0 test cases');
        assert.equal(resB.data.suites.length, 0, 'User B must see 0 suites');
        assert.equal(resB.data.summary.total, 0);
    });
});
