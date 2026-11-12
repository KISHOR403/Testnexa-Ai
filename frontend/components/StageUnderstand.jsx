import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, AlertCircle, Cpu } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const BOUNDARY_ANALYSES = [
    {
        id: 'b-1',
        tag: 'IMPLICIT BOUNDARY',
        title: 'Token Lifetime & Invalidation',
        detail: 'Synthesize AC-1: Cryptographic single-use token strictly bounded to 15-minute TTL; revoke prior active sessions upon reset.',
        metric: '15m TTL'
    },
    {
        id: 'b-2',
        tag: 'SECURITY AUDIT',
        title: 'Account Enumeration Timing',
        detail: 'Assert uniform constant-time HTTP response (≤ 120ms delta) regardless of whether user account exists in database.',
        metric: '≤ 120ms Delta'
    },
    {
        id: 'b-3',
        tag: 'SYNTAX SPECIFICATION',
        title: 'RFC 5322 Syntax Normalization',
        detail: 'Strict RFC 5322 syntax validation on client gateway; reject malformed payloads with 422 Unprocessable Entity.',
        metric: 'RFC 5322'
    },
    {
        id: 'b-4',
        tag: 'ABUSE PROTECTION',
        title: 'Rate Limiting & Throttling',
        detail: 'Synthesize AC-3: Throttle password recovery requests to maximum 5 attempts per hour per client IP and account ID.',
        metric: '5 Req / Hr'
    }
];

export const StageUnderstand = () => {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    return (
        <section
            id="understand"
            className="vt-fullscreen-stage"
            aria-labelledby="heading-understand"
        >
            <div className="vt-container">
                {/* Stage Indicator & Guide */}
                <div className="vt-stage-connector-top">
                    <div className="vt-stage-marker-circle">
                        <span>01</span>
                    </div>
                    <div className="vt-stage-stem-line" aria-hidden="true" />
                </div>

                <div className="vt-eyebrow">
                    <span className="vt-eyebrow-node" />
                    <span>01 / UNDERSTAND &bull; REQUIREMENT INTELLIGENCE</span>
                </div>

                {/* Large Editorial Headline */}
                <h2 id="heading-understand" className="vt-editorial-heading">
                    Before a test exists,<br />
                    <span className="vt-text-accent">understand what matters.</span>
                </h2>

                <p className="vt-lead-text">
                    Raw specifications hide unstated assumptions, ambiguous boundaries, and implicit timing vulnerabilities. TestNexa deconstructs natural language into deterministic acceptance logic before writing a single test.
                </p>

                {/* Editorial Composition: Open Layout without Boxed Cards */}
                <div className="vt-understand-grid">
                    {/* Left: Floating Requirement Analysis & Boundary Rules */}
                    <div className="vt-understand-meta">
                        {/* Source Clause Ingestion Callout - Open, fine border only */}
                        <div className="vt-clause-anchor">
                            <span className="vt-floating-label">[ INGESTED SPECIFICATION ]</span>
                            <div className="vt-clause-title">DOC-AUTH-2026 PRD &bull; Section 4.2</div>
                            <blockquote className="vt-clause-quote">
                                &ldquo;Users can reset their password using their registered email address.&rdquo;
                            </blockquote>
                        </div>

                        {/* Interactive Deconstruction Details Aligned with Dotted Guides */}
                        <div className="vt-boundary-stream" role="tablist" aria-label="Synthesized Acceptance Rules">
                            {BOUNDARY_ANALYSES.map((item, idx) => {
                                const isActive = idx === selectedIdx;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        className={`vt-boundary-item ${isActive ? 'is-active' : ''}`}
                                        onClick={() => setSelectedIdx(idx)}
                                    >
                                        <div className="vt-boundary-marker-stem" aria-hidden="true" />
                                        <div className="vt-boundary-content">
                                            <div className="vt-boundary-header">
                                                <span className="vt-boundary-tag">{item.tag}</span>
                                                <span className="vt-boundary-metric">{item.metric}</span>
                                            </div>
                                            <div className="vt-boundary-title">{item.title}</div>
                                            <p className="vt-boundary-detail">{item.detail}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="vt-stage-action-wrap">
                            <a
                                href={getTargetUrl('/app/workspace')}
                                className="vt-inline-link"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleWorkspaceEntry('/app/workspace');
                                }}
                            >
                                <span>Inspect requirement deconstruction in workspace</span>
                                <ArrowRight size={13} />
                            </a>
                        </div>
                    </div>

                    {/* Right: Selectively Cropped Genuine Product Interface (No Outer Card / No Frame) */}
                    <div className="vt-understand-visual">
                        <div className="vt-cropped-interface-canvas">
                            <img
                                src="/screenshots/transformation-preview.png"
                                alt="TestNexa Requirement Intelligence Workbench"
                                className="vt-cropped-interface-img"
                                loading="lazy"
                            />
                            {/* Smooth Vignette Bleed into Black Canvas */}
                            <div className="vt-interface-gradient-fade" aria-hidden="true" />
                        </div>

                        {/* Floating Technical Status Aligned with Interface */}
                        <div className="vt-visual-metadata-strip">
                            <div className="vt-meta-pair">
                                <span className="vt-meta-k">CLAUSE COVERAGE</span>
                                <span className="vt-meta-v vt-text-accent">100% Synthesized</span>
                            </div>
                            <div className="vt-meta-sep" aria-hidden="true">&bull;</div>
                            <div className="vt-meta-pair">
                                <span className="vt-meta-k">ISOLATED RISKS</span>
                                <span className="vt-meta-v">4 Implicit Bounds</span>
                            </div>
                            <div className="vt-meta-sep" aria-hidden="true">&bull;</div>
                            <div className="vt-meta-pair">
                                <span className="vt-meta-k">PARSER ENGINE</span>
                                <span className="vt-meta-v">Deterministic LLM-4</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default StageUnderstand;
