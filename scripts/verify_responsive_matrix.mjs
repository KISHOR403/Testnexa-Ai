import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve('tests/screenshots/matrix');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '2560x1440_uhd', width: 2560, height: 1440 },
  { name: '1920x1080_fhd', width: 1920, height: 1080 },
  { name: '1440x900_laptop', width: 1440, height: 900 },
  { name: '1280x720_hd', width: 1280, height: 720 },
  { name: '1024x768_ipad_land', width: 1024, height: 768 },
  { name: '820x1180_ipad_air', width: 820, height: 1180 },
  { name: '768x1024_ipad_port', width: 768, height: 1024 },
  { name: '430x932_iphone_pro_max', width: 430, height: 932 },
  { name: '390x844_iphone_14', width: 390, height: 844 },
  { name: '360x740_galaxy_s8', width: 360, height: 740 },
  { name: '320x568_iphone_se', width: 320, height: 568 },
  { name: '844x390_iphone_landscape', width: 844, height: 390 }
];

async function runMatrixVerification() {
  console.log('🚀 Launching Vite preview server for Responsive Matrix verification...');
  const server = await preview({
    preview: { port: 4174, host: '127.0.0.1' },
    configFile: false,
    root: process.cwd()
  });

  const baseUrl = 'http://127.0.0.1:4174';
  console.log(`🌐 Server running at: ${baseUrl}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const report = [];
  let allPassed = true;

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n🔍 Testing Viewport: ${vp.width}x${vp.height} (${vp.name})...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });

      // Verification checks
      const metrics = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const formCol = document.querySelector('.tn-auth-form-col');
        const showcaseCol = document.querySelector('.tn-auth-showcase-col');
        const submitBtn = document.querySelector('button[type="submit"]');

        const clientWidth = docEl.clientWidth;
        const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
        const hasHorizontalOverflow = scrollWidth > clientWidth;

        // Check if form column has its own scrollbar
        const formColStyle = formCol ? window.getComputedStyle(formCol) : null;
        const formColOverflowY = formColStyle ? formColStyle.overflowY : 'none';
        const formColHasScrollbar = formCol ? (formCol.scrollHeight > formCol.clientHeight && formColOverflowY !== 'visible' && formColOverflowY !== 'hidden') : false;

        // Check right column sticky / display
        const showcaseStyle = showcaseCol ? window.getComputedStyle(showcaseCol) : null;
        const showcaseDisplay = showcaseStyle ? showcaseStyle.display : 'none';

        // Check submit button visibility
        const btnRect = submitBtn ? submitBtn.getBoundingClientRect() : null;
        const submitReachable = !!submitBtn && !!btnRect && btnRect.width > 0 && btnRect.height > 0;

        return {
          clientWidth,
          scrollWidth,
          hasHorizontalOverflow,
          formColOverflowY,
          formColHasScrollbar,
          showcaseDisplay,
          submitReachable,
          btnRect
        };
      });

      // Capture screenshot
      const shotPath = path.join(SCREENSHOT_DIR, `${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      const passed = !metrics.hasHorizontalOverflow && !metrics.formColHasScrollbar && metrics.submitReachable;
      if (!passed) allPassed = false;

      report.push({
        viewport: `${vp.width}x${vp.height}`,
        name: vp.name,
        passed,
        ...metrics,
        screenshot: `${vp.name}.png`
      });

      console.log(`   - Horizontal Overflow: ${metrics.hasHorizontalOverflow ? 'FAIL ❌' : 'PASS ✅'} (${metrics.scrollWidth}px <= ${metrics.clientWidth}px)`);
      console.log(`   - Left Col Scrollbar: ${metrics.formColHasScrollbar ? 'FAIL ❌' : 'PASS ✅'} (overflow-y: ${metrics.formColOverflowY})`);
      console.log(`   - Submit Reachable: ${metrics.submitReachable ? 'PASS ✅' : 'FAIL ❌'}`);

      await context.close();
    }

    // ─────────────────────────────────────────────────────────────
    // TEST: 200% BROWSER ZOOM (1280x720 at scale 2)
    // ─────────────────────────────────────────────────────────────
    console.log(`\n🔍 Testing 200% Browser Zoom...`);
    const zoomContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2
    });
    const zoomPage = await zoomContext.newPage();
    await zoomPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });

    // Simulate 200% page zoom
    await zoomPage.evaluate(() => {
      document.body.style.zoom = '200%';
    });

    const zoomMetrics = await zoomPage.evaluate(() => {
      const docEl = document.documentElement;
      const clientWidth = docEl.clientWidth;
      const scrollWidth = Math.max(docEl.scrollWidth, document.body.scrollWidth);
      return {
        clientWidth,
        scrollWidth,
        hasHorizontalOverflow: scrollWidth > clientWidth + 2 // 2px epsilon for browser rounding
      };
    });

    const zoomShot = path.join(SCREENSHOT_DIR, 'zoom_200_percent.png');
    await zoomPage.screenshot({ path: zoomShot, fullPage: false });
    console.log(`   - 200% Zoom Horizontal Overflow: ${zoomMetrics.hasHorizontalOverflow ? 'FAIL ❌' : 'PASS ✅'}`);
    await zoomContext.close();

    // ─────────────────────────────────────────────────────────────
    // TEST: FOCUS RING COLOR (WHITE #fff / rgb(255, 255, 255))
    // ─────────────────────────────────────────────────────────────
    console.log(`\n🔍 Testing Focus Ring on Email Input...`);
    const focusContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const focusPage = await focusContext.newPage();
    await focusPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });

    const emailInput = focusPage.locator('input[type="email"]');
    await emailInput.focus();

    const focusStyles = await focusPage.evaluate(() => {
      const input = document.querySelector('input[type="email"]');
      const cs = window.getComputedStyle(input);
      return {
        outlineColor: cs.outlineColor,
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        borderColor: cs.borderColor,
        boxShadow: cs.boxShadow
      };
    });

    console.log(`   - Outline Color: ${focusStyles.outlineColor}`);
    console.log(`   - Outline Style: ${focusStyles.outlineStyle}`);
    console.log(`   - Border Color: ${focusStyles.borderColor}`);

    const isWhiteFocus =
      focusStyles.outlineColor === 'rgb(255, 255, 255)' ||
      focusStyles.outlineColor === '#ffffff' ||
      focusStyles.borderColor === 'rgb(255, 255, 255)' ||
      focusStyles.borderColor === '#ffffff';

    console.log(`   - White Focus Ring: ${isWhiteFocus ? 'PASS ✅' : 'FAIL ❌'}`);

    const focusShot = path.join(SCREENSHOT_DIR, 'focus_ring_email_white.png');
    await focusPage.screenshot({ path: focusShot });
    await focusContext.close();

    // Summary
    console.log('\n============================================================');
    console.log(`📊 RESPONSIVE VERIFICATION COMPLETE: ${allPassed && isWhiteFocus ? 'ALL PASSED ✅' : 'ISSUES DETECTED ❌'}`);
    console.log('============================================================');
    console.log(JSON.stringify({ report, allPassed, isWhiteFocus, zoomPassed: !zoomMetrics.hasHorizontalOverflow }, null, 2));

  } finally {
    await browser.close();
    server.httpServer.close();
  }
}

runMatrixVerification().catch(err => {
  console.error('Error during matrix verification:', err);
  process.exit(1);
});
