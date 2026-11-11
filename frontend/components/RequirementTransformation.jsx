import React, { useState } from 'react';
import {
    AlertTriangle,
    Shield,
    Check,
    FileText,
    ArrowRight,
    Search,
    Code,
    SlidersHorizontal,
    GitBranch
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const ANNOTATIONS = [
    {
        id: 'an-1',
        type: 'Security',
        typeClass: 'is-security',
        title: 'Account Enumeration Risk',
        desc: 'Uniform HTTP timing response required to prevent determining if email exists in database.',
        targetPhrase: 'registered email address',
        action: 'Assert constant-time response (≤ 120ms delta) on both existent and non-existent accounts.'
    },
    {
        id: 'an-2',
        type: 'Ambiguity',
        typeClass: 'is-ambiguity',
        title: 'Unstated Token Lifecycle',
        desc: 'Source requirement does not define TTL or token single-use constraints.',
        targetPhrase: 'reset their password',
        action: 'Synthesize AC-1: Cryptographic single-use token strictly bounded to 15-minute TTL.'
    },
    {
        id: 'an-3',
        type: 'Missing Criteria',
        typeClass: 'is-missing',
        title: 'Session Invalidation Omission',
        desc: 'Existing web and mobile sessions must be revoked upon successful password change.',
        targetPhrase: 'password',
        action: 'Synthesize AC-2: Invalidate all active JWT tokens and session cookies on confirmation.'
    },
    {
        id: 'an-4',
        type: 'Edge Boundary',
        typeClass: 'is-edge',
        title: 'RFC 5322 Boundary & Rate Limit',
        desc: 'Missing rate limit allows automated flood of auth dispatch queues.',
        targetPhrase: 'Users can reset',
        action: 'Synthesize AC-3: Throttle requests to max 5/hour per IP & validate unicode email strings.'
    }
];

export const RequirementTransformation = () => {
    const [selectedAnnotationId, setSelectedAnnotationId] = useState('an-1');
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const activeAnnotation = ANNOTATIONS.find((a) => a.id === selectedAnnotationId) || ANNOTATIONS[0];

    return (
        <section
            id="transformation"
            className="de-section"
            aria-labelledby="req-intel-heading"
        >
            <div className="de-container">
                <div className="de-req-split">
                    {/* LEFT COLUMN: Editorial Typography & Technical Findings */}
                    <div className="de-req-left">
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

                        {/* List of Actual Capabilities (Open, hairline-divided) */}
                        <div className="de-req-list" role="tablist" aria-label="Requirement Analysis Findings">
                            {ANNOTATIONS.map((item, idx) => {
                                const isSelected = selectedAnnotationId === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isSelected}
                                        className={`de-req-item ${isSelected ? 'is-active' : ''}`}
                                        onClick={() => setSelectedAnnotationId(item.id)}
                                    >
                                        <span className="de-req-num">0{idx + 1}</span>
                                        <div className="de-req-body">
                                            <span className="de-req-tag">{item.type}</span>
                                            <span className="de-req-heading">{item.title}</span>
                                            <p className="de-req-desc">{item.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: '2.5rem' }}>
                            <a
                                href={getTargetUrl('/app/workspace')}
                                className="tn-inline-link"
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

                    {/* RIGHT COLUMN: Genuine Integrated Specification Canvas */}
                    <div className="de-spec-canvas">
                        <div className="de-spec-topbar">
                            <span className="de-spec-id">REQ-142 / PASSWORD RESET SPECIFICATION</span>
                            <span className="de-spec-status">
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6DAE82' }} />
                                <span>Deterministic Audit Complete</span>
                            </span>
                        </div>

                        <div className="de-spec-doc-body">
                            <div className="de-spec-line">
                                <span className="de-spec-linenum">01</span>
                                <span className="de-spec-text" style={{ color: '#8BAF9A' }}>Feature Specification: Password Recovery &amp; Credential Lifecycle</span>
                            </div>
                            <div className="de-spec-line">
                                <span className="de-spec-linenum">02</span>
                                <span className="de-spec-text">
                                    <span
                                        className={`de-highlight-token ${selectedAnnotationId === 'an-4' ? 'is-selected' : ''}`}
                                        onClick={() => setSelectedAnnotationId('an-4')}
                                    >
                                        Users can reset
                                    </span>{' '}
                                    <span
                                        className={`de-highlight-token ${selectedAnnotationId === 'an-3' ? 'is-selected' : ''}`}
                                        onClick={() => setSelectedAnnotationId('an-3')}
                                    >
                                        their password
                                    </span>{' '}
                                    using{' '}
                                    <span
                                        className={`de-highlight-token ${selectedAnnotationId === 'an-1' ? 'is-selected' : ''}`}
                                        onClick={() => setSelectedAnnotationId('an-1')}
                                    >
                                        their registered email address
                                    </span>
                                    .
                                </span>
                            </div>
                        </div>

                        <div className="de-synth-block">
                            <span className="de-synth-label">Target Clause: &ldquo;{activeAnnotation.targetPhrase}&rdquo;</span>
                            <h3 style={{ fontSize: '1rem', fontWeight: 500, color: '#F2F2F0', margin: '0 0 6px' }}>{activeAnnotation.title}</h3>
                            <p style={{ fontSize: '0.82rem', color: '#969B98', margin: '0 0 12px', lineHeight: 1.5 }}>{activeAnnotation.desc}</p>
                            <span className="de-synth-label">Synthesized Acceptance Rule:</span>
                            <div className="de-synth-rule">{activeAnnotation.action}</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontFamily: 'monospace', fontSize: '0.74rem', color: '#969B98' }}>
                            <span>4 Implicit Gaps Isolated</span>
                            <span style={{ color: '#8BAF9A' }}>100% Clause Coverage Synthesized</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default RequirementTransformation;
