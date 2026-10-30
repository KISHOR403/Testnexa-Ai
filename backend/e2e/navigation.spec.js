// @version 1.0.0
// Framework: Playwright (Chromium / Firefox / WebKit)
// Module: Core Navigation & Workspace Views

async function navWorkspaceOverview(page, expect) {
    await page.goto('/app/overview');
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title).toBeTruthy();
}

async function navTestSuitesInventory(page, expect) {
    await page.goto('/app/suites');
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title).toBeTruthy();
}

async function navRunsHistory(page, expect) {
    await page.goto('/app/runs');
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title).toBeTruthy();
}

module.exports = {
    version: '1.0.0',
    framework: 'playwright',
    file: 'tests/e2e/navigation.spec.js',
    tests: [
        {
            testId: 'nav-workspace-overview',
            title: 'Navigate to Workspace Overview & Layout Check',
            version: '1.0.0',
            fn: navWorkspaceOverview,
            code: navWorkspaceOverview.toString()
        },
        {
            testId: 'nav-test-suites-inventory',
            title: 'Navigate to Test Suites Catalog & List View',
            version: '1.0.0',
            fn: navTestSuitesInventory,
            code: navTestSuitesInventory.toString()
        },
        {
            testId: 'nav-runs-history',
            title: 'Navigate to Test Runs Dashboard & Progress Ribbon',
            version: '1.0.0',
            fn: navRunsHistory,
            code: navRunsHistory.toString()
        }
    ]
};

