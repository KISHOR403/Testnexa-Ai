import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowRight,
    Check,
    AlertTriangle
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';
import AntigravityTypewriter from './AntigravityTypewriter';

export const Hero = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();
    const [activeTab, setActiveTab] = useState('cases');
    const sectionRef = useRef(null);
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsRevealed(true), 40);
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

    return (
        <header className="tn-hero-section" aria-labelledby="hero-main-heading" ref={sectionRef}>
            <div className="tn-container">
                {/* ─── 1. Hero Headline & CTAs ─── */}
                <div
                    className="tn-hero-content"
                    style={{
                        opacity: isRevealed ? 1 : 0,
                        transform: isRevealed ? 'translateY(0)' : 'translateY(14px)',
                        transition: 'opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)'
                    }}
                >
                    {/* Eyebrow Label */}
                    <div className="tn-hero-eyebrow">
                        INTELLIGENT QA ENGINEERING
                    </div>

                    {/* Large Headline with Antigravity Typewriter Text Style */}
                    <h1 id="hero-main-heading" className="tn-hero-title">
                        <AntigravityTypewriter staticPrefix="From requirements to" />
                    </h1>

                    {/* Supporting Description */}
                    <p className="tn-hero-desc">
                        TestNexa helps QA teams analyze requirements, generate structured test scenarios,
                        identify coverage gaps, and review tests before they move into execution.
                    </p>

                    {/* Action CTAs */}
                    <div className="tn-hero-actions">
                        <a
                            href={getTargetUrl('/app/workspace')}
                            className={`tn-hero-btn-primary ${isOpening ? 'is-opening' : ''}`}
                            id="hero-generate-cta"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                            aria-label="Generate Test Suite"
                        >
                            <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                            <ArrowRight size={14} />
                        </a>

                        <button
                            type="button"
                            className="tn-hero-btn-secondary"
                            onClick={handleExploreWorkflow}
                        >
                            <span>Explore the Workflow</span>
                        </button>
                    </div>

                    {/* Minimal Capability Indicators: Simple Horizontal Text Row */}
                    <div className="tn-hero-capabilities" aria-label="Core Capabilities">
                        <span className="tn-cap-item">Requirement Analysis</span>
                        <span className="tn-cap-sep" aria-hidden="true">/</span>
                        <span className="tn-cap-item">Test Generation</span>
                        <span className="tn-cap-sep" aria-hidden="true">/</span>
                        <span className="tn-cap-item">Coverage Intelligence</span>
                        <span className="tn-cap-sep" aria-hidden="true">/</span>
                        <span className="tn-cap-item">Traceability</span>
                        <span className="tn-cap-sep" aria-hidden="true">/</span>
                        <span className="tn-cap-item">Execution Ready</span>
                    </div>
                </div>

                {/* ─── 2. Focused Authentic TestNexa Product Canvas ─── */}
                <div
                    id="product-canvas"
                    className="tn-hero-visual-frame"
                    aria-label="TestNexa Product Canvas"
                    style={{
                        opacity: isRevealed ? 1 : 0,
                        transform: isRevealed ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1) 0.12s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.12s'
                    }}
                >
                    <div className="tn-software-window">
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

                        {/* App Sub-header with interactive tabs & real metrics */}
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
                                                        <td className="td-status"><span className="tc-status is-ready"><Check size={11} /> Ready</span></td>
                                                    </tr>
                                                    <tr>
                                                        <td className="td-id"><code>TC-002</code></td>
                                                        <td className="td-title">
                                                            <div className="tc-name">Malformed email syntax rejection</div>
                                                            <div className="tc-sub">Assert RFC 5322 regex validation &bull; HTTP 422 INVALID_EMAIL</div>
                                                        </td>
                                                        <td className="td-type"><span className="tc-type tc-type--neg">Negative</span></td>
                                                        <td className="td-status"><span className="tc-status is-ready"><Check size={11} /> Ready</span></td>
                                                    </tr>
                                                    <tr>
                                                        <td className="td-id"><code>TC-003</code></td>
                                                        <td className="td-title">
                                                            <div className="tc-name">Expired token redemption attempt</div>
                                                            <div className="tc-sub">Reject token &gt; 15m &bull; Assert HTTP 401 TOKEN_EXPIRED</div>
                                                        </td>
                                                        <td className="td-type"><span className="tc-type tc-type--neg">Negative</span></td>
                                                        <td className="td-status"><span className="tc-status is-ready"><Check size={11} /> Ready</span></td>
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
                                            <span className="tn-pfooter-val font-mono">REQ-142 &rarr; AC-1, AC-2, AC-3 &rarr; 24 verified scenarios</span>
                                            <div className="tn-pfooter-actions">
                                                <span className="tn-runner-badge">Playwright Ready</span>
                                                <span className="tn-runner-badge">Manual QA Ready</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* TAB: REQUIREMENT */}
                            {activeTab === 'requirement' && (
                                <div className="tn-cbody-pane tn-cbody-pane--full">
                                    <div className="tn-cpane-head">
                                        <span className="tn-cpane-tag">FULL REQUIREMENT SPECIFICATION</span>
                                        <span className="tn-cpane-source">REQ-142 v1.2</span>
                                    </div>
                                    <div className="tn-tab-full-content">
                                        <div className="tn-spec-text-block">
                                            <p className="tn-spec-quote">
                                                &ldquo;As a registered user who has forgotten their password, I want to initiate a secure recovery sequence using my verified email so that I can regain authenticated access without administrative intervention.&rdquo;
                                            </p>
                                        </div>
                                        <div className="tn-tab-ac-grid">
                                            <div className="tn-ac-card">
                                                <div className="tn-ac-card-head">
                                                    <span className="tn-clause-idx">AC-1</span>
                                                    <span className="tn-ac-status is-pass">Verified</span>
                                                </div>
                                                <p className="tn-ac-card-title">Token Lifecycle &amp; Dispatch</p>
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
                                                <p className="tn-ac-card-title">Rate Limiting &amp; Abuse Prevention</p>
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
                                        <span className="tn-cpane-tag">AI ANALYSIS &amp; RISK SIGNALS</span>
                                        <span className="tn-analysis-badge">Deterministic Deconstruction</span>
                                    </div>
                                    <div className="tn-tab-full-content">
                                        <div className="tn-decomp-grid">
                                            <div className="tn-decomp-col">
                                                <span className="tn-decomp-header">ISOLATED CONDITIONS</span>
                                                <ul className="tn-decomp-list">
                                                    <li>&bull; Registered email address verification in database</li>
                                                    <li>&bull; Cryptographic one-time reset token generation (256-bit entropy)</li>
                                                    <li>&bull; Strict 15-minute expiration boundary</li>
                                                    <li>&bull; Full invalidation of prior active bearer tokens</li>
                                                </ul>
                                            </div>
                                            <div className="tn-decomp-col">
                                                <span className="tn-decomp-header">EDGE RISKS &amp; AMBIGUITIES</span>
                                                <ul className="tn-decomp-list tn-decomp-list--risks">
                                                    <li>
                                                        <span className="tn-risk-indicator is-amber" />
                                                        <div>
                                                            <strong>Account Enumeration Timing Delta</strong>
                                                            <p>Response timings on existing vs non-existing emails expose registered accounts.</p>
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
                                                <h4 className="tn-sg-title">Input &amp; Expiry Boundaries</h4>
                                                <p className="tn-sg-desc">RFC 5322 malformed email syntax, expired token redemption, replayed single-use token, invalid password complexity.</p>
                                            </div>
                                            <div className="tn-scen-group-card">
                                                <div className="tn-sg-head">
                                                    <span className="tc-type tc-type--sec">Security (5)</span>
                                                    <span className="tn-sg-prio">P0 Critical</span>
                                                </div>
                                                <h4 className="tn-sg-title">Abuse Mitigation &amp; Timing</h4>
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
