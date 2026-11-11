import React, { useState } from 'react';
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
    SlidersHorizontal,
    Edit3
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const WORKFLOW_STEPS = [
    {
        num: '01',
        id: 'requirement',
        title: 'Requirement',
        shortDesc: 'Ingest user stories & PRD clauses',
        detail: 'Ingest natural language specifications, PRD clauses, or Jira tickets into normalized specification models.',
        badge: 'DOC-AUTH-2026'
    },
    {
        num: '02',
        id: 'analyze',
        title: 'Analyze',
        shortDesc: 'Implicit risk & boundary flags',
        detail: 'Deconstruct unstated assumptions, RFC email syntax boundaries, and security timing vulnerabilities.',
        badge: '3 Risk Flags'
    },
    {
        num: '03',
        id: 'generate',
        title: 'Generate',
        shortDesc: 'Functional, negative & edge suites',
        detail: 'Synthesize structured, prioritized test cases with atomic execution steps, preconditions, and assertions.',
        badge: '24 Scenarios'
    },
    {
        num: '04',
        id: 'review',
        title: 'Review',
        shortDesc: 'QA engineer inspection & editing',
        detail: 'QA engineers review assertions, edit test steps, and promote status from Needs Review to Approved.',
        badge: 'Interactive Review'
    },
    {
        num: '05',
        id: 'execute',
        title: 'Execute',
        shortDesc: 'Manual workspace & test runs',
        detail: 'Execute tests step-by-step with Pass/Fail/Blocked recording, actual observations, and defect logging.',
        badge: 'Live Run #842'
    },
    {
        num: '06',
        id: 'report',
        title: 'Report',
        shortDesc: 'Traceability & pass-rate analytics',
        detail: 'Audit-ready execution reports with verified requirement coverage, duration deltas, and zero orphan tests.',
        badge: 'Audit Verified'
    }
];

const TEST_CASES_DATA = [
    {
        id: 'TC-FUNC-001',
        title: 'Valid password reset submission',
        type: 'Functional',
        typeClass: 'is-func',
        assertion: 'Status 200 OK • Invalidate existing active sessions',
        status: 'Approved'
    },
    {
        id: 'TC-FUNC-002',
        title: 'Registered email verification dispatch',
        type: 'Functional',
        typeClass: 'is-func',
        assertion: 'SMTP payload dispatched with 15m single-use token',
        status: 'Approved'
    },
    {
        id: 'TC-NEG-004',
        title: 'Expired reset token redemption replay',
        type: 'Negative',
        typeClass: 'is-neg',
        assertion: 'Reject token > 15m • Return 401 TOKEN_EXPIRED',
        status: 'Approved'
    },
    {
        id: 'TC-SEC-002',
        title: 'Rate limit reset requests (> 5 per hour)',
        type: 'Security',
        typeClass: 'is-sec',
        assertion: 'Enforce IP + email throttle • Return 429 TOO_MANY_REQUESTS',
        status: 'Needs Review'
    },
    {
        id: 'TC-EDGE-003',
        title: 'RFC 5322 internationalized email boundary',
        type: 'Edge',
        typeClass: 'is-edge',
        assertion: 'Strict syntax parse • Sanitize injection vector payloads',
        status: 'Approved'
    }
];

