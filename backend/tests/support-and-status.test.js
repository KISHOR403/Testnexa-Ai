/**
 * Testnexa AI — Support Requests, Help Center Feedback & System Status Tests
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const supportService = require('../src/services/support.service');
const statusService = require('../src/services/status.service');
const supportController = require('../src/controllers/support.controller');
const statusController = require('../src/controllers/status.controller');

// Mock request and response helpers
const createMockReq = ({
    body = {},
    params = {},
    query = {},
    headers = {},
    user = null,
    ip = '127.0.0.1'
} = {}) => ({
    body,
    params,
    query,
    headers,
    user,
    ip,
    get: (h) => headers[h.toLowerCase()] || ''
});

const createMockRes = () => {
    const res = {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
        setHeader(k, v) {
            this.headers[k] = v;
            return this;
        }
    };
    return res;
};

describe('Support Requests, Help Center & System Status Suite', () => {

    beforeEach(() => {
        supportService.inMemorySupportRequests.clear();
        supportService.inMemoryHelpFeedback.clear();
        supportService.inMemoryHelpSearchMisses.clear();
        statusService.cachedStatus = null;
        statusService.cacheExpiresAt = 0;
        statusService.cachedAiStatus = null;
        statusService.aiCacheExpiresAt = 0;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Support Requests Validation & Submission
    // ─────────────────────────────────────────────────────────────────────────
    describe('1. Support Requests Validation', () => {
        it('should accept valid anonymous support request and return 201 with id', async () => {
            const req = createMockReq({
                body: {
                    topic: 'generation',
                    message: 'I am encountering an issue generating test cases for my API requirements.',
                    email: 'qa.engineer@company.com',
                    page_url: '/help',
                    app_version: 'v2.4.1',
                    consent: true
                }
            });
            const res = createMockRes();

            await supportController.submitSupportRequest(req, res);

            assert.strictEqual(res.statusCode, 201);
            assert.strictEqual(res.body.success, true);
            assert.ok(res.body.data.id.startsWith('sup_'));
            assert.ok(res.body.data.expectedResponseTime);
        });

        it('should reject invalid topic with VALIDATION_ERROR', async () => {
            const req = createMockReq({
                body: {
                    topic: 'non_existent_topic',
                    message: 'This is a long enough message to pass length checks.',
                    email: 'qa@company.com',
                    consent: true
                }
            });
            const res = createMockRes();

            await supportController.submitSupportRequest(req, res);

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
        });

        it('should reject message shorter than 20 characters', async () => {
            const req = createMockReq({
                body: {
                    topic: 'bug',
                    message: 'Too short',
                    email: 'qa@company.com',
                    consent: true
                }
            });
            const res = createMockRes();

            await supportController.submitSupportRequest(req, res);

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
        });

        it('should reject anonymous request without email', async () => {
            const req = createMockReq({
                body: {
                    topic: 'account',
                    message: 'This is a valid long message about an account login question.',
                    consent: true
                }
            });
            const res = createMockRes();

            await supportController.submitSupportRequest(req, res);

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'EMAIL_REQUIRED');
        });

        it('should auto-populate email from authenticated user when omitted', async () => {
            const req = createMockReq({
                user: { id: 'usr_auth_101', email: 'registered@company.com' },
                body: {
                    topic: 'billing',
                    message: 'Need to inquire about team invoice and seat expansion plans.',
                    consent: true
                }
            });
            const res = createMockRes();

            await supportController.submitSupportRequest(req, res);

            assert.strictEqual(res.statusCode, 201);
            assert.strictEqual(res.body.success, true);
        });

        it('should reject external or malformed page_url', async () => {
            const req = createMockReq({
                body: {
                    topic: 'other',
                    message: 'Valid length message about our system migration requirements.',
                    email: 'tester@company.com',
                    page_url: 'https://malicious-site.com/phish',
                    consent: true
                }
            });
            const res = createMockRes();

            await supportController.submitSupportRequest(req, res);

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
        });

        it('should reject if consent is not true', async () => {
            const req = createMockReq({
                body: {
                    topic: 'bug',
                    message: 'Valid length message about our system migration requirements.',
                    email: 'tester@company.com',
                    consent: false
                }
            });
            const res = createMockRes();

            await supportController.submitSupportRequest(req, res);

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Anti-Spam & Abuse Safeguards
    // ─────────────────────────────────────────────────────────────────────────
    describe('2. Anti-Spam & Abuse Protections', () => {
        it('should silently absorb honeypot submissions when website field is filled', async () => {
            const req = createMockReq({
                body: {
                    topic: 'bug',
                    message: 'Spam payload containing advertisements and casino references.',
                    email: 'bot@spamnetwork.com',
                    website: 'https://spam-domain.com', // Honeypot filled
                    consent: true
                }
            });
            const res = createMockRes();

            await supportController.submitSupportRequest(req, res);

            assert.strictEqual(res.statusCode, 201);
            assert.strictEqual(res.body.data.id, 'sup_bot_absorbed');
            // Must not persist into storage
            assert.strictEqual(supportService.inMemorySupportRequests.size, 0);
        });

        it('should reject messages submitted too fast (< 3 seconds)', async () => {
            const req = createMockReq({
                body: {
                    topic: 'bug',
                    message: 'Valid length text submitted unnaturally fast by automated script.',
                    email: 'script@company.com',
                    client_timestamp: Date.now() - 500, // 500ms ago
                    consent: true
                }
            });
            const res = createMockRes();

            await supportController.submitSupportRequest(req, res);

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'SUBMIT_TOO_FAST');
        });

        it('should reject messages consisting overwhelmingly of links', async () => {
            const req = createMockReq({
                body: {
                    topic: 'other',
                    message: 'https://domain1.com/link https://domain2.com/link https://domain3.com/link https://domain4.com/link',
                    email: 'links@company.com',
                    consent: true
                }
            });
            const res = createMockRes();

            await supportController.submitSupportRequest(req, res);

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'INVALID_CONTENT');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Privacy, Retention & Account Deletion Cascade
    // ─────────────────────────────────────────────────────────────────────────
    describe('3. Privacy, Retention & Account Deletion', () => {
        it('should purge support requests older than retention window', async () => {
            const now = Date.now();
            const oldDate = new Date(now - 14 * 30 * 24 * 60 * 60 * 1000).toISOString(); // 14 months ago
            const recentDate = new Date(now - 2 * 30 * 24 * 60 * 60 * 1000).toISOString(); // 2 months ago

            supportService.inMemorySupportRequests.set('sup_old_1', {
                id: 'sup_old_1',
                email: 'old@company.com',
                created_at: oldDate
            });

            supportService.inMemorySupportRequests.set('sup_recent_1', {
                id: 'sup_recent_1',
                email: 'recent@company.com',
                created_at: recentDate
            });

            const { deletedCount } = await supportService.purgeOldSupportRequests(12);

            assert.strictEqual(deletedCount, 1);
            assert.ok(!supportService.inMemorySupportRequests.has('sup_old_1'));
            assert.ok(supportService.inMemorySupportRequests.has('sup_recent_1'));
        });

        it('should cascade delete user support requests on account deletion', async () => {
            const userId = 'usr_delete_test';
            supportService.inMemorySupportRequests.set('sup_user_1', {
                id: 'sup_user_1',
                user_id: userId,
                email: 'user@company.com',
                created_at: new Date().toISOString()
            });

            supportService.inMemorySupportRequests.set('sup_other_1', {
                id: 'sup_other_1',
                user_id: 'usr_different',
                email: 'other@company.com',
                created_at: new Date().toISOString()
            });

            const result = await supportService.deleteUserSupportRequests(userId);

            assert.strictEqual(result.count, 1);
            assert.ok(!supportService.inMemorySupportRequests.has('sup_user_1'));
            assert.ok(supportService.inMemorySupportRequests.has('sup_other_1'));
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Help Center Article Feedback & Deduplication
    // ─────────────────────────────────────────────────────────────────────────
    describe('4. Help Center Article Feedback', () => {
        it('should record article feedback with hashed IP without storing raw IP', async () => {
            const req = createMockReq({
                ip: '198.51.100.42',
                body: {
                    article_slug: 'api-testing-quickstart',
                    helpful: true,
                    comment: 'Very clear explanation of parameter generators.'
                }
            });
            const res = createMockRes();

            await supportController.submitArticleFeedback(req, res);

            assert.strictEqual(res.statusCode, 201);
            assert.strictEqual(res.body.success, true);

            const stored = Array.from(supportService.inMemoryHelpFeedback.values())[0];
            assert.ok(stored);
            assert.strictEqual(stored.article_slug, 'api-testing-quickstart');
            assert.ok(stored.ip_hash);
            assert.ok(!JSON.stringify(stored).includes('198.51.100.42'), 'Raw IP address must not be stored');
        });

        it('should reject invalid article slug format', async () => {
            const req = createMockReq({
                body: {
                    article_slug: 'INVALID SLUG WITH SPACES!',
                    helpful: true
                }
            });
            const res = createMockRes();

            await supportController.submitArticleFeedback(req, res);

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Help Center Search Miss Normalization
    // ─────────────────────────────────────────────────────────────────────────
    describe('5. Search Miss Logging & Normalization', () => {
        it('should normalize queries and strip emails and long digit sequences', async () => {
            const req = createMockReq({
                body: {
                    query: 'How to configure OAuth for user@example.com with client id 998877665544?'
                }
            });
            const res = createMockRes();

            await supportController.submitSearchMiss(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.success, true);
            const normalized = res.body.data.query;

            assert.ok(!normalized.includes('@example.com'), 'Email must be stripped');
            assert.ok(!normalized.includes('998877665544'), 'Long number sequence must be stripped');
            assert.ok(normalized.includes('how to configure oauth for with client id'));
        });

        it('should upsert and increment count for repeated search miss', async () => {
            await supportService.recordSearchMiss('playwright flaky tests');
            await supportService.recordSearchMiss('Playwright Flaky Tests');

            const item = supportService.inMemoryHelpSearchMisses.get('playwright flaky tests');
            assert.ok(item);
            assert.strictEqual(item.count, 2);
        });

        it('should compile admin summary aggregations cleanly', async () => {
            await supportService.recordArticleFeedback({
                articleSlug: 'test-slug',
                helpful: false,
                comment: 'Needs more examples',
                ip: '127.0.0.1'
            });

            await supportService.recordSearchMiss('missing documentation topic');

            const summary = await supportService.getHelpAdminSummary();

            assert.ok(Array.isArray(summary.topUnhelpfulArticles));
            assert.ok(Array.isArray(summary.topMissedSearches));
            assert.ok(typeof summary.requestsByTopic === 'object');
            assert.strictEqual(summary.topUnhelpfulArticles[0].slug, 'test-slug');
            assert.strictEqual(summary.topMissedSearches[0].query, 'missing documentation topic');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 6. System Status Endpoint & Failure Policy
    // ─────────────────────────────────────────────────────────────────────────
    describe('6. System Status & Health Probes', () => {
        it('should return operational status with all 3 components when healthy', async () => {
            const req = createMockReq();
            const res = createMockRes();

            await statusController.getPublicStatus(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.ok(['operational', 'degraded', 'outage'].includes(res.body.status));
            assert.strictEqual(res.body.components.length, 3);
            const componentNames = res.body.components.map(c => c.name);
            assert.ok(componentNames.includes('api'));
            assert.ok(componentNames.includes('database'));
            assert.ok(componentNames.includes('ai_provider'));
            assert.ok(res.headers['Cache-Control'].includes('max-age=30'));
        });

        it('should NEVER return operational when database fails', async () => {
            // Mock database check failure
            const origCheckDb = statusService.checkDatabase;
            statusService.checkDatabase = async () => ({
                name: 'database',
                status: 'outage',
                message: 'Connection refused',
                checkedAt: new Date().toISOString()
            });

            try {
                const req = createMockReq({ query: { fresh: 'true' } });
                const res = createMockRes();

                await statusController.getPublicStatus(req, res);

                assert.strictEqual(res.body.status, 'outage');
                assert.notStrictEqual(res.body.status, 'operational');
            } finally {
                statusService.checkDatabase = origCheckDb;
            }
        });

        it('should return degraded status when a component is degraded', async () => {
            const origCheckDb = statusService.checkDatabase;
            const origCheckAi = statusService.checkAiProvider;
            statusService.checkDatabase = async () => ({
                name: 'database',
                status: 'degraded',
                latencyMs: 1800,
                checkedAt: new Date().toISOString()
            });
            statusService.checkAiProvider = async () => ({
                name: 'ai_provider',
                status: 'operational',
                latencyMs: 120,
                checkedAt: new Date().toISOString()
            });

            try {
                const req = createMockReq({ query: { fresh: 'true' } });
                const res = createMockRes();

                await statusController.getPublicStatus(req, res);

                assert.strictEqual(res.body.status, 'degraded');
                assert.notStrictEqual(res.body.status, 'operational');
            } finally {
                statusService.checkDatabase = origCheckDb;
                statusService.checkAiProvider = origCheckAi;
            }
        });
    });
});
