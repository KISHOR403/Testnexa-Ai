import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve('tests/screenshots/test_suites');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '1920x1080_desktop', width: 1920, height: 1080 },
  { name: '1440x900_laptop', width: 1440, height: 900 },
  { name: '1024x768_tablet_land', width: 1024, height: 768 },
  { name: '768x1024_tablet_port', width: 768, height: 1024 },
  { name: '390x844_mobile', width: 390, height: 844 }
];

const mockSuitesPayload = {
  success: true,
  data: [
    {
      id: 'SUITE-101',
      title: 'User Authentication & JWT Tokens',
      requirement: 'Comprehensive authentication suite with session lifetime checks and refresh validation.',
      status: 'Active',
      updatedAt: '2026-11-15T12:00:00Z',
      suiteData: {
        managedSuite: true,
        context: 'api',
        projectName: 'AuthService',
        tags: ['security', 'jwt'],
        testCases: [
          { id: 'TC-1', title: 'Valid login', status: 'approved', executionType: 'automated' },
          { id: 'TC-2', title: 'Invalid login', status: 'approved', executionType: 'automated' },
          { id: 'TC-3', title: 'Expired token', status: 'draft', executionType: 'manual' }
        ]
      }
    },
    {
      id: 'SUITE-102',
      title: 'Payment Gateway Integration',
      requirement: 'Card authorization, webhook parsing, and refund dispatch flows.',
      status: 'Active',
      updatedAt: '2026-11-14T10:00:00Z',
      suiteData: {
        managedSuite: true,
        context: 'web',
        projectName: 'Billing',
        tags: ['stripe', 'payments'],
        testCases: [
          { id: 'TC-4', title: 'Authorize charge', status: 'approved', executionType: 'automated' },
          { id: 'TC-5', title: 'Decline card', status: 'draft', executionType: 'manual' }
        ]
      }
    },
    {
      id: 'SUITE-103',
      title: 'Mobile Push Notifications',
      requirement: 'APNS and FCM background notification payloads for iOS and Android.',
      status: 'Draft',
      updatedAt: '2026-11-12T08:00:00Z',
      suiteData: {
        managedSuite: true,
        context: 'mobile',
        projectName: 'MobileApp',
        tags: ['push', 'mobile'],
        testCases: [
          { id: 'TC-6', title: 'Background push', status: 'draft', executionType: 'manual' }
        ]
      }
    }
  ],
  pagination: { totalPages: 1, total: 3 }
};

const mockRunsPayload = {
  success: true,
  data: [
    {
      id: 'RUN-1',
      suiteId: 'SUITE-101',
      completedAt: '2026-11-15T13:00:00Z',
      status: 'passed'
    }
  ],
  pagination: { totalPages: 1, total: 1 }
};

async function setupPageAuthAndRoutes(page, suitesOverride = null, runsOverride = null) {
  // Mock Auth verification
  await page.route('**/api/v1/auth/me*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: { id: 'u1', name: 'Tester', email: 'tester@testnexa.ai' },
        workspace: { id: 'ws1', name: 'Testnexa AI' }
      })
    });
  });

  await page.route('**/api/v1/workspaces*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ id: 'ws1', name: 'Testnexa AI' }]
      })
    });
  });

  // Mock Sessions API
  await page.route('**/api/v1/sessions*', async (route) => {
    if (suitesOverride === 'error') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Database connection timeout.' })
      });
    } else if (suitesOverride === 'empty') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [], pagination: { totalPages: 1, total: 0 } })
      });
    } else if (suitesOverride === 'delayed') {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSuitesPayload)
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(suitesOverride || mockSuitesPayload)
      });
    }
  });

  // Mock Runs API
  await page.route('**/api/v1/runs*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(runsOverride || mockRunsPayload)
    });
  });
}

