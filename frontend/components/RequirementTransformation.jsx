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
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    const activeAnnotation = ANNOTATIONS.find((a) => a.id === selectedAnnotationId) || ANNOTATIONS[0];

    return (
        <section
            id="transformation"
            className="tn-section tn-req-intel-section"
            aria-labelledby="req-intel-heading"
        >
            <div className="tn-container">
                {/* ─── Asymmetric Split: Editorial Text on Left, Product UI on Right ─── */}
                <div className="tn-req-intel-grid">
                    {/* LEFT COLUMN: Editorial Storytelling */}
                    <div className="tn-req-intel-story">
                        <div className="tn-chapter-eyebrow">
                            <span className="tn-kicker-dot" />
                            <span>REQUIREMENT INTELLIGENCE</span>
                        </div>

                        <h2 id="req-intel-heading" className="tn-req-intel-title">
                            Understand the requirement before writing tests.
                        </h2>

                        <p className="tn-req-intel-lead">
                            Raw specifications contain unstated assumptions, ambiguous boundaries, and implicit edge cases. TestNexa deconstructs natural language into verifiable acceptance logic before synthesizing a single test.
                        </p>

                        {/* Inline Technical Findings (No Cards!) */}
                        <div className="tn-intel-findings-list" role="tablist" aria-label="Requirement Findings">
                            {ANNOTATIONS.map((item) => {
                                const isSelected = selectedAnnotationId === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isSelected}
                                        className={`tn-finding-row ${isSelected ? 'is-selected' : ''}`}
                                        onClick={() => setSelectedAnnotationId(item.id)}
                                    >
                                        <div className="tn-finding-indicator">
                                            <span className={`tn-finding-dot ${item.typeClass}`} />
                                        </div>
                                        <div className="tn-finding-body">
                                            <div className="tn-finding-head">
                                                <span className="tn-finding-type">{item.type}</span>
                                                <span className="tn-finding-name">{item.title}</span>
                                            </div>
                                            <p className="tn-finding-desc">{item.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="tn-req-intel-cta-row">
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

                    {/* RIGHT COLUMN: Product Interaction with Annotation UI */}
                    <div className="tn-req-intel-workspace">
                        <div className="tn-annotation-canvas">
                            {/* Editor Header Bar */}
                            <div className="tn-ann-canvas-header">
                                <div className="tn-ann-file-meta">
                                    <span className="tn-ann-doc-id">REQ-142</span>
                                    <span className="tn-ann-sep">/</span>
                                    <span className="tn-ann-doc-name">Password Reset Specification</span>
                                </div>
                                <span className="tn-ann-status-tag">Deterministic Audit Complete</span>
                            </div>

                            {/* Requirement Text with Annotation Highlights */}
                            <div className="tn-ann-editor-surface">
                                <span className="tn-ann-editor-line-num">01</span>
                                <div className="tn-ann-editor-content">
                                    <span className="tn-ann-lead-clause">Feature Specification: Password Recovery</span>
                                    <p className="tn-ann-text-para">
                                        <span className={`tn-highlight-term ${selectedAnnotationId === 'an-4' ? 'is-active' : ''}`} onClick={() => setSelectedAnnotationId('an-4')}>
                                            Users can reset
                                        </span>{' '}
                                        <span className={`tn-highlight-term ${selectedAnnotationId === 'an-3' ? 'is-active' : ''}`} onClick={() => setSelectedAnnotationId('an-3')}>
                                            their password
                                        </span>{' '}
                                        using{' '}
                                        <span className={`tn-highlight-term ${selectedAnnotationId === 'an-1' ? 'is-active' : ''}`} onClick={() => setSelectedAnnotationId('an-1')}>
                                            their registered email address
                                        </span>
                                        .
                                    </p>
                                </div>
                            </div>

                            {/* ─── ANNOTATION UI (Direct Line Callout System) ─── */}
                            <div className="tn-annotation-callout-box">
                                <div className="tn-ann-stem-line" aria-hidden="true">
                                    <div className="tn-ann-stem-corner" />
                                    <div className="tn-ann-stem-vert" />
                                    <div className="tn-ann-stem-node" />
                                </div>

                                <div className="tn-ann-callout-panel">
                                    <div className="tn-ann-callout-head">
                                        <span className={`tn-ann-badge ${activeAnnotation.typeClass}`}>
                                            {activeAnnotation.type.toUpperCase()} DETECTED
                                        </span>
                                        <span className="tn-ann-target-ref">Target: “{activeAnnotation.targetPhrase}”</span>
                                    </div>

                                    <h3 className="tn-ann-callout-title">{activeAnnotation.title}</h3>
                                    <p className="tn-ann-callout-text">{activeAnnotation.desc}</p>

                                    <div className="tn-ann-action-box">
                                        <span className="tn-ann-action-label">SYNTHESIZED ACCEPTANCE RULE:</span>
                                        <p className="tn-ann-action-code">{activeAnnotation.action}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Status Proof Footer */}
                            <div className="tn-ann-canvas-footer">
                                <div className="tn-ann-footer-stat">
                                    <span className="tn-stat-num">4</span>
                                    <span className="tn-stat-lbl">Implicit gaps resolved</span>
                                </div>
                                <div className="tn-ann-footer-divider" />
                                <div className="tn-ann-footer-stat">
                                    <span className="tn-stat-num">100%</span>
                                    <span className="tn-stat-lbl">Specification coverage mapped</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default RequirementTransformation;
