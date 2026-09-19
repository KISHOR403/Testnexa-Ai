const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const authController = require('../src/controllers/auth.controller');
const { protect } = require('../src/middleware/auth.middleware');

test('Auth and Session Management Suite with Supabase', async (t) => {
    const testEmail = `test_logout_${Date.now()}@example.com`;
    let userA;
    let userB;
    let sessionA1;
    let sessionA2;
    let tokenA1;
    let tokenA2;

    await t.test('1. Register creates user and active AuthSession', async () => {
        const req = {
            body: {
                name: 'Logout Test User',
                email: testEmail,
                password: 'Password123!'
            },
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36 TestRunnerAgent',
                'x-forwarded-for': '127.0.0.1'
            },
            ip: '127.0.0.1'
        };

        let responseData = null;
        let statusCode = 200;
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: (data) => { responseData = data; return res; }
        };

        await authController.register(req, res);

        assert.equal(statusCode, 201);
        assert.equal(responseData.success, true);
        assert.ok(responseData.token, 'Token must be returned');

        userA = await supabaseService.findUserByEmail(testEmail);
        assert.ok(userA);

        const decoded = require('jsonwebtoken').verify(responseData.token, process.env.JWT_SECRET || 'secret123');
        assert.ok(decoded.sessionId, 'Token must contain sessionId');

        sessionA1 = await supabaseService.getAuthSession(decoded.sessionId);
        assert.ok(sessionA1, 'AuthSession must be accessible');
        assert.equal(sessionA1.device, 'Chrome on Windows 11');
        assert.equal(sessionA1.revokedAt, null, 'New session must not be revoked');

        tokenA1 = responseData.token;
    });

    await t.test('2. Protect middleware permits request with valid session', async () => {
        const req = {
            headers: { authorization: `Bearer ${tokenA1}` }
        };
        let nextCalled = false;
        const res = {
            status: (code) => ({ json: (d) => ({ code, d }) })
        };
        const next = () => { nextCalled = true; };

        await protect(req, res, next);
        assert.equal(nextCalled, true, 'protect should call next() for valid active session');
        assert.ok(req.user, 'req.user should be populated');
        assert.equal(req.user.id.toString(), userA.id.toString());
        assert.equal(req.sessionId.toString(), (sessionA1.id || sessionA1._id).toString());
    });

    await t.test('3. Login creates a second active session for User A', async () => {
        const req = {
            body: {
                email: testEmail,
                password: 'Password123!'
            },
            headers: {
                'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1 TestRunnerAgent',
                'x-forwarded-for': '127.0.0.1'
            },
            ip: '127.0.0.1'
        };

        let responseData = null;
        const res = {
            json: (data) => { responseData = data; return res; },
            status: (code) => res
        };

        await authController.login(req, res);
        assert.equal(responseData.success, true);
        tokenA2 = responseData.token;

        const decoded = require('jsonwebtoken').verify(tokenA2, process.env.JWT_SECRET || 'secret123');
        sessionA2 = await supabaseService.getAuthSession(decoded.sessionId);
        assert.ok(sessionA2);
        assert.equal(sessionA2.device, 'Safari on iOS 17.5');
    });

    await t.test('4. listSessions returns both sessions with current session flagged accurately', async () => {
        const req = {
            user: { id: userA.id, _id: userA.id },
            sessionId: sessionA1.id || sessionA1._id
        };
        let responseData = null;
        const res = {
            json: (data) => { responseData = data; return res; },
            status: (code) => res
        };

        await authController.listSessions(req, res);
        assert.equal(responseData.success, true);
        assert.equal(responseData.sessions.length, 2, 'Should list both active sessions');

        const currentSession = responseData.sessions.find(s => s.isCurrent);
        assert.ok(currentSession, 'One session must be marked as current');
        assert.equal(currentSession.id.toString(), (sessionA1.id || sessionA1._id).toString());

        const otherSession = responseData.sessions.find(s => !s.isCurrent);
        assert.ok(otherSession);
        assert.equal(otherSession.id.toString(), (sessionA2.id || sessionA2._id).toString());
    });

    await t.test('5. Security: User B cannot revoke User A session (returns 403 Forbidden)', async () => {
        const attackerEmail = `test_logout_attacker_${Date.now()}@example.com`;
        const attacker = await supabaseService.createUser({
            name: 'Malicious User',
            email: attackerEmail,
            password: 'HashedPassword123',
            provider: 'email'
        });
        userB = attacker;

        const req = {
            user: { id: userB.id, _id: userB.id },
            params: { sessionId: (sessionA2.id || sessionA2._id).toString() }
        };
        let statusCode = 200;
        let responseData = null;
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: (data) => { responseData = data; return res; }
        };

        await authController.revokeSession(req, res);
        assert.equal(statusCode, 403, 'Should forbid revoking another user session');
        assert.equal(responseData.success, false);

        // Verify sessionA2 was NOT revoked
        const checkSession = await supabaseService.getAuthSession(sessionA2.id || sessionA2._id);
        assert.equal(checkSession.revokedAt, null);
    });

    await t.test('6. User A revokes other sessions: sessionA1 remains active, sessionA2 is revoked', async () => {
        const req = {
            user: { id: userA.id, _id: userA.id },
            sessionId: sessionA1.id || sessionA1._id
        };
        let responseData = null;
        const res = {
            json: (data) => { responseData = data; return res; },
            status: (code) => res
        };

        await authController.revokeOtherSessions(req, res);
        assert.equal(responseData.success, true);

        const checkA1 = await supabaseService.getAuthSession(sessionA1.id || sessionA1._id);
        const checkA2 = await supabaseService.getAuthSession(sessionA2.id || sessionA2._id);
        assert.equal(checkA1.revokedAt, null, 'Current session must remain active');
        assert.ok(checkA2.revokedAt !== null, 'Other session must be revoked');
    });

    await t.test('7. Protect middleware REJECTS revoked session token with 401 SESSION_REVOKED', async () => {
        const req = {
            headers: { authorization: `Bearer ${tokenA2}` }
        };
        let statusCode = 200;
        let responseData = null;
        let nextCalled = false;
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: (data) => { responseData = data; return res; }
        };
        const next = () => { nextCalled = true; };

        await protect(req, res, next);
        assert.equal(nextCalled, false, 'next() must NOT be called for revoked session');
        assert.equal(statusCode, 401, 'Must return 401 for revoked session');
        assert.equal(responseData.code, 'SESSION_REVOKED');
    });

    await t.test('8. Logout revokes current session and clears cookie', async () => {
        let clearedCookieName = null;
        let sessionDestroyCalled = false;
        const req = {
            user: { id: userA.id, _id: userA.id },
            sessionId: sessionA1.id || sessionA1._id,
            session: {
                destroy: (cb) => { sessionDestroyCalled = true; cb(); }
            }
        };
        let responseData = null;
        const res = {
            clearCookie: (name, opts) => { clearedCookieName = name; },
            json: (data) => { responseData = data; return res; }
        };

        await authController.logout(req, res);
        assert.equal(responseData.success, true);
        assert.equal(clearedCookieName, 'connect.sid', 'Must clear connect.sid cookie');
        assert.equal(sessionDestroyCalled, true, 'Must destroy Express session');

        const checkA1 = await supabaseService.getAuthSession(sessionA1.id || sessionA1._id);
        assert.ok(checkA1.revokedAt !== null, 'Session must now be revoked');
    });

    await t.test('9. Protect middleware REJECTS previously active session after logout', async () => {
        const req = {
            headers: { authorization: `Bearer ${tokenA1}` }
        };
        let statusCode = 200;
        let responseData = null;
        let nextCalled = false;
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: (data) => { responseData = data; return res; }
        };
        const next = () => { nextCalled = true; };

        await protect(req, res, next);
        assert.equal(nextCalled, false);
        assert.equal(statusCode, 401);
        assert.equal(responseData.code, 'SESSION_REVOKED');
    });
});
