import React, { useState } from 'react';
import {
    FileText,
    Brain,
    Layers,
    CheckSquare,
    ShieldAlert,
    GitBranch,
    Download,
    Check,
    ArrowRight,
    Search,
    Shield,
    Terminal,
    Code,
    Cpu,
    Zap
} from 'lucide-react';

const WORKFLOW_STEPS = [
    {
        id: 'req',
        stepNum: '01',
        name: 'Add Requirement',
        tagline: 'Raw spec ingestion',
        description: 'Input plain text, Jira tickets, PRDs, or user stories with target platform and coverage depth.'
    },
    {
        id: 'analyze',
        stepNum: '02',
        name: 'Analyze',
        tagline: 'Requirement intelligence',
        description: 'Deconstruct intent, isolate actors, detect ambiguity, and flag unstated assumptions before generation.'
    },
    {
        id: 'generate',
        stepNum: '03',
        name: 'Generate',
        tagline: 'Structured test suite',
        description: 'Synthesize functional, negative, edge-case, validation, and security test cases with execution steps.'
    },
    {
        id: 'review',
        stepNum: '04',
        name: 'Review',
        tagline: 'Test case validation',
        description: 'Inspect preconditions, step-by-step actions, expected results, test data, and BDD Gherkin specs.'
    },
    {
        id: 'coverage',
        stepNum: '05',
        name: 'Validate Coverage',
        tagline: 'Specification matrix',
        description: 'Audit requirement clause coverage across functional, negative, and edge-case testing dimensions.'
    },
    {
        id: 'risks',
        stepNum: '06',
        name: 'Trace Risks',
        tagline: 'Vulnerability mapping',
        description: 'Identify critical security gaps such as token expiration TTL, replay vulnerabilities, and abuse vectors.'
    },
    {
        id: 'export',
        stepNum: '07',
        name: 'Export / Execute',
        tagline: 'Handoff & automation',
        description: 'Export structured test cases to JSON, CSV, Jira, Linear, or trigger execution via REST API.'
    }
];

