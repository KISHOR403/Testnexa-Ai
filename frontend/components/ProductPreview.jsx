import React, { useState } from 'react';
import {
    FileText,
    Layers,
    Shield,
    GitBranch,
    CheckSquare,
    Search,
    Download,
    Check,
    AlertTriangle,
    ShieldAlert,
    Code,
    ChevronRight,
    Terminal,
    ArrowRight
} from 'lucide-react';

const REQ_142_TESTS = [
    {
        id: 'TC-001',
        title: 'Reset password with valid registered email address',
        scenario: 'Verify standard recovery link dispatch to active mailbox',
        type: 'Functional',
        priority: 'High',
        status: 'Needs Review',
        preconditions: ['User account exists in authentication database with verified status.'],
        steps: [
            { action: 'Submit valid registered email to /forgot-password endpoint.', expected: 'HTTP 200 returned; single-use token created with 15-minute TTL.' },
            { action: 'Inspect email queue for dispatch record.', expected: 'Reset email delivered within 10s containing unique secure token URL.' }
        ],
        expectedResult: 'System sends single-use link and displays confirmation without disclosing user existence.',
        testData: 'email: "alex.qa@company.com"'
    },
    {
        id: 'TC-002',
        title: 'Reset password with invalid email format',
        scenario: 'Validate client input formatting and server schema rejection',
        type: 'Negative',
        priority: 'High',
        status: 'Needs Review',
        preconditions: ['Password reset form rendered in browser.'],
        steps: [
            { action: 'Input malformed email strings ("user@", "user@domain..com").', expected: 'Inline client validation blocks submission with clear schema error.' },
            { action: 'Submit raw POST request with malformed email body to API.', expected: 'HTTP 422 Unprocessable Entity returned with validation payload.' }
        ],
        expectedResult: 'System strictly rejects malformed email strings at UI and API gateway levels.',
        testData: 'email: "malformed-syntax@@domain"'
    },
    {
        id: 'TC-003',
        title: 'Use expired reset link beyond 15-minute TTL',
        scenario: 'Enforce cryptographic token time-to-live expiration bounds',
        type: 'Edge Case',
        priority: 'High',
        status: 'Needs Review',
        preconditions: ['A reset token was generated 16 minutes ago and has not been redeemed.'],
        steps: [
            { action: 'Navigate to password reset URL containing the expired token.', expected: 'Application verifies token timestamp against server clock.' },
            { action: 'Submit new compliant password in input fields.', expected: 'HTTP 400 Bad Request returned with error code "TOKEN_EXPIRED".' }
        ],
        expectedResult: 'System rejects expired token, preserves previous password, and provides link to request a fresh token.',
        testData: 'token: "exp_token_98421", ttl: 900'
    },
    {
        id: 'TC-004',
        title: 'Multiple reset attempts within rate limit window',
        scenario: 'Protect mailbox from spam flooding via 5+ dispatches per minute',
        type: 'Security',
        priority: 'High',
        status: 'Needs Review',
        preconditions: ['Rate limiting rule active at API gateway (5 requests per IP per 60s).'],
        steps: [
            { action: 'Dispatch 6 consecutive reset requests for single target email within 20s.', expected: 'First 5 requests process normally; 6th request triggers rate limiter.' },
            { action: 'Inspect HTTP response headers on 6th request.', expected: 'HTTP 429 Too Many Requests returned with "Retry-After: 60".' }
        ],
        expectedResult: 'API gateway throttles excessive reset requests and logs anomaly event to audit telemetry.',
        testData: 'rateLimit: "5 req/60s", clientIP: "198.51.100.42"'
    },
    {
        id: 'TC-005',
        title: 'Reset password with unregistered email address',
        scenario: 'Prevent account enumeration by maintaining identical response latency',
        type: 'Negative',
        priority: 'Medium',
        status: 'Needs Review',
        preconditions: ['Email "nonexistent@company.internal" does not exist in user database.'],
        steps: [
            { action: 'Submit unregistered email address to forgot-password form.', expected: 'Generic confirmation message shown: "If an account exists, reset instructions have been sent".' },
            { action: 'Measure API endpoint response latency delta against valid email dispatch.', expected: 'Response time difference is under 35ms (constant-time dummy hashing).' }
        ],
        expectedResult: 'Application returns identical generic message and constant-time latency to prevent enumeration.',
        testData: 'email: "unregistered@domain.com"'
    }
];

