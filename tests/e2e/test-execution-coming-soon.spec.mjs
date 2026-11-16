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
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'tests/screenshots');

describe('Test Execution Feature Flag & Coming Soon Dialog Verification', () => {
    let browser;
    let context;
    let page;
    const requestedEndpoints = [];

    const mockSuites = [
        {
            id: 'suite-auth-detail-001',
            sessionId: 'suite-auth-detail-001',
            name: 'User Authentication Suite',
            title: 'User Authentication Suite',
            description: 'Core login and authentication scenarios',
            platform: 'Web',
            totalCases: 19,
            testCasesCount: 19,
            requirementsCount: 5,
            status: 'Active',
            updatedAt: '2026-11-16T12:40:00.000Z',
            testCases: Array.from({ length: 19 }, (_, i) => ({
                id: `TC_FUNC_AUTH_${String(i + 1).padStart(3, '0')}`,
                title: `Authentication Scenario ${i + 1}`,
                type: 'Functional',
                priority: 'High',
                severity: 'Major',
                status: 'ready'
            }))
        }
    ];

    before(async () => {
        if (!fs.existsSync(SCREENSHOTS_DIR)) {
            fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
        }

        browser = await chromium.launch({ headless: true });
        context = await browser.newContext();

        await context.addInitScript(() => {
            sessionStorage.setItem('testnexa_app_initialized', 'true');
            localStorage.setItem('testnexa_token', 'mock_jwt_test_token');
            localStorage.setItem('testnexa_user', JSON.stringify({
                id: 'usr_qa_lead',
                email: 'qa@testnexa.ai',
                name: 'QA Lead',
                role: 'owner'
            }));
            localStorage.setItem('testnexa_workspace', JSON.stringify({
                id: 'ws_qa_main',
                name: 'Main QA Workspace'
            }));
        });

        page = await context.newPage();

        page.on('console', msg => {
            if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
        });
        page.on('pageerror', err => console.log('BROWSER PAGEERROR:', err.message));

        await page.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());

            if (url.pathname.startsWith('/api/v1/') || url.pathname.startsWith('/api/')) {
                requestedEndpoints.push({ method: request.method(), url: url.pathname });

                // Feature flags endpoint
                if (url.pathname.includes('/features')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: true,
                            features: {
                                testRuns: {
                                    enabled: false,
                                    title: 'Test execution',
                                    description: 'Manual and Playwright runs are currently in development. You can already create test suites, link requirements, and trace coverage.'
                                }
                            }
                        })
                    });
                }

                // Auth verify session
                if (url.pathname.includes('/auth/me') || url.pathname.includes('/auth/session')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: true,
                            user: { id: 'usr_qa_lead', name: 'QA Lead', email: 'qa@testnexa.ai' },
                            workspace: { id: 'ws_qa_main', name: 'Main QA Workspace' }
                        })
                    });
                }

                // Workspaces
                if (url.pathname.includes('/workspaces')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: true,
                            data: [{ id: 'ws_qa_main', name: 'Main QA Workspace' }]
                        })
                    });
                }

                // Suites endpoint
                if (url.pathname.includes('/test-suites') || url.pathname.includes('/sessions')) {
                    if (url.pathname.includes('suite-auth-detail-001')) {
                        return route.fulfill({
                            status: 200,
                            contentType: 'application/json',
                            body: JSON.stringify({ success: true, data: mockSuites[0] })
                        });
                    }
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: mockSuites })
                    });
                }

                // Runs endpoint - returns empty list when disabled
                if (url.pathname.includes('/runs')) {
                    if (request.method() !== 'GET') {
                        return route.fulfill({
                            status: 501,
                            contentType: 'application/json',
                            body: JSON.stringify({
                                code: 'FEATURE_DISABLED',
                                feature: 'testRuns',
                                message: 'Test execution is coming soon.'
                            })
                        });
                    }
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20 } })
                    });
                }

                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: {} })
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

            // Fallback to index.html for SPA client-side routing
            const indexPath = path.join(DIST_DIR, 'index.html');
            if (fs.existsSync(indexPath)) {
                return route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: fs.readFileSync(indexPath)
                });
            }

            return route.abort();
        });
    });

    after(async () => {
        if (browser) {
            await browser.close();
        }
    });

    it('1. /app/runs displays Coming Soon panel with 4 planned items and Soon tag', async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('http://app.local/app/runs');

        const heading = page.locator('text=Test execution is coming soon').first();
        await heading.waitFor({ state: 'visible', timeout: 10000 });
        assert.ok(await heading.isVisible(), 'Coming soon heading must be visible');

        const soonTag = page.locator('.test-runs-title-row .cs-tag-soon');
        assert.ok(await soonTag.isVisible(), 'Soon tag must be visible beside page title');

        const plannedPanel = page.locator('[data-testid="test-runs-cs-panel"]');
        assert.ok(await plannedPanel.isVisible(), 'Planned features panel must be visible');

        // Verify planned items
        const text = await plannedPanel.textContent();
        assert.ok(text.includes('Manual step-by-step test execution'), 'Must mention manual execution');
        assert.ok(text.includes('Headless Playwright runner'), 'Must mention Playwright runner');
        assert.ok(text.includes('Trace capture'), 'Must mention trace capture');

        // Check action buttons
        const tcLink = page.locator('a:has-text("View test cases")');
        const tsLink = page.locator('a:has-text("Back to test suites")');
        assert.ok(await tcLink.isVisible(), 'View test cases link must be visible');
        assert.ok(await tsLink.isVisible(), 'Back to test suites link must be visible');
    });

    it('2. Clicking "New Test Run" opens ComingSoonDialog without firing run mutations', async () => {
        const newRunBtn = page.locator('button:has-text("New Test Run")');
        await newRunBtn.click();

        const dialog = page.locator('[data-testid="coming-soon-dialog"]');
        await dialog.waitFor({ state: 'visible', timeout: 5000 });
        assert.ok(await dialog.isVisible(), 'Dialog must open on click');

        // Confirm dialog accessible roles
        assert.strictEqual(await dialog.getAttribute('role'), 'dialog');
        assert.strictEqual(await dialog.getAttribute('aria-modal'), 'true');

        // Close via Esc key
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });
        assert.ok(!(await dialog.isVisible()), 'Dialog must close on Esc');

        // Ensure no POST /runs mutations were issued
        const runMutations = requestedEndpoints.filter(r => r.method === 'POST' && r.url.includes('/runs'));
        assert.strictEqual(runMutations.length, 0, 'No run mutation requests should be issued');
    });

    it('3. Direct navigation to /app/test-runs/new redirects to /app/runs and opens dialog', async () => {
        await page.goto('http://app.local/app/test-runs/new');
        await page.waitForURL('**/app/runs', { timeout: 10000 });

        // URL redirected
        assert.ok(page.url().includes('/app/runs'), 'Must redirect to /app/runs');

        // Dialog opened
        const dialog = page.locator('[data-testid="coming-soon-dialog"]');
        await dialog.waitFor({ state: 'visible', timeout: 5000 });
        assert.ok(await dialog.isVisible(), 'Dialog must open automatically upon deep link navigation');

        // Close via confirm button "Got it"
        const confirmBtn = page.locator('[data-testid="coming-soon-confirm"]');
        await confirmBtn.click();
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    });

    it('4. Test Suites list inline Run button shows Soon tag and opens dialog', async () => {
        await page.goto('http://app.local/app/test-suites');

        const miniRunBtn = page.locator('.ts-btn-mini-run').first();
        await miniRunBtn.waitFor({ state: 'visible', timeout: 10000 });

        const btnText = await miniRunBtn.textContent();
        assert.ok(btnText.includes('Soon'), 'Mini run button must show Soon tag');

        await miniRunBtn.click();
        const dialog = page.locator('[data-testid="coming-soon-dialog"]');
        await dialog.waitFor({ state: 'visible', timeout: 5000 });
        assert.ok(await dialog.isVisible(), 'Dialog must open from suites list run button');

        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    });

    it('5. Test Suite Detail "Run suite" and Execution history show Soon tag and open dialog', async () => {
        await page.goto('http://app.local/app/test-suites/suite-auth-detail-001');

        // Header "Run suite" button
        const runSuiteBtn = page.locator('button.tsd-btn-primary:has-text("Run suite")');
        await runSuiteBtn.waitFor({ state: 'visible', timeout: 10000 });
        assert.ok(await runSuiteBtn.isVisible(), 'Run suite button must be visible');
        assert.ok((await runSuiteBtn.textContent()).includes('Soon'), 'Run suite button must show Soon tag');

        await runSuiteBtn.click();
        const dialog = page.locator('[data-testid="coming-soon-dialog"]');
        await dialog.waitFor({ state: 'visible', timeout: 5000 });
        assert.ok(await dialog.isVisible(), 'Dialog must open from Run suite button');

        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });

        // Execution history section empty state
        const historyTitle = page.locator('.tsd-empty-title:has-text("Test execution is coming soon")');
        await historyTitle.waitFor({ state: 'visible', timeout: 5000 });
        assert.ok(await historyTitle.isVisible(), 'History title must say coming soon');

        const runHistoryBtn = page.locator('button.tsd-btn-primary:has-text("Run this suite")');
        await runHistoryBtn.click();
        await dialog.waitFor({ state: 'visible', timeout: 5000 });
        assert.ok(await dialog.isVisible(), 'Dialog must open from execution history button');

        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    });

    it('6. Capture screenshots across 5 viewports (1920, 1440, 1024, 768, 390)', async () => {
        const viewports = [
            { width: 1920, height: 1080, name: 'desktop-1920' },
            { width: 1440, height: 900, name: 'desktop-1440' },
            { width: 1024, height: 768, name: 'tablet-landscape-1024' },
            { width: 768, height: 1024, name: 'tablet-portrait-768' },
            { width: 390, height: 844, name: 'mobile-sheet-390' }
        ];

        for (const vp of viewports) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto('http://app.local/app/runs');

            await page.waitForSelector('[data-testid="test-runs-cs-panel"]', { timeout: 10000 });

            // Screenshot of Test Runs Page with Coming Soon panel
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, `test-runs-page-${vp.name}.png`),
                fullPage: true
            });

            // Open dialog
            const newRunBtn = page.locator('button:has-text("New Test Run")');
            await newRunBtn.click();
            const dialog = page.locator('[data-testid="coming-soon-dialog"]');
            await dialog.waitFor({ state: 'visible', timeout: 5000 });

            // Screenshot of Dialog / Bottom sheet
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, `coming-soon-dialog-${vp.name}.png`),
                fullPage: false
            });

            await page.keyboard.press('Escape');
            await dialog.waitFor({ state: 'hidden', timeout: 5000 });
        }

        assert.ok(fs.existsSync(path.join(SCREENSHOTS_DIR, 'coming-soon-dialog-mobile-sheet-390.png')));
    });
});
