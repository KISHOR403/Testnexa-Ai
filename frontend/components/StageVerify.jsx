import React from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, ShieldCheck, FileCheck, Hash } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const TRACEABILITY_MATRIX = [
    {
        reqId: 'DOC-AUTH §4.2.1',
        reqDesc: 'Valid password reset token dispatch & 15m TTL',
        caseId: 'TC-FUNC-001',
        caseDesc: 'Single-use token dispatch',
        runId: 'Run #842',
        duration: '38ms',
        status: 'Passed',
        proof: '100% Verified',
        hash: 'sha256:7f9a2b'
    },
    {
        reqId: 'DOC-AUTH §4.2.2',
        reqDesc: 'RFC 5322 malformed syntax gateway rejection',
        caseId: 'TC-NEG-002',
        caseDesc: 'Syntax normalization reject',
        runId: 'Run #842',
        duration: '14ms',
        status: 'Passed',
        proof: '100% Verified',
        hash: 'sha256:e3c109'
    },
    {
        reqId: 'DOC-AUTH §4.2.3',
        reqDesc: 'Account enumeration timing delta (≤ 120ms)',
        caseId: 'TC-SEC-003',
        caseDesc: 'Timing attack delta invariant',
        runId: 'Run #842',
        duration: '36ms',
        status: 'Passed',
        proof: '100% Verified',
        hash: 'sha256:4a88f1'
    },
    {
        reqId: 'DOC-AUTH §4.2.4',
        reqDesc: 'Anti-abuse rate limiting (> 5 req/hr per IP)',
        caseId: 'TC-SEC-004',
        caseDesc: 'IP throttle enforcement',
        runId: 'Run #842',
        duration: '29ms',
        status: 'Passed',
        proof: '100% Verified',
        hash: 'sha256:91d4e0'
    }
];

export const StageVerify = () => {
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    return (
        <section
            id="verify"
            className="vt-fullscreen-stage"
            aria-labelledby="heading-verify"
        >
            <div className="vt-container">
                {/* Stage Indicator & Guide */}
                <div className="vt-stage-connector-top">
                    <div className="vt-stage-marker-circle">
                        <span>05</span>
                    </div>
                    <div className="vt-stage-stem-line" aria-hidden="true" />
                </div>

                <div className="vt-eyebrow">
                    <span className="vt-eyebrow-node" />
                    <span>05 / VERIFY &bull; AUDITABLE TRACEABILITY</span>
                </div>

                {/* Large Editorial Headline */}
                <h2 id="heading-verify" className="vt-editorial-heading">
                    Quality must be verified.
                </h2>

                <p className="vt-lead-text">
                    A deterministic chain of custody connects every passing execution directly back to its source requirement clause. No gaps, no unverified assertions, and zero compliance ambiguity.
                </p>

                {/* Editorial Traceability Architecture with Fine Connecting Lines (Zero Boxes) */}
                <div className="vt-verify-editorial-wrap">
                    {/* Header Columns Guide */}
                    <div className="vt-trace-grid-header">
                        <div>01 / SOURCE SPECIFICATION</div>
                        <div />
                        <div>02 / SYNTHESIZED TEST CASE</div>
                        <div />
                        <div>03 / EXECUTION RUN</div>
                        <div />
                        <div>04 / VERIFICATION PROOF</div>
                    </div>

                    {/* Traceability Matrix Chain Rows */}
                    <div className="vt-trace-matrix-list" role="table" aria-label="Requirement-to-Test Traceability Matrix">
                        {TRACEABILITY_MATRIX.map((item, idx) => (
                            <div key={idx} className="vt-trace-matrix-row" role="row">
                                {/* Col 1: Requirement Specification */}
                                <div className="vt-trace-col-req">
                                    <span className="vt-trace-id-badge">{item.reqId}</span>
                                    <div className="vt-trace-title">{item.reqDesc}</div>
                                </div>

                                {/* Connecting Line & Node */}
                                <div className="vt-trace-connector-cell" aria-hidden="true">
                                    <div className="vt-connector-horizontal-line" />
                                    <div className="vt-connector-node" />
                                </div>

                                {/* Col 2: Synthesized Test Case */}
                                <div className="vt-trace-col-case">
                                    <span className="vt-trace-case-id">{item.caseId}</span>
                                    <div className="vt-trace-title">{item.caseDesc}</div>
                                </div>

                                {/* Connecting Line & Node */}
                                <div className="vt-trace-connector-cell" aria-hidden="true">
                                    <div className="vt-connector-horizontal-line" />
                                    <div className="vt-connector-node" />
                                </div>

                                {/* Col 3: Live Execution Run */}
                                <div className="vt-trace-col-run">
                                    <span className="vt-trace-run-id">{item.runId}</span>
                                    <div className="vt-trace-run-meta">
                                        <span className="vt-trace-run-status">{item.status}</span>
                                        <span className="vt-trace-run-duration">&bull; {item.duration}</span>
                                    </div>
                                </div>

                                {/* Connecting Line & Node */}
                                <div className="vt-trace-connector-cell" aria-hidden="true">
                                    <div className="vt-connector-horizontal-line" />
                                    <div className="vt-connector-node" />
                                </div>

                                {/* Col 4: Cryptographic Proof */}
                                <div className="vt-trace-col-proof">
                                    <span className="vt-trace-proof-badge">
                                        <CheckCircle2 size={13} />
                                        <span>{item.proof}</span>
                                    </span>
                                    <span className="vt-trace-hash">{item.hash}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Architectural Traceability Footnote */}
                    <div className="vt-trace-footnote-bar">
                        <div className="vt-footnote-item">
                            <span className="vt-footnote-k">CHAIN INTEGRITY</span>
                            <span className="vt-footnote-v vt-text-accent">Zero Orphan Requirements</span>
                        </div>
                        <div className="vt-footnote-sep" aria-hidden="true">&bull;</div>
                        <div className="vt-footnote-item">
                            <span className="vt-footnote-k">REGULATORY COMPLIANCE</span>
                            <span className="vt-footnote-v">ISO 29119 &bull; SOC 2 Ready</span>
                        </div>
                        <div className="vt-footnote-sep" aria-hidden="true">&bull;</div>
                        <div className="vt-footnote-item">
                            <span className="vt-footnote-k">AUDIT PROOF</span>
                            <span className="vt-footnote-v">Cryptographic SHA-256 Hashes</span>
                        </div>
                    </div>

                    <div className="vt-stage-action-wrap">
                        <a
                            href={getTargetUrl('/app/traceability')}
                            className="vt-inline-link"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/traceability');
                            }}
                        >
                            <span>Explore full bidirectional traceability matrix in workspace</span>
                            <ArrowRight size={13} />
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default StageVerify;
