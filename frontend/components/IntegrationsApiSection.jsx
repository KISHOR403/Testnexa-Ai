import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Terminal, Code, ArrowRight, Check, Copy } from 'lucide-react';

export const IntegrationsApiSection = () => {
    const [copied, setCopied] = useState(false);

    const curlExample = `curl -X POST https://api.testnexa.ai/api/v1/generate \\
  -H "Authorization: Bearer tn_live_sec_9841..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "requirement": "Users can reset password using registered email...",
    "context": "web",
    "depth": "Standard"
  }'`;

    const handleCopy = () => {
        navigator.clipboard.writeText(curlExample);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section id="api" className="tn-section tn-integrations-api-section" aria-labelledby="api-heading">
            <div className="tn-container">
                <div className="tn-section-header">
                    <span className="tn-kicker">Integrations & Developer API</span>
                    <h2 id="api-heading" className="tn-section-title">
                        Export to your workflow. Automate with API.
                    </h2>
                    <p className="tn-section-subtitle">
                        TestNexa integrates directly with your existing tooling through structured multi-format exports and a production REST API.
                    </p>
                </div>

                <div className="tn-api-integration-grid">
                    {/* Left: Native Supported Exports & Formats */}
                    <div className="tn-int-card">
                        <div className="tn-int-card__header">
                            <div className="tn-int-icon-wrap"><Download size={18} /></div>
                            <div>
                                <h3>Supported Export Formats</h3>
                                <p>Generate ready-to-import test suites for your test management tools.</p>
                            </div>
                        </div>

                        <div className="tn-format-list">
                            <div className="tn-format-item">
                                <span className="tn-format-badge">JSON</span>
                                <div>
                                    <strong>Structured QA Payload</strong>
                                    <p>Full suite schema with test IDs, categories, preconditions, atomic steps, and expected outcomes for Playwright and Cypress runners.</p>
                                </div>
                            </div>

                            <div className="tn-format-item">
                                <span className="tn-format-badge">CSV</span>
                                <div>
                                    <strong>Spreadsheet & TestRail Import</strong>
                                    <p>Standardized column layout compatible with TestRail, Zephyr, Xray, and Google Sheets.</p>
                                </div>
                            </div>

                            <div className="tn-format-item">
                                <span className="tn-format-badge">Gherkin</span>
                                <div>
                                    <strong>BDD Feature Specifications</strong>
                                    <p>Cucumber and Behave compliant Feature / Scenario syntax ready for test automation repositories.</p>
                                </div>
                            </div>

                            <div className="tn-format-item">
                                <span className="tn-format-badge">Markdown</span>
                                <div>
                                    <strong>Documentation & Tickets</strong>
                                    <p>Clean GitHub Flavored Markdown formatted for Jira tickets, Linear issues, and PR descriptions.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: REST API Automation */}
                    <div className="tn-int-card tn-int-card--code">
                        <div className="tn-int-card__header">
                            <div className="tn-int-icon-wrap"><Terminal size={18} /></div>
                            <div>
                                <h3>Developer REST API</h3>
                                <p>Trigger requirement analysis and test generation programmatically from your CI/CD pipelines.</p>
                            </div>
                        </div>

                        <div className="tn-code-window">
                            <div className="tn-code-window__bar">
                                <span className="tn-code-endpoint">POST /api/v1/generate</span>
                                <button
                                    type="button"
                                    className="tn-copy-code-btn"
                                    onClick={handleCopy}
                                    title="Copy curl command"
                                >
                                    {copied ? <Check size={12} /> : <Copy size={12} />}
                                    <span>{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>
                            <pre className="tn-code-block">
                                <code>{curlExample}</code>
                            </pre>
                        </div>

                        <div className="tn-code-footer">
                            <Link to="/api-reference" className="tn-api-link-action">
                                <span>Read complete API reference & documentation &rarr;</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default IntegrationsApiSection;
