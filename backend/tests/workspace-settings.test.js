const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const {
    getCurrentWorkspaceSettings,
    getWorkspaceSettings,
    updateWorkspaceSettings,
    getWorkspaceEnvironments,
    createWorkspaceEnvironment,
    deleteWorkspaceEnvironment
} = require('../src/controllers/workspace.controller');
const { protect } = require('../src/middleware/auth.middleware');
const { validateEnvironmentUrl } = require('../src/utils/ssrfValidator');

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

test('Workspace Settings & Production Multi-Tenant Isolation Test Suite', async (t) => {
    const timestamp = Date.now();
    const userA = { id: `usr_a_${timestamp}`, name: 'Alice Admin', email: `alice_${timestamp}@testnexa.ai` };
    const userB = { id: `usr_b_${timestamp}`, name: 'Bob Hacker', email: `bob_${timestamp}@testnexa.ai` };
    const userC = { id: `usr_c_${timestamp}`, name: 'Charlie Viewer', email: `charlie_${timestamp}@testnexa.ai` };

    let workspaceA;
    let workspaceB;
    let createdEnvA;

    await t.test('1. Unauthenticated requests are rejected with 401', async () => {
        const req = { headers: {}, params: {}, query: {}, body: {} };
        const res = createMockRes();
        let nextCalled = false;

        await protect(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, false, 'protect must not call next() for unauthenticated requests');
        assert.equal(res.statusCode, 401, 'Response status must be 401');
        assert.equal(res.data.success, false);
    });

    await t.test('2. Multi-tenant isolation: Two newly created accounts receive separate personal workspaces', async () => {
        // User A workspace
        const reqA = { user: userA, params: {}, body: {} };
        const resA = createMockRes();
        await getCurrentWorkspaceSettings(reqA, resA);

        assert.equal(resA.statusCode, 200);
        assert.equal(resA.data.success, true);
        workspaceA = resA.data.data;

        // User B workspace
        const reqB = { user: userB, params: {}, body: {} };
        const resB = createMockRes();
        await getCurrentWorkspaceSettings(reqB, resB);

        assert.equal(resB.statusCode, 200);
        assert.equal(resB.data.success, true);
        workspaceB = resB.data.data;

        // IDs must be distinct and immutable backend-generated format (ws_*)
        assert.ok(workspaceA.id.startsWith('ws_'), 'Workspace A ID must start with ws_');
        assert.ok(workspaceB.id.startsWith('ws_'), 'Workspace B ID must start with ws_');
        assert.notEqual(workspaceA.id, workspaceB.id, 'User A and User B must NOT share the same workspace ID');
        assert.notEqual(workspaceA.name, workspaceB.name, 'Workspace names should default to personal user-scoped names');
        assert.equal(workspaceA.ownerId, userA.id);
        assert.equal(workspaceB.ownerId, userB.id);
    });

    await t.test('3. Missing environments display a valid empty state (no seeded fake localhost or staging)', async () => {
        const req = { user: userA, params: { workspaceId: workspaceA.id }, headers: {} };
        const res = createMockRes();

        await getWorkspaceEnvironments(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.ok(Array.isArray(res.data.data), 'Environments must be an array');
        assert.equal(res.data.data.length, 0, 'New workspaces must start with 0 environments (empty state)');
        assert.equal(workspaceA.defaultEnvironmentId, null, 'Default environment ID must initially be null');
        assert.equal(workspaceA.defaultEnvironment, null, 'Default environment object must initially be null');
    });

    await t.test('4. SSRF protection: Rejects cloud metadata, private IP ranges, credentials, and non-http URLs', () => {
        // AWS/GCP/Azure metadata service
        const metadataCheck = validateEnvironmentUrl('http://169.254.169.254/latest/meta-data/');
        assert.equal(metadataCheck.valid, false);
        assert.ok(metadataCheck.message.toLowerCase().includes('metadata'));

        // Local loopback address in production mode (allowLocalhost = false)
        const loopbackCheck = validateEnvironmentUrl('http://127.0.0.1:8080', false);
        assert.equal(loopbackCheck.valid, false);
        assert.ok(loopbackCheck.message.toLowerCase().includes('loopback') || loopbackCheck.message.toLowerCase().includes('localhost'));

        // Private RFC 1918 range (10.x.x.x)
        const privateCheck = validateEnvironmentUrl('http://10.0.0.1/api', false);
        assert.equal(privateCheck.valid, false);

        // Embedded credentials (user:pass@host)
        const credentialsCheck = validateEnvironmentUrl('https://admin:secret@api.testnexa.ai');
        assert.equal(credentialsCheck.valid, false);
        assert.ok(credentialsCheck.message.toLowerCase().includes('credentials'));

        // Invalid protocol (file://, ftp://)
        const ftpCheck = validateEnvironmentUrl('ftp://files.example.com');
        assert.equal(ftpCheck.valid, false);

        // Valid public HTTPS URL
        const validCheck = validateEnvironmentUrl('https://api.acmecorp.com/v1');
        assert.equal(validCheck.valid, true);
        assert.equal(validCheck.sanitizedUrl, 'https://api.acmecorp.com/v1');
    });

    await t.test('5. Creating a valid environment for Workspace A succeeds and is scoped to Workspace A', async () => {
        const req = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: {
                name: 'Production Cloud Cluster',
                type: 'production',
                baseUrl: 'https://app.acmecorp.com'
            },
            headers: {}
        };
        const res = createMockRes();

        await createWorkspaceEnvironment(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.data.success, true);
        assert.ok(res.data.data.id.startsWith('env_'));
        assert.equal(res.data.data.name, 'Production Cloud Cluster');
        assert.equal(res.data.data.baseUrl, 'https://app.acmecorp.com');

        createdEnvA = res.data.data;

        // Verify it is visible to Workspace A
        const listReqA = { user: userA, params: { workspaceId: workspaceA.id }, headers: {} };
        const listResA = createMockRes();
        await getWorkspaceEnvironments(listReqA, listResA);
        assert.equal(listResA.data.data.length, 1);

        // Verify Workspace B still has 0 environments (isolation)
        const listReqB = { user: userB, params: { workspaceId: workspaceB.id }, headers: {} };
        const listResB = createMockRes();
        await getWorkspaceEnvironments(listReqB, listResB);
        assert.equal(listResB.data.data.length, 0, 'Workspace B must remain unaffected');
    });

    await t.test('6. User A updates workspace name and default environment with version 1', async () => {
        const req = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: {
                name: 'Acme QA Cloud Platform',
                defaultEnvironmentId: createdEnvA.id,
                version: 1
            },
            headers: { 'user-agent': 'SettingsIntegrationTest' }
        };
        const res = createMockRes();

        await updateWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.name, 'Acme QA Cloud Platform');
        assert.equal(res.data.data.defaultEnvironmentId, createdEnvA.id);
        assert.equal(res.data.data.version, 2, 'Version must be incremented to 2');

        workspaceA = res.data.data;
    });

    await t.test('7. Workspace settings persist after subsequent reload / GET', async () => {
        const req = { user: userA, params: { workspaceId: workspaceA.id }, headers: {} };
        const res = createMockRes();

        await getWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.name, 'Acme QA Cloud Platform');
        assert.equal(res.data.data.defaultEnvironmentId, createdEnvA.id);
        assert.equal(res.data.data.version, 2);
    });

    await t.test('8. Workspace ID remains immutable and cannot be modified via update payload', async () => {
        const req = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: {
                id: 'ws_hacked_new_id',
                name: 'Legit Name Change',
                version: 2
            },
            headers: {}
        };
        const res = createMockRes();

        await updateWorkspaceSettings(req, res);

        // id is not an allowed field in update payload -> DISALLOWED_FIELDS (400)
        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'DISALLOWED_FIELDS');

        // Confirm ID in DB remains unchanged
        const current = await supabaseService.getWorkspace(workspaceA.id);
        assert.equal(current.id, workspaceA.id);
    });

    await t.test('9. Validation rejects invalid or empty workspace names', async () => {
        const reqEmpty = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: { name: '   ', version: 2 },
            headers: {}
        };
        const resEmpty = createMockRes();
        await updateWorkspaceSettings(reqEmpty, resEmpty);
        assert.equal(resEmpty.statusCode, 400);
        assert.equal(resEmpty.data.code, 'INVALID_WORKSPACE_NAME');

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
    });

    await t.test('10. Validation rejects invalid default environment or cross-workspace environment', async () => {
        const req = {
            user: userA,
            params: { workspaceId: workspaceA.id },
            body: { defaultEnvironmentId: 'env_foreign_unknown', version: 2 },
            headers: {}
        };
        const res = createMockRes();

        await updateWorkspaceSettings(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'INVALID_ENVIRONMENT');
    });

    await t.test('11. Concurrency conflict: rejects updates with stale version (409 Conflict)', async () => {
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

    await t.test('12. Tenant isolation: User B cannot access User A workspace settings (403 Forbidden)', async () => {
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

    await t.test('13. Tenant isolation: User B cannot modify User A workspace settings (403 Forbidden)', async () => {
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

    await t.test('14. Role-based authorization: Viewer member cannot modify settings (403 Forbidden)', async () => {
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

    await t.test('15. Audit log records changed field history with actor ID and diffs', async () => {
        const logs = supabaseService.inMemoryAuditLogs.filter(l => l.workspaceId === workspaceA.id);
        assert.ok(logs.length >= 1, 'Audit log entries must be created for workspace changes');
        const updateLog = logs[logs.length - 1];
        assert.equal(updateLog.actorId, userA.id);
        assert.equal(updateLog.action, 'workspace.settings.update');
        assert.ok(updateLog.changes);
        assert.ok(updateLog.changes.name || updateLog.changes.defaultEnvironmentId);
    });
});
