const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const {
    getWorkspaceBilling,
    updateWorkspacePlan
} = require('../src/controllers/workspace.controller');
const { generateTestCases } = require('../src/controllers/generate.controller');

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

test('Engineering Control Room: Billing, Metering & Quota Enforcement Suite', async (t) => {
    const timestamp = Date.now();
    const ownerUser = { id: `owner_${timestamp}`, name: 'Lead Architect', email: `owner_${timestamp}@testnexa.ai` };
    const viewerUser = { id: `viewer_${timestamp}`, name: 'Guest Viewer', email: `viewer_${timestamp}@testnexa.ai` };

    let testWorkspace;

    await t.test('1. Authoritative Initial State: Fresh workspace defaults to Free tier with 50 suites', async () => {
        // Create or get primary workspace for owner
        testWorkspace = await supabaseService.getUserPrimaryWorkspace(ownerUser.id, ownerUser.name);
        assert.ok(testWorkspace, 'Primary workspace must be provisioned');

        const req = { user: ownerUser, params: { workspaceId: testWorkspace.id }, query: {}, body: {} };
        const res = createMockRes();

        await getWorkspaceBilling(req, res);

        assert.equal(res.statusCode, 200, 'Must return 200 OK');
        assert.equal(res.data.success, true);
        const billing = res.data.data;
        assert.equal(billing.plan, 'free', 'Plan must default to free');
        assert.equal(billing.quota, 50, 'Free quota must be 50 suites');
        assert.equal(billing.usedGenerations, 0, 'Initial usage must be 0');
        assert.equal(billing.remainingGenerations, 50, 'Remaining must be 50');
        assert.equal(billing.usagePercent, 0, 'Usage percent must be 0%');
        assert.ok(billing.currentPeriodEnd, 'Period end must be calculable');
        assert.ok(Array.isArray(billing.invoices), 'Invoices must be an array');
        assert.equal(billing.invoices.length, 0, 'Empty ledger for zero commercial transactions');
    });

    await t.test('2. Plan Adjustment: Owner updates tier to Pro with annual interval', async () => {
        const req = {
            user: ownerUser,
            params: { workspaceId: testWorkspace.id },
            body: { plan: 'pro', interval: 'annual' },
            ip: '127.0.0.1',
            headers: { 'user-agent': 'TestNexa-SpecRunner/2026' }
        };
        const res = createMockRes();

        await updateWorkspacePlan(req, res);

        assert.equal(res.statusCode, 200, 'Must return 200 OK');
        assert.equal(res.data.success, true);
        const updated = res.data.data;
        assert.equal(updated.plan, 'pro');
        assert.equal(updated.billingInterval, 'annual');
        assert.equal(updated.quota, 500, 'Pro quota must be 500 suites');
        assert.ok(updated.invoices.length >= 1, 'Commercial invoice must be recorded for paid transition');
        assert.equal(updated.invoices[0].amount, '$288.00', 'Annual pro price must be $288.00');
    });

    await t.test('3. Persistence Check: GET /billing reflects updated Pro plan and active invoice', async () => {
        const req = { user: ownerUser, params: { workspaceId: testWorkspace.id }, query: {}, body: {} };
        const res = createMockRes();

        await getWorkspaceBilling(req, res);

        assert.equal(res.statusCode, 200);
        const billing = res.data.data;
        assert.equal(billing.plan, 'pro');
        assert.equal(billing.quota, 500);
        assert.equal(billing.billingInterval, 'annual');
        assert.equal(billing.invoices.length, 1);
        assert.ok(billing.invoices[0].reference.startsWith('INV-'));
    });

    await t.test('4. RBAC Protection: Non-admin member (viewer) cannot adjust workspace plan', async () => {
        // Add viewer to workspace
        await supabaseService.addWorkspaceMember(testWorkspace.id, viewerUser.id, 'viewer');

        const req = {
            user: viewerUser,
            params: { workspaceId: testWorkspace.id },
            body: { plan: 'enterprise', interval: 'annual' },
            headers: {}
        };
        const res = createMockRes();

        await updateWorkspacePlan(req, res);

        assert.equal(res.statusCode, 403, 'Must reject unauthorized role with 403');
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'PERMISSION_DENIED');
    });

    await t.test('5. Input Validation: Invalid plan names or intervals are rejected with 400', async () => {
        const reqInvalidPlan = {
            user: ownerUser,
            params: { workspaceId: testWorkspace.id },
            body: { plan: 'god-mode', interval: 'monthly' },
            headers: {}
        };
        const resInvalidPlan = createMockRes();

        await updateWorkspacePlan(reqInvalidPlan, resInvalidPlan);

        assert.equal(resInvalidPlan.statusCode, 400);
        assert.equal(resInvalidPlan.data.success, false);

        const reqInvalidInterval = {
            user: ownerUser,
            params: { workspaceId: testWorkspace.id },
            body: { plan: 'pro', interval: 'bi-weekly' },
            headers: {}
        };
        const resInvalidInterval = createMockRes();

        await updateWorkspacePlan(reqInvalidInterval, resInvalidInterval);

        assert.equal(resInvalidInterval.statusCode, 400);
        assert.equal(resInvalidInterval.data.success, false);
    });

    await t.test('6. Quota Enforcement: Exceeded generation limit blocks test generation with 429', async () => {
        // Create an isolated exhausted-quota workspace
        const exhaustedUser = { id: `exhausted_${timestamp}`, name: 'Maxed User', email: `max_${timestamp}@testnexa.ai` };
        const exhaustedWs = await supabaseService.getUserPrimaryWorkspace(exhaustedUser.id, exhaustedUser.name);

        // Artificially simulate quota exhaustion by setting used = quota (50 for free)
        const storedWs = supabaseService.inMemoryWorkspaces.get(exhaustedWs.id) || exhaustedWs;
        storedWs.plan = 'free';
        storedWs.usedGenerations = 50;

        const reqGen = {
            user: exhaustedUser,
            body: {
                requirement: 'Verify payment gateway checkout with 3D Secure verification',
                appType: 'web',
                detailLevel: 'detailed',
                testFocus: 'functional'
            }
        };
        const resGen = createMockRes();

        await generateTestCases(reqGen, resGen);

        assert.equal(resGen.statusCode, 429, 'Must return 429 Too Many Requests when quota exceeded');
        assert.equal(resGen.data.success, false);
        assert.equal(resGen.data.code, 'GENERATION_QUOTA_EXCEEDED');
        assert.ok(resGen.data.message.includes('quota reached'), 'Error message must clearly inform the user');
    });
});
