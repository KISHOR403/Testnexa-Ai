const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseService = require('../src/services/supabaseData.service');
const generateController = require('../src/controllers/generate.controller');
const sessionController = require('../src/controllers/session.controller');
const orchestrator = require('../src/services/orchestrator.service');

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

describe('TASK 3: Test Suite Integrity & Database Guard Tests', () => {
    const testUser = {
        id: 'test_user_guards_123',
        _id: 'test_user_guards_123',
        email: 'guards.test@testnexa.ai'
    };

    before(() => {
        // Run against resilient local memory/disk store to test business logic & constraints reliably
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;
        supabaseService.saveTestHistory = async () => ({ id: 'mock_hist' });
        supabaseService.findUserById = async () => null;
    });

    it('1. Row counts in the suites table are unchanged after Analyze (stateless requirement analysis)', async () => {
        const initialList = await supabaseService.listSessions({ userId: testUser.id, hasCases: false });
        const initialCount = initialList.sessions.length;

        const origUnderstand = orchestrator.understandRequirement;
        orchestrator.understandRequirement = async () => ({
            feature: 'Secure Authentication with SMS 2FA',
            business_rules: ['5 attempt lockout', 'SMS OTP valid for 5 min'],
            risk_areas: ['credential stuffing', 'session hijacking'],
            ambiguities: []
        });

        try {
            const req = {
                user: testUser,
                body: {
                    requirement: 'As a user, I want to authenticate securely with email, password, and SMS 2FA with 5 attempt lockout.',
                    appType: 'web',
                    detailLevel: 'medium'
                }
            };
            const res = createMockRes();

            await generateController.analyzeRequirement(req, res);

            assert.equal(res.statusCode, 200, 'Analyze must return 200 OK');
            assert.equal(res.data.success, true);
            assert.ok(res.data.data.feature);

            const finalList = await supabaseService.listSessions({ userId: testUser.id, hasCases: false });
            assert.equal(finalList.sessions.length, initialCount, 'Database row count MUST be identical before and after Analyze');
        } finally {
            orchestrator.understandRequirement = origUnderstand;
        }
    });

    it('2. Zero valid cases from generation returns 422 and writes nothing to the database', async () => {
        const initialList = await supabaseService.listSessions({ userId: testUser.id, hasCases: false });
        const initialCount = initialList.sessions.length;

        // Mock orchestrator to simulate returning 0 cases
        const origGenerate = orchestrator.generateTestCases;
        orchestrator.generateTestCases = async () => ({
            understanding: { feature: 'Empty Feature' },
            functional: [],
            negative: [],
            edge: [],
            security: [],
            apiChecklist: [],
            nonFunctional: [],
            quality: {},
            metadata: { totalTestCases: 0, generatedAt: new Date().toISOString() }
        });

        try {
            const req = {
                user: testUser,
                headers: {},
                body: {
                    requirement: 'A valid requirement string that happens to produce zero cases from AI model.',
                    appType: 'web',
                    detailLevel: 'medium'
                }
            };
            const res = createMockRes();

            await generateController.generateTestCases(req, res);

            assert.equal(res.statusCode, 422, 'Zero generated cases must return HTTP 422');
            assert.equal(res.data.success, false);
            assert.equal(res.data.code, 'ZERO_TEST_CASES');

            const afterList = await supabaseService.listSessions({ userId: testUser.id, hasCases: false });
            assert.equal(afterList.sessions.length, initialCount, 'No suite row may be written when generation yields zero cases');
        } finally {
            orchestrator.generateTestCases = origGenerate;
        }
    });

    it('3. Direct suite creation rejects drafts or suites with zero test cases (Constraint Trigger Guard)', async () => {
        const initialList = await supabaseService.listSessions({ userId: testUser.id, hasCases: false });
        const initialCount = initialList.sessions.length;

        // Attempt to create a suite with no test cases (draft)
        const reqDraft = {
            user: testUser,
            body: {
                title: 'Attempted Draft Suite',
                requirement: 'Draft requirement with no cases',
                status: 'Draft',
                suiteData: {}
            }
        };
        const resDraft = createMockRes();

        await sessionController.createSession(reqDraft, resDraft);

        assert.equal(resDraft.statusCode, 422, 'Attempt to create draft / 0-case suite must return 422');
        assert.equal(resDraft.data.code, 'ZERO_TEST_CASES');

        const afterList = await supabaseService.listSessions({ userId: testUser.id, hasCases: false });
        assert.equal(afterList.sessions.length, initialCount, 'Database must reject draft suite insertion');
    });

    const mockValidGeneratedSuite = () => ({
        understanding: {
            feature: 'Authentication & Checkout Flow',
            userStories: ['As a user I can login and checkout'],
            keyFlows: ['Login -> Add to Cart -> Checkout'],
            businessRules: ['Must be authenticated']
        },
        functional: [
            {
                id: 'TC-FUNC-001',
                title: 'User authenticates with valid credentials',
                description: 'Verify login succeeds with valid email and password',
                steps: ['Enter email', 'Enter password', 'Click Submit'],
                expectedResult: 'User dashboard is displayed',
                priority: 'High',
                type: 'Functional'
            },
            {
                id: 'TC-FUNC-002',
                title: 'User adds item to cart and checks out',
                description: 'Verify adding item to cart and checkout completion',
                steps: ['Search item', 'Click Add to Cart', 'Click Checkout'],
                expectedResult: 'Order confirmation displayed',
                priority: 'High',
                type: 'Functional'
            }
        ],
        negative: [
            {
                id: 'TC-NEG-001',
                title: 'User attempts login with incorrect password',
                description: 'Verify login fails with wrong password',
                steps: ['Enter email', 'Enter wrong password', 'Click Submit'],
                expectedResult: 'Error message is shown',
                priority: 'Medium',
                type: 'Negative'
            }
        ],
        edge: [
            {
                id: 'TC-EDGE-001',
                title: 'Checkout with empty cart',
                description: 'Verify checkout button disabled when cart is empty',
                steps: ['Navigate to cart'],
                expectedResult: 'Cart shows empty and checkout disabled',
                priority: 'Low',
                type: 'Edge'
            }
        ],
        security: [
            {
                id: 'TC-SEC-001',
                title: 'SQL injection attempt on login field',
                description: 'Verify sanitization of SQL injection inputs',
                steps: ["Enter ' OR 1=1 -- into username"],
                expectedResult: 'Input rejected securely',
                priority: 'Critical',
                type: 'Security'
            }
        ],
        apiChecklist: [],
        nonFunctional: [],
        quality: { score: 95 },
        metadata: { totalTestCases: 5, generatedAt: new Date().toISOString() }
    });

    it('4. Successful generation creates suite and all test cases in ONE transaction with status "active"', async () => {
        const initialList = await supabaseService.listSessions({ userId: testUser.id, hasCases: true });
        const initialCount = initialList.sessions.length;

        const origGenerate = orchestrator.generateTestCases;
        orchestrator.generateTestCases = async () => mockValidGeneratedSuite();

        try {
            const req = {
                user: testUser,
                headers: {
                    'idempotency-key': `test_idem_${Date.now()}`
                },
                body: {
                    requirement: 'As a customer, I want to search products, add items to cart, and checkout with credit card with 3DS verification.',
                    appType: 'web',
                    detailLevel: 'medium'
                }
            };
            const res = createMockRes();

            await generateController.generateTestCases(req, res);

            assert.equal(res.statusCode, 200, 'Successful generation must return 200');
            assert.equal(res.data.success, true);
            assert.ok(res.data.sessionId, 'Must return persisted suite ID');

            const createdSuite = await supabaseService.getSession(res.data.sessionId, testUser.id);
            assert.ok(createdSuite, 'Suite must be retrievable from database');
            assert.equal(createdSuite.status, 'active', 'Created suite status must strictly be "active"');
            assert.ok((createdSuite.totalCases || createdSuite.summary?.total || 0) > 0, 'Suite must contain generated test cases');

            const afterList = await supabaseService.listSessions({ userId: testUser.id, hasCases: true });
            assert.equal(afterList.sessions.length, initialCount + 1, 'Exactly one suite row added');

            // Cleanup
            await supabaseService.deleteSession(res.data.sessionId, testUser.id);
        } finally {
            orchestrator.generateTestCases = origGenerate;
        }
    });

    it('5. Double click on Generate with Idempotency-Key creates exactly ONE suite', async () => {
        const testIdemKey = `idem_double_click_${Date.now()}`;
        const initialList = await supabaseService.listSessions({ userId: testUser.id, hasCases: true });
        const initialCount = initialList.sessions.length;

        const origGenerate = orchestrator.generateTestCases;
        orchestrator.generateTestCases = async () => {
            // Slight delay simulating generation time
            await new Promise(r => setTimeout(r, 50));
            return mockValidGeneratedSuite();
        };

        try {
            const makeReq = () => ({
                user: testUser,
                headers: {
                    'idempotency-key': testIdemKey
                },
                body: {
                    requirement: 'As an administrator, I want to configure SAML SSO with Okta, manage group mappings, and enforce MFA.',
                    appType: 'web',
                    detailLevel: 'medium'
                }
            });

            // Trigger two simultaneous/rapid calls simulating a double-click
            const res1 = createMockRes();
            const res2 = createMockRes();

            await Promise.all([
                generateController.generateTestCases(makeReq(), res1),
                generateController.generateTestCases(makeReq(), res2)
            ]);

            assert.equal(res1.statusCode, 200);
            assert.equal(res2.statusCode, 200);

            // Both calls must return the identical suite ID
            const suiteId1 = res1.data.sessionId || res1.data.testSuiteId;
            const suiteId2 = res2.data.sessionId || res2.data.testSuiteId;
            assert.ok(suiteId1, 'First call returns suite ID');
            assert.equal(suiteId1, suiteId2, 'Both requests with same Idempotency-Key must resolve to the identical suite ID');

            // Database must have increased by exactly 1 suite
            const afterList = await supabaseService.listSessions({ userId: testUser.id, hasCases: true });
            assert.equal(afterList.sessions.length, initialCount + 1, 'Exactly ONE suite row was written to the database');

            // Cleanup
            await supabaseService.deleteSession(suiteId1, testUser.id);
        } finally {
            orchestrator.generateTestCases = origGenerate;
        }
    });

    it('6. Querying suites list returns only suites with at least one test case', async () => {
        // Create 1 valid suite with cases
        const validSuite = await supabaseService.createSession({
            userId: testUser.id,
            title: 'Suite With Valid Cases',
            status: 'active',
            suiteData: {
                functional: [
                    { id: 'TC-101', title: 'Verify checkout cart calculation', priority: 'High' }
                ]
            }
        });

        const listResult = await supabaseService.listSessions({ userId: testUser.id });
        assert.ok(listResult.sessions.length > 0, 'Must return at least one suite');
        assert.ok(listResult.sessions.every(s => (s.totalCases || s.summary?.total || 0) > 0), 'Every returned suite must have totalCases > 0');
        assert.ok(!listResult.sessions.some(s => s.status === 'Draft'), 'No suite with status Draft may be returned');

        // Cleanup
        await supabaseService.deleteSession(validSuite.id, testUser.id);
    });
});
