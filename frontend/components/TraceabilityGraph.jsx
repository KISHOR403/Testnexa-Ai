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
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const activeLink = TRACE_LINKS.find((l) => l.id === activeLinkId) || TRACE_LINKS[0];

    return (
        <section
            id="traceability"
            className="de-section"
            aria-labelledby="trace-flow-heading"
        >
            <div className="de-container">
                {/* ─── Editorial Header (Open Technical Story) ─── */}
                <div style={{ maxWidth: 760 }}>
                    <div className="de-eyebrow">
                        <span className="de-eyebrow-dot" />
                        <span>04 / REQUIREMENT TRACEABILITY</span>
                    </div>

                    <h2 id="trace-flow-heading" className="de-editorial-title">
                        Every test maps back to a requirement.
                    </h2>

                    <p className="de-lead">
                        Zero orphan tests. Zero untested assumptions. Every generated assertion maintains a verifiable cryptographic chain of custody from specification clause to executed test run.
                    </p>
                </div>

                {/* ─── Open Technical Traceability Matrix (No boxed card!) ─── */}
                <div className="de-trace-wrap" aria-label="Bidirectional Traceability Matrix">
                    {/* Header Columns */}
                    <div className="de-trace-grid-header">
                        <span>01 / Requirement Clause</span>
                        <span />
                        <span>02 / Test Case</span>
                        <span />
                        <span>03 / Execution Result</span>
                        <span />
                        <span>04 / Verification</span>
                    </div>

                    {/* Trace Rows */}
                    <div role="list">
                        {TRACE_LINKS.map((link) => {
                            const isSelected = activeLinkId === link.id;
                            return (
                                <div
                                    key={link.id}
                                    role="listitem"
                                    className={`de-trace-row ${isSelected ? 'is-active' : ''}`}
                                    onClick={() => setActiveLinkId(link.id)}
                                >
                                    {/* 1. Requirement */}
                                    <div className="de-trace-node">
                                        <span className="de-trace-code">{link.reqId}</span>
                                        <span className="de-trace-text">{link.reqName}</span>
                                    </div>

                                    <div className="de-trace-connector" aria-hidden="true">&rarr;</div>

                                    {/* 2. Test Case */}
                                    <div className="de-trace-node">
                                        <span className="de-trace-code">{link.tcId}</span>
                                        <span className="de-trace-text">{link.tcName}</span>
                                    </div>

                                    <div className="de-trace-connector" aria-hidden="true">&rarr;</div>

                                    {/* 3. Execution Result */}
                                    <div>
                                        <span className="de-trace-token">{link.executionResult}</span>
                                    </div>

                                    <div className="de-trace-connector" aria-hidden="true">&rarr;</div>

                                    {/* 4. Verification Status */}
                                    <div>
                                        <span className="de-trace-verified">
                                            <Check size={12} />
                                            <span>{link.verificationStatus}</span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer Audit Footnote */}
                    <div className="de-trace-footer-strip">
                        <div>
                            <span style={{ color: '#8BAF9A', fontWeight: 600, marginRight: 8 }}>AUDIT PROOF:</span>
                            <span>Selection maps <strong>{activeLink.reqId}</strong> &rarr; <strong>{activeLink.tcId}</strong> &rarr; <strong>{activeLink.executionResult}</strong>: {activeLink.proofDetail}</span>
                        </div>
                        <a
                            href={getTargetUrl('/app/workspace')}
                            className="tn-inline-link"
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
