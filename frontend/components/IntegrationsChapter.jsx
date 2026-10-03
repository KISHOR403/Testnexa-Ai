import React, { useState } from 'react';
import { Download, Terminal, Code, ArrowRight, Check, Copy, ExternalLink, GitPullRequest } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const FORMAT_SPECS = [
    {
        key: 'json',
        label: 'JSON Schema',
        meta: 'Playwright & Cypress AST',
        desc: 'Deterministic test models with atomic preconditions, action steps, and explicit assertion objects.'
    },
    {
        key: 'gherkin',
        label: 'Cucumber BDD',
        meta: '.feature spec syntax',
        desc: 'Executable Given-When-Then human-readable scenarios formatted for automated BDD execution.'
    },
    {
        key: 'junit',
        label: 'JUnit XML / CI',
        meta: 'GitHub Actions & GitLab',
        desc: 'Standardized test result and assertion schemas ready for immediate CI/CD quality gate enforcement.'
    },
    {
        key: 'jira',
        label: 'Jira & Zephyr Sync',
        meta: 'Bidirectional test case sync',
        desc: 'Direct issue sync mapping requirements, acceptance criteria, and generated tests to sprint tickets.'
    }
];

export const IntegrationsChapter = () => {
    const [tabMode, setTabMode] = useState('curl'); // 'curl' | 'response'
    const [copied, setCopied] = useState(false);
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

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
    "coverage_pct": 94.2,
    "test_cases": [
      {
        "id": "TC-001",
        "title": "Valid password reset submission",
        "type": "Functional",
        "assertions": 3,
        "status": "Ready"
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
            id="developers"
            className="tn-section tn-integrations-section"
            aria-labelledby="integrations-heading"
        >
            <div className="tn-container">
                {/* ─── Editorial Header (Open Canvas) ─── */}
                <div className="tn-int-header-group">
                    <div className="tn-chapter-eyebrow">
                        <span className="tn-kicker-dot" />
                        <span>DEVELOPER PIPELINE & RUNNERS</span>
                    </div>

                    <h2 id="integrations-heading" className="tn-int-title">
                        Connect QA directly to your CI/CD pipeline.
                    </h2>

                    <p className="tn-int-subtitle">
                        Trigger generation via REST API on pull requests or export structured test suites into Playwright, Cypress, Jira, and GitHub Actions.
                    </p>
                </div>

                {/* ─── Two-Column Split Workspace (Minimal Chrome) ─── */}
                <div className="tn-int-workspace-grid">
                    {/* Left: Format Ecosystem Specs */}
                    <div className="tn-int-formats-col">
                        <div className="tn-int-col-head">
                            <span className="tn-int-col-tag">NATIVE SCHEMAS & PROTOCOLS</span>
                        </div>

                        <div className="tn-format-rows-list">
                            {FORMAT_SPECS.map((fmt) => (
                                <div key={fmt.key} className="tn-format-item-row">
                                    <div className="tn-fitem-head">
                                        <span className="tn-fitem-name">{fmt.label}</span>
                                        <span className="tn-fitem-meta">{fmt.meta}</span>
                                    </div>
                                    <p className="tn-fitem-desc">{fmt.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="tn-int-docs-cta">
                            <a
                                href={getTargetUrl('/app/workspace')}
                                className="tn-inline-link"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleWorkspaceEntry('/app/workspace');
                                }}
                            >
                                <span>Read REST API documentation</span>
                                <ArrowRight size={13} />
                            </a>
                        </div>
                    </div>

                    {/* Right: Authentic Developer Terminal Window */}
                    <div className="tn-int-terminal-col">
                        <div className="tn-dev-terminal">
                            {/* Terminal Top Bar */}
                            <div className="tn-term-top-bar">
                                <div className="tn-term-dots" aria-hidden="true">
                                    <span className="tn-term-dot" />
                                    <span className="tn-term-dot" />
                                    <span className="tn-term-dot" />
                                </div>

                                <div className="tn-term-tabs" role="tablist">
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
                                >
                                    {copied ? <Check size={12} className="text-green" /> : <Copy size={12} />}
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
                                <span className="tn-term-meta-tag">ENDPOINTS:</span>
                                <span className="tn-term-meta-text">POST /v1/suites/generate &bull; Rate limit: 120 req/min &bull; Latency: ~820ms</span>
                            </div>
                        </div>

                        {/* Runner Ecosystem Logos / Chips */}
                        <div className="tn-runner-ecosystem-bar">
                            <span className="tn-reco-label">COMPATIBLE RUNNERS:</span>
                            <div className="tn-reco-chips">
                                <span className="tn-reco-chip">Playwright</span>
                                <span className="tn-reco-chip">Cypress</span>
                                <span className="tn-reco-chip">Jest / Vitest</span>
                                <span className="tn-reco-chip">GitHub Actions</span>
                                <span className="tn-reco-chip">Jira Software</span>
                                <span className="tn-reco-chip">TestRail</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default IntegrationsChapter;
