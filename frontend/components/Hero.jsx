import React, { useState } from 'react';
import {
    ArrowRight,
    Check,
    ChevronRight,
    FileText,
    Layers,
    Shield,
    GitBranch,
    CheckSquare,
    AlertTriangle,
    SlidersHorizontal,
    Search,
    Download,
    ExternalLink
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const Hero = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();
    const [activeTab, setActiveTab] = useState('scenarios'); // 'requirement' | 'analysis' | 'scenarios' | 'cases' | 'coverage'

    const handleExploreWorkflow = (e) => {
        e.preventDefault();
        const target = document.getElementById('transformation');
        if (target) {
            const yOffset = -70;
            const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    return (
        <header className="tn-hero-section" aria-labelledby="hero-main-heading">
            <div className="tn-container">
                {/* ─── Hero Headline & CTAs ─── */}
                <div className="tn-hero-content">
                    <div className="tn-hero-kicker">
                        <span className="tn-kicker-dot" />
                        <span>Enterprise QA Engineering Platform</span>
                    </div>

                    <h1 id="hero-main-heading" className="tn-hero-title">
                        Turn requirements into executable test cases.
                    </h1>

                    <p className="tn-hero-desc">
                        Analyze requirements, generate test cases, review coverage and trace every test back to its source.
                    </p>

                    <div className="tn-hero-actions">
                        <a
                            href={getTargetUrl('/app/workspace')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`tn-btn-primary tn-btn-primary--lg ${isOpening ? 'is-opening' : ''}`}
                            id="hero-generate-cta"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                            aria-label="Generate Test Suite"
                        >
                            <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                            <ArrowRight size={15} />
                        </a>

                        <button
                            type="button"
                            className="tn-btn-secondary tn-btn-secondary--lg"
                            onClick={handleExploreWorkflow}
                        >
                            <span>Explore Workflow</span>
                        </button>
                    </div>
                </div>

                {/* ─── Coherent Testnexa Product Canvas ─── */}
                <div id="product-canvas" className="tn-hero-visual-frame" aria-label="Testnexa Product Canvas">
                    <div className="tn-software-window">
                        {/* Title Bar */}
                        <div className="tn-window-header">
                            <div className="tn-window-dots" aria-hidden="true">
                                <span className="tn-win-dot tn-win-dot--red" />
                                <span className="tn-win-dot tn-win-dot--amber" />
                                <span className="tn-win-dot tn-win-dot--green" />
                            </div>
                            <div className="tn-window-title">
                                <span className="tn-app-name">Testnexa</span>
                                <span className="tn-title-sep">/</span>
                                <span className="tn-req-label">
                                    <span className="tn-req-label-full">REQ-142: Password Reset Recovery</span>
                                    <span className="tn-req-label-short">REQ-142</span>
                                </span>
                            </div>
                            <div className="tn-window-status">
                                <span className="tn-status-badge tn-status-badge--review">Needs Review</span>
                            </div>
                        </div>

                        {/* Product Header & Key Metrics Bar */}
                        <div className="tn-canvas-subbar">
                            <div className="tn-canvas-meta">
                                <div className="tn-canvas-title-group">
                                    <h2 className="tn-canvas-title">Password Reset Recovery</h2>
                                    <span className="tn-canvas-tag">REQ-142</span>
                                    <span className="tn-canvas-priority tn-priority-tag--high">High Priority</span>
                                </div>
                                <span className="tn-canvas-time">Updated 2m ago &bull; Jira Sync PROD-842</span>
                            </div>

                            <div className="tn-canvas-metrics">
                                <div className="tn-cmetric">
                                    <span className="tn-cmetric-lbl">Status</span>
                                    <span className="tn-cmetric-val text-amber">Needs Review</span>
                                </div>
                                <div className="tn-cmetric-sep" />
                                <div className="tn-cmetric">
                                    <span className="tn-cmetric-lbl">Coverage</span>
                                    <span className="tn-cmetric-val text-green">87%</span>
                                </div>
                                <div className="tn-cmetric-sep" />
                                <div className="tn-cmetric">
                                    <span className="tn-cmetric-lbl">Tests</span>
                                    <span className="tn-cmetric-val font-mono">24</span>
                                </div>
                                <div className="tn-cmetric-sep" />
                                <div className="tn-cmetric">
                                    <span className="tn-cmetric-lbl">Risk</span>
                                    <span className="tn-cmetric-val text-red font-mono">2 High</span>
                                </div>
                                <div className="tn-cmetric-sep" />
                                <div className="tn-cmetric">
                                    <span className="tn-cmetric-lbl">Traceability</span>
                                    <span className="tn-cmetric-val font-mono">100%</span>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Workflow Stage Tabs */}
                        <div className="tn-canvas-stepper" role="tablist" aria-label="Product Workflow Pipeline">
                            {[
                                { id: 'requirement', label: '1. Requirement', count: 'Raw Spec' },
                                { id: 'analysis', label: '2. AI Analysis', count: '4 Omissions' },
                                { id: 'scenarios', label: '3. Test Scenarios', count: '4 Scenarios' },
                                { id: 'cases', label: '4. Test Cases', count: '24 Cases' },
                                { id: 'coverage', label: '5. Coverage & Risk', count: '87% Mapped' }
                            ].map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`tn-stepper-btn ${isActive ? 'is-active' : ''}`}
                                    >
                                        <span className="tn-stepper-label">{tab.label}</span>
                                        <span className="tn-stepper-count">{tab.count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Canvas Body Viewport */}
                        <div className="tn-canvas-body">
                            {/* TAB 1: REQUIREMENT */}
                            {activeTab === 'requirement' && (
                                <div className="tn-canvas-panel">
                                    <div className="tn-canvas-panel-header">
                                        <span className="tn-panel-eyebrow">RAW SPECIFICATION INGESTION</span>
                                        <span className="tn-panel-tag">Source: Jira PROD-842</span>
                                    </div>
                                    <div className="tn-canvas-raw-spec">
                                        <p className="tn-spec-text">
                                            "Users can reset their password using their registered email address."
                                        </p>
                                    </div>
                                    <div className="tn-spec-criteria-list">
                                        <span className="tn-criteria-title">Acceptance Criteria Identified:</span>
                                        <div className="tn-crit-row">
                                            <Check size={14} className="text-green" />
                                            <span>User submits email address on /forgot-password form endpoint.</span>
                                        </div>
                                        <div className="tn-crit-row">
                                            <Check size={14} className="text-green" />
                                            <span>System verifies existence and queues secure one-time cryptographic reset token.</span>
                                        </div>
                                        <div className="tn-crit-row">
                                            <Check size={14} className="text-green" />
                                            <span>User accesses verification link, supplies compliant new password, and confirms reset.</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: AI ANALYSIS */}
                            {activeTab === 'analysis' && (
                                <div className="tn-canvas-panel">
                                    <div className="tn-canvas-panel-header">
                                        <span className="tn-panel-eyebrow">REQUIREMENT AMBIGUITY & BOUNDARY AUDIT</span>
                                        <span className="tn-badge tn-badge--amber">4 Critical Ambiguities Detected</span>
                                    </div>
                                    <div className="tn-analysis-matrix">
                                        <div className="tn-analysis-card">
                                            <div className="tn-acard-head">
                                                <AlertTriangle size={13} className="text-amber" />
                                                <strong>Token Expiration Window (TTL)</strong>
                                            </div>
                                            <p>Spec omits TTL limit. Recommendation: Enforce 15-minute token invalidation.</p>
                                        </div>
                                        <div className="tn-analysis-card">
                                            <div className="tn-acard-head">
                                                <Shield size={13} className="text-red" />
                                                <strong>Anti-Enumeration Latency</strong>
                                            </div>
                                            <p>Uniform HTTP 200 response and latency delta &lt;25ms required to prevent user discovery.</p>
                                        </div>
                                        <div className="tn-analysis-card">
                                            <div className="tn-acard-head">
                                                <SlidersHorizontal size={13} className="text-blue" />
                                                <strong>Rate Limiting Threshold</strong>
                                            </div>
                                            <p>No brute-force or flooding boundary specified. Enforce max 5 requests/minute per client IP.</p>
                                        </div>
                                        <div className="tn-analysis-card">
                                            <div className="tn-acard-head">
                                                <AlertTriangle size={13} className="text-amber" />
                                                <strong>Token Invalidation on Re-Issue</strong>
                                            </div>
                                            <p>Submitting a second reset request must instantly burn previously issued nonces.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: TEST SCENARIOS (DEFAULT) */}
                            {activeTab === 'scenarios' && (
                                <div className="tn-canvas-panel">
                                    <div className="tn-canvas-panel-header">
                                        <span className="tn-panel-eyebrow">DERIVED TEST SCENARIOS (4 SCENARIO GROUPS)</span>
                                        <span className="tn-panel-tag">Synthesized from REQ-142</span>
                                    </div>
                                    <div className="tn-scenarios-table">
                                        <div className="tn-scenario-row">
                                            <span className="tn-scen-id">SC-01</span>
                                            <div className="tn-scen-main">
                                                <strong>Valid registered email password reset request</strong>
                                                <span>Functional &bull; Verifies cryptographic token generation, SMTP queuing, and single-use delivery.</span>
                                            </div>
                                            <span className="tn-badge tn-badge--green">Pass</span>
                                        </div>

                                        <div className="tn-scenario-row">
                                            <span className="tn-scen-id">SC-02</span>
                                            <div className="tn-scen-main">
                                                <strong>Malformed or unregistered email address submission</strong>
                                                <span>Negative &bull; RFC 5322 validation, HTTP 422 rejection, anti-enumeration generic response.</span>
                                            </div>
                                            <span className="tn-badge tn-badge--amber">Needs Review</span>
                                        </div>

                                        <div className="tn-scenario-row">
                                            <span className="tn-scen-id">SC-03</span>
                                            <div className="tn-scen-main">
                                                <strong>Expired reset token redemption attempt (T+15m01s)</strong>
                                                <span>Edge Case &bull; Asserts HTTP 400 TOKEN_EXPIRED error and prevents database password mutation.</span>
                                            </div>
                                            <span className="tn-badge tn-badge--amber">Needs Review</span>
                                        </div>

                                        <div className="tn-scenario-row">
                                            <span className="tn-scen-id">SC-04</span>
                                            <div className="tn-scen-main">
                                                <strong>Client IP rate limit exceeded (burst &gt; 5 requests/min)</strong>
                                                <span>Security &bull; Gateway throttles 6th request with HTTP 429 and Retry-After header enforcement.</span>
                                            </div>
                                            <span className="tn-badge tn-badge--red">High Risk</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: TEST CASES */}
                            {activeTab === 'cases' && (
                                <div className="tn-canvas-panel">
                                    <div className="tn-canvas-panel-header">
                                        <span className="tn-panel-eyebrow">EXECUTABLE TEST CASES (24 GENERATED &bull; PREVIEW)</span>
                                        <span className="tn-panel-tag">BDD & Step-Action Ready</span>
                                    </div>
                                    <div className="tn-cases-preview-list">
                                        <div className="tn-cpreview-item">
                                            <div className="tn-cpreview-meta">
                                                <span className="tn-tc-id">TC-001</span>
                                                <span className="tn-priority-tag tn-priority-tag--high">P0 &bull; High</span>
                                                <span className="tn-cat-tag">Functional</span>
                                            </div>
                                            <div className="tn-cpreview-content">
                                                <strong>Submit registered email and verify recovery token dispatch</strong>
                                                <p className="tn-cpreview-step">Step 1: POST /api/v1/auth/reset-request with user@company.com &rarr; Assert HTTP 200</p>
                                            </div>
                                            <span className="tn-status-badge tn-status-badge--review">Ready</span>
                                        </div>

                                        <div className="tn-cpreview-item">
                                            <div className="tn-cpreview-meta">
                                                <span className="tn-tc-id">TC-002</span>
                                                <span className="tn-priority-tag tn-priority-tag--high">P0 &bull; High</span>
                                                <span className="tn-cat-tag">Negative</span>
                                            </div>
                                            <div className="tn-cpreview-content">
                                                <strong>Enforce RFC 5322 regex validation & assert HTTP 422 payload</strong>
                                                <p className="tn-cpreview-step">Step 1: Input "user@domain..com" &rarr; Assert client validation blocks submission</p>
                                            </div>
                                            <span className="tn-status-badge tn-status-badge--review">Ready</span>
                                        </div>

                                        <div className="tn-cpreview-item">
                                            <div className="tn-cpreview-meta">
                                                <span className="tn-tc-id">TC-003</span>
                                                <span className="tn-priority-tag tn-priority-tag--med">P1 &bull; Med</span>
                                                <span className="tn-cat-tag">Edge Case</span>
                                            </div>
                                            <div className="tn-cpreview-content">
                                                <strong>Assert token invalidation after 15-minute TTL expiration window</strong>
                                                <p className="tn-cpreview-step">Step 1: Open reset URL at T+16m &rarr; Assert HTTP 400 errorCode "TOKEN_EXPIRED"</p>
                                            </div>
                                            <span className="tn-status-badge tn-status-badge--review">Ready</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 5: COVERAGE & RISK */}
                            {activeTab === 'coverage' && (
                                <div className="tn-canvas-panel">
                                    <div className="tn-canvas-panel-header">
                                        <span className="tn-panel-eyebrow">COVERAGE AUDIT & SEVERITY RISK MATRIX</span>
                                        <span className="tn-badge tn-badge--green">87% Clause Coverage</span>
                                    </div>
                                    <div className="tn-coverage-canvas-grid">
                                        <div className="tn-cov-mini-bars">
                                            <div className="tn-cbar-row">
                                                <span>Functional Coverage</span>
                                                <span className="font-mono">94%</span>
                                            </div>
                                            <div className="tn-cbar-row">
                                                <span>Negative Boundary Coverage</span>
                                                <span className="font-mono">88%</span>
                                            </div>
                                            <div className="tn-cbar-row">
                                                <span>Security & Rate Limiting</span>
                                                <span className="font-mono">100%</span>
                                            </div>
                                            <div className="tn-cbar-row">
                                                <span>Edge Case / TTL Expiration</span>
                                                <span className="font-mono">80%</span>
                                            </div>
                                        </div>
                                        <div className="tn-risk-mini-callout">
                                            <div className="tn-rcallout-header">
                                                <AlertTriangle size={13} className="text-amber" />
                                                <strong>2 High-Severity Risks Mitigated</strong>
                                            </div>
                                            <p>1. Expired Token Window &mdash; Mitigated by TC-003.</p>
                                            <p>2. Rate Limiting Omission &mdash; Mitigated by TC-004.</p>
                                            <div className="tn-trace-lock-note">
                                                <GitBranch size={12} className="text-accent" />
                                                <span>100% Bidirectional Lineage Mapped to REQ-142</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Product Window Footer */}
                        <div className="tn-canvas-footer">
                            <div className="tn-cfoot-left">
                                <span className="tn-engine-dot" />
                                <span>Engine: Testnexa Intelligence v3 &bull; ISO/IEC 29119 Aligned</span>
                            </div>
                            <div className="tn-cfoot-right">
                                <a
                                    href={getTargetUrl('/app/workspace')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="tn-canvas-link-btn"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleWorkspaceEntry('/app/workspace');
                                    }}
                                >
                                    <span>Open Suite in Workspace</span>
                                    <ChevronRight size={13} />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Seamless Workflow Continuity Strip ─── */}
                <div className="tn-continuity-strip" aria-label="Testnexa Core Quality Pipeline">
                    <span className="tn-continuity-label">ENTERPRISE QA PIPELINE</span>
                    <div className="tn-continuity-steps">
                        <span className="tn-cstep is-current">Requirement</span>
                        <span className="tn-carrow">&rarr;</span>
                        <span className="tn-cstep">AI Analysis</span>
                        <span className="tn-carrow">&rarr;</span>
                        <span className="tn-cstep">Test Scenarios</span>
                        <span className="tn-carrow">&rarr;</span>
                        <span className="tn-cstep">Test Cases</span>
                        <span className="tn-carrow">&rarr;</span>
                        <span className="tn-cstep">Coverage</span>
                        <span className="tn-carrow">&rarr;</span>
                        <span className="tn-cstep">Risk</span>
                        <span className="tn-carrow">&rarr;</span>
                        <span className="tn-cstep">Traceability</span>
                        <span className="tn-carrow">&rarr;</span>
                        <span className="tn-cstep">Automation</span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Hero;
