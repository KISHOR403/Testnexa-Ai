import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, ChevronRight } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const TRACE_LINKS = [
    {
        id: 'LNK-1',
        reqId: 'REQ-142.1',
        reqName: 'Single-Use Token Dispatch Spec',
        tcId: 'TC-FUNC-001',
        tcName: 'Submit registered email & verify token',
        executionResult: 'Run #842 · Passed · 42ms',
        verificationCoverage: '100% Trace',
        proofDetail: 'Cryptographic token generated with 256-bit entropy; verified in SMTP queue; active session preserved.'
    },
    {
        id: 'LNK-2',
        reqId: 'REQ-142.2',
        reqName: 'RFC 5322 Syntax Boundary Rules',
        tcId: 'TC-NEG-002',
        tcName: 'Malformed email syntax rejection',
        executionResult: 'Run #842 · Passed · 18ms',
        verificationCoverage: '100% Trace',
        proofDetail: 'Client input disabled trigger; direct API post returned HTTP 422 Unprocessable with code INVALID_EMAIL.'
    },
    {
        id: 'LNK-3',
        reqId: 'REQ-142.3',
        reqName: '15-Minute Token TTL Expiration',
        tcId: 'TC-NEG-003',
        tcName: 'Expired token replay assertion',
        executionResult: 'Run #842 · Passed · 65ms',
        verificationCoverage: '100% Trace',
        proofDetail: 'Token timestamp > 900s rejected at gateway with 401 TOKEN_EXPIRED error payload; database unaltered.'
    },
    {
        id: 'LNK-4',
        reqId: 'REQ-142.4',
        reqName: 'Anti-Abuse 5 Req/Hr Rate Limit',
        tcId: 'TC-SEC-004',
        tcName: 'Brute-force throttle enforcement',
        executionResult: 'Run #842 · Passed · 94ms',
        verificationCoverage: '100% Trace',
        proofDetail: '6th request within 15m yielded HTTP 429 Too Many Requests with Retry-After: 3600 header.'
    }
];

export const TraceabilityGraph = () => {
    const [activeLinkId, setActiveLinkId] = useState('LNK-1');
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const activeLink = TRACE_LINKS.find((l) => l.id === activeLinkId) || TRACE_LINKS[0];

    return (
        <section
            id="traceability"
            className="de-section de-section-alt"
            aria-labelledby="trace-heading"
        >
            <div className="de-container">
                {/* ─── Editorial Header ─── */}
                <div style={{ maxWidth: 760 }}>
                    <div className="de-eyebrow">
                        <span className="de-eyebrow-dot" />
                        <span>04 / REQUIREMENT TRACEABILITY</span>
                    </div>

                    <h2 id="trace-heading" className="de-editorial-title">
                        Every test has a reason to exist.
                    </h2>

                    <p className="de-lead">
                        Zero orphan tests. Zero untested assumptions. Every generated assertion maintains a verifiable cryptographic chain of custody from specification clause to executed test run.
                    </p>
                </div>

                {/* ─── Technical Data Ledger: Requirement → Test Case → Execution → Verification ─── */}
                <div className="de-trace-ledger" aria-label="Bidirectional Traceability Ledger">
                    {/* Header Columns */}
                    <div className="de-trace-row-header">
                        <span>01 / Requirement Clause</span>
                        <span />
                        <span>02 / Test Case</span>
                        <span />
                        <span>03 / Execution Result</span>
                        <span />
                        <span>04 / Verification</span>
                    </div>

                    {/* Trace Rows */}
                    {TRACE_LINKS.map((link) => {
                        const isActive = link.id === activeLinkId;
                        return (
                            <div
                                key={link.id}
                                className={`de-trace-row ${isActive ? 'is-active' : ''}`}
                                onClick={() => setActiveLinkId(link.id)}
                                role="button"
                                tabIndex={0}
                                aria-label={`Inspect ${link.reqId} to ${link.tcId} traceability`}
                            >
                                <div>
                                    <span className="de-trace-id">{link.reqId}</span>
                                    <span className="de-trace-text">{link.reqName}</span>
                                </div>

                                <div className="de-trace-arrow">
                                    <ChevronRight size={14} />
                                </div>

                                <div>
                                    <span className="de-trace-id">{link.tcId}</span>
                                    <span className="de-trace-text">{link.tcName}</span>
                                </div>

                                <div className="de-trace-arrow">
                                    <ChevronRight size={14} />
                                </div>

                                <div>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#BAC5BE' }}>
                                        {link.executionResult}
                                    </span>
                                </div>

                                <div className="de-trace-arrow">
                                    <ChevronRight size={14} />
                                </div>

                                <div>
                                    <span className="de-trace-pill">
                                        <CheckCircle2 size={13} />
                                        <span>{link.verificationCoverage}</span>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Cryptographic Inspection Proof Callout */}
                <div className="de-trace-proof-panel">
                    <div>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--de-accent)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>
                            Lineage Proof &bull; {activeLink.reqId} &rarr; {activeLink.tcId}
                        </span>
                        <span style={{ fontSize: '0.88rem', color: 'var(--de-text)' }}>
                            {activeLink.proofDetail}
                        </span>
                    </div>

                    <a
                        href={getTargetUrl('/app/traceability')}
                        className="de-inline-link"
                        onClick={(e) => {
                            e.preventDefault();
                            handleWorkspaceEntry('/app/traceability');
                        }}
                    >
                        <span>Open coverage matrix</span>
                        <ArrowRight size={13} />
                    </a>
                </div>
            </div>
        </section>
    );
};

export default TraceabilityGraph;
