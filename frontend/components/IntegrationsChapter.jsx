import React, { useState } from 'react';
import { ArrowRight, Copy, Check, Terminal, Cpu } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const RUNNERS = [
    {
        key: 'playwright',
        name: 'Playwright (.spec.ts)',
        desc: 'Atomic assertions, page object models, strict locators, and deterministic wait assertions ready for npx playwright test.',
        badge: 'TYPESCRIPT'
    },
    {
        key: 'cypress',
        name: 'Cypress (.cy.js)',
        desc: 'Browser-driven test scenarios formatted with cy.intercept(), custom commands, and chained assertion steps.',
        badge: 'JAVASCRIPT'
    },
    {
        key: 'gherkin',
        name: 'Cucumber BDD (.feature)',
        desc: 'Executable human-readable feature files compatible with Cucumber.js, Behave, and SpecFlow automation frameworks.',
        badge: 'GHERKIN'
    },
    {
        key: 'junit',
        name: 'JUnit XML / CI Schema',
        desc: 'Standardized test reporting schemas ready for build-blocking quality gates in GitHub Actions and GitLab CI.',
        badge: 'CI / CD'
    },
    {
        key: 'jira',
        name: 'Jira Software & Zephyr',
        desc: 'Export structured test scenarios directly into Jira tickets and Zephyr Squad/Scale test cycles via REST webhooks.',
        badge: 'REST WEBHOOK'
    }
];

