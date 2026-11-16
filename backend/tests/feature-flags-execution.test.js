/**
 * Feature Flags & Test Execution Coming Soon Verification
 *
 * Verifies:
 * 1. requireFeature('testRuns') middleware returns HTTP 501 FEATURE_DISABLED when false/unset.
 * 2. requireFeature('testRuns') allows execution when FEATURE_TEST_RUNS=true.
 * 3. GET /api/v1/features exposes current feature flags.
 * 4. listRuns returns empty array when testRuns is disabled.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const {
    isFeatureEnabled,
    requireFeature,
    getAllFeatures,
    getFeatureInfo
} = require('../src/middleware/featureFlag.middleware');

const executionController = require('../src/controllers/execution.controller');

const createMockReq = ({ user = { id: 'usr_test', name: 'Tester' }, body = {}, params = {}, query = {} } = {}) => ({
    user,
    body,
    params,
    query,
    headers: {},
    get: () => ''
});

const createMockRes = () => {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
    return res;
};

describe('Feature Flags & Execution Guard Middleware', () => {
    const originalEnv = process.env.FEATURE_TEST_RUNS;

    beforeEach(() => {
        delete process.env.FEATURE_TEST_RUNS;
    });

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.FEATURE_TEST_RUNS = originalEnv;
        } else {
            delete process.env.FEATURE_TEST_RUNS;
        }
    });

    it('defaults FEATURE_TEST_RUNS to disabled (false)', () => {
        delete process.env.FEATURE_TEST_RUNS;
        assert.strictEqual(isFeatureEnabled('testRuns'), false);
    });

    it('returns HTTP 501 with FEATURE_DISABLED when feature is disabled', () => {
        process.env.FEATURE_TEST_RUNS = 'false';

        const middleware = requireFeature('testRuns');
        const req = createMockReq();
        const res = createMockRes();
        let nextCalled = false;

        middleware(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(nextCalled, false, 'next() should not be called when feature is disabled');
        assert.strictEqual(res.statusCode, 501);
        assert.strictEqual(res.body?.code, 'FEATURE_DISABLED');
        assert.strictEqual(res.body?.feature, 'testRuns');
        assert.strictEqual(res.body?.message, 'Test execution is coming soon.');
    });

    it('permits route execution via next() when FEATURE_TEST_RUNS is true', () => {
        process.env.FEATURE_TEST_RUNS = 'true';

        const middleware = requireFeature('testRuns');
        const req = createMockReq();
        const res = createMockRes();
        let nextCalled = false;

        middleware(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(nextCalled, true, 'next() must be called when feature is enabled');
        assert.strictEqual(res.statusCode, 200);
    });

    it('getAllFeatures exposes testRuns flag and metadata', () => {
        process.env.FEATURE_TEST_RUNS = 'false';
        const flags = getAllFeatures();

        assert.ok(flags.testRuns);
        assert.strictEqual(flags.testRuns.enabled, false);
        assert.strictEqual(flags.testRuns.title, 'Test execution');
        assert.ok(flags.testRuns.description.length > 0);
    });

    it('listRuns returns empty array and zero total when testRuns is disabled', async () => {
        process.env.FEATURE_TEST_RUNS = 'false';

        const req = createMockReq();
        const res = createMockRes();

        await executionController.listRuns(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body?.success, true);
        assert.deepStrictEqual(res.body?.data, []);
        assert.strictEqual(res.body?.pagination?.total, 0);
    });
});
