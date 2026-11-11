import React, { useState } from 'react';
import { Download, Terminal, Code, ArrowRight, Check, Copy, ExternalLink, GitPullRequest, Layers, Sparkles } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const EXPORT_CAPABILITIES = [
    {
        key: 'playwright',
        label: 'Playwright (.spec.ts)',
        category: 'AVAILABLE NOW',
        statusClass: 'is-available',
        meta: 'TypeScript test suite',
        desc: 'Atomic assertions, page object models, strict locators, and deterministic wait assertions ready to run with npx playwright test.'
    },
    {
        key: 'cypress',
        label: 'Cypress (.cy.js)',
        category: 'AVAILABLE NOW',
        statusClass: 'is-available',
        meta: 'End-to-end spec',
        desc: 'Browser-driven test scenarios formatted with cy.intercept(), custom commands, and chained assertion steps.'
    },
    {
        key: 'gherkin',
        label: 'Cucumber BDD (.feature)',
        category: 'AVAILABLE NOW',
        statusClass: 'is-available',
        meta: 'Given-When-Then syntax',
        desc: 'Executable human-readable feature files compatible with Cucumber.js, Behave, and SpecFlow automation frameworks.'
    },
    {
        key: 'junit',
        label: 'JUnit XML / CI Schema',
        category: 'AVAILABLE NOW',
        statusClass: 'is-available',
        meta: 'CI/CD quality gates',
        desc: 'Standardized test reporting schemas ready for immediate test result parsing and PR build-blocking in GitHub Actions and GitLab.'
    },
    {
        key: 'jira',
        label: 'Jira Software & Zephyr',
        category: 'EXPORT / WEBHOOK SYNC',
        statusClass: 'is-sync',
        meta: 'Issue & test case sync',
        desc: 'Export structured test scenarios directly into Jira tickets and Zephyr Squad/Scale test cycles via REST webhook payloads.'
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
    "clause_coverage_pct": 87.5,
    "runners": ["playwright", "cypress", "gherkin"],
    "test_cases": [
      {
        "id": "TC-001",
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
            className="de-section"
            aria-labelledby="integrations-heading"
        >
            <div className="de-container">
                {/* ─── Editorial Header ─── */}
                <div style={{ maxWidth: 740 }}>
                    <div className="de-eyebrow">
                        <span className="de-eyebrow-dot" />
                        <span>05 / CI/CD &amp; RUNNER INTEGRATIONS</span>
                    </div>

                    <h2 id="integrations-heading" className="de-editorial-title">
                        Engineered for your pipeline.
                    </h2>

                    <p className="de-lead">
                        Native test runners, deterministic assertions, and CI/CD quality gates. Export typed Playwright specs, Cypress suites, Cucumber feature files, or trigger generation directly via our developer REST API.
                    </p>
                </div>

                {/* ─── Asymmetric Developer Split ─── */}
                <div className="de-cicd-split">
                    {/* Left: Native Supported Runners */}
                    <div>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8BAF9A', fontWeight: 600 }}>
                            Native Runners &amp; Formats
                        </span>

                        <div className="de-runner-list">
                            {EXPORT_CAPABILITIES.map((fmt) => (
                                <div key={fmt.key} className="de-runner-item">
                                    <div>
                                        <div className="de-runner-name">{fmt.label}</div>
                                        <div style={{ fontSize: '0.78rem', color: '#969B98', marginTop: 2 }}>{fmt.meta}</div>
                                    </div>
                                    <span className="de-runner-tag">{fmt.category}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                            <a
                                href={getTargetUrl('/app/workspace')}
                                className="tn-inline-link"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleWorkspaceEntry('/app/workspace');
                                }}
                            >
                                <span>Open Workspace &amp; Export Suite</span>
                                <ArrowRight size={13} />
                            </a>
                            <span style={{ color: 'rgba(255,255,255,0.2)' }}>&bull;</span>
                            <a href="/api-reference" className="tn-inline-link" style={{ color: '#969B98' }}>
                                <span>API Documentation</span>
                            </a>
                        </div>
                    </div>

                    {/* Right: Authentic Developer Terminal Window (Unboxed, hairline-defined) */}
                    <div className="de-term-window">
                        <div className="de-term-nav">
                            <div className="de-term-tabs" role="tablist" aria-label="Terminal Tabs">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={tabMode === 'playwright'}
                                    className={`de-term-tab ${tabMode === 'playwright' ? 'is-active' : ''}`}
                                    onClick={() => setTabMode('playwright')}
                                >
                                    Playwright (.spec.ts)
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={tabMode === 'curl'}
                                    className={`de-term-tab ${tabMode === 'curl' ? 'is-active' : ''}`}
                                    onClick={() => setTabMode('curl')}
                                >
                                    cURL API
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={tabMode === 'response'}
                                    className={`de-term-tab ${tabMode === 'response' ? 'is-active' : ''}`}
                                    onClick={() => setTabMode('response')}
                                >
                                    200 OK JSON
                                </button>
                            </div>

                            <button
                                type="button"
                                className="de-term-copy"
                                onClick={handleCopy}
                                title="Copy code"
                            >
                                {copied ? <Check size={12} style={{ color: '#8BAF9A' }} /> : <Copy size={12} />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                        </div>

                        <pre className="de-term-codeblock">
                            <code>{tabMode === 'curl' ? curlSnippet : tabMode === 'playwright' ? playwrightSnippet : responseSnippet}</code>
                        </pre>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#080909', fontFamily: 'monospace', fontSize: '0.7rem', color: '#68706B' }}>
                            <span>Target: Headless Chromium / CI Worker</span>
                            <span style={{ color: '#8BAF9A' }}>Atomic assertions &bull; Deterministic wait</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default IntegrationsChapter;
