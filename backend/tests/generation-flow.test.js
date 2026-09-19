const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const crypto = require('crypto');
const supabaseService = require('../src/services/supabaseData.service');
const { getGenerationStatus } = require('../src/controllers/generate.controller');

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

test('Generation Flow & Status API Integration Suite with Supabase', async (t) => {
    const timestamp = Date.now();
    const userA = await supabaseService.createUser({
        name: 'GenFlow User A',
        email: `genflow_user_a_${timestamp}@example.com`,
        password: 'Password123!',
        provider: 'email'
    });

    const userB = await supabaseService.createUser({
        name: 'GenFlow User B',
        email: `genflow_user_b_${timestamp}@example.com`,
        password: 'Password123!',
        provider: 'email'
    });

    const testGenerationId = 'gen_' + crypto.randomUUID().replace(/-/g, '');

    // Create session directly in Supabase
    const savedSession = await supabaseService.createSession({
        userId: userA.id,
        generationId: testGenerationId,
        title: 'GenFlow Test Suite',
        context: 'api',
        depth: 'Standard',
        requirement: 'As a user I want to test login with 2FA',
        status: 'NeedsReview',
        summary: {
            total: 5,
            functional: 3,
            negative: 2
        },
        suiteData: {
            feature: 'GenFlow Test Suite',
            totalTests: 5
        }
    });

    await supabaseService.saveTestHistory({
        userId: userA.id,
        generationId: testGenerationId,
        sessionId: savedSession.id,
        feature: 'GenFlow Test Suite',
        requirement: 'As a user I want to test login with 2FA',
        testFocus: 'mixed',
        appType: 'api',
        summary: { total: 5 },
        processingTime: '2.5s'
    });

    await t.test('1. WorkspaceSession stores generationId and status NeedsReview in Supabase', async () => {
        const found = await supabaseService.getSession(savedSession.id, userA.id);
        assert.ok(found);
        assert.equal(found.generationId, testGenerationId);
        assert.equal(found.status, 'NeedsReview');
        assert.equal(found.suiteData.totalTests, 5);
    });

    await t.test('2. GET /api/v1/generations/:id returns completed status for session owner', async () => {
        const req = {
            user: { _id: userA.id, id: userA.id },
            params: { id: testGenerationId }
        };
        const res = createMockRes();
        await getGenerationStatus(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.status, 'completed');
        assert.equal(res.data.generationId, testGenerationId);
        assert.equal(String(res.data.testSuiteId), String(savedSession.id));
        assert.equal(res.data.data.title, 'GenFlow Test Suite');
    });

    await t.test('3. GET /api/v1/generations/:id rejects unauthorized access by another user', async () => {
        const req = {
            user: { _id: userB.id, id: userB.id },
            params: { id: testGenerationId }
        };
        const res = createMockRes();
        await getGenerationStatus(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.data.success, false);
    });

    await t.test('4. GET /api/v1/generations/:id returns 404 for non-existent generation', async () => {
        const req = {
            user: { _id: userA.id, id: userA.id },
            params: { id: 'gen_nonexistent123' }
        };
        const res = createMockRes();
        await getGenerationStatus(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.data.success, false);
    });

    // Cleanup
    await supabaseService.deleteSession(savedSession.id, userA.id).catch(() => {});
});
