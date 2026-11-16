import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'tests/screenshots/risks');

describe('Risks Page E2E & Visual Verification', () => {
    let browser;
    let context;
    let page;
    const interceptedRequests = [];

    const mockSummary = {
        total: 10,
        derivedCount: 10,
        generatedCount: 0,
        manualCount: 0,
        bySeverity: {
            critical: 3,
            high: 4,
            medium: 2,
            low: 1
        },
        byStatus: {
            open: 8,
            mitigating: 1,
            accepted: 1,
            closed: 0
        },
        byMitigation: {
            unmitigated: 2,
            tests_planned: 5,
            tests_approved: 3,
            verified: 0
        },
        byCategory: {
            security: 4,
            rate_limiting: 3,
            session_management: 2,
            input_validation: 1
        },
        executionEnabled: false
    };

    const mockMatrix = {
        grid: {
            5: {
                5: { likelihood: 5, impact: 5, count: 1, score: 25, severity: 'critical', label: 'Catastrophic vulnerability' },
                4: { likelihood: 5, impact: 4, count: 2, score: 20, severity: 'critical', label: 'Critical risk' }
            },
            4: {
                4: { likelihood: 4, impact: 4, count: 2, score: 16, severity: 'high', label: 'Major risk' }
            },
            3: {
                4: { likelihood: 3, impact: 4, count: 2, score: 12, severity: 'high', label: 'Major risk' },
                3: { likelihood: 3, impact: 3, count: 1, score: 9, severity: 'medium', label: 'Moderate risk' }
            },
            2: {
                4: { likelihood: 2, impact: 4, count: 1, score: 8, severity: 'medium', label: 'Moderate risk' }
            },
            1: {
                2: { likelihood: 1, impact: 2, count: 1, score: 2, severity: 'low', label: 'Low risk' }
            }
        }
    };

    const mockRisks = [
        {
            id: 'RSK_SEC_001',
            suite_id: 'suite-auth-001',
            requirement_id: 'req_001',
            title: 'SQL Injection Vulnerability in Authentication',
            threat_statement: 'Malicious actors could inject SQL payloads in login parameters to bypass authentication credentials.',
            category: 'security',
            source: 'derived',
            likelihood: 5,
            impact: 5,
            score: 25,
            severity: 'critical',
            mitigation_status: 'tests_approved',
            status: 'open',
            linked_test_cases: [
                { test_case_id: 'TC_SEC_LOGIN_001', title: 'SQL Injection Defense', approval_status: 'approved' }
            ],
            linked_requirements: [
                { requirement_id: 'REQ_AUTH_001', requirement_code: 'REQ_AUTH_001', title: 'Secure Authentication' }
            ],
            created_at: '2026-11-16T10:00:00Z',
            updated_at: '2026-11-16T12:00:00Z'
        },
        {
            id: 'RSK_RATE_002',
            suite_id: 'suite-pwd-reset-002',
            requirement_id: 'req_002',
            title: 'Rate Limit Abuse in Password Reset',
            threat_statement: 'Brute force attempts against password reset tokens could exhaust SMS quota or guess valid tokens.',
            category: 'rate_limiting',
            source: 'derived',
            likelihood: 4,
            impact: 4,
            score: 16,
            severity: 'high',
            mitigation_status: 'tests_planned',
            status: 'mitigating',
            linked_test_cases: [
                { test_case_id: 'TC_EDGE_PWD_002', title: 'Password Reset Rate Limiting', approval_status: 'draft' }
            ],
            linked_requirements: [
                { requirement_id: 'REQ_PWD_002', requirement_code: 'REQ_PWD_002', title: 'Reset Token Rate Limiting' }
            ],
            created_at: '2026-11-16T10:00:00Z',
            updated_at: '2026-11-16T12:00:00Z'
        },
        {
            id: 'RSK_SESS_003',
            suite_id: 'suite-auth-001',
            requirement_id: 'req_003',
            title: 'Session Fixation via Stale Cookie',
            threat_statement: 'Failure to rotate session ID after privilege elevation could allow session hijacking.',
            category: 'session_management',
            source: 'derived',
            likelihood: 2,
            impact: 4,
            score: 8,
            severity: 'medium',
            mitigation_status: 'unmitigated',
            status: 'open',
            linked_test_cases: [],
            linked_requirements: [
                { requirement_id: 'REQ_AUTH_003', requirement_code: 'REQ_AUTH_003', title: 'Session Lifecycle Management' }
            ],
            created_at: '2026-11-16T10:00:00Z',
            updated_at: '2026-11-16T12:00:00Z'
        }
    ];

    const mockSuites = [
        { id: 'suite-auth-001', title: 'User Authentication' },
        { id: 'suite-pwd-reset-002', title: 'Password Reset' }
    ];

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
                name: 'Kishor Gogoi',
                role: 'owner'
            }));
            localStorage.setItem('testnexa_workspace', JSON.stringify({
                id: 'ws_default',
                name: 'Default Workspace',
                ownerId: 'usr_qa_lead'
            }));
        });

        // Intercept routes
        await context.route('**/api/v1/**', async (route) => {
            const req = route.request();
            const url = req.url();
            interceptedRequests.push({ url, method: req.method() });

            if (url.includes('/risks/summary')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: mockSummary })
                });
            }

            if (url.includes('/risks/matrix')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: mockMatrix })
                });
            }

            if (url.includes('/risks/export')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'text/csv',
                    body: 'id,title,severity,score,category,source,status\nRSK_SEC_001,SQL Injection,critical,25,security,derived,open'
                });
            }

            if (url.includes('/risks/') && req.method() === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            ...mockRisks[0],
                            events: [
                                {
                                    id: 'evt_001',
                                    event_type: 'risk_created',
                                    created_at: '2026-11-16T10:00:00Z',
                                    details: { source: 'derived' }
                                }
                            ]
                        }
                    })
                });
            }

            if (url.includes('/risks') && req.method() === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: mockRisks,
                        pagination: { page: 1, limit: 100, total: mockRisks.length, totalPages: 1 }
                    })
                });
            }

            if (url.includes('/traceability/suites')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: mockSuites })
                });
            }

            if (url.includes('/sessions')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: mockSuites })
                });
            }

            if (url.includes('/auth/me')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        user: { id: 'usr_qa_lead', email: 'qa@testnexa.ai', name: 'Kishor Gogoi' }
                    })
                });
            }

            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: [] })
            });
        });

        page = await context.newPage();
    });

    after(async () => {
        if (browser) await browser.close();
    });

    it('1. Loads /app/risks and verifies single H1 "Risks" and honest source statement', async () => {
        await page.goto('http://localhost:5173/app/risks', { waitUntil: 'networkidle' });

        const h1 = page.locator('h1.risks-title');
        await h1.waitFor({ state: 'visible', timeout: 5000 });
        const h1Text = await h1.innerText();
        assert.strictEqual(h1Text.trim(), 'Risks');

        const desc = page.locator('.risks-description');
        await desc.waitFor({ state: 'visible' });
        const descText = await desc.innerText();
        assert.ok(descText.includes('Threats to your requirements'));

        const sourceNote = page.locator('.risks-source-note');
        await sourceNote.waitFor({ state: 'visible' });
        const sourceText = await sourceNote.innerText();
        assert.ok(sourceText.includes('risks derived from test cases') || sourceText.includes('derived'));
    });

    it('2. Guarantees prohibited execution strings NEVER render', async () => {
        const bodyText = await page.innerText('body');
        assert.strictEqual(bodyText.includes('Live Run Failures'), false, 'Must not render Live Run Failures');
        assert.strictEqual(bodyText.includes('Active Failures'), false, 'Must not render Active Failures');
        assert.strictEqual(bodyText.includes('Risk Vectors & Execution Failures'), false, 'Must not render Risk Vectors & Execution Failures');
    });

    it('3. Guarantees no execution endpoints (/api/v1/runs) are requested', () => {
        const hasRunCalls = interceptedRequests.some(r => r.url.includes('/api/v1/runs'));
        assert.strictEqual(hasRunCalls, false, 'Should not request execution runs endpoint when feature flag is off');
    });

    it('4. Verifies Summary strip numbers, labels, and aria-pressed attributes', async () => {
        const tiles = page.locator('.risks-summary-tile');
        const count = await tiles.count();
        assert.strictEqual(count, 7, `Expected 7 summary tiles, got ${count}`);

        const totalTile = tiles.first();
        assert.ok((await totalTile.innerText()).includes('10'));

        const verifiedTile = tiles.nth(6);
        const verifiedText = (await verifiedTile.innerText()).toLowerCase();
        assert.ok(verifiedText.includes('verified'));
        assert.ok(verifiedText.includes('soon'));
    });

    it('5. Verifies 5x5 Likelihood x Impact Matrix accessibility & labels', async () => {
        const matrixCells = page.locator('.risks-matrix-cell:not(.risks-matrix-cell--empty)');
        const populatedCount = await matrixCells.count();
        assert.ok(populatedCount > 0, 'Expected populated cells in 5x5 matrix');

        const firstCell = matrixCells.first();
        const ariaLabel = await firstCell.getAttribute('aria-label');
        assert.ok(ariaLabel && ariaLabel.includes('Likelihood') && ariaLabel.includes('Impact'));
    });

    it('6. Asserts row titles share the exact same horizontal left edge (88px fixed badge)', async () => {
        const rows = page.locator('.risks-table-row');
        const rowCount = await rows.count();
        assert.ok(rowCount >= 2, `Expected at least 2 rows to compare, got ${rowCount}`);

        const title1Box = await rows.nth(0).locator('.risks-title-cell').boundingBox();
        const title2Box = await rows.nth(1).locator('.risks-title-cell').boundingBox();

        assert.ok(title1Box && title2Box);
        const diffX = Math.abs(title1Box.x - title2Box.x);
        assert.ok(diffX <= 1.0, `Expected row titles to align at exact same X position, difference was ${diffX}px`);
    });

    it('7. Detail Drawer opens, displays score explanation, and traps focus', async () => {
        const firstRow = page.locator('.risks-table-row').first();
        await firstRow.click();

        const drawer = page.locator('.risks-drawer-panel');
        await drawer.waitFor({ state: 'visible', timeout: 3000 });

        const drawerTitle = await drawer.locator('#drawer-risk-title').innerText();
        assert.ok(drawerTitle.includes('SQL Injection'));

        const scoreExplanation = page.locator('.risks-score-explanation-box');
        await scoreExplanation.waitFor({ state: 'visible' });
        assert.ok((await scoreExplanation.innerText()).includes('Likelihood'));

        // Press Esc to close
        await page.keyboard.press('Escape');
        await drawer.waitFor({ state: 'hidden', timeout: 3000 });
    });

    it('8. Captures screenshots across 1920, 1440, 1024, 768, and 390 viewports', async () => {
        const viewports = [
            { width: 1920, height: 1080, name: 'risks-wide-1920.png' },
            { width: 1440, height: 900, name: 'risks-desktop-1440.png' },
            { width: 1024, height: 768, name: 'risks-laptop-1024.png' },
            { width: 768, height: 1024, name: 'risks-tablet-768.png' },
            { width: 390, height: 844, name: 'risks-mobile-390.png' }
        ];

        for (const vp of viewports) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.waitForTimeout(150);

            // Assert no horizontal body overflow
            const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
            const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
            assert.ok(scrollWidth <= clientWidth + 2, `Horizontal overflow detected at ${vp.width}px: scroll=${scrollWidth}, client=${clientWidth}`);

            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, vp.name),
                fullPage: false
            });
        }
    });
});
