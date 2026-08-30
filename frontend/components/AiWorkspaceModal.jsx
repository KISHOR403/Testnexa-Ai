import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Sparkles, Lightbulb, ChevronDown, Trash2, Clipboard,
    Globe, Smartphone, Server, Gauge, Target, Rocket,
    Shield, Check, AlertTriangle, X, CheckCircle2, Loader2,
    CheckCheck, Layers, Terminal, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/AiWorkspaceModal.css';

const EXAMPLE_REQUIREMENTS = [
    {
        title: 'Password reset flow',
        text: 'Users can reset their password using their registered email address. The system sends a one-time reset link valid for 15 minutes. Link expires after single use and rate limits multiple requests.'
    },
    {
        title: 'User authentication flow',
        text: 'As a user, I want to log in with my email and password with optional 2FA SMS code. Ensure lockout after 5 failed attempts, password complexity validation, and session token renewal.'
    },
    {
        title: 'Payment processing',
        text: 'Process credit card and Stripe checkout with 3D Secure verification. Handle successful charges, card declines, insufficient funds, network timeouts, and idempotent retry dispatches.'
    },
    {
        title: 'API rate limiting',
        text: 'Endpoint /api/v1/checkout enforces rate limit of 60 requests/min per IP. Returns HTTP 429 Too Many Requests with Retry-After header and logs suspicious burst traffic to telemetry.'
    },
    {
        title: 'Shopping cart & coupon logic',
        text: 'Customers can add products, update quantities, and apply discount codes. Cart recalculates subtotal, shipping fees, tax, and rejects expired or minimum-spend invalid coupons.'
    },
    {
        title: 'Secure file upload',
        text: 'Users can upload documents in PDF, PNG, or JPEG format up to 10MB. System validates file magic bytes, scans for malware, generates thumbnail previews, and enforces tenant isolation.'
    }
];

const GENERATION_STEPS = [
    { label: 'Understanding requirement & extracting entities', time: 800 },
    { label: 'Detecting ambiguities & constraint gaps', time: 1800 },
    { label: 'Identifying high-risk & security vectors', time: 2900 },
    { label: 'Generating prioritized test scenarios', time: 4200 },
    { label: 'Building requirement traceability matrix', time: 5400 }
];

