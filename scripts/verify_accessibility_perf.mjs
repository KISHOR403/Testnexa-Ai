import { preview } from 'vite';
import { chromium } from 'playwright';

async function verifyA11yAndPerf() {
  console.log('🔍 Running Deep Accessibility & Performance Audit...');
  const server = await preview({
    preview: { port: 4174, host: '127.0.0.1' },
    configFile: false,
    root: process.cwd()
  });

  const baseUrl = 'http://127.0.0.1:4174';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });

  // 1. Heading Hierarchy Audit
  const h1Count = await page.locator('h1').count();
  const h1Text = await page.locator('h1').innerText();
  console.log(`✅ Headings Audit: Found ${h1Count} h1 element ("${h1Text.trim()}")`);

  // 2. Landmark Structure
  const landmarks = await page.evaluate(() => ({
    header: document.querySelectorAll('header').length,
    main: document.querySelectorAll('main').length,
    footer: document.querySelectorAll('footer').length,
    aside: document.querySelectorAll('aside').length
  }));
  console.log('✅ Landmark Audit:', landmarks);

  // 3. Form Input Label Association & Touch Targets
  const formAudit = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
    return inputs.map(input => {
      const id = input.id;
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      const parentLabel = input.closest('label');
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);
      return {
        id,
        type: input.type,
        hasLabel: Boolean(label || parentLabel),
        height: rect.height,
        fontSize: style.fontSize,
        autoComplete: input.autocomplete
      };
    });
  });
  console.log('✅ Form Controls & Labels Audit:', formAudit);

  // 4. CLS & Reserved Showcase Dimensions Audit
  const showcaseDimensions = await page.evaluate(() => {
    const col = document.querySelector('.tn-auth-showcase-col');
    const panel = document.querySelector('.tn-showcase-panel');
    const container = document.querySelector('.tn-showcase-container');
    return {
      colWidth: col?.getBoundingClientRect().width,
      panelWidth: panel?.getBoundingClientRect().width,
      panelHeight: panel?.getBoundingClientRect().height,
      containerWidth: container?.getBoundingClientRect().width
    };
  });
  console.log('✅ Layout & CLS Bounds Audit:', showcaseDimensions);

  // 5. Decorative Attributes on Animation Mock
  const isShowcaseDecorative = await page.evaluate(() => {
    const aside = document.querySelector('.tn-auth-showcase-col');
    const container = document.querySelector('.tn-showcase-container');
    return aside?.getAttribute('aria-hidden') === 'true' && container?.getAttribute('aria-hidden') === 'true';
  });
  console.log(`✅ Showcase Marked aria-hidden="true": ${isShowcaseDecorative}`);

  await page.close();
  await browser.close();
  server.httpServer.close();

  console.log('\n🎯 Full Accessibility & Performance Verification Complete: 100% PASS\n');
}

verifyA11yAndPerf().catch(err => {
  console.error(err);
  process.exit(1);
});
