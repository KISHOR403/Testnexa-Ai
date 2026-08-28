import React, { useCallback, useMemo, useState } from 'react';
import {
    ArrowRight,
    Play,
    Search,
    Download,
    Share2,
    RefreshCw,
    CheckSquare,
    AlertTriangle,
    Shield,
    GitBranch,
    FileText,
    Copy,
    ExternalLink,
    Filter,
    Check,
    Lock,
    Clock,
    Terminal,
    ChevronRight,
    Layers,
    ListFilter
} from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

// Realistic QA Test Suite Demo Data
const DEMO_TEST_CASES = [
    {
        id: 'TC-001',
        title: 'Reset password with valid registered email',
        scenario: 'Verify standard password recovery email dispatch',
        type: 'Functional',
        priority: 'High',
        severity: 'Critical',
        status: 'Ready',
        reqId: 'REQ-001',
        preconditions: 'User account exists with verified email address (active in DB).',
        steps: [
            { num: '01', action: 'Navigate to /forgot-password and input valid registered email.', expected: 'Input accepted; Submit button enabled.' },
            { num: '02', action: 'Click "Send Reset Instructions".', expected: 'HTTP 200 returned; generic success confirmation shown; reset token generated.' },
            { num: '03', action: 'Inspect email dispatch queue for generated token URL.', expected: 'Email received within 10s containing one-time cryptographically secure link.' }
        ],
        expectedResult: 'System sends single-use reset link and displays standard confirmation without disclosing user existence.',
        testData: 'email: "alex.qa@company.internal", method: "POST /api/auth/forgot-password"'
    },
    {
        id: 'TC-002',
        title: 'Reset password with invalid email format',
        scenario: 'Validate client & server RFC 5322 compliance',
        type: 'Negative',
        priority: 'High',
        severity: 'Major',
        status: 'Ready',
        reqId: 'REQ-001',
        preconditions: 'Password recovery form is accessible in browser.',
        steps: [
            { num: '01', action: 'Input malformed email strings: "user@", "user@.com", "user@domain..com".', expected: 'Inline client validation blocks submission with "Enter a valid email address".' },
            { num: '02', action: 'Attempt direct API POST with invalid email body.', expected: 'HTTP 422 Unprocessable Entity returned with structured validation schema error.' }
        ],
        expectedResult: 'System rejects malformed email strings at both client UI and API gateway with clear error feedback.',
        testData: 'payload: { email: "malformed@invalid..com" }'
    },
    {
        id: 'TC-003',
        title: 'Submit empty or whitespace email payload',
        scenario: 'Ensure required field constraints are strictly enforced',
        type: 'Validation',
        priority: 'Medium',
        severity: 'Minor',
        status: 'Ready',
        reqId: 'REQ-001',
        preconditions: 'User on forgot-password page.',
        steps: [
            { num: '01', action: 'Leave email input completely empty and click Submit.', expected: 'Submit button prevented or validation error "Email is required" displayed.' },
            { num: '02', action: 'Input 5 whitespace characters "     " and click Submit.', expected: 'Input trimmed; validation error "Email is required" displayed.' }
        ],
        expectedResult: 'Form enforces non-empty trimmed email constraint and prevents empty API request dispatch.',
        testData: 'input: "     "'
    },
    {
        id: 'TC-004',
        title: 'Use expired reset link beyond TTL',
        scenario: 'Verify token expiration window strictly blocks credential update',
        type: 'Edge Case',
        priority: 'High',
        severity: 'Critical',
        status: 'Ready',
        reqId: 'REQ-001',
        preconditions: 'A previously generated reset token exists and has exceeded the 15-minute TTL window.',
        steps: [
            { num: '01', action: 'Open password reset URL with expired token parameter.', expected: 'Token validation triggered during page mount.' },
            { num: '02', action: 'Submit new compliant password in input fields.', expected: 'HTTP 400 Bad Request returned with error code "TOKEN_EXPIRED".' }
        ],
        expectedResult: 'System gracefully rejects expired token, leaves original credentials intact, and offers link to request a fresh token.',
        testData: 'token: "exp_tok_982734", expiresAt: "2026-08-28T10:00:00Z"'
    },
    {
        id: 'TC-005',
        title: 'Reuse previously consumed reset token',
        scenario: 'Prevent replay attacks by enforcing one-time nonce invalidation',
        type: 'Security',
        priority: 'High',
        severity: 'Critical',
        status: 'Ready',
        reqId: 'REQ-001',
        preconditions: 'Reset token was already successfully redeemed in a prior session.',
        steps: [
            { num: '01', action: 'Attempt to reuse consumed token to submit a second password update.', expected: 'Database checks nonce state; finds token marked as USED.' },
            { num: '02', action: 'Inspect security audit log.', expected: 'Security alert logged for duplicate token redemption attempt; request terminated.' }
        ],
        expectedResult: 'Single-use cryptographic nonce cannot be reused under any circumstance, preventing token replay attacks.',
        testData: 'token: "consumed_tok_33421", status: "REDEEMED"'
    }
];

