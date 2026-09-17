import React, { useState } from 'react';
import {
    FileText,
    ArrowDown,
    Check,
    AlertTriangle,
    Shield,
    Layers,
    CheckCircle2,
    Sliders,
    Search
} from 'lucide-react';

export const RequirementIntelligence = () => {
    const [activeTab, setActiveTab] = useState('ambiguities'); // 'ambiguities' | 'criteria' | 'rules' | 'security' | 'edge'

    return (
        <section id="features" className="tn-section tn-req-intelligence-section" aria-labelledby="intelligence-heading">
            <div className="tn-container">
                <div className="tn-section-header">
                    <span className="tn-kicker">Requirement Analysis</span>
                    <h2 id="intelligence-heading" className="tn-section-title">
                        Understand the requirement before writing tests.
                    </h2>
                    <p className="tn-section-subtitle">
                        TestNexa parses ambiguous product specs, surfaces unstated assumptions, and translates vague requirements into verifiable conditions.
                    </p>
                </div>

                {/* ─── 3-Stage Pipeline Layout ─── */}
                <div className="tn-pipeline-layout">
                    {/* Stage 1: Raw Requirement */}
                    <div className="tn-pipe-block tn-pipe-block--raw">
                        <div className="tn-pipe-block__header">
                            <span className="tn-pipe-step-tag">01 &bull; INPUT</span>
                            <span className="tn-pipe-title">Raw Requirement</span>
                        </div>
                        <div className="tn-pipe-block__content">
                            <div className="tn-raw-req-card">
                                <span className="tn-spec-source">User Story &bull; Jira PROD-842</span>
                                <p className="tn-raw-text">
                                    "Users can reset their password using their registered email address."
                                </p>
                                <div className="tn-raw-meta">
                                    <span className="tn-meta-flag text-amber">
                                        <AlertTriangle size={12} />
                                        <span>4 Critical details missing from original spec</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Connector Arrow */}
                    <div className="tn-pipe-arrow-wrap" aria-hidden="true">
                        <div className="tn-pipe-line" />
                        <div className="tn-pipe-arrow-icon"><ArrowDown size={18} /></div>
                        <div className="tn-pipe-line" />
                    </div>

                    {/* Stage 2: Requirement Analysis */}
                    <div className="tn-pipe-block tn-pipe-block--analysis">
                        <div className="tn-pipe-block__header">
                            <span className="tn-pipe-step-tag">02 &bull; DECONSTRUCTION</span>
                            <span className="tn-pipe-title">Requirement Analysis</span>
                        </div>
                        <div className="tn-pipe-block__content">
                            {/* Interactive Analysis Pills */}
                            <div className="tn-analysis-pills-bar" role="tablist">
                                {[
                                    { id: 'ambiguities', label: 'Ambiguities (2)' },
                                    { id: 'criteria', label: 'Missing Criteria (3)' },
                                    { id: 'rules', label: 'Business Rules (4)' },
                                    { id: 'security', label: 'Security (3)' },
                                    { id: 'edge', label: 'Edge Cases (4)' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        role="tab"
                                        aria-selected={activeTab === tab.id}
                                        className={`tn-analysis-pill-btn ${activeTab === tab.id ? 'is-active' : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Analysis Panel Body */}
                            <div className="tn-analysis-details-card">
                                {activeTab === 'ambiguities' && (
                                    <div className="tn-analysis-item-list">
                                        <div className="tn-analysis-row">
                                            <div className="tn-row-icon tn-row-icon--warn"><AlertTriangle size={14} /></div>
                                            <div>
                                                <strong>Token Lifetime Undefined</strong>
                                                <p>Specification does not declare how long the reset link remains valid. Defaulting to 15-minute standard.</p>
                                            </div>
                                        </div>
                                        <div className="tn-analysis-row">
                                            <div className="tn-row-icon tn-row-icon--warn"><AlertTriangle size={14} /></div>
                                            <div>
                                                <strong>Unregistered Email Feedback Rule Missing</strong>
                                                <p>Spec doesn't specify if unregistered emails receive generic confirmation or explicit error (enumeration risk).</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'criteria' && (
                                    <div className="tn-analysis-item-list">
                                        <div className="tn-analysis-row">
                                            <div className="tn-row-icon tn-row-icon--check"><Check size={14} /></div>
                                            <div>
                                                <strong>Single-Use Invalidation Assertion</strong>
                                                <p>Token must be invalidated immediately upon first successful submission; second submission must return HTTP 400.</p>
                                            </div>
                                        </div>
                                        <div className="tn-analysis-row">
                                            <div className="tn-row-icon tn-row-icon--check"><Check size={14} /></div>
                                            <div>
                                                <strong>Password Complexity Constraints</strong>
                                                <p>New password must meet min 8 chars, mixed case, number, symbol; cannot equal previous password hash.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'rules' && (
                                    <div className="tn-analysis-item-list">
                                        <div className="tn-analysis-row">
                                            <div className="tn-row-icon tn-row-icon--check"><Check size={14} /></div>
                                            <div>
                                                <strong>Session Revocation Rule</strong>
                                                <p>Resetting password must invalidate all other active sessions for this user across devices.</p>
                                            </div>
                                        </div>
                                        <div className="tn-analysis-row">
                                            <div className="tn-row-icon tn-row-icon--check"><Check size={14} /></div>
                                            <div>
                                                <strong>Transactional Email Queue</strong>
                                                <p>Delivery dispatch must be idempotent and non-blocking with 10s maximum delivery SLA.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'security' && (
                                    <div className="tn-analysis-item-list">
                                        <div className="tn-analysis-row">
                                            <div className="tn-row-icon tn-row-icon--sec"><Shield size={14} /></div>
                                            <div>
                                                <strong>Anti-Enumeration Uniform Timing</strong>
                                                <p>Maintain uniform response latency (&lt;35ms variance) for both valid and invalid email submissions.</p>
                                            </div>
                                        </div>
                                        <div className="tn-analysis-row">
                                            <div className="tn-row-icon tn-row-icon--sec"><Shield size={14} /></div>
                                            <div>
                                                <strong>Rate Limiting & Abuse Prevention</strong>
                                                <p>Enforce 5 requests per IP per minute threshold with HTTP 429 and Retry-After header.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'edge' && (
                                    <div className="tn-analysis-item-list">
                                        <div className="tn-analysis-row">
                                            <div className="tn-row-icon tn-row-icon--warn"><AlertTriangle size={14} /></div>
                                            <div>
                                                <strong>Concurrent Token Redemption</strong>
                                                <p>Handle race condition where identical reset link is clicked simultaneously in two separate browsers.</p>
                                            </div>
                                        </div>
                                        <div className="tn-analysis-row">
                                            <div className="tn-row-icon tn-row-icon--warn"><AlertTriangle size={14} /></div>
                                            <div>
                                                <strong>Email Change During Pending Reset</strong>
                                                <p>If user email is modified while reset token is pending, invalidate previous token immediately.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Connector Arrow */}
                    <div className="tn-pipe-arrow-wrap" aria-hidden="true">
                        <div className="tn-pipe-line" />
                        <div className="tn-pipe-arrow-icon"><ArrowDown size={18} /></div>
                        <div className="tn-pipe-line" />
                    </div>

                    {/* Stage 3: Structured Requirement */}
                    <div className="tn-pipe-block tn-pipe-block--structured">
                        <div className="tn-pipe-block__header">
                            <span className="tn-pipe-step-tag">03 &bull; OUTPUT</span>
                            <span className="tn-pipe-title">Structured Requirement Specification</span>
                        </div>
                        <div className="tn-pipe-block__content">
                            <div className="tn-structured-spec-card">
                                <div className="tn-spec-condition">
                                    <span className="tn-cond-tag">PRECONDITION</span>
                                    <p>User exists with verified email; rate limit not exceeded for client IP.</p>
                                </div>
                                <div className="tn-spec-condition">
                                    <span className="tn-cond-tag">TRIGGER</span>
                                    <p>User submits registered email address to <code>POST /api/auth/forgot-password</code>.</p>
                                </div>
                                <div className="tn-spec-condition">
                                    <span className="tn-cond-tag">EXPECTED BEHAVIOR</span>
                                    <p>Returns HTTP 200 with generic success message; generates single-use token valid for 900 seconds; dispatches templated recovery email.</p>
                                </div>
                                <div className="tn-spec-condition">
                                    <span className="tn-cond-tag">BOUNDARY ASSERTIONS</span>
                                    <p>Token invalid beyond 15m; token burned on use; 6th request in 60s returns HTTP 429; non-registered email returns identical message.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default RequirementIntelligence;
