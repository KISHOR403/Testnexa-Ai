import { chromium } from 'playwright';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 2 // High-DPI retina capture
  });
  const page = await context.newPage();

  // Dismiss cookie consent banner in localStorage before loading
  await page.addInitScript(() => {
    localStorage.setItem('cookieConsent', 'accepted');
    localStorage.setItem('testnexa_cookie_consent', 'true');
    sessionStorage.setItem('testnexa_app_initialized', 'true');
  });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // If cookie banner is still visible, click Accept All or remove it
  try {
    const acceptBtn = await page.$('button:has-text("Accept All")');
    if (acceptBtn) {
      await acceptBtn.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {
    // Ignore
  }

  // 1. Capture the Product Canvas directly (the sleek software window)
  const productCanvas = await page.$('#product-canvas');
  if (productCanvas) {
    console.log('Capturing #product-canvas...');
    await productCanvas.screenshot({
      path: 'public/screenshots/product-canvas.png'
    });
    console.log('Saved public/screenshots/product-canvas.png');
  }

  // 2. Capture the full Hero section including the headline and canvas
  const heroSection = await page.$('.tn-hero-section');
  if (heroSection) {
    console.log('Capturing .tn-hero-section...');
    await heroSection.screenshot({
      path: 'public/screenshots/hero-preview.png'
    });
    console.log('Overwrote public/screenshots/hero-preview.png with new UI!');
  }

  // 3. Let's also capture Section A (Requirement Transformation) or Section C (TestSuiteChapter)
  const testSuiteChapter = await page.$('#test-suite-chapter, .tn-test-suite-chapter, #transformation');
  if (testSuiteChapter) {
    await testSuiteChapter.screenshot({
      path: 'public/screenshots/transformation-preview.png'
    });
    console.log('Saved transformation preview');
  }

  await browser.close();
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
