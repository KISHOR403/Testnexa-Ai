import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('CI/CD Integrations Frontend Specifications', () => {
    const cssPath = path.resolve('frontend/styles/app/CiCdIntegrations.css');
    const pagePath = path.resolve('frontend/pages/app/CiCdIntegrationsPage.jsx');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    test('1. Strict Black & White Theme Compliance', () => {
        // Must contain standard tokens
        assert.ok(cssContent.includes('--cicd-bg: #000000;'), 'CSS must define --cicd-bg: #000000');
        assert.ok(cssContent.includes('--cicd-surface: #0A0A0A;'), 'CSS must define --cicd-surface: #0A0A0A');
        assert.ok(cssContent.includes('--cicd-surface-2: #111111;'), 'CSS must define --cicd-surface-2: #111111');
        assert.ok(cssContent.includes('--cicd-line: rgba(255, 255, 255, 0.10);'), 'CSS must define --cicd-line');
        assert.ok(cssContent.includes('--cicd-line-hi: rgba(255, 255, 255, 0.22);'), 'CSS must define --cicd-line-hi');

        // Must NOT contain banned colors
        const bannedHexes = ['#8baf9a', '#e5c07b', '#f87171', '#60a5fa', '#facc15', '#0b0f12'];
        const lowerCss = cssContent.toLowerCase();
        for (const hex of bannedHexes) {
            assert.ok(!lowerCss.includes(hex), `CSS must not contain banned color ${hex}`);
        }
    });

    test('2. WAI-ARIA Tablist and Keyboard Navigation', () => {
        assert.ok(pageContent.includes('role="tablist"'), 'Must contain role="tablist"');
        assert.ok(pageContent.includes('role="tab"'), 'Must contain role="tab"');
        assert.ok(pageContent.includes('role="tabpanel"'), 'Must contain role="tabpanel"');
        assert.ok(pageContent.includes('aria-selected'), 'Must manage aria-selected state');
        assert.ok(pageContent.includes('aria-controls'), 'Must associate tabs with panels via aria-controls');
        assert.ok(pageContent.includes('handleTabKeyDown'), 'Must handle keyboard navigation for tabs');
        assert.ok(pageContent.includes('ArrowRight') && pageContent.includes('ArrowLeft'), 'Must navigate with Arrow keys');
    });

    test('3. Tab Counts: (0) Never Rendered', () => {
        // Tab count must only render when count > 0
        assert.ok(!pageContent.includes('Pipelines ({pipelines.length})'), 'Must not render Pipelines ({pipelines.length})');
        assert.ok(!pageContent.includes('Activity ({activity.length})'), 'Must not render Activity ({activity.length})');
        assert.ok(pageContent.includes('pipelines.length > 0 && ('), 'Pipelines count must only render when > 0');
        assert.ok(pageContent.includes('activity.length > 0 && ('), 'Activity count must only render when > 0');
    });

    test('4. Single Connect GitHub Button & No Duplicate in Header', () => {
        // Header actions must have Refresh only
        const headerMatch = pageContent.match(/<header className="cicd-header">([\s\S]*?)<\/header>/);
        assert.ok(headerMatch, 'Page must contain header');
        const headerText = headerMatch[1];
        assert.ok(!headerText.includes('Connect GitHub'), 'Header must NOT have a duplicate Connect GitHub button');
        assert.ok(headerText.includes('Refresh'), 'Header must have Refresh button');
    });

    test('5. Single-Use Token Security in Pipeline Wizard', () => {
        assert.ok(pageContent.includes('Save your CI token now'), 'Must warn user to save token');
        assert.ok(pageContent.includes('ONLY ONCE'), 'Must mention token is shown only once');
        assert.ok(pageContent.includes('hasAcknowledgedTokenSaved'), 'Must require user acknowledgement or copy before closing');
        assert.ok(pageContent.includes('TESTNEXA_CI_TOKEN'), 'Must instruct user to save as TESTNEXA_CI_TOKEN');
    });

    test('6. Phase Gating for Test Execution (features.testRuns)', () => {
        assert.ok(pageContent.includes("useFeature('testRuns')"), 'Must consume testRuns feature flag');
        assert.ok(pageContent.includes('Pipeline activity is coming soon'), 'Must render Coming Soon panel when testRuns is disabled');
        assert.ok(pageContent.includes('data-testid="cicd-cs-panel"'), 'Must have identifiable test-id for automated verification');
    });

    test('7. Architecture Documentation and Integration Links', () => {
        const coveragePath = path.resolve('frontend/pages/app/CoverageTraceabilityPage.jsx');
        const risksPath = path.resolve('frontend/pages/app/RisksPage.jsx');
        const intelPath = path.resolve('frontend/pages/app/ExecutionIntelligenceDashboardPage.jsx');

        const covContent = fs.readFileSync(coveragePath, 'utf8');
        const rskContent = fs.readFileSync(risksPath, 'utf8');
        const intContent = fs.readFileSync(intelPath, 'utf8');

        assert.ok(covContent.includes('/app/cicd'), 'Coverage page must link to /app/cicd');
        assert.ok(rskContent.includes('/app/cicd'), 'Risks page must link to /app/cicd');
        assert.ok(intContent.includes('/app/cicd'), 'Intelligence page must link to /app/cicd');
    });
});
