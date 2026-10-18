import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ArrowRight,
    Check,
    AlertTriangle,
    FileText,
    Shield,
    GitBranch,
    SlidersHorizontal,
    Code,
    Sparkles
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';
import AntigravityTypewriter from './AntigravityTypewriter';

export const Hero = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();
    const [activeTab, setActiveTab] = useState('cases');
    const sectionRef = useRef(null);
    const windowRef = useRef(null);
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsRevealed(true), 60);
        return () => clearTimeout(timer);
    }, []);

    const handleExploreWorkflow = (e) => {
        e.preventDefault();
        const target = document.getElementById('workflow') || document.getElementById('transformation');
        if (target) {
            const yOffset = -70;
            const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    // Subtle spotlight mouse illumination tracker for the product canvas
    const handleWindowMouseMove = useCallback((e) => {
        if (!windowRef.current) return;
        const rect = windowRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        windowRef.current.style.setProperty('--mouse-x', `${x}px`);
        windowRef.current.style.setProperty('--mouse-y', `${y}px`);
    }, []);

    return (
        <header className="tn-hero-section" aria-labelledby="hero-main-heading" ref={sectionRef}>
            <div className="tn-container">
                {/* ─── 1. Hero Headline & CTAs ─── */}
                <div
                    className="tn-hero-content"
                    style={{
                        opacity: isRevealed ? 1 : 0,
                        transform: isRevealed ? 'translateY(0)' : 'translateY(16px)',
                        transition: 'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)'
                    }}
                >
                    <div className="tn-hero-kicker">
                        <span className="tn-kicker-dot" />
                        <span>INTELLIGENT QA ENGINEERING</span>
                    </div>

                    <h1 id="hero-main-heading" className="tn-hero-title">
                        <AntigravityTypewriter staticPrefix="From requirements to" />
                    </h1>

                    <p className="tn-hero-desc">
                        TestNexa helps QA teams analyze requirements, generate structured test scenarios,
                        identify coverage gaps, and review tests before they move into execution.
                    </p>

                    <div className="tn-hero-actions">
                        <a
                            href={getTargetUrl('/app/workspace')}
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
                            <span>Explore the Workflow</span>
                        </button>
                    </div>

                    <div className="tn-hero-pipeline-strip" aria-label="QA Pipeline Steps">
                        <span className="tn-hpipe-item is-active">01 Requirement</span>
                        <span className="tn-hpipe-sep">──</span>
                        <span className="tn-hpipe-item">02 Analysis</span>
                        <span className="tn-hpipe-sep">──</span>
                        <span className="tn-hpipe-item">03 Test Suite</span>
                        <span className="tn-hpipe-sep">──</span>
                        <span className="tn-hpipe-item">04 Coverage</span>
                        <span className="tn-hpipe-sep">──</span>
                        <span className="tn-hpipe-item">05 Traceability</span>
                        <span className="tn-hpipe-sep">──</span>
                        <span className="tn-hpipe-item">06 Export</span>
                    </div>
                </div>

                {/* ─── 2. Focused Authentic TestNexa Product Canvas ─── */}
                <div
                    id="product-canvas"
                    className="tn-hero-visual-frame"
                    aria-label="TestNexa Product Canvas"
                    style={{
                        opacity: isRevealed ? 1 : 0,
                        transform: isRevealed ? 'translateY(0)' : 'translateY(24px)',
                        transition: 'opacity 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s'
                    }}
                >
                    <div
                        ref={windowRef}
                        className="tn-software-window tn-spotlight-card"
                        onMouseMove={handleWindowMouseMove}
                    >
                        {/* Title Bar */}
                        <div className="tn-window-header">
                            <div className="tn-window-dots" aria-hidden="true">
                                <span className="tn-win-dot tn-win-dot--red" />
                                <span className="tn-win-dot tn-win-dot--amber" />
                                <span className="tn-win-dot tn-win-dot--green" />
                            </div>
                            <div className="tn-window-title">
                                <span className="tn-app-name">TestNexa</span>
                                <span className="tn-title-sep">/</span>
                                <span className="tn-req-label">REQ-142: Password Reset Recovery</span>
                            </div>
                            <div className="tn-window-status">
                                <span className="tn-status-badge tn-status-badge--review">Needs Review</span>
                                <span className="tn-window-time">Updated 2m ago</span>
                            </div>
                        </div>

                        {/* App Sub-header with interactive tabs */}
                        <div className="tn-canvas-subbar">
                            <div className="tn-canvas-tabs" role="tablist" aria-label="Preview Views">
                                {[
                                    { key: 'cases', label: 'Test Suite', counter: '24 cases' },
                                    { key: 'requirement', label: 'Requirement Spec' },
                                    { key: 'analysis', label: 'AI Decomp', counter: '3 risks' },
                                    { key: 'scenarios', label: 'Scenario Groups', counter: '4 groups' }
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === tab.key}
                                        className={`tn-canvas-tab ${activeTab === tab.key ? 'is-active' : ''}`}
                                        onClick={() => setActiveTab(tab.key)}
                                    >
                                        <span>{tab.label}</span>
                                        {tab.counter && <span className="tn-tab-counter">{tab.counter}</span>}
                                    </button>
                                ))}
                            </div>

                            <div className="tn-canvas-metrics">
                                <div className="tn-cmetric">
                                    <span className="tn-cmetric-lbl">Coverage</span>
                                    <span className="tn-cmetric-val text-green font-mono">87%</span>
                                </div>
                                <div className="tn-cmetric-sep" />
                                <div className="tn-cmetric">
                                    <span className="tn-cmetric-lbl">Tests</span>
                                    <span className="tn-cmetric-val font-mono">24</span>
                                </div>
                                <div className="tn-cmetric-sep" />
                                <div className="tn-cmetric">
                                    <span className="tn-cmetric-lbl">Risk</span>
                                    <span className="tn-cmetric-val text-amber font-mono">2 High</span>
                                </div>
                                <div className="tn-cmetric-sep" />
                                <div className="tn-cmetric">
                                    <span className="tn-cmetric-lbl">Traceability</span>
                                    <span className="tn-cmetric-val text-accent font-mono">100%</span>
                                </div>
                            </div>
                        </div>

                        {/* Main Canvas View */}
                        <div className="tn-canvas-body">
                            {/* TAB: CASES / DEFAULT SPLIT VIEW */}
                            {activeTab === 'cases' && (
                                <>
                                    {/* Left Pane: Specification */}
                                    <div className="tn-cbody-pane tn-cbody-pane--spec">
                                        <div className="tn-cpane-head">
                                            <span className="tn-cpane-tag">SPECIFICATION INGESTION</span>
                                            <span className="tn-cpane-source">Jira PROD-842</span>
                                        </div>

                                        <div className="tn-spec-text-block">
                                            <p className="tn-spec-quote">
                                                “Users can reset their password using their registered email address.”
                                            </p>
                                        </div>

                                        <div className="tn-spec-clauses">
                                            <div className="tn-clause-row">
                                                <span className="tn-clause-idx">AC-1</span>
                                                <span className="tn-clause-desc">Single-use reset token dispatched to verified email with 15-minute TTL.</span>
                                            </div>
                                            <div className="tn-clause-row">
                                                <span className="tn-clause-idx">AC-2</span>
                                                <span className="tn-clause-desc">Immediately revoke all active web/mobile sessions upon confirmation.</span>
                                            </div>
                                            <div className="tn-clause-row">
                                                <span className="tn-clause-idx">AC-3</span>
                                                <span className="tn-clause-desc">Enforce rate limiter of max 5 requests per hour per originating IP.</span>
                                            </div>
                                        </div>

                                        <div className="tn-spec-footer-meta">
                                            <span className="tn-meta-label">ANALYSIS SIGNAL:</span>
                                            <span className="tn-meta-val">3 ambiguities flagged &bull; 2 high risks isolated</span>
                                        </div>
                                    </div>

                                    {/* Right Pane: Generated Test Suite */}
                                    <div className="tn-cbody-pane tn-cbody-pane--tests">
                                        <div className="tn-cpane-head">
                                            <div className="tn-suite-head-left">
                                                <span className="tn-cpane-tag">SYNTHESIZED TEST SUITE</span>
                                                <span className="tn-cpane-count">24 test cases</span>
                                            </div>
                                            <div className="tn-suite-filters">
                                                <span className="tn-sfilter-pill is-func">Functional (12)</span>
                                                <span className="tn-sfilter-pill is-neg">Negative (7)</span>
                                                <span className="tn-sfilter-pill is-sec">Security (5)</span>
                                            </div>
                                        </div>

                                        <div className="tn-hero-table-wrap">
                                            <table className="tn-hero-table">
                                                <thead>
                                                    <tr>
                                                        <th className="th-id">ID</th>
                                                        <th className="th-title">TEST SCENARIO & ASSERTION</th>
                                                        <th className="th-type">TYPE</th>
                                                        <th className="th-status">STATUS</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="td-id"><code>TC-001</code></td>
                                                        <td className="td-title">
                                                            <div className="tc-name">Valid password recovery submission</div>
                                                            <div className="tc-sub">Assert HTTP 200 generic confirmation &bull; 15m token queued</div>
                                                        </td>
                                                        <td className="td-type"><span className="tc-type tc-type--func">Functional</span></td>
                                                        <td className="td-status"><span className="tc-status is-pass"><Check size={11} /> Pass</span></td>
                                                    </tr>
                                                    <tr>
                                                        <td className="td-id"><code>TC-002</code></td>
                                                        <td className="td-title">
                                                            <div className="tc-name">Malformed email syntax rejection</div>
                                                            <div className="tc-sub">Assert RFC 5322 regex validation &bull; HTTP 422 INVALID_EMAIL</div>
                                                        </td>
                                                        <td className="td-type"><span className="tc-type tc-type--neg">Negative</span></td>
                                                        <td className="td-status"><span className="tc-status is-pass"><Check size={11} /> Pass</span></td>
                                                    </tr>
                                                    <tr>
                                                        <td className="td-id"><code>TC-003</code></td>
                                                        <td className="td-title">
                                                            <div className="tc-name">Expired token redemption attempt</div>
                                                            <div className="tc-sub">Reject token &gt; 15m &bull; Assert HTTP 401 TOKEN_EXPIRED</div>
                                                        </td>
                                                        <td className="td-type"><span className="tc-type tc-type--neg">Negative</span></td>
                                                        <td className="td-status"><span className="tc-status is-pass"><Check size={11} /> Pass</span></td>
                                                    </tr>
                                                    <tr>
                                                        <td className="td-id"><code>TC-004</code></td>
                                                        <td className="td-title">
                                                            <div className="tc-name">Brute-force throttle enforcement</div>
                                                            <div className="tc-sub">Simulate 6 req/min &bull; Assert HTTP 429 TOO_MANY_REQUESTS</div>
                                                        </td>
                                                        <td className="td-type"><span className="tc-type tc-type--sec">Security</span></td>
                                                        <td className="td-status"><span className="tc-status is-review"><AlertTriangle size={11} /> Review</span></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="tn-hero-pane-footer">
                                            <span className="tn-pfooter-lbl">LINEAGE:</span>
                                            <span className="tn-pfooter-val">100% bidirectional traceability linked to REQ-142</span>
                                            <div className="tn-pfooter-actions">
                                                <span className="tn-runner-badge">Playwright</span>
                                                <span className="tn-runner-badge">Cypress</span>
                                                <span className="tn-runner-badge">Cucumber BDD</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* TAB: REQUIREMENT SPEC */}
                            {activeTab === 'requirement' && (
                                <div className="tn-cbody-pane tn-cbody-pane--full">
                                    <div className="tn-cpane-head">
                                        <span className="tn-cpane-tag">RAW REQUIREMENT DECONSTRUCTION</span>
                                        <span className="tn-cpane-source">Source: Jira PROD-842 &bull; Auth Domain</span>
                                    </div>
                                    <div className="tn-tab-full-content">
                                        <div className="tn-spec-text-block">
                                            <span className="tn-ann-editor-line-num">01</span>
                                            <p className="tn-spec-quote">
                                                “Users can reset their password using their registered email address.”
                                            </p>
                                        </div>
                                        <div className="tn-tab-ac-grid">
                                            <div className="tn-ac-card">
                                                <div className="tn-ac-card-head">
                                                    <span className="tn-clause-idx">AC-1</span>
                                                    <span className="tn-ac-status is-pass">Verified</span>
                                                </div>
                                                <p className="tn-ac-card-title">Token Dispatch & TTL</p>
                                                <p className="tn-ac-card-desc">Single-use token dispatched via SMTP to verified email address only. Link expiration strictly locked to 15-minute TTL.</p>
                                            </div>
                                            <div className="tn-ac-card">
                                                <div className="tn-ac-card-head">
                                                    <span className="tn-clause-idx">AC-2</span>
                                                    <span className="tn-ac-status is-pass">Verified</span>
                                                </div>
                                                <p className="tn-ac-card-title">Session Revocation</p>
                                                <p className="tn-ac-card-desc">Invalidate all existing session cookies and active refresh tokens across web and mobile clients upon password change.</p>
                                            </div>
                                            <div className="tn-ac-card">
                                                <div className="tn-ac-card-head">
                                                    <span className="tn-clause-idx">AC-3</span>
                                                    <span className="tn-ac-status is-review">Review</span>
                                                </div>
                                                <p className="tn-ac-card-title">Rate Limiting & Abuse Prevention</p>
                                                <p className="tn-ac-card-desc">Throttle password recovery triggers to max 5 requests per hour per originating IP and account.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: AI ANALYSIS */}
                            {activeTab === 'analysis' && (
                                <div className="tn-cbody-pane tn-cbody-pane--full">
                                    <div className="tn-cpane-head">
                                        <span className="tn-cpane-tag">AI ANALYSIS & RISK SIGNALS</span>
                                        <span className="tn-analysis-badge">Deterministic Deconstruction</span>
                                    </div>
                                    <div className="tn-tab-full-content">
                                        <div className="tn-decomp-grid">
                                            <div className="tn-decomp-col">
                                                <span className="tn-decomp-header">ISOLATED CONDITIONS</span>
                                                <ul className="tn-decomp-list">
                                                    <li>• Registered email address verification in database</li>
                                                    <li>• Cryptographic one-time reset token generation (256-bit entropy)</li>
                                                    <li>• Strict 15-minute expiration boundary</li>
                                                    <li>• Full invalidation of prior active bearer tokens</li>
                                                </ul>
                                            </div>
                                            <div className="tn-decomp-col">
                                                <span className="tn-decomp-header">IDENTIFIED RISKS & BLIND SPOTS</span>
                                                <ul className="tn-decomp-list tn-decomp-list--risks">
                                                    <li>
                                                        <span className="tn-risk-indicator is-red" />
                                                        <div>
                                                            <strong>Account Enumeration Vulnerability</strong>
                                                            <p>Different response codes or timings on existing vs non-existing emails expose registered accounts.</p>
                                                        </div>
                                                    </li>
                                                    <li>
                                                        <span className="tn-risk-indicator is-amber" />
                                                        <div>
                                                            <strong>Expired Token Replay</strong>
                                                            <p>Submitting an expired or already-used token must immediately fail with HTTP 401 TOKEN_EXPIRED.</p>
                                                        </div>
                                                    </li>
                                                    <li>
                                                        <span className="tn-risk-indicator is-amber" />
                                                        <div>
                                                            <strong>Rate Limit Exhaustion</strong>
                                                            <p>Missing IP throttle exposes auth email dispatch queues to automated flooding.</p>
                                                        </div>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: SCENARIOS */}
                            {activeTab === 'scenarios' && (
                                <div className="tn-cbody-pane tn-cbody-pane--full">
                                    <div className="tn-cpane-head">
                                        <span className="tn-cpane-tag">CATEGORIZED SCENARIO GROUPS</span>
                                        <span className="tn-cpane-count">4 Groups &bull; 24 Test Assertions</span>
                                    </div>
                                    <div className="tn-tab-full-content">
                                        <div className="tn-scenarios-grid">
                                            <div className="tn-scen-group-card">
                                                <div className="tn-sg-head">
                                                    <span className="tc-type tc-type--func">Functional (12)</span>
                                                    <span className="tn-sg-prio">P0 Critical</span>
                                                </div>
                                                <h4 className="tn-sg-title">Happy Path Recovery</h4>
                                                <p className="tn-sg-desc">Valid email input, SMTP token dispatch, secure token redemption, successful password update.</p>
                                            </div>
                                            <div className="tn-scen-group-card">
                                                <div className="tn-sg-head">
                                                    <span className="tc-type tc-type--neg">Negative (7)</span>
                                                    <span className="tn-sg-prio">P1 High</span>
                                                </div>
                                                <h4 className="tn-sg-title">Input & Expiry Boundaries</h4>
                                                <p className="tn-sg-desc">RFC 5322 malformed email syntax, expired token redemption, replayed single-use token, invalid password complexity.</p>
                                            </div>
                                            <div className="tn-scen-group-card">
                                                <div className="tn-sg-head">
                                                    <span className="tc-type tc-type--sec">Security (5)</span>
                                                    <span className="tn-sg-prio">P0 Critical</span>
                                                </div>
                                                <h4 className="tn-sg-title">Abuse Mitigation & Timing</h4>
                                                <p className="tn-sg-desc">Rate limit enforcement (&gt;5 req/hr), constant-time response delta (&le;120ms), session cookie revocation on completion.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Hero;
