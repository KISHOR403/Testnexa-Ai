import React, { useState } from 'react';
import { ArrowRight, Copy, Check } from 'lucide-react';
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
    const [tabMode, setTabMode] = useState('curl'); // 'curl' | 'playwright' | 'response'
    const [copied, setCopied] = useState(false);
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const curlSnippet = `curl -X POST https://api.testnexa.ai/v1/suites/generate \\
  -H "Authorization: Bearer tn_live_sec_9841..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "spec_id": "REQ-142",
    "requirement": "Users can reset password via registered email...",
    "target_runners": ["playwright", "cypress", "gherkin"],
    "depth": "deterministic"
  }'`;

    const playwrightSnippet = `import { test, expect } from '@playwright/test';

test.describe('Password Recovery Suite (REQ-142)', () => {
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
        const text = tabMode === 'curl' ? curlSnippet : tabMode === 'playwright' ? playwrightSnippet : responseSnippet;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section
            id="integrations"
            className="vt-pipeline-section"
            aria-labelledby="pipeline-heading"
        >
            <div className="vt-container">
                <div style={{ maxWidth: 800 }}>
                    <div className="vt-eyebrow">
                        <span className="vt-eyebrow-node" />
                        <span>DEVELOPER PIPELINE & RUNNERS</span>
                    </div>

                    <h2 id="pipeline-heading" className="vt-editorial-heading">
                        Quality belongs in your development workflow.
                    </h2>

                    <p className="vt-lead-text">
                        Automate test generation from your terminal, export to standard runner formats, and gate pull requests before defects reach production.
                    </p>
                </div>

                {/* Asymmetric Split Layout */}
                <div className="vt-pipeline-grid">
                    {/* Left: Runners and Integrations */}
                    <div className="vt-runner-list">
                        {RUNNERS.map((r) => (
                            <div key={r.key} className="vt-runner-row">
                                <div style={{ paddingRight: 16 }}>
                                    <span className="vt-runner-title">{r.name}</span>
                                    <p className="vt-runner-desc">{r.desc}</p>
                                </div>
                                <span className="vt-runner-pill">{r.badge}</span>
                            </div>
                        ))}

                        <div style={{ marginTop: '2.5rem' }}>
                            <a
                                href={getTargetUrl('/app/cicd')}
                                className="vt-inline-link"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleWorkspaceEntry('/app/cicd');
                                }}
                            >
                                <span>Configure CI/CD webhooks &amp; pipeline gates</span>
                                <ArrowRight size={13} />
                            </a>
                        </div>
                    </div>

                    {/* Right: Monospace Code Console */}
                    <div className="vt-code-console">
                        <div className="vt-code-header">
                            <div className="vt-code-tabs">
                                <button
                                    type="button"
                                    className={`vt-code-tab ${tabMode === 'curl' ? 'is-active' : ''}`}
                                    onClick={() => setTabMode('curl')}
                                >
                                    cURL API
                                </button>
                                <button
                                    type="button"
                                    className={`vt-code-tab ${tabMode === 'playwright' ? 'is-active' : ''}`}
                                    onClick={() => setTabMode('playwright')}
                                >
                                    Playwright (.spec.ts)
                                </button>
                                <button
                                    type="button"
                                    className={`vt-code-tab ${tabMode === 'response' ? 'is-active' : ''}`}
                                    onClick={() => setTabMode('response')}
                                >
                                    JSON Response
                                </button>
                            </div>

                            <button
                                type="button"
                                className="vt-copy-action"
                                onClick={handleCopy}
                                aria-label="Copy code snippet"
                            >
                                {copied ? <Check size={12} color="#8BAF9A" /> : <Copy size={12} />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                        </div>

                        <pre className="vt-code-stream">
                            {tabMode === 'curl' && curlSnippet}
                            {tabMode === 'playwright' && playwrightSnippet}
                            {tabMode === 'response' && responseSnippet}
                        </pre>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default IntegrationsChapter;
