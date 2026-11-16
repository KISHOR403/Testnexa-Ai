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

describe('Traceability & Coverage (/app/traceability) Responsive & Design Verification', () => {
    let browser;
    let context;
    let page;

    // 19 test cases, 5 linked requirements (REQ_AUTH_001 through REQ_AUTH_005)
    const mockCases = Array.from({ length: 19 }, (_, i) => ({
        id: `TC_FUNC_AUTH_${String(i + 1).padStart(3, '0')}`,
        title: `Authentication Workflow ${i + 1}`,
        type: i < 12 ? 'Functional' : i < 16 ? 'Negative' : 'Edge Case',
        priority: i < 5 ? 'High' : 'Medium',
        severity: 'Major',
        status: 'ready',
        requirementId: i < 5 ? `REQ_AUTH_00${i + 1}` : undefined,
        reason: `Validates authentication specifications for REQ_AUTH_00${(i % 5) + 1}`
    }));

    const mockRequirements = [
        {
            id: 'REQ_AUTH_001',
            key: 'REQ_AUTH_001',
            title: 'SAML SSO Configuration with Identity Provider',
            description: 'Enables enterprise users to authenticate via SAML 2.0 Identity Provider with assertion validation.',
            category: 'Functional',
            priority: 'High',
            status: 'unverified',
            linkedCount: 1,
            executedCount: 0,
            passedCount: 0,
            failedCount: 0,
            lastRun: null,
            linkedTests: [{
                id: 'TC_FUNC_AUTH_001',
                testCaseId: 'TC_FUNC_AUTH_001',
                title: 'Authentication Workflow 1',
                category: 'Functional',
                priority: 'High',
                severity: 'Major',
                executionType: 'automated',
                approvalStatus: 'ready',
                status: 'not_run',
                rationale: 'Validates primary enterprise identity broker redirection.'
            }]
        },
        {
            id: 'REQ_AUTH_002',
            key: 'REQ_AUTH_002',
            title: 'Multi-Factor TOTP Authenticator Validation',
            description: 'Requires secondary verification with six-digit one-time tokens.',
            category: 'Security',
            priority: 'High',
            status: 'unverified',
            linkedCount: 1,
            executedCount: 0,
            passedCount: 0,
            failedCount: 0,
            lastRun: null,
            linkedTests: [{
                id: 'TC_FUNC_AUTH_002',
                testCaseId: 'TC_FUNC_AUTH_002',
                title: 'Authentication Workflow 2',
                category: 'Functional',
                priority: 'High',
                severity: 'Major',
                executionType: 'automated',
                approvalStatus: 'ready',
                status: 'not_run',
                rationale: 'Enforces MFA requirement before establishing session cookie.'
            }]
        },
        {
            id: 'REQ_AUTH_003',
            key: 'REQ_AUTH_003',
            title: 'Session Invalidation and Inactivity Timeout',
            description: 'Automatically expires user session token after 15 minutes of inactivity.',
            category: 'Security',
            priority: 'Medium',
            status: 'unverified',
            linkedCount: 1,
            executedCount: 0,
            passedCount: 0,
            failedCount: 0,
            lastRun: null,
            linkedTests: [{
                id: 'TC_FUNC_AUTH_003',
                testCaseId: 'TC_FUNC_AUTH_003',
                title: 'Authentication Workflow 3',
                category: 'Functional',
                priority: 'Medium',
                severity: 'Major',
                executionType: 'manual',
                approvalStatus: 'ready',
                status: 'not_run',
                rationale: 'Guarantees session cookies are revoked upon timeout.'
            }]
        },
        {
            id: 'REQ_AUTH_004',
            key: 'REQ_AUTH_004',
            title: 'Password Complexity and Leak Detection',
            description: 'Enforces minimum 12 characters, uppercase, symbol and checks breach corpus.',
            category: 'Functional',
            priority: 'Medium',
            status: 'unverified',
            linkedCount: 1,
            executedCount: 0,
            passedCount: 0,
            failedCount: 0,
            lastRun: null,
            linkedTests: [{
                id: 'TC_FUNC_AUTH_004',
                testCaseId: 'TC_FUNC_AUTH_004',
                title: 'Authentication Workflow 4',
                category: 'Functional',
                priority: 'Medium',
                severity: 'Major',
                executionType: 'automated',
                approvalStatus: 'ready',
                status: 'not_run',
                rationale: 'Protects user credential resets against dictionary attacks.'
            }]
        },
        {
            id: 'REQ_AUTH_005',
            key: 'REQ_AUTH_005',
            title: 'Cross-Origin Resource Sharing and Security Headers',
            description: 'Enforces CSP, strict transport security, and disables iframe embedding.',
            category: 'Security',
            priority: 'High',
            status: 'unverified',
            linkedCount: 1,
            executedCount: 0,
            passedCount: 0,
            failedCount: 0,
            lastRun: null,
            linkedTests: [{
                id: 'TC_FUNC_AUTH_005',
                testCaseId: 'TC_FUNC_AUTH_005',
                title: 'Authentication Workflow 5',
                category: 'Functional',
                priority: 'High',
                severity: 'Major',
                executionType: 'automated',
                approvalStatus: 'ready',
                status: 'not_run',
                rationale: 'Mitigates clickjacking and cross-site scripting vulnerabilities.'
            }]
        }
    ];

    const mockSummary = {
        suiteId: 'suite-auth-detail-001',
        total: 5,
        verified: 0,
        partial: 0,
        failing: 0,
        unverified: 5,
        uncovered: 0,
        linked: 5,
        linkedPercent: 100,
        verifiedPercent: 0,
        covered: 5,
        coveragePercent: 100,
        updatedAt: '2026-11-16T12:40:00.000Z'
    };

    const mockGaps = [
        {
            type: 'unlinked_tests',
            count: 14,
            message: '14 tests have no requirement',
            action: 'Link'
        },
        {
            type: 'unverified',
            count: 5,
            message: '5 requirements need verification',
            action: 'Run tests'
        }
    ];

    const mockMatrix = {
        suiteId: 'suite-auth-detail-001',
        requirements: mockRequirements.map(r => ({
            id: r.id,
            key: r.key,
            title: r.title,
            priority: r.priority,
            category: r.category,
            status: r.status,
            linkedCount: r.linkedCount
        })),
        testCases: mockCases.map(tc => ({
            id: tc.id,
            title: tc.title,
            type: tc.type,
            priority: tc.priority,
            executionStatus: 'not_run'
        })),
        cells: {
            REQ_AUTH_001: { TC_FUNC_AUTH_001: { linked: true, status: 'not_run', rationale: 'Validates SAML SSO' } },
            REQ_AUTH_002: { TC_FUNC_AUTH_002: { linked: true, status: 'not_run', rationale: 'Validates MFA' } },
            REQ_AUTH_003: { TC_FUNC_AUTH_003: { linked: true, status: 'not_run', rationale: 'Validates timeout' } },
            REQ_AUTH_004: { TC_FUNC_AUTH_004: { linked: true, status: 'not_run', rationale: 'Validates password policy' } },
            REQ_AUTH_005: { TC_FUNC_AUTH_005: { linked: true, status: 'not_run', rationale: 'Validates CSP headers' } }
        }
    };

    const mockSuites = [
        {
            id: 'suite-auth-detail-001',
            sessionId: 'suite-auth-detail-001',
            title: 'User Authentication Suite',
            platform: 'Web',
            totalCases: 19,
            requirementsCount: 5,
            coveredRequirementsCount: 5,
            updatedAt: '2026-11-16T12:40:00.000Z'
        },
        {
            id: 'suite-payment-002',
            sessionId: 'suite-payment-002',
            title: 'E-Commerce Payment Gateway',
            platform: 'API',
            totalCases: 12,
            requirementsCount: 3,
            coveredRequirementsCount: 2,
            updatedAt: '2026-11-15T09:30:00.000Z'
        }
    ];

    before(async () => {
        if (!fs.existsSync(SCREENSHOTS_DIR)) {
            fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
        }

        browser = await chromium.launch({ headless: true });
        context = await browser.newContext();

        // Inject mock session
        await context.addInitScript(() => {
            localStorage.setItem('testnexa_token', 'mock_jwt_traceability_token');
            localStorage.setItem('testnexa_user', JSON.stringify({
                id: 'usr_test_lead',
                email: 'lead@testnexa.ai',
                name: 'Traceability Lead',
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

        // Route Interception for Traceability API
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

                if (url.pathname.includes('/traceability/summary')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: mockSummary })
                    });
                }

                if (url.pathname.includes('/traceability/gaps')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: { suiteId: 'suite-auth-detail-001', gaps: mockGaps } })
                    });
                }

                if (url.pathname.includes('/traceability/matrix')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: mockMatrix })
                    });
                }

                if (url.pathname.includes('/traceability/requirements')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: mockRequirements })
                    });
                }

                if (url.pathname.includes('/sessions') || url.pathname.includes('/test-suites')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: mockSuites })
                    });
                }

                if (url.pathname.includes('/runs') || url.pathname.includes('/executions')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, data: [] })
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
                    contentType: 'text/html',
                    body: fs.readFileSync(indexPath)
                });
            }

            return route.continue();
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
        it(`verifies traceability page layout, summary, and design at ${vp.name}px (${vp.width}x${vp.height})`, async () => {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto('http://app.local/app/traceability?suite=suite-auth-detail-001');

            await page.waitForSelector('.traceability-page', { timeout: 15000 });
            await page.waitForSelector('.app-header__breadcrumbs', { timeout: 15000 });
            await page.waitForSelector('.trace-table', { timeout: 15000 });

            // 1. Breadcrumb only in top bar
            const breadcrumbText = await page.locator('.app-header__breadcrumbs').textContent();
            assert.ok(breadcrumbText.includes('Analysis'), 'Breadcrumb must link to Analysis');
            assert.ok(breadcrumbText.includes('Traceability'), 'Breadcrumb must show Traceability');

            // 2. Header and Meta line
            const h1 = await page.locator('.trace-header-title h1').textContent();
            assert.equal(h1.trim(), 'Traceability', 'Title must be Traceability');

            const metaLine = await page.locator('.trace-header-meta').textContent();
            assert.ok(metaLine.includes('Updated Nov 16, 2026'), 'Meta line must show formatted update date');
            assert.ok(metaLine.includes('Linked: 100%'), 'Meta line must specify Linked percentage');
            assert.ok(metaLine.includes('Verified: 0%'), 'Meta line must specify Verified percentage');
            assert.ok(metaLine.includes('19 test cases'), 'Meta line must show case count');

            // 3. Combobox Suite Selector: Never shows "No suites available"
            const comboboxText = await page.locator('.trace-combobox-title').textContent();
            assert.ok(!comboboxText.includes('No suites available'), 'Combobox must never show No suites available');
            assert.ok(comboboxText.includes('User Authentication Suite'), 'Combobox must show selected suite');

            // 4. Summary Strip: 5 Mutually Exclusive Tiles: Verified, Partial, Failing, Unverified, Uncovered
            const summaryVals = await page.locator('.trace-summary-btn-val').allTextContents();
            assert.equal(summaryVals[0].trim(), '0', 'Verified requirements must be 0');
            assert.equal(summaryVals[1].trim(), '0', 'Partial requirements must be 0');
            assert.equal(summaryVals[2].trim(), '0', 'Failing requirements must be 0');
            assert.equal(summaryVals[3].trim(), '5', 'Unverified requirements must be 5');
            assert.equal(summaryVals[4].trim(), '0', 'Uncovered requirements must be 0');

            // 5. Gaps Panel: Actionable cards
            const gapTexts = await page.locator('.trace-gap-text').allTextContents();
            assert.ok(gapTexts.some(t => t.includes('14 tests have no requirement')), 'Must display 14 tests unlinked gap');

            // 6. Requirements Table
            const tableRows = await page.locator('.trace-table tbody tr').count();
            assert.equal(tableRows, 5, 'Table must list all 5 requirements');

            // Screenshot: Table view with detail panel closed
            const closedShot = path.join(SCREENSHOTS_DIR, `traceability-${vp.name}-table-closed.png`);
            await page.screenshot({ path: closedShot, fullPage: true });
            assert.ok(fs.existsSync(closedShot), `Screenshot must exist at ${closedShot}`);

            // 7. Click first row -> Opens right-hand detail drawer
            await page.locator('.trace-table tbody tr').first().click();
            await page.waitForSelector('.trace-detail-drawer', { state: 'visible' });

            const drawerTitle = await page.locator('.trace-detail-body h2').textContent();
            assert.ok(drawerTitle.includes('SAML SSO Configuration'), 'Detail drawer should show requirement title');

            // Screenshot: Table view with detail panel open
            const openShot = path.join(SCREENSHOTS_DIR, `traceability-${vp.name}-table-drawer-open.png`);
            await page.screenshot({ path: openShot, fullPage: true });
            assert.ok(fs.existsSync(openShot), `Screenshot must exist at ${openShot}`);

            // Close drawer
            await page.locator('.trace-detail-close-btn').click();

            // 8. Matrix View Toggle
            await page.locator('.trace-view-toggle button').nth(1).click();
            await page.waitForSelector('.trace-matrix-table', { state: 'visible' });

            // Verify matrix grid headers and rows
            const matrixReqCount = await page.locator('.trace-matrix-table tbody tr').count();
            assert.equal(matrixReqCount, 5, 'Matrix view must render 5 requirement rows');

            // Screenshot: Matrix view
            const matrixShot = path.join(SCREENSHOTS_DIR, `traceability-${vp.name}-matrix.png`);
            await page.screenshot({ path: matrixShot, fullPage: true });
            assert.ok(fs.existsSync(matrixShot), `Screenshot must exist at ${matrixShot}`);

            // Switch back to Table view for clean state
            await page.locator('.trace-view-toggle button').first().click();

            // 9. Strict Theme & Typography Verification
            const computedStyle = await page.evaluate(() => {
                const root = document.querySelector('.traceability-page');
                const h1El = document.querySelector('.trace-header-title h1');
                const metaEl = document.querySelector('.trace-header-meta');
                const pillEl = document.querySelector('.trace-status-pill');

                const getRgb = (colorStr) => {
                    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    return match ? { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) } : null;
                };

                const isMonochrome = (rgb) => {
                    if (!rgb) return true;
                    // White, black, gray: r == g == b (tolerance of 5)
                    return Math.abs(rgb.r - rgb.g) <= 5 && Math.abs(rgb.g - rgb.b) <= 5;
                };

                const h1Color = window.getComputedStyle(h1El).color;
                const rootBg = window.getComputedStyle(root).backgroundColor;
                const metaFontSize = parseFloat(window.getComputedStyle(metaEl).fontSize);
                const bodyFontSize = parseFloat(window.getComputedStyle(root).fontSize);

                return {
                    rootBg,
                    h1Color,
                    h1Monochrome: isMonochrome(getRgb(h1Color)),
                    metaFontSize,
                    bodyFontSize
                };
            });

            assert.ok(computedStyle.h1Monochrome, 'Typography must be strictly monochrome (no colored hues)');
            assert.ok(computedStyle.metaFontSize >= 12, 'Metadata font size must not be under 12px');
            assert.ok(computedStyle.bodyFontSize >= 14, 'Body font size must be at least 14px');
        });
    }
});
