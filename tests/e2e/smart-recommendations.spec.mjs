import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'tests/screenshots/smart-recommendations');

describe('Smart Recommendations Page E2E & Visual Verification', () => {
    let browser;
    let context;
    let page;
    const interceptedRequests = [];

    const mockSuites = [
        {
            id: 'suite-auth-001',
            title: 'User Authentication Suite',
            platform: 'Web',
            summary: { total: 19 },
            suiteData: {
                testSuiteName: 'User Authentication Suite',
                platform: 'Web',
                testCases: Array(19).fill({ id: 'TC_1' })
            }
        },
        {
            id: 'suite-pwd-reset-002',
            title: 'Password Reset Suite',
            platform: 'API',
            summary: { total: 12 },
            suiteData: {
                testSuiteName: 'Password Reset Suite',
                platform: 'API',
                testCases: Array(12).fill({ id: 'TC_2' })
            }
        }
    ];

    const mockContextAuth = {
        suiteId: 'suite-auth-001',
        suiteTitle: 'User Authentication Suite',
        requirements: [
            {
                id: 'REQ_001',
                title: 'User Login with Email and Password',
                description: 'User enters credentials to authenticate.',
                linkedTestsCount: 1,
                missingCategories: ['Negative', 'Security']
            },
            {
                id: 'REQ_002',
                title: 'Multi-Factor Authentication Challenge',
                description: 'User completes TOTP challenge.',
                linkedTestsCount: 0,
                missingCategories: ['Functional', 'Negative', 'Security']
            },
            {
                id: 'REQ_003',
                title: 'Password Reset Token Issuance',
                description: 'Generates secure expiring token.',
                linkedTestsCount: 2,
                missingCategories: ['Edge']
            }
        ],
        gapShortcuts: [
            {
                id: 'gap_no_negative',
                label: '2 requirements have no negative test',
                requirementId: 'all',
                categories: ['Negative']
            },
            {
                id: 'gap_single_test',
                label: '1 requirement has a single test',
                requirementId: 'REQ_001',
                categories: ['Negative', 'Edge']
            },
            {
                id: 'gap_untested',
                label: '1 requirement has 0 tests',
                requirementId: 'REQ_002',
                categories: ['Functional', 'Negative']
            }
        ]
    };

    const mockGeneratedRecs = [
        {
            id: 'rec_sec_001',
            title: 'Verify rate limiting and lockout after 5 consecutive failed login attempts',
            category: 'Security',
            priority: 'Critical',
            relatedRequirementId: 'REQ_001',
            relatedRequirementTitle: 'User Login with Email and Password',
            recommendationReason: 'Mitigates brute-force credential stuffing attacks against authentication endpoints.',
            coverageGapAddressed: 'Closes critical security gap on REQ_001 by validating account lockout policy.',
            preconditions: 'Target user account exists and is in active status.',
            steps: [
                'Send 5 consecutive POST requests with invalid passwords',
                'Attempt 6th login with valid password',
                'Verify HTTP 429 Too Many Requests response with retry header'
            ],
            expectedResult: 'Account is temporarily locked for 15 minutes; security event is logged.',
            similarityScore: 15,
            mostSimilarCaseId: null,
            isDuplicate: false,
            status: 'pending'
        },
        {
            id: 'rec_neg_002',
            title: 'Verify password reset token invalidation on timestamp expiration',
            category: 'Negative',
            priority: 'High',
            relatedRequirementId: 'REQ_003',
            relatedRequirementTitle: 'Password Reset Token Issuance',
            recommendationReason: 'Prevents token reuse attacks if user accesses reset link after expiration window.',
            coverageGapAddressed: 'Addresses missing negative validation for stale reset tokens.',
            preconditions: 'Password reset link was generated 16 minutes prior (15m TTL).',
            steps: [
                'Navigate to password reset URL with expired token parameter',
                'Enter new valid password and submit'
            ],
            expectedResult: 'System rejects token with clear error message; no password update occurs.',
            similarityScore: 45,
            mostSimilarCaseId: 'TC_NEG_005',
            isDuplicate: false,
            status: 'pending'
        },
        {
            id: 'rec_edge_003',
            title: 'Verify MFA challenge boundary condition with expired 30-second TOTP code',
            category: 'Edge',
            priority: 'Medium',
            relatedRequirementId: 'REQ_002',
            relatedRequirementTitle: 'Multi-Factor Authentication Challenge',
            recommendationReason: 'Guards against race condition window acceptance of previous TOTP period.',
            coverageGapAddressed: 'Verifies boundary tolerance window for one-time passcode verification.',
            preconditions: 'User has successfully completed step 1 credential verification.',
            steps: [
                'Wait for TOTP code countdown timer to reach 00:00',
                'Submit the previous window code at second 31'
            ],
            expectedResult: 'MFA challenge fails; user is prompted to enter fresh code.',
            similarityScore: 10,
            mostSimilarCaseId: null,
            isDuplicate: false,
            status: 'pending'
        }
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
                id: 'user-rec-test-1',
                email: 'qa@testnexa.ai',
                name: 'Kishor Gogoi',
                organizationId: 'org-test-1'
            }));
            localStorage.setItem('testnexa_workspace', JSON.stringify({
                id: 'ws_default',
                name: 'Default Workspace',
                ownerId: 'user-rec-test-1'
            }));
        });

        page = await context.newPage();

        // Route interception on context level
        await context.route('**/api/v1/**', async (route) => {
            const req = route.request();
            const url = req.url();
            const method = req.method();
            const postData = req.postDataJSON ? req.postDataJSON() : null;

            interceptedRequests.push({ method, url, postData, headers: req.headers() });

            // Session check
            if (url.includes('/auth/me') || url.includes('/auth/session')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            user: { id: 'user-rec-test-1', email: 'qa@testnexa.ai', name: 'Kishor Gogoi' }
                        }
                    })
                });
            }

            // Test suites list
            if (url.includes('/sessions') && method === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: mockSuites })
                });
            }

            // Single suite
            if (url.includes('/sessions/suite-auth-001') && method === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: mockSuites[0] })
                });
            }

            // Recommendations Context
            if (url.includes('/recommendations/context')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: mockContextAuth })
                });
            }

            // Generate
            if (url.includes('/recommendations/generate') && method === 'POST') {
                if (url.includes('error=true')) {
                    return route.fulfill({
                        status: 500,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: false, message: 'AI model service temporarily unavailable' })
                    });
                }
                if (url.includes('no-gaps=true')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: true,
                            data: {
                                recommendations: [],
                                summary: { requirementsAnalyzed: 3, existingTestCasesReviewed: 19, potentialCoverageGapsIdentified: 0 }
                            }
                        })
                    });
                }
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            recommendations: mockGeneratedRecs,
                            summary: {
                                requirementsAnalyzed: 3,
                                existingTestCasesReviewed: 19,
                                potentialCoverageGapsIdentified: 3,
                                recommendationsGenerated: 3
                            }
                        }
                    })
                });
            }

            // Accept / Add
            if ((url.includes('/recommendations/accept') || url.includes('/recommendations/convert-to-drafts')) && method === 'POST') {
                const recs = postData?.recommendations || [];
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            suiteId: 'suite-auth-001',
                            convertedCount: recs.length || 1,
                            skippedCount: 0,
                            skipped: [],
                            addedCases: recs.map((r, i) => ({
                                id: `TC_REC_${i + 1}`,
                                _recommendationId: r.id,
                                title: r.title,
                                status: 'Draft'
                            })),
                            undoToken: 'undo_test_token_123',
                            undoExpiresAt: Date.now() + 600000
                        }
                    })
                });
            }

            // Undo
            if (url.includes('/recommendations/undo') && method === 'POST') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        message: 'Successfully removed test cases',
                        data: { removedCount: 1, removedIds: ['TC_REC_1'] }
                    })
                });
            }

            // Default fallback
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: {} })
            });
        });
    });

    after(async () => {
        if (browser) await browser.close();
    });

    it('1. should verify page header, honest copy, absence of "Application" label and "execution history"', async () => {
        await page.goto('http://localhost:5173/app/recommendations', { waitUntil: 'networkidle' });

        // Check top bar breadcrumb: Analysis > Recommendations
        const breadcrumbText = await page.locator('.app-header__breadcrumbs').innerText();
        assert.ok(breadcrumbText.includes('Analysis'), `Expected Analysis in breadcrumb, got "${breadcrumbText}"`);
        assert.ok(breadcrumbText.includes('Recommendations'), `Expected Recommendations in breadcrumb, got "${breadcrumbText}"`);
        assert.ok(!breadcrumbText.includes('Application'), 'Top bar must NOT show "Application" label');

        // Check H1 is "Smart recommendations"
        const h1 = await page.locator('h1.sr-title').innerText();
        assert.strictEqual(h1.trim(), 'Smart recommendations');

        // Check subtitle copy: does NOT contain "execution history"
        const subtitle = await page.locator('.sr-subtitle').innerText();
        assert.ok(!subtitle.toLowerCase().includes('execution history'), 'Must NOT mention execution history');
        assert.ok(subtitle.includes('requirements and existing tests'));

        // Check muted note: "Recommendations are not saved until you add them to your suite."
        const savedNotice = await page.locator('.sr-saved-notice').innerText();
        assert.ok(savedNotice.includes('Recommendations are not saved until you add them to your suite.'));

        // Check there is NO second "Analyze and Recommend" button in the empty state
        const buttons = await page.locator('button').allInnerTexts();
        const generateButtons = buttons.filter(b => b.toLowerCase().includes('generate recommendations') || b.toLowerCase().includes('analyze and recommend'));
        assert.strictEqual(generateButtons.length, 1, 'There must be exactly ONE primary generate button on the page');
    });

    it('2. should verify deep link parsing from gap actions (?suite=, &requirement=, &categories=)', async () => {
        await page.goto('http://localhost:5173/app/recommendations?suite=suite-auth-001&requirement=REQ_001&categories=Negative,Edge&gap=From%20gap:%201%20requirement%20has%20a%20single%20test', { waitUntil: 'networkidle' });

        // Check gap note banner
        const gapBanner = page.locator('.sr-gap-origin-banner');
        await gapBanner.waitFor({ state: 'visible' });
        const gapText = await gapBanner.innerText();
        assert.ok(gapText.includes('From gap: 1 requirement has a single test'));

        // Check target suite is User Authentication Suite
        const suiteTitle = await page.locator('.sr-combobox-title').innerText();
        assert.ok(suiteTitle.includes('User Authentication Suite'));

        // Check focus requirement select is REQ_001
        const reqVal = await page.locator('#sr-req-select').inputValue();
        assert.strictEqual(reqVal, 'REQ_001');

        // Check Negative and Edge chips are selected
        const negChip = page.locator('.sr-category-chip:has-text("Negative")');
        const edgeChip = page.locator('.sr-category-chip:has-text("Edge")');
        assert.strictEqual(await negChip.getAttribute('aria-pressed'), 'true');
        assert.strictEqual(await edgeChip.getAttribute('aria-pressed'), 'true');
    });

    it('3. should verify gap shortcuts from context endpoint can be applied', async () => {
        await page.goto('http://localhost:5173/app/recommendations?suite=suite-auth-001', { waitUntil: 'networkidle' });

        // Gap shortcuts should render
        const shortcutCard = page.locator('.sr-gap-shortcut-card').first();
        await shortcutCard.waitFor({ state: 'visible' });
        const text = await shortcutCard.innerText();
        assert.ok(text.includes('Use'));

        // Click Use button
        await shortcutCard.locator('.sr-gap-shortcut-btn').click();

        // Check gap note banner appears
        const gapBanner = page.locator('.sr-gap-origin-banner');
        await gapBanner.waitFor({ state: 'visible' });
        assert.ok(await gapBanner.innerText());
    });

    it('4. should verify generating performs NO database writes and is stored in-memory only', async () => {
        await page.goto('http://localhost:5173/app/recommendations?suite=suite-auth-001', { waitUntil: 'networkidle' });

        // Clear recorded intercepted requests
        interceptedRequests.length = 0;

        // Click generate button
        await page.locator('.sr-primary-btn').click();

        // Wait for results
        await page.locator('.sr-results-section').waitFor({ state: 'visible' });

        // Verify only GET context and POST generate were made; NO writes to suites or database
        const writeCalls = interceptedRequests.filter(r =>
            r.method === 'POST' || r.method === 'PUT' || r.method === 'PATCH' || r.method === 'DELETE'
        );
        assert.strictEqual(writeCalls.length, 1);
        assert.ok(writeCalls[0].url.includes('/recommendations/generate'), 'Only /generate POST should be called');

        // Check in-memory results count
        const cardCount = await page.locator('.sr-card').count();
        assert.strictEqual(cardCount, 3);

        // Check localStorage has NO recommendations saved
        const localKeys = await page.evaluate(() => Object.keys(localStorage));
        assert.ok(!localKeys.some(k => k.toLowerCase().includes('recommendation')), 'No recommendations in localStorage');
    });

    it('5. should verify result card details, expandable steps, and overlap notes', async () => {
        // First card has Critical priority and REQ_001
        const firstCard = page.locator('.sr-card').first();
        const cardTitle = await firstCard.locator('.sr-card-title').innerText();
        assert.ok(cardTitle.includes('failed login attempts'));

        const priorityPill = await firstCard.locator('.sr-pill-tag--priority').innerText();
        assert.strictEqual(priorityPill, 'Critical');

        // Second card has overlap note (Similar to TC_NEG_005)
        const secondCard = page.locator('.sr-card').nth(1);
        const overlapNote = secondCard.locator('.sr-overlap-note');
        await overlapNote.waitFor({ state: 'visible' });
        const overlapText = await overlapNote.innerText();
        assert.ok(overlapText.includes('Similar to TC_NEG_005, review before adding'));

        // Toggle steps outline
        const stepsToggle = firstCard.locator('.sr-toggle-steps-btn');
        await stepsToggle.click();
        const stepsList = firstCard.locator('.sr-steps-list');
        await stepsList.waitFor({ state: 'visible' });
        assert.strictEqual(await firstCard.locator('.sr-step-item').count(), 3);
    });

    it('6. should verify inline editing of recommendation in memory before adding', async () => {
        const firstCard = page.locator('.sr-card').first();
        await firstCard.locator('.sr-card-btn:has-text("Edit")').click();

        // Edit drawer opens
        const drawer = page.locator('.sr-edit-drawer');
        await drawer.waitFor({ state: 'visible' });

        // Update title
        await page.locator('#sr-edit-title').fill('Updated Title for Rate Limiting Scenario');
        await page.locator('.sr-drawer-save-btn').click();

        // Verify title updated on card
        await drawer.waitFor({ state: 'hidden' });
        const updatedTitle = await firstCard.locator('.sr-card-title').innerText();
        assert.strictEqual(updatedTitle, 'Updated Title for Rate Limiting Scenario');
    });

    it('7. should verify accept flow with idempotency and 10-minute undo toast', async () => {
        interceptedRequests.length = 0;
        const firstCard = page.locator('.sr-card').first();

        // Click Add to suite
        const addBtn = firstCard.locator('.sr-card-btn--add');
        await addBtn.click();

        // Toast appears with Undo button and links
        const toast = page.locator('.sr-toast');
        await toast.waitFor({ state: 'visible' });
        const toastText = await toast.innerText();
        assert.ok(toastText.includes('Added 1 case to User Authentication Suite.'));
        assert.ok(toastText.includes('Undo'));
        assert.ok(toastText.includes('View in test cases'));
        assert.ok(toastText.includes('Review cases'));

        // Verify card displays Added badge
        const addedPill = firstCard.locator('.sr-added-pill');
        await addedPill.waitFor({ state: 'visible' });
        assert.ok(await addedPill.innerText());

        // Check accept call used Idempotency-Key
        const acceptCall = interceptedRequests.find(r => r.url.includes('/recommendations/accept'));
        assert.ok(acceptCall, 'Accept endpoint must be called');
        assert.ok(acceptCall.headers['idempotency-key'], 'Must contain Idempotency-Key header');

        // Click Undo
        await toast.locator('.sr-toast-undo-btn').click();
        const undoCall = interceptedRequests.find(r => r.url.includes('/recommendations/undo'));
        assert.ok(undoCall, 'Undo endpoint must be called');
    });

    it('8. should verify leave protection modal on navigation with unadded recommendations', async () => {
        // We still have 2 unadded recommendations on page
        // Click an in-app sidebar link (e.g. Test Suites)
        await page.locator('a[href="/app/test-suites"]').first().click();

        // Leave protection modal should appear
        const leaveModal = page.locator('.sr-leave-modal');
        await leaveModal.waitFor({ state: 'visible' });
        const modalText = await leaveModal.innerText();
        assert.ok(modalText.includes('These recommendations are not saved.'));
        assert.ok(modalText.includes('Stay'));
        assert.ok(modalText.includes('Leave'));

        // Click Stay
        await page.locator('.sr-leave-stay-btn').click();
        await leaveModal.waitFor({ state: 'hidden' });
        assert.ok(page.url().includes('/app/recommendations'), 'Should remain on recommendations page');
    });

    it('9. should capture responsive screenshots across viewports with zero horizontal overflow', async () => {
        const viewports = [
            { width: 1920, height: 1080, name: '1920_desktop' },
            { width: 1440, height: 900, name: '1440_laptop' },
            { width: 1024, height: 768, name: '1024_tablet' },
            { width: 768, height: 1024, name: '768_tablet_portrait' },
            { width: 390, height: 844, name: '390_mobile' }
        ];

        for (const vp of viewports) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.waitForTimeout(300);

            // Verify no horizontal overflow
            const hasHorizontalScroll = await page.evaluate(() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            });
            assert.strictEqual(hasHorizontalScroll, false, `Viewport ${vp.name} must not have horizontal scroll`);

            // Capture screenshot
            const screenshotPath = path.join(SCREENSHOTS_DIR, `recommendations_${vp.name}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            assert.ok(fs.existsSync(screenshotPath), `Screenshot for ${vp.name} must exist`);
        }
    });
});