export const ProductWorkflow = () => {
    const [activeStepIndex, setActiveStepIndex] = useState(1); // Default to Step 02 (Analyze)
    const activeStep = WORKFLOW_STEPS[activeStepIndex];

    return (
        <section id="workflow" className="tn-section tn-workflow-section" aria-labelledby="workflow-heading">
            <div className="tn-container">
                <div className="tn-section-header">
                    <span className="tn-kicker">QA Workflow</span>
                    <h2 id="workflow-heading" className="tn-section-title">
                        From requirement to test coverage.
                    </h2>
                    <p className="tn-section-subtitle">
                        A complete QA workflow to analyze requirements, generate test cases, and validate coverage.
                    </p>
                </div>

                {/* ─── Horizontal 7-Step Navigation (Stacked Vertically on Mobile) ─── */}
                <div className="tn-workflow-timeline" role="tablist" aria-label="QA Workflow Steps">
                    {WORKFLOW_STEPS.map((step, idx) => {
                        const isActive = idx === activeStepIndex;
                        const isPast = idx < activeStepIndex;
                        return (
                            <button
                                key={step.id}
                                role="tab"
                                aria-selected={isActive}
                                aria-controls={`workflow-panel-${step.id}`}
                                className={`tn-workflow-step-btn ${isActive ? 'is-active' : ''} ${isPast ? 'is-past' : ''}`}
                                onClick={() => setActiveStepIndex(idx)}
                            >
                                <div className="tn-workflow-step-btn__indicator">
                                    <span className="tn-workflow-step-btn__num">{step.stepNum}</span>
                                    {isPast && <span className="tn-workflow-step-btn__check"><Check size={11} strokeWidth={3} /></span>}
                                </div>
                                <div className="tn-workflow-step-btn__text">
                                    <span className="tn-workflow-step-btn__title">{step.name}</span>
                                    <span className="tn-workflow-step-btn__tagline">{step.tagline}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* ─── Live Synchronized Product Window for Selected Step ─── */}
                <div
                    id={`workflow-panel-${activeStep.id}`}
                    role="tabpanel"
                    className="tn-workflow-stage-display"
                >
                    <div className="tn-workflow-stage-meta">
                        <div className="tn-workflow-stage-meta__left">
                            <span className="tn-workflow-badge">Step {activeStep.stepNum} of 07</span>
                            <h3 className="tn-workflow-stage-title">{activeStep.name}</h3>
                            <p className="tn-workflow-stage-desc">{activeStep.description}</p>
                        </div>
                        <div className="tn-workflow-stage-meta__right">
                            <span className="tn-workflow-req-id">REQ-142</span>
                            <span className="tn-workflow-spec-title">Password Reset Specification</span>
                        </div>
                    </div>

                    <div className="tn-workflow-screen">
                        {/* 01 Add Requirement */}
                        {activeStepIndex === 0 && (
                            <div className="tn-stage-view tn-stage-view--input">
                                <div className="tn-stage-card-header">
                                    <span>Specification Input Buffer</span>
                                    <span className="tn-pill-neutral">Target: Web &bull; Depth: Standard</span>
                                </div>
                                <div className="tn-stage-input-mock">
                                    <label>Requirement Description</label>
                                    <p className="tn-stage-quote">
                                        "Users can reset their password using their registered email address. The system sends a single-use token valid for 15 minutes. Link expires after single use and rate limits multiple requests."
                                    </p>
                                </div>
                                <div className="tn-stage-grid-3">
                                    <div className="tn-stage-chip"><span>Input Type:</span> <strong>Plain Text / Jira</strong></div>
                                    <div className="tn-stage-chip"><span>Platform Target:</span> <strong>Web Application</strong></div>
                                    <div className="tn-stage-chip"><span>Analysis Depth:</span> <strong>Standard (Recommended)</strong></div>
                                </div>
                            </div>
                        )}

                        {/* 02 Analyze */}
                        {activeStepIndex === 1 && (
                            <div className="tn-stage-view tn-stage-view--analyze">
                                <div className="tn-stage-card-header">
                                    <span>Requirement Intelligence Extraction</span>
                                    <span className="tn-pill-success">Analysis Complete &bull; 0 Critical Ambiguities</span>
                                </div>
                                <div className="tn-stage-analysis-grid">
                                    <div className="tn-analysis-card">
                                        <div className="tn-analysis-card__header">
                                            <Check size={14} className="text-accent" />
                                            <strong>Functional Scope</strong>
                                        </div>
                                        <p>Primary actor identity recovery, email delivery dispatch, single-use token generation.</p>
                                    </div>
                                    <div className="tn-analysis-card">
                                        <div className="tn-analysis-card__header">
                                            <Check size={14} className="text-accent" />
                                            <strong>Negative Scenarios</strong>
                                        </div>
                                        <p>Unregistered emails, malformed RFC-5322 payloads, expired tokens, duplicate submissions.</p>
                                    </div>
                                    <div className="tn-analysis-card">
                                        <div className="tn-analysis-card__header">
                                            <Check size={14} className="text-accent" />
                                            <strong>Security Boundaries</strong>
                                        </div>
                                        <p>Account enumeration timing mitigation, cryptographic nonce disposal, rate limiting (5 req/min).</p>
                                    </div>
                                    <div className="tn-analysis-card">
                                        <div className="tn-analysis-card__header">
                                            <Check size={14} className="text-accent" />
                                            <strong>Edge Conditions</strong>
                                        </div>
                                        <p>Network timeouts during mail queueing, concurrent token redemption race conditions.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 03 Generate */}
                        {activeStepIndex === 2 && (
                            <div className="tn-stage-view tn-stage-view--generate">
                                <div className="tn-stage-card-header">
                                    <span>Synthesizing Test Suite</span>
                                    <span className="tn-pill-accent">24 Tests Assembled &bull; 92% Coverage</span>
                                </div>
                                <div className="tn-stage-metrics-row">
                                    <div className="tn-stage-metric">
                                        <span className="tn-metric-num">24</span>
                                        <span className="tn-metric-lbl">Total Cases</span>
                                    </div>
                                    <div className="tn-stage-metric">
                                        <span className="tn-metric-num text-accent">92%</span>
                                        <span className="tn-metric-lbl">Req Coverage</span>
                                    </div>
                                    <div className="tn-stage-metric">
                                        <span className="tn-metric-num text-amber">3</span>
                                        <span className="tn-metric-lbl">High Risks</span>
                                    </div>
                                    <div className="tn-stage-metric">
                                        <span className="tn-metric-num">6</span>
                                        <span className="tn-metric-lbl">Edge Cases</span>
                                    </div>
                                </div>
                                <div className="tn-stage-feed-list">
                                    <div className="tn-stage-feed-item">
                                        <span className="tn-tag-tc">TC-001</span>
                                        <span>Valid password reset dispatch with standard email</span>
                                        <span className="tn-badge-func">Functional</span>
                                    </div>
                                    <div className="tn-stage-feed-item">
                                        <span className="tn-tag-tc">TC-002</span>
                                        <span>Malformed email syntax rejection at client and API gateway</span>
                                        <span className="tn-badge-neg">Negative</span>
                                    </div>
                                    <div className="tn-stage-feed-item">
                                        <span className="tn-tag-tc">TC-003</span>
                                        <span>Expired token handling beyond 15-minute TTL window</span>
                                        <span className="tn-badge-edge">Edge Case</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 04 Review */}
                        {activeStepIndex === 3 && (
                            <div className="tn-stage-view tn-stage-view--review">
                                <div className="tn-stage-card-header">
                                    <span>Master-Detail Test Review &bull; TC-003</span>
                                    <span className="tn-pill-neutral">Status: Needs Review &bull; Priority: High</span>
                                </div>
                                <div className="tn-stage-review-split">
                                    <div className="tn-stage-review-left">
                                        <div className="tn-review-field">
                                            <label>Preconditions</label>
                                            <p>A password reset token was created &gt;15 minutes ago and has not been redeemed.</p>
                                        </div>
                                        <div className="tn-review-field">
                                            <label>Execution Steps</label>
                                            <ol className="tn-step-list-ordered">
                                                <li>Open password reset URL with expired token parameter.</li>
                                                <li>Input valid new password meeting complexity criteria and submit.</li>
                                            </ol>
                                        </div>
                                    </div>
                                    <div className="tn-stage-review-right">
                                        <div className="tn-review-field">
                                            <label>Expected Result</label>
                                            <p className="tn-expected-highlight">
                                                System rejects expired token with HTTP 400 (TOKEN_EXPIRED), preserves previous credentials, and renders link to request fresh token.
                                            </p>
                                        </div>
                                        <div className="tn-review-field">
                                            <label>Traceability</label>
                                            <span className="tn-trace-pill">REQ-142 &rarr; Password Reset</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 05 Validate Coverage */}
                        {activeStepIndex === 4 && (
                            <div className="tn-stage-view tn-stage-view--coverage">
                                <div className="tn-stage-card-header">
                                    <span>Requirement Coverage Audit</span>
                                    <span className="tn-pill-success">92% Overall Specification Coverage</span>
                                </div>
                                <div className="tn-coverage-bars-list">
                                    <div className="tn-cov-item">
                                        <div className="tn-cov-item__meta">
                                            <span>Functional Delivery (User Story Primary Flow)</span>
                                            <strong>96%</strong>
                                        </div>
                                        <div className="tn-cov-track"><div className="tn-cov-fill" style={{ width: '96%' }} /></div>
                                    </div>
                                    <div className="tn-cov-item">
                                        <div className="tn-cov-item__meta">
                                            <span>Negative Validation & Bad Input Schema</span>
                                            <strong>90%</strong>
                                        </div>
                                        <div className="tn-cov-track"><div className="tn-cov-fill" style={{ width: '90%' }} /></div>
                                    </div>
                                    <div className="tn-cov-item">
                                        <div className="tn-cov-item__meta">
                                            <span>Security & Token Lifecycle Boundaries</span>
                                            <strong>88%</strong>
                                        </div>
                                        <div className="tn-cov-track"><div className="tn-cov-fill" style={{ width: '88%' }} /></div>
                                    </div>
                                </div>
                                <div className="tn-gap-callout">
                                    <ShieldAlert size={14} className="text-amber" />
                                    <span>Coverage note: 1 boundary assertion recommended for multi-IP concurrent rate limiting.</span>
                                </div>
                            </div>
                        )}

                        {/* 06 Trace Risks */}
                        {activeStepIndex === 5 && (
                            <div className="tn-stage-view tn-stage-view--risks">
                                <div className="tn-stage-card-header">
                                    <span>Risk Matrix & Attack Vector Audit</span>
                                    <span className="tn-pill-amber">3 High Risks Flagged For Release</span>
                                </div>
                                <div className="tn-stage-risks-grid">
                                    <div className="tn-risk-item tn-risk-item--high">
                                        <div className="tn-risk-item__top">
                                            <span className="tn-risk-level-high">HIGH</span>
                                            <span className="tn-risk-id">TC-003</span>
                                        </div>
                                        <strong>Expired Token TTL Handling</strong>
                                        <p>Tokens not invalidated post-TTL allow indefinite credential takeover if email link is compromised.</p>
                                    </div>
                                    <div className="tn-risk-item tn-risk-item--high">
                                        <div className="tn-risk-item__top">
                                            <span className="tn-risk-level-high">HIGH</span>
                                            <span className="tn-risk-id">TC-004</span>
                                        </div>
                                        <strong>Token Replay / Nonce Reuse</strong>
                                        <p>Redeemed tokens not burned in atomic database transaction allow session replay exploits.</p>
                                    </div>
                                    <div className="tn-risk-item tn-risk-item--med">
                                        <div className="tn-risk-item__top">
                                            <span className="tn-risk-level-med">MEDIUM</span>
                                            <span className="tn-risk-id">TC-002</span>
                                        </div>
                                        <strong>Email Enumeration Timing Attack</strong>
                                        <p>Different response latencies for registered vs unregistered accounts leak user directory.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 07 Export / Execute */}
                        {activeStepIndex === 6 && (
                            <div className="tn-stage-view tn-stage-view--export">
                                <div className="tn-stage-card-header">
                                    <span>Handoff, Export & CI/CD Integration</span>
                                    <span className="tn-pill-success">Ready for Execution</span>
                                </div>
                                <div className="tn-export-destinations">
                                    <div className="tn-export-card">
                                        <div className="tn-export-card__icon"><Download size={16} /></div>
                                        <strong>JSON / CSV Specification</strong>
                                        <p>Export full test cases with steps, priorities, and expected results for Jira and Excel imports.</p>
                                    </div>
                                    <div className="tn-export-card">
                                        <div className="tn-export-card__icon"><Code size={16} /></div>
                                        <strong>Cucumber / Gherkin BDD</strong>
                                        <p>Generated Feature and Scenario blocks formatted for Playwright, Cypress, and Cucumber runners.</p>
                                    </div>
                                    <div className="tn-export-card">
                                        <div className="tn-export-card__icon"><Terminal size={16} /></div>
                                        <strong>Developer REST API</strong>
                                        <p>Automate test suite generation from CI/CD pipelines via <code>POST /api/v1/generate</code>.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProductWorkflow;
