import React, { useState, useEffect, useRef } from 'react';
import {
    CheckCircle2,
    AlertCircle,
    FileText,
    Terminal,
    GitBranch,
    Shield,
    ArrowRight,
    RefreshCw,
    Download,
    Check,
    Layers,
    Search,
    ExternalLink
} from 'lucide-react';

const WORKSPACE_TABS = [
    { id: 'requirement', label: 'Requirement', stateIndex: 0 },
    { id: 'analysis', label: 'Analysis', badge: '3 risks', stateIndex: 1 },
    { id: 'test-cases', label: 'Test Cases', badge: '24 cases', stateIndex: 2 },
    { id: 'coverage', label: 'Coverage', badge: '87%', stateIndex: 3 },
    { id: 'traceability', label: 'Traceability', badge: '24/24', stateIndex: 4 }
];

const TEST_CASES_DATA = [
    {
        id: 'TC-FUNC-001',
        title: 'Valid password reset submission',
        type: 'Functional',
        typeClass: 'is-func',
        assertion: 'Status 200 OK • Invalidate existing active sessions',
        status: 'Pass'
    },
    {
        id: 'TC-FUNC-002',
        title: 'Registered email verification dispatch',
        type: 'Functional',
        typeClass: 'is-func',
        assertion: 'SMTP payload dispatched with 15m single-use token',
        status: 'Pass'
    },
    {
        id: 'TC-NEG-004',
        title: 'Expired reset token redemption replay',
        type: 'Negative',
        typeClass: 'is-neg',
        assertion: 'Reject token > 15m • Return 401 TOKEN_EXPIRED',
        status: 'Pass'
    },
    {
        id: 'TC-SEC-002',
        title: 'Rate limit reset requests (> 5 per hour)',
        type: 'Security',
        typeClass: 'is-sec',
        assertion: 'Enforce IP + email throttle • Return 429 TOO_MANY_REQUESTS',
        status: 'Review'
    },
    {
        id: 'TC-EDGE-003',
        title: 'RFC 5322 internationalized email boundary',
        type: 'Edge',
        typeClass: 'is-edge',
        assertion: 'Strict syntax parse • Sanitize injection vector payloads',
        status: 'Pass'
    }
];