export const EnterpriseWorkflowChapter = () => {
    const [activeStepIndex, setActiveStepIndex] = useState(3); // Default on Review & Approval
    const [copiedExport, setCopiedExport] = useState(null);
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const handleExportClick = (target) => {
        setCopiedExport(target);
        setTimeout(() => setCopiedExport(null), 2000);
    };

    const currentStep = WORKFLOW_STEPS[activeStepIndex];

    return (
        <section
            id="workflow"
            className="tn-section tn-workspace-section"
            aria-labelledby="workflow-workspace-heading"
        >
            <div className="tn-container">
                {/* ─── 1. SECTION INTRO ─── */}
                <div className="tn-ws-intro-header">
                    <div className="tn-ws-intro-left">
                        <div className="tn-chapter-eyebrow">
                            <span className="tn-kicker-dot" />
                            <span>END-TO-END QA WORKFLOW</span>
                        </div>
                        <h2 id="workflow-workspace-heading" className="tn-ws-title">
                            A complete QA workflow,<br />
                            not just a test generator.
                        </h2>
                        <p className="tn-ws-subtitle">
                            See how generated tests move through review, editing, approval, coverage analysis, and CI/CD automation—as one connected engineering process.
                        </p>
                    </div>

                    <div className="tn-ws-intro-right">
                        <div className="tn-ws-status-meta">
                            <span className="tn-ws-meta-tag">WORKSPACE PIPELINE</span>
                            <span className="tn-ws-meta-id">REQ-142</span>
                            <span className="tn-ws-meta-name">Password Reset</span>
                            <div className="tn-ws-meta-runtime">
                                <span className="tn-ws-status-dot" />
                                <span>Deterministic Engine</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── 2. CONNECTED PROCESS STEPPER (No nested cards, clean horizontal flow) ─── */}
                <div className="tn-connected-process-bar" role="tablist" aria-label="Workflow Pipeline Steps">
                    {WORKFLOW_STEPS.map((step, idx) => {
                        const isActive = idx === activeStepIndex;
                        const isPast = idx < activeStepIndex;
                        return (
                            <button
                                key={step.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                className={`tn-cprocess-step ${isActive ? 'is-active' : ''} ${isPast ? 'is-past' : ''}`}
                                onClick={() => setActiveStepIndex(idx)}
                            >
                                <div className="tn-cstep-top">
                                    <span className="tn-cstep-num">{step.num}</span>
                                    {isPast && <Check size={12} className="tn-cstep-check text-accent" />}
                                    {isActive && <span className="tn-cstep-active-dot" />}
                                </div>
                                <span className="tn-cstep-title">{step.title}</span>
                                <span className="tn-cstep-sub">{step.shortDesc}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ─── 3. INTERACTIVE PRODUCT WORKSPACE FOR THE SELECTED STEP ─── */}
                <div className="tn-product-workspace" role="region" aria-label="Connected QA Workflow Workspace">
                    {/* Top Workspace Header Bar */}
                    <div className="tn-ws-app-bar">
                        <div className="tn-ws-breadcrumb-group">
                            <span className="tn-ws-brand-mark">TestNexa</span>
                            <span className="tn-ws-crumb-sep">/</span>
                            <span className="tn-ws-crumb-id">REQ-142</span>
                            <span className="tn-ws-crumb-sep">/</span>
                            <span className="tn-ws-crumb-title">Password Reset</span>
                            <span className="tn-ws-status-pill">{currentStep.badge}</span>
                            <span className="tn-ws-time-tag">Step {currentStep.num} of 06</span>
                        </div>

                        {/* Live Quality Signal */}
                        <div className="tn-ws-quality-signal" aria-label="Workflow Quality Metrics">
                            <div className="tn-ws-qstat">
                                <span className="tn-ws-qstat-val font-mono">87%</span>
                                <span className="tn-ws-qstat-lbl">Clause coverage</span>
                            </div>
                            <div className="tn-ws-qstat-divider" />
                            <div className="tn-ws-qstat">
                                <span className="tn-ws-qstat-val font-mono text-amber">3</span>
                                <span className="tn-ws-qstat-lbl">Risk signals</span>
                            </div>
                            <div className="tn-ws-qstat-divider" />
                            <div className="tn-ws-qstat">
                                <span className="tn-ws-qstat-val font-mono text-accent">24 / 24</span>
                                <span className="tn-ws-qstat-lbl">Traced to spec</span>
                            </div>
                        </div>
                    </div>

                    {/* Step Explanatory Banner */}
                    <div className="tn-ws-step-banner">
                        <div className="tn-ws-step-banner-left">
                            <span className="tn-ws-banner-tag">STAGE {currentStep.num}: {currentStep.title.toUpperCase()}</span>
                            <p className="tn-ws-banner-text">{currentStep.detail}</p>
                        </div>
                        <div className="tn-ws-step-banner-actions">
                            <button
                                type="button"
                                className="tn-ws-nav-btn"
                                disabled={activeStepIndex === 0}
                                onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
                            >
                                Previous Step
                            </button>
                            <button
                                type="button"
                                className="tn-ws-nav-btn is-next"
                                disabled={activeStepIndex === WORKFLOW_STEPS.length - 1}
                                onClick={() => setActiveStepIndex((prev) => Math.min(WORKFLOW_STEPS.length - 1, prev + 1))}
                            >
                                <span>Next: {WORKFLOW_STEPS[Math.min(WORKFLOW_STEPS.length - 1, activeStepIndex + 1)].title}</span>
                                <ArrowRight size={13} />
                            </button>
                        </div>
                    </div>

                    {/* Workspace Core Area: Dynamic Multi-panel Stage Preview */}
                    <div className="tn-ws-canvas">
                        {currentStep.id === 'requirement' && (
                            <div className="tn-ws-stage-view tn-ws-stage-req">
                                <div className="tn-ws-panel tn-ws-panel-req" style={{ width: '100%' }}>
                                    <div className="tn-ws-panel-head">
                                        <span className="tn-ws-panel-tag">INGESTED SPECIFICATION</span>
                                        <span className="tn-ws-doc-ref">DOC-AUTH-2026 &bull; PRD Section 4.2</span>
                                    </div>
                                    <div className="tn-ws-req-quote">
                                        <p>&ldquo;Users can reset their password using their registered email address.&rdquo;</p>
                                    </div>
                                    <div className="tn-ws-criteria-list">
                                        <div className="tn-ws-crit-item">
                                            <span className="tn-ws-crit-key">AC-1</span>
                                            <div>
                                                <strong style={{ color: '#F2F3F3', display: 'block', marginBottom: '2px' }}>Token Dispatch &amp; TTL Bounding</strong>
                                                <span>Cryptographic single-use token dispatched to verified email only. Strictly bounded to 15-minute TTL.</span>
                                            </div>
                                        </div>
                                        <div className="tn-ws-crit-item">
                                            <span className="tn-ws-crit-key">AC-2</span>
                                            <div>
                                                <strong style={{ color: '#F2F3F3', display: 'block', marginBottom: '2px' }}>Session Revocation</strong>
                                                <span>Invalidate all existing session tokens and refresh cookies immediately upon successful password update.</span>
                                            </div>
                                        </div>
                                        <div className="tn-ws-crit-item">
                                            <span className="tn-ws-crit-key">AC-3</span>
                                            <div>
                                                <strong style={{ color: '#F2F3F3', display: 'block', marginBottom: '2px' }}>Anti-Abuse Rate Limit</strong>
                                                <span>Throttle password reset requests to maximum 5 attempts per hour per originating client IP and account identifier.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep.id === 'analyze' && (
                            <div className="tn-ws-stage-view tn-ws-stage-analyze">
                                <div className="tn-ws-panel tn-ws-panel-analysis" style={{ width: '100%' }}>
                                    <div className="tn-ws-panel-head">
                                        <span className="tn-ws-panel-tag">DECOMPOSED CONDITIONS &amp; RISKS</span>
                                        <span className="tn-ws-analysis-badge">Deterministic Analysis</span>
                                    </div>
                                    <div className="tn-ws-analysis-content">
                                        <div className="tn-ws-intent-row">
                                            <span className="tn-ws-sub-label">PRIMARY INTENT</span>
                                            <span className="tn-ws-intent-val">Password recovery &amp; credential lifecycle validation</span>
                                        </div>
                                        <div className="tn-ws-analysis-split">
                                            <div className="tn-ws-cond-block">
                                                <span className="tn-ws-sub-label">TESTABLE CONDITIONS</span>
                                                <ul className="tn-ws-bullet-list">
                                                    <li>&bull; Registered email address syntax &amp; database existence</li>
                                                    <li>&bull; Single-use cryptographic token generation (256-bit entropy)</li>
                                                    <li>&bull; 15-minute expiry boundary rejection assertion</li>
                                                    <li>&bull; Active web/mobile session revocation upon password mutation</li>
                                                </ul>
                                            </div>
                                            <div className="tn-ws-risks-block">
                                                <span className="tn-ws-sub-label">ISOLATED RISKS</span>
                                                <ul className="tn-ws-bullet-list tn-ws-risks-list">
                                                    <li>
                                                        <span className="tn-ws-risk-dot is-amber" />
                                                        <span>Expired token redemption replay window</span>
                                                    </li>
                                                    <li>
                                                        <span className="tn-ws-risk-dot is-red" />
                                                        <span>Account enumeration via response timing variance (&gt; 120ms)</span>
                                                    </li>
                                                    <li>
                                                        <span className="tn-ws-risk-dot is-amber" />
                                                        <span>RFC 5322 internationalized email boundary parsing exception</span>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep.id === 'generate' && (
                            <div className="tn-ws-stage-view tn-ws-stage-generate">
                                <div className="tn-ws-panel tn-ws-panel-suite" style={{ width: '100%' }}>
                                    <div className="tn-ws-panel-head">
                                        <div className="tn-ws-suite-title-group">
                                            <span className="tn-ws-panel-tag">SYNTHESIZED TEST SCENARIOS</span>
                                            <span className="tn-ws-count-badge">24 scenarios generated</span>
                                        </div>
                                        <div className="tn-ws-suite-breakdown">
                                            <span className="tn-ws-type-pill is-func">12 Functional</span>
                                            <span className="tn-ws-type-pill is-neg">7 Negative</span>
                                            <span className="tn-ws-type-pill is-sec">5 Security &amp; Timing</span>
                                        </div>
                                    </div>
                                    <div className="tn-ws-table-wrap">
                                        <table className="tn-ws-table">
                                            <thead>
                                                <tr>
                                                    <th className="th-id">ID</th>
                                                    <th className="th-desc">SCENARIO &amp; EXPECTED OUTCOME</th>
                                                    <th className="th-type">TYPE</th>
                                                    <th className="th-status">STEPS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {TEST_CASES_DATA.map((tc) => (
                                                    <tr key={tc.id} className="tn-ws-tr is-visible">
                                                        <td className="td-id"><code>{tc.id}</code></td>
                                                        <td className="td-desc">
                                                            <div className="tn-ws-tc-title">{tc.title}</div>
                                                            <div className="tn-ws-tc-assert">{tc.assertion}</div>
                                                        </td>
                                                        <td className="td-type"><span className={`tn-ws-type-tag ${tc.typeClass}`}>{tc.type}</span></td>
                                                        <td className="td-status"><span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#8BAF9A' }}>3 Atomic Steps</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep.id === 'review' && (
                            <div className="tn-ws-stage-view tn-ws-stage-review" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem', width: '100%' }}>
                                <div className="tn-ws-panel tn-ws-panel-suite">
                                    <div className="tn-ws-panel-head">
                                        <div className="tn-ws-suite-title-group">
                                            <span className="tn-ws-panel-tag">TEST CASES IN REVIEW</span>
                                            <span className="tn-ws-count-badge">24 test cases</span>
                                        </div>
                                        <div className="tn-ws-suite-breakdown">
                                            <span className="tn-ws-type-pill is-func">Functional 12</span>
                                            <span className="tn-ws-type-pill is-neg">Negative 7</span>
                                            <span className="tn-ws-type-pill is-sec">Security 5</span>
                                        </div>
                                    </div>
                                    <div className="tn-ws-table-wrap">
                                        <table className="tn-ws-table">
                                            <thead>
                                                <tr>
                                                    <th className="th-id">ID</th>
                                                    <th className="th-desc">SCENARIO &amp; ASSERTION</th>
                                                    <th className="th-type">TYPE</th>
                                                    <th className="th-status">QA STATUS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {TEST_CASES_DATA.map((tc) => (
                                                    <tr key={tc.id} className="tn-ws-tr is-visible">
                                                        <td className="td-id"><code>{tc.id}</code></td>
                                                        <td className="td-desc">
                                                            <div className="tn-ws-tc-title">{tc.title}</div>
                                                            <div className="tn-ws-tc-assert">{tc.assertion}</div>
                                                        </td>
                                                        <td className="td-type"><span className={`tn-ws-type-tag ${tc.typeClass}`}>{tc.type}</span></td>
                                                        <td className="td-status">
                                                            <span className={`tn-ws-status-chip ${tc.status === 'Approved' ? 'is-pass' : 'is-review'}`}>
                                                                {tc.status === 'Approved' ? <Check className="tn-chip-icon" size={11} /> : <AlertCircle className="tn-chip-icon" size={11} />}
                                                                {tc.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="tn-ws-panel tn-ws-panel-trace">
                                    <div className="tn-ws-panel-head">
                                        <span className="tn-ws-panel-tag">BIDIRECTIONAL TRACEABILITY</span>
                                        <span className="tn-ws-trace-stat">Clause Coverage: 87% &bull; 24/24 Linked</span>
                                    </div>
                                    <div className="tn-ws-trace-tree">
                                        <div className="tn-ws-tree-root">
                                            <span className="tn-ws-tree-root-box">REQ-142</span>
                                        </div>
                                        <div className="tn-ws-tree-branches">
                                            <div className="tn-ws-tree-line" />
                                            <div className="tn-ws-tree-nodes">
                                                <div className="tn-ws-tree-leaf">
                                                    <span className="tn-ws-branch-arm">&boxvr;&HorizontalLine;</span>
                                                    <span className="tn-ws-leaf-id">TC-FUNC-001</span>
                                                    <span className="tn-ws-leaf-clause">[AC-1, AC-2]</span>
                                                </div>
                                                <div className="tn-ws-tree-leaf">
                                                    <span className="tn-ws-branch-arm">&boxvr;&HorizontalLine;</span>
                                                    <span className="tn-ws-leaf-id">TC-FUNC-002</span>
                                                    <span className="tn-ws-leaf-clause">[AC-1]</span>
                                                </div>
                                                <div className="tn-ws-tree-leaf">
                                                    <span className="tn-ws-branch-arm">&boxvr;&HorizontalLine;</span>
                                                    <span className="tn-ws-leaf-id">TC-NEG-004</span>
                                                    <span className="tn-ws-leaf-clause">[AC-1]</span>
                                                </div>
                                                <div className="tn-ws-tree-leaf">
                                                    <span className="tn-ws-branch-arm">&boxvr;&HorizontalLine;</span>
                                                    <span className="tn-ws-leaf-id">TC-SEC-002</span>
                                                    <span className="tn-ws-leaf-clause">[AC-3]</span>
                                                </div>
                                                <div className="tn-ws-tree-leaf">
                                                    <span className="tn-ws-branch-arm">&boxur;&HorizontalLine;</span>
                                                    <span className="tn-ws-leaf-id">TC-EDGE-003</span>
                                                    <span className="tn-ws-leaf-clause">[AC-1]</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep.id === 'execute' && (
                            <div className="tn-ws-stage-view tn-ws-stage-execute" style={{ width: '100%' }}>
                                <div className="tn-ws-panel" style={{ width: '100%', background: '#0C0E0D', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div className="tn-ws-panel-head" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontFamily: 'monospace', color: '#8BAF9A', fontWeight: 700, fontSize: '0.82rem' }}>RUN #842</span>
                                            <span style={{ color: '#F2F3F3', fontWeight: 600, fontSize: '0.86rem' }}>TC-FUNC-001 &bull; Submit registered email &amp; token dispatch</span>
                                            <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>IN PROGRESS</span>
                                        </div>
                                        <span style={{ fontFamily: 'monospace', color: '#969B98', fontSize: '0.76rem' }}>Timer: 00:01:24</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(139, 175, 154, 0.06)', border: '1px solid rgba(139, 175, 154, 0.2)', borderRadius: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{ fontFamily: 'monospace', color: '#8BAF9A', fontWeight: 700, fontSize: '0.78rem' }}>STEP 01</span>
                                                <span style={{ color: '#F2F3F3', fontSize: '0.82rem' }}>Navigate to /forgot-password and input &ldquo;user@company.com&rdquo;</span>
                                            </div>
                                            <span style={{ background: 'rgba(139, 175, 154, 0.15)', color: '#8BAF9A', border: '1px solid rgba(139, 175, 154, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>PASSED</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: '#101211', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{ fontFamily: 'monospace', color: '#38BDF8', fontWeight: 700, fontSize: '0.78rem' }}>STEP 02</span>
                                                <span style={{ color: '#F2F3F3', fontSize: '0.82rem' }}>Submit form and monitor HTTP 200 constant-time network response</span>
                                            </div>
                                            <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>IN PROGRESS</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: '#0C0E0D', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', opacity: 0.7 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{ fontFamily: 'monospace', color: '#68706B', fontWeight: 700, fontSize: '0.78rem' }}>STEP 03</span>
                                                <span style={{ color: '#969B98', fontSize: '0.82rem' }}>Verify single-use cryptographic token delivered via SMTP with 15m TTL</span>
                                            </div>
                                            <span style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#68706B', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem' }}>NOT RUN</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                        <span style={{ fontSize: '0.76rem', color: '#969B98' }}>Observed: <code>HTTP 200 OK returned in 84ms &bull; Payload hash verified</code></span>
                                        <span style={{ fontSize: '0.74rem', color: '#8BAF9A', fontWeight: 600 }}>Target: Staging Environment</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep.id === 'report' && (
                            <div className="tn-ws-stage-view tn-ws-stage-report" style={{ width: '100%' }}>
                                <div className="tn-ws-panel" style={{ width: '100%', background: '#0C0E0D', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div className="tn-ws-panel-head" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontFamily: 'monospace', color: '#8BAF9A', fontWeight: 700, fontSize: '0.82rem' }}>REPORT &bull; RUN #842</span>
                                            <span style={{ color: '#F2F3F3', fontWeight: 600, fontSize: '0.86rem' }}>Authentication &amp; Password Recovery Suite</span>
                                        </div>
                                        <span style={{ background: 'rgba(139, 175, 154, 0.15)', color: '#8BAF9A', border: '1px solid rgba(139, 175, 154, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>PASSED &bull; AUDIT VERIFIED</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', margin: '1.25rem 0' }}>
                                        <div style={{ padding: '0.85rem', background: '#101211', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', color: '#8BAF9A' }}>100%</div>
                                            <div style={{ fontSize: '0.72rem', color: '#969B98', textTransform: 'uppercase', marginTop: '2px' }}>Pass Rate (24/24)</div>
                                        </div>
                                        <div style={{ padding: '0.85rem', background: '#101211', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', color: '#F2F3F3' }}>1.4s</div>
                                            <div style={{ fontSize: '0.72rem', color: '#969B98', textTransform: 'uppercase', marginTop: '2px' }}>Total Duration</div>
                                        </div>
                                        <div style={{ padding: '0.85rem', background: '#101211', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', color: '#8BAF9A' }}>100%</div>
                                            <div style={{ fontSize: '0.72rem', color: '#969B98', textTransform: 'uppercase', marginTop: '2px' }}>Clause Coverage</div>
                                        </div>
                                        <div style={{ padding: '0.85rem', background: '#101211', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', color: '#8BAF9A' }}>0</div>
                                            <div style={{ fontSize: '0.72rem', color: '#969B98', textTransform: 'uppercase', marginTop: '2px' }}>Orphan Tests</div>
                                        </div>
                                    </div>
                                    <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.78rem', color: '#969B98', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Cryptographic lineage token: <code>tn_audit_sig_e891c0b29841</code></span>
                                        <span style={{ color: '#8BAF9A' }}>Exportable as JUnit XML, JSON, or PDF</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Workspace Bottom Action / Export Bar */}
                    <div className="tn-ws-bottom-bar">
                        <div className="tn-ws-bottom-left">
                            <span className="tn-ws-bottom-lbl">NEXT STEP IN PIPELINE</span>
                            <span className="tn-ws-bottom-sub">Approved test suites export directly to native test runners and CI/CD quality gates</span>
                        </div>

                        <div className="tn-ws-export-group">
                            <span className="tn-ws-export-label">EXPORT TO:</span>
                            {['Playwright', 'Cypress', 'Cucumber BDD', 'Jira Software'].map((target) => (
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
