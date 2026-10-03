import React, { useState } from 'react';
import RevealSection from './RevealSection';
import { Download, Terminal, Code, ArrowRight, Check, Copy, ExternalLink, GitPullRequest } from 'lucide-react';

const EXPORT_FORMATS = [
    {
        id: 'json',
        badge: 'JSON',
        name: 'Structured Test Schema',
        desc: 'Complete suite schema with preconditions, atomic execution steps, and assertions ready for Playwright and Cypress runners.'
    },
    {
        id: 'gherkin',
        badge: 'FEATURE',
        name: 'Cucumber BDD Feature Specs',
        desc: 'Given-When-Then human-readable scenarios formatted for automated BDD execution engines and product team review.'
    },
    {
        id: 'csv',
        badge: 'CSV',
        name: 'TestRail & Zephyr Importer',
        desc: 'Column-mapped spreadsheets matching industry standard test case management schemas for 1-click import.'
    },
    {
        id: 'markdown',
        badge: 'MD',
        name: 'Pull Request & Spec Summaries',
        desc: 'Formatted tables designed to paste directly into GitHub PRs, Jira descriptions, and engineering sprint notes.'
    }
];

export const IntegrationsChapter = () => {
    const [copied, setCopied] = useState(false);
    const [showResponse, setShowResponse] = useState(false);

    const curlSnippet = `curl -X POST https://api.testnexa.ai/api/v1/generate \\
  -H "Authorization: Bearer tn_live_sec_9841..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "requirement": "Users can reset password using registered email...",
    "context": "web",
    "depth": "Standard"
  }'`;

    const jsonResponsePreview = `{
  "status": "success",
  "data": {
    "test_suite_id": "suite_842a_prod",
    "cases_generated": 18,
    "coverage_percentage": 92.4,
    "test_cases": [
      {
        "id": "TC-001",
        "title": "Submit registered email address...",
        "priority": "High",
        "category": "Functional",
        "steps_count": 3
      }
    ]
  }
}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(curlSnippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section id="developers" className="tn-section tn-integrations-chapter" aria-labelledby="chapter4-heading">
            <div className="tn-container">
                {/* ─── Chapter Header ─── */}
                <RevealSection className="tn-section-header">
                    <div className="tn-story-chapter-eyebrow">
                        <span className="tn-chapter-pill">CHAPTER 04</span>
                        <span className="tn-chapter-sub">Developer Pipeline</span>
                    </div>
                    <h2 id="chapter4-heading" className="tn-section-title">
                        Connect QA to your engineering workflow.
                    </h2>
                    <p className="tn-section-subtitle">
                        Export structured suites to your test management tools or automate generation directly within CI/CD pipelines.
                    </p>
                </RevealSection>

                {/* ─── ONE Clean Integration Visualization ─── */}
                <div className="tn-integrations-workspace" data-parallax-offset="12">
                    
                    {/* Left: Native Supported Exports & Test Management Sync */}
                    <div className="tn-int-pane-left">
                        <div className="tn-int-pane-title">
                            <Download size={14} className="text-accent" />
                            <span>Export Ecosystem & Format Schema</span>
                        </div>
                        <p className="tn-int-pane-desc">
                            TestNexa generates neutral, structured test suites that plug into any testing framework or QA management platform.
                        </p>

                        <div className="tn-format-list-integrated">
                            {EXPORT_FORMATS.map((fmt) => (
                                <div key={fmt.id} className="tn-format-entry">
                                    <span className="tn-fmt-badge">{fmt.badge}</span>
                                    <div className="tn-fmt-text">
                                        <strong>{fmt.name}</strong>
                                        <p>{fmt.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Integration Badges */}
                        <div className="tn-ecosystem-pills">
                            <span className="tn-eco-pill">GitHub Actions</span>
                            <span className="tn-eco-pill">GitLab CI</span>
                            <span className="tn-eco-pill">Jira Software</span>
                            <span className="tn-eco-pill">TestRail</span>
                            <span className="tn-eco-pill">Playwright</span>
                            <span className="tn-eco-pill">Cucumber</span>
                        </div>
                    </div>

                    {/* Right: Developer REST API Terminal */}
                    <div className="tn-int-pane-right">
                        <div className="tn-terminal-header">
                            <div className="tn-term-dots">
                                <span className="tn-term-dot" />
                                <span className="tn-term-dot" />
                                <span className="tn-term-dot" />
                            </div>
                            <span className="tn-term-title">bash &mdash; curl api.testnexa.ai/v1/generate</span>
                            
                            <div className="tn-term-actions">
                                <button
                                    type="button"
                                    onClick={() => setShowResponse(!showResponse)}
                                    className="tn-term-toggle-btn"
                                >
                                    {showResponse ? 'View Request' : 'View Response'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="tn-term-copy-btn"
                                    aria-label="Copy cURL snippet"
                                >
                                    {copied ? <Check size={13} className="text-green" /> : <Copy size={13} />}
                                    <span>{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="tn-terminal-body">
                            {showResponse ? (
                                <pre className="tn-term-code">
                                    <code>{jsonResponsePreview}</code>
                                </pre>
                            ) : (
                                <pre className="tn-term-code">
                                    <code>{curlSnippet}</code>
                                </pre>
                            )}
                        </div>

                        <div className="tn-term-footer">
                            <div className="tn-term-foot-left">
                                <span className="tn-dot-live" />
                                <span>Status: 200 OK &bull; 340ms latency</span>
                            </div>
                            <span className="tn-term-foot-right">REST API v1.4</span>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};

export default IntegrationsChapter;