export const EnterpriseWorkflowChapter = () => {
    // Pipeline states: 0: Req, 1: Analysis, 2: Test cases, 3: Coverage, 4: Traceability, 5: Export ready
    const [pipelineStep, setPipelineStep] = useState(0);
    const [coverageDisplay, setCoverageDisplay] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
    const [selectedTab, setSelectedTab] = useState('requirement');
    const [copiedExport, setCopiedExport] = useState(null);
    const sectionRef = useRef(null);

    // Scroll entry observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setHasEnteredViewport(true);
                }
            },
            { threshold: 0.2 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Progressive pipeline evolution
    useEffect(() => {
        if (!hasEnteredViewport || !isAutoPlaying) return;

        const interval = setInterval(() => {
            setPipelineStep((prev) => {
                if (prev < 5) return prev + 1;
                return 5; // Hold at completed state
            });
        }, 1600);

        return () => clearInterval(interval);
    }, [hasEnteredViewport, isAutoPlaying]);

    // Animate coverage percentage according to step
    useEffect(() => {
        if (pipelineStep < 2) {
            setCoverageDisplay(0);
        } else if (pipelineStep === 2) {
            setCoverageDisplay(52);
        } else if (pipelineStep >= 3) {
            setCoverageDisplay(87);
        }

        // Sync active tab label
        if (pipelineStep === 0) setSelectedTab('requirement');
        else if (pipelineStep === 1) setSelectedTab('analysis');
        else if (pipelineStep === 2) setSelectedTab('test-cases');
        else if (pipelineStep === 3) setSelectedTab('coverage');
        else if (pipelineStep >= 4) setSelectedTab('traceability');
    }, [pipelineStep]);

    const handleTabClick = (tabId, stateIndex) => {
        setIsAutoPlaying(false);
        setSelectedTab(tabId);
        setPipelineStep(stateIndex);
    };

    const handleReplay = () => {
        setPipelineStep(0);
        setCoverageDisplay(0);
        setSelectedTab('requirement');
        setIsAutoPlaying(true);
    };

    const handleExportClick = (target) => {
        setCopiedExport(target);
        setTimeout(() => setCopiedExport(null), 2000);
    };

    return (
        <section
            id="solutions"
            ref={sectionRef}
            className="tn-section tn-workspace-section"
            aria-labelledby="workflow-workspace-heading"
        >
            <div className="tn-container">
                {/* ─── 1. SECTION INTRO (Asymmetric Editorial Layout) ─── */}
                <div className="tn-ws-intro-header">
                    <div className="tn-ws-intro-left">
                        <span className="tn-ws-eyebrow">FROM REQUIREMENT TO RELEASE</span>
                        <h2 id="workflow-workspace-heading" className="tn-ws-title">
                            A complete QA workflow,<br />
                            not just a test generator.
                        </h2>
                        <p className="tn-ws-subtitle">
                            From raw requirements to structured test cases, coverage, risk analysis and traceability — all in one engineering workflow.
                        </p>
                    </div>

                    <div className="tn-ws-intro-right">
                        <div className="tn-ws-status-meta">
                            <span className="tn-ws-meta-tag">WORKSPACE</span>
                            <span className="tn-ws-meta-id">REQ-142</span>
                            <span className="tn-ws-meta-name">Password Reset</span>
                            <div className="tn-ws-meta-runtime">
                                <span className="tn-ws-status-dot" />
                                <span>Engine Active</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── 2. MAIN VISUAL: REAL PRODUCT WORKSPACE ─── */}
                <div className="tn-product-workspace" role="region" aria-label="TestNexa Product Workspace">
                    {/* Top Application Bar */}
                    <div className="tn-ws-app-bar">
                        <div className="tn-ws-breadcrumb-group">
                            <span className="tn-ws-brand-mark">TestNexa</span>
                            <span className="tn-ws-crumb-sep">/</span>
                            <span className="tn-ws-crumb-id">REQ-142</span>
                            <span className="tn-ws-crumb-sep">/</span>
                            <span className="tn-ws-crumb-title">Password Reset</span>
                            <span className="tn-ws-status-pill">Needs Review</span>
                            <span className="tn-ws-time-tag">Updated 2 min ago</span>
                        </div>

                        {/* Live Quality Signal (Application-level metrics) */}
                        <div className="tn-ws-quality-signal" aria-label="Live Quality Signals">
                            <div className="tn-ws-qstat">
                                <span className="tn-ws-qstat-val">{coverageDisplay}%</span>
                                <span className="tn-ws-qstat-lbl">Requirement coverage</span>
                            </div>
                            <div className="tn-ws-qstat-divider" />
                            <div className="tn-ws-qstat">
                                <span className="tn-ws-qstat-val">3</span>
                                <span className="tn-ws-qstat-lbl">Risk signals</span>
                            </div>
                            <div className="tn-ws-qstat-divider" />
                            <div className="tn-ws-qstat">
                                <span className="tn-ws-qstat-val">
                                    {pipelineStep >= 4 ? '24/24' : pipelineStep >= 2 ? '12/24' : '0/24'}
                                </span>
                                <span className="tn-ws-qstat-lbl">Requirements traced</span>
                            </div>
                        </div>
                    </div>

                    {/* Utility Navigation Tabs */}
                    <div className="tn-ws-tabs-bar">
                        <div className="tn-ws-tabs-list" role="tablist">
                            {WORKSPACE_TABS.map((tab) => {
                                const isActive = selectedTab === tab.id;
                                const isPassed = pipelineStep >= tab.stateIndex;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        className={`tn-ws-tab-btn ${isActive ? 'is-active' : ''} ${isPassed ? 'is-passed' : ''}`}
                                        onClick={() => handleTabClick(tab.id, tab.stateIndex)}
                                    >
                                        <span>{tab.label}</span>
                                        {tab.badge && (
                                            <span className="tn-ws-tab-badge">{tab.badge}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="tn-ws-timeline-control">
                            <span className="tn-ws-pipeline-indicator">
                                <span className={`tn-ws-live-pulse ${pipelineStep < 5 ? 'is-running' : ''}`} />
                                {pipelineStep === 0 && 'Ingesting Requirement'}
                                {pipelineStep === 1 && 'Decomposing Ambiguities'}
                                {pipelineStep === 2 && 'Synthesizing Test Scenarios'}
                                {pipelineStep === 3 && 'Auditing Clause Coverage'}
                                {pipelineStep === 4 && 'Locking Lineage Traceability'}
                                {pipelineStep >= 5 && 'Workflow Release Ready'}
                            </span>
                            <button
                                type="button"
                                className="tn-ws-replay-btn"
                                onClick={handleReplay}
                                title="Replay workflow execution"
                                aria-label="Replay workflow execution"
                            >
                                <RefreshCw className="tn-ws-replay-icon" size={12} />
                                <span>Replay</span>
                            </button>
                        </div>
                    </div>

                    {/* Workspace Core Area: Multi-panel Split */}
                    <div className="tn-ws-canvas">
                        {/* LEFT / MAIN COLUMN */}
                        <div className="tn-ws-col tn-ws-col-left">
                            {/* Requirement Specification Panel */}
                            <div className="tn-ws-panel tn-ws-panel-req">
                                <div className="tn-ws-panel-head">
                                    <span className="tn-ws-panel-tag">REQUIREMENT SPECIFICATION</span>
                                    <span className="tn-ws-doc-ref">DOC-AUTH-2026</span>
                                </div>
                                <div className="tn-ws-req-quote">
                                    <p>“Users can reset their password using their registered email address.”</p>
                                </div>
                                <div className="tn-ws-criteria-list">
                                    <div className="tn-ws-crit-item">
                                        <span className="tn-ws-crit-key">AC-1</span>
                                        <span>Token dispatched to verified email only; TTL restricted to 15 minutes.</span>
                                    </div>
                                    <div className="tn-ws-crit-item">
                                        <span className="tn-ws-crit-key">AC-2</span>
                                        <span>Invalidate all existing session tokens immediately upon successful reset.</span>
                                    </div>
                                    <div className="tn-ws-crit-item">
                                        <span className="tn-ws-crit-key">AC-3</span>
                                        <span>Rate limit requests to 5 attempts/hour per originating IP and account.</span>
                                    </div>
                                </div>
                            </div>

                            {/* AI Analysis Panel */}
                            <div className={`tn-ws-panel tn-ws-panel-analysis ${pipelineStep >= 1 ? 'is-revealed' : 'is-dimmed'}`}>
                                <div className="tn-ws-panel-head">
                                    <span className="tn-ws-panel-tag">AI ANALYSIS</span>
                                    <span className="tn-ws-analysis-badge">Deterministic Decomp</span>
                                </div>

                                <div className="tn-ws-analysis-content">
                                    <div className="tn-ws-intent-row">
                                        <span className="tn-ws-sub-label">INTENT</span>
                                        <span className="tn-ws-intent-val">Password recovery & credential lifecycle validation</span>
                                    </div>

                                    <div className="tn-ws-analysis-split">
                                        <div className="tn-ws-cond-block">
                                            <span className="tn-ws-sub-label">DETECTED CONDITIONS</span>
                                            <ul className="tn-ws-bullet-list">
                                                <li>• registered email address</li>
                                                <li>• one-time cryptographic reset token</li>
                                                <li>• 15-minute expiry window</li>
                                                <li>• active session revocation</li>
                                            </ul>
                                        </div>

                                        <div className="tn-ws-risks-block">
                                            <span className="tn-ws-sub-label">POTENTIAL RISKS</span>
                                            <ul className="tn-ws-bullet-list tn-ws-risks-list">
                                                <li>
                                                    <span className="tn-ws-risk-dot is-amber" />
                                                    <span>expired token redemption replay</span>
                                                </li>
                                                <li>
                                                    <span className="tn-ws-risk-dot is-red" />
                                                    <span>repeated requests (enumeration abuse)</span>
                                                </li>
                                                <li>
                                                    <span className="tn-ws-risk-dot is-amber" />
                                                    <span>invalid RFC 5322 email string handling</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="tn-ws-col tn-ws-col-right">
                            {/* Test Suite Table Panel */}
                            <div className={`tn-ws-panel tn-ws-panel-suite ${pipelineStep >= 2 ? 'is-revealed' : 'is-dimmed'}`}>
                                <div className="tn-ws-panel-head">
                                    <div className="tn-ws-suite-title-group">
                                        <span className="tn-ws-panel-tag">TEST SUITE</span>
                                        <span className="tn-ws-count-badge">24 test cases</span>
                                    </div>
                                    <div className="tn-ws-suite-breakdown">
                                        <span className="tn-ws-type-pill is-func">Functional 12</span>
                                        <span className="tn-ws-type-pill is-neg">Negative 7</span>
                                        <span className="tn-ws-type-pill is-sec">Security 5</span>
                                    </div>
                                </div>

                                {/* Table Rows */}
                                <div className="tn-ws-table-wrap">
                                    <table className="tn-ws-table">
                                        <thead>
                                            <tr>
                                                <th className="th-id">ID</th>
                                                <th className="th-desc">SCENARIO & ASSERTION</th>
                                                <th className="th-type">TYPE</th>
                                                <th className="th-status">STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {TEST_CASES_DATA.map((tc, idx) => {
                                                const isRowVisible = pipelineStep >= 2;
                                                return (
                                                    <tr
                                                        key={tc.id}
                                                        className={`tn-ws-tr ${isRowVisible ? 'is-visible' : 'is-hidden'}`}
                                                        style={{ transitionDelay: `${idx * 70}ms` }}
                                                    >
                                                        <td className="td-id">
                                                            <code>{tc.id}</code>
                                                        </td>
                                                        <td className="td-desc">
                                                            <div className="tn-ws-tc-title">{tc.title}</div>
                                                            <div className="tn-ws-tc-assert">{tc.assertion}</div>
                                                        </td>
                                                        <td className="td-type">
                                                            <span className={`tn-ws-type-tag ${tc.typeClass}`}>{tc.type}</span>
                                                        </td>
                                                        <td className="td-status">
                                                            <span className={`tn-ws-status-chip ${tc.status === 'Pass' ? 'is-pass' : 'is-review'}`}>
                                                                {tc.status === 'Pass' ? (
                                                                    <Check className="tn-chip-icon" size={11} />
                                                                ) : (
                                                                    <AlertCircle className="tn-chip-icon" size={11} />
                                                                )}
                                                                {tc.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Traceability Relationship Panel */}
                            <div className={`tn-ws-panel tn-ws-panel-trace ${pipelineStep >= 4 ? 'is-revealed' : 'is-dimmed'}`}>
                                <div className="tn-ws-panel-head">
                                    <span className="tn-ws-panel-tag">TRACEABILITY LINEAGE</span>
                                    <span className="tn-ws-trace-stat">Coverage: 87% • 24 / 24 Linked</span>
                                </div>

                                <div className="tn-ws-trace-tree">
                                    <div className="tn-ws-tree-root">
                                        <span className="tn-ws-tree-root-box">REQ-142</span>
                                    </div>
                                    <div className="tn-ws-tree-branches">
                                        <div className="tn-ws-tree-line" />
                                        <div className="tn-ws-tree-nodes">
                                            <div className="tn-ws-tree-leaf">
                                                <span className="tn-ws-branch-arm">├──</span>
                                                <span className="tn-ws-leaf-id">TC-FUNC-001</span>
                                                <span className="tn-ws-leaf-clause">[AC-1, AC-2]</span>
                                            </div>
                                            <div className="tn-ws-tree-leaf">
                                                <span className="tn-ws-branch-arm">├──</span>
                                                <span className="tn-ws-leaf-id">TC-FUNC-002</span>
                                                <span className="tn-ws-leaf-clause">[AC-1]</span>
                                            </div>
                                            <div className="tn-ws-tree-leaf">
                                                <span className="tn-ws-branch-arm">├──</span>
                                                <span className="tn-ws-leaf-id">TC-NEG-004</span>
                                                <span className="tn-ws-leaf-clause">[AC-1]</span>
                                            </div>
                                            <div className="tn-ws-tree-leaf">
                                                <span className="tn-ws-branch-arm">├──</span>
                                                <span className="tn-ws-leaf-id">TC-SEC-002</span>
                                                <span className="tn-ws-leaf-clause">[AC-3]</span>
                                            </div>
                                            <div className="tn-ws-tree-leaf">
                                                <span className="tn-ws-branch-arm">└──</span>
                                                <span className="tn-ws-leaf-id">TC-EDGE-003</span>
                                                <span className="tn-ws-leaf-clause">[AC-1]</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Workspace Bottom Action / Export Bar */}
                    <div className="tn-ws-bottom-bar">
                        <div className="tn-ws-bottom-left">
                            <span className="tn-ws-bottom-lbl">CI/CD INTEGRATION</span>
                            <span className="tn-ws-bottom-sub">Deterministic assertions compatible with modern test runners</span>
                        </div>

                        <div className="tn-ws-export-group">
                            <span className="tn-ws-export-label">EXPORT:</span>
                            {['Playwright', 'Cypress', 'REST API', 'Jira Software'].map((target) => (
                                <button
                                    key={target}
                                    type="button"
                                    className={`tn-ws-export-btn ${copiedExport === target ? 'is-copied' : ''}`}
                                    onClick={() => handleExportClick(target)}
                                    title={`Export test suite to ${target}`}
                                >
                                    {copiedExport === target ? (
                                        <>
                                            <Check size={12} />
                                            <span>Exported</span>
                                        </>
                                    ) : (
                                        <span>{target}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default EnterpriseWorkflowChapter;
