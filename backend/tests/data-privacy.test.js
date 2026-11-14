const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const authController = require('../src/controllers/auth.controller');

test('Data Privacy & Export / Account Lifecycle Suite', async (t) => {
    const testUserId = 'usr_privacy_' + Date.now();
    const testEmail = `privacy_test_${Date.now()}@example.com`;

    const mockUser = {
        id: testUserId,
        name: 'Privacy Test User',
        displayName: 'privacy_user',
        email: testEmail,
        role: 'user',
        plan: 'Pro',
        jobTitle: 'Lead QA',
        timezone: 'UTC',
        language: 'en-US',
        bio: 'Automated tester',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        totalTestsGenerated: 42
    };

    // Stubs
    const origFindUserById = supabaseService.findUserById;
    const origDeleteUser = supabaseService.deleteUser;
    const origGetPrimaryWs = supabaseService.getUserPrimaryWorkspace;
    const origListAuthSessions = supabaseService.listAuthSessions;
    const origListSessions = supabaseService.listSessions;

    let deleteUserCalled = false;

    supabaseService.findUserById = async (id) => (id === testUserId ? mockUser : null);
    supabaseService.deleteUser = async (id) => { if (id === testUserId) deleteUserCalled = true; return true; };
    supabaseService.getUserPrimaryWorkspace = async () => ({ id: 'ws_test_01', name: 'Test Workspace', role: 'owner' });
    supabaseService.listAuthSessions = async () => ([
        { id: 'sess_1', device: 'Desktop Chrome', browser: 'Chrome', os: 'Windows', ipAddress: '127.0.0.1', location: 'Local', createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() }
    ]);
    supabaseService.listSessions = async () => ({ sessions: [{ id: 'suite_1', title: 'Smoke Suite', status: 'completed' }] });

    t.after(() => {
        supabaseService.findUserById = origFindUserById;
        supabaseService.deleteUser = origDeleteUser;
        supabaseService.getUserPrimaryWorkspace = origGetPrimaryWs;
        supabaseService.listAuthSessions = origListAuthSessions;
        supabaseService.listSessions = origListSessions;
    });

    await t.test('1. GET /export-data requires authentication (401)', async () => {
        const req = { user: null, query: {} };
        let statusCode = 200;
        let responseData = null;
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: (data) => { responseData = data; } };
            },
            json: (data) => { responseData = data; },
            setHeader: () => {}
        };

        await authController.exportData(req, res);
        assert.equal(statusCode, 401);
        assert.equal(responseData.success, false);
    });

    await t.test('2. GET /export-data returns structured user export for authenticated user', async () => {
        const req = {
            user: { id: testUserId, email: testEmail },
            query: { format: 'json' }
        };
        let statusCode = 200;
        let responseData = null;
        let headers = {};
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: (data) => { responseData = data; } };
            },
            json: (data) => { responseData = data; },
            setHeader: (k, v) => { headers[k] = v; }
        };

        await authController.exportData(req, res);
        assert.equal(statusCode, 200);
        assert.equal(responseData.success, true);
        assert.ok(responseData.data);
        assert.equal(responseData.data.user.email, testEmail);
        assert.equal(responseData.data.user.name, 'Privacy Test User');
        assert.equal(responseData.data.workspace.name, 'Test Workspace');
        assert.equal(responseData.data.activeSessions.length, 1);
        assert.ok(headers['Content-Disposition']);
        assert.ok(headers['Content-Disposition'].includes('testnexa-export'));
    });

    await t.test('3. DELETE /account requires reason and exact confirmation text', async () => {
        // Missing reason
        let statusCode = 200;
        let responseData = null;
        const res1 = {
            status: (code) => {
                statusCode = code;
                return { json: (data) => { responseData = data; } };
            },
            json: (data) => { responseData = data; },
            clearCookie: () => {}
        };

        await authController.deleteAccount({
            user: { id: testUserId, email: testEmail },
            body: { confirmationText: testEmail }
        }, res1);
        assert.equal(statusCode, 400);

        // Mismatched confirmation
        const res2 = {
            status: (code) => {
                statusCode = code;
                return { json: (data) => { responseData = data; } };
            },
            json: (data) => { responseData = data; },
            clearCookie: () => {}
        };

        await authController.deleteAccount({
            user: { id: testUserId, email: testEmail },
            body: { confirmationText: 'WRONG_EMAIL', reason: 'No longer needed' }
        }, res2);
        assert.equal(statusCode, 400);

        // Valid deletion with email
        let status3 = 200;
        let responseData3 = null;
        const res3 = {
            status: (code) => {
                status3 = code;
                return { json: (data) => { responseData3 = data; } };
            },
            json: (data) => { responseData3 = data; },
            clearCookie: () => {}
        };

        await authController.deleteAccount({
            user: { id: testUserId, email: testEmail },
            body: { confirmationText: testEmail, reason: 'I no longer need AI test generation / automated QA' }
        }, res3);
        assert.equal(status3, 200);
        assert.equal(responseData3.success, true);
        assert.equal(deleteUserCalled, true);
    });

    await t.test('4. PUT /update-profile updates name, displayName, and avatar for authenticated user', async () => {
        const origUpdateProfile = supabaseService.updateProfile;
        let updateProfileCalledWith = null;

        supabaseService.updateProfile = async (id, payload) => {
            updateProfileCalledWith = { id, payload };
            return {
                id,
                name: payload.name || 'Old Name',
                display_name: payload.displayName || 'old_display',
                email: testEmail,
                avatar: payload.avatar || null,
                provider: 'email',
                created_at: new Date().toISOString()
            };
        };

        let statusCode = 200;
        let responseData = null;
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: (data) => { responseData = data; } };
            },
            json: (data) => { responseData = data; }
        };

        await authController.updateProfile({
            user: { id: testUserId, email: testEmail },
            body: {
                name: 'Alex Morgan Updated',
                displayName: 'alexm_new',
                avatar: 'data:image/png;base64,mockAvatarData'
            }
        }, res);

        supabaseService.updateProfile = origUpdateProfile;

        assert.equal(statusCode, 200);
        assert.equal(responseData.success, true);
        assert.equal(responseData.user.name, 'Alex Morgan Updated');
        assert.equal(responseData.user.displayName, 'alexm_new');
        assert.equal(responseData.user.avatar, 'data:image/png;base64,mockAvatarData');
        assert.equal(updateProfileCalledWith.id, testUserId);
    });
});
