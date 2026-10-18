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
import { InlineTestSignal, DataLoadingState, AiGenerationLoader } from '../../components/loading';
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
        title: 'Login & Session Auth',
        description: 'Users can authenticate using email and password with optional MFA. System locks account after 5 consecutive failed attempts, invalidates prior sessions on password change, and supports Remember Me for 30 days.'
    },
    {
        title: 'Cart & Checkout',
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

    // Save tracking: Single clear status
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
    const [error, setError] = useState(null);

    // Contextual Floating QA Assistant State
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);

    const textareaRef = useRef(null);
    const examplesMenuRef = useRef(null);
    const abortControllerRef = useRef(null);
    const maxLength = 2000;

    // Clean teardown on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    const handleCancelGenerate = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
        setError(null);
    }, []);

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

    // Close examples menu on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (examplesMenuRef.current && !examplesMenuRef.current.contains(e.target)) {
                setShowExamples(false);
            }
        };
        if (showExamples) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showExamples]);

    // Load existing test suite session when routeSessionId is present
    useEffect(() => {
        if (!routeSessionId) {
            setCurrentSessionId(null);
            setSessionStatus('Draft');
            setSuiteData(null);
            setIsLoadingSession(false);
            setSaveStatus('saved');
            setLastSavedTime(new Date());

            // Preserve draft requirement input collected prior to authentication
            const params = new URLSearchParams(window.location.search);
            const reqParam = params.get('requirement') || params.get('prompt') || params.get('q');
            const titleParam = params.get('title');

            let draftReq = reqParam ? decodeURIComponent(reqParam) : '';
            let draftTitle = titleParam ? decodeURIComponent(titleParam) : '';

            if (!draftReq) {
                try {
                    const stored = sessionStorage.getItem('testnexa_draft_requirement');
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        draftReq = parsed.requirement || '';
                        draftTitle = parsed.title || '';
                        sessionStorage.removeItem('testnexa_draft_requirement');
                    }
                } catch (e) {}
            }

            setRequirement(draftReq);
            setRequirementTitle(draftTitle);
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
        setError(null);
        abortControllerRef.current = new AbortController();

        try {
            const resolvedTitle = requirementTitle.trim() ||
                requirement.split(/[.!?\n]/)[0].trim().slice(0, 45) ||
                'Generated Suite';

            // 1. Execute backend test generation
            const result = await apiService.generateTestSuite(requirement, {
                ...settings,
                sessionId: currentSessionId,
                signal: abortControllerRef.current.signal
            });

            // 2. Identify the exact persisted test suite ID
            const targetSuiteId = result.testSuiteId || result.sessionId || currentSessionId;

            // 3. Sync client history cache
            await saveToHistory(result, requirement, settings, targetSuiteId, resolvedTitle);
            await refreshSidebarHistory();

            setSuiteData(result);
            setSessionStatus('NeedsReview');

            // 4. Navigate directly to generated test suite review
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
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                setIsGenerating(false);
                return;
            }
            console.error('Generation error:', err);
            const userSafeMsg = err.message?.includes('QUOTA_LIMIT')
                ? 'AI service is temporarily busy. Please wait a moment and try again.'
                : err.message || 'Test suite generation failed. Please check your requirement and try again.';
            setError(userSafeMsg);
            setIsGenerating(false);
        } finally {
            abortControllerRef.current = null;
        }
    };

    const charCount = requirement.length;
    const isInputValid = requirement.trim().length >= 10;
    const displayTitle = requirementTitle.trim() || 'Untitled Requirement';

    return (
        <div className="app-workspace-container">
            {/* ─── 1. PAGE HEADER ─── */}
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

                {/* Compact Four-Stage Progress Indicator */}
                <div className="app-workspace-workflow-stepper" aria-label="Workflow Stages">
                    <div className={`app-workspace-step ${!isGenerating ? 'is-active' : 'is-completed'}`}>
                        <span className="app-workspace-step-num">01</span>
                        <span className="app-workspace-step-name">Requirement</span>
                    </div>
                    <span className="app-workspace-step-arrow">→</span>
                    <div className={`app-workspace-step ${isGenerating ? 'is-active' : ''}`}>
                        <span className="app-workspace-step-num">02</span>
                        <span className="app-workspace-step-name">Analyze</span>
                    </div>
                    <span className="app-workspace-step-arrow">→</span>
                    <div className={`app-workspace-step ${isGenerating ? 'is-active' : ''}`}>
                        <span className="app-workspace-step-num">03</span>
                        <span className="app-workspace-step-name">Generate</span>
                    </div>
                    <span className="app-workspace-step-arrow">→</span>
                    <div className="app-workspace-step">
                        <span className="app-workspace-step-num">04</span>
                        <span className="app-workspace-step-name">Review</span>
                    </div>
                </div>

                {/* Single Clear Save Status */}
                <div className="app-workspace-header__status">
                    {saveStatus === 'saving' ? (
                        <div className="app-workspace-saved-pill saving">
                            <InlineTestSignal size={12} />
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

            {/* Error Handling Banner with Retry */}
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
                            <span>Retry Generation</span>
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

            {/* ─── 2. ACTIVE RESUMED SUITE BANNER (If returning to an already generated suite) ─── */}
            {suiteData && !isGenerating && (
                <div className="app-workspace-active-suite-banner">
                    <div className="app-workspace-active-suite-info">
                        <div className="app-workspace-active-suite-title-row">
                            <Check size={15} color="#8BAF9A" strokeWidth={2.5} />
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

            {/* ─── 3. AI GENERATION & SPECIFICATION LOADING EXPERIENCE ─── */}
            {isGenerating ? (
                <div style={{ margin: '1rem 0' }}>
                    <AiGenerationLoader
                        requirement={requirement}
                        title={requirementTitle}
                        settings={settings}
                        onCancel={handleCancelGenerate}
                    />
                </div>
            ) : error && !suiteData ? (
                <div style={{ margin: '1rem 0' }}>
                    <AiGenerationLoader
                        requirement={requirement}
                        title={requirementTitle}
                        settings={settings}
                        error={error}
                        onRetry={handleGenerate}
                        onCancel={() => setError(null)}
                    />
                </div>
            ) : isLoadingSession ? (
                <DataLoadingState
                    message="Loading test suite specifications..."
                    telemetryTag="SESSION SYNC"
                    skeletonType="metrics-detail"
                />
            ) : (
                /* ─── 4. BALANCED TWO-COLUMN WORKBENCH (Desktop 2-col, Mobile Stacked) ─── */
                <div className="app-workspace-2col-layout">
                    {/* LEFT COLUMN: Requirement Specification */}
                    <div className="app-workspace-col-main">
                        <div className="app-workspace-card">
                            <div className="app-workspace-card-header">
                                <span className="app-workspace-card-label">REQUIREMENT SPECIFICATION</span>
                                
                                {/* Quick Examples Menu */}
                                <div className="app-workspace-examples-anchor" ref={examplesMenuRef}>
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
                                        <div className="app-workspace-examples-menu" role="menu">
                                            <div className="app-workspace-examples-menu__label">SELECT A SPECIFICATION TEMPLATE</div>
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

                            {/* Title Field */}
                            <div className="app-workspace-field">
                                <label htmlFor="req-title" className="app-workspace-field-label">
                                    Requirement Title
                                </label>
                                <input
                                    id="req-title"
                                    type="text"
                                    className="app-workspace-title-input"
                                    value={requirementTitle}
                                    onChange={(e) => setRequirementTitle(e.target.value)}
                                    placeholder="e.g. Password Reset Flow"
                                    maxLength={120}
                                />
                            </div>

                            {/* Description Field */}
                            <div className="app-workspace-field">
                                <div className="app-workspace-field-row">
                                    <label htmlFor="req-desc" className="app-workspace-field-label">
                                        Requirement Description <span className="req-required">*</span>
                                    </label>
                                    <span className="app-workspace-char-count">
                                        {charCount} / {maxLength}
                                    </span>
                                </div>

                                <div className="app-workspace-textarea-wrap">
                                    <textarea
                                        id="req-desc"
                                        ref={textareaRef}
                                        className="app-workspace-textarea"
                                        value={requirement}
                                        onChange={(e) => setRequirement(e.target.value)}
                                        maxLength={maxLength}
                                        placeholder="Enter user stories, acceptance criteria, or API contract details (e.g., Users can reset their password using their registered email address...)"
                                        aria-label="Requirement Description"
                                        rows={9}
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
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Configuration & Generation Controls */}
                    <div className="app-workspace-col-side">
                        <div className="app-workspace-card">
                            <div className="app-workspace-card-header">
                                <span className="app-workspace-card-label">GENERATION CONFIGURATION</span>
                            </div>

                            {/* Target Selector */}
                            <div className="app-workspace-field">
                                <label className="app-workspace-field-label">Target Platform</label>
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

                            {/* Coverage Depth */}
                            <div className="app-workspace-field">
                                <label className="app-workspace-field-label">Coverage Depth</label>
                                <div className="app-workspace-depth-list">
                                    {[
                                        {
                                            id: 'Essential',
                                            label: 'Essential',
                                            sub: 'Core happy-path validation scenarios'
                                        },
                                        {
                                            id: 'Standard',
                                            label: 'Standard',
                                            sub: 'Functional, negative & edge case coverage',
                                            isRecommended: true
                                        },
                                        {
                                            id: 'Comprehensive',
                                            label: 'Comprehensive',
                                            sub: 'Deep functional, edge, security & boundary tests'
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

                            {/* Compact Feature Summary */}
                            <div className="app-workspace-deliverables-compact">
                                <span className="app-workspace-deliverables-compact-label">TEST SUITE INCLUDES</span>
                                <div className="app-workspace-deliverables-chips">
                                    <span className="app-workspace-chip">✓ Functional scenarios</span>
                                    <span className="app-workspace-chip">✓ Negative scenarios</span>
                                    <span className="app-workspace-chip">✓ Edge cases</span>
                                    <span className="app-workspace-chip">✓ Validation checks</span>
                                    <span className="app-workspace-chip">✓ Security vectors</span>
                                    <span className="app-workspace-chip">✓ Traceability map</span>
                                </div>
                            </div>

                            {/* Primary Action Button */}
                            <div className="app-workspace-action-wrap">
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
                                        Enter at least 10 characters in requirement description.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 5. RECENT WORK SECTION ─── */}
            {!isGenerating && (
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
                            No previous test suites yet. Generate your first suite above.
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
            )}

            {/* ─── 6. CONTEXTUAL FLOATING ASSISTANT (Ask Testnexa) ─── */}
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
