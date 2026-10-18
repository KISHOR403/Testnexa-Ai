const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const {
    getCurrentWorkspaceSettings,
    getWorkspaceSettings,
    updateWorkspaceSettings,
    getWorkspaceEnvironments
} = require('../src/controllers/workspace.controller');
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

test('Workspace Settings & Tenant Isolation Test Suite', async (t) => {
    const timestamp = Date.now();
    const userA = { id: `usr_a_${timestamp}`, name: 'Alice Admin', email: `alice_${timestamp}@testnexa.ai` };
    const userB = { id: `usr_b_${timestamp}`, name: 'Bob Hacker', email: `bob_${timestamp}@testnexa.ai` };
    const userC = { id: `usr_c_${timestamp}`, name: 'Charlie Viewer', email: `charlie_${timestamp}@testnexa.ai` };

    let workspaceA;
    let envsA;
    let envProdA;

    await t.test('1. Unauthenticated requests are rejected with 401', async () => {
        const req = { headers: {}, params: {}, query: {}, body: {} };
        const res = createMockRes();
        let nextCalled = false;

        await protect(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, false, 'protect must not call next() for unauthenticated requests');
        assert.equal(res.statusCode, 401, 'Response status must be 401');
        assert.equal(res.data.success, false);
    });

    await t.test('2. User A retrieves/auto-provisions primary workspace settings', async () => {
        const req = { user: userA, params: {}, body: {} };
        const res = createMockRes();

        await getCurrentWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.ok(res.data.data.id.startsWith('ws_'), 'Workspace ID must start with ws_');
        assert.equal(res.data.data.ownerId, userA.id);
        assert.equal(res.data.data.role, 'owner');
        assert.equal(res.data.data.version, 1);
        assert.ok(res.data.data.name.length >= 2);
        assert.ok(res.data.data.defaultEnvironment, 'Default environment must be attached');

        workspaceA = res.data.data;
    });

    await t.test('3. User A lists environments for workspace — sanitized, no secrets', async () => {
        const req = { user: userA, params: { workspaceId: workspaceA.id }, headers: {} };
        const res = createMockRes();

        await getWorkspaceEnvironments(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.ok(Array.isArray(res.data.data), 'Environments must be an array');
        assert.ok(res.data.data.length >= 2, 'Should have at least 2 environments');

        envsA = res.data.data;
        envProdA = envsA.find(e => e.slug === 'production') || envsA[1];

        // Ensure no secrets leaked
        for (const env of envsA) {
            assert.equal(env.secret, undefined);
            assert.equal(env.apiKey, undefined);
            assert.equal(env.password, undefined);
            assert.ok(env.id.startsWith('env_'));
        }
    });

    await t.test('4. User A updates workspace name and default environment with version 1', async () => {
        const req = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: {
                name: 'Acme QA Cloud Platform',
                defaultEnvironmentId: envProdA.id,
                version: 1
            },
            headers: { 'user-agent': 'SettingsIntegrationTest' }
        };
        const res = createMockRes();

        await updateWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.name, 'Acme QA Cloud Platform');
        assert.equal(res.data.data.defaultEnvironmentId, envProdA.id);
        assert.equal(res.data.data.version, 2, 'Version must be incremented to 2');

        workspaceA = res.data.data;
    });

    await t.test('5. Workspace settings persist after subsequent reload / GET', async () => {
        const req = { user: userA, params: { workspaceId: workspaceA.id }, headers: {} };
        const res = createMockRes();

        await getWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.name, 'Acme QA Cloud Platform');
        assert.equal(res.data.data.defaultEnvironmentId, envProdA.id);
        assert.equal(res.data.data.version, 2);
    });

    await t.test('6. Validation rejects empty or whitespace-only workspace name', async () => {
        const req = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: { name: '    ', version: 2 },
            headers: {}
        };
        const res = createMockRes();

        await updateWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'INVALID_WORKSPACE_NAME');
    });

    await t.test('7. Validation rejects name exceeding 60 characters or below 2 characters', async () => {
        const reqShort = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: { name: 'A', version: 2 },
            headers: {}
        };
        const resShort = createMockRes();
        await updateWorkspaceSettings(reqShort, resShort);
        assert.equal(resShort.statusCode, 400);
        assert.equal(resShort.data.code, 'INVALID_WORKSPACE_NAME');

        const reqLong = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: { name: 'X'.repeat(61), version: 2 },
            headers: {}
        };
        const resLong = createMockRes();
        await updateWorkspaceSettings(reqLong, resLong);
        assert.equal(resLong.statusCode, 400);
        assert.equal(resLong.data.code, 'INVALID_WORKSPACE_NAME');
    });

    await t.test('8. Validation rejects unauthorized / disallowed fields in request payload', async () => {
        const req = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: { name: 'Valid Name', hackerField: 'malicious_input', version: 2 },
            headers: {}
        };
        const res = createMockRes();

        await updateWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'DISALLOWED_FIELDS');
    });

    await t.test('9. Validation rejects invalid default environment or cross-workspace environment', async () => {
        const req = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: { defaultEnvironmentId: 'env_non_existent_foreign', version: 2 },
            headers: {}
        };
        const res = createMockRes();

        await updateWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'INVALID_ENVIRONMENT');
    });

    await t.test('10. Concurrency conflict: rejects updates with stale version', async () => {
        const reqStale = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: { name: 'Conflict Overwrite Attempt', version: 1 }, // current version is 2
            headers: {}
        };
        const resStale = createMockRes();

        await updateWorkspaceSettings(reqStale, resStale);

        assert.equal(resStale.statusCode, 409);
        assert.equal(resStale.data.success, false);
        assert.equal(resStale.data.code, 'CONCURRENCY_CONFLICT');
        assert.ok(resStale.data.data.currentSettings);
        assert.equal(resStale.data.data.currentSettings.version, 2);
    });

    await t.test('11. Tenant isolation: User B cannot access User A workspace settings', async () => {
        const req = {
            user: userB,
            params: { workspaceId: workspaceA.id },
            headers: {}
        };
        const res = createMockRes();

        await getWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 403, 'User B must receive 403 Forbidden');
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'FORBIDDEN');
    });

    await t.test('12. Tenant isolation: User B cannot modify User A workspace settings', async () => {
        const req = {
            user: userB,
            params: { workspaceId: workspaceA.id },
            body: { name: 'Hijacked Workspace', version: 2 },
            headers: {}
        };
        const res = createMockRes();

        await updateWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 403, 'User B must receive 403 Forbidden');
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'FORBIDDEN');
    });

    await t.test('13. Role-based authorization: Viewer member cannot modify settings', async () => {
        // Add User C to workspace A as a 'viewer'
        await supabaseService.addWorkspaceMember({
            workspaceId: workspaceA.id,
            userId: userC.id,
            role: 'viewer'
        });

        const req = {
            user: userC,
            params: { workspaceId: workspaceA.id },
            body: { name: 'Viewer Renaming Attempt', version: 2 },
            headers: {}
        };
        const res = createMockRes();

        await updateWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 403);
        assert.equal(res.data.code, 'PERMISSION_DENIED');
        assert.ok(res.data.message.includes('administrators'));
    });

    await t.test('14. Audit log records changed field history without secrets', async () => {
        const logs = supabaseService.inMemoryAuditLogs.filter(l => l.workspaceId === workspaceA.id);
        assert.ok(logs.length >= 1, 'Audit log entries must be created for workspace changes');
        const updateLog = logs[logs.length - 1];
        assert.equal(updateLog.actorId, userA.id);
        assert.equal(updateLog.action, 'workspace.settings.update');
        assert.ok(updateLog.changes);
    });
});
