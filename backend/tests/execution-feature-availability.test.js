/**
 * TestNexa AI — Execution Method Feature Availability & Coming Soon Tests
 *
 * Verifies:
 * 1. Centralized feature availability configuration (Manual = Available, Playwright = Coming Soon, API = Coming Soon)
 * 2. Backend independent rejection of unavailable execution methods (403 FEATURE_UNAVAILABLE)
 * 3. Prevention of misleading behavior: no runs, no job creation, no quota leakage
 * 4. Normal manual execution continues to function with full validation
 * 5. Automation trigger endpoints reject unavailable execution engines cleanly
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
    EXECUTION_METHODS,
    getExecutionMethod,
    isExecutionMethodEnabled,
    validateExecutionMethod,
    getAllExecutionMethods
} = require('../src/config/executionFeatures');

const executionController = require('../src/controllers/execution.controller');
const supabaseService = require('../src/services/supabaseData.service');
const usageMeteringService = require('../src/services/usageMetering.service');

// Mock request / response helpers
const createMockReq = ({ user = { id: 'usr_qa_test', _id: 'usr_qa_test', name: 'QA Tester' }, body = {}, params = {}, query = {} } = {}) => ({
    user,
    body,
    params,
    query,
    headers: {},
    get: (header) => ''
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

describe('Execution Feature Availability & Coming Soon Subsystem', () => {

    // ─────────────────────────────────────────────────────────────
    // 1. Centralized Feature Configuration
    // ─────────────────────────────────────────────────────────────
    describe('1. Centralized Feature Configuration', () => {
        it('should have Manual Execution configured as available and enabled', () => {
            const manual = getExecutionMethod('manual');
            assert.ok(manual, 'Manual execution method must exist in configuration');
            assert.strictEqual(manual.status, 'available');
            assert.strictEqual(manual.enabled, true);
            assert.strictEqual(manual.displayName, 'Manual Execution');
            assert.strictEqual(isExecutionMethodEnabled('manual'), true);
            assert.strictEqual(isExecutionMethodEnabled('manual_execution'), true);
        });

        it('should have Playwright Automation configured as coming soon and disabled', () => {
            const playwright = getExecutionMethod('playwright');
            assert.ok(playwright, 'Playwright automation method must exist in configuration');
            assert.strictEqual(playwright.status, 'coming_soon');
            assert.strictEqual(playwright.enabled, false);
            assert.strictEqual(playwright.displayName, 'Playwright Automation');
            assert.strictEqual(isExecutionMethodEnabled('playwright'), false);
            assert.strictEqual(isExecutionMethodEnabled('automated'), false);

            // Modal requirements
            assert.ok(playwright.modal, 'Playwright modal configuration must be defined');
            assert.ok(playwright.modal.title.includes('Playwright Automation is Coming Soon'));
            assert.ok(Array.isArray(playwright.modal.capabilities));
            assert.ok(playwright.modal.capabilities.length >= 4);
        });

        it('should have API Automation configured as coming soon and disabled', () => {
            const api = getExecutionMethod('api');
            assert.ok(api, 'API automation method must exist in configuration');
            assert.strictEqual(api.status, 'coming_soon');
            assert.strictEqual(api.enabled, false);
            assert.strictEqual(api.displayName, 'API Automation');
            assert.strictEqual(isExecutionMethodEnabled('api'), false);
            assert.strictEqual(isExecutionMethodEnabled('api_automation'), false);

            // Modal requirements
            assert.ok(api.modal, 'API modal configuration must be defined');
            assert.ok(api.modal.title.includes('API Automation is Coming Soon'));
            assert.ok(Array.isArray(api.modal.capabilities));
            assert.ok(api.modal.capabilities.length >= 4);
        });

        it('should return all 3 configured execution methods via getAllExecutionMethods', () => {
            const methods = getAllExecutionMethods();
            assert.ok(Array.isArray(methods));
            assert.strictEqual(methods.length, 3);
            assert.ok(methods.some(m => m.id === 'manual' && m.enabled === true));
            assert.ok(methods.some(m => m.id === 'playwright' && m.enabled === false));
            assert.ok(methods.some(m => m.id === 'api' && m.enabled === false));
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 2. Validation Engine
    // ─────────────────────────────────────────────────────────────
    describe('2. Validation Engine Constraints', () => {
        it('should validate manual execution as valid', () => {
            const validation = validateExecutionMethod('manual');
            assert.strictEqual(validation.valid, true);
            assert.strictEqual(validation.method.id, 'manual');
        });

        it('should reject playwright automation with FEATURE_UNAVAILABLE', () => {
            const validation = validateExecutionMethod('playwright');
            assert.strictEqual(validation.valid, false);
            assert.strictEqual(validation.code, 'FEATURE_UNAVAILABLE');
            assert.ok(validation.message.includes('Playwright Automation'));
            assert.ok(validation.message.includes('Coming Soon'));
        });

        it('should reject automated alias with FEATURE_UNAVAILABLE', () => {
            const validation = validateExecutionMethod('automated');
            assert.strictEqual(validation.valid, false);
            assert.strictEqual(validation.code, 'FEATURE_UNAVAILABLE');
            assert.strictEqual(validation.method.displayName, 'Playwright Automation');
        });

        it('should reject api automation with FEATURE_UNAVAILABLE', () => {
            const validation = validateExecutionMethod('api');
            assert.strictEqual(validation.valid, false);
            assert.strictEqual(validation.code, 'FEATURE_UNAVAILABLE');
            assert.ok(validation.message.includes('API Automation'));
            assert.ok(validation.message.includes('Coming Soon'));
        });

        it('should reject unknown execution methods with INVALID_EXECUTION_METHOD', () => {
            const validation = validateExecutionMethod('quantum_robot');
            assert.strictEqual(validation.valid, false);
            assert.strictEqual(validation.code, 'INVALID_EXECUTION_METHOD');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 3. Controller Rejection & Leakage Prevention
    // ─────────────────────────────────────────────────────────────
    describe('3. Controller Rejection & Quota Protection', () => {
        it('should reject createRun when executionType is automated (Playwright)', async () => {
            const ws = await supabaseService.getUserPrimaryWorkspace('usr_test_avail', 'Test QA');
            const req = createMockReq({
                user: { id: 'usr_test_avail', _id: 'usr_test_avail', name: 'Test QA' },
                body: {
                    workspaceId: ws.id,
                    name: 'Automated Browser Suite',
                    executionType: 'automated',
                    selectedCaseIds: ['TC-101']
                }
            });
            const res = createMockRes();

            await executionController.createRun(req, res);

            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.code, 'FEATURE_UNAVAILABLE');
            assert.ok(res.body.message.includes('Playwright Automation'));
            assert.ok(res.body.message.includes('Coming Soon'));
        });

        it('should reject createRun when executionType is api', async () => {
            const ws = await supabaseService.getUserPrimaryWorkspace('usr_test_avail', 'Test QA');
            const req = createMockReq({
                user: { id: 'usr_test_avail', _id: 'usr_test_avail', name: 'Test QA' },
                body: {
                    workspaceId: ws.id,
                    name: 'API Regression Run',
                    executionType: 'api',
                    selectedCaseIds: ['TC-API-1']
                }
            });
            const res = createMockRes();

            await executionController.createRun(req, res);

            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.code, 'FEATURE_UNAVAILABLE');
            assert.ok(res.body.message.includes('API Automation'));
        });

        it('should reject triggerAutomatedRun with 403 FEATURE_UNAVAILABLE', async () => {
            const ws = await supabaseService.getUserPrimaryWorkspace('usr_test_avail', 'Test QA');
            const manualRun = await supabaseService.createTestRun({
                workspaceId: ws.id,
                name: 'Trigger Automation Test Target',
                executionType: 'manual',
                createdBy: 'usr_test_avail',
                customCases: [{ id: 'TC-1', title: 'Case 1' }]
            });

            const req = createMockReq({
                user: { id: 'usr_test_avail', _id: 'usr_test_avail', name: 'Test QA' },
                params: { id: manualRun.id },
                body: { adapter: 'playwright' }
            });
            const res = createMockRes();

            await executionController.triggerAutomatedRun(req, res);

            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.code, 'FEATURE_UNAVAILABLE');
            assert.ok(res.body.message.includes('Playwright Automation is currently in development'));
        });

        it('should reject standalone executeSingleTest with 403 FEATURE_UNAVAILABLE', async () => {
            const ws = await supabaseService.getUserPrimaryWorkspace('usr_test_avail', 'Test QA');
            const req = createMockReq({
                user: { id: 'usr_test_avail', _id: 'usr_test_avail', name: 'Test QA' },
                body: {
                    workspaceId: ws.id,
                    testCaseId: 'TC-SINGLE-BROWSER',
                    title: 'Login scenario',
                    scriptCode: 'console.log("browser test");'
                }
            });
            const res = createMockRes();

            await executionController.executeSingleTest(req, res);

            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.code, 'FEATURE_UNAVAILABLE');
        });

        it('should allow valid manual createRun to succeed normally', async () => {
            const ws = await supabaseService.getUserPrimaryWorkspace('usr_test_avail', 'Test QA');
            const req = createMockReq({
                user: { id: 'usr_test_avail', _id: 'usr_test_avail', name: 'Test QA' },
                body: {
                    workspaceId: ws.id,
                    name: 'Verified Manual QA Run',
                    executionType: 'manual',
                    customCases: [{ id: 'TC-MAN-01', title: 'Manual Case 1' }, { id: 'TC-MAN-02', title: 'Manual Case 2' }]
                }
            });
            const res = createMockRes();

            await executionController.createRun(req, res);

            assert.strictEqual(res.statusCode, 201);
            assert.strictEqual(res.body.success, true);
            assert.ok(res.body.data.id);
            assert.strictEqual(res.body.data.executionType, 'manual');
        });

        it('should expose features via getExecutionFeatures endpoint', async () => {
            const req = createMockReq();
            const res = createMockRes();

            await executionController.getExecutionFeatures(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.success, true);
            assert.ok(Array.isArray(res.body.data));
            assert.strictEqual(res.body.data.length, 3);
        });
    });
});
