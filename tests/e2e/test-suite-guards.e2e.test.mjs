import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

describe('TASK 3: Playwright End-to-End Suite Guards & Request Interception', () => {
    let browser;
    let context;
    let page;
    const recordedApiRequests = [];
    let analyzeCalled = false;
    let generateHeadersList = [];
    let generateFailCount = 0;
    let generateSuccessCount = 0;

    before(async () => {
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
            viewport: { width: 1280, height: 800 }
        });

        // Seed authenticated user state into browser localStorage before scripts execute
        await context.addInitScript(() => {
            localStorage.setItem('testnexa_token', 'mock_jwt_test_token_123');
            localStorage.setItem('testnexa_user', JSON.stringify({
                id: 'usr_playwright_guards',
                email: 'guards.playwright@testnexa.ai',
                name: 'Playwright Guards Runner',
                role: 'qa_engineer'
            }));
            localStorage.setItem('testnexa_workspace', JSON.stringify({
                id: 'ws_guards_main',
                name: 'Integrity Verification Workspace'
            }));
        });

        page = await context.newPage();

        // Comprehensive virtual request interception
        await page.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());

            // Track any API traffic to suite/session/draft endpoints
            if (url.pathname.includes('/api/v1/')) {
                const method = request.method();
                const headers = request.headers();
                const postData = request.postData();
                recordedApiRequests.push({
                    method,
                    url: url.href,
                    pathname: url.pathname,
                    headers,
                    postData
                });

                // 1. Analyze endpoint (Stateless)
                if (url.pathname.endsWith('/generate/analyze') || url.pathname.endsWith('/generations/analyze')) {
                    analyzeCalled = true;
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: true,
                            data: {
                                feature: 'Verified Shopping Cart Checkout',
                                business_rules: [
                                    'Cart must contain at least 1 item before proceeding to checkout',
                                    'User must authenticate or provide guest shipping details',
                                    'Payment provider must verify 3DS challenge for transactions over $100'
                                ],
                                inputs: ['Shipping Address', 'Credit Card Token', 'CVV'],
                                outputs: ['Order Confirmation ID', 'Email Invoice'],
                                risk_areas: ['Payment Gateway Timeout', 'Concurrency Race Conditions'],
                                non_functional_signals: { security_sensitive: true, user_facing: true },
                                ambiguities: []
                            }
                        })
                    });
                }

                // 2. Generate endpoint (with Idempotency-Key support)
                if (url.pathname.endsWith('/generate') && method === 'POST') {
                    const idemKey = headers['idempotency-key'] || headers['Idempotency-Key'] || '';
                    generateHeadersList.push({ idemKey, method, url: url.href });

                    // Simulating a failed generation
                    if (route._shouldFailGeneration) {
                        generateFailCount++;
                        return route.fulfill({
                            status: 422,
                            contentType: 'application/json',
                            body: JSON.stringify({
                                success: false,
                                code: 'ZERO_TEST_CASES',
                                message: 'Constraint violation: AI model returned zero valid test cases.'
                            })
                        });
                    }

                    // Successful generation response
                    generateSuccessCount++;
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: true,
                            sessionId: 'sess_guard_atomic_001',
                            testSuiteId: 'sess_guard_atomic_001',
                            data: {
                                feature: 'Verified Shopping Cart Checkout',
                                functional: [
                                    {
                                        id: 'TC-FUNC-01',
                                        title: 'Complete standard checkout with valid credit card',
                                        priority: 'High',
                                        steps: ['Add product', 'Click checkout', 'Submit payment'],
                                        expectedResult: 'Order confirmation page displayed with order number'
                                    }
                                ],
                                negative: [
                                    {
                                        id: 'TC-NEG-01',
                                        title: 'Attempt checkout with expired payment card',
                                        priority: 'Medium',
                                        steps: ['Enter expired card', 'Click submit'],
                                        expectedResult: 'Inline error indicating card is expired'
                                    }
                                ],
                                edge: [],
                                security: [],
                                nonFunctional: [],
                                apiChecklist: [],
                                quality: { score: 98 },
                                metadata: { totalTestCases: 2, generatedAt: new Date().toISOString() }
                            },
                            metadata: {
                                totalTestCases: 2,
                                generatedAt: new Date().toISOString()
                            }
                        })
                    });
                }

                // Default empty responses for other API queries (e.g. sessions list, current workspace, history)
                if (url.pathname.includes('/sessions') || url.pathname.includes('/test-suites')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, sessions: [], data: [], total: 0 })
                    });
                }

                if (url.pathname.includes('/workspaces')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: { id: 'ws_guards_main', name: 'Integrity Verification' } })
                    });
                }

                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true })
                });
            }

            // Static asset serving from Vite dist
            if (url.pathname.startsWith('/assets/')) {
                const assetPath = path.join(DIST_DIR, url.pathname);
                if (fs.existsSync(assetPath)) {
                    const contentType = assetPath.endsWith('.js')
                        ? 'application/javascript'
                        : assetPath.endsWith('.css')
                        ? 'text/css'
                        : 'text/plain';
                    return route.fulfill({
                        status: 200,
                        contentType,
                        body: fs.readFileSync(assetPath)
                    });
                }
            }

            // HTML5 Fallback: Serve dist/index.html
            const indexPath = path.join(DIST_DIR, 'index.html');
            if (fs.existsSync(indexPath)) {
                return route.fulfill({
                    status: 200,
                    contentType: 'text/html; charset=utf-8',
                    body: fs.readFileSync(indexPath, 'utf8')
                });
            }

            return route.abort();
        });
    });

    after(async () => {
        if (browser) await browser.close();
    });

    it('1. Typing in textarea triggers 0 backend suite/draft creation requests', async () => {
        await page.goto('http://app.local/app/workspace');
        await page.waitForSelector('.app-workspace-textarea', { timeout: 10000 });

        recordedApiRequests.length = 0; // Clear requests recorded during page bootstrap

        // Type requirement text into textarea
        const textarea = page.locator('.app-workspace-textarea');
        await textarea.fill('As a customer, I want to add items to my shopping cart, verify inventory, and complete payment with Visa or Mastercard 3D Secure.');

        // Wait to verify no debounce autosave fires any network creation
        await page.waitForTimeout(1500);

        // Check recorded requests for any POST/PUT/PATCH to sessions or suites
        const suiteWriteRequests = recordedApiRequests.filter(r =>
            (r.pathname.includes('/sessions') || r.pathname.includes('/test-suites') || r.pathname.includes('/suites')) &&
            ['POST', 'PUT', 'PATCH'].includes(r.method)
        );

        assert.equal(suiteWriteRequests.length, 0, 'Typing in requirement textarea MUST NOT emit any suite/draft creation or update requests to the backend');

        // Confirm local draft storage in browser localStorage was updated safely without backend mutation
        const localDraft = await page.evaluate(() => localStorage.getItem('testnexa_workspace_draft'));
        assert.ok(localDraft, 'Local draft should be saved in localStorage');
        assert.ok(localDraft.includes('shopping cart'), 'Local draft contains typed requirement');
    });

    it('2. Changing configuration options and steps triggers 0 suite creation requests', async () => {
        recordedApiRequests.length = 0;

        // Switch target platform to Mobile
        const mobileBtn = page.locator('button.app-workspace-seg-btn:has-text("Mobile")');
        if (await mobileBtn.isVisible()) {
            await mobileBtn.click();
        }

        // Switch coverage depth to Comprehensive
        const compDepthBtn = page.locator('button.app-workspace-depth-card:has-text("Comprehensive")');
        if (await compDepthBtn.isVisible()) {
            await compDepthBtn.click();
        }

        // Click "Save draft" button
        const saveDraftBtn = page.locator('button:has-text("Save draft")');
        if (await saveDraftBtn.isVisible()) {
            await saveDraftBtn.click();
        }

        await page.waitForTimeout(600);

        const suiteWriteRequests = recordedApiRequests.filter(r =>
            (r.pathname.includes('/sessions') || r.pathname.includes('/test-suites') || r.pathname.includes('/suites')) &&
            ['POST', 'PUT', 'PATCH'].includes(r.method)
        );

        assert.equal(suiteWriteRequests.length, 0, 'Changing configuration options or clicking Save Draft MUST NOT write suites to the backend');
    });

    it('3. Pressing Analyze calls stateless analyze endpoint and creates ZERO suites', async () => {
        recordedApiRequests.length = 0;
        analyzeCalled = false;

        const analyzeBtn = page.locator('#workspace-analyze-btn');
        await analyzeBtn.waitFor({ state: 'visible', timeout: 5000 });
        await analyzeBtn.click();

        // Wait for analyze response to process
        await page.waitForTimeout(1000);

        assert.ok(analyzeCalled, 'POST /api/v1/generate/analyze must be invoked');

        const suiteWriteRequests = recordedApiRequests.filter(r =>
            (r.pathname.includes('/sessions') || r.pathname.includes('/test-suites') || r.pathname.includes('/suites')) &&
            ['POST', 'PUT', 'PATCH'].includes(r.method)
        );

        assert.equal(suiteWriteRequests.length, 0, 'Analyze requirement MUST be strictly stateless and write NO suite to the backend');
    });

    it('4. A failed generation creates NO suite in the backend', async () => {
        recordedApiRequests.length = 0;
        generateFailCount = 0;

        // Return to workspace form
        await page.goto('http://app.local/app/workspace');
        await page.waitForSelector('.app-workspace-textarea', { timeout: 10000 });

        const textarea = page.locator('.app-workspace-textarea');
        await textarea.fill('An invalid or unsupported requirement that triggers a 422 failure with zero generated cases.');

        // Reconfigure route handler to simulate generation failure
        await page.unroute('**/*');

        await page.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());

            if (url.pathname.includes('/api/v1/')) {
                const method = request.method();
                recordedApiRequests.push({
                    method,
                    url: url.href,
                    pathname: url.pathname
                });

                if (url.pathname.endsWith('/generate') && method === 'POST') {
                    generateFailCount++;
                    return route.fulfill({
                        status: 422,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: false,
                            code: 'ZERO_TEST_CASES',
                            error: 'Constraint violation: AI model returned zero valid test cases.'
                        })
                    });
                }

                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, sessions: [], data: [] })
                });
            }

            if (url.pathname.startsWith('/assets/')) {
                const assetPath = path.join(DIST_DIR, url.pathname);
                if (fs.existsSync(assetPath)) {
                    const contentType = assetPath.endsWith('.js') ? 'application/javascript' : assetPath.endsWith('.css') ? 'text/css' : 'text/plain';
                    return route.fulfill({ status: 200, contentType, body: fs.readFileSync(assetPath) });
                }
            }

            const indexPath = path.join(DIST_DIR, 'index.html');
            return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(indexPath, 'utf8') });
        });

        // Click direct generate button
        const directGenBtn = page.locator('.app-workspace-btn-direct-gen');
        await directGenBtn.click();

        await page.waitForTimeout(1000);

        assert.ok(generateFailCount > 0, 'Generate endpoint must have received the request and returned 422');

        const suiteWriteRequests = recordedApiRequests.filter(r =>
            (r.pathname.includes('/sessions') || r.pathname.includes('/test-suites') || r.pathname.includes('/suites')) &&
            ['POST', 'PUT', 'PATCH'].includes(r.method)
        );

        assert.equal(suiteWriteRequests.length, 0, 'Failed generation must not create or commit any suite record');
    });

    it('5. Double click on Generate includes Idempotency-Key header and creates exactly ONE suite', async () => {
        recordedApiRequests.length = 0;
        generateHeadersList.length = 0;
        generateSuccessCount = 0;

        await page.goto('http://app.local/app/workspace');
        await page.waitForSelector('.app-workspace-textarea', { timeout: 10000 });

        const textarea = page.locator('.app-workspace-textarea');
        await textarea.fill('As an enterprise security administrator, I want to enforce SAML SSO and MFA with Okta identity provider.');

        // Reset virtual route for successful atomic generation
        await page.unroute('**/*');
        await page.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());

            if (url.pathname.includes('/api/v1/')) {
                const method = request.method();
                const headers = request.headers();
                recordedApiRequests.push({
                    method,
                    url: url.href,
                    pathname: url.pathname
                });

                if (url.pathname.endsWith('/generate') && method === 'POST') {
                    const idemKey = headers['idempotency-key'] || headers['Idempotency-Key'] || '';
                    generateHeadersList.push({ idemKey, timestamp: Date.now() });

                    // Artificial network latency
                    await new Promise(r => setTimeout(r, 150));
                    generateSuccessCount++;

                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: true,
                            sessionId: 'sess_idempotent_suite_999',
                            testSuiteId: 'sess_idempotent_suite_999',
                            data: {
                                feature: 'SAML SSO with Okta',
                                functional: [
                                    {
                                        id: 'TC-SAML-01',
                                        title: 'Verify SP-initiated SAML login redirection',
                                        priority: 'High',
                                        steps: ['Click SSO Login', 'Redirected to Okta', 'Enter Okta credentials'],
                                        expectedResult: 'Successfully authenticated to Testnexa'
                                    }
                                ],
                                negative: [],
                                edge: [],
                                security: [],
                                nonFunctional: [],
                                apiChecklist: [],
                                quality: { score: 99 },
                                metadata: { totalTestCases: 1, generatedAt: new Date().toISOString() }
                            },
                            metadata: {
                                totalTestCases: 1,
                                generatedAt: new Date().toISOString()
                            }
                        })
                    });
                }

                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, sessions: [], data: [] })
                });
            }

            if (url.pathname.startsWith('/assets/')) {
                const assetPath = path.join(DIST_DIR, url.pathname);
                if (fs.existsSync(assetPath)) {
                    const contentType = assetPath.endsWith('.js') ? 'application/javascript' : assetPath.endsWith('.css') ? 'text/css' : 'text/plain';
                    return route.fulfill({ status: 200, contentType, body: fs.readFileSync(assetPath) });
                }
            }

            const indexPath = path.join(DIST_DIR, 'index.html');
            return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(indexPath, 'utf8') });
        });

        const directGenBtn = page.locator('.app-workspace-btn-direct-gen');

        // Simulate double-click on generation button
        await Promise.all([
            directGenBtn.click(),
            directGenBtn.click().catch(() => {}) // Ignore if button disabled on second tap
        ]);

        await page.waitForTimeout(1000);

        // Verify Idempotency-Key header presence
        assert.ok(generateHeadersList.length > 0, 'Generation request must be sent');
        const firstIdemKey = generateHeadersList[0].idemKey;
        assert.ok(firstIdemKey && firstIdemKey.length > 5, 'Request MUST contain a valid, non-empty Idempotency-Key header');

        // Verify that generation completed cleanly and exactly one suite was created
        assert.equal(generateSuccessCount, 1, 'Exactly ONE suite generation was processed');
    });
});
