import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Shield, AlertTriangle } from 'lucide-react';
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
            className="de-section"
            aria-labelledby="req-intel-heading"
        >
            <div className="de-container">
                <div className="de-req-layout">
                    {/* LEFT COLUMN: Editorial Typography & 4 Analysis Capabilities */}
                    <div className="de-req-copy">
                        <div className="de-eyebrow">
                            <span className="de-eyebrow-dot" />
                            <span>01 / REQUIREMENT INTELLIGENCE</span>
                        </div>

                        <h2 id="req-intel-heading" className="de-editorial-title">
                            Understand the requirement.<br />
                            <span className="de-text-accent">Before you test it.</span>
                        </h2>

                        <p className="de-lead">
                            Raw specifications hide unstated assumptions, ambiguous boundaries, and implicit timing vulnerabilities. TestNexa deconstructs natural language into deterministic acceptance logic before writing a single test.
                        </p>

                        {/* 4 Actual Capabilities */}
                        <div className="de-req-capabilities" role="tablist" aria-label="Analysis Capabilities">
                            {CAPABILITIES.map((cap) => {
                                const isActive = cap.id === activeCapId;
                                return (
                                    <button
                                        key={cap.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        className={`de-req-cap-item ${isActive ? 'is-active' : ''}`}
                                        onClick={() => setActiveCapId(cap.id)}
                                    >
                                        <span className="de-req-cap-num">{cap.num}</span>
                                        <div>
                                            <span className="de-req-cap-title">{cap.title}</span>
                                            <p className="de-req-cap-desc">{cap.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <a
                                href={getTargetUrl('/app/workspace')}
                                className="de-inline-link"
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

                    {/* RIGHT COLUMN: Large Genuine Requirement-Analysis Interface */}
                    <div className="de-req-visual-wrap">
                        <div className="de-req-image-frame">
                            <img
                                src="/screenshots/transformation-preview.png"
                                alt="TestNexa Requirement Analysis Workbench"
                                className="de-req-image"
                                loading="lazy"
                            />
                            <div className="de-req-image-overlay" />
                        </div>

                        {/* Dynamic Live Annotation Callout */}
                        <div className="de-req-callout">
                            <span className="de-req-callout-tag">Target Clause Deconstruction: &ldquo;{activeCap.clause}&rdquo;</span>
                            <div className="de-req-callout-text">{activeCap.synthesis}</div>
                            <div className="de-req-callout-meta">
                                Verified Rule &bull; DOC-AUTH-2026 PRD Section 4.2 &bull; 100% Clause Coverage
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default RequirementTransformation;
