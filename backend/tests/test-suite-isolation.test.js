const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const AuthSession = require('../src/models/authSession.model');
const WorkspaceSession = require('../src/models/workspaceSession.model');
const TestHistory = require('../src/models/testHistory.model');
const authController = require('../src/controllers/auth.controller');
const sessionController = require('../src/controllers/session.controller');
const { getTestHistory } = require('../src/controllers/generate.controller');
const { protect } = require('../src/middleware/auth.middleware');

// Helper to mock Express req / res
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

// Connect to MongoDB before tests
test.before(async () => {
    if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });
    }
});

// Clean up test data after tests
test.after(async () => {
    await User.deleteMany({ email: /isolation_.*@example\.com/ });
    await AuthSession.deleteMany({ userAgent: /IsolationTestAgent/ });
    await WorkspaceSession.deleteMany({ title: /Isolation Test/ });
    await TestHistory.deleteMany({ feature: /Isolation Test/ });
    await mongoose.disconnect();
});

test('Multi-User Test Suite & Workspace Data Isolation Suite', async (t) => {
    const timestamp = Date.now();
    const emailA = `isolation_user_a_${timestamp}@example.com`;
    const emailB = `isolation_user_b_${timestamp}@example.com`;

    let userA, userB;
    let tokenA, tokenB;
    let suiteAId;

    await t.test('1. Unauthenticated requests are rejected with 401', async () => {
        const req = {
            headers: {},
            params: {},
            query: {},
            body: {}
        };
        const res = createMockRes();
        let nextCalled = false;

        await protect(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, false, 'protect must not call next() for unauthenticated requests');
        assert.equal(res.statusCode, 401, 'Response status must be 401');
        assert.equal(res.data.success, false);
    });

    await t.test('2. Register User A and User B with independent credentials', async () => {
        // Register User A
        const reqA = {
            body: { name: 'User A', email: emailA, password: 'PasswordA123!' },
            headers: { 'user-agent': 'IsolationTestAgent', 'x-forwarded-for': '127.0.0.1' },
            ip: '127.0.0.1'
        };
        const resA = createMockRes();
        await authController.register(reqA, resA);
        assert.equal(resA.statusCode, 201);
        tokenA = resA.data.token;
        userA = await User.findOne({ email: emailA });
        assert.ok(userA, 'User A must exist in database');

        // Register User B
        const reqB = {
            body: { name: 'User B', email: emailB, password: 'PasswordB123!' },
            headers: { 'user-agent': 'IsolationTestAgent', 'x-forwarded-for': '127.0.0.1' },
            ip: '127.0.0.1'
        };
        const resB = createMockRes();
        await authController.register(reqB, resB);
        assert.equal(resB.statusCode, 201);
        tokenB = resB.data.token;
        userB = await User.findOne({ email: emailB });
        assert.ok(userB, 'User B must exist in database');
    });

    await t.test('3. Brand new User B has ZERO test suites initially (empty workspace)', async () => {
        const req = {
            user: userB,
            query: {}
        };
        const res = createMockRes();
        await sessionController.listSessions(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.length, 0, 'New user workspace must have 0 test suites');
    });

    await t.test('4. User A creates Test Suite A (server-side ownership assigned)', async () => {
        const req = {
            user: userA,
            body: {
                title: 'Isolation Test Suite A — Password Recovery Flow',
                requirement: 'Users can reset their password securely via single-use email token.',
                context: 'web',
                depth: 'Standard'
            }
        };
        const res = createMockRes();
        await sessionController.createSession(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.data.success, true);
        assert.ok(res.data.data._id);
        suiteAId = res.data.data._id.toString();

        // Update with full suiteData simulation
        await WorkspaceSession.findByIdAndUpdate(suiteAId, {
            status: 'Generated',
            suiteData: {
                testSuiteName: 'Isolation Test Suite A — Password Recovery Flow',
                feature: 'Password Recovery Flow',
                functional: [
                    { id: 'TC-001', title: 'Submit valid email', priority: 'High', severity: 'Critical' }
                ],
                negative: [
                    { id: 'TC-002', title: 'Expired token redemption', priority: 'High', severity: 'Critical' }
                ],
                edge: [],
                nonFunctional: []
            },
            summary: { total: 2, functional: 1, negative: 1, edge: 0, nonFunctional: 0, highPriority: 2 }
        });

        const createdSuite = await WorkspaceSession.findById(suiteAId);
        assert.equal(createdSuite.userId.toString(), userA._id.toString(), 'Suite A must strictly belong to User A');
    });

    await t.test('5. User B lists test suites — User B MUST NOT see Suite A', async () => {
        const req = {
            user: userB,
            query: {}
        };
        const res = createMockRes();
        await sessionController.listSessions(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.length, 0, 'User B must see 0 suites, never User A suite');
        const found = res.data.data.some(s => s._id.toString() === suiteAId);
        assert.equal(found, false, 'User A suite must not leak into User B list query');
    });

    await t.test('6. User B attempts direct GET of Suite A — returns 404 Access Denied', async () => {
        const req = {
            user: userB,
            params: { id: suiteAId }
        };
        const res = createMockRes();
        await sessionController.getSession(req, res);

        assert.equal(res.statusCode, 404, 'Must return 404 when querying another user suite');
        assert.equal(res.data.success, false);
        assert.equal(res.data.message, 'Session not found');
    });

    await t.test('7. User B attempts PATCH to modify Suite A — returns 404 Access Denied', async () => {
        const req = {
            user: userB,
            params: { id: suiteAId },
            body: { title: 'Hacked by User B' }
        };
        const res = createMockRes();
        await sessionController.updateSession(req, res);

        assert.equal(res.statusCode, 404, 'Must return 404 when modifying another user suite');
        assert.equal(res.data.success, false);

        // Verify Suite A was NOT modified
        const freshSuiteA = await WorkspaceSession.findById(suiteAId);
        assert.equal(freshSuiteA.title, 'Isolation Test Suite A — Password Recovery Flow');
    });

    await t.test('8. User B attempts DELETE of Suite A — returns 404 and does NOT delete Suite A', async () => {
        const req = {
            user: userB,
            params: { id: suiteAId }
        };
        const res = createMockRes();
        await sessionController.deleteSession(req, res);

        assert.equal(res.statusCode, 404, 'Must return 404 when deleting another user suite');
        assert.equal(res.data.success, false);

        // Verify Suite A is still intact in the database
        const freshSuiteA = await WorkspaceSession.findById(suiteAId);
        assert.ok(freshSuiteA, 'Suite A must remain in database unharmed');
    });

    await t.test('9. User A requests GET of Suite A — successfully returned', async () => {
        const req = {
            user: userA,
            params: { id: suiteAId }
        };
        const res = createMockRes();
        await sessionController.getSession(req, res);

        assert.equal(res.statusCode, 200, 'Owner User A must be allowed to retrieve Suite A');
        assert.equal(res.data.success, true);
        assert.equal(res.data.data._id.toString(), suiteAId);
        assert.equal(res.data.data.title, 'Isolation Test Suite A — Password Recovery Flow');
    });

    await t.test('10. Client cannot forge ownership by sending userId in request body', async () => {
        const req = {
            user: userB,
            body: {
                userId: userA._id.toString(), // Forged owner attempt
                title: 'Isolation Test — Forgery Attempt',
                requirement: 'Attempt to forge ownership'
            }
        };
        const res = createMockRes();
        await sessionController.createSession(req, res);

        assert.equal(res.statusCode, 201);
        const createdId = res.data.data._id;
        const createdSession = await WorkspaceSession.findById(createdId);

        // Must belong to User B (the authenticated user), NOT the forged User A
        assert.equal(
            createdSession.userId.toString(),
            userB._id.toString(),
            'Backend must bind ownership strictly to authenticated user, ignoring client userId'
        );
    });

    await t.test('11. Test History queries are strictly isolated per user', async () => {
        // Create history for User A
        await TestHistory.create({
            userId: userA._id,
            requirement: 'Isolation Test Requirement A',
            appType: 'web',
            detailLevel: 'standard',
            feature: 'Isolation Test Feature A',
            data: { functional: [] }
        });

        // User B queries history
        const reqB = {
            user: userB,
            query: {}
        };
        const resB = createMockRes();
        await getTestHistory(reqB, resB);

        assert.equal(resB.statusCode, 200);
        assert.equal(resB.data.success, true);
        const found = resB.data.data.some(h => h.userId.toString() === userA._id.toString());
        assert.equal(found, false, 'User B must not see User A history');
    });

    await t.test('12. Live HTTP /api/v1/test-suites endpoint enforces authentication and user scoping', async () => {
        // 12a. Unauthenticated GET /api/v1/test-suites
        const unauthRes = await fetch('http://localhost:5000/api/v1/test-suites');
        assert.equal(unauthRes.status, 401, 'Unauthenticated HTTP request must return 401');

        // 12b. User A GET /api/v1/test-suites
        const userARes = await fetch('http://localhost:5000/api/v1/test-suites', {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        assert.equal(userARes.status, 200);
        const userAData = await userARes.json();
        assert.equal(userAData.success, true);
        const hasSuiteA = userAData.data.some(s => s._id === suiteAId);
        assert.equal(hasSuiteA, true, 'User A must see Suite A via /api/v1/test-suites');

        // 12c. User B GET /api/v1/test-suites
        const userBRes = await fetch('http://localhost:5000/api/v1/test-suites', {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        assert.equal(userBRes.status, 200);
        const userBData = await userBRes.json();
        assert.equal(userBData.success, true);
        const userBHasSuiteA = userBData.data.some(s => s._id === suiteAId);
        assert.equal(userBHasSuiteA, false, 'User B must NOT see Suite A via /api/v1/test-suites');

        // 12d. User B GET /api/v1/test-suites/:suiteAId
        const crossGetRes = await fetch(`http://localhost:5000/api/v1/test-suites/${suiteAId}`, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        assert.equal(crossGetRes.status, 404, 'User B accessing Suite A directly must return 404');
    });
});

