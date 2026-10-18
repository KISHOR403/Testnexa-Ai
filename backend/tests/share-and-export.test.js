const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const authController = require('../src/controllers/auth.controller');
const sessionController = require('../src/controllers/session.controller');

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

test('Share & Export Verification Test Suite', async (t) => {
    const timestamp = Date.now();
    const emailA = `share_owner_${timestamp}@example.com`;
    const emailB = `share_recipient_${timestamp}@example.com`;

    let userA, userB;
    let suiteAId;
    let shareToken;

    await t.test('1. Setup: Register Owner (User A) and Recipient (User B)', async () => {
        const reqA = {
            body: { name: 'Owner User A', email: emailA, password: 'PasswordA123!' },
            headers: { 'user-agent': 'TestAgent', 'x-forwarded-for': '127.0.0.1' },
            ip: '127.0.0.1'
        };
        const resA = createMockRes();
        await authController.register(reqA, resA);
        assert.equal(resA.statusCode, 201);
        userA = resA.data.user;

        const reqB = {
            body: { name: 'Recipient User B', email: emailB, password: 'PasswordB123!' },
            headers: { 'user-agent': 'TestAgent', 'x-forwarded-for': '127.0.0.1' },
            ip: '127.0.0.1'
        };
        const resB = createMockRes();
        await authController.register(reqB, resB);
        assert.equal(resB.statusCode, 201);
        userB = resB.data.user;
    });

    await t.test('2. Owner creates a Test Suite with test cases', async () => {
        const suiteData = {
            testSuiteName: 'Checkout & Payment Security Tests',
            feature: 'Payment Flow',
            totalTests: 3,
            testCases: [
                {
                    id: 'TC-001',
                    title: 'Valid Credit Card Transaction',
                    type: 'Functional',
                    priority: 'High',
                    preconditions: 'User is authenticated and has items in cart',
                    steps: ['Navigate to checkout', 'Enter valid card', 'Click Pay'],
                    expected: 'Payment succeeds with confirmation order ID',
                    status: 'draft'
                },
                {
                    id: 'TC-002',
                    title: 'Declined Card with Insufficient Funds',
                    type: 'Negative',
                    priority: 'High',
                    preconditions: 'Card has zero balance',
                    steps: ['Navigate to checkout', 'Enter declined card', 'Click Pay'],
                    expected: 'Error message "Insufficient funds" displayed',
                    status: 'draft'
                }
            ]
        };

        const session = await supabaseService.createSession({
            userId: userA.id,
            title: 'Checkout & Payment Security Tests',
            requirement: 'Ensure credit card checkout handles valid and declined scenarios',
            context: 'web',
            depth: 'Standard',
            suiteData,
            status: 'draft'
        });

        assert.ok(session && session.id, 'Session must be created');
        suiteAId = session.id;
    });

    await t.test('3. Generate Share Configuration with role "reviewer"', async () => {
        const req = {
            user: { id: userA.id, _id: userA.id },
            params: { id: suiteAId },
            body: { role: 'reviewer', isPublic: true }
        };
        const res = createMockRes();
        await sessionController.createShare(req, res);

        assert.equal(res.statusCode, 200, 'Share creation must succeed');
        assert.equal(res.data.success, true);
        assert.ok(res.data.data.shareToken, 'Share token must be generated');
        assert.equal(res.data.data.role, 'reviewer');
        assert.equal(res.data.data.status, 'active');
        shareToken = res.data.data.shareToken;
    });

    await t.test('4. Recipient User B accesses shared suite via share token', async () => {
        const req = {
            user: { id: userB.id, _id: userB.id },
            params: { id: suiteAId },
            query: { token: shareToken }
        };
        const res = createMockRes();
        await sessionController.getSession(req, res);

        assert.equal(res.statusCode, 200, 'User B must be allowed to view suite via valid share token');
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.id, suiteAId);
        assert.equal(res.data.data.accessRole, 'reviewer');
        assert.equal(res.data.data.isShared, true);
        assert.ok(Array.isArray(res.data.data.suiteData.testCases));
        assert.equal(res.data.data.suiteData.testCases.length, 2);
    });

    await t.test('5. Unauthenticated Guest accesses shared suite in fresh session', async () => {
        const req = {
            user: null, // No user session
            params: { id: suiteAId },
            query: { token: shareToken }
        };
        const res = createMockRes();
        await sessionController.getSession(req, res);

        assert.equal(res.statusCode, 200, 'Unauthenticated guest with share token must access public shared suite');
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.accessRole, 'reviewer');
        assert.equal(res.data.data.isShared, true);
    });

    await t.test('6. Reviewer role can update approval status', async () => {
        const req = {
            user: { id: userB.id, _id: userB.id },
            params: { id: suiteAId },
            query: { token: shareToken },
            body: { status: 'approved' }
        };
        const res = createMockRes();
        await sessionController.updateSession(req, res);

        assert.equal(res.statusCode, 200, 'Reviewer must be allowed to update approval status');
        assert.equal(res.data.success, true);
    });

    await t.test('7. Update share role to "viewer" and verify read-only enforcement', async () => {
        // Owner updates role to viewer
        const updateRoleReq = {
            user: { id: userA.id, _id: userA.id },
            params: { id: suiteAId },
            body: { role: 'viewer', isPublic: true }
        };
        const updateRoleRes = createMockRes();
        await sessionController.createShare(updateRoleReq, updateRoleRes);
        assert.equal(updateRoleRes.statusCode, 200);

        // Viewer attempts to update status -> MUST be rejected with 403
        const modifyReq = {
            user: { id: userB.id, _id: userB.id },
            params: { id: suiteAId },
            query: { token: shareToken },
            body: { status: 'draft' }
        };
        const modifyRes = createMockRes();
        await sessionController.updateSession(modifyReq, modifyRes);

        assert.equal(modifyRes.statusCode, 403, 'Viewer must be denied edit access with 403');
        assert.equal(modifyRes.data.code, 'PERMISSION_DENIED');
    });

    await t.test('8. Private suite without share token rejects unauthorized User B with 404', async () => {
        const req = {
            user: { id: userB.id, _id: userB.id },
            params: { id: suiteAId },
            query: {} // No token
        };
        const res = createMockRes();
        await sessionController.getSession(req, res);

        assert.equal(res.statusCode, 404, 'Must not leak existence of private suite to User B without token');
    });

    await t.test('9. Invalid share token is rejected with 403 ACCESS_DENIED', async () => {
        const req = {
            user: { id: userB.id, _id: userB.id },
            params: { id: suiteAId },
            query: { token: 'invalid_forged_token_12345' }
        };
        const res = createMockRes();
        await sessionController.getSession(req, res);

        assert.equal(res.statusCode, 403, 'Invalid token must be rejected with 403');
        assert.equal(res.data.code, 'ACCESS_DENIED');
    });

    await t.test('10. Owner revokes share link and subsequent access is blocked with SHARE_REVOKED', async () => {
        const revokeReq = {
            user: { id: userA.id, _id: userA.id },
            params: { id: suiteAId }
        };
        const revokeRes = createMockRes();
        await sessionController.revokeShare(revokeReq, revokeRes);

        assert.equal(revokeRes.statusCode, 200, 'Owner revoking share link must succeed');

        // Recipient attempts access with previous token
        const checkReq = {
            user: { id: userB.id, _id: userB.id },
            params: { id: suiteAId },
            query: { token: shareToken }
        };
        const checkRes = createMockRes();
        await sessionController.getSession(checkReq, checkRes);

        assert.equal(checkRes.statusCode, 403, 'Revoked link must return 403');
        assert.equal(checkRes.data.code, 'SHARE_REVOKED');
    });

    await t.test('11. Non-existent suite ID returns 404 SUITE_NOT_FOUND', async () => {
        const req = {
            user: { id: userA.id, _id: userA.id },
            params: { id: '00000000-0000-0000-0000-000000000000' }
        };
        const res = createMockRes();
        await sessionController.getSession(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.data.code, 'SUITE_NOT_FOUND');
    });
});
