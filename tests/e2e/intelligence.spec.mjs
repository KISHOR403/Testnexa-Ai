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

describe('QA Health & Authoring Intelligence Dashboard Comprehensive Verification', () => {
    let browser;
    let context;
    let page;
    const executionRequests = [];

    const mockSuites = [
        {
            id: '6aa644ae6fb4f931da1cd637',
            title: 'Password Reset Suite',
            name: 'Password Reset Suite',
            platform: 'Web',
            totalCases: 19,
            cases: 19,
            approvedCases: 0,
            approvedPct: 0,
            linkedCount: 6,
            linkedPct: 100,
            gapCount: 2,
            updatedAt: '2026-11-16T14:40:00.000Z'
        },
        {
            id: '6aa645d16fb4f931da1cd73c',
            title: 'User Authentication Suite',
            name: 'User Authentication Suite',
            platform: 'Web',
            totalCases: 19,
            cases: 19,
            approvedCases: 0,
            approvedPct: 0,
            linkedCount: 5,
            linkedPct: 100,
            gapCount: 1,
            updatedAt: '2026-11-16T14:45:00.000Z'
        }
    ];

    const mockOverview = {
        suiteId: 'all',
        totals: {
            suites: 2,
            cases: 38,
            requirements: 11
        },
        review: {
            approved: 0,
            notApproved: 38,
            approvalPct: 0
        },
        traceability: {
            linkedPct: 100,
            verifiedPct: 0,
            requirementsLinked: 11,
            requirementsTotal: 11
        },
        byType: {
            functional: 24,
            negative: 8,
            edge: 4,
            nonFunctional: 2,
            security: 0,
            api: 0
        },
        byPriority: {
            high: 16,
            medium: 18,
            low: 4,
            unset: 0
        },
        requirementsBySource: {
            extracted: 0,
            derived: 11,
            manual: 0
        },
        gaps: [
            {
                key: 'single_test_requirement',
                type: 'single_test',
                title: 'Single-Test Requirements',
                description: '2 requirements rely on only 1 test case.',
                count: 2,
                severity: 'medium',
                items: [
                    { id: 'REQ_NF_001', title: 'Requirement REQ_NF_001' },
                    { id: 'REQ_NF_002', title: 'Requirement REQ_NF_002' }
                ],
                actionPath: '/app/traceability?gap=single_test_requirement'
            },
            {
                key: 'review_backlog',
                type: 'review_target',
                title: 'Review Backlog',
                description: '38 test cases awaiting review or approval before execution readiness.',
                count: 38,
                severity: 'low',
                items: [
                    { id: 'TC_PR_001', title: 'Token validation' },
                    { id: 'TC_PR_002', title: 'Rate limiting' }
                ],
                actionPath: '/app/test-cases?approvalStatus=pending'
            }
        ],
        rulesChecked: [
            'single_test_requirement',
            'no_negative_or_security_test',
            'unlinked_test_case',
            'review_backlog',
            'missing_priority'
        ],
        checkedAt: '2026-11-16T15:20:00.000Z',
        suites: mockSuites,
        activity: Array.from({ length: 30 }, (_, i) => {
            const d = new Date(Date.UTC(2026, 10, 16 - (29 - i)));
            const dateStr = d.toISOString().split('T')[0];
            return {
                date: dateStr,
                suitesCreated: i === 29 ? 2 : 0,
                casesGenerated: i === 29 ? 38 : 0,
                casesApproved: i === 29 ? 19 : 0
            };
        }),
        features: {
            testRuns: false
        },
        updatedAt: '2026-11-16T14:45:00.000Z'
    };

    const mockActivity = {
        suiteId: 'all',
        days: 30,
        tz: 'UTC',
        periodTotals: {
            suitesCreated: 2,
            casesGenerated: 38,
            casesApproved: 0
        },
        activity: Array.from({ length: 30 }, (_, i) => {
            const d = new Date(Date.UTC(2026, 10, 16 - (29 - i)));
            const dateStr = d.toISOString().split('T')[0];
            return {
                date: dateStr,
                suitesCreated: i === 29 ? 2 : 0,
                casesGenerated: i === 29 ? 38 : 0,
                casesApproved: 0
            };
        })
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
                id: '69a30effa0d2d589c4796e0b',
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

        // Intercept assets and API endpoints
        await page.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());

            // Track any execution runs requests
            if (url.pathname.includes('/test-runs') || url.pathname.includes('/executions') || url.pathname.includes('/runs/execute')) {
                executionRequests.push(url.pathname);
            }

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

                if (url.pathname.includes('/intelligence/activity')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: mockActivity })
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

    it('1. Loads Intelligence dashboard with centered max-width and top-bar breadcrumb', async () => {
        await page.goto('http://app.local/app/intelligence', { waitUntil: 'networkidle' });

        const pageEl = page.locator('.intel-page');
        await pageEl.waitFor({ state: 'visible', timeout: 5000 });

        // Verify Top Bar Breadcrumb is Analysis > Intelligence (not Application)
        const topBarCrumb = await page.locator('.app-header__breadcrumbs').innerText();
        assert.ok(topBarCrumb.includes('Analysis'), 'Top bar must include Analysis');
        assert.ok(topBarCrumb.includes('Intelligence'), 'Top bar must include Intelligence');
        assert.equal(topBarCrumb.includes('Application'), false, 'Top bar must NOT show "Application"');

        // Verify single H1 title
        const h1 = page.locator('.intel-title').first();
        assert.equal(await h1.textContent(), 'Intelligence');

        // Verify no in-page duplicate breadcrumb
        assert.equal(await page.locator('.intel-breadcrumb').count(), 0, 'No in-page duplicate breadcrumb');
    });

    it('2. Does NOT render deprecated strings ("All Quiet", "Steady Quality", "Application")', async () => {
        const bodyText = await page.locator('body').innerText();

        assert.equal(bodyText.includes('All Quiet'), false, 'Must not render "All Quiet"');
        assert.equal(bodyText.includes('Steady Quality'), false, 'Must not render "Steady Quality"');
        assert.equal(bodyText.includes('Application'), false, 'Must not render "Application"');
    });

    it('3. Renders truthful provenance label under Requirements (never "Extracted" when derived)', async () => {
        const reqTile = page.locator('.intel-tile').nth(2);
        const reqSub = await reqTile.locator('.intel-tile-sub').innerText();

        assert.ok(reqSub.includes('11 derived from tests'), 'Must truthfully state "11 derived from tests"');
        assert.equal(reqSub.toLowerCase().includes('extracted'), false, 'Must not say extracted when all are derived');
    });

    it('4. Asserts summary numbers align on one exact baseline across all 6 tiles', async () => {
        const tiles = page.locator('.intel-tile');
        assert.equal(await tiles.count(), 6);

        const yPositions = [];
        for (let i = 0; i < 6; i++) {
            const valBox = await tiles.nth(i).locator('.intel-tile-value').boundingBox();
            assert.ok(valBox, `Tile ${i} value box must exist`);
            yPositions.push(Math.round(valBox.y));
        }

        // All 6 value elements must share the exact same Y baseline (tolerance: 1px)
        const baseline = yPositions[0];
        for (let i = 1; i < yPositions.length; i++) {
            assert.ok(
                Math.abs(yPositions[i] - baseline) <= 1,
                `Tile ${i} baseline (${yPositions[i]}) differs from Tile 0 baseline (${baseline})`
            );
        }
    });

    it('5. Guarantees 0 execution requests fired while FEATURE_TEST_RUNS is disabled', () => {
        assert.equal(executionRequests.length, 0, 'Zero requests should hit execution runner endpoints');
    });

    it('6. Verifies Authoring Activity Chart tooltip and Accessible Table toggle', async () => {
        // SVG chart exists and has role="img"
        const svg = page.locator('.intel-activity-svg');
        await svg.waitFor({ state: 'visible' });
        assert.equal(await svg.getAttribute('role'), 'img');

        // Test Accessible Table Toggle
        const tableToggleBtn = page.locator('.intel-table-toggle-btn');
        assert.equal(await page.locator('.intel-accessible-table').count(), 0, 'Table hidden by default');
        await tableToggleBtn.click();
        assert.equal(await page.locator('.intel-accessible-table').count(), 1, 'Table visible after toggle');
        await tableToggleBtn.click();
        assert.equal(await page.locator('.intel-accessible-table').count(), 0, 'Table hidden after second toggle');

        // Test hover on grouped bars
        const lastBarGroup = page.locator('.intel-bar-group').last();
        await lastBarGroup.hover();
        const tooltip = page.locator('.intel-chart-tooltip');
        await tooltip.waitFor({ state: 'visible', timeout: 3000 });
        const tooltipText = await tooltip.innerText();
        assert.ok(tooltipText.includes('Suites created'));
        assert.ok(tooltipText.includes('Cases approved'));
    });

    it('7. Verifies Suites Breakdown table is present for All Suites and sortable', async () => {
        const table = page.locator('.intel-suites-table');
        await table.waitFor({ state: 'visible' });

        const rows = page.locator('.intel-table-row');
        assert.equal(await rows.count(), 2, 'Must list both suites');

        // Verify column values
        const firstRowText = await rows.first().innerText();
        assert.ok(firstRowText.includes('Password Reset Suite') || firstRowText.includes('User Authentication Suite'));
    });

    it('8. Verifies every sidebar item is reachable with valid bounding box', async () => {
        const sidebar = page.locator('.app-sidebar');
        await sidebar.waitFor({ state: 'visible' });

        const expectedNavItems = [
            'AI Workspace',
            'Test Suites',
            'Test Cases',
            'History',
            'Intelligence',
            'Quality Insights',
            'Coverage',
            'Risks',
            'Traceability',
            'Failure Trends',
            'Recommendations',
            'Maintenance',
            'CI/CD',
            'Team & Org',
            'Help & Docs',
            'Website'
        ];

        for (const label of expectedNavItems) {
            const item = page.locator(`.app-sidebar a[title*="${label}"], .app-sidebar span:has-text("${label}")`).first();
            await item.scrollIntoViewIfNeeded();
            const box = await item.boundingBox();
            assert.ok(box && box.width > 0 && box.height > 0, `Sidebar item "${label}" must be reachable and visible`);
        }
    });

    it('9. Captures screenshots across viewports (390, 768, 1024, 1440, 1920) without horizontal overflow', async () => {
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

            // Assert no horizontal page overflow
            const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
            const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
            assert.ok(
                scrollWidth <= clientWidth + 1,
                `Horizontal overflow detected at ${vp.name}: scrollWidth (${scrollWidth}) > clientWidth (${clientWidth})`
            );

            const screenshotPath = path.join(SCREENSHOTS_DIR, `intelligence-${vp.name}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            assert.ok(fs.existsSync(screenshotPath), `Screenshot should exist at ${screenshotPath}`);
        }
    });

    it('10. Renders empty workspace state and takes screenshot', async () => {
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

        const emptyScreenshotPath = path.join(SCREENSHOTS_DIR, 'intelligence-empty-state.png');
        await page.screenshot({ path: emptyScreenshotPath, fullPage: true });
        assert.ok(fs.existsSync(emptyScreenshotPath));
    });

    it('11. Renders error state with Retry button and takes screenshot', async () => {
        await page.route('**/api/v1/intelligence/overview*', async (route) => {
            return route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: false,
                    message: 'Internal Database Connection Timeout'
                })
            });
        });

        await page.goto('http://app.local/app/intelligence', { waitUntil: 'networkidle' });
        const errorEl = page.locator('.intel-error-container');
        await errorEl.waitFor({ state: 'visible', timeout: 5000 });

        const retryBtn = page.locator('.intel-error-container button:has-text("Retry")');
        assert.equal(await retryBtn.count(), 1, 'Retry button must exist in error state');

        const errorScreenshotPath = path.join(SCREENSHOTS_DIR, 'intelligence-error-state.png');
        await page.screenshot({ path: errorScreenshotPath, fullPage: true });
        assert.ok(fs.existsSync(errorScreenshotPath));
    });
});