const COVERAGE_ITEMS = [
    { req: 'REQ-001', label: 'Password Reset Core Flow', coverage: 94, tests: 8, status: 'Optimal' },
    { req: 'REQ-002', label: 'Email Format & Domain Validation', coverage: 88, tests: 5, status: 'Good' },
    { req: 'REQ-003', label: 'Token Expiration & Invalidation', coverage: 100, tests: 4, status: 'Complete' },
    { req: 'REQ-004', label: 'Rate Limiting & Anti-Enumeration', coverage: 92, tests: 3, status: 'Optimal' }
];

const RISK_ITEMS = [
    { level: 'High', title: 'Expired Token Invalidation Gap', category: 'Security', linkedTc: 'TC-004', desc: 'Failure to enforce server-side expiration allows indefinite password reset window.' },
    { level: 'High', title: 'Token Replay / Nonce Reuse', category: 'Security', linkedTc: 'TC-005', desc: 'Tokens not invalidated immediately after first successful consumption expose replay vulnerability.' },
    { level: 'Medium', title: 'Email Address Enumeration Timing', category: 'Privacy', linkedTc: 'TC-001', desc: 'Different response times for existing vs non-existing emails expose user directory.' }
];

const TRACE_ITEMS = [
    {
        reqId: 'REQ-001',
        title: 'User Password Recovery',
        children: ['TC-001: Valid email dispatch', 'TC-002: Malformed email rejection', 'TC-003: Empty input validation', 'TC-004: Expired link handling', 'TC-005: Replay token rejection']
    }
];

