import React, { useState } from 'react';
import {
    CheckCircle2,
    Shield,
    AlertTriangle,
    FileText,
    ArrowRight,
    Check,
    Layers,
    GitBranch
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const TRACE_LINKS = [
    {
        id: 'LNK-1',
        reqId: 'REQ-142.1',
        reqName: 'Valid Password Recovery Spec',
        tcId: 'TC-FUNC-001',
        tcName: 'Submit registered email & token dispatch',
        executionResult: 'Run #842 · Passed · 42ms',
        executionStatus: 'passed',
        verificationStatus: 'Verified',
        verificationCoverage: '100% Trace',
        proofDetail: 'Cryptographic token generated with 256-bit entropy; verified in SMTP queue.'
    },
    {
        id: 'LNK-2',
        reqId: 'REQ-142.2',
        reqName: 'RFC 5322 Syntax Boundary Rules',
        tcId: 'TC-NEG-002',
        tcName: 'Malformed email syntax rejection',
        executionResult: 'Run #842 · Passed · 18ms',
        executionStatus: 'passed',
        verificationStatus: 'Verified',
        verificationCoverage: '100% Trace',
        proofDetail: 'Client input blocked trigger; raw API post returned HTTP 422 Unprocessable.'
    },
    {
        id: 'LNK-3',
        reqId: 'REQ-142.3',
        reqName: '15-Minute Token TTL Expiration',
        tcId: 'TC-NEG-003',
        tcName: 'Expired token redemption replay assertion',
        executionResult: 'Run #842 · Passed · 65ms',
        executionStatus: 'passed',
        verificationStatus: 'Verified',
        verificationCoverage: '100% Trace',
        proofDetail: 'Token age > 900s rejected at gateway with 401 TOKEN_EXPIRED error payload.'
    },
    {
        id: 'LNK-4',
        reqId: 'REQ-142.4',
        reqName: '5 Req/Hr Rate Limiting',
        tcId: 'TC-SEC-004',
        tcName: 'Brute-force throttle enforcement',
        executionResult: 'Run #842 · Passed · 94ms',
        executionStatus: 'passed',
        verificationStatus: 'Verified',
        verificationCoverage: '100% Trace',
        proofDetail: '6th request within 60s yielded HTTP 429 Too Many Requests with Retry-After header.'
    }
];

export const TraceabilityGraph = () => {
    const [activeLinkId, setActiveLinkId] = useState('LNK-1');
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    const activeLink = TRACE_LINKS.find((l) => l.id === activeLinkId) || TRACE_LINKS[0];

    return (
        <section
            id="traceability"
            className="tn-section tn-trace-flow-section"
            aria-labelledby="trace-flow-heading"
        >
            <div className="tn-container">
                {/* ─── Editorial Header (Open Canvas) ─── */}
                <div className="tn-trace-header-group">
                    <div className="tn-chapter-eyebrow">
                        <span className="tn-kicker-dot" />
                        <span>BIDIRECTIONAL TRACEABILITY</span>
                    </div>

                    <h2 id="trace-flow-heading" className="tn-trace-title">
                        Every test maps back to a requirement.
                    </h2>

                    <p className="tn-trace-subtitle">
                        Eliminate orphan test cases and undocumented gaps. TestNexa establishes verifiable, bidirectional lineage from requirement to scenario, test case, and risk mitigation.
                    </p>
                </div>

                {/* ─── Horizontal Traceability Flow Canvas ─── */}
                <div
                    className="tn-trace-flow-canvas tn-spotlight-card"
                    aria-label="Bidirectional Traceability Matrix"
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                        e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                    }}
                >
                    {/* Top Metric Bar */}
                    <div className="tn-tflow-topbar">
                        <div className="tn-tflow-breadcrumbs">
                            <span className="tn-tflow-root-label">LINEAGE MATRIX</span>
                            <span className="tn-tflow-root-id">REQ-142</span>
                            <span className="tn-tflow-lock-status">
                                <CheckCircle2 size={13} className="text-green" />
                                <span>100% Bidirectional Lock</span>
                            </span>
                        </div>

                        <div className="tn-tflow-kpis">
                            <div className="tn-tflow-kpi">
                                <span className="tn-tkpi-val font-mono">94.2%</span>
                                <span className="tn-tkpi-lbl">Clause coverage</span>
                            </div>
                            <div className="tn-tkpi-sep" />
                            <div className="tn-tflow-kpi">
                                <span className="tn-tkpi-val font-mono text-green">0</span>
                                <span className="tn-tkpi-lbl">Orphan tests</span>
                            </div>
                            <div className="tn-tkpi-sep" />
                            <div className="tn-tflow-kpi">
                                <span className="tn-tkpi-val font-mono text-accent">24 / 24</span>
                                <span className="tn-tkpi-lbl">Cases linked</span>
                            </div>
                        </div>
                    </div>

                    {/* Horizontal Stream Rows: Requirement → Test Case → Execution Result → Verification */}
                    <div className="tn-tflow-grid-header">
                        <span className="col-head col-req">REQUIREMENT CLAUSE</span>
                        <span className="col-head col-arrow" />
                        <span className="col-head col-tc">TEST CASE</span>
                        <span className="col-head col-arrow" />
                        <span className="col-head col-exec">EXECUTION RESULT</span>
                        <span className="col-head col-arrow" />
                        <span className="col-head col-status">VERIFICATION</span>
                    </div>

                    <div className="tn-tflow-rows" role="list">
                        {TRACE_LINKS.map((link) => {
                            const isSelected = activeLinkId === link.id;
                            return (
                                <div
                                    key={link.id}
                                    role="listitem"
                                    className={`tn-tflow-row ${isSelected ? 'is-selected' : ''}`}
                                    onClick={() => setActiveLinkId(link.id)}
                                >
                                    {/* 1. Requirement Node */}
                                    <div className="tn-tflow-cell col-req">
                                        <span className="tn-node-code">{link.reqId}</span>
                                        <span className="tn-node-desc">{link.reqName}</span>
                                    </div>

                                    {/* Connector */}
                                    <div className="tn-tflow-connector col-arrow" aria-hidden="true">
                                        <span className="tn-conn-line" />
                                        <span className="tn-conn-dot" />
                                    </div>

                                    {/* 2. Test Case Node */}
                                    <div className="tn-tflow-cell col-tc">
                                        <span className="tn-node-code">{link.tcId}</span>
                                        <span className="tn-node-desc">{link.tcName}</span>
                                    </div>

                                    {/* Connector */}
                                    <div className="tn-tflow-connector col-arrow" aria-hidden="true">
                                        <span className="tn-conn-line" />
                                        <span className="tn-conn-dot" />
                                    </div>

                                    {/* 3. Execution Result Node */}
                                    <div className="tn-tflow-cell col-exec">
                                        <span className="tn-exec-pill">{link.executionResult}</span>
                                    </div>

                                    {/* Connector */}
                                    <div className="tn-tflow-connector col-arrow" aria-hidden="true">
                                        <span className="tn-conn-line" />
                                        <span className="tn-conn-dot" />
                                    </div>

                                    {/* 4. Verification Status */}
                                    <div className="tn-tflow-cell col-status">
                                        <span className="tn-audit-chip is-verified">
                                            <Check size={11} />
                                            <span>{link.verificationStatus}</span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Bottom Lineage Detail Footnote */}
                    <div className="tn-tflow-footer">
                        <div className="tn-tflow-footer-text">
                            <span className="tn-tfoot-tag">AUDIT PROOF:</span>
                            <span>Selection maps <strong>{activeLink.reqId}</strong> &rarr; <strong>{activeLink.tcId}</strong> &rarr; <strong>{activeLink.executionResult}</strong>: {activeLink.proofDetail}</span>
                        </div>
                        <a
                            href={getTargetUrl('/app/workspace')}
                            className="tn-tflow-cta-link"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                        >
                            <span>Inspect full traceability tree</span>
                            <ArrowRight size={13} />
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TraceabilityGraph;
