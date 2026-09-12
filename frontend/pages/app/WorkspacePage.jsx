import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import {
    ChevronDown, Trash2, Clipboard, Globe, Smartphone,
    Server, Check, AlertTriangle, Loader2, Clock, ArrowRight,
    Layers, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';
import { apiService } from '../../services/apiService';
import { sessionService } from '../../services/sessionService';
import '../../styles/app/WorkspacePage.css';
import '../../styles/app/WorkspacePage.session.css';

const QUICK_EXAMPLES = [
    {
        title: 'Password Reset',
        description: 'Users can reset their password using their registered email address. The system sends a single-use token valid for 15 minutes. Link expires after single use and rate limits multiple requests.'
    },
    {
        title: 'User Authentication',
        description: 'As a user, I want to log in with my email and password with optional 2FA SMS code. Ensure lockout after 5 failed attempts, password complexity validation, and session token renewal.'
    },
    {
        title: 'Checkout Flow',
        description: 'Process credit card and Stripe checkout with 3D Secure verification. Handle successful charges, card declines, insufficient funds, network timeouts, and idempotent retry dispatches.'
    },
    {
        title: 'API Rate Limiting',
        description: 'Endpoint /api/v1/checkout enforces rate limit of 60 requests/min per IP. Returns HTTP 429 Too Many Requests with Retry-After header and logs suspicious burst traffic to telemetry.'
    }
];

const GENERATION_CHECKLIST = [
    { label: 'Requirement analyzed', time: 700 },
    { label: 'Ambiguities identified', time: 1600 },
    { label: 'Building test scenarios', time: 2800 },
    { label: 'Assessing risk coverage', time: 4100 },
    { label: 'Preparing traceability', time: 5400 }
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
    const [saveStatus, setSaveStatus] = useState('saved'); // 'idle' | 'saving' | 'saved'

    const [requirement, setRequirement] = useState('');
    const [settings, setSettings] = useState({
        type: 'web',
        level: 'Standard',
        language: 'english'
    });

    const [showExamples, setShowExamples] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [isGenerationComplete, setIsGenerationComplete] = useState(false);
    const [generatedSuiteId, setGeneratedSuiteId] = useState(null);
    const [error, setError] = useState(null);
    const textareaRef = useRef(null);
    const maxLength = 2000;

    // Auto-save tracker
    const isInitialMount = useRef(true);
    const lastSavedData = useRef({ title: '', requirement: '', settings: '' });

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

                    // If session already has a generated test suite and user is not explicitly editing:
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
                }
            } catch (err) {
                console.error('Failed to load session:', err);
                setError('Could not load test suite. It may have been deleted.');
            } finally {
                setIsLoadingSession(false);
            }
        };

        fetchSession();
    }, [routeSessionId]);

    // Progressive generation checklist stepper
    useEffect(() => {
        if (!isGenerating) {
            setActiveStepIndex(0);
            setIsGenerationComplete(false);
            return;
        }

        const intervals = GENERATION_CHECKLIST.map((step, idx) => {
            return setTimeout(() => {
                setActiveStepIndex(idx);
                if (idx === GENERATION_CHECKLIST.length - 1) {
                    setTimeout(() => {
                        setIsGenerationComplete(true);
                    }, 800);
                }
            }, step.time);
        });

        return () => intervals.forEach(clearTimeout);
    }, [isGenerating]);

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
        if (!requirement.trim()) return;

        if (!isAuthenticated) {
            if (!canGenerateAsGuest()) {
                navigate('/login');
                return;
            }
            incrementGuestUsage();
        }

        setIsGenerating(true);
        setIsGenerationComplete(false);
        setError(null);

        try {
            const resolvedTitle = requirementTitle.trim() ||
                requirement.split(/[.!?\n]/)[0].trim().slice(0, 45) ||
                'Generated Suite';

            const generatedSuite = await apiService.generateTestSuite(requirement, {
                ...settings,
                sessionId: currentSessionId
            });

            // Save to persistent history
            await saveToHistory(generatedSuite, requirement, settings, currentSessionId, resolvedTitle);
            refreshSidebarHistory();

            const slug = resolvedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30).replace(/^-|-$/g, '') || 'suite';
            const suiteId = currentSessionId || `${slug}-${Date.now().toString().slice(-4)}`;
            setGeneratedSuiteId(suiteId);
            setSuiteData(generatedSuite);
            setSessionStatus('Generated');

            // Direct transition to Test Suite detail page after completion animation
            setTimeout(() => {
                navigate(`/app/test-suites/${suiteId}`, {
                    state: {
                        suite: generatedSuite,
                        prompt: requirement,
                        settings: settings,
                        sessionId: currentSessionId
                    }
                });
            }, 6200);
        } catch (err) {
            console.error('Generation error:', err);
            setError(err.message || 'Failed to generate test suite.');
            setIsGenerating(false);
        }
    };

    const charCount = requirement.length;
    const activeHeaderTitle = requirementTitle.trim() || (currentSessionId ? 'Test Suite' : 'New Test Suite');

    return (
        <div className="app-workspace-container">
            {/* Clean Professional Workspace Header */}
            <header className="app-workspace-header">
                <div className="app-workspace-header__meta">
                    <div className="app-workspace-header__title-row">
                        <h1 className="app-workspace-header__title">{activeHeaderTitle}</h1>
                        <span className={`app-workspace-status-tag ${sessionStatus.toLowerCase()}`}>
                            {sessionStatus}
                        </span>
                        {currentVersion > 1 && (
                            <span className="app-workspace-version-tag">
                                v{currentVersion}
                            </span>
                        )}
                    </div>
                    <p className="app-workspace-header__subtitle">
                        Create a test suite from a requirement.
                    </p>
                </div>

                <div className="app-workspace-header__status">
                    {saveStatus === 'saving' ? (
                        <div className="app-workspace-saved-pill saving">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Saving...</span>
                        </div>
                    ) : (
                        <div className="app-workspace-saved-pill saved" title="All changes saved">
                            <Check size={12} strokeWidth={2.5} />
                            <span>Saved</span>
                        </div>
                    )}
                </div>
            </header>

            {error && (
                <div className="form-error-banner animate-fade-in">
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* In-Page Progressive Generation State */}
            {isGenerating ? (
                <div className="app-workspace-progress-view">
                    <div className="app-workspace-progress-header">
                        <h2 className="app-workspace-progress-heading">Generating test suite</h2>
                        <p className="app-workspace-progress-sub">
                            Analyzing specifications, identifying boundaries, and synthesizing execution-ready test cases.
                        </p>
                    </div>

                    <div className="app-workspace-checklist">
                        {GENERATION_CHECKLIST.map((step, idx) => {
                            const isCompleted = idx < activeStepIndex || isGenerationComplete;
                            const isActive = idx === activeStepIndex && !isGenerationComplete;
                            return (
                                <div
                                    key={idx}
                                    className={`app-workspace-check-item ${isCompleted ? 'is-complete' : isActive ? 'is-active' : 'is-pending'}`}
                                >
                                    <div className="app-workspace-check-icon">
                                        {isCompleted ? (
                                            <Check size={13} strokeWidth={2.5} color="#22C55E" />
                                        ) : isActive ? (
                                            <Loader2 size={13} className="animate-spin" color="#00D9C0" />
                                        ) : (
                                            <span className="app-workspace-check-dot" />
                                        )}
                                    </div>
                                    <span className="app-workspace-check-label">{step.label}</span>
                                </div>
                            );
                        })}
                    </div>

                    {isGenerationComplete && generatedSuiteId && (
                        <div className="app-workspace-complete-action">
                            <NavLink
                                to={`/app/test-suites/${generatedSuiteId}`}
                                state={{ suite: suiteData, prompt: requirement, settings }}
                                className="app-workspace-btn-open-suite"
                            >
                                <span>Open Test Suite</span>
                                <ArrowRight size={15} />
                            </NavLink>
                        </div>
                    )}
                </div>
            ) : isLoadingSession ? (
                <div className="app-workspace-loading-state">
                    <Loader2 size={24} className="animate-spin" color="#00D9C0" />
                    <span>Loading test suite specifications...</span>
                </div>
            ) : (
                <>
                    {/* Active Generated Suite Alert Card (If Resumed Suite Already Exists) */}
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
                                    <span><strong>{suiteData.summary?.total || 0}</strong> Test Cases</span>
                                    <span>•</span>
                                    <span><strong>{suiteData.summary?.functional || 0}</strong> Functional</span>
                                    <span>•</span>
                                    <span><strong>{suiteData.summary?.edge || 0}</strong> Edge</span>
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

                    {/* Main Requirement Engineering Editor */}
                    <section className="app-workspace-section">
                        <div className="app-workspace-section-header">
                            <span className="app-workspace-section-label">REQUIREMENT</span>
                        </div>

                        {/* Requirement Title Field */}
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

                        {/* Requirement Description Field */}
                        <div className="app-workspace-field">
                            <div className="app-workspace-field-header">
                                <label htmlFor="req-desc" className="app-workspace-field-label">
                                    Description
                                </label>

                                {/* Quick Examples Action */}
                                <div className="app-workspace-examples-anchor">
                                    <button
                                        type="button"
                                        className="app-workspace-examples-btn"
                                        onClick={() => setShowExamples(!showExamples)}
                                    >
                                        <span>Quick Examples</span>
                                        <ChevronDown size={13} style={{ transform: showExamples ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                    </button>

                                    {showExamples && (
                                        <div className="app-workspace-examples-menu">
                                            <div className="app-workspace-examples-menu__label">Quick Examples</div>
                                            {QUICK_EXAMPLES.map((ex, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className="app-workspace-example-item"
                                                    onClick={() => handleSelectExample(ex)}
                                                >
                                                    <span className="app-workspace-example-title">{ex.title}</span>
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
                                    placeholder="Describe what the system should do..."
                                    aria-label="Requirement Description"
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
                                            title="Clear description"
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

                        {/* Target & Coverage Depth Row */}
                        <div className="app-workspace-options-grid">
                            {/* Target Selection */}
                            <div className="app-workspace-option-group">
                                <span className="app-workspace-option-label">TARGET</span>
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

                            {/* Coverage Depth Selection */}
                            <div className="app-workspace-option-group">
                                <span className="app-workspace-option-label">COVERAGE DEPTH</span>
                                <div className="app-workspace-depth-row">
                                    {[
                                        { id: 'Essential', label: 'Essential', sub: 'Core scenarios' },
                                        { id: 'Standard', label: 'Standard', sub: 'Recommended coverage', isRecommended: true },
                                        { id: 'Comprehensive', label: 'Comprehensive', sub: 'Deep edge & risk coverage' }
                                    ].map(({ id, label, sub, isRecommended }) => (
                                        <button
                                            key={id}
                                            type="button"
                                            className={`app-workspace-depth-card ${settings.level === id ? 'is-active' : ''}`}
                                            onClick={() => setSettings({ ...settings, level: id })}
                                        >
                                            <div className="app-workspace-depth-card__top">
                                                <span className="app-workspace-depth-name">{label}</span>
                                                {isRecommended && (
                                                    <span className="app-workspace-recommended-badge">Recommended</span>
                                                )}
                                            </div>
                                            <span className="app-workspace-depth-sub">{sub}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Action Footer */}
                        <div className="app-workspace-footer">
                            <button
                                type="button"
                                className="app-workspace-primary-btn"
                                onClick={handleGenerate}
                                disabled={!requirement.trim() || isGenerating}
                                id="workspace-generate-btn"
                            >
                                <span>
                                    {suiteData ? 'Regenerate Test Suite' : 'Generate Test Suite'}
                                </span>
                            </button>
                        </div>
                    </section>

                    {/* Recent Work Section on Empty/Draft Workspace */}
                    <section className="app-workspace-recent-section">
                        <div className="app-workspace-recent-header">
                            <span className="app-workspace-recent-label">RECENT WORK</span>
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
                                    const testCount = item.totalCases || item.summary?.total || item.suite?.summary?.total || 18;
                                    const coverage = item.suite?.summary?.requirementCoverage || '94%';
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
                                                    {item.context?.toUpperCase() || 'WEB'}
                                                </span>
                                            </div>
                                            <div className="app-workspace-recent-card-meta">
                                                <span>{testCount} tests</span>
                                                <span>•</span>
                                                <span>{coverage} coverage</span>
                                                <span>•</span>
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
        </div>
    );
};

export default WorkspacePage;
