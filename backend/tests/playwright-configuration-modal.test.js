const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const executionController = require('../src/controllers/execution.controller');
const automationInventory = require('../src/services/runner/automationInventory.service');
const scriptValidator = require('../src/services/runner/scriptValidator.service');
const templateGenerator = require('../src/services/runner/templateGenerator.service');
const { executeSinglePlaywrightTest } = require('../src/services/runner/playwrightRunner.worker');

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

const createMockReq = (user, params = {}, body = {}) => ({
    user,
    params,
    body,
    ip: '127.0.0.1',
    get(header) {
        if (header.toLowerCase() === 'user-agent') return 'node-test-agent';
        return '';
    }
});

test('Playwright Automation Configuration Modal & Verification Suite (13 Scenarios)', async (t) => {
    supabaseService.workspacesTableAvailable = false;
    supabaseService.sessionsTableAvailable = false;
    supabaseService.executionTablesAvailable = false;

    const timestamp = Date.now();
    const authorizedUser = {
        id: `usr_auth_${timestamp}`,
        _id: `usr_auth_${timestamp}`,
        name: 'Lead QA Engineer',
        email: `lead_${timestamp}@testnexa.ai`
    };

    const externalUser = {
        id: `usr_ext_${timestamp}`,
        _id: `usr_ext_${timestamp}`,
        name: 'External Hacker',
        email: `ext_${timestamp}@external.org`
    };

    let targetWorkspaceId;
    let externalWorkspaceId;
    let testRunId;
    let testRunCaseId;

    await t.test('Initial Setup: Initialize Test Run & Isolated Tenancy Context', async () => {
        const ws = await supabaseService.getUserPrimaryWorkspace(authorizedUser.id, authorizedUser.name);
        targetWorkspaceId = ws.id;

        const extWs = await supabaseService.getUserPrimaryWorkspace(externalUser.id, externalUser.name);
        externalWorkspaceId = extWs.id;

        // Create sample run
        const runRes = createMockRes();
        await executionController.createRun(createMockReq(authorizedUser, {}, {
            workspaceId: targetWorkspaceId,
            name: 'Playwright Configuration Verification Run',
            executionType: 'automated',
            targetEnvironment: {
                name: 'Staging E2E',
                baseUrl: 'https://example.com'
            },
            customCases: [
                {
                    testCaseId: 'TC_FUNC_CHK_002',
                    title: 'Checkout with No Coupon, Express Shipping',
                    module: 'Checkout',
                    testScenario: 'Customer completes checkout using express shipping with no discounts applied',
                    expectedResult: 'Order confirmation page displayed with express delivery fee and total verified',
                    steps: [
                        'Navigate to /checkout',
                        'Verify coupon code field is empty',
                        'Select Express Shipping option',
                        'Enter valid payment details using approved card',
                        'Submit checkout and verify confirmation number'
                    ],
                    testData: 'Card: 4111-2222-3333-4444, Shipping: Express'
                }
            ]
        }), runRes);

        assert.equal(runRes.statusCode, 201);
        testRunId = runRes.data.data.id;
        const cases = await supabaseService.getRunCases(testRunId);
        assert.ok(cases.length > 0);
        testRunCaseId = cases[0].id;
        assert.ok(testRunId);
        assert.ok(testRunCaseId);
    });

    await t.test('Scenario 1: List approved test suites and tests inventory from repository', async () => {
        const res = createMockRes();
        await executionController.listAutomationInventory(createMockReq(authorizedUser), res);

        assert.equal(res.statusCode, 200);
        assert.ok(res.data.success);
        assert.ok(Array.isArray(res.data.data));
        assert.ok(res.data.data.length >= 3, 'Should discover checkout, auth, and navigation suites');

        const checkoutSuite = res.data.data.find(s => s.module === 'checkout' || s.file.includes('checkout'));
        assert.ok(checkoutSuite, 'Checkout suite must exist in inventory');
        assert.ok(checkoutSuite.tests.length >= 2, 'Checkout suite must have registered tests');

        const expressTest = checkoutSuite.tests.find(t => t.testId === 'checkout-express-shipping-no-coupon');
        assert.ok(expressTest, 'Express shipping test must exist in inventory');
        assert.ok(expressTest.code.includes('page.goto'), 'Test code must be discoverable');
    });

    await t.test('Scenario 2: Reject non-existent spec file reference', async () => {
        const res = createMockRes();
        await executionController.validateCaseScript(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }, {
            scriptSource: 'existing',
            scriptRef: 'tests/e2e/ghost_suite.spec.js#non-existent-test',
            automationTestId: 'non-existent-test'
        }), res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.valid, false);
        assert.ok(res.data.data.errors.some(e => e.includes('does not exist') || e.includes('not found')));
    });

    await t.test('Scenario 3: Reject missing or invalid Automation Test ID', async () => {
        const res = createMockRes();
        await executionController.validateCaseScript(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }, {
            scriptSource: 'custom',
            automationTestId: '   ',
            scriptCode: 'async (page, expect) => { await page.goto("/"); }'
        }), res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.valid, false);
        assert.ok(res.data.data.errors.some(e => e.includes('Automation Test ID is required')));
    });

    await t.test('Scenario 4: Detect JavaScript syntax error without crashing worker', async () => {
        const brokenScript = `async (page, expect) => {
            await page.goto('/login'
            // Missing closing parenthesis and bracket
        `;
        const res = createMockRes();
        await executionController.validateCaseScript(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }, {
            scriptSource: 'custom',
            automationTestId: 'syntax-error-test',
            scriptCode: brokenScript
        }), res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.valid, false);
        assert.ok(res.data.data.errors.some(e => e.includes('JavaScript Syntax Error')));
    });

    await t.test('Scenario 5: Validate syntactically valid Playwright custom script', async () => {
        const validScript = `async (page, expect) => {
            await page.goto('/checkout');
            const root = page.locator('#root');
            await expect(root).toBeVisible();
        }`;
        const res = createMockRes();
        await executionController.validateCaseScript(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }, {
            scriptSource: 'custom',
            automationTestId: 'valid-custom-test',
            scriptCode: validScript
        }), res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.valid, true);
        assert.equal(res.data.data.errors.length, 0);
    });

    await t.test('Scenario 6: Security Audit: Reject prohibited APIs (child_process, process.exit)', async () => {
        const maliciousScript = `async (page, expect) => {
            const cp = require('child_process');
            cp.execSync('calc.exe');
            process.exit(1);
        }`;
        const res = createMockRes();
        await executionController.validateCaseScript(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }, {
            scriptSource: 'custom',
            automationTestId: 'security-exploit',
            scriptCode: maliciousScript
        }), res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.valid, false);
        assert.ok(res.data.data.errors.some(e => e.includes('Security Violation')));
    });

    await t.test('Scenario 7: Real Playwright dry-run captures assertion failure and screenshot', async () => {
        const failingScript = `async (page, expect) => {
            await page.goto('/');
            // Deliberate failing assertion
            expect('apple').toBe('orange');
        }`;
        const res = createMockRes();
        await executionController.testCaseScript(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }, {
            scriptSource: 'custom',
            automationTestId: 'dry-run-fail',
            scriptCode: failingScript,
            executionTimeout: 5000
        }), res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.success, false);
        assert.equal(res.data.data.status, 'failed');
        assert.ok(res.data.data.errorMessage.includes('apple') || res.data.data.errorMessage.includes('orange'));
        assert.ok(res.data.data.screenshotBase64, 'Failure screenshot artifact must be captured');
    });

    await t.test('Scenario 8: Real Playwright dry-run executes and passes with real Chromium', async () => {
        const passingScript = `async (page, expect) => {
            await page.goto('/');
            const title = await page.title();
            expect(title).toBeTruthy();
        }`;
        const res = createMockRes();
        await executionController.testCaseScript(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }, {
            scriptSource: 'custom',
            automationTestId: 'dry-run-pass',
            scriptCode: passingScript,
            executionTimeout: 8000
        }), res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.success, true);
        assert.equal(res.data.data.status, 'passed');
        assert.ok(res.data.data.durationMs > 0);
    });

    await t.test('Scenario 9: Configuration warning emitted when target environment or fixtures are missing', async () => {
        const template = templateGenerator.generateTemplate({
            title: 'Unconfigured Flow',
            steps: []
        }, { baseUrl: '' });

        assert.ok(template.warnings.length > 0);
        assert.ok(template.warnings.some(w => w.includes('baseUrl is not defined')));
    });

    await t.test('Scenario 10: Multi-tenant isolation: Reject cross-workspace validation and testing (403)', async () => {
        const resVal = createMockRes();
        await executionController.validateCaseScript(createMockReq(externalUser, { id: testRunId, caseId: testRunCaseId }, {
            automationTestId: 'cross-ws-attack'
        }), resVal);
        assert.equal(resVal.statusCode, 403);

        const resDry = createMockRes();
        await executionController.testCaseScript(createMockReq(externalUser, { id: testRunId, caseId: testRunCaseId }, {
            automationTestId: 'cross-ws-attack'
        }), resDry);
        assert.equal(resDry.statusCode, 403);
    });

    await t.test('Scenario 11: Prevent enabling an invalid script via updateCaseAutomationMapping', async () => {
        const res = createMockRes();
        await executionController.updateCaseAutomationMapping(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }, {
            framework: 'playwright',
            automationTestId: 'cannot-enable',
            scriptSource: 'custom',
            scriptCode: 'eval("malicious_exploit()");',
            mappingStatus: 'enabled' // Attempting to enable broken code
        }), res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.equal(res.data.code, 'INVALID_SCRIPT_CONFIGURATION');
    });

    await t.test('Scenario 12: Save mapping, edit, and preserve version history', async () => {
        // Version 1: Save draft
        const res1 = createMockRes();
        await executionController.updateCaseAutomationMapping(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }, {
            framework: 'playwright',
            automationTestId: 'checkout-v1',
            scriptSource: 'custom',
            scriptRef: 'tests/e2e/checkout.spec.js#checkout-v1',
            scriptCode: 'async (p, exp) => { await p.goto("/"); }',
            scriptVersion: '1.0.0',
            mappingStatus: 'draft'
        }), res1);

        assert.equal(res1.statusCode, 200);

        // Version 2: Update with new code and validate
        const res2 = createMockRes();
        await executionController.updateCaseAutomationMapping(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }, {
            framework: 'playwright',
            automationTestId: 'checkout-v2',
            scriptSource: 'custom',
            scriptRef: 'tests/e2e/checkout.spec.js#checkout-v2',
            scriptCode: 'async (p, exp) => { await p.goto("/checkout"); exp(true).toBe(true); }',
            scriptVersion: '1.1.0',
            mappingStatus: 'validated'
        }), res2);

        assert.equal(res2.statusCode, 200);

        // Fetch refreshed case to verify version history
        const refreshed = await supabaseService.getRunCaseById(testRunCaseId);
        const mapping = refreshed.caseSnapshot.automationMapping;

        assert.equal(mapping.version, 3, 'Version should increment on successive saves');
        assert.ok(Array.isArray(mapping.versionHistory));
        assert.ok(mapping.versionHistory.length >= 1, 'Prior revision must be recorded in version history');
        assert.equal(mapping.versionHistory[0].automationTestId, 'checkout-v1');
    });

    await t.test('Scenario 13: Scenario-specific template generation matching TC_FUNC_CHK_002', async () => {
        const res = createMockRes();
        await executionController.suggestCaseTemplate(createMockReq(authorizedUser, { id: testRunId, caseId: testRunCaseId }), res);

        assert.equal(res.statusCode, 200);
        assert.ok(res.data.success);
        assert.equal(res.data.data.scenarioType, 'checkout');

        const code = res.data.data.scriptCode;
        assert.ok(code.includes('/checkout'), 'Must navigate to checkout flow');
        assert.ok(code.includes('coupon'), 'Must verify no coupon is applied');
        assert.ok(code.includes('express'), 'Must select express shipping');
        assert.ok(code.includes('order'), 'Must verify order confirmation');
    });
});
