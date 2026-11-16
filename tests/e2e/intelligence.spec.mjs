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
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'tests/screenshots/intelligence');

describe('QA Health & Authoring Intelligence Dashboard E2E & Visual Verification', () => {
    let browser;
    let context;
    let page;

    const mockSuites = [
        {
            id: 'suite-auth-001',
            title: 'Authentication & Session Security Suite',
            name: 'Authentication & Session Security Suite',
            platform: 'Web',
            totalCases: 19,
            activeCount: 19,
            archivedCount: 0,
            updatedAt: '2026-11-16T12:40:00.000Z'
        }
    ];

    const mockOverview = {
        suiteId: 'all',
        totals: {
            suites: 1,
            cases: 19,
            requirements: 5
        },
        review: {
            approved: 19,
            notApproved: 0,
            approvalPct: 100
        },
        traceability: {
            linkedPct: 100,
            verifiedPct: 0,
            requirementsLinked: 5,
            requirementsTotal: 5
        },
        byType: {
            functional: 12,
            negative: 4,
            edge: 2,
            nonFunctional: 1,
            api: 0
        },
        byPriority: {
            high: 8,
            medium: 9,
            low: 2
        },
        gaps: [
            {
                type: 'single_test',
                title: 'Single test coverage',
                description: '2 high/critical priority requirements rely on only 1 test case.',
                count: 2,
                suiteId: 'all',
                suiteName: 'All suites'
            },
            {
                type: 'missing_negative_or_security',
                title: 'Missing negative or edge validation',
                description: '1 high priority requirement lacks negative, edge or security tests.',
                count: 1,
                suiteId: 'all',
                suiteName: 'All suites'
            }
        ],
        activity: Array.from({ length: 30 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (29 - i));
            return {
                date: d.toISOString().split('T')[0],
                suitesCreated: i === 25 ? 1 : 0,
                casesApproved: i === 25 ? 19 : 0
            };
        }),
        features: {
            testRuns: false
        },
        updatedAt: '2026-11-16T12:40:00.000Z'
    };

    before(async () => {
        if (!fs.existsSync(SCREENSHOTS_DIR)) {
            fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
        }

        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
            viewport: { width: 1440, height: 900 }
        });

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
                id: 'ws_auth_test',
                name: 'Identity Test Workspace'
            }));
        });

        page = await context.newPage();

        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER PAGEERROR:', err.message));

        // Intercept assets and API endpoints
        await page.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());

            if (url.pathname.startsWith('/api/v1/') || url.pathname.startsWith('/api/')) {
                if (url.pathname.includes('/traceability/suites')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: mockSuites })
                    });
                }

                if (url.pathname.includes('/intelligence/overview')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: mockOverview })
                    });
                }

                if (url.pathname.includes('/features')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: true,
                            data: { testRuns: { enabled: false, title: 'Test execution' } }
                        })
                    });
                }

                if (url.pathname.includes('/runs/intelligence') || url.pathname.includes('/runs/trends')) {
                    return route.fulfill({
                        status: 501,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            code: 'FEATURE_DISABLED',
                            feature: 'testRuns',
                            message: 'Test execution is currently disabled.'
                        })
                    });
                }

                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: {} })
                });
            }

            // Static dist files
            if (url.origin === 'http://app.local') {
                let filePath = path.join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

                if (!fs.existsSync(filePath)) {
                    filePath = path.join(DIST_DIR, 'index.html');
                }

                const ext = path.extname(filePath);
                const contentTypes = {
                    '.html': 'text/html',
                    '.js': 'application/javascript',
                    '.css': 'text/css',
                    '.svg': 'image/svg+xml',
                    '.json': 'application/json'
                };

                return route.fulfill({
                    status: 200,
                    contentType: contentTypes[ext] || 'application/octet-stream',
                    body: fs.readFileSync(filePath)
                });
            }

            return route.continue();
        });
    });

    after(async () => {
        if (browser) await browser.close();
    });

    it('1. Loads Intelligence dashboard at /app/intelligence with strict 28px top padding', async () => {
        await page.goto('http://app.local/app/intelligence', { waitUntil: 'networkidle' });

        const pageEl = page.locator('.intel-page');
        await pageEl.waitFor({ state: 'visible', timeout: 5000 });

        const paddingTop = await pageEl.evaluate((el) => window.getComputedStyle(el).paddingTop);
        assert.equal(paddingTop, '28px', 'Top padding must be exactly 28px');
    });

    it('2. Renders single authoritative title "Intelligence" and correct breadcrumb', async () => {
        const titleText = await page.locator('.intel-title').first().textContent();
        assert.equal(titleText.trim(), 'Intelligence', 'Title must be "Intelligence"');

        const breadcrumbCurrent = await page.locator('.intel-breadcrumb-current').textContent();
        assert.equal(breadcrumbCurrent.trim(), 'Intelligence');

        const subtitle = await page.locator('.intel-subtitle').textContent();
        assert.ok(subtitle.includes('Quality overview of your test suites'));
    });

    it('3. Does NOT contain hardcoded placeholder strings ("All Quiet", "Steady Quality", "Test maintenance: Active")', async () => {
        const bodyText = await page.locator('body').innerText();

        assert.equal(bodyText.includes('All Quiet'), false, 'Must not contain "All Quiet"');
        assert.equal(bodyText.includes('Steady Quality'), false, 'Must not contain "Steady Quality"');
        assert.equal(bodyText.includes('Test maintenance: Active'), false, 'Must not contain "Test maintenance: Active"');
    });

    it('4. Renders 6 summary tiles matching Traceability canonical data', async () => {
        const tiles = page.locator('.intel-tile');
        assert.equal(await tiles.count(), 6, 'Must render exactly 6 summary tiles');

        // Check values
        const suitesVal = await tiles.nth(0).locator('.intel-tile-value').textContent();
        assert.equal(suitesVal.trim(), '1');

        const casesVal = await tiles.nth(1).locator('.intel-tile-value').textContent();
        assert.equal(casesVal.trim(), '19');

        const reqsVal = await tiles.nth(2).locator('.intel-tile-value').textContent();
        assert.equal(reqsVal.trim(), '5');

        const approvedVal = await tiles.nth(3).locator('.intel-tile-value').textContent();
        assert.equal(approvedVal.trim(), '100%');

        const linkedVal = await tiles.nth(4).locator('.intel-tile-value').textContent();
        assert.equal(linkedVal.trim(), '100%');

        const verifiedVal = await tiles.nth(5).locator('.intel-tile-value').textContent();
        assert.equal(verifiedVal.trim(), '0%');
        const soonBadge = await tiles.nth(5).locator('.intel-badge-soon').textContent();
        assert.equal(soonBadge.trim(), 'Soon');
    });

    it('5. Renders Panels: Review Progress, Requirement Coverage, Test Mix, Gaps, Activity, and Execution Insights', async () => {
        // Review Progress
        const reviewTitle = await page.locator('.intel-panel-title').nth(0).textContent();
        assert.ok(reviewTitle.includes('Review Progress'));

        // Requirement Coverage
        const covTitle = await page.locator('.intel-panel-title').nth(1).textContent();
        assert.ok(covTitle.includes('Requirement Coverage'));

        // Test Mix
        const mixTitle = await page.locator('.intel-panel-title').nth(2).textContent();
        assert.ok(mixTitle.includes('Test Mix & Priorities'));

        // Gaps
        const gapsTitle = await page.locator('.intel-panel-title').nth(3).textContent();
        assert.ok(gapsTitle.includes('Gaps & Opportunities'));
        assert.equal(await page.locator('.intel-gap-card').count(), 2);

        // Activity
        const actTitle = await page.locator('.intel-panel-title').nth(4).textContent();
        assert.ok(actTitle.includes('Authoring Activity'));
        await page.locator('.intel-activity-svg').waitFor({ state: 'visible' });

        // Execution Insights Soon card
        const soonCard = page.locator('.intel-soon-card');
        await soonCard.waitFor({ state: 'visible' });
        const soonTitle = await soonCard.locator('.intel-title').textContent();
        assert.ok(soonTitle.includes('Execution Insights & Failure Fingerprinting'));
    });

    it('6. Suite selector combobox toggles and updates URL search parameter', async () => {
        const trigger = page.locator('.intel-combobox-trigger');
        await trigger.click();

        const menu = page.locator('.intel-combobox-menu');
        await menu.waitFor({ state: 'visible' });

        const suiteOption = page.locator('.intel-combobox-item').filter({ hasText: 'Authentication & Session Security Suite' });
        await suiteOption.click();

        await page.waitForURL('**/app/intelligence?suite=suite-auth-001');
        assert.ok(page.url().includes('suite=suite-auth-001'));
    });

    it('7. Takes responsive screenshots across 5 viewports (390, 768, 1024, 1440, 1920)', async () => {
        const viewports = [
            { name: 'mobile-390', width: 390, height: 844 },
            { name: 'tablet-768', width: 768, height: 1024 },
            { name: 'laptop-1024', width: 1024, height: 768 },
            { name: 'desktop-1440', width: 1440, height: 900 },
            { name: 'wide-1920', width: 1920, height: 1080 }
        ];

        for (const vp of viewports) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.waitForTimeout(300);
            const screenshotPath = path.join(SCREENSHOTS_DIR, `intelligence-${vp.name}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            assert.ok(fs.existsSync(screenshotPath), `Screenshot should exist at ${screenshotPath}`);
        }
    });

    it('8. Renders empty state and takes screenshot when no suites exist', async () => {
        // Change route to return 0 suites and empty overview
        await page.route('**/api/v1/intelligence/overview*', async (route) => {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        suiteId: 'all',
                        totals: { suites: 0, cases: 0, requirements: 0 },
                        review: { approved: 0, notApproved: 0, approvalPct: 0 },
                        traceability: { linkedPct: 0, verifiedPct: 0, requirementsLinked: 0, requirementsTotal: 0 },
                        byType: { functional: 0, negative: 0, edge: 0, nonFunctional: 0, api: 0 },
                        byPriority: { high: 0, medium: 0, low: 0 },
                        gaps: [],
                        activity: []
                    }
                })
            });
        });

        await page.goto('http://app.local/app/intelligence', { waitUntil: 'networkidle' });
        const emptyEl = page.locator('.intel-empty-container');
        await emptyEl.waitFor({ state: 'visible', timeout: 5000 });

        const emptyTitle = await page.locator('.intel-empty-title').textContent();
        assert.ok(emptyTitle.includes('No test suites available'));

        const emptyScreenshotPath = path.join(SCREENSHOTS_DIR, 'intelligence-empty-state.png');
        await page.screenshot({ path: emptyScreenshotPath, fullPage: true });
        assert.ok(fs.existsSync(emptyScreenshotPath));
    });
});