const AiWorkspaceModal = ({
    isOpen,
    onClose,
    requirement,
    setRequirement,
    settings,
    setSettings,
    isGenerating,
    onGenerate,
    onOpenAuth
}) => {
    const { isAuthenticated, guestGenerationsUsed, GUEST_LIMIT } = useAuth();
    const [showExamples, setShowExamples] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [progressPercent, setProgressPercent] = useState(15);
    const modalRef = useRef(null);
    const textareaRef = useRef(null);
    const maxLength = 2000;

    // Focus management on open
    useEffect(() => {
        if (isOpen) {
            setShowDiscardConfirm(false);
            setShowExamples(false);
            const timer = setTimeout(() => {
                if (textareaRef.current && !isGenerating) {
                    textareaRef.current.focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen, isGenerating]);

    // Handle Escape key & Focus Trap
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleRequestClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, requirement, isGenerating]);

    // In-workspace generation progress timer
    useEffect(() => {
        if (!isGenerating) {
            setActiveStepIndex(0);
            setProgressPercent(15);
            return;
        }

        const intervals = GENERATION_STEPS.map((step, idx) => {
            return setTimeout(() => {
                setActiveStepIndex(idx);
                setProgressPercent(Math.min(20 + idx * 19, 95));
            }, step.time);
        });

        return () => {
            intervals.forEach(clearTimeout);
        };
    }, [isGenerating]);

    const handleRequestClose = useCallback(() => {
        if (isGenerating) return; // Prevent closing while generating
        if (requirement.trim().length > 0) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    }, [isGenerating, requirement, onClose]);

    const handleConfirmDiscard = () => {
        setRequirement('');
        setShowDiscardConfirm(false);
        onClose();
    };

    const handleSelectExample = (exampleText) => {
        setRequirement(exampleText);
        setShowExamples(false);
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setRequirement((prev) => (prev ? prev + '\n' + text : text).slice(0, maxLength));
        } catch (err) {
            console.error('Clipboard paste failed:', err);
        }
    };

    if (!isOpen) return null;

    const charCount = requirement.length;
    const qualityLevel = charCount < 40 ? 'low' : charCount < 120 ? 'medium' : 'high';
    const qualityHint = {
        low: 'Add more detail for richer test cases',
        medium: 'Good clarity — ready for AI analysis',
        high: 'High detail — rich edge cases & risk detection'
    }[qualityLevel];

    return (
        <div
            className="tn-workspace-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    handleRequestClose();
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-title"
        >
            <div className="tn-workspace-modal" ref={modalRef}>
                {/* ─── Header ─── */}
                <header className="tn-workspace-header">
                    <div className="tn-workspace-header__left">
                        <div className="tn-workspace-header__brand">
                            <img
                                src="/testnexa-logo.png"
                                alt="Testnexa Logo"
                                className="tn-workspace-header__logo"
                            />
                            <span>Testnexa AI</span>
                        </div>
                        <span className="tn-workspace-header__sep">/</span>
                        <div className="tn-workspace-header__badge">
                            <span className="tn-workspace-header__badge-dot" />
                            <span>AI Workspace</span>
                        </div>
                    </div>

                    <div className="tn-workspace-header__right">
                        {!isGenerating && (
                            <div className="tn-workspace-examples-wrap">
                                <button
                                    type="button"
                                    className={`tn-workspace-btn-ghost ${showExamples ? 'is-active' : ''}`}
                                    onClick={() => setShowExamples(!showExamples)}
                                    aria-expanded={showExamples}
                                    id="workspace-examples-btn"
                                >
                                    <Lightbulb size={14} />
                                    <span>Examples</span>
                                    <ChevronDown
                                        size={13}
                                        style={{
                                            transform: showExamples ? 'rotate(180deg)' : 'none',
                                            transition: 'transform 0.15s'
                                        }}
                                    />
                                </button>

                                {showExamples && (
                                    <div className="tn-workspace-examples-menu">
                                        <div className="tn-workspace-examples-menu__label">
                                            Quick Templates
                                        </div>
                                        {EXAMPLE_REQUIREMENTS.map((ex, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                className="tn-workspace-example-item"
                                                onClick={() => handleSelectExample(ex.text)}
                                            >
                                                <Sparkles size={13} />
                                                <span>{ex.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            className="tn-workspace-close-btn"
                            onClick={handleRequestClose}
                            title="Close Workspace (Esc)"
                            aria-label="Close Workspace"
                            disabled={isGenerating}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>

                {/* ─── Main Content ─── */}
                {isGenerating ? (
                    /* ─── IN-WORKSPACE AI PROCESSING STATE ─── */
                    <div className="tn-workspace-processing-view">
                        <div className="tn-workspace-processing-badge">
                            <Sparkles size={13} />
                            <span>AI Test Engine In Progress</span>
                        </div>

                        <div>
                            <h2 className="tn-workspace-processing-title">
                                Analyzing requirement...
                            </h2>
                            <p className="tn-workspace-processing-sub">
                                Synthesizing functional flows, boundary conditions, edge cases, and compliance rules.
                            </p>
                        </div>

                        <div className="tn-workspace-progress-bar-wrap">
                            <div
                                className="tn-workspace-progress-bar-fill"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        <div className="tn-workspace-stepper-card">
                            {GENERATION_STEPS.map((step, idx) => {
                                const isCompleted = idx < activeStepIndex;
                                const isActive = idx === activeStepIndex;
                                return (
                                    <div
                                        key={idx}
                                        className={`tn-workspace-step-row ${
                                            isCompleted ? 'is-completed' : isActive ? 'is-active' : ''
                                        }`}
                                    >
                                        <div className="tn-workspace-step-indicator">
                                            {isCompleted ? (
                                                <Check size={14} />
                                            ) : isActive ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <span>{idx + 1}</span>
                                            )}
                                        </div>
                                        <span className="tn-workspace-step-label">{step.label}</span>
                                        <span className="tn-workspace-step-status">
                                            {isCompleted ? 'Done' : isActive ? 'Processing' : 'Queued'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* ─── NORMAL WORKSPACE INPUT STATE ─── */
                    <div className="tn-workspace-body">
                        {/* Requirement Input Area */}
                        <div className="tn-workspace-prompt-section">
                            <div className="tn-workspace-prompt-header">
                                <div>
                                    <h2 id="workspace-title" className="tn-workspace-prompt-title">
                                        Describe your requirement
                                    </h2>
                                    <p className="tn-workspace-prompt-subtitle">
                                        The AI analyzes clarity, risks & designs tests
                                    </p>
                                </div>
                            </div>

                            <div className="tn-workspace-textarea-wrap">
                                <textarea
                                    ref={textareaRef}
                                    className="tn-workspace-textarea"
                                    value={requirement}
                                    onChange={(e) => setRequirement(e.target.value)}
                                    maxLength={maxLength}
                                    placeholder={
                                        "Describe your requirement in natural language...\n\nExample: Users can reset their password using their registered email address..."
                                    }
                                    aria-label="Requirement description"
                                />

                                <div className="tn-workspace-textarea-actions">
                                    <button
                                        type="button"
                                        className="tn-workspace-icon-btn"
                                        onClick={handlePaste}
                                        title="Paste from clipboard"
                                        aria-label="Paste from clipboard"
                                    >
                                        <Clipboard size={14} />
                                    </button>
                                    {requirement.length > 0 && (
                                        <button
                                            type="button"
                                            className="tn-workspace-icon-btn is-danger"
                                            onClick={() => setRequirement('')}
                                            title="Clear text"
                                            aria-label="Clear text"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="tn-workspace-quality-bar">
                                    <span className="tn-workspace-char-count">
                                        {charCount} / {maxLength}
                                    </span>
                                    {charCount > 0 && (
                                        <span
                                            className={`tn-workspace-quality-indicator quality-${qualityLevel}`}
                                        >
                                            <Sparkles size={11} />
                                            {qualityHint}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Controls Row: Context, Depth, AI Analyzes */}
                        <div className="tn-workspace-config-row">
                            {/* Context */}
                            <div className="tn-workspace-config-group">
                                <span className="tn-workspace-config-label">CONTEXT</span>
                                <div className="tn-workspace-segmented" role="radiogroup" aria-label="Context">
                                    {[
                                        { id: 'web', label: 'Web', icon: Globe },
                                        { id: 'mobile', label: 'Mobile', icon: Smartphone },
                                        { id: 'api', label: 'API', icon: Server }
                                    ].map(({ id, label, icon: Icon }) => {
                                        const isActive = (settings.type || 'web').toLowerCase() === id;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                role="radio"
                                                aria-checked={isActive}
                                                className={`tn-workspace-segment-btn ${isActive ? 'is-active' : ''}`}
                                                onClick={() => setSettings({ ...settings, type: id })}
                                            >
                                                <Icon size={13} />
                                                <span>{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Depth */}
                            <div className="tn-workspace-config-group">
                                <span className="tn-workspace-config-label">DEPTH</span>
                                <div className="tn-workspace-segmented" role="radiogroup" aria-label="Analysis Depth">
                                    {[
                                        { id: 'Essential', label: 'Essential', hint: 'Fast baseline coverage' },
                                        { id: 'Standard', label: 'Standard', hint: 'Balanced coverage' },
                                        { id: 'Comprehensive', label: 'Comprehensive', hint: 'Deep QA analysis' }
                                    ].map(({ id, label, hint }) => {
                                        const isActive = (settings.level || 'Standard') === id;
                                        return (
                                            <div key={id} className="tn-workspace-depth-pill" title={hint}>
                                                <button
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={isActive}
                                                    className={`tn-workspace-segment-btn ${isActive ? 'is-active' : ''}`}
                                                    onClick={() => setSettings({ ...settings, level: id })}
                                                >
                                                    <span>{label}</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* AI Analyzes (Informational) */}
                            <div className="tn-workspace-config-group">
                                <span className="tn-workspace-config-label">AI ANALYZES</span>
                                <div className="tn-workspace-tags-list">
                                    {['Clarity', 'Ambiguities', 'Risk Areas', 'Edge Cases'].map((tag) => (
                                        <span key={tag} className="tn-workspace-tag">
                                            <CheckCircle2 size={12} />
                                            <span>{tag}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer / Trigger */}
                        <footer className="tn-workspace-footer">
                            <div className="tn-workspace-pipeline-summary">
                                <Sparkles size={14} />
                                <div className="tn-workspace-pipeline-steps">
                                    <span>Requirement understanding</span>
                                    <span className="sep">→</span>
                                    <span>Ambiguity detection</span>
                                    <span className="sep">→</span>
                                    <span>Risk assessment</span>
                                    <span className="sep">→</span>
                                    <span>Test synthesis</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    className="tn-workspace-generate-btn"
                                    onClick={onGenerate}
                                    disabled={!requirement.trim() || isGenerating}
                                    id="workspace-generate-submit-btn"
                                >
                                    <Sparkles size={16} />
                                    <span>✦ Analyze & Generate Tests</span>
                                </button>
                            </div>
                        </footer>
                    </div>
                )}

                {/* ─── Discard Confirmation Modal ─── */}
                {showDiscardConfirm && (
                    <div className="tn-discard-modal-overlay">
                        <div className="tn-discard-card">
                            <div className="tn-discard-icon-wrap">
                                <AlertTriangle size={22} />
                            </div>
                            <h3 className="tn-discard-title">Discard this requirement?</h3>
                            <p className="tn-discard-desc">
                                You have unsaved text in your requirement draft. If you close now, your changes will be discarded.
                            </p>
                            <div className="tn-discard-actions">
                                <button
                                    type="button"
                                    className="tn-discard-btn-cancel"
                                    onClick={() => setShowDiscardConfirm(false)}
                                >
                                    Continue Editing
                                </button>
                                <button
                                    type="button"
                                    className="tn-discard-btn-confirm"
                                    onClick={handleConfirmDiscard}
                                >
                                    Discard
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiWorkspaceModal;
