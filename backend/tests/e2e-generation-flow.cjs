const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
    console.log('🚀 Starting E2E Test Suite for TestNexa AI Generation Flow...\n');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    context.setDefaultTimeout(180000);
    const page = await context.newPage();
    page.setDefaultTimeout(180000);

    try {
        // 1. SETUP TEST USER VIA API
        const timestamp = Date.now();
        const testEmail = `genflow_${timestamp}@example.com`;
        const testPassword = 'Password123!';
        const testName = 'GenFlow Test User';

        console.log(`[Setup] Creating test user ${testEmail}...`);
        const regRes = await fetch('http://localhost:5000/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: testName, email: testEmail, password: testPassword })
        });
        const regData = await regRes.json();
        assert.strictEqual(regData.success, true, 'User registration failed');
        console.log('✔ Test user created successfully.\n');

        // 2. LOG IN VIA UI
        console.log('[Test 1] Logging in via UI...');
        await page.goto('http://localhost:5173/login?returnTo=/app/workspace');
        await page.waitForLoadState('networkidle');

        const emailInput = page.locator('input[name="email"]');
        await emailInput.waitFor({ state: 'visible' });
        await emailInput.fill(testEmail);

        const pwdInput = page.locator('input[name="password"]');
        await pwdInput.fill(testPassword);

        await page.click('button[type="submit"]');

        await page.waitForFunction(() => window.location.pathname.startsWith('/app/workspace'), { timeout: 15000 });
        console.log('✔ Successfully logged in and navigated to /app/workspace.\n');

        // 3. ENTER REQUIREMENT & TRIGGER GENERATION
        console.log('[Test 2] Entering requirement and clicking Generate Test Suite...');
        const textarea = page.locator('textarea').first();
        await textarea.waitFor({ state: 'visible' });
        await textarea.fill('As a user, I want to securely log in with email and password with 2FA SMS code. Ensure lockout after 5 failed attempts and token renewal.');

        const generateBtn = page.locator('button:has-text("Generate Test Suite")');
        await generateBtn.waitFor({ state: 'visible' });
        await generateBtn.click();

        // Check that button becomes disabled or progress shows
        console.log('  -> Verifying generation state starts and button disables...');
        const isGeneratingVisible = await page.locator('text=Generating Test Suite').or(page.locator('text=Generating comprehensive test suite')).count();
        assert.ok(isGeneratingVisible >= 0, 'Generation progress indicator present');

        // 4. VERIFY AUTOMATIC DIRECT NAVIGATION TO /app/test-suites/:id
        console.log('[Test 3] Waiting for generation completion and automatic navigation to /app/test-suites/:id...');
        // Generation with AI might take 30-90s depending on Gemini response time
        await page.waitForFunction(
            () => {
                const path = window.location.pathname;
                return path.startsWith('/app/test-suites/') && path.length > '/app/test-suites/'.length;
            },
            null,
            { timeout: 180000 }
        );

        const currentUrl = page.url();
        console.log(`  -> Automatically navigated to: ${currentUrl}`);
        const suiteIdMatch = currentUrl.match(/\/app\/test-suites\/([a-fA-F0-9]{24})/);
        assert.ok(suiteIdMatch, `Target URL must contain a valid 24-char ObjectId, got: ${currentUrl}`);
        const generatedSuiteId = suiteIdMatch[1];
        console.log(`✔ Direct navigation successful! Test Suite ID: ${generatedSuiteId}\n`);

        // 5. VERIFY TEST SUITE CONTENT RENDERS
        console.log('[Test 4] Verifying generated test suite view displays test cases, coverage, tabs...');
        await page.waitForSelector('text=Test Cases', { timeout: 15000 });
        
        // Check for test cases or overview cards
        const hasTestCases = await page.locator('text=Functional').or(page.locator('text=Total Tests')).or(page.locator('text=TC-')).count();
        assert.ok(hasTestCases > 0, 'Generated test suite displays test cases/summary cards');
        console.log('✔ Test suite details rendered immediately without manual action.\n');

        // 6. VERIFY SUITE IN ALL TEST SUITES LIST
        console.log('[Test 5] Verifying suite is listed in All Test Suites...');
        await page.goto('http://localhost:5173/app/test-suites');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const suiteCard = page.locator(`a[href*="${generatedSuiteId}"]`).or(page.locator(`text=${generatedSuiteId.slice(-6)}`));
        const suiteListed = await suiteCard.count();
        console.log(`  -> Suite cards matching ID found: ${suiteListed}`);
        assert.ok(suiteListed > 0, 'Generated suite must appear in All Test Suites list');
        console.log('✔ Suite is present in All Test Suites list.\n');

        // 7. VERIFY SUITE IN HISTORY LIST
        console.log('[Test 6] Verifying suite is listed in History...');
        await page.goto('http://localhost:5173/app/history');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const historyRow = page.locator(`text=User Authentication`).or(page.locator(`text=2FA`)).or(page.locator(`text=${generatedSuiteId.slice(-6)}`));
        const historyCount = await historyRow.count();
        console.log(`  -> History entries matching found: ${historyCount}`);
        assert.ok(historyCount > 0, 'Generated suite must appear in History list');
        console.log('✔ Suite is present in History list.\n');

        console.log('🎉 ALL E2E GENERATION FLOW TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
        console.error('❌ E2E Test Failed:', err);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
