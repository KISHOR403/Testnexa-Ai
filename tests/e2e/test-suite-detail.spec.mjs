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

describe('Test Suite Detail (/app/test-suites/:id) Responsive & Design Verification', () => {
    let browser;
    let context;
    let page;

    // 19 test cases specification for mock suite
    const mockCases = Array.from({ length: 19 }, (_, i) => ({
        id: i === 0 ? 'TC_FUNC_LOGIN_001' : `TC_FUNC_LOGIN_${String(i + 1).padStart(3, '0')}`,
        title: i === 0 ? 'Successful Login with Valid Credentials' : `Authentication Scenario ${i + 1}`,
        type: i < 12 ? 'Functional' : i < 16 ? 'Negative' : 'Edge Case',
        priority: i % 4 === 0 ? 'High' : 'Medium',
        severity: 'Major',
        status: 'Needs Review',
        requirementId: `REQ_LOGIN_${String((i % 3) + 1).padStart(3, '0')}`,
        preconditions: ['Standard browser sandbox initialized.'],
        steps: [
            { action: 'Navigate to login interface', expected: 'Form visible' },
            { action: 'Submit test credentials', expected: 'Authentication token granted' }
        ],
        expectedResult: 'User logged in successfully'
    }));

    const mockSuiteResponse = {
        success: true,
        data: {
            id: 'suite-auth-detail-001',
            title: 'User Authentication',
            requirement: 'Core user identity and authentication workflows including single sign-on, multi-factor tokens, and session invalidation boundaries.',
            status: 'Active',
            accessRole: 'owner',
            createdAt: '2026-09-13T10:00:00Z',
            updatedAt: '2026-09-13T10:00:00Z',
            suiteData: {
                id: 'suite-auth-detail-001',
                testSuiteName: 'User Authentication',
                description: 'Core user identity and authentication workflows including single sign-on, multi-factor tokens, and session invalidation boundaries.',
                feature: 'User Authentication',
                projectName: 'Identity Core',
                suiteStatus: 'Active',
                testCases: mockCases,
                functional: mockCases.slice(0, 12),
                negative: mockCases.slice(12, 16),
                edge: mockCases.slice(16, 19),
                apiChecklist: [
                    { id: 'CHK_1', title: 'API Check 1' },
                    { id: 'CHK_2', title: 'API Check 2' },
                    { id: 'CHK_3', title: 'API Check 3' },
                    { id: 'CHK_4', title: 'API Check 4' },
                    { id: 'CHK_5', title: 'API Check 5' }
                ]
            }
        }
    };

    before(async () => {
        if (!fs.existsSync(SCREENSHOTS_DIR)) {
            fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
        }

        browser = await chromium.launch({ headless: true });
        context = await browser.newContext();

        // Inject mock authenticated session
        await context.addInitScript(() => {
            localStorage.setItem('testnexa_token', 'mock_jwt_detail_token');
            localStorage.setItem('testnexa_user', JSON.stringify({
                id: 'usr_test_detail',
                email: 'qa.lead@testnexa.ai',
                name: 'QA Lead',
                role: 'owner'
            }));
            localStorage.setItem('testnexa_workspace', JSON.stringify({
                id: 'ws_auth_test',
                name: 'Identity Test Workspace'
            }));
        });

        page = await context.newPage();

        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER PAGEERROR:', err.message));

        // Route interception
        await page.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());

            // Handle API mocks (must ONLY match API routes, never the browser document route)
            if (url.pathname.startsWith('/api/v1/') || url.pathname.startsWith('/api/')) {
                if (url.pathname.includes('/sessions/suite-auth-detail-001') || url.pathname.includes('/test-suites/suite-auth-detail-001')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify(mockSuiteResponse)
                    });
                }

                if (url.pathname.endsWith('/sessions') || url.pathname.endsWith('/test-suites') || url.pathname.includes('/sessions?') || url.pathname.includes('/test-suites?')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: [mockSuiteResponse.data], total: 1 })
                    });
                }

                if (url.pathname.includes('/runs') || url.pathname.includes('/executions')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: [] })
                    });
                }

                if (url.pathname.includes('/workspaces')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: { id: 'ws_auth_test', name: 'Identity Test Workspace' } })
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

    const viewports = [
        { width: 1920, height: 1080, name: '1920' },
        { width: 1440, height: 900, name: '1440' },
        { width: 1024, height: 768, name: '1024' },
        { width: 768, height: 1024, name: '768' },
        { width: 390, height: 844, name: '390' }
    ];

    for (const vp of viewports) {
        it(`Verifies layout, styles, counts and captures screenshot at ${vp.name}px (${vp.width}x${vp.height})`, async () => {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto('http://app.local/app/test-suites/suite-auth-detail-001');

            // Wait for header and detail page to render
            await page.waitForSelector('.test-suite-detail-page', { timeout: 10000 });
            await page.waitForSelector('.tsd-title', { timeout: 10000 });

            // 1. Verify Header & Breadcrumb
            const titleText = await page.locator('.tsd-title').textContent();
            assert.equal(titleText.trim(), 'User Authentication');

            // Breadcrumb: "Test suites > User Authentication"
            const breadcrumbText = await page.locator('.tsd-breadcrumb').textContent();
            assert.ok(breadcrumbText.includes('Test suites'));
            assert.ok(breadcrumbText.includes('User Authentication'));

            // Never show raw database ID in header
            assert.ok(!breadcrumbText.includes('suite-auth-detail-001'), 'Breadcrumb must not show raw database ID');
            const hasRawEyebrow = await page.locator('.sm-eyebrow').count();
            assert.equal(hasRawEyebrow, 0, 'No raw ID eyebrow in header');

            // Meta line: "Active · 19 cases · 0 runs · Updated Sep 13, 2026"
            const metaLine = await page.locator('.tsd-meta-line').textContent();
            assert.ok(metaLine.includes('Active'), 'Meta line should include Active status');
            assert.ok(metaLine.includes('19 cases'), 'Meta line should show canonical 19 cases');
            assert.ok(metaLine.includes('0 runs'), 'Meta line should show 0 runs');
            assert.ok(metaLine.includes('Updated Sep 13, 2026'), 'Meta line should show formatted date');

            // 2. Verify Canonical Counts Agreement Across All Blocks
            // Stats Strip: first stat is Cases: 19
            const statValues = await page.locator('.tsd-stat-val').allTextContents();
            assert.equal(statValues[0].trim(), '19', 'Stats strip Cases must be 19');
            assert.equal(statValues[1].trim(), '0', 'Stats strip Approved must be 0');
            assert.equal(statValues[5].trim(), '0', 'Stats strip Runs must be 0');

            // Review Progress: "0 of 19 approved"
            const reviewCountText = await page.locator('.tsd-review-count').textContent();
            assert.ok(reviewCountText.includes('0 of 19 approved'), 'Review progress must show 0 of 19 approved');

            // Test cases tab badge: "19"
            const tabBadge = await page.locator('.tn-app-tab__badge').first().textContent();
            assert.equal(tabBadge.trim(), '19', 'Tab badge must show 19');

            // 3. Computed Styles Verification (No default blue links, buttons have padding)
            const primaryBtn = page.locator('.tsd-btn-primary').first();
            const btnPadding = await primaryBtn.evaluate((el) => {
                const style = window.getComputedStyle(el);
                return {
                    paddingTop: parseFloat(style.paddingTop),
                    paddingLeft: parseFloat(style.paddingLeft),
                    background: style.backgroundColor
                };
            });
            assert.ok(btnPadding.paddingTop > 0, 'Primary button must have padding');
            assert.ok(btnPadding.paddingLeft > 0, 'Primary button must have padding');

            // Verify breadcrumb link color is NOT default browser blue rgb(0, 0, 238)
            const linkColor = await page.locator('.tsd-breadcrumb-link').evaluate((el) => {
                return window.getComputedStyle(el).color;
            });
            assert.notEqual(linkColor, 'rgb(0, 0, 238)', 'Link color must not be default unstyled browser blue');

            // 4. Verify No Horizontal Page Scroll
            const isScrollableX = await page.evaluate(() => {
                return document.documentElement.scrollWidth > window.innerWidth + 2;
            });
            assert.equal(isScrollableX, false, `Page must not have horizontal scroll at ${vp.width}px`);

            // 5. Drawer behavior below 1024px:
            if (vp.width <= 1024) {
                // Click first test case row to open detail panel
                const firstRow = page.locator('.tn-test-row').first();
                if (await firstRow.isVisible()) {
                    await firstRow.click();
                } else {
                    const mobileCard = page.locator('.tn-qa-mobile-card').first();
                    if (await mobileCard.isVisible()) {
                        await mobileCard.click();
                    }
                }

                const detailPane = page.locator('.tn-app-detail-pane');
                await detailPane.waitFor({ state: 'visible', timeout: 5000 });
                const position = await detailPane.evaluate((el) => window.getComputedStyle(el).position);
                assert.equal(position, 'fixed', 'Detail panel must be fixed overlay drawer below 1024px');
            }

            // Capture and save screenshot
            const screenshotPath = path.join(SCREENSHOTS_DIR, `test-suite-detail-${vp.name}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            assert.ok(fs.existsSync(screenshotPath), `Screenshot must exist at ${screenshotPath}`);
        });
    }
});
