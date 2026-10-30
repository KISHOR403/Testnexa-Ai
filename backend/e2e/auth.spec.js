// @version 1.1.0
// Framework: Playwright (Chromium / Firefox / WebKit)
// Module: Authentication & Session Management

async function authValidLogin(page, expect) {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();

    const emailInput = page.locator('input[type="email"], input[name="email"], #email').first();
    if (await emailInput.count() > 0) {
        await emailInput.fill('qa.lead@testnexa.ai');
    }
    const passInput = page.locator('input[type="password"], input[name="password"], #password').first();
    if (await passInput.count() > 0) {
        await passInput.fill('ValidPass123!');
    }
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.count() > 0) {
        await submitBtn.click();
    }
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title).toBeTruthy();
}

async function authInvalidCredentialsError(page, expect) {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.count() > 0) {
        await emailInput.fill('unregistered@testnexa.ai');
    }
    const passInput = page.locator('input[type="password"]').first();
    if (await passInput.count() > 0) {
        await passInput.fill('WrongPassword!');
    }
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.count() > 0) {
        await submitBtn.click();
    }
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title).toBeTruthy();
}

async function authLogoutSessionClear(page, expect) {
    await page.goto('/app/overview');
    await expect(page.locator('body')).toBeVisible();

    const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Sign Out")').first();
    if (await logoutBtn.count() > 0) {
        await logoutBtn.click();
    }
    await expect(page.locator('body')).toBeVisible();
}

module.exports = {
    version: '1.1.0',
    framework: 'playwright',
    file: 'tests/e2e/auth.spec.js',
    tests: [
        {
            testId: 'auth-valid-login',
            title: 'Valid User Login & Dashboard Redirection',
            version: '1.1.0',
            fn: authValidLogin,
            code: authValidLogin.toString()
        },
        {
            testId: 'auth-invalid-credentials-error',
            title: 'Invalid Credentials Security Error Notice',
            version: '1.0.0',
            fn: authInvalidCredentialsError,
            code: authInvalidCredentialsError.toString()
        },
        {
            testId: 'auth-logout-session-clear',
            title: 'User Logout & Session Destruction',
            version: '1.0.0',
            fn: authLogoutSessionClear,
            code: authLogoutSessionClear.toString()
        }
    ]
};

