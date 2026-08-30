import React, { useState } from 'react';
import { ArrowRight, Sparkles, Check, Shield, CheckCircle2, FileText, Zap, ChevronRight, Terminal, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import useScrollReveal from '../hooks/useScrollReveal';

const PREVIEW_TESTS = [
    {
        id: 'TC-001',
        title: 'Reset password with valid registered email',
        scenario: 'Verify standard password recovery email dispatch',
        type: 'Functional',
        priority: 'High',
        status: 'Approved'
    },
    {
        id: 'TC-002',
        title: 'Reset password with invalid email format',
        scenario: 'Validate client & server RFC 5322 compliance',
        type: 'Negative',
        priority: 'Major',
        status: 'Approved'
    },
    {
        id: 'TC-004',
        title: 'Use expired reset link beyond TTL',
        scenario: 'Verify token expiration window strictly blocks credential update',
        type: 'Edge Case',
        priority: 'Critical',
        status: 'Verified'
    },
    {
        id: 'TC-005',
        title: 'Reuse previously consumed reset token',
        scenario: 'Prevent replay attacks by enforcing one-time nonce invalidation',
        type: 'Security',
        priority: 'Critical',
        status: 'Protected'
    }
];

const CtaProductPreview = () => {
    const [activeTc, setActiveTc] = useState(PREVIEW_TESTS[2]); // TC-004 active by default

    return (
        <div className="tn-cta-preview-wrap">
            <div className="tn-cta-preview-glow" aria-hidden="true" />
            
            {/* Main Window Card */}
            <div className="tn-cta-window">
                {/* Window Chrome Header */}
                <div className="tn-cta-window__header">
                    <div className="tn-cta-window__controls">
                        <span className="tn-cta-dot tn-cta-dot--red" />
                        <span className="tn-cta-dot tn-cta-dot--yellow" />
                        <span className="tn-cta-dot tn-cta-dot--green" />
                    </div>
                    
                    <div className="tn-cta-window__title">
                        <span className="tn-cta-crumb-root">Test Suite</span>
                        <ChevronRight size={12} className="tn-cta-crumb-sep" />
                        <span className="tn-cta-crumb-active">Password Reset Suite</span>
                    </div>

                    <div className="tn-cta-window__tags">
                        <span className="tn-cta-tag tn-cta-tag--req">REQ-001</span>
                        <span className="tn-cta-tag tn-cta-tag--cov">
                            <span className="tn-cta-pulse-dot" /> 94% Coverage
                        </span>
                    </div>
                </div>

                {/* AI Banner */}
                <div className="tn-cta-ai-banner">
                    <div className="tn-cta-ai-banner__icon">
                        <Sparkles size={14} />
                    </div>
                    <div className="tn-cta-ai-banner__text">
                        <strong>AI Test Engine Active:</strong> 5 prioritized scenarios generated &bull; 0 critical gaps
                    </div>
                    <span className="tn-cta-ai-banner__pill">
                        <Zap size={11} /> 1.2s
                    </span>
                </div>

                {/* Test Cases Table / List */}
                <div className="tn-cta-test-list">
                    {PREVIEW_TESTS.map((test) => {
                        const isSelected = activeTc.id === test.id;
                        return (
                            <div
                                key={test.id}
                                className={`tn-cta-test-row ${isSelected ? 'is-selected' : ''}`}
                                onClick={() => setActiveTc(test)}
                            >
                                <div className="tn-cta-test-row__check">
                                    <Check size={12} />
                                </div>
                                <span className="tn-cta-test-row__id">{test.id}</span>
                                <div className="tn-cta-test-row__body">
                                    <span className="tn-cta-test-row__title">{test.title}</span>
                                    <span className="tn-cta-test-row__scenario">{test.scenario}</span>
                                </div>
                                <span className={`tn-cta-chip tn-cta-chip--${test.type.toLowerCase().replace(/\s+/g, '')}`}>
                                    {test.type}
                                </span>
                                <span className={`tn-cta-prio tn-cta-prio--${test.priority.toLowerCase()}`}>
                                    {test.priority}
                                </span>
                                <span className="tn-cta-status">
                                    <span className="tn-cta-status-dot" />
                                    {test.status}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Floating Elevated Detail Card */}
                <div className="tn-cta-detail-card">
                    <div className="tn-cta-detail-card__header">
                        <div className="tn-cta-detail-card__badge-group">
                            <span className="tn-cta-detail-id">{activeTc.id}</span>
                            <span className={`tn-cta-chip tn-cta-chip--${activeTc.type.toLowerCase().replace(/\s+/g, '')}`}>
                                {activeTc.type}
                            </span>
                            <span className={`tn-cta-prio tn-cta-prio--${activeTc.priority.toLowerCase()}`}>
                                {activeTc.priority}
                            </span>
                        </div>
                        <span className="tn-cta-verified-badge">
                            <CheckCircle2 size={13} /> AI Verified
                        </span>
                    </div>

                    <h4 className="tn-cta-detail-card__title">{activeTc.title}</h4>

                    <div className="tn-cta-detail-card__step">
                        <span className="tn-cta-step-num">01</span>
                        <div className="tn-cta-step-content">
                            <strong>Action:</strong> Open password reset URL with expired token
                            <span className="tn-cta-step-exp"><strong>Expected:</strong> HTTP 400 Bad Request (TOKEN_EXPIRED)</span>
                        </div>
                    </div>

                    <div className="tn-cta-detail-card__footer">
                        <span className="tn-cta-meta-item">
                            <Shield size={12} /> RFC 5322 & OWASP Checked
                        </span>
                        <span className="tn-cta-meta-item">
                            <Terminal size={12} /> Gherkin & Postman Ready
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FinalCTA = ({ onOpenGenerator }) => {
    const reveal = useScrollReveal({ threshold: 0.12 });

    return (
        <section className="tn-cta" aria-labelledby="cta-heading">
            <div
                ref={reveal.ref}
                className={`tn-container tn-cta__layout scroll-reveal-fade-up ${reveal.isVisible ? 'revealed' : ''}`}
            >
                <div className="tn-cta__content">
                    <div className="tn-cta__badge">
                        <span className="tn-cta__badge-dot" />
                        <Sparkles size={13} className="tn-cta__badge-sparkle" />
                        <span>READY WHEN YOU ARE</span>
                    </div>
                    
                    <h2 id="cta-heading" className="tn-cta__headline">
                        Stop writing test cases <span className="tn-gradient-text">from scratch.</span>
                    </h2>
                    
                    <p className="tn-cta__subtext">
                        Turn your next requirement into a complete, prioritized test suite with Testnexa AI.
                    </p>
                    
                    <div className="tn-cta__actions">
                        {typeof onOpenGenerator === 'function' ? (
                            <button
                                type="button"
                                className="tn-btn tn-btn--primary tn-btn--lg tn-cta__btn-primary"
                                onClick={onOpenGenerator}
                            >
                                <span>Generate Test Suite</span>
                                <ArrowRight size={18} className="tn-cta__btn-arrow" />
                            </button>
                        ) : (
                            <Link to="/login" className="tn-btn tn-btn--primary tn-btn--lg tn-cta__btn-primary">
                                <span>Try Testnexa AI</span>
                                <ArrowRight size={18} className="tn-cta__btn-arrow" />
                            </Link>
                        )}
                        <a href="#features" className="tn-btn tn-btn--secondary tn-btn--lg tn-cta__btn-secondary">
                            Explore Features
                        </a>
                    </div>

                    <div className="tn-cta__trust-pills">
                        <div className="tn-cta__trust-item">
                            <CheckCircle2 size={14} className="tn-cta__trust-icon" />
                            <span>Instant Gherkin & API Steps</span>
                        </div>
                        <div className="tn-cta__trust-item">
                            <CheckCircle2 size={14} className="tn-cta__trust-icon" />
                            <span>94%+ Requirement Coverage</span>
                        </div>
                        <div className="tn-cta__trust-item">
                            <CheckCircle2 size={14} className="tn-cta__trust-icon" />
                            <span>Zero Setup Required</span>
                        </div>
                    </div>
                </div>

                <div className="tn-cta__product" aria-hidden="true">
                    <CtaProductPreview />
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