export const IntegrationsChapter = () => {
    const [tabMode, setTabMode] = useState('playwright'); // 'playwright' | 'curl' | 'response'
    const [copied, setCopied] = useState(false);
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const playwrightSnippet = `import { test, expect } from '@playwright/test';

test.describe('Password Recovery Suite (DOC-AUTH-2026 §4.2)', () => {
  test('TC-FUNC-001: Valid password reset dispatches token with 15m TTL', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Registered Email').fill('user@company.com');

    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/v1/auth/reset') && res.status() === 200),
      page.getByRole('button', { name: 'Send Reset Link' }).click()
    ]);

    expect(response.ok()).toBeTruthy();
    await expect(page.getByText('Reset instructions sent to registered address')).toBeVisible();
  });
});`;

    const curlSnippet = `curl -X POST https://api.testnexa.ai/v1/suites/generate \\
  -H "Authorization: Bearer tn_live_sec_9841..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "spec_id": "REQ-142",
    "requirement": "Users can reset password via registered email...",
    "target_runners": ["playwright", "cypress", "gherkin"],
    "depth": "deterministic"
  }'`;

    const responseSnippet = `{
  "status": "success",
  "data": {
    "suite_id": "suite_842a_prod",
    "requirement_id": "REQ-142",
    "cases_generated": 24,
    "clause_coverage_pct": 100.0,
    "runners": ["playwright", "cypress", "gherkin"],
    "test_cases": [
      {
        "id": "TC-FUNC-001",
        "title": "Valid password reset submission",
        "type": "Functional",
        "assertions": 3,
        "status": "Approved"
      }
    ]
  }
}`;

    const handleCopy = () => {
        const text = tabMode === 'playwright' ? playwrightSnippet : tabMode === 'curl' ? curlSnippet : responseSnippet;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section
            id="integrations"
            className="vt-fullscreen-stage vt-pipeline-stage"
            aria-labelledby="pipeline-heading"
        >
            <div className="vt-container">
                {/* Stage Indicator & Guide */}
                <div className="vt-stage-connector-top">
                    <div className="vt-stage-marker-circle">
                        <span>06</span>
                    </div>
                    <div className="vt-stage-stem-line" aria-hidden="true" />
                </div>

                <div className="vt-eyebrow">
                    <span className="vt-eyebrow-node" />
                    <span>06 / PIPELINE &bull; CI/CD INTEGRATIONS</span>
                </div>

                {/* Editorial Heading */}
                <h2 id="pipeline-heading" className="vt-editorial-heading">
                    Quality belongs in your development workflow.
                </h2>

                <p className="vt-lead-text">
                    Automate test generation from your terminal, export to standard runner formats, and gate pull requests before defects reach production.
                </p>

                {/* Technical Metadata Row (Bare on Black) */}
                <div className="vt-pipeline-tech-metadata">
                    <span className="vt-meta-k">SUPPORTED RUNNERS &amp; GATES:</span>
                    <span className="vt-pipeline-tech-item">CLI v2.4.1</span>
                    <span className="vt-pipeline-sep">&bull;</span>
                    <span className="vt-pipeline-tech-item">REST API</span>
                    <span className="vt-pipeline-sep">&bull;</span>
                    <span className="vt-pipeline-tech-item">GitHub Actions</span>
                    <span className="vt-pipeline-sep">&bull;</span>
                    <span className="vt-pipeline-tech-item">GitLab CI</span>
                    <span className="vt-pipeline-sep">&bull;</span>
                    <span className="vt-pipeline-tech-item">Playwright</span>
                    <span className="vt-pipeline-sep">&bull;</span>
                    <span className="vt-pipeline-tech-item">Cypress</span>
                    <span className="vt-pipeline-sep">&bull;</span>
                    <span className="vt-pipeline-tech-item">Jira Webhooks</span>
                </div>

                {/* Editorial Split Composition: Zero Boxed Code Preview */}
                <div className="vt-pipeline-editorial-grid">
                    {/* Left: Supported Runners List (Bare on Black with fine divider lines) */}
                    <div className="vt-runners-stream">
                        <div className="vt-stream-header-strip">
                            <span className="vt-floating-label">[ EXPORT RUNNERS & PROTOCOLS ]</span>
                            <span className="vt-stream-suite-badge">Deterministic Syntax</span>
                        </div>

                        <div className="vt-runner-rows-list">
                            {RUNNERS.map((r) => (
                                <div key={r.key} className="vt-runner-editorial-row">
                                    <div className="vt-runner-info">
                                        <div className="vt-runner-header-line">
                                            <span className="vt-runner-title">{r.name}</span>
                                            <span className="vt-runner-pill">{r.badge}</span>
                                        </div>
                                        <p className="vt-runner-desc">{r.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="vt-stage-action-wrap">
                            <a
                                href={getTargetUrl('/app/cicd')}
                                className="vt-inline-link"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleWorkspaceEntry('/app/cicd');
                                }}
                            >
                                <span>Configure CI/CD webhooks &amp; pipeline gates in workspace</span>
                                <ArrowRight size={13} />
                            </a>
                        </div>
                    </div>

                    {/* Right: Short Genuine Configuration Snippets Sitting Naturally on Black (No Card / No Box) */}
                    <div className="vt-code-editorial-stream">
                        {/* Interactive Tab Switcher as Minimal Monospace Links */}
                        <div className="vt-code-editorial-header">
                            <div className="vt-code-tabs-nav">
                                <button
                                    type="button"
                                    className={`vt-code-tab-btn ${tabMode === 'playwright' ? 'is-active' : ''}`}
                                    onClick={() => setTabMode('playwright')}
                                >
                                    Playwright (.spec.ts)
                                </button>
                                <button
                                    type="button"
                                    className={`vt-code-tab-btn ${tabMode === 'curl' ? 'is-active' : ''}`}
                                    onClick={() => setTabMode('curl')}
                                >
                                    cURL (API v1)
                                </button>
                                <button
                                    type="button"
                                    className={`vt-code-tab-btn ${tabMode === 'response' ? 'is-active' : ''}`}
                                    onClick={() => setTabMode('response')}
                                >
                                    Response (JSON)
                                </button>
                            </div>

                            <button
                                type="button"
                                className="vt-copy-code-btn"
                                onClick={handleCopy}
                                aria-label="Copy snippet"
                            >
                                {copied ? <Check size={12} color="#8BAF9A" /> : <Copy size={12} />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                        </div>

                        {/* Thin Connector Line */}
                        <div className="vt-code-editorial-divider" aria-hidden="true" />

                        {/* Monospace Code Stream Sitting Directly on Black Canvas */}
                        <pre className="vt-code-editorial-pre">
                            <code>
                                {tabMode === 'playwright' && playwrightSnippet}
                                {tabMode === 'curl' && curlSnippet}
                                {tabMode === 'response' && responseSnippet}
                            </code>
                        </pre>

                        {/* Fine Technical Footnote */}
                        <div className="vt-code-editorial-footer">
                            <span className="vt-code-spec-meta">
                                {tabMode === 'playwright' && 'Strict locators & auto-waiting • Zero flaky timeouts'}
                                {tabMode === 'curl' && 'Bearer token authentication • 256-bit TLS encrypted'}
                                {tabMode === 'response' && 'Complete test metadata • Deterministic schema validated'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default IntegrationsChapter;
