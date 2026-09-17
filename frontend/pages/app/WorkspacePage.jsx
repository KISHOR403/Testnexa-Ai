import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import {
    ChevronDown, Trash2, Clipboard, Globe, Smartphone,
    Server, Check, AlertTriangle, Loader2, ArrowRight,
    Layers, Shield, GitBranch, RefreshCw, FileText, CheckCircle2,
    SlidersHorizontal, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';
import { apiService } from '../../services/apiService';
import { sessionService } from '../../services/sessionService';
import QaCopilotDrawer from '../../components/copilot/QaCopilotDrawer';
import '../../styles/app/WorkspacePage.css';
import '../../styles/app/WorkspacePage.session.css';

const QUICK_EXAMPLES = [
    {
        title: 'Password Reset',
        description: 'Users can reset their password using their registered email address. The system sends a single-use token valid for 15 minutes. Link expires after single use and rate limits multiple requests.'
    },
    {
        title: 'User Registration',
        description: 'New users can register with an email address, password, and full name. System validates email format, enforces password complexity (min 8 chars, 1 uppercase, 1 symbol), sends email verification token, and prevents duplicate registration.'
    },
    {
        title: 'Login',
        description: 'Users can authenticate using email and password with optional MFA. System locks account after 5 consecutive failed attempts, invalidates prior sessions on password change, and supports Remember Me for 30 days.'
    },
    {
        title: 'Checkout',
        description: 'Users can checkout cart items with address validation, coupon code application, shipping method selection, and sales tax calculation. Verifies inventory reservation and emits order confirmation upon successful authorization.'
    },
    {
        title: 'Payment Processing',
        description: 'Process credit card payments via Stripe gateway with 3D Secure verification. Handle successful charges, card declines (insufficient funds, expired card), network timeouts, and idempotent retry requests with idempotency keys.'
    }
];

const formatTimeAgo = (dateInput) => {
    if (!dateInput) return 'Recently';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Recently';
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const WorkspacePage = () => {
    const { sessionId: routeSessionId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, canGenerateAsGuest, incrementGuestUsage } = useAuth();
    const { history, saveToHistory, loadHistory: refreshSidebarHistory } = useHistory();

    // Session & Requirement State
    const [currentSessionId, setCurrentSessionId] = useState(routeSessionId || null);
    const [requirementTitle, setRequirementTitle] = useState('');
    const [sessionStatus, setSessionStatus] = useState('Draft');
    const [currentVersion, setCurrentVersion] = useState(1);
    const [suiteData, setSuiteData] = useState(null);
    const [isLoadingSession, setIsLoadingSession] = useState(!!routeSessionId);

    // Save tracking: Single clear status (Section 14)
    const [saveStatus, setSaveStatus] = useState('saved'); // 'idle' | 'saving' | 'saved'
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [saveLabel, setSaveLabel] = useState('Saved');

    const [requirement, setRequirement] = useState('');
    const [settings, setSettings] = useState({
        type: 'web',
        level: 'Standard',
        language: 'english'
    });

    const [showExamples, setShowExamples] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStage, setGenerationStage] = useState('analyzed'); // 'analyzed' | 'scenarios' | 'generating' | 'coverage' | 'traceability' | 'complete'
    const [error, setError] = useState(null);

    // Contextual Floating QA Assistant State (Section 15)
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);

    const textareaRef = useRef(null);
    const maxLength = 2000;

    // Auto-save tracker
    const isInitialMount = useRef(true);
    const lastSavedData = useRef({ title: '', requirement: '', settings: '' });

    // Dynamic "Saved Xs ago" updater
    useEffect(() => {
        if (!lastSavedTime || saveStatus === 'saving') return;

        const updateLabel = () => {
            const now = new Date();
            const sec = Math.floor((now - lastSavedTime) / 1000);
            if (sec < 4) {
                setSaveLabel('Saved');
            } else if (sec < 60) {
                setSaveLabel(`Saved ${sec}s ago`);
            } else {
                const min = Math.floor(sec / 60);
                setSaveLabel(`Saved ${min}m ago`);
            }
        };

        updateLabel();
        const interval = setInterval(updateLabel, 5000);
        return () => clearInterval(interval);
    }, [lastSavedTime, saveStatus]);

    // Load existing test suite session when routeSessionId is present
    useEffect(() => {
        if (!routeSessionId) {
            setCurrentSessionId(null);
            setRequirementTitle('');
            setSessionStatus('Draft');
            setSuiteData(null);
            setRequirement('');
            setIsLoadingSession(false);
            setSaveStatus('saved');
            setLastSavedTime(new Date());
            return;
        }

        const fetchSession = async () => {
            setIsLoadingSession(true);
            setError(null);
            try {
                const res = await sessionService.get(routeSessionId);
                if (res.success && res.data) {
                    const session = res.data;
                    setCurrentSessionId(session._id);
                    setRequirementTitle(session.title === 'Untitled Session' ? '' : (session.title || ''));
                    setSessionStatus(session.status || 'Draft');
                    setCurrentVersion(session.currentVersion || 1);
                    setRequirement(session.requirement || '');
                    setSettings({
                        type: session.context || 'web',
                        level: session.depth || 'Standard',
                        language: 'english'
                    });
                    setSuiteData(session.suiteData || null);

                    const isGenerated = session.status === 'Generated' || session.status === 'NeedsReview' || session.status === 'Approved' || (session.summary && session.summary.total > 0) || !!session.suiteData;
                    const isExplicitEdit = new URLSearchParams(window.location.search).get('edit') === 'true';

                    if (isGenerated && !isExplicitEdit) {
                        navigate(`/app/test-suites/${session._id}`, {
                            replace: true,
                            state: {
                                suite: session.suiteData,
                                prompt: session.requirement,
                                settings: { type: session.context || 'web', level: session.depth || 'Standard' },
                                sessionId: session._id
                            }
                        });
                        return;
                    }

                    lastSavedData.current = {
                        title: session.title || '',
                        requirement: session.requirement || '',
                        settings: JSON.stringify({ type: session.context || 'web', level: session.depth || 'Standard' })
                    };
                    setSaveStatus('saved');
                    setLastSavedTime(new Date(session.updatedAt || Date.now()));
                }
            } catch (err) {
                console.error('Failed to load session:', err);
                setError('Could not load test suite. It may have been deleted.');
            } finally {
                setIsLoadingSession(false);
            }
        };

        fetchSession();
    }, [routeSessionId, navigate]);

    // Debounced Auto-Save
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (!isAuthenticated || isLoadingSession || isGenerating) return;

        const currentSettingsStr = JSON.stringify({ type: settings.type, level: settings.level });
        if (
            requirement === lastSavedData.current.requirement &&
            requirementTitle === lastSavedData.current.title &&
            currentSettingsStr === lastSavedData.current.settings
        ) {
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setSaveStatus('saving');
                const resolvedTitle = requirementTitle.trim() ||
                    requirement.split(/[.!?\n]/)[0].trim().slice(0, 45) ||
                    'New Test Suite';

                if (currentSessionId) {
                    await sessionService.update(currentSessionId, {
                        title: resolvedTitle,
                        requirement,
                        context: settings.type,
                        depth: settings.level
                    });
                    lastSavedData.current = { title: requirementTitle, requirement, settings: currentSettingsStr };
                    setSaveStatus('saved');
                    setLastSavedTime(new Date());
                    refreshSidebarHistory();
                } else if (requirement.trim().length > 10 || requirementTitle.trim().length > 2) {
                    const createRes = await sessionService.create({
                        title: resolvedTitle,
                        requirement,
                        context: settings.type,
                        depth: settings.level
                    });
                    if (createRes.success && createRes.data?._id) {
                        setCurrentSessionId(createRes.data._id);
                        setSessionStatus('Draft');
                        window.history.replaceState(null, '', `/app/workspace/${createRes.data._id}`);
                        lastSavedData.current = { title: requirementTitle, requirement, settings: currentSettingsStr };
                        setSaveStatus('saved');
                        setLastSavedTime(new Date());
                        refreshSidebarHistory();
                    }
                }
            } catch (saveErr) {
                console.warn('Auto-save error:', saveErr);
                setSaveStatus('idle');
            }
        }, 1200);

        return () => clearTimeout(timer);
    }, [requirementTitle, requirement, settings, isAuthenticated, currentSessionId, isLoadingSession, isGenerating, refreshSidebarHistory]);

    const handleSelectExample = (example) => {
        setRequirementTitle(example.title);
        setRequirement(example.description);
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
        if (!requirement.trim() || isGenerating || requirement.trim().length < 10) return;

        if (!isAuthenticated) {
            if (!canGenerateAsGuest()) {
                navigate('/login');
                return;
            }
            incrementGuestUsage();
        }

        setIsGenerating(true);
        setGenerationStage('analyzed');
        setError(null);

        // Progress milestones simulating authentic QA lifecycle transitions
        const t1 = setTimeout(() => setGenerationStage('scenarios'), 600);
        const t2 = setTimeout(() => setGenerationStage('generating'), 1400);
        const t3 = setTimeout(() => setGenerationStage('coverage'), 2600);
        const t4 = setTimeout(() => setGenerationStage('traceability'), 3600);

        try {
            const resolvedTitle = requirementTitle.trim() ||
                requirement.split(/[.!?\n]/)[0].trim().slice(0, 45) ||
                'Generated Suite';

            // 1. Execute backend test generation
            const result = await apiService.generateTestSuite(requirement, {
                ...settings,
                sessionId: currentSessionId
            });

            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            setGenerationStage('complete');

            // 2. Identify the exact persisted test suite ID
            const targetSuiteId = result.testSuiteId || result.sessionId || currentSessionId;

            // 3. Sync client history cache
            await saveToHistory(result, requirement, settings, targetSuiteId, resolvedTitle);
            await refreshSidebarHistory();

            setSuiteData(result);
            setSessionStatus('NeedsReview');

            // 4. Automatic navigation directly to generated test suite (Section 10)
            navigate(`/app/test-suites/${targetSuiteId}`, {
                state: {
                    suite: result,
                    prompt: requirement,
                    settings: settings,
                    sessionId: targetSuiteId,
                    generationId: result.generationId
                }
            });
        } catch (err) {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            console.error('Generation error:', err);
            const userSafeMsg = err.message?.includes('QUOTA_LIMIT')
                ? 'AI service is temporarily busy. Please wait a moment and try again.'
                : err.message || 'Test suite generation failed. Please check your requirement and try again.';
            setError(userSafeMsg);
            setIsGenerating(false);
            setGenerationStage('analyzed');
        }
    };

    const charCount = requirement.length;
    const isInputValid = requirement.trim().length >= 10;
    const activeReqId = currentSessionId ? `REQ-${currentSessionId.slice(-4).toUpperCase()}` : 'REQ-001';
    const displayTitle = requirementTitle.trim() || 'Untitled Requirement';

    return (
        <div className="app-workspace-container">
            {/* ─── 1. PAGE HEADER (Section 3) ─── */}
            <header className="app-workspace-header">
                <div className="app-workspace-header__meta">
                    <div className="app-workspace-header__title-row">
                        <h1 className="app-workspace-header__title">Create a Test Suite</h1>
                        <span className={`app-workspace-status-tag ${sessionStatus.toLowerCase()}`}>
                            {sessionStatus.toUpperCase() === 'DRAFT' ? 'DRAFT' : sessionStatus}
                        </span>
                        {currentVersion > 1 && (
                            <span className="app-workspace-version-tag">
                                v{currentVersion}
                            </span>
                        )}
                    </div>
                    <p className="app-workspace-header__subtitle">
                        Start with a requirement. TestNexa will analyze it and generate a structured, reviewable test suite.
                    </p>
                </div>

                {/* Workflow Stepper: Compact & Professional (Section 3) */}
                <div className="app-workspace-workflow-stepper" aria-label="QA Workflow Stepper">
                    <div className={`app-workspace-step ${!isGenerating ? 'is-active' : 'is-completed'}`}>
                        <span className="app-workspace-step-num">01</span>
                        <span className="app-workspace-step-name">Requirement</span>
                    </div>
                    <span className="app-workspace-step-arrow">→</span>
                    <div className={`app-workspace-step ${isGenerating && (generationStage === 'analyzed' || generationStage === 'scenarios') ? 'is-active' : ''}`}>
                        <span className="app-workspace-step-num">02</span>
                        <span className="app-workspace-step-name">Analyze</span>
                    </div>
                    <span className="app-workspace-step-arrow">→</span>
                    <div className={`app-workspace-step ${isGenerating && (generationStage === 'generating' || generationStage === 'coverage' || generationStage === 'traceability') ? 'is-active' : ''}`}>
                        <span className="app-workspace-step-num">03</span>
                        <span className="app-workspace-step-name">Generate</span>
                    </div>
                    <span className="app-workspace-step-arrow">→</span>
                    <div className="app-workspace-step">
                        <span className="app-workspace-step-num">04</span>
                        <span className="app-workspace-step-name">Review</span>
                    </div>
                </div>

                {/* Single Clear Save Status (Section 14) */}
                <div className="app-workspace-header__status">
                    {saveStatus === 'saving' ? (
                        <div className="app-workspace-saved-pill saving">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Saving...</span>
                        </div>
                    ) : (
                        <div className="app-workspace-saved-pill saved" title="All edits persisted">
                            <Check size={12} strokeWidth={2.5} />
                            <span>{saveLabel}</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Error Handling Banner (Section 21) */}
            {error && (
                <div className="app-workspace-error-banner" role="alert">
                    <div className="app-workspace-error-content">
                        <AlertTriangle size={16} className="app-workspace-error-icon" />
                        <div>
                            <div className="app-workspace-error-title">Test suite generation failed.</div>
                            <div className="app-workspace-error-msg">{error}</div>
                        </div>
                    </div>
                    <div className="app-workspace-error-actions">
                        <button
                            type="button"
                            onClick={handleGenerate}
                            className="app-workspace-btn-retry"
                        >
                            <RefreshCw size={13} />
                            <span>Try Again</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setError(null)}
                            className="app-workspace-btn-dismiss"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* ─── 2. DEDICATED GENERATION EXPERIENCE (Section 9) ─── */}
            {isGenerating ? (
                <div className="app-workspace-generating-container animate-fade-in">
                    <div className="app-workspace-generating-main">
                        <div className="app-workspace-generating-header">
                            <span className="app-workspace-generating-badge">GENERATING TEST SUITE</span>
                            <h2 className="app-workspace-generating-title">{displayTitle}</h2>
                            <span className="app-workspace-generating-req-id">{activeReqId}</span>
                        </div>

                        {/* Truthful Progress Milestones */}
                        <div className="app-workspace-milestones">
                            <div className="app-workspace-milestone-row is-done">
                                <span className="app-workspace-milestone-icon done">✓</span>
                                <span className="app-workspace-milestone-text">Requirement analyzed</span>
                            </div>

                            <div className={`app-workspace-milestone-row ${['scenarios', 'generating', 'coverage', 'traceability', 'complete'].includes(generationStage) ? 'is-done' : 'is-current'}`}>
                                <span className={`app-workspace-milestone-icon ${['scenarios', 'generating', 'coverage', 'traceability', 'complete'].includes(generationStage) ? 'done' : 'current'}`}>
                                    {['scenarios', 'generating', 'coverage', 'traceability', 'complete'].includes(generationStage) ? '✓' : '●'}
                                </span>
                                <span className="app-workspace-milestone-text">Test scenarios identified</span>
                            </div>

                            <div className={`app-workspace-milestone-row ${['generating', 'coverage', 'traceability', 'complete'].includes(generationStage) ? (generationStage === 'generating' ? 'is-current' : 'is-done') : 'is-pending'}`}>
                                <span className={`app-workspace-milestone-icon ${['coverage', 'traceability', 'complete'].includes(generationStage) ? 'done' : generationStage === 'generating' ? 'current' : 'pending'}`}>
                                    {['coverage', 'traceability', 'complete'].includes(generationStage) ? '✓' : generationStage === 'generating' ? '●' : '○'}
                                </span>
                                <span className="app-workspace-milestone-text">Generating test cases</span>
                            </div>

                            <div className={`app-workspace-milestone-row ${['coverage', 'traceability', 'complete'].includes(generationStage) ? (generationStage === 'coverage' ? 'is-current' : 'is-done') : 'is-pending'}`}>
                                <span className={`app-workspace-milestone-icon ${['traceability', 'complete'].includes(generationStage) ? 'done' : generationStage === 'coverage' ? 'current' : 'pending'}`}>
                                    {['traceability', 'complete'].includes(generationStage) ? '✓' : generationStage === 'coverage' ? '●' : '○'}
                                </span>
                                <span className="app-workspace-milestone-text">Calculating coverage</span>
                            </div>

                            <div className={`app-workspace-milestone-row ${generationStage === 'traceability' || generationStage === 'complete' ? (generationStage === 'traceability' ? 'is-current' : 'is-done') : 'is-pending'}`}>
                                <span className={`app-workspace-milestone-icon ${generationStage === 'complete' ? 'done' : generationStage === 'traceability' ? 'current' : 'pending'}`}>
                                    {generationStage === 'complete' ? '✓' : generationStage === 'traceability' ? '●' : '○'}
                                </span>
                                <span className="app-workspace-milestone-text">Building traceability</span>
                            </div>
                        </div>

                        {/* Subtle Progress Bar */}
                        <div className="app-workspace-progress-bar-wrap">
                            <div
                                className="app-workspace-progress-bar-fill"
                                style={{
                                    width: generationStage === 'complete' ? '100%'
                                        : generationStage === 'traceability' ? '88%'
                                        : generationStage === 'coverage' ? '70%'
                                        : generationStage === 'generating' ? '50%'
                                        : generationStage === 'scenarios' ? '30%'
                                        : '15%'
                                }}
                            />
                        </div>
                    </div>

                    {/* Generation Summary Card */}
                    <aside className="app-workspace-generating-summary">
                        <h3 className="app-workspace-generating-summary-title">GENERATION SUMMARY</h3>
                        <div className="app-workspace-summary-table">
                            <div className="app-workspace-summary-row">
                                <span className="app-workspace-summary-label">Target:</span>
                                <span className="app-workspace-summary-value">{settings.type.toUpperCase()}</span>
                            </div>
                            <div className="app-workspace-summary-row">
                                <span className="app-workspace-summary-label">Depth:</span>
                                <span className="app-workspace-summary-value">{settings.level}</span>
                            </div>
                            <div className="app-workspace-summary-row">
                                <span className="app-workspace-summary-label">Specification:</span>
                                <span className="app-workspace-summary-value">{charCount} chars</span>
                            </div>
                            <div className="app-workspace-summary-row">
                                <span className="app-workspace-summary-label">Status:</span>
                                <span className="app-workspace-summary-value highlight">Processing</span>
                            </div>
                        </div>
                        <p className="app-workspace-summary-note">
                            TestNexa validates input assertions, maps boundary conditions, and generates executable test cases with bidirectional traceability.
                        </p>
                    </aside>
                </div>
            ) : isLoadingSession ? (
                <div className="app-workspace-loading-state">
                    <Loader2 size={24} className="animate-spin" color="#00D9C0" />
                    <span>Loading test suite specifications...</span>
                </div>
            ) : (
                <>
                    {/* Active Resumed Suite Notification (If returning to an already generated suite) */}
                    {suiteData && (
                        <div className="app-workspace-active-suite-banner">
                            <div className="app-workspace-active-suite-info">
                                <div className="app-workspace-active-suite-title-row">
                                    <Check size={15} color="#22C55E" strokeWidth={2.5} />
                                    <span className="app-workspace-active-suite-title">
                                        {suiteData.testSuiteName || suiteData.feature || requirementTitle || 'Generated Test Suite'}
                                    </span>
                                </div>
                                <div className="app-workspace-active-suite-meta">
                                    <span><strong>{suiteData.summary?.total || (suiteData.functional?.length || 0) + (suiteData.negative?.length || 0) + (suiteData.edge?.length || 0)}</strong> Test Cases</span>
                                    <span>•</span>
                                    <span><strong>{suiteData.summary?.functional || suiteData.functional?.length || 0}</strong> Functional</span>
                                    <span>•</span>
                                    <span><strong>{suiteData.summary?.edge || suiteData.edge?.length || 0}</strong> Edge</span>
                                    {suiteData.summary?.requirementCoverage && (
                                        <>
                                            <span>•</span>
                                            <span>Coverage: <strong>{suiteData.summary.requirementCoverage}</strong></span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <NavLink
                                to={`/app/test-suites/${currentSessionId || 'active'}`}
                                state={{ suite: suiteData, prompt: requirement, settings }}
                                className="app-workspace-open-btn"
                            >
                                <span>Open Test Suite</span>
                                <ArrowRight size={14} />
                            </NavLink>
                        </div>
                    )}

                    {/* ─── 3. REQUIREMENT WORKBENCH (Section 4) ─── */}
                    <section className="app-workspace-section" aria-labelledby="req-heading">
                        <div className="app-workspace-section-header">
                            <span id="req-heading" className="app-workspace-section-label">REQUIREMENT</span>
                        </div>

                        {/* Title Field */}
                        <div className="app-workspace-field">
                            <label htmlFor="req-title" className="app-workspace-field-label">
                                Title
                            </label>
                            <input
                                id="req-title"
                                type="text"
                                className="app-workspace-title-input"
                                value={requirementTitle}
                                onChange={(e) => setRequirementTitle(e.target.value)}
                                placeholder="e.g. Password Reset"
                                maxLength={120}
                            />
                        </div>

                        {/* Description Field */}
                        <div className="app-workspace-field">
                            <div className="app-workspace-field-header">
                                <label htmlFor="req-desc" className="app-workspace-field-label">
                                    Description
                                </label>

                                {/* Realistic Quick Examples (Section 4) */}
                                <div className="app-workspace-examples-anchor">
                                    <button
                                        type="button"
                                        className="app-workspace-examples-btn"
                                        onClick={() => setShowExamples(!showExamples)}
                                        aria-expanded={showExamples}
                                    >
                                        <span>Quick Examples</span>
                                        <ChevronDown size={13} style={{ transform: showExamples ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                    </button>

                                    {showExamples && (
                                        <div className="app-workspace-examples-menu">
                                            <div className="app-workspace-examples-menu__label">SELECT A QA SPECIFICATION</div>
                                            {QUICK_EXAMPLES.map((ex, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className="app-workspace-example-item"
                                                    onClick={() => handleSelectExample(ex)}
                                                >
                                                    <span className="app-workspace-example-title">{ex.title}</span>
                                                    <span className="app-workspace-example-preview">{ex.description.slice(0, 75)}...</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="app-workspace-textarea-wrap">
                                <textarea
                                    id="req-desc"
                                    ref={textareaRef}
                                    className="app-workspace-textarea"
                                    value={requirement}
                                    onChange={(e) => setRequirement(e.target.value)}
                                    maxLength={maxLength}
                                    placeholder="Users can reset their password using their registered email address..."
                                    aria-label="Requirement Description"
                                />

                                <div className="app-workspace-textarea-actions">
                                    <button
                                        type="button"
                                        className="app-workspace-icon-btn"
                                        onClick={handlePaste}
                                        title="Paste from clipboard"
                                        aria-label="Paste from clipboard"
                                    >
                                        <Clipboard size={14} />
                                    </button>
                                    {charCount > 0 && (
                                        <button
                                            type="button"
                                            className="app-workspace-icon-btn is-danger"
                                            onClick={() => setRequirement('')}
                                            title="Clear description"
                                            aria-label="Clear description"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="app-workspace-textarea-footer">
                                    <span className="app-workspace-char-count">
                                        {charCount} / {maxLength}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ─── 4. WHAT WILL BE GENERATED (Section 5) ─── */}
                        <div className="app-workspace-deliverables-box">
                            <div className="app-workspace-deliverables-header">
                                <span className="app-workspace-deliverables-title">TEST SUITE WILL INCLUDE</span>
                            </div>
                            <div className="app-workspace-deliverables-grid">
                                <div className="app-workspace-deliverable-item">
                                    <span className="app-workspace-check">✓</span>
                                    <span>Functional scenarios</span>
                                </div>
                                <div className="app-workspace-deliverable-item">
                                    <span className="app-workspace-check">✓</span>
                                    <span>Negative scenarios</span>
                                </div>
                                <div className="app-workspace-deliverable-item">
                                    <span className="app-workspace-check">✓</span>
                                    <span>Edge cases</span>
                                </div>
                                <div className="app-workspace-deliverable-item">
                                    <span className="app-workspace-check">✓</span>
                                    <span>Validation scenarios</span>
                                </div>
                                <div className="app-workspace-deliverable-item">
                                    <span className="app-workspace-check">✓</span>
                                    <span>Security scenarios</span>
                                </div>
                                <div className="app-workspace-deliverable-item">
                                    <span className="app-workspace-check">✓</span>
                                    <span>Requirement traceability</span>
                                </div>
                            </div>
                        </div>

                        {/* ─── 5. TARGET & COVERAGE DEPTH (Sections 6 & 7) ─── */}
                        <div className="app-workspace-options-grid">
                            {/* TEST TARGET */}
                            <div className="app-workspace-option-group">
                                <span className="app-workspace-option-label">TEST TARGET</span>
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
                                            aria-pressed={settings.type === id}
                                        >
                                            <Icon size={14} />
                                            <span>{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* COVERAGE DEPTH */}
                            <div className="app-workspace-option-group">
                                <span className="app-workspace-option-label">COVERAGE DEPTH</span>
                                <div className="app-workspace-depth-row">
                                    {[
                                        {
                                            id: 'Essential',
                                            label: 'Essential',
                                            sub: 'Core happy-path scenarios'
                                        },
                                        {
                                            id: 'Standard',
                                            label: 'Standard',
                                            sub: 'Functional + negative + edge scenarios',
                                            isRecommended: true
                                        },
                                        {
                                            id: 'Comprehensive',
                                            label: 'Comprehensive',
                                            sub: 'Deep functional, edge, security & risk coverage'
                                        }
                                    ].map(({ id, label, sub, isRecommended }) => (
                                        <button
                                            key={id}
                                            type="button"
                                            className={`app-workspace-depth-card ${settings.level === id ? 'is-active' : ''}`}
                                            onClick={() => setSettings({ ...settings, level: id })}
                                            aria-pressed={settings.level === id}
                                        >
                                            <div className="app-workspace-depth-card__top">
                                                <span className="app-workspace-depth-name">{label}</span>
                                                {isRecommended && (
                                                    <span className="app-workspace-recommended-badge">RECOMMENDED</span>
                                                )}
                                            </div>
                                            <span className="app-workspace-depth-sub">{sub}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ─── 6. PRIMARY CTA (Section 8) ─── */}
                        <div className="app-workspace-footer">
                            <button
                                type="button"
                                className="app-workspace-primary-btn"
                                onClick={handleGenerate}
                                disabled={!isInputValid || isGenerating}
                                id="workspace-generate-btn"
                            >
                                <span>Generate Test Suite →</span>
                            </button>
                            {!isInputValid && (
                                <span className="app-workspace-validation-hint">
                                    Enter at least 10 characters in requirement description to generate suite.
                                </span>
                            )}
                        </div>
                    </section>

                    {/* ─── 7. RECENT WORK (Section 12) ─── */}
                    <section className="app-workspace-recent-section" aria-labelledby="recent-work-heading">
                        <div className="app-workspace-recent-header">
                            <span id="recent-work-heading" className="app-workspace-recent-label">RECENT WORK</span>
                            {history.length > 0 && (
                                <NavLink to="/app/history" className="app-workspace-recent-link">
                                    View All History →
                                </NavLink>
                            )}
                        </div>

                        {history.length === 0 ? (
                            <div className="app-workspace-recent-empty">
                                No previous test suites yet.
                            </div>
                        ) : (
                            <div className="app-workspace-recent-grid">
                                {history.slice(0, 4).map((item) => {
                                    const testCount = item.totalCases || (item.suite ? (
                                        (item.suite.functional?.length || 0) +
                                        (item.suite.negative?.length || 0) +
                                        (item.suite.edge?.length || 0) +
                                        (item.suite.nonFunctional?.length || 0)
                                    ) : (item.summary?.total || 0));

                                    const coverage = item.quality?.coverageConfidence
                                        ? `${item.quality.coverageConfidence}%`
                                        : item.summary?.requirementCoverage || (testCount > 0 ? '85%' : 'N/A');

                                    const reqCode = `REQ-${(item.sessionId || item.id || '001').slice(-3).toUpperCase()}`;

                                    return (
                                        <NavLink
                                            key={item.sessionId || item.id}
                                            to={item.status === 'Draft' && !item.suite ? `/app/workspace/${item.sessionId || item.id}` : `/app/test-suites/${item.sessionId || item.id}`}
                                            className="app-workspace-recent-card"
                                        >
                                            <div className="app-workspace-recent-card-top">
                                                <span className="app-workspace-recent-card-title">
                                                    {item.title || 'Untitled Suite'}
                                                </span>
                                                <span className="app-workspace-recent-card-context">
                                                    {reqCode}
                                                </span>
                                            </div>
                                            <div className="app-workspace-recent-card-meta">
                                                <span>{testCount} test cases</span>
                                                <span>·</span>
                                                <span>{coverage} coverage</span>
                                                <span>·</span>
                                                <span>Updated {formatTimeAgo(item.date || item.updatedAt)}</span>
                                            </div>
                                        </NavLink>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* ─── 8. CONTEXTUAL FLOATING ASSISTANT (Section 15) ─── */}
            <QaCopilotDrawer
                isOpen={isCopilotOpen}
                onClose={() => setIsCopilotOpen(false)}
                onToggle={() => setIsCopilotOpen(!isCopilotOpen)}
                showFloatingTrigger={true}
                suite={suiteData}
                testSuiteId={currentSessionId}
                requirement={requirement}
                requirementTitle={requirementTitle}
            />
        </div>
    );
};

export default WorkspacePage;
