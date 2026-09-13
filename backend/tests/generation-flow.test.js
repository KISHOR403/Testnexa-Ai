const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const WorkspaceSession = require('../src/models/workspaceSession.model');
const TestHistory = require('../src/models/testHistory.model');
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

test.before(async () => {
    if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });
    }
});

test.after(async () => {
    await User.deleteMany({ email: /genflow_.*@example\.com/ });
    await WorkspaceSession.deleteMany({ title: /GenFlow Test/ });
    await TestHistory.deleteMany({ feature: /GenFlow Test/ });
    await mongoose.disconnect();
});

test('Generation Flow & Status API Integration Suite', async (t) => {
    const timestamp = Date.now();
    const userA = await User.create({
        name: 'GenFlow User A',
        email: `genflow_user_a_${timestamp}@example.com`,
        password: 'Password123!',
        provider: 'email'
    });

    const userB = await User.create({
        name: 'GenFlow User B',
        email: `genflow_user_b_${timestamp}@example.com`,
        password: 'Password123!',
        provider: 'email'
    });

    const testGenerationId = 'gen_' + new mongoose.Types.ObjectId();

    // Create session directly as generate controller does
    const savedSession = await WorkspaceSession.create({
        userId: userA._id,
        generationId: testGenerationId,
        title: 'GenFlow Test Suite',
        appType: 'api',
        detailLevel: 'medium',
        testFocus: 'mixed',
        language: 'english',
        requirement: 'As a user I want to test login with 2FA',
        status: 'NeedsReview',
        summary: {
            totalTests: 5,
            functional: 3,
            negative: 2
        },
        testCases: [
            {
                id: 'TC-001',
                title: 'Valid login test',
                type: 'functional',
                priority: 'P1',
                preconditions: 'User registered',
                steps: ['Enter email', 'Enter password', 'Submit'],
                expectedResult: 'Login successful'
            }
        ],
        suiteData: {
            feature: 'GenFlow Test Suite',
            totalTests: 5
        }
    });

    await TestHistory.create({
        userId: userA._id,
        generationId: testGenerationId,
        sessionId: savedSession._id,
        feature: 'GenFlow Test Suite',
        requirement: 'As a user I want to test login with 2FA',
        testFocus: 'mixed',
        appType: 'api',
        testCount: 5,
        confidenceLevel: 'High',
        ambiguityLevel: 'Low',
        processingTime: '2.5s'
    });

    await t.test('1. WorkspaceSession stores generationId and status NeedsReview', async () => {
        const found = await WorkspaceSession.findById(savedSession._id);
        assert.ok(found);
        assert.equal(found.generationId, testGenerationId);
        assert.equal(found.status, 'NeedsReview');
        assert.equal(found.suiteData.totalTests, 5);
    });

    await t.test('2. GET /api/v1/generations/:id returns completed status for session owner', async () => {
        const req = {
            user: { _id: userA._id },
            params: { id: testGenerationId }
        };
        const res = createMockRes();
        await getGenerationStatus(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.status, 'completed');
        assert.equal(res.data.generationId, testGenerationId);
        assert.equal(String(res.data.testSuiteId), String(savedSession._id));
        assert.equal(res.data.data.title, 'GenFlow Test Suite');
    });

    await t.test('3. GET /api/v1/generations/:id rejects unauthorized access by another user', async () => {
        const req = {
            user: { _id: userB._id },
            params: { id: testGenerationId }
        };
        const res = createMockRes();
        await getGenerationStatus(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.data.success, false);
    });

    await t.test('4. GET /api/v1/generations/:id returns 404 for non-existent generation', async () => {
        const req = {
            user: { _id: userA._id },
            params: { id: 'gen_nonexistent123' }
        };
        const res = createMockRes();
        await getGenerationStatus(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.data.success, false);
    });
});
