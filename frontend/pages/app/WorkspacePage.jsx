import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles, Lightbulb, ChevronDown, Trash2, Clipboard,
    Globe, Smartphone, Server, Gauge, Target, Rocket,
    Check, AlertTriangle, CheckCircle2, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';
import { apiService } from '../../services/apiService';
import '../../styles/app/WorkspacePage.css';

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
    { label: 'Understanding requirement & extracting entities', time: 700 },
    { label: 'Detecting ambiguities & constraint gaps', time: 1600 },
    { label: 'Assessing high-risk & security vectors', time: 2600 },
    { label: 'Generating prioritized test scenarios', time: 3800 },
    { label: 'Building test cases & assertions', time: 5000 },
    { label: 'Calculating requirement coverage map', time: 6200 }
];

const WorkspacePage = () => {
    const navigate = useNavigate();
    const { isAuthenticated, canGenerateAsGuest, incrementGuestUsage } = useAuth();
    const { saveToHistory } = useHistory();

    const [requirement, setRequirement] = useState('');
    const [settings, setSettings] = useState({
        type: 'web',
        level: 'Standard',
        language: 'english'
    });

    const [showExamples, setShowExamples] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [progressPercent, setProgressPercent] = useState(10);
    const [error, setError] = useState(null);
    const textareaRef = useRef(null);
    const maxLength = 2000;

    // In-page generation progress stepper
    useEffect(() => {
        if (!isGenerating) {
            setActiveStepIndex(0);
            setProgressPercent(10);
            return;
        }

        const intervals = GENERATION_STEPS.map((step, idx) => {
            return setTimeout(() => {
                setActiveStepIndex(idx);
                setProgressPercent(Math.min(18 + idx * 16, 96));
            }, step.time);
        });

        return () => intervals.forEach(clearTimeout);
    }, [isGenerating]);

    const handleSelectExample = (text) => {
        setRequirement(text);
        setShowExamples(false);
        if (textareaRef.current) textareaRef.current.focus();
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setRequirement((prev) => (prev ? prev + '\n' + text : text).slice(0, maxLength));
        } catch (err) {
            console.error('Paste failed:', err);
        }
    };

    const handleGenerate = async () => {
        if (!requirement.trim()) return;

        if (!isAuthenticated) {
            if (!canGenerateAsGuest()) {
                navigate('/login');
                return;
            }
            incrementGuestUsage();
        }

        setIsGenerating(true);
        setError(null);

        try {
            const generatedSuite = await apiService.generateTestSuite(requirement, settings);
            
            // Create a slug for the generated suite URL
            const slug = requirement.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30).replace(/^-|-$/g, '') || 'suite';
            const suiteId = `${slug}-${Date.now().toString().slice(-4)}`;

            // Save to history so it's accessible across the app
            saveToHistory(generatedSuite, requirement, settings);

            // Navigate directly to the Test Suite page in the application shell
            setTimeout(() => {
                navigate(`/app/test-suites/${suiteId}`, {
                    state: {
                        suite: generatedSuite,
                        prompt: requirement,
                        settings: settings
                    }
                });
            }, 800);
        } catch (err) {
            console.error('Generation error:', err);
            setError(err.message || 'Failed to generate test suite.');
            setIsGenerating(false);
        }
    };

    const charCount = requirement.length;
    const qualityLevel = charCount < 40 ? 'low' : charCount < 120 ? 'medium' : 'high';
    const qualityHint = {
        low: 'Add more detail for richer test coverage',
        medium: 'Good clarity — ready for analysis',
        high: 'High detail — rich edge case & risk detection'
    }[qualityLevel];

    return (
        <div className="app-workspace-container">
            {/* Header Hero */}
            <div className="app-workspace-hero">
                <div>
                    <div className="app-workspace-eyebrow">
                        <Sparkles size={14} />
                        <span>AI WORKSPACE</span>
                    </div>
                    <h1 className="app-workspace-title">Describe your requirement</h1>
                    <p className="app-workspace-subtitle">
                        The AI analyzes clarity, risks & designs production-ready test suites
                    </p>
                </div>

                {!isGenerating && (
                    <div style={{ position: 'relative' }}>
                        <button
                            type="button"
                            className="app-workspace-icon-btn"
                            style={{ width: 'auto', padding: '0.45rem 0.85rem', gap: '0.4rem', fontSize: '0.82rem', fontWeight: '500' }}
                            onClick={() => setShowExamples(!showExamples)}
                        >
                            <Lightbulb size={14} />
                            <span>Quick Examples</span>
                            <ChevronDown size={13} style={{ transform: showExamples ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                        </button>

                        {showExamples && (
                            <div className="app-workspace-examples-menu">
                                <div className="app-workspace-examples-menu__label">Quick Templates</div>
                                {EXAMPLE_REQUIREMENTS.map((ex, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className="app-workspace-example-item"
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
            </div>

            {error && (
                <div className="form-error-banner animate-fade-in">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {isGenerating ? (
                /* ─── In-Page Processing State ─── */
                <div className="app-workspace-processing">
                    <div className="app-workspace-processing-badge">
                        <Sparkles size={14} />
                        <span>Synthesizing Test Suite</span>
                    </div>

                    <div>
                        <h2 className="app-workspace-processing-title">Analyzing requirement...</h2>
                        <p className="app-workspace-processing-sub">
                            Parsing functional rules, identifying risk vectors, and synthesizing execution-ready test cases.
                        </p>
                    </div>

                    <div className="tn-workspace-progress-bar-wrap">
                        <div className="tn-workspace-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                    </div>

                    <div className="app-workspace-stepper">
                        {GENERATION_STEPS.map((step, idx) => {
                            const isCompleted = idx < activeStepIndex;
                            const isActive = idx === activeStepIndex;
                            return (
                                <div
                                    key={idx}
                                    className={`app-workspace-step ${isCompleted ? 'is-completed' : isActive ? 'is-active' : ''}`}
                                >
                                    <div className="app-workspace-step-num">
                                        {isCompleted ? (
                                            <Check size={14} />
                                        ) : isActive ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <span>{idx + 1}</span>
                                        )}
                                    </div>
                                    <span className="app-workspace-step-text">{step.label}</span>
                                    <span className="app-workspace-step-badge">
                                        {isCompleted ? 'Complete' : isActive ? 'In progress' : 'Pending'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* ─── Main Workspace Card ─── */
                <div className="app-workspace-card">
                    {/* Textarea */}
                    <div className="app-workspace-textarea-wrap">
                        <textarea
                            ref={textareaRef}
                            className="app-workspace-textarea"
                            value={requirement}
                            onChange={(e) => setRequirement(e.target.value)}
                            maxLength={maxLength}
                            placeholder={
                                "Describe your requirement in natural language...\n\nExample: Users can reset their password using their registered email address. System sends a single-use token valid for 15 minutes."
                            }
                            aria-label="Requirement Input"
                        />

                        <div className="app-workspace-textarea-actions">
                            <button
                                type="button"
                                className="app-workspace-icon-btn"
                                onClick={handlePaste}
                                title="Paste from clipboard"
                            >
                                <Clipboard size={14} />
                            </button>
                            {charCount > 0 && (
                                <button
                                    type="button"
                                    className="app-workspace-icon-btn is-danger"
                                    onClick={() => setRequirement('')}
                                    title="Clear"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>

                        <div className="app-workspace-quality-row">
                            <span className="app-workspace-char-count">
                                {charCount} / {maxLength}
                            </span>
                            {charCount > 0 && (
                                <span className={`app-workspace-quality-indicator quality-${qualityLevel}`}>
                                    <Sparkles size={11} />
                                    <span>{qualityHint}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Controls Grid */}
                    <div className="app-workspace-controls-grid">
                        {/* Context */}
                        <div className="app-workspace-control-group">
                            <span className="app-workspace-control-label">CONTEXT</span>
                            <div className="app-workspace-segmented">
                                {[
                                    { id: 'web', label: 'Web', icon: Globe },
                                    { id: 'mobile', label: 'Mobile', icon: Smartphone },
                                    { id: 'api', label: 'API', icon: Server }
                                ].map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className={`app-workspace-seg-btn ${settings.type === id ? 'is-active' : ''}`}
                                        onClick={() => setSettings({ ...settings, type: id })}
                                    >
                                        <Icon size={13} />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Depth */}
                        <div className="app-workspace-control-group">
                            <span className="app-workspace-control-label">DEPTH</span>
                            <div className="app-workspace-segmented">
                                {[
                                    { id: 'Essential', label: 'Essential' },
                                    { id: 'Standard', label: 'Standard' },
                                    { id: 'Comprehensive', label: 'Comprehensive' }
                                ].map(({ id, label }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className={`app-workspace-seg-btn ${settings.level === id ? 'is-active' : ''}`}
                                        onClick={() => setSettings({ ...settings, level: id })}
                                    >
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* AI Analyzes */}
                        <div className="app-workspace-control-group">
                            <span className="app-workspace-control-label">AI ANALYZES</span>
                            <div className="app-workspace-tags-list">
                                {['Clarity', 'Ambiguities', 'Risk Areas', 'Edge Cases'].map((tag) => (
                                    <span key={tag} className="app-workspace-tag">
                                        <CheckCircle2 size={12} />
                                        <span>{tag}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer Trigger */}
                    <div className="app-workspace-footer">
                        <div className="app-workspace-pipeline">
                            <Sparkles size={14} />
                            <div className="app-workspace-pipeline-steps">
                                <span>Requirement understanding</span>
                                <span className="sep">→</span>
                                <span>Ambiguity detection</span>
                                <span className="sep">→</span>
                                <span>Risk assessment</span>
                                <span className="sep">→</span>
                                <span>Test synthesis</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="app-workspace-generate-btn"
                            onClick={handleGenerate}
                            disabled={!requirement.trim() || isGenerating}
                            id="workspace-generate-btn"
                        >
                            <Sparkles size={17} />
                            <span>✦ Analyze & Generate Tests</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkspacePage;
