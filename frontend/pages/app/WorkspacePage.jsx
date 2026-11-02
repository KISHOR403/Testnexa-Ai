import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import {
    ChevronDown, Trash2, Clipboard, Globe, Smartphone,
    Server, Check, AlertTriangle, Loader2, ArrowRight,
    Layers, Shield, GitBranch, RefreshCw, FileText, CheckCircle2,
    SlidersHorizontal, Sparkles, XCircle, Edit3, ArrowLeft,
    CheckSquare, Square, Eye, RotateCcw, AlertCircle
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
        title: 'Password Reset Flow',
        reqId: 'REQ-AUTH-001',
        description: 'Users can reset their password using their registered email address. The system sends a single-use token valid for 15 minutes. The link expires after single use, and the system rate limits repeated requests to max 3 per hour.',
        acceptanceCriteria: '1. User receives an email with a secure token within 60 seconds.\n2. Token cannot be reused after successful password reset.\n3. Account lockout occurs after 5 failed attempts with invalid tokens.\n4. Password must meet complexity rules: 8+ chars, 1 uppercase, 1 symbol.',
        additionalContext: 'Target environment: Production & Staging web app. Integrates with SendGrid email delivery API.'
    },
    {
        title: 'User Registration & Email Verification',
        reqId: 'REQ-AUTH-002',
        description: 'New users can register with an email address, password, and full name. System validates email format, enforces password complexity (min 8 chars, 1 uppercase, 1 symbol), sends email verification token, and prevents duplicate registration.',
        acceptanceCriteria: '1. Duplicate email addresses are rejected with friendly error.\n2. Verification link valid for 24 hours.\n3. Unverified users cannot access workspace features.\n4. Verification success redirects user to welcome onboarding.',
        additionalContext: 'GDPR compliance required: consent checkbox for terms and marketing communications.'
    },
    {
        title: 'Login & Session Auth with MFA',
        reqId: 'REQ-AUTH-003',
        description: 'Users can authenticate using email and password with optional MFA. System locks account after 5 consecutive failed attempts, invalidates prior sessions on password change, and supports Remember Me for 30 days.',
        acceptanceCriteria: '1. Successful login issues secure HTTP-only JWT cookie.\n2. Invalid credentials display generic error message to prevent enumeration.\n3. TOTP code verified within 30-second window with clock drift tolerance.\n4. Session invalidates on logout across all active tabs.',
        additionalContext: 'Session timeout after 15 minutes of inactivity on enterprise tier.'
    },
    {
        title: 'Cart & Multi-Step Checkout',
        reqId: 'REQ-CHECK-001',
        description: 'Users can checkout cart items with address validation, coupon code application, shipping method selection, and sales tax calculation. Verifies inventory reservation and emits order confirmation upon successful authorization.',
        acceptanceCriteria: '1. Out of stock items notify user and prevent checkout progression.\n2. Expired or invalid coupon codes display specific inline warnings.\n3. Real-time tax calculation based on destination postal code.\n4. Order confirmation email sent with receipt and summary.',
        additionalContext: 'Supports guest checkout and saved member profiles with address auto-complete.'
    },
    {
        title: 'Credit Card Payment Gateway',
        reqId: 'REQ-PAY-001',
        description: 'Process credit card payments via Stripe gateway with 3D Secure verification. Handle successful charges, card declines (insufficient funds, expired card), network timeouts, and idempotent retry requests with idempotency keys.',
        acceptanceCriteria: '1. Validates card number format via Luhn algorithm client-side.\n2. Card declines return clear, non-technical explanations.\n3. Network timeout triggers idempotent background verification.\n4. Never stores raw CVV or PAN in local storage or database.',
        additionalContext: 'PCI-DSS Level 1 compliance scope. Currency handling in USD, EUR, and GBP.'
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

    // ─── 4-STAGE PIPELINE STATE ───
    // 'requirement' | 'analyze' | 'generating' | 'review'
    const [workflowStage, setWorkflowStage] = useState('requirement');

    // Requirement Specification Fields
    const [requirementTitle, setRequirementTitle] = useState('');
    const [requirementId, setRequirementId] = useState('');
    const [requirement, setRequirement] = useState('');
    const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
    const [additionalContext, setAdditionalContext] = useState('');

    // Expandable optional fields visibility
    const [showCriteriaField, setShowCriteriaField] = useState(false);
    const [showContextField, setShowContextField] = useState(false);

    // Generation Configuration
    const [settings, setSettings] = useState({
        type: 'web',
        level: 'Standard',
        language: 'english'
    });

    // Test Suite Includes (genuinely selectable categories)
    const [selectedCategories, setSelectedCategories] = useState({
        functional: true,
        negative: true,
        edge: true,
        validation: true,
        security: false,
        traceability: true
    });

    // Session & Persistence State
    const [currentSessionId, setCurrentSessionId] = useState(routeSessionId || null);
    const [sessionStatus, setSessionStatus] = useState('Draft');
    const [currentVersion, setCurrentVersion] = useState(1);
    const [suiteData, setSuiteData] = useState(null);
    const [isLoadingSession, setIsLoadingSession] = useState(!!routeSessionId);

    // Save tracking
    const [saveStatus, setSaveStatus] = useState('saved'); // 'idle' | 'saving' | 'saved' | 'failed'
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [saveLabel, setSaveLabel] = useState('Saved');
    const [hasDraftRestored, setHasDraftRestored] = useState(false);

    // Stage 2: Requirement Analysis State
    const [analysisData, setAnalysisData] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Stage 4: Test Case Review State
    const [reviewedCases, setReviewedCases] = useState([]);
    const [caseReviewStatus, setCaseReviewStatus] = useState({}); // { [caseId]: 'unreviewed' | 'approved' | 'rejected' }
    const [editingCaseId, setEditingCaseId] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', expectedResult: '', steps: [] });
    const [activeReviewFilter, setActiveReviewFilter] = useState('all');
    const [regeneratingCaseId, setRegeneratingCaseId] = useState(null);
    const [isFinalizingSuite, setIsFinalizingSuite] = useState(false);

    // Generation loading & error states
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [showExamples, setShowExamples] = useState(false);

    // QA Copilot Drawer
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);

    const textareaRef = useRef(null);
    const examplesMenuRef = useRef(null);
    const abortControllerRef = useRef(null);
    const isInitialMount = useRef(true);
    const lastSavedData = useRef({ title: '', requirement: '', settings: '' });
    const maxLength = 3000;

    // Teardown abort controller
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    // Live "Saved Xs ago" updater
    useEffect(() => {
        if (!lastSavedTime || saveStatus === 'saving') return;
        const updateLabel = () => {
            const now = new Date();
            const sec = Math.floor((now - lastSavedTime) / 1000);
            if (sec < 4) setSaveLabel('Saved');
            else if (sec < 60) setSaveLabel(`Saved ${sec}s ago`);
            else {
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
        if (showExamples) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showExamples]);

    // Auto-update coverage depth & categories alignment
    const handleCoverageDepthChange = (depth) => {
        setSettings(prev => ({ ...prev, level: depth }));
        if (depth === 'Essential') {
            setSelectedCategories({
                functional: true,
                negative: false,
                edge: false,
                validation: true,
                security: false,
                traceability: true
            });
        } else if (depth === 'Standard') {
            setSelectedCategories({
                functional: true,
                negative: true,
                edge: true,
                validation: true,
                security: false,
                traceability: true
            });
        } else if (depth === 'Comprehensive') {
            setSelectedCategories({
                functional: true,
                negative: true,
                edge: true,
                validation: true,
                security: true,
                traceability: true
            });
        }
    };

    // Toggle individual category
    const handleCategoryToggle = (catKey) => {
        setSelectedCategories(prev => ({
            ...prev,
            [catKey]: !prev[catKey]
        }));
    };

    // Load existing session or restore pre-auth draft
    useEffect(() => {
        if (!routeSessionId) {
            setCurrentSessionId(null);
            setSessionStatus('Draft');
            setSuiteData(null);
            setIsLoadingSession(false);
            setSaveStatus('saved');
            setLastSavedTime(new Date());

            // Check localStorage for offline draft
            try {
                const localDraft = localStorage.getItem('testnexa_workspace_draft');
                if (localDraft) {
                    const parsed = JSON.parse(localDraft);
                    if (parsed.requirement) {
                        setRequirement(parsed.requirement || '');
                        setRequirementTitle(parsed.title || '');
                        setRequirementId(parsed.reqId || '');
                        if (parsed.acceptanceCriteria) {
                            setAcceptanceCriteria(parsed.acceptanceCriteria);
                            setShowCriteriaField(true);
                        }
                        if (parsed.additionalContext) {
                            setAdditionalContext(parsed.additionalContext);
                            setShowContextField(true);
                        }
                        setHasDraftRestored(true);
                    }
                }
            } catch (e) {}

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
                        // Populate review cases
                        const rawCases = [
                            ...(session.suiteData?.functional || []),
                            ...(session.suiteData?.negative || []),
                            ...(session.suiteData?.edge || []),
                            ...(session.suiteData?.security || []),
                            ...(session.suiteData?.apiChecklist || session.suiteData?.api || [])
                        ];
                        setReviewedCases(rawCases);
                        setWorkflowStage('review');
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

    // Debounced Auto-Save Draft
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (workflowStage !== 'requirement') return;

        // Cache in localStorage for immediate local recovery
        try {
            localStorage.setItem('testnexa_workspace_draft', JSON.stringify({
                title: requirementTitle,
                reqId: requirementId,
                requirement,
                acceptanceCriteria,
                additionalContext,
                settings,
                selectedCategories,
                savedAt: new Date().toISOString()
            }));
        } catch (e) {}

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
                } else if (requirement.trim().length > 15 || requirementTitle.trim().length > 2) {
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
                setSaveStatus('failed');
            }
        }, 1200);

        return () => clearTimeout(timer);
    }, [requirementTitle, requirementId, requirement, acceptanceCriteria, additionalContext, settings, selectedCategories, isAuthenticated, currentSessionId, isLoadingSession, isGenerating, workflowStage, refreshSidebarHistory]);

    // Quick Examples Selection
    const handleSelectExample = (example) => {
        setRequirementTitle(example.title);
        setRequirementId(example.reqId || 'REQ-001');
        setRequirement(example.description);
        if (example.acceptanceCriteria) {
            setAcceptanceCriteria(example.acceptanceCriteria);
            setShowCriteriaField(true);
        }
        if (example.additionalContext) {
            setAdditionalContext(example.additionalContext);
            setShowContextField(true);
        }
        setShowExamples(false);
        if (textareaRef.current) textareaRef.current.focus();
    };

    // Discard / Reset Draft
    const handleDiscardDraft = () => {
        try {
            localStorage.removeItem('testnexa_workspace_draft');
        } catch (e) {}
        setRequirement('');
        setRequirementTitle('');
        setRequirementId('');
        setAcceptanceCriteria('');
        setAdditionalContext('');
        setShowCriteriaField(false);
        setShowContextField(false);
        setHasDraftRestored(false);
    };

    // Paste from clipboard
    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setRequirement((prev) => (prev ? prev + '\n' + text : text).slice(0, maxLength));
        } catch (err) {
            console.error('Paste failed:', err);
        }
    };

    // ─── STAGE 2: ANALYZE REQUIREMENT ───
    const handleAnalyze = async () => {
        if (!requirement.trim() || requirement.trim().length < 15) return;
        setIsAnalyzing(true);
        setError(null);

        try {
            const res = await apiService.analyzeRequirement({
                requirement,
                acceptanceCriteria,
                additionalContext,
                appType: settings.type,
                detailLevel: settings.level === 'Essential' ? 'basic' : settings.level === 'Comprehensive' ? 'detailed' : 'medium'
            });

            if (res.success && res.data) {
                setAnalysisData(res.data);
                if (!requirementTitle && res.data.feature) {
                    setRequirementTitle(res.data.feature);
                }
                setWorkflowStage('analyze');
            } else {
                throw new Error(res.message || 'Requirement analysis failed.');
            }
        } catch (err) {
            setError(err.message || 'Analysis could not be performed. Please verify your requirement.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ─── STAGE 3: GENERATE TEST SUITE ───
    const handleGenerate = async () => {
        if (!requirement.trim() || isGenerating || requirement.trim().length < 15) return;

        if (!isAuthenticated) {
            if (!canGenerateAsGuest()) {
                navigate('/login');
                return;
            }
            incrementGuestUsage();
        }

        setWorkflowStage('generating');
        setIsGenerating(true);
        setError(null);
        abortControllerRef.current = new AbortController();

        try {
            const resolvedTitle = requirementTitle.trim() ||
                (analysisData?.feature) ||
                requirement.split(/[.!?\n]/)[0].trim().slice(0, 45) ||
                'Generated Suite';

            const enabledCategoriesList = Object.keys(selectedCategories).filter(k => selectedCategories[k]);

            // Execute backend generation
            const result = await apiService.generateTestSuite(requirement, {
                ...settings,
                requirementId: requirementId || undefined,
                acceptanceCriteria: acceptanceCriteria || undefined,
                additionalContext: additionalContext || undefined,
                selectedCategories: enabledCategoriesList,
                sessionId: currentSessionId,
                signal: abortControllerRef.current.signal
            });

            const targetSuiteId = result.testSuiteId || result.sessionId || currentSessionId;

            // Sync client history
            await saveToHistory(result, requirement, settings, targetSuiteId, resolvedTitle);
            await refreshSidebarHistory();

            setSuiteData(result);
            setSessionStatus('NeedsReview');

            // Gather all generated test cases for the review experience
            const allCases = [
                ...(result.functional || []),
                ...(result.negative || []),
                ...(result.edge || []),
                ...(result.security || []),
                ...(result.apiChecklist || result.api || [])
            ];

            // Filter out any categories the user specifically unchecked
            const filteredCases = allCases.filter(c => {
                const cat = (c.type || '').toLowerCase();
                if (cat.includes('neg') && !selectedCategories.negative) return false;
                if (cat.includes('edge') && !selectedCategories.edge) return false;
                if (cat.includes('sec') && !selectedCategories.security) return false;
                return true;
            });

            setReviewedCases(filteredCases);

            // Default review status: unreviewed
            const initialReviewStatus = {};
            filteredCases.forEach(c => {
                initialReviewStatus[c.id] = 'unreviewed';
            });
            setCaseReviewStatus(initialReviewStatus);

            setIsGenerating(false);
            setWorkflowStage('review');
        } catch (err) {
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                setIsGenerating(false);
                setWorkflowStage('requirement');
                return;
            }
            console.error('Generation error:', err);
            const userSafeMsg = err.message?.includes('QUOTA_LIMIT')
                ? 'AI service is temporarily busy. Please wait a moment and try again.'
                : err.message || 'Test suite generation failed. Please check your requirement and try again.';
            setError(userSafeMsg);
            setIsGenerating(false);
            setWorkflowStage('requirement');
        } finally {
            abortControllerRef.current = null;
        }
    };

    const handleCancelGenerate = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
        setWorkflowStage('requirement');
        setError(null);
    }, []);

    // ─── STAGE 4: REVIEW ACTIONS ───
    const handleCaseStatusToggle = (caseId, status) => {
        setCaseReviewStatus(prev => ({
            ...prev,
            [caseId]: prev[caseId] === status ? 'unreviewed' : status
        }));
    };

    const handleApproveAll = () => {
        const next = {};
        reviewedCases.forEach(c => {
            next[c.id] = 'approved';
        });
        setCaseReviewStatus(next);
    };

    const handleStartEditCase = (tc) => {
        setEditingCaseId(tc.id);
        setEditForm({
            title: tc.title || '',
            expectedResult: tc.expectedResult || '',
            steps: Array.isArray(tc.steps) ? [...tc.steps] : []
        });
    };

    const handleSaveEditCase = (caseId) => {
        setReviewedCases(prev => prev.map(c => {
            if (c.id === caseId) {
                return {
                    ...c,
                    title: editForm.title,
                    expectedResult: editForm.expectedResult,
                    steps: editForm.steps
                };
            }
            return c;
        }));
        setEditingCaseId(null);
    };

    // Regenerate an individual test case with AI
    const handleRegenerateCase = async (tc) => {
        setRegeneratingCaseId(tc.id);
        try {
            const res = await apiService.regenerateTestCase({
                requirement,
                testCase: tc,
                category: tc.type || 'functional',
                appType: settings.type
            });

            if (res.success && res.data) {
                const updated = res.data;
                setReviewedCases(prev => prev.map(c => c.id === tc.id ? { ...c, ...updated } : c));
                setCaseReviewStatus(prev => ({ ...prev, [tc.id]: 'unreviewed' }));
            }
        } catch (err) {
            alert(`Failed to regenerate case: ${err.message}`);
        } finally {
            setRegeneratingCaseId(null);
        }
    };

    // Finalize suite and persist to Test Suites & Test Cases
    const handleFinalizeSuite = async () => {
        setIsFinalizingSuite(true);
        try {
            const approvedList = reviewedCases.filter(c => caseReviewStatus[c.id] !== 'rejected');
            const targetSuiteId = suiteData?.testSuiteId || suiteData?.sessionId || currentSessionId;

            if (currentSessionId) {
                await sessionService.update(currentSessionId, {
                    status: 'Approved',
                    suiteData: {
                        ...suiteData,
                        functional: approvedList.filter(c => (c.type || '').toLowerCase().includes('func')),
                        negative: approvedList.filter(c => (c.type || '').toLowerCase().includes('neg')),
                        edge: approvedList.filter(c => (c.type || '').toLowerCase().includes('edge')),
                        security: approvedList.filter(c => (c.type || '').toLowerCase().includes('sec')),
                        summary: {
                            ...suiteData?.summary,
                            total: approvedList.length
                        }
                    }
                });
            }

            // Remove draft from local storage
            try { localStorage.removeItem('testnexa_workspace_draft'); } catch (e) {}

            navigate(`/app/test-suites/${targetSuiteId}`, {
                state: {
                    suite: suiteData,
                    prompt: requirement,
                    settings,
                    sessionId: targetSuiteId
                }
            });
        } catch (err) {
            alert(`Failed to finalize test suite: ${err.message}`);
        } finally {
            setIsFinalizingSuite(false);
        }
    };

    const charCount = requirement.length;
    const isInputValid = requirement.trim().length >= 15;

    // Filtered review cases
    const displayedReviewCases = useMemo(() => {
        if (activeReviewFilter === 'all') return reviewedCases;
        if (activeReviewFilter === 'approved') return reviewedCases.filter(c => caseReviewStatus[c.id] === 'approved');
        if (activeReviewFilter === 'rejected') return reviewedCases.filter(c => caseReviewStatus[c.id] === 'rejected');
        if (activeReviewFilter === 'unreviewed') return reviewedCases.filter(c => caseReviewStatus[c.id] === 'unreviewed' || !caseReviewStatus[c.id]);
        return reviewedCases.filter(c => (c.type || '').toLowerCase().includes(activeReviewFilter.toLowerCase()));
    }, [reviewedCases, activeReviewFilter, caseReviewStatus]);

    const reviewMetrics = useMemo(() => {
        const total = reviewedCases.length;
        const approved = reviewedCases.filter(c => caseReviewStatus[c.id] === 'approved').length;
        const rejected = reviewedCases.filter(c => caseReviewStatus[c.id] === 'rejected').length;
        const unreviewed = total - (approved + rejected);
        return { total, approved, rejected, unreviewed };
    }, [reviewedCases, caseReviewStatus]);

    return (
        <div className="app-workspace-container">
            {/* ─── 1. PAGE HEADER & STEPPER ─── */}
            <header className="app-workspace-header">
                <div className="app-workspace-header__meta">
                    <div className="app-workspace-header__title-row">
                        <h1 className="app-workspace-header__title">Create a Test Suite</h1>
                        <span className={`app-workspace-status-tag ${sessionStatus.toLowerCase()}`}>
                            {sessionStatus.toUpperCase() === 'DRAFT' ? 'DRAFT' : sessionStatus}
                        </span>
                        {currentVersion > 1 && (
                            <span className="app-workspace-version-tag">v{currentVersion}</span>
                        )}
                    </div>
                    <p className="app-workspace-header__subtitle">
                        Specify software requirements to analyze ambiguities, configure coverage depth, and generate production-ready test cases.
                    </p>
                </div>

                {/* Four-Stage Stepper: Requirement → Analyze → Generate → Review */}
                <div className="app-workspace-workflow-stepper" aria-label="Workflow Stages">
                    <div
                        className={`app-workspace-step ${workflowStage === 'requirement' ? 'is-active' : 'is-completed'}`}
                        onClick={() => { if (!isGenerating) setWorkflowStage('requirement'); }}
                        style={{ cursor: !isGenerating ? 'pointer' : 'default' }}
                    >
                        <span className="app-workspace-step-num">01</span>
                        <span className="app-workspace-step-name">Requirement</span>
                    </div>

                    <span className="app-workspace-step-arrow">→</span>

                    <div
                        className={`app-workspace-step ${workflowStage === 'analyze' ? 'is-active' : analysisData ? 'is-completed' : ''}`}
                        onClick={() => { if (analysisData && !isGenerating) setWorkflowStage('analyze'); }}
                        style={{ cursor: analysisData && !isGenerating ? 'pointer' : 'default' }}
                    >
                        <span className="app-workspace-step-num">02</span>
                        <span className="app-workspace-step-name">Analyze</span>
                    </div>

                    <span className="app-workspace-step-arrow">→</span>

                    <div className={`app-workspace-step ${workflowStage === 'generating' ? 'is-active' : (suiteData ? 'is-completed' : '')}`}>
                        <span className="app-workspace-step-num">03</span>
                        <span className="app-workspace-step-name">Generate</span>
                    </div>

                    <span className="app-workspace-step-arrow">→</span>

                    <div
                        className={`app-workspace-step ${workflowStage === 'review' ? 'is-active' : ''}`}
                        onClick={() => { if (reviewedCases.length > 0 && !isGenerating) setWorkflowStage('review'); }}
                        style={{ cursor: reviewedCases.length > 0 && !isGenerating ? 'pointer' : 'default' }}
                    >
                        <span className="app-workspace-step-num">04</span>
                        <span className="app-workspace-step-name">Review</span>
                    </div>
                </div>

                {/* Save Status Pill */}
                <div className="app-workspace-header__status">
                    {saveStatus === 'saving' ? (
                        <div className="app-workspace-saved-pill saving">
                            <InlineTestSignal size={12} />
                            <span>Saving draft...</span>
                        </div>
                    ) : saveStatus === 'failed' ? (
                        <div className="app-workspace-saved-pill" style={{ color: '#E06C75', borderColor: 'rgba(224, 108, 117, 0.3)' }}>
                            <AlertCircle size={12} />
                            <span>Save Failed</span>
                        </div>
                    ) : (
                        <div className="app-workspace-saved-pill saved" title="All edits autosaved">
                            <Check size={12} strokeWidth={2.5} />
                            <span>{saveLabel}</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Error Banner with Retry */}
            {error && (
                <div className="app-workspace-error-banner" role="alert">
                    <div className="app-workspace-error-content">
                        <AlertTriangle size={16} className="app-workspace-error-icon" />
                        <div>
                            <div className="app-workspace-error-title">Action could not be completed</div>
                            <div className="app-workspace-error-msg">{error}</div>
                        </div>
                    </div>
                    <div className="app-workspace-error-actions">
                        <button type="button" onClick={handleGenerate} className="app-workspace-btn-retry">
                            <RefreshCw size={13} />
                            <span>Retry</span>
                        </button>
                        <button type="button" onClick={() => setError(null)} className="app-workspace-btn-dismiss">
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Restored Draft Alert Banner */}
            {hasDraftRestored && workflowStage === 'requirement' && (
                <div style={{ background: 'rgba(229, 192, 123, 0.1)', border: '1px solid rgba(229, 192, 123, 0.25)', padding: '8px 16px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#E5C07B' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={14} />
                        <span>Restored saved draft from earlier session.</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleDiscardDraft}
                        style={{ background: 'transparent', border: 0, color: '#E06C75', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.74rem' }}
                    >
                        Discard Draft
                    </button>
                </div>
            )}

            {/* ─── STAGE 3: ASYNCHRONOUS GENERATION EXPERIENCE ─── */}
            {workflowStage === 'generating' && (
                <div style={{ margin: '1rem 0' }}>
                    <AiGenerationLoader
                        requirement={requirement}
                        title={requirementTitle}
                        settings={settings}
                        onCancel={handleCancelGenerate}
                    />
                </div>
            )}

            {/* ─── STAGE 2: REQUIREMENT ANALYSIS VIEW ─── */}
            {workflowStage === 'analyze' && analysisData && (
                <div className="app-workspace-analysis-panel">
                    <div className="app-workspace-analysis-header">
                        <div className="app-workspace-analysis-title">
                            <Sparkles size={16} color="#8BAF9A" />
                            <span>Requirement Analysis: {analysisData.feature}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.74rem', color: '#A0A5A5' }}>Ambiguity Rating:</span>
                            <span className={`app-workspace-ambiguity-badge ${(analysisData.ambiguityAnalysis?.level || 'low').toLowerCase()}`}>
                                {analysisData.ambiguityAnalysis?.level || 'Low'} Ambiguity
                            </span>
                        </div>
                    </div>

                    <div className="app-workspace-analysis-grid">
                        {/* Business Rules & Functionality */}
                        <div className="app-workspace-analysis-card">
                            <span className="app-workspace-analysis-card-title">
                                <Check size={14} /> Extracted Business Rules ({analysisData.businessRules?.length || 0})
                            </span>
                            <ul className="app-workspace-analysis-list">
                                {(analysisData.businessRules || []).map((rule, idx) => (
                                    <li key={idx}>{rule}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Ambiguities & Missing Info */}
                        <div className="app-workspace-analysis-card">
                            <span className="app-workspace-analysis-card-title" style={{ color: '#E5C07B' }}>
                                <AlertTriangle size={14} /> Ambiguities & Unclear Statements ({analysisData.ambiguities?.length || 0})
                            </span>
                            {analysisData.ambiguities?.length > 0 ? (
                                <ul className="app-workspace-analysis-list warn">
                                    {analysisData.ambiguities.map((amb, idx) => (
                                        <li key={idx}>{amb}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ fontSize: '0.76rem', color: '#8BAF9A', margin: 0 }}>
                                    ✓ No critical ambiguities detected. Requirement has clear acceptance boundaries.
                                </p>
                            )}
                        </div>

                        {/* Grounded Assumptions */}
                        <div className="app-workspace-analysis-card">
                            <span className="app-workspace-analysis-card-title">
                                <FileText size={14} /> Missing Info & Grounded Assumptions
                            </span>
                            <ul className="app-workspace-analysis-list">
                                {(analysisData.missingInformation || []).map((item, idx) => (
                                    <li key={idx}><strong>Assumption:</strong> {item}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Planned Scope */}
                        <div className="app-workspace-analysis-card">
                            <span className="app-workspace-analysis-card-title">
                                <Layers size={14} /> Target Test Suite Scope
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: '#BAC5BE' }}>
                                <div>Platform: <strong style={{ color: '#FFFFFF', textTransform: 'capitalize' }}>{settings.type}</strong></div>
                                <div>Depth Tier: <strong style={{ color: '#FFFFFF' }}>{settings.level}</strong> (~{analysisData.scopeSummary?.estimatedCases || 12} test cases)</div>
                                <div>Active Categories: <strong style={{ color: '#8BAF9A' }}>{Object.keys(selectedCategories).filter(k => selectedCategories[k]).join(', ')}</strong></div>
                            </div>
                        </div>
                    </div>

                    <div className="app-workspace-analysis-actions">
                        <button
                            type="button"
                            className="app-workspace-btn-action"
                            onClick={() => setWorkflowStage('requirement')}
                        >
                            <ArrowLeft size={13} />
                            <span>Refine Requirement</span>
                        </button>

                        <button
                            type="button"
                            className="app-workspace-primary-btn"
                            style={{ width: 'auto', padding: '0.6rem 1.4rem' }}
                            onClick={handleGenerate}
                        >
                            <span>Proceed to Generate Suite →</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ─── STAGE 4: DEDICATED TEST CASE REVIEW EXPERIENCE ─── */}
            {workflowStage === 'review' && (
                <div className="app-workspace-review-panel">
                    <div className="app-workspace-review-top-bar">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle2 size={16} color="#8BAF9A" />
                                <strong style={{ fontSize: '1.05rem', color: '#FFFFFF' }}>
                                    {suiteData?.testSuiteName || suiteData?.feature || requirementTitle || 'Generated Test Suite'}
                                </strong>
                            </div>
                            <span style={{ fontSize: '0.74rem', color: '#929B96' }}>
                                Review generated test cases before finalizing. You can approve, reject, edit, or regenerate individual cases.
                            </span>
                        </div>

                        <div className="app-workspace-review-stats">
                            <span className="app-workspace-review-stat-pill">Total: <strong>{reviewMetrics.total}</strong></span>
                            <span className="app-workspace-review-stat-pill" style={{ color: '#8BAF9A' }}>Approved: <strong>{reviewMetrics.approved}</strong></span>
                            <span className="app-workspace-review-stat-pill" style={{ color: '#E06C75' }}>Rejected: <strong>{reviewMetrics.rejected}</strong></span>
                            <span className="app-workspace-review-stat-pill">Unreviewed: <strong>{reviewMetrics.unreviewed}</strong></span>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="app-workspace-review-filters">
                        {[
                            { id: 'all', label: `All (${reviewedCases.length})` },
                            { id: 'functional', label: 'Functional' },
                            { id: 'negative', label: 'Negative' },
                            { id: 'edge', label: 'Edge Cases' },
                            { id: 'security', label: 'Security' },
                            { id: 'approved', label: `Approved (${reviewMetrics.approved})` },
                            { id: 'unreviewed', label: `Unreviewed (${reviewMetrics.unreviewed})` },
                            { id: 'rejected', label: `Rejected (${reviewMetrics.rejected})` }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                className={`app-workspace-filter-btn ${activeReviewFilter === tab.id ? 'is-active' : ''}`}
                                onClick={() => setActiveReviewFilter(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}

                        <div style={{ marginLeft: 'auto' }}>
                            <button
                                type="button"
                                className="app-workspace-btn-action"
                                onClick={handleApproveAll}
                                title="Mark all unreviewed test cases as approved"
                            >
                                <Check size={13} color="#8BAF9A" />
                                <span>Approve All</span>
                            </button>
                        </div>
                    </div>

                    {/* Generated Test Case Cards */}
                    <div className="app-workspace-cases-list">
                        {displayedReviewCases.map((tc, idx) => {
                            const isApproved = caseReviewStatus[tc.id] === 'approved';
                            const isRejected = caseReviewStatus[tc.id] === 'rejected';
                            const isEditing = editingCaseId === tc.id;
                            const isRegenerating = regeneratingCaseId === tc.id;

                            return (
                                <div
                                    key={tc.id || idx}
                                    className={`app-workspace-case-review-card ${isApproved ? 'approved' : ''} ${isRejected ? 'rejected' : ''}`}
                                >
                                    <div className="app-workspace-case-card-header">
                                        <div className="app-workspace-case-title-area">
                                            <div className="app-workspace-case-badges">
                                                <span className="app-workspace-case-id">{tc.id}</span>
                                                <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: '#1C221E', borderRadius: '3px', color: '#BAC5BE' }}>
                                                    {tc.type || 'Functional'}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: '#1C221E', borderRadius: '3px', color: tc.priority === 'High' ? '#E06C75' : '#8BAF9A' }}>
                                                    {tc.priority || 'Medium'}
                                                </span>
                                                {tc.requirementId && (
                                                    <span style={{ fontSize: '0.7rem', color: '#8BAF9A', fontFamily: 'monospace' }}>
                                                        {tc.requirementId}
                                                    </span>
                                                )}
                                            </div>

                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.title}
                                                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                                    style={{ background: '#090B0A', border: '1px solid #8BAF9A', padding: '4px 8px', borderRadius: '4px', color: '#FFF', fontSize: '0.86rem', marginTop: '4px' }}
                                                />
                                            ) : (
                                                <strong style={{ fontSize: '0.88rem', color: '#FFFFFF', marginTop: '2px' }}>
                                                    {tc.title}
                                                </strong>
                                            )}
                                        </div>

                                        {/* Actions Group: Approve / Reject / Edit / Regenerate */}
                                        <div className="app-workspace-case-actions-group">
                                            <button
                                                type="button"
                                                className={`app-workspace-btn-action approve ${isApproved ? 'is-active' : ''}`}
                                                onClick={() => handleCaseStatusToggle(tc.id, 'approved')}
                                                title="Approve this test case"
                                            >
                                                <Check size={12} />
                                                <span>{isApproved ? 'Approved' : 'Approve'}</span>
                                            </button>

                                            <button
                                                type="button"
                                                className={`app-workspace-btn-action reject ${isRejected ? 'is-active' : ''}`}
                                                onClick={() => handleCaseStatusToggle(tc.id, 'rejected')}
                                                title="Reject this test case"
                                            >
                                                <XCircle size={12} />
                                                <span>{isRejected ? 'Rejected' : 'Reject'}</span>
                                            </button>

                                            {isEditing ? (
                                                <button
                                                    type="button"
                                                    className="app-workspace-btn-action"
                                                    onClick={() => handleSaveEditCase(tc.id)}
                                                    style={{ borderColor: '#8BAF9A', color: '#8BAF9A' }}
                                                >
                                                    <Check size={12} /> Save
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="app-workspace-btn-action"
                                                    onClick={() => handleStartEditCase(tc)}
                                                    title="Edit test case details"
                                                >
                                                    <Edit3 size={12} /> Edit
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                className="app-workspace-btn-action"
                                                onClick={() => handleRegenerateCase(tc)}
                                                disabled={isRegenerating}
                                                title="Regenerate this single test case with AI"
                                            >
                                                <RefreshCw size={12} className={isRegenerating ? 'app-workspace-spin' : ''} />
                                                <span>{isRegenerating ? 'Regenerating…' : 'Regenerate'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Test Steps & Expectations */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.76rem', background: '#0C0E0D', padding: '8px 12px', borderRadius: '4px', border: '1px solid #1C221E' }}>
                                        {tc.preconditions && (Array.isArray(tc.preconditions) ? tc.preconditions.length > 0 : Boolean(tc.preconditions)) && (
                                            <div style={{ color: '#929B96', fontSize: '0.72rem' }}>
                                                <strong>Preconditions:</strong> {Array.isArray(tc.preconditions) ? tc.preconditions.join(', ') : tc.preconditions}
                                            </div>
                                        )}

                                        {Array.isArray(tc.steps) && tc.steps.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                                                {tc.steps.map((st, sIdx) => (
                                                    <div key={sIdx} style={{ display: 'flex', gap: '8px', color: '#D3E4D8' }}>
                                                        <span style={{ color: '#777E7E', fontFamily: 'monospace' }}>{sIdx + 1}.</span>
                                                        <span>{typeof st === 'object' ? (st.action || st.step || '') : String(st)}</span>
                                                        {typeof st === 'object' && st.expected && (
                                                            <span style={{ color: '#8BAF9A' }}>↳ {st.expected}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ color: '#8BAF9A', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #1B211D' }}>
                                            <strong>Expected:</strong> {tc.expectedResult || 'Expected acceptance behavior confirmed.'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Review Actions Footer */}
                    <div className="app-workspace-review-footer">
                        <button
                            type="button"
                            className="app-workspace-btn-action"
                            onClick={() => setWorkflowStage('requirement')}
                        >
                            <ArrowLeft size={13} />
                            <span>Back to Requirements</span>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                                type="button"
                                className="app-workspace-btn-action"
                                onClick={handleGenerate}
                                title="Re-run full generation"
                            >
                                <RefreshCw size={13} />
                                <span>Regenerate Suite</span>
                            </button>

                            <button
                                type="button"
                                className="app-workspace-primary-btn"
                                style={{ width: 'auto', padding: '0.65rem 1.4rem' }}
                                onClick={handleFinalizeSuite}
                                disabled={isFinalizingSuite}
                            >
                                <span>{isFinalizingSuite ? 'Creating Test Suite…' : 'Save & Finalize Test Suite →'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── STAGE 1: TWO-COLUMN SPECIFICATION & CONFIGURATION WORKBENCH ─── */}
            {workflowStage === 'requirement' && !isGenerating && (
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

                            {/* Title & Optional Requirement ID */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px' }}>
                                <div className="app-workspace-field">
                                    <label htmlFor="req-title" className="app-workspace-field-label">
                                        Requirement Title <span className="req-required">*</span>
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

                                <div className="app-workspace-field">
                                    <label htmlFor="req-id" className="app-workspace-field-label">
                                        Requirement ID
                                    </label>
                                    <input
                                        id="req-id"
                                        type="text"
                                        className="app-workspace-title-input"
                                        value={requirementId}
                                        onChange={(e) => setRequirementId(e.target.value)}
                                        placeholder="REQ-001"
                                        maxLength={30}
                                        style={{ fontFamily: 'ui-monospace, monospace' }}
                                    />
                                </div>
                            </div>

                            {/* Main Description */}
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
                                        placeholder="Enter user stories, system behavior, or API contract details (e.g. Users can reset their password using registered email...)"
                                        aria-label="Requirement Description"
                                        rows={8}
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

                            {/* Optional Acceptance Criteria */}
                            <div className="app-workspace-expandable-section">
                                {!showCriteriaField ? (
                                    <button
                                        type="button"
                                        className="app-workspace-expandable-btn"
                                        onClick={() => setShowCriteriaField(true)}
                                    >
                                        + Add Acceptance Criteria (Optional)
                                    </button>
                                ) : (
                                    <div className="app-workspace-field">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <label className="app-workspace-field-label">Acceptance Criteria</label>
                                            <button
                                                type="button"
                                                onClick={() => { setAcceptanceCriteria(''); setShowCriteriaField(false); }}
                                                style={{ background: 'transparent', border: 0, color: '#777E7E', fontSize: '0.7rem', cursor: 'pointer' }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <textarea
                                            className="app-workspace-secondary-textarea"
                                            rows={3}
                                            value={acceptanceCriteria}
                                            onChange={e => setAcceptanceCriteria(e.target.value)}
                                            placeholder="Given a registered user, When they submit valid email, Then single-use token sent within 60s..."
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Optional Additional Context */}
                            <div className="app-workspace-expandable-section">
                                {!showContextField ? (
                                    <button
                                        type="button"
                                        className="app-workspace-expandable-btn"
                                        onClick={() => setShowContextField(true)}
                                    >
                                        + Add Additional Context & Constraints (Optional)
                                    </button>
                                ) : (
                                    <div className="app-workspace-field">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <label className="app-workspace-field-label">Additional Context & Technical Constraints</label>
                                            <button
                                                type="button"
                                                onClick={() => { setAdditionalContext(''); setShowContextField(false); }}
                                                style={{ background: 'transparent', border: 0, color: '#777E7E', fontSize: '0.7rem', cursor: 'pointer' }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <textarea
                                            className="app-workspace-secondary-textarea"
                                            rows={2}
                                            value={additionalContext}
                                            onChange={e => setAdditionalContext(e.target.value)}
                                            placeholder="e.g. Integrates with Stripe 3DS, PCI-DSS compliance scope, Chrome 124+ supported"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Configuration & Generation Controls */}
                    <div className="app-workspace-col-side">
                        <div className="app-workspace-card">
                            <div className="app-workspace-card-header">
                                <span className="app-workspace-card-label">GENERATION CONFIGURATION</span>
                            </div>

                            {/* Target Platform Selector */}
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

                            {/* Coverage Depth (Mutually Exclusive) */}
                            <div className="app-workspace-field">
                                <label className="app-workspace-field-label">Coverage Depth</label>
                                <div className="app-workspace-depth-list">
                                    {[
                                        {
                                            id: 'Essential',
                                            label: 'Essential',
                                            sub: 'Core happy-path and critical validation scenarios'
                                        },
                                        {
                                            id: 'Standard',
                                            label: 'Standard',
                                            sub: 'Functional, negative and edge case coverage',
                                            isRecommended: true
                                        },
                                        {
                                            id: 'Comprehensive',
                                            label: 'Comprehensive',
                                            sub: 'Deep functional, edge, security and boundary robustness'
                                        }
                                    ].map(({ id, label, sub, isRecommended }) => (
                                        <button
                                            key={id}
                                            type="button"
                                            className={`app-workspace-depth-card ${settings.level === id ? 'is-active' : ''}`}
                                            onClick={() => handleCoverageDepthChange(id)}
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

                            {/* Test Suite Includes (Genuinely Selectable Checkboxes) */}
                            <div className="app-workspace-deliverables-compact">
                                <span className="app-workspace-deliverables-compact-label">TEST SUITE INCLUDES</span>
                                <div className="app-workspace-categories-grid">
                                    {[
                                        { key: 'functional', label: 'Functional' },
                                        { key: 'negative', label: 'Negative' },
                                        { key: 'edge', label: 'Edge Cases' },
                                        { key: 'validation', label: 'Validation' },
                                        { key: 'security', label: 'Security Vectors' },
                                        { key: 'traceability', label: 'Traceability' }
                                    ].map(({ key, label }) => {
                                        const isChecked = Boolean(selectedCategories[key]);
                                        return (
                                            <label
                                                key={key}
                                                className={`app-workspace-category-toggle ${isChecked ? 'is-checked' : ''}`}
                                                onClick={() => handleCategoryToggle(key)}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    className="app-workspace-category-checkbox"
                                                />
                                                <span>{label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Actions: Analyze Requirement or Direct Generate */}
                            <div className="app-workspace-action-wrap">
                                <button
                                    type="button"
                                    className="app-workspace-primary-btn"
                                    onClick={handleAnalyze}
                                    disabled={!isInputValid || isAnalyzing}
                                    id="workspace-analyze-btn"
                                >
                                    {isAnalyzing ? (
                                        <span>Analyzing Requirement…</span>
                                    ) : (
                                        <span>Analyze Requirement →</span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    disabled={!isInputValid || isGenerating}
                                    style={{ background: 'transparent', border: '1px solid #292D2D', color: '#A0A5A5', padding: '0.45rem', borderRadius: '5px', fontSize: '0.74rem', cursor: 'pointer', transition: 'all 0.15s ease' }}
                                >
                                    Skip analysis and generate directly →
                                </button>

                                {!isInputValid && (
                                    <span className="app-workspace-validation-hint">
                                        Enter at least 15 characters in requirement description.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 5. RECENT WORK SECTION ─── */}
            {workflowStage === 'requirement' && !isGenerating && (
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
                                    (item.suite.security?.length || 0) +
                                    (item.suite.nonFunctional?.length || 0)
                                ) : (item.summary?.total || 0));

                                const coverage = item.quality?.coverageConfidence
                                    ? `${item.quality.coverageConfidence}%`
                                    : item.summary?.requirementCoverage || (testCount > 0 ? 'Coverage Pending' : 'N/A');

                                const reqCode = `REQ-${(item.sessionId || item.id || '001').slice(-3).toUpperCase()}`;
                                const platformLabel = (item.context || item.settings?.type || 'web').toUpperCase();

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
                                                {platformLabel} · {reqCode}
                                            </span>
                                        </div>
                                        <div className="app-workspace-recent-card-meta">
                                            <span>{testCount} test cases</span>
                                            <span>·</span>
                                            <span>{coverage}</span>
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

            {/* ─── 6. CONTEXTUAL FLOATING QA COPILOT ─── */}
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
