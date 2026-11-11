import React, { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const CAPABILITIES = [
    {
        id: 'cap-1',
        num: '01',
        title: 'Implicit Boundary Detection',
        desc: 'Unstated token lifetimes, session invalidation omissions, and unhandled status codes are isolated before code is executed.',
        clause: 'Users can reset their password',
        synthesis: 'Synthesize AC-1: Cryptographic single-use token strictly bounded to 15-minute TTL; revoke prior active sessions upon reset.'
    },
    {
        id: 'cap-2',
        num: '02',
        title: 'Account Enumeration & Timing Auditing',
        desc: 'Flags timing delta vulnerabilities where attacker probes can detect whether an email address exists in the database.',
        clause: 'using their registered email address',
        synthesis: 'Assert uniform constant-time HTTP response (≤ 120ms delta) regardless of user account existence.'
    },
    {
        id: 'cap-3',
        num: '03',
        title: 'RFC 5322 Syntax & Unicode Normalization',
        desc: 'Identifies malformed email syntax edge cases and internationalized strings that cause backend parsing exceptions.',
        clause: 'registered email address',
        synthesis: 'Synthesize AC-2: Strict RFC 5322 syntax validation on client gateway; reject malformed payloads with 422 UNPROCESSABLE_ENTITY.'
    },
    {
        id: 'cap-4',
        num: '04',
        title: 'Anti-Abuse Rate Limiting Enforcement',
        desc: 'Extracts missing throttling criteria to protect authentication dispatch queues from automated credential abuse.',
        clause: 'Users can reset their password',
        synthesis: 'Synthesize AC-3: Throttle password recovery requests to max 5 attempts/hour per client IP and account ID.'
    }
];

export const RequirementTransformation = () => {
    const [activeCapId, setActiveCapId] = useState('cap-1');
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const activeCap = CAPABILITIES.find((c) => c.id === activeCapId) || CAPABILITIES[0];

    return (
        <section
            id="transformation"
            className="vt-story-section"
            aria-labelledby="story-intel-heading"
        >
            <div className="vt-container">
                <div className="vt-story-layout">
                    {/* LEFT COLUMN: Editorial Typography with Vertical Dotted Guide */}
                    <div className="vt-story-left">
                        {/* Architectural Dotted Vertical Line and Marker */}
                        <div className="vt-story-vertical-guide" />
                        <div className="vt-story-node-anchor">
                            <div className="vt-story-node-inner" />
                        </div>

                        <div className="vt-eyebrow">
                            <span className="vt-eyebrow-node" />
                            <span>01 / REQUIREMENT INTELLIGENCE</span>
                        </div>

                        <h2 id="story-intel-heading" className="vt-editorial-heading">
                            Before a test exists,<br />
                            <span className="vt-text-accent">understand what matters.</span>
                        </h2>

                        <p className="vt-lead-text">
                            Raw specifications hide unstated assumptions, ambiguous boundaries, and implicit timing vulnerabilities. TestNexa deconstructs natural language into deterministic acceptance logic before writing a single test.
                        </p>

                        {/* 4 Capabilities List */}
                        <div className="vt-capability-list" role="tablist" aria-label="Requirement Analysis Capabilities">
                            {CAPABILITIES.map((cap) => {
                                const isActive = cap.id === activeCapId;
                                return (
                                    <button
                                        key={cap.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        className={`vt-capability-row ${isActive ? 'is-active' : ''}`}
                                        onClick={() => setActiveCapId(cap.id)}
                                    >
                                        <span className="vt-cap-num">{cap.num}</span>
                                        <div>
                                            <span className="vt-cap-title">{cap.title}</span>
                                            <p className="vt-cap-desc">{cap.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: '2.5rem' }}>
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

                    {/* RIGHT COLUMN: Genuine Product Interface Preview (Aspect 1.56:1) */}
                    <div className="vt-visual-column">
                        <div className="vt-product-frame-156">
                            <img
                                src="/screenshots/transformation-preview.png"
                                alt="TestNexa Requirement Analysis Workbench"
                                className="vt-product-img"
                                loading="lazy"
                            />
                            <div className="vt-product-vignette" />
                        </div>

                        {/* Interactive Clause Breakdown Strip */}
                        <div className="vt-visual-caption-strip">
                            <div>
                                <span style={{ color: 'var(--vt-accent)', fontWeight: 600 }}>TARGET CLAUSE: </span>
                                <span>&ldquo;{activeCap.clause}&rdquo;</span>
                            </div>
                            <div>
                                <span style={{ color: '#8BAF9A' }}>100% Clause Coverage Synthesized</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '12px', padding: '12px 16px', background: 'var(--vt-bg-charcoal)', borderLeft: '2px solid var(--vt-accent)', fontSize: '0.82rem', color: '#BAC5BE', lineHeight: 1.5 }}>
                            <strong style={{ color: '#FFFFFF', display: 'block', marginBottom: '2px', fontFamily: 'monospace', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Synthesized Rule &bull; DOC-AUTH-2026 PRD Section 4.2
                            </strong>
                            {activeCap.synthesis}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default RequirementTransformation;