export const ProductPreview = () => {
    const [activeTab, setActiveTab] = useState('tests'); // 'req' | 'tests' | 'coverage' | 'risks' | 'traceability'
    const [selectedTcId, setSelectedTcId] = useState('TC-001');
    const [showGherkin, setShowGherkin] = useState(false);

    const selectedTc = REQ_142_TESTS.find(tc => tc.id === selectedTcId) || REQ_142_TESTS[0];

    return (
        <section id="product-preview" className="tn-section tn-product-preview-section" aria-labelledby="preview-heading">
            <div className="tn-container">
                <div className="tn-section-header">
                    <span className="tn-kicker">Unified Workspace</span>
                    <h2 id="preview-heading" className="tn-section-title">
                        A complete QA workflow.
                    </h2>
                    <p className="tn-section-subtitle">
                        Requirement analysis, test cases, coverage, risks, and traceability in one workspace.
                    </p>
                </div>

                {/* ─── Real Workspace Chrome Container ─── */}
                <div className="tn-preview-window">
                    {/* Window Title Bar */}
                    <div className="tn-preview-window__topbar">
                        <div className="tn-preview-window__traffic-lights" aria-hidden="true">
                            <span className="tn-dot tn-dot--close" />
                            <span className="tn-dot tn-dot--min" />
                            <span className="tn-dot tn-dot--max" />
                        </div>
                        <div className="tn-preview-window__breadcrumbs">
                            <span className="tn-crumb-brand">TestNexa</span>
                            <span className="tn-crumb-sep">/</span>
                            <span className="tn-crumb-id">REQ-142</span>
                            <span className="tn-crumb-sep">/</span>
                            <span className="tn-crumb-name">Password Reset</span>
                        </div>
                        <div className="tn-preview-window__status-tags">
                            <span className="tn-pill tn-pill--status">Needs Review</span>
                            <span className="tn-pill tn-pill--version">v1.2</span>
                        </div>
                    </div>

                    {/* Integrated Tabbed Navigation Inside Preview */}
                    <div className="tn-preview-window__tab-bar" role="tablist" aria-label="Test Suite Views">
                        {[
                            { id: 'req', label: 'Requirement', count: null, icon: FileText },
                            { id: 'tests', label: 'Test Cases', count: '24', icon: CheckSquare },
                            { id: 'coverage', label: 'Coverage', count: '92%', icon: Layers },
                            { id: 'risks', label: 'Risks', count: '3 High', icon: Shield },
                            { id: 'traceability', label: 'Traceability', count: null, icon: GitBranch }
                        ].map(({ id, label, count, icon: Icon }) => (
                            <button
                                key={id}
                                role="tab"
                                aria-selected={activeTab === id}
                                className={`tn-preview-tab-btn ${activeTab === id ? 'is-active' : ''}`}
                                onClick={() => setActiveTab(id)}
                            >
                                <Icon size={14} />
                                <span>{label}</span>
                                {count && <span className="tn-preview-tab-btn__count">{count}</span>}
                            </button>
                        ))}
                    </div>

                    {/* ─── TAB 1: REQUIREMENT VIEW ─── */}
                    {activeTab === 'req' && (
                        <div className="tn-preview-body tn-preview-body--req">
                            <div className="tn-req-panel">
                                <div className="tn-req-panel__header">
                                    <div className="tn-req-meta">
                                        <span className="tn-tag-req">REQ-142</span>
                                        <h3 className="tn-req-title">Password Reset via Registered Email</h3>
                                    </div>
                                    <span className="tn-pill tn-pill--neutral">Source: Jira PROD-842</span>
                                </div>

                                <div className="tn-req-desc-block">
                                    <label>Raw Requirement Text</label>
                                    <p className="tn-req-text">
                                        "Users can reset their password using their registered email address. The system sends a single-use token valid for 15 minutes. Link expires after single use and rate limits multiple requests."
                                    </p>
                                </div>

                                <div className="tn-req-deconstruction-grid">
                                    <div className="tn-deconstruct-card">
                                        <label>Identified Actors</label>
                                        <ul>
                                            <li>Registered User (Active in DB)</li>
                                            <li>Mail Dispatch Service (SMTP / SendGrid)</li>
                                            <li>Authentication API Gateway</li>
                                        </ul>
                                    </div>
                                    <div className="tn-deconstruct-card">
                                        <label>Explicit Acceptance Criteria</label>
                                        <ul>
                                            <li>Single-use cryptographic reset link</li>
                                            <li>Token TTL exactly 15 minutes (900 seconds)</li>
                                            <li>Generic response message to prevent enumeration</li>
                                        </ul>
                                    </div>
                                    <div className="tn-deconstruct-card">
                                        <label>Identified Risk Boundaries</label>
                                        <ul>
                                            <li>Rate limit threshold: 5 requests / 60s per IP</li>
                                            <li>Expired token reuse rejection (HTTP 400)</li>
                                            <li>Duplicate token redemption race condition</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 2: TEST CASES (MASTER-DETAIL WORKSPACE) ─── */}
                    {activeTab === 'tests' && (
                        <div className="tn-preview-body tn-preview-body--tests">
                            <div className="tn-preview-split">
                                {/* Left Table */}
                                <div className="tn-preview-table-col">
                                    <div className="tn-table-filter-bar">
                                        <span className="tn-filter-label">5 of 24 Scenarios</span>
                                        <span className="tn-filter-tag">All Categories</span>
                                    </div>
                                    <table className="tn-preview-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '74px' }}>ID</th>
                                                <th>Scenario & Title</th>
                                                <th style={{ width: '92px' }}>Type</th>
                                                <th style={{ width: '76px' }}>Priority</th>
                                                <th style={{ width: '96px' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {REQ_142_TESTS.map((tc) => {
                                                const isSelected = selectedTcId === tc.id;
                                                return (
                                                    <tr
                                                        key={tc.id}
                                                        className={`tn-preview-row ${isSelected ? 'is-selected' : ''}`}
                                                        onClick={() => setSelectedTcId(tc.id)}
                                                    >
                                                        <td><span className="tn-id-cell">{tc.id}</span></td>
                                                        <td>
                                                            <div className="tn-title-cell">
                                                                <strong>{tc.title}</strong>
                                                                <span>{tc.scenario}</span>
                                                            </div>
                                                        </td>
                                                        <td><span className={`tn-chip tn-chip--${tc.type.toLowerCase().replace(/\s+/g, '')}`}>{tc.type}</span></td>
                                                        <td><span className={`tn-prio tn-prio--${tc.priority.toLowerCase()}`}>{tc.priority}</span></td>
                                                        <td><span className="tn-status-tag">{tc.status}</span></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Right Detail Pane */}
                                <div className="tn-preview-detail-col">
                                    <div className="tn-detail-header-row">
                                        <div>
                                            <span className="tn-detail-id">{selectedTc.id}</span>
                                            <span className="tn-detail-trace">REQ-142</span>
                                            <h4 className="tn-detail-h4">{selectedTc.title}</h4>
                                        </div>
                                        <button
                                            type="button"
                                            className="tn-gherkin-toggle-btn"
                                            onClick={() => setShowGherkin(!showGherkin)}
                                        >
                                            <Code size={12} />
                                            <span>{showGherkin ? 'Steps' : 'BDD Spec'}</span>
                                        </button>
                                    </div>

                                    {showGherkin ? (
                                        <div className="tn-gherkin-box">
                                            <pre><code>{`@${selectedTc.type.toLowerCase()} @priority_${selectedTc.priority.toLowerCase()}
Feature: Password Reset Verification (REQ-142)

  Scenario: ${selectedTc.title}
    Given user navigates to /forgot-password
    When ${selectedTc.steps[0]?.action}
    Then ${selectedTc.steps[0]?.expected}
    And ${selectedTc.expectedResult}`}</code></pre>
                                        </div>
                                    ) : (
                                        <div className="tn-detail-content">
                                            <div className="tn-detail-group">
                                                <label>PRECONDITIONS</label>
                                                <p>{selectedTc.preconditions.join(' ')}</p>
                                            </div>
                                            <div className="tn-detail-group">
                                                <label>TEST STEPS ({selectedTc.steps.length})</label>
                                                <div className="tn-steps-stack">
                                                    {selectedTc.steps.map((st, i) => (
                                                        <div key={i} className="tn-step-row">
                                                            <span className="tn-step-idx">{String(i + 1).padStart(2, '0')}</span>
                                                            <div className="tn-step-body">
                                                                <p><strong>Action:</strong> {st.action}</p>
                                                                <p className="tn-step-exp"><strong>Expected:</strong> {st.expected}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="tn-detail-group">
                                                <label>EXPECTED RESULT</label>
                                                <div className="tn-expected-banner">
                                                    <CheckSquare size={14} className="text-accent" />
                                                    <p>{selectedTc.expectedResult}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 3: COVERAGE VIEW ─── */}
                    {activeTab === 'coverage' && (
                        <div className="tn-preview-body tn-preview-body--coverage">
                            <div className="tn-cov-dashboard">
                                <div className="tn-cov-header-row">
                                    <div>
                                        <h3>Requirement Coverage Matrix &bull; REQ-142</h3>
                                        <p>Verification completeness across specification clauses</p>
                                    </div>
                                    <div className="tn-cov-big-stat">
                                        <span className="tn-cov-pct">92%</span>
                                        <span className="tn-cov-lbl">Verified Coverage</span>
                                    </div>
                                </div>

                                <div className="tn-cov-matrix-grid">
                                    <div className="tn-matrix-bar-card">
                                        <div className="tn-matrix-meta">
                                            <span>Functional Delivery Flow</span>
                                            <strong>96% (8/8 Cases)</strong>
                                        </div>
                                        <div className="tn-cov-track"><div className="tn-cov-fill" style={{ width: '96%' }} /></div>
                                    </div>
                                    <div className="tn-matrix-bar-card">
                                        <div className="tn-matrix-meta">
                                            <span>Negative Validation Rules</span>
                                            <strong>90% (6/7 Cases)</strong>
                                        </div>
                                        <div className="tn-cov-track"><div className="tn-cov-fill" style={{ width: '90%' }} /></div>
                                    </div>
                                    <div className="tn-matrix-bar-card">
                                        <div className="tn-matrix-meta">
                                            <span>Security & Token TTL Lifecycles</span>
                                            <strong>88% (5/6 Cases)</strong>
                                        </div>
                                        <div className="tn-cov-track"><div className="tn-cov-fill" style={{ width: '88%' }} /></div>
                                    </div>
                                    <div className="tn-matrix-bar-card">
                                        <div className="tn-matrix-meta">
                                            <span>Edge Cases & Race Conditions</span>
                                            <strong>82% (4/5 Cases)</strong>
                                        </div>
                                        <div className="tn-cov-track"><div className="tn-cov-fill" style={{ width: '82%' }} /></div>
                                    </div>
                                </div>

                                <div className="tn-coverage-gap-card">
                                    <div className="tn-gap-header">
                                        <AlertTriangle size={15} className="text-amber" />
                                        <strong>1 Identified Coverage Gap</strong>
                                    </div>
                                    <p>Multi-IP distributed rate limiting lacks boundary assertion test case. Recommended: add distributed burst load scenario.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 4: RISKS VIEW ─── */}
                    {activeTab === 'risks' && (
                        <div className="tn-preview-body tn-preview-body--risks">
                            <div className="tn-risks-dashboard">
                                <div className="tn-risks-header-row">
                                    <div>
                                        <h3>Security & Business Logic Risks</h3>
                                        <p>Critical failure points mapped to test verification cases</p>
                                    </div>
                                    <div className="tn-risks-count-pills">
                                        <span className="tn-risk-pill tn-risk-pill--high">3 High</span>
                                        <span className="tn-risk-pill tn-risk-pill--med">7 Medium</span>
                                        <span className="tn-risk-pill tn-risk-pill--low">12 Low</span>
                                    </div>
                                </div>

                                <div className="tn-risks-cards-grid">
                                    <div className="tn-risk-spec-card tn-risk-spec-card--high">
                                        <div className="tn-risk-spec-card__top">
                                            <span className="tn-badge-risk-high">HIGH RISK</span>
                                            <button
                                                type="button"
                                                className="tn-link-to-tc"
                                                onClick={() => { setSelectedTcId('TC-003'); setActiveTab('tests'); }}
                                            >
                                                Linked: TC-003 &rarr;
                                            </button>
                                        </div>
                                        <h4>Expired Reset Token Invalidation Gap</h4>
                                        <p className="tn-risk-cause"><strong>Cause:</strong> Tokens remaining valid past 15-minute TTL allow account takeover if email is intercepted.</p>
                                        <p className="tn-risk-mitigation"><strong>Mitigation:</strong> Enforce strict server-side timestamp validation with automated database expiration.</p>
                                    </div>

                                    <div className="tn-risk-spec-card tn-risk-spec-card--high">
                                        <div className="tn-risk-spec-card__top">
                                            <span className="tn-badge-risk-high">HIGH RISK</span>
                                            <button
                                                type="button"
                                                className="tn-link-to-tc"
                                                onClick={() => { setSelectedTcId('TC-004'); setActiveTab('tests'); }}
                                            >
                                                Linked: TC-004 &rarr;
                                            </button>
                                        </div>
                                        <h4>Mailbox Flooding & Denial of Service</h4>
                                        <p className="tn-risk-cause"><strong>Cause:</strong> Missing rate limiting allows attackers to exhaust mail provider API quotas and harass users.</p>
                                        <p className="tn-risk-mitigation"><strong>Mitigation:</strong> Enforce IP and user-account rate limiting (5 req/min) returning HTTP 429.</p>
                                    </div>

                                    <div className="tn-risk-spec-card tn-risk-spec-card--med">
                                        <div className="tn-risk-spec-card__top">
                                            <span className="tn-badge-risk-med">MEDIUM RISK</span>
                                            <button
                                                type="button"
                                                className="tn-link-to-tc"
                                                onClick={() => { setSelectedTcId('TC-005'); setActiveTab('tests'); }}
                                            >
                                                Linked: TC-005 &rarr;
                                            </button>
                                        </div>
                                        <h4>Account Enumeration via Timing Variance</h4>
                                        <p className="tn-risk-cause"><strong>Cause:</strong> Rapid rejection for non-existent emails enables automated email scraping attacks.</p>
                                        <p className="tn-risk-mitigation"><strong>Mitigation:</strong> Normalize response latency using constant-time hashing dummy delays.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 5: TRACEABILITY VIEW ─── */}
                    {activeTab === 'traceability' && (
                        <div className="tn-preview-body tn-preview-body--trace">
                            <div className="tn-trace-dashboard">
                                <div className="tn-trace-header-row">
                                    <div>
                                        <h3>Bidirectional Traceability Tree</h3>
                                        <p>Every generated test case remains strictly connected to REQ-142</p>
                                    </div>
                                    <span className="tn-pill-accent">Full Lineage Certified</span>
                                </div>

                                <div className="tn-trace-tree-container">
                                    {/* Root Node */}
                                    <div className="tn-tree-root">
                                        <div className="tn-tree-root__box">
                                            <span className="tn-tag-req">REQ-142</span>
                                            <strong>Password Reset Specification</strong>
                                            <span className="tn-tree-badge">Source Requirement</span>
                                        </div>

                                        {/* Branches */}
                                        <div className="tn-tree-branches">
                                            {REQ_142_TESTS.map((tc) => (
                                                <div
                                                    key={tc.id}
                                                    className="tn-tree-leaf"
                                                    onClick={() => { setSelectedTcId(tc.id); setActiveTab('tests'); }}
                                                >
                                                    <div className="tn-leaf-line" aria-hidden="true" />
                                                    <div className="tn-leaf-card">
                                                        <span className="tn-id-cell">{tc.id}</span>
                                                        <span className="tn-leaf-title">{tc.title}</span>
                                                        <span className={`tn-chip tn-chip--${tc.type.toLowerCase().replace(/\s+/g, '')}`}>{tc.type}</span>
                                                        <span className={`tn-prio tn-prio--${tc.priority.toLowerCase()}`}>{tc.priority}</span>
                                                        <span className="tn-leaf-link">Inspect &rarr;</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default ProductPreview;