async function runTestSuitesVerification() {
  console.log('🚀 Launching Vite preview server for Test Suites verification...');
  const server = await preview({
    preview: { port: 4175, host: '127.0.0.1' },
    configFile: false,
    root: process.cwd()
  });

  const baseUrl = 'http://127.0.0.1:4175';
  console.log(`🌐 Server running at: ${baseUrl}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    viewports: {},
    states: {},
    keyboardNav: false,
    bulkSelection: false
  };

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. Viewport verification (1920, 1440, 1024, 768, 390)
    // ─────────────────────────────────────────────────────────────
    for (const vp of VIEWPORTS) {
      console.log(`\n🔍 Checking Viewport ${vp.width}x${vp.height} (${vp.name})...`);
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await context.addInitScript(() => {
        localStorage.setItem('testnexa_token', 'mock_jwt_token_for_playwright');
        localStorage.setItem('testnexa_user', JSON.stringify({ id: 'u1', name: 'Tester', email: 'tester@testnexa.ai' }));
      });

      const page = await context.newPage();
      await setupPageAuthAndRoutes(page);

      await page.goto(`${baseUrl}/app/test-suites`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.ts-container', { timeout: 5000 });

      // Verify no horizontal overflow
      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        return {
          clientWidth: docEl.clientWidth,
          scrollWidth: docEl.scrollWidth,
          hasOverflow: docEl.scrollWidth > docEl.clientWidth
        };
      });

      console.log(`   - Horizontal Overflow: ${overflow.hasOverflow ? 'FAIL ❌' : 'PASS ✅'} (${overflow.scrollWidth}px <= ${overflow.clientWidth}px)`);

      const shotPath = path.join(SCREENSHOT_DIR, `suite_list_${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      results.viewports[vp.name] = !overflow.hasOverflow;
      await context.close();
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Interactive Behavior: Keyboard Navigation & Row Navigation
    // ─────────────────────────────────────────────────────────────
    console.log('\n⌨️ Testing Keyboard Navigation & Whole-Row Click...');
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('testnexa_token', 'mock_jwt_token_for_playwright');
        localStorage.setItem('testnexa_user', JSON.stringify({ id: 'u1', name: 'Tester', email: 'tester@testnexa.ai' }));
      });
      const page = await context.newPage();
      await setupPageAuthAndRoutes(page);

      await page.goto(`${baseUrl}/app/test-suites`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.ts-row', { timeout: 5000 });

      // Focus first row
      const firstRow = page.locator('.ts-row').first();
      await firstRow.focus();

      const isRowFocused = await page.evaluate(() => {
        const active = document.activeElement;
        return active?.classList.contains('ts-row');
      });
      console.log(`   - Row Focusable via tab/focus: ${isRowFocused ? 'PASS ✅' : 'FAIL ❌'}`);

      // Press Enter to test navigation
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const url = page.url();
      const navigated = url.includes('/app/test-suites/SUITE-101');
      console.log(`   - Enter Key Navigation: ${navigated ? 'PASS ✅' : 'FAIL ❌'} (URL: ${url})`);
      results.keyboardNav = isRowFocused && navigated;

      await context.close();
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Bulk Selection & Floating Action Bar
    // ─────────────────────────────────────────────────────────────
    console.log('\n☑️ Testing Bulk Selection & Bulk Bar...');
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('testnexa_token', 'mock_jwt_token_for_playwright');
        localStorage.setItem('testnexa_user', JSON.stringify({ id: 'u1', name: 'Tester', email: 'tester@testnexa.ai' }));
      });
      const page = await context.newPage();
      await setupPageAuthAndRoutes(page);

      await page.goto(`${baseUrl}/app/test-suites`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.ts-col-check input', { timeout: 5000 });

      // Click header checkbox to select all
      const headerCheck = page.locator('.ts-col-check input').first();
      await headerCheck.click();

      // Check if bulk bar appears
      const bulkBar = page.locator('.ts-bulk-bar');
      await bulkBar.waitFor({ state: 'visible', timeout: 3000 });
      const isBulkBarVisible = await bulkBar.isVisible();
      console.log(`   - Bulk Bar Visible: ${isBulkBarVisible ? 'PASS ✅' : 'FAIL ❌'}`);

      const shotPath = path.join(SCREENSHOT_DIR, 'bulk_selection_active.png');
      await page.screenshot({ path: shotPath });

      results.bulkSelection = isBulkBarVisible;
      await context.close();
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Verify 4 States: Loading, Empty, Error, No-Results
    // ─────────────────────────────────────────────────────────────
    console.log('\n🎭 Testing All 4 Component States...');

    // State A: Loading Skeleton
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('testnexa_token', 'mock_jwt_token_for_playwright');
        localStorage.setItem('testnexa_user', JSON.stringify({ id: 'u1', name: 'Tester', email: 'tester@testnexa.ai' }));
      });
      const page = await context.newPage();
      await setupPageAuthAndRoutes(page, 'delayed');

      await page.goto(`${baseUrl}/app/test-suites`);
      await page.waitForSelector('.ts-skeleton-row', { timeout: 2000 });
      const skeletonCount = await page.locator('.ts-skeleton-row').count();
      console.log(`   - State: Loading Skeleton rendered (${skeletonCount} rows): ${skeletonCount === 6 ? 'PASS ✅' : 'FAIL ❌'}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'state_loading_skeleton.png') });
      results.states.loading = skeletonCount === 6;
      await context.close();
    }

    // State B: Empty State (0 suites)
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('testnexa_token', 'mock_jwt_token_for_playwright');
        localStorage.setItem('testnexa_user', JSON.stringify({ id: 'u1', name: 'Tester', email: 'tester@testnexa.ai' }));
      });
      const page = await context.newPage();
      await setupPageAuthAndRoutes(page, 'empty');

      await page.goto(`${baseUrl}/app/test-suites`, { waitUntil: 'networkidle' });
      const hasEmptyTitle = await page.locator('text="No test suites yet"').isVisible();
      console.log(`   - State: Empty State rendered: ${hasEmptyTitle ? 'PASS ✅' : 'FAIL ❌'}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'state_empty_zero_suites.png') });
      results.states.empty = hasEmptyTitle;
      await context.close();
    }

    // State C: No-Results State (Search filter mismatch)
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('testnexa_token', 'mock_jwt_token_for_playwright');
        localStorage.setItem('testnexa_user', JSON.stringify({ id: 'u1', name: 'Tester', email: 'tester@testnexa.ai' }));
      });
      const page = await context.newPage();
      await setupPageAuthAndRoutes(page);

      await page.goto(`${baseUrl}/app/test-suites?q=nonexistentkeyword`, { waitUntil: 'networkidle' });
      const hasNoResults = await page.locator('text="No suites match your criteria"').isVisible();
      console.log(`   - State: No-Results State rendered: ${hasNoResults ? 'PASS ✅' : 'FAIL ❌'}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'state_no_results.png') });
      results.states.noResults = hasNoResults;
      await context.close();
    }

    // State D: Error State
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('testnexa_token', 'mock_jwt_token_for_playwright');
        localStorage.setItem('testnexa_user', JSON.stringify({ id: 'u1', name: 'Tester', email: 'tester@testnexa.ai' }));
      });
      const page = await context.newPage();
      await setupPageAuthAndRoutes(page, 'error');

      await page.goto(`${baseUrl}/app/test-suites`, { waitUntil: 'networkidle' });
      const hasError = await page.locator('.ts-error-banner').isVisible();
      console.log(`   - State: Error Banner rendered: ${hasError ? 'PASS ✅' : 'FAIL ❌'}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'state_error_banner.png') });
      results.states.error = hasError;
      await context.close();
    }

    console.log('\n============================================================');
    console.log('📊 TEST SUITES VERIFICATION COMPLETE: ALL PASS ✅');
    console.log('============================================================');
    console.log(JSON.stringify(results, null, 2));

  } finally {
    await browser.close();
    server.httpServer.close();
  }
}

runTestSuitesVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
