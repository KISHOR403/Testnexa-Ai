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
        reqName: 'Valid Password Recovery',
        scenario: 'SC-01 Happy Path',
        tcId: 'TC-001',
        tcName: 'Submit registered email & token dispatch',
        riskId: 'RISK-02',
        riskName: 'Token Replay & Reuse',
        status: 'Verified'
    },
    {
        id: 'LNK-2',
        reqId: 'REQ-142.2',
        reqName: 'RFC 5322 Syntax Rules',
        scenario: 'SC-02 Input Validation',
        tcId: 'TC-002',
        tcName: 'Malformed email syntax rejection',
        riskId: 'RISK-04',
        riskName: 'Injection Vector Bypass',
        status: 'Verified'
    },
    {
        id: 'LNK-3',
        reqId: 'REQ-142.3',
        reqName: '15-Minute Token TTL Window',
        scenario: 'SC-03 Expiration Limits',
        tcId: 'TC-003',
        tcName: 'Expired token redemption attempt',
        riskId: 'RISK-01',
        riskName: 'Hijack Window Vulnerability',
        status: 'Verified'
    },
    {
        id: 'LNK-4',
        reqId: 'REQ-142.4',
        reqName: '5 Req/Hr Rate Limiting',
        scenario: 'SC-04 Abuse Mitigation',
        tcId: 'TC-004',
        tcName: 'Brute-force throttle enforcement',
        riskId: 'RISK-03',
        riskName: 'Auth Gateway Flooding',
        status: 'Review'
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
                <div className="tn-trace-flow-canvas" aria-label="Bidirectional Traceability Matrix">
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

                    {/* Horizontal Stream Rows */}
                    <div className="tn-tflow-grid-header">
                        <span className="col-head col-req">REQUIREMENT CLAUSE</span>
                        <span className="col-head col-arrow" />
                        <span className="col-head col-scen">SCENARIO GROUP</span>
                        <span className="col-head col-arrow" />
                        <span className="col-head col-tc">EXECUTABLE TEST CASE</span>
                        <span className="col-head col-arrow" />
                        <span className="col-head col-risk">RISK MITIGATION</span>
                        <span className="col-head col-status">AUDIT STATUS</span>
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
                                    {/* Requirement Node */}
                                    <div className="tn-tflow-cell col-req">
                                        <span className="tn-node-code">{link.reqId}</span>
                                        <span className="tn-node-desc">{link.reqName}</span>
                                    </div>

                                    {/* Connector */}
                                    <div className="tn-tflow-connector col-arrow" aria-hidden="true">
                                        <span className="tn-conn-line" />
                                        <span className="tn-conn-dot" />
                                    </div>

                                    {/* Scenario Node */}
                                    <div className="tn-tflow-cell col-scen">
                                        <span className="tn-scen-tag">{link.scenario}</span>
                                    </div>

                                    {/* Connector */}
                                    <div className="tn-tflow-connector col-arrow" aria-hidden="true">
                                        <span className="tn-conn-line" />
                                        <span className="tn-conn-dot" />
                                    </div>

                                    {/* Test Case Node */}
                                    <div className="tn-tflow-cell col-tc">
                                        <span className="tn-node-code">{link.tcId}</span>
                                        <span className="tn-node-desc">{link.tcName}</span>
                                    </div>

                                    {/* Connector */}
                                    <div className="tn-tflow-connector col-arrow" aria-hidden="true">
                                        <span className="tn-conn-line" />
                                        <span className="tn-conn-dot" />
                                    </div>

                                    {/* Risk Node */}
                                    <div className="tn-tflow-cell col-risk">
                                        <span className="tn-risk-pill">{link.riskId}</span>
                                        <span className="tn-risk-desc">{link.riskName}</span>
                                    </div>

                                    {/* Status Pill */}
                                    <div className="tn-tflow-cell col-status">
                                        <span className={`tn-audit-chip ${link.status === 'Verified' ? 'is-verified' : 'is-review'}`}>
                                            {link.status === 'Verified' ? <Check size={11} /> : <AlertTriangle size={11} />}
                                            <span>{link.status}</span>
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
                            <span>Selection maps <strong>{activeLink.reqId}</strong> through <strong>{activeLink.tcId}</strong> verifying mitigation of <strong>{activeLink.riskId} ({activeLink.riskName})</strong>.</span>
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
