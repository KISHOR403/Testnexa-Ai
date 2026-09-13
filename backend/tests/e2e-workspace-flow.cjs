const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
    console.log('🚀 Starting E2E Test Suite for TestNexa Get Started / Generate Test Suite Authentication Flow...\n');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
        // ==========================================
        // 1. SETUP TEST USER VIA REGISTRATION API
        // ==========================================
        const testEmail = `test_flow_${Date.now()}@example.com`;
        const testPassword = 'Password123!';
        const testName = 'Flow Test User';

        console.log(`[Setup] Creating test user ${testEmail}...`);
        const regRes = await fetch('http://localhost:5000/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: testName, email: testEmail, password: testPassword })
        });
        const regData = await regRes.json();
        assert.strictEqual(regData.success, true, 'User registration failed');
        console.log('✔ Test user created successfully.\n');

        // ==========================================
        // TEST CASE 1: UNLOGGED USER CLICKS HERO "GENERATE TEST SUITE"
        // ==========================================
        console.log('[Test 1] Unauthenticated user clicks Hero "Generate Test Suite"...');
        const pageLanding = await context.newPage();
        await pageLanding.goto('http://localhost:5173/');
        await pageLanding.waitForLoadState('networkidle');

        // Verify we are on landing page
        assert.strictEqual(new URL(pageLanding.url()).pathname, '/', 'Original page should be on /');

        // Click Hero "Generate Test Suite" and catch popup (new tab)
        const [tabFromHero] = await Promise.all([
            context.waitForEvent('page'),
            pageLanding.click('#hero-generate-btn')
        ]);
        await tabFromHero.waitForLoadState('networkidle');

        // Check new tab URL and original tab URL
        const heroTabUrl = new URL(tabFromHero.url());
        console.log(`  -> New tab opened to: ${heroTabUrl.pathname}${heroTabUrl.search}`);
        assert.strictEqual(heroTabUrl.pathname, '/login', 'New tab must navigate to /login');
        assert.strictEqual(heroTabUrl.searchParams.get('returnTo'), '/app/workspace', 'returnTo must be /app/workspace');
        assert.strictEqual(new URL(pageLanding.url()).pathname, '/', 'Original landing tab must remain on /');
        console.log('✔ Test 1 passed: New tab opened to Login with returnTo preserved; original tab undisturbed.\n');

        // ==========================================
        // TEST CASE 2: PRESERVE DESTINATION ACROSS LOGIN -> SIGNUP -> LOGIN
        // ==========================================
        console.log('[Test 2] Preserve destination across Login -> Signup -> Login transition...');
        await tabFromHero.click('text=Create one now');
        await tabFromHero.waitForLoadState('networkidle');
        const signupUrl = new URL(tabFromHero.url());
        console.log(`  -> Switched to signup: ${signupUrl.pathname}${signupUrl.search}`);
        assert.strictEqual(signupUrl.pathname, '/signup', 'Must be on /signup');
        assert.strictEqual(signupUrl.searchParams.get('returnTo'), '/app/workspace', 'returnTo preserved on /signup');

        await tabFromHero.click('text=Sign in');
        await tabFromHero.waitForLoadState('networkidle');
        const backToLoginUrl = new URL(tabFromHero.url());
        console.log(`  -> Switched back to login: ${backToLoginUrl.pathname}${backToLoginUrl.search}`);
        assert.strictEqual(backToLoginUrl.pathname, '/login', 'Must be on /login');
        assert.strictEqual(backToLoginUrl.searchParams.get('returnTo'), '/app/workspace', 'returnTo preserved on /login');
        console.log('✔ Test 2 passed: returnTo parameter strictly preserved across Login and Signup links.\n');

        // ==========================================
        // TEST CASE 3: LOGIN REDIRECTS TO INTENDED WORKSPACE DESTINATION
        // ==========================================
        console.log('[Test 3] Log in with returnTo=/app/workspace...');
        // Wait for login form to be visible and active
        const emailInput = tabFromHero.locator('input[name="email"]');
        await emailInput.waitFor({ state: 'visible' });
        await emailInput.click();
        await emailInput.fill(testEmail);

        const pwdInput = tabFromHero.locator('input[name="password"]');
        await pwdInput.click();
        await pwdInput.fill(testPassword);

        await tabFromHero.click('button[type="submit"]');

        await tabFromHero.waitForFunction(() => window.location.pathname.startsWith('/app/workspace'), { timeout: 10000 });
        const postLoginUrl = new URL(tabFromHero.url());
        console.log(`  -> Post-login URL: ${postLoginUrl.pathname}`);
        assert.strictEqual(postLoginUrl.pathname, '/app/workspace', 'Must navigate automatically to /app/workspace');
        assert.strictEqual(new URL(pageLanding.url()).pathname, '/', 'Original tab must still remain on landing page');
        console.log('✔ Test 3 passed: Successfully redirected to /app/workspace after login; original tab remained on landing page.\n');

        // ==========================================
        // TEST CASE 4: AUTHENTICATED USER CLICKS HERO "GENERATE TEST SUITE"
        // ==========================================
        console.log('[Test 4] Authenticated user clicks Hero "Generate Test Suite"...');
        // Bring pageLanding into focus and trigger click
        const [tabAuthHero] = await Promise.all([
            context.waitForEvent('page'),
            pageLanding.click('#hero-generate-btn')
        ]);
        await tabAuthHero.waitForLoadState('networkidle');
        const authHeroTabUrl = new URL(tabAuthHero.url());
        console.log(`  -> New tab opened to: ${authHeroTabUrl.pathname}`);
        assert.strictEqual(authHeroTabUrl.pathname, '/app/workspace', 'Authenticated click must directly open /app/workspace');
        assert.strictEqual(new URL(pageLanding.url()).pathname, '/', 'Original landing tab must remain on /');
        console.log('✔ Test 4 passed: Authenticated user opened /app/workspace directly in new tab with no login/signup screen.\n');

        // ==========================================
        // TEST CASE 5: AUTHENTICATED USER CLICKS FINAL CTA "GENERATE TEST SUITE"
        // ==========================================
        console.log('[Test 5] Authenticated user clicks FinalCTA "Generate Test Suite"...');
        const [tabAuthFinalCTA] = await Promise.all([
            context.waitForEvent('page'),
            pageLanding.click('#final-cta-generate-btn')
        ]);
        await tabAuthFinalCTA.waitForLoadState('networkidle');
        const authFinalTabUrl = new URL(tabAuthFinalCTA.url());
        console.log(`  -> New tab opened to: ${authFinalTabUrl.pathname}`);
        assert.strictEqual(authFinalTabUrl.pathname, '/app/workspace', 'Final CTA must directly open /app/workspace');
        assert.strictEqual(new URL(pageLanding.url()).pathname, '/', 'Original landing tab must remain on /');
        console.log('✔ Test 5 passed: Final CTA opened /app/workspace directly in new tab.\n');

        // ==========================================
        // TEST CASE 6: DIRECT UNLOGGED ACCESS TO /app/workspace GUARDS ROUTE
        // ==========================================
        console.log('[Test 6] Unauthenticated direct access to /app/workspace in a fresh incognito context...');
        const freshContext = await browser.newContext();
        const unauthPage = await freshContext.newPage();
        await unauthPage.goto('http://localhost:5173/app/workspace');
        await unauthPage.waitForFunction(() => window.location.pathname.startsWith('/login'), { timeout: 10000 });

        const guardedUrl = new URL(unauthPage.url());
        console.log(`  -> Intercepted to: ${guardedUrl.pathname}${guardedUrl.search}`);
        assert.strictEqual(guardedUrl.pathname, '/login', 'Unauthenticated direct route must redirect to /login');
        assert.strictEqual(guardedUrl.searchParams.get('returnTo'), '/app/workspace', 'ProtectedRoute must provide returnTo=/app/workspace');
        console.log('✔ Test 6 passed: ProtectedRoute intercepted direct workspace access and provided returnTo query parameter.\n');

        // ==========================================
        // TEST CASE 7: OPEN REDIRECT RESILIENCE
        // ==========================================
        console.log('[Test 7] Open redirect prevention on malicious returnTo...');
        await unauthPage.goto('http://localhost:5173/login?returnTo=https%3A%2F%2Fevil.com');
        const unauthEmail = unauthPage.locator('input[name="email"]');
        await unauthEmail.waitFor({ state: 'visible' });
        await unauthEmail.click();
        await unauthEmail.fill(testEmail);
        await unauthPage.fill('input[name="password"]', testPassword);
        await unauthPage.click('button[type="submit"]');

        await unauthPage.waitForFunction(() => window.location.pathname.startsWith('/app/workspace'), { timeout: 10000 });
        const sanitizedUrl = new URL(unauthPage.url());
        console.log(`  -> Redirected safely to: ${sanitizedUrl.pathname}`);
        assert.strictEqual(sanitizedUrl.pathname, '/app/workspace', 'Malicious returnTo must be sanitized to /app/workspace');
        console.log('✔ Test 7 passed: Open redirect attempt safely neutralized.\n');

        console.log('🎉 ALL 7 END-TO-END TESTS PASSED WITH 100% SUCCESS!');
    } catch (err) {
        console.error('❌ E2E Test Failure:', err);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
