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
        id: 'ingest',
        title: 'Ingest Specification',
        shortDesc: 'Natural language & Jira issues',
        detail: 'Ingest user stories, PRD clauses, or Jira tickets into normalized specification models.',
        badge: 'DOC-AUTH-2026'
    },
    {
        num: '02',
        id: 'decompose',
        title: 'Condition Analysis',
        shortDesc: 'Implicit risk & boundary flags',
        detail: 'Deconstruct unstated assumptions, RFC email syntax boundaries, and security timing risks.',
        badge: '3 Risk Flags'
    },
    {
        num: '03',
        id: 'synthesize',
        title: 'Scenario Generation',
        shortDesc: 'Functional, negative & edge',
        detail: 'Synthesize structured, prioritized test cases with atomic steps, preconditions, and assertions.',
        badge: '24 Scenarios'
    },
    {
        num: '04',
        id: 'review',
        title: 'Review & Approval',
        shortDesc: 'QA engineer inspection & editing',
        detail: 'QA engineers review assertions, edit test steps, update status from Review to Approved.',
        badge: 'Interactive Review'
    },
    {
        num: '05',
        id: 'coverage',
        title: 'Coverage & Traceability',
        shortDesc: 'Bidirectional lineage locking',
        detail: 'Map 100% of test cases back to specification clauses with zero orphan tests.',
        badge: '87% Clause Coverage'
    },
    {
        num: '06',
        id: 'export',
        title: 'Runner Export',
        shortDesc: 'Playwright, Cypress & CI/CD',
        detail: 'Export directly to Playwright (.spec.ts), Cypress (.cy.js), Cucumber BDD, and GitHub Actions.',
        badge: 'Release Ready'
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

                    {/* Workspace Core Area: Multi-panel Split */}
                    <div className="tn-ws-canvas">
                        {/* LEFT COLUMN: Specification & Analysis */}
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
                            <div className="tn-ws-panel tn-ws-panel-analysis">
                                <div className="tn-ws-panel-head">
                                    <span className="tn-ws-panel-tag">DECOMPOSED CONDITIONS & RISKS</span>
                                    <span className="tn-ws-analysis-badge">Deterministic</span>
                                </div>

                                <div className="tn-ws-analysis-content">
                                    <div className="tn-ws-intent-row">
                                        <span className="tn-ws-sub-label">PRIMARY INTENT</span>
                                        <span className="tn-ws-intent-val">Password recovery & credential lifecycle validation</span>
                                    </div>

                                    <div className="tn-ws-analysis-split">
                                        <div className="tn-ws-cond-block">
                                            <span className="tn-ws-sub-label">TESTABLE CONDITIONS</span>
                                            <ul className="tn-ws-bullet-list">
                                                <li>• Registered email address syntax & existence</li>
                                                <li>• One-time cryptographic token generation</li>
                                                <li>• 15-minute expiry boundary enforcement</li>
                                                <li>• Active web/mobile session revocation</li>
                                            </ul>
                                        </div>

                                        <div className="tn-ws-risks-block">
                                            <span className="tn-ws-sub-label">ISOLATED RISKS</span>
                                            <ul className="tn-ws-bullet-list tn-ws-risks-list">
                                                <li>
                                                    <span className="tn-ws-risk-dot is-amber" />
                                                    <span>Expired token redemption replay</span>
                                                </li>
                                                <li>
                                                    <span className="tn-ws-risk-dot is-red" />
                                                    <span>Account enumeration via response timing</span>
                                                </li>
                                                <li>
                                                    <span className="tn-ws-risk-dot is-amber" />
                                                    <span>RFC 5322 internationalized email boundary</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Reviewable Test Suite & Lineage */}
                        <div className="tn-ws-col tn-ws-col-right">
                            {/* Test Suite Table Panel with QA Review Controls */}
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

                                {/* Table Rows */}
                                <div className="tn-ws-table-wrap">
                                    <table className="tn-ws-table">
                                        <thead>
                                            <tr>
                                                <th className="th-id">ID</th>
                                                <th className="th-desc">SCENARIO & ASSERTION</th>
                                                <th className="th-type">TYPE</th>
                                                <th className="th-status">QA STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {TEST_CASES_DATA.map((tc) => (
                                                <tr key={tc.id} className="tn-ws-tr is-visible">
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
                                                        <span className={`tn-ws-status-chip ${tc.status === 'Approved' ? 'is-pass' : 'is-review'}`}>
                                                            {tc.status === 'Approved' ? (
                                                                <Check className="tn-chip-icon" size={11} />
                                                            ) : (
                                                                <AlertCircle className="tn-chip-icon" size={11} />
                                                            )}
                                                            {tc.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Traceability Relationship Panel */}
                            <div className="tn-ws-panel tn-ws-panel-trace">
                                <div className="tn-ws-panel-head">
                                    <span className="tn-ws-panel-tag">BIDIRECTIONAL TRACEABILITY</span>
                                    <span className="tn-ws-trace-stat">Clause Coverage: 87% • 24/24 Linked</span>
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
