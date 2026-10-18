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
    const [tabMode, setTabMode] = useState('curl'); // 'curl' | 'response'
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
        navigator.clipboard.writeText(tabMode === 'curl' ? curlSnippet : responseSnippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section
            id="integrations"
            className="tn-section tn-integrations-section"
            aria-labelledby="integrations-heading"
        >
            <div className="tn-container">
                {/* ─── Editorial Header ─── */}
                <div className="tn-int-header-group">
                    <div className="tn-chapter-eyebrow">
                        <span className="tn-kicker-dot" />
                        <span>DEVELOPER RUNNERS & CI/CD</span>
                    </div>

                    <h2 id="integrations-heading" className="tn-int-title">
                        Connect QA directly to your CI/CD pipeline.
                    </h2>

                    <p className="tn-int-subtitle">
                        Trigger test generation via REST API on pull requests or export structured test suites into Playwright, Cypress, Cucumber BDD, and GitHub Actions.
                    </p>
                </div>

                {/* ─── Two-Column Split Workspace ─── */}
                <div className="tn-int-workspace-grid">
                    {/* Left: Real Export Capabilities with clear availability labels */}
                    <div className="tn-int-formats-col">
                        <div className="tn-int-col-head">
                            <span className="tn-int-col-tag">NATIVE EXPORTS & RUNNER TARGETS</span>
                        </div>

                        <div className="tn-format-rows-list">
                            {EXPORT_CAPABILITIES.map((fmt) => (
                                <div key={fmt.key} className="tn-format-item-row">
                                    <div className="tn-fitem-head">
                                        <span className="tn-fitem-name">{fmt.label}</span>
                                        <span className={`tn-fitem-status-pill ${fmt.statusClass}`}>
                                            {fmt.category}
                                        </span>
                                    </div>
                                    <p className="tn-fitem-desc">{fmt.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="tn-int-docs-cta">
                            <a
                                href="/api-reference"
                                className="tn-inline-link"
                            >
                                <span>Read REST API documentation</span>
                                <ArrowRight size={13} />
                            </a>
                        </div>
                    </div>

                    {/* Right: Authentic Developer Terminal Window */}
                    <div className="tn-int-terminal-col">
                        <div
                            className="tn-dev-terminal tn-spotlight-card"
                            onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                                e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                            }}
                        >
                            {/* Terminal Top Bar */}
                            <div className="tn-term-top-bar">
                                <div className="tn-term-dots" aria-hidden="true">
                                    <span className="tn-term-dot" />
                                    <span className="tn-term-dot" />
                                    <span className="tn-term-dot" />
                                </div>

                                <div className="tn-term-tabs" role="tablist" aria-label="Terminal API Tabs">
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={tabMode === 'curl'}
                                        className={`tn-term-tab ${tabMode === 'curl' ? 'is-active' : ''}`}
                                        onClick={() => setTabMode('curl')}
                                    >
                                        <Terminal size={12} />
                                        <span>cURL Request</span>
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={tabMode === 'response'}
                                        className={`tn-term-tab ${tabMode === 'response' ? 'is-active' : ''}`}
                                        onClick={() => setTabMode('response')}
                                    >
                                        <Code size={12} />
                                        <span>200 OK Response</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="tn-term-copy-btn"
                                    onClick={handleCopy}
                                    title="Copy code snippet"
                                    aria-label="Copy code snippet"
                                >
                                    {copied ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
                                    <span>{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>

                            {/* Code Area */}
                            <div className="tn-term-body">
                                <pre className="tn-term-code">
                                    <code>{tabMode === 'curl' ? curlSnippet : responseSnippet}</code>
                                </pre>
                            </div>

                            {/* Terminal Footer Info */}
                            <div className="tn-term-footer">
                                <span className="tn-term-meta-tag">SPECIFICATION:</span>
                                <span className="tn-term-meta-text">POST /v1/suites/generate &bull; Rate limit: 120 req/min &bull; Latency: ~820ms</span>
                            </div>
                        </div>

                        {/* Runner Ecosystem Chips */}
                        <div className="tn-runner-ecosystem-bar">
                            <span className="tn-reco-label">COMPATIBLE RUNNERS:</span>
                            <div className="tn-reco-chips">
                                <span className="tn-reco-chip">Playwright</span>
                                <span className="tn-reco-chip">Cypress</span>
                                <span className="tn-reco-chip">Cucumber</span>
                                <span className="tn-reco-chip">JUnit XML</span>
                                <span className="tn-reco-chip">GitHub Actions</span>
                                <span className="tn-reco-chip">Jira Software</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default IntegrationsChapter;