export const ProductWorkbench = ({ compact = false }) => {
    const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'coverage' | 'risks' | 'traceability'
    const [selectedTcId, setSelectedTcId] = useState('TC-004');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [selectedRows, setSelectedRows] = useState(['TC-001', 'TC-002', 'TC-003', 'TC-004', 'TC-005']);
    const [copied, setCopied] = useState(false);

    const selectedTc = useMemo(() => {
        return DEMO_TEST_CASES.find(tc => tc.id === selectedTcId) || DEMO_TEST_CASES[3];
    }, [selectedTcId]);

    const filteredTests = useMemo(() => {
        return DEMO_TEST_CASES.filter(tc => {
            const matchesSearch = tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tc.scenario.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === 'All' || tc.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [searchQuery, typeFilter]);

    const toggleRowSelect = (id) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    };

    const handleCopy = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`tn-app-workspace ${compact ? 'tn-app-workspace--compact' : ''}`}>
            {/* ─── Product Workspace Header ─── */}
            <div className="tn-app-header">
                <div className="tn-app-header__identity">
                    <div className="tn-app-header__breadcrumbs">
                        <span className="tn-app-crumb-root">Test Suite</span>
                        <ChevronRight size={14} className="tn-app-crumb-sep" />
                        <span className="tn-app-crumb-active">Password Reset Suite</span>
                    </div>
                    <div className="tn-app-header__tags">
                        <span className="tn-tag tn-tag--req">REQ-001</span>
                        <span className="tn-tag tn-tag--ready">Ready for Execution</span>
                    </div>
                </div>

                <div className="tn-app-header__actions">
                    <button className="tn-app-btn tn-app-btn--secondary" onClick={handleCopy}>
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span>{copied ? 'Copied' : 'Share'}</span>
                    </button>
                    <button className="tn-app-btn tn-app-btn--secondary">
                        <Download size={14} />
                        <span>Export</span>
                    </button>
                    <button className="tn-app-btn tn-app-btn--primary">
                        <RefreshCw size={14} />
                        <span>Regenerate</span>
                    </button>
                </div>
            </div>

            {/* ─── Compact Summary Metrics Row ─── */}
            <div className="tn-app-summary-bar">
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num">18</span>
                    <span className="tn-app-stat__label">Test Cases</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--cyan">94%</span>
                    <span className="tn-app-stat__label">Req Coverage</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--amber">6</span>
                    <span className="tn-app-stat__label">High Priority</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num">4</span>
                    <span className="tn-app-stat__label">Edge Cases</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--emerald">0</span>
                    <span className="tn-app-stat__label">Ambiguity Flags</span>
                </div>
            </div>

            {/* ─── Application Navigation Tabs ─── */}
            <div className="tn-app-tabs">
                <button
                    className={`tn-app-tab ${activeTab === 'tests' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('tests')}
                >
                    <FileText size={15} />
                    <span>Test Cases</span>
                    <span className="tn-app-tab__badge">18</span>
                </button>
                <button
                    className={`tn-app-tab ${activeTab === 'coverage' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('coverage')}
                >
                    <Layers size={15} />
                    <span>Coverage</span>
                    <span className="tn-app-tab__badge">94%</span>
                </button>
                <button
                    className={`tn-app-tab ${activeTab === 'risks' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('risks')}
                >
                    <Shield size={15} />
                    <span>Risks</span>
                    <span className="tn-app-tab__badge tn-app-tab__badge--alert">3</span>
                </button>
                <button
                    className={`tn-app-tab ${activeTab === 'traceability' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('traceability')}
                >
                    <GitBranch size={15} />
                    <span>Traceability</span>
                </button>
            </div>

            {/* ─── Main Viewport Area ─── */}
            <div className="tn-app-viewport">
                {activeTab === 'tests' && (
                    <div className="tn-app-tests-view">
                        {/* Compact Toolbar */}
                        <div className="tn-app-toolbar">
                            <div className="tn-app-toolbar__left">
                                <div className="tn-app-search">
                                    <Search size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search test cases by ID, title, or scenario..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="tn-app-filter-pills">
                                    {['All', 'Functional', 'Negative', 'Edge Case', 'Security'].map((t) => (
                                        <button
                                            key={t}
                                            className={`tn-filter-pill ${typeFilter === t ? 'is-active' : ''}`}
                                            onClick={() => setTypeFilter(t)}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="tn-app-toolbar__right">
                                <span className="tn-app-count-label">{filteredTests.length} tests displayed</span>
                            </div>
                        </div>

                        {/* Master-Detail Split Workspace */}
                        <div className="tn-app-split-workspace">
                            {/* Left: Test Case Table */}
                            <div className="tn-app-table-pane">
                                <table className="tn-qa-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '36px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRows.length === DEMO_TEST_CASES.length}
                                                    onChange={() => setSelectedRows(selectedRows.length === DEMO_TEST_CASES.length ? [] : DEMO_TEST_CASES.map(t => t.id))}
                                                />
                                            </th>
                                            <th style={{ width: '84px' }}>ID</th>
                                            <th>Test Scenario & Title</th>
                                            <th style={{ width: '100px' }}>Type</th>
                                            <th style={{ width: '90px' }}>Priority</th>
                                            <th style={{ width: '80px' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTests.map((tc) => {
                                            const isSelected = selectedTcId === tc.id;
                                            const isChecked = selectedRows.includes(tc.id);
                                            return (
                                                <tr
                                                    key={tc.id}
                                                    className={`tn-qa-row ${isSelected ? 'is-selected' : ''}`}
                                                    onClick={() => setSelectedTcId(tc.id)}
                                                >
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleRowSelect(tc.id)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <span className="tn-tc-id">{tc.id}</span>
                                                    </td>
                                                    <td>
                                                        <div className="tn-tc-title-cell">
                                                            <strong>{tc.title}</strong>
                                                            <span>{tc.scenario}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`tn-type-tag tn-type-tag--${tc.type.toLowerCase().replace(/\s+/g, '')}`}>
                                                            {tc.type}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`tn-prio-tag tn-prio-tag--${tc.priority.toLowerCase()}`}>
                                                            {tc.priority}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="tn-status-pill">
                                                            <span className="tn-status-dot" />
                                                            {tc.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Right: Test Case Detail Panel */}
                            <div className="tn-app-detail-pane">
                                <div className="tn-detail-header">
                                    <div>
                                        <div className="tn-detail-meta-top">
                                            <span className="tn-tc-id-lg">{selectedTc.id}</span>
                                            <span className="tn-detail-req">{selectedTc.reqId}</span>
                                            <span className="tn-status-pill tn-status-pill--ready">
                                                <span className="tn-status-dot" /> Ready
                                            </span>
                                        </div>
                                        <h4 className="tn-detail-title">{selectedTc.title}</h4>
                                    </div>
                                    <div className="tn-detail-quick-actions">
                                        <button className="tn-btn-icon" title="Copy Test Case"><Copy size={14} /></button>
                                        <button className="tn-btn-icon" title="External Export"><ExternalLink size={14} /></button>
                                    </div>
                                </div>

                                <div className="tn-detail-badges-row">
                                    <div>
                                        <label>TYPE</label>
                                        <span className="tn-badge-value">{selectedTc.type}</span>
                                    </div>
                                    <div>
                                        <label>PRIORITY</label>
                                        <span className="tn-badge-value text-amber-400">{selectedTc.priority}</span>
                                    </div>
                                    <div>
                                        <label>SEVERITY</label>
                                        <span className="tn-badge-value">{selectedTc.severity}</span>
                                    </div>
                                    <div>
                                        <label>TRACEABILITY</label>
                                        <span className="tn-badge-value text-teal-400">{selectedTc.reqId}</span>
                                    </div>
                                </div>

                                <div className="tn-detail-body">
                                    <div className="tn-detail-section">
                                        <h5>PRECONDITIONS</h5>
                                        <p>{selectedTc.preconditions}</p>
                                    </div>

                                    <div className="tn-detail-section">
                                        <h5>TEST STEPS</h5>
                                        <div className="tn-detail-steps">
                                            {selectedTc.steps.map((st) => (
                                                <div key={st.num} className="tn-step-item">
                                                    <span className="tn-step-num">{st.num}</span>
                                                    <div className="tn-step-content">
                                                        <p className="tn-step-action"><strong>Action:</strong> {st.action}</p>
                                                        <p className="tn-step-expected"><strong>Expected:</strong> {st.expected}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="tn-detail-section">
                                        <h5>EXPECTED RESULT</h5>
                                        <div className="tn-expected-box">
                                            <CheckSquare size={15} className="text-teal-400 shrink-0" />
                                            <p>{selectedTc.expectedResult}</p>
                                        </div>
                                    </div>

                                    <div className="tn-detail-section">
                                        <h5>TEST PARAMETERS</h5>
                                        <div className="tn-data-snippet">
                                            <code>{selectedTc.testData}</code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'coverage' && (
                    <div className="tn-app-coverage-view">
                        <div className="tn-coverage-header">
                            <div>
                                <h4>Requirement Coverage Matrix</h4>
                                <p>Systematic verification status mapped to specification requirements.</p>
                            </div>
                            <span className="tn-coverage-overall-badge">94% Total Verified</span>
                        </div>
                        <div className="tn-coverage-list">
                            {COVERAGE_ITEMS.map((item) => (
                                <div key={item.req} className="tn-coverage-row">
                                    <div className="tn-coverage-row__meta">
                                        <span className="tn-tc-id">{item.req}</span>
                                        <strong>{item.label}</strong>
                                        <span className="tn-coverage-count">{item.tests} Test Cases</span>
                                    </div>
                                    <div className="tn-coverage-row__bar-wrap">
                                        <div className="tn-coverage-bar">
                                            <div className="tn-coverage-bar__fill" style={{ width: `${item.coverage}%` }} />
                                        </div>
                                        <span className="tn-coverage-pct">{item.coverage}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'risks' && (
                    <div className="tn-app-risks-view">
                        <div className="tn-risks-header">
                            <div>
                                <h4>Identified Security & Logic Risks</h4>
                                <p>Critical boundary gaps flagged by AI requirement intelligence.</p>
                            </div>
                        </div>
                        <div className="tn-risks-grid">
                            {RISK_ITEMS.map((risk, idx) => (
                                <div key={idx} className={`tn-risk-card tn-risk-card--${risk.level.toLowerCase()}`}>
                                    <div className="tn-risk-card__top">
                                        <span className={`tn-risk-badge tn-risk-badge--${risk.level.toLowerCase()}`}>
                                            {risk.level} Risk
                                        </span>
                                        <span className="tn-risk-cat">{risk.category}</span>
                                        <span className="tn-risk-linked">Linked: {risk.linkedTc}</span>
                                    </div>
                                    <h5>{risk.title}</h5>
                                    <p>{risk.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'traceability' && (
                    <div className="tn-app-trace-view">
                        <div className="tn-trace-header">
                            <h4>Requirement &rarr; Generated Test Tree</h4>
                            <p>End-to-end traceability graph from raw product requirement to verification test suite.</p>
                        </div>
                        <div className="tn-trace-tree">
                            {TRACE_ITEMS.map((trace) => (
                                <div key={trace.reqId} className="tn-trace-root">
                                    <div className="tn-trace-root__node">
                                        <span className="tn-tc-id">{trace.reqId}</span>
                                        <strong>{trace.title}</strong>
                                        <span className="tn-trace-status">Source Requirement</span>
                                    </div>
                                    <div className="tn-trace-branches">
                                        {trace.children.map((child, i) => (
                                            <div key={i} className="tn-trace-leaf">
                                                <span className="tn-trace-leaf__connector" />
                                                <code>{child}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const Hero = () => {
    const headerReveal = useScrollReveal({ threshold: 0.1 });
    const demoReveal = useScrollReveal({ threshold: 0.05 });

    const scrollToSection = useCallback((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const y = el.getBoundingClientRect().top + window.pageYOffset - 96;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }, []);

    return (
        <section className="tn-hero" aria-labelledby="hero-heading">
            <div className="tn-hero__glow" aria-hidden="true" />
            <div className="tn-container tn-hero__inner">
                <div
                    ref={headerReveal.ref}
                    className={`tn-hero__text scroll-reveal-fade-up ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    <div className="tn-eyebrow">Enterprise Test Management Workspace</div>
                    <h1 id="hero-heading" className="tn-hero__headline">
                        Turn Requirements Into <span>Production-Ready</span> Test Suites.
                    </h1>
                    <p className="tn-hero__subtext">
                        Transform ambiguous product requirements into structured, high-confidence test suites
                        with automated edge cases, risk analysis, and full requirement traceability.
                    </p>
                    <div className="tn-hero__ctas">
                        <a href="/login" className="tn-btn tn-btn--primary tn-btn--lg">
                            Generate Test Suite
                            <ArrowRight size={18} />
                        </a>
                        <button className="tn-btn tn-btn--secondary tn-btn--lg" onClick={() => scrollToSection('engineering-maturity')}>
                            <Play size={17} />
                            See How It Works
                        </button>
                    </div>
                </div>

                <div
                    ref={demoReveal.ref}
                    className={`tn-hero__demo-wrap scroll-reveal-fade-up ${demoReveal.isVisible ? 'revealed' : ''}`}
                >
                    <ProductWorkbench />
                </div>
            </div>
        </section>
    );
};

export default Hero;
