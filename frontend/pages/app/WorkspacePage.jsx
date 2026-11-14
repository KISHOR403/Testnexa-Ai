import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import {
    ChevronDown, Trash2, Clipboard, Globe, Smartphone,
    Server, Check, AlertTriangle, ArrowRight,
    Layers, Shield, GitBranch, RefreshCw, FileText, CheckCircle2,
    SlidersHorizontal, Sparkles, XCircle, Edit3, ArrowLeft,
    CheckSquare, Square, AlertCircle, Upload, FileCode,
    Clock, Save, CornerDownLeft, Info, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';
import { apiService } from '../../services/apiService';
import { sessionService } from '../../services/sessionService';
import { InlineTestSignal, AiGenerationLoader } from '../../components/loading';
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

// Vague words to identify for live ambiguity hints
const VAGUE_WORDS = [
    { word: 'quickly', hint: 'Specify exact latency threshold (e.g. ≤ 200ms)' },
    { word: 'fast', hint: 'Replace with response time target (e.g. < 500ms)' },
    { word: 'secure', hint: 'Specify cryptographic standard or protocol (e.g. AES-256, TLS 1.3)' },
    { word: 'should', hint: 'Use deterministic "must" or explicit conditional logic' },
    { word: 'valid', hint: 'Define exact validation regex, schema, or allowed format' },
    { word: 'user-friendly', hint: 'Specify concrete UI feedback or error handling requirements' },
    { word: 'efficient', hint: 'Replace with throughput or memory ceiling (e.g. ≤ 50MB RAM)' },
    { word: 'normal', hint: 'Define standard operational parameters explicitly' },
    { word: 'appropriate', hint: 'State the exact expected behavior or error response code' },
    { word: 'as expected', hint: 'Provide concrete verification criterion' },
    { word: 'stable', hint: 'Specify uptime or MTBF metric (e.g. 99.99% availability)' },
    { word: 'flexible', hint: 'Enumerate supported input variations and parameters' }
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
    const [isIdAutoGenerated, setIsIdAutoGenerated] = useState(true);
    const [requirement, setRequirement] = useState('');
    const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
    const [additionalContext, setAdditionalContext] = useState('');

    // Expandable optional sections visibility
    const [showCriteriaField, setShowCriteriaField] = useState(false);
    const [showContextField, setShowContextField] = useState(false);

    // Inline validation error states on blur
    const [titleTouched, setTitleTouched] = useState(false);
    const [descTouched, setDescTouched] = useState(false);

    // Generation Configuration
    const [settings, setSettings] = useState({
        type: 'web',
        level: 'Standard',
        language: 'english'
    });

    // Test Suite Includes (selectable categories)
    const [selectedCategories, setSelectedCategories] = useState({
        functional: true,
        negative: true,
        edge: true,
        validation: true,
        security: false,
        traceability: true
    });

    // Track whether categories were manually customized vs preset default
    const [isCategoriesCustomized, setIsCategoriesCustomized] = useState(false);

    // Session & Persistence State
    const [currentSessionId, setCurrentSessionId] = useState(routeSessionId || null);
    const [sessionStatus, setSessionStatus] = useState('Draft');
    const [currentVersion, setCurrentVersion] = useState(1);
    const [suiteData, setSuiteData] = useState(null);
    const [isLoadingSession, setIsLoadingSession] = useState(!!routeSessionId);

    // Autosave tracking ('empty' | 'saving' | 'saved' | 'failed')
    const [saveStatus, setSaveStatus] = useState('empty');
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [saveLabel, setSaveLabel] = useState('Not saved yet');
    const [hasDraftRestored, setHasDraftRestored] = useState(false);

    // Stage 2: Requirement Analysis State
    const [analysisData, setAnalysisData] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Stage 4: Test Case Review State
    const [reviewedCases, setReviewedCases] = useState([]);
    const [caseReviewStatus, setCaseReviewStatus] = useState({});
    const [editingCaseId, setEditingCaseId] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', expectedResult: '', steps: [] });
    const [activeReviewFilter, setActiveReviewFilter] = useState('all');
    const [regeneratingCaseId, setRegeneratingCaseId] = useState(null);
    const [isFinalizingSuite, setIsFinalizingSuite] = useState(false);

    // Generation loading & error states
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);

    // QA Copilot Drawer
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);

    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
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

    // Warn on unsaved changes before leaving
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (requirement.trim().length > 15 && saveStatus === 'saving') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [requirement, saveStatus]);

    // Live "Saved Xs ago" updater
    useEffect(() => {
        if (!requirement.trim()) {
            setSaveLabel('Not saved yet');
            setSaveStatus('empty');
            return;
        }

        if (saveStatus === 'saving') {
            setSaveLabel('Saving…');
            return;
        }

        if (!lastSavedTime) return;

        const updateLabel = () => {
            const now = new Date();
            const sec = Math.floor((now - lastSavedTime) / 1000);
            if (sec < 5) setSaveLabel('Saved just now');
            else if (sec < 60) setSaveLabel(`Saved ${sec}s ago`);
            else {
                const min = Math.floor(sec / 60);
                setSaveLabel(`Saved ${min}m ago`);
            }
        };

        updateLabel();
        const interval = setInterval(updateLabel, 5000);
        return () => clearInterval(interval);
    }, [lastSavedTime, saveStatus, requirement]);

    // Auto-derive Requirement ID if not manually edited
    useEffect(() => {
        if (isIdAutoGenerated) {
            if (requirementTitle.trim()) {
                const clean = requirementTitle.trim().replace(/[^a-zA-Z0-9\s]/g, '');
                const words = clean.split(/\s+/).filter(Boolean).slice(0, 2);
                const prefix = words.map(w => w.slice(0, 4).toUpperCase()).join('-');
                setRequirementId(`REQ-${prefix || 'SPEC'}-001`);
            } else if (requirement.trim().length >= 15) {
                setRequirementId('REQ-SPEC-001');
            }
        }
    }, [requirementTitle, requirement, isIdAutoGenerated]);

    // Auto-update coverage depth & categories alignment
    const handleCoverageDepthChange = (depth) => {
        setSettings(prev => ({ ...prev, level: depth }));
        setIsCategoriesCustomized(false);
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
        setSelectedCategories(prev => {
            const next = { ...prev, [catKey]: !prev[catKey] };
            setIsCategoriesCustomized(true);
            return next;
        });
    };

    // Load existing session or restore pre-auth draft
    useEffect(() => {
        if (!routeSessionId) {
            setCurrentSessionId(null);
            setSessionStatus('Draft');
            setSuiteData(null);
            setIsLoadingSession(false);

            // Check localStorage for offline draft
            try {
                const localDraft = localStorage.getItem('testnexa_workspace_draft');
                if (localDraft) {
                    const parsed = JSON.parse(localDraft);
                    if (parsed.requirement && parsed.requirement.trim()) {
                        setRequirement(parsed.requirement || '');
                        setRequirementTitle(parsed.title || '');
                        setRequirementId(parsed.reqId || '');
                        setIsIdAutoGenerated(false);
                        if (parsed.acceptanceCriteria) {
                            setAcceptanceCriteria(parsed.acceptanceCriteria);
                            setShowCriteriaField(true);
                        }
                        if (parsed.additionalContext) {
                            setAdditionalContext(parsed.additionalContext);
                            setShowContextField(true);
                        }
                        if (parsed.settings) {
                            setSettings(parsed.settings);
                        }
                        if (parsed.selectedCategories) {
                            setSelectedCategories(parsed.selectedCategories);
                        }
                        setHasDraftRestored(true);
                        setSaveStatus('saved');
                        setLastSavedTime(new Date(parsed.savedAt || Date.now()));
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

        if (!requirement.trim() && !requirementTitle.trim()) {
            setSaveStatus('empty');
            return;
        }

        // Cache in localStorage for immediate offline recovery
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
        }, 1000);

        return () => clearTimeout(timer);
    }, [requirementTitle, requirementId, requirement, acceptanceCriteria, additionalContext, settings, selectedCategories, isAuthenticated, currentSessionId, isLoadingSession, isGenerating, workflowStage, refreshSidebarHistory]);

    // Manual Save Draft Action
    const handleManualSaveDraft = async () => {
        if (!requirement.trim()) return;
        setSaveStatus('saving');
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

            if (isAuthenticated) {
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
                } else {
                    const createRes = await sessionService.create({
                        title: resolvedTitle,
                        requirement,
                        context: settings.type,
                        depth: settings.level
                    });
                    if (createRes.success && createRes.data?._id) {
                        setCurrentSessionId(createRes.data._id);
                        window.history.replaceState(null, '', `/app/workspace/${createRes.data._id}`);
                    }
                }
                refreshSidebarHistory();
            }
            setSaveStatus('saved');
            setLastSavedTime(new Date());
        } catch (e) {
            setSaveStatus('failed');
        }
    };

    // Quick Examples Selection
    const handleSelectExample = (example) => {
        setRequirementTitle(example.title);
        setRequirementId(example.reqId || 'REQ-AUTH-001');
        setIsIdAutoGenerated(false);
        setRequirement(example.description);
        if (example.acceptanceCriteria) {
            setAcceptanceCriteria(example.acceptanceCriteria);
            setShowCriteriaField(true);
        }
        if (example.additionalContext) {
            setAdditionalContext(example.additionalContext);
            setShowContextField(true);
        }
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
        setIsIdAutoGenerated(true);
        setAcceptanceCriteria('');
        setAdditionalContext('');
        setShowCriteriaField(false);
        setShowContextField(false);
        setHasDraftRestored(false);
        setSaveStatus('empty');
        setSaveLabel('Not saved yet');
    };

    // Paste from clipboard
    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setRequirement((prev) => (prev ? prev + '\n' + text : text).slice(0, maxLength));
                if (textareaRef.current) textareaRef.current.focus();
            }
        } catch (err) {
            console.error('Paste failed:', err);
        }
    };

    // File Upload Handler (PDF/DOCX/TXT)
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === 'string') {
                setRequirement((prev) => (prev ? prev + '\n' + content : content).slice(0, maxLength));
                if (!requirementTitle) {
                    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                    setRequirementTitle(cleanName);
                }
                if (textareaRef.current) textareaRef.current.focus();
            }
        };
        reader.readAsText(file);
    };

    // Import from Jira template
    const handleJiraImport = () => {
        const jiraTemplate = `JIRA-142: Password Recovery Rate Limiting & Auth Audit\n\nUser Story:\nAs a registered user, I want to securely recover my password using a single-use token sent to my verified email address, so that unauthorized attackers cannot enumerate accounts or hijack my session.\n\nAcceptance Criteria:\n1. Timing delta across valid vs non-existent email recovery ≤ 120ms.\n2. Single-use token expires strictly after 900 seconds (15 minutes).\n3. Throttle requests to max 5 attempts/hour per client IP and account ID.`;
        setRequirementTitle('JIRA-142: Password Recovery Rate Limiting');
        setRequirementId('JIRA-142');
        setIsIdAutoGenerated(false);
        setRequirement(jiraTemplate);
        setAcceptanceCriteria('1. Token TTL 900s.\n2. Constant time response ≤ 120ms.\n3. Rate limiting max 5/hr.');
        setShowCriteriaField(true);
        if (textareaRef.current) textareaRef.current.focus();
    };

    // ─── STAGE 2: ANALYZE REQUIREMENT ───
    const handleAnalyze = useCallback(async () => {
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
    }, [requirement, acceptanceCriteria, additionalContext, settings, requirementTitle]);

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

            await saveToHistory(result, requirement, settings, targetSuiteId, resolvedTitle);
            await refreshSidebarHistory();

            setSuiteData(result);
            setSessionStatus('NeedsReview');

            const allCases = [
                ...(result.functional || []),
                ...(result.negative || []),
                ...(result.edge || []),
                ...(result.security || []),
                ...(result.apiChecklist || result.api || [])
            ];

            const filteredCases = allCases.filter(c => {
                const cat = (c.type || '').toLowerCase();
                if (cat.includes('neg') && !selectedCategories.negative) return false;
                if (cat.includes('edge') && !selectedCategories.edge) return false;
                if (cat.includes('sec') && !selectedCategories.security) return false;
                return true;
            });

            setReviewedCases(filteredCases);

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

    // Keyboard Shortcuts: Ctrl/Cmd + Enter to analyze; Ctrl/Cmd + K to focus
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (workflowStage === 'requirement' && requirement.trim().length >= 15 && !isAnalyzing) {
                    handleAnalyze();
                }
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                if (textareaRef.current) {
                    textareaRef.current.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [workflowStage, requirement, isAnalyzing, handleAnalyze]);

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

    // Live Ambiguity Detection in Description
    const detectedAmbiguities = useMemo(() => {
        if (!requirement.trim()) return [];
        const lower = requirement.toLowerCase();
        const found = [];
        VAGUE_WORDS.forEach(({ word, hint }) => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            if (regex.test(lower)) {
                found.push({ word, hint });
            }
        });
        return found;
    }, [requirement]);

    // Validation metrics
    const charCount = requirement.length;
    const isInputValid = requirement.trim().length >= 15;
    const isTitleValid = !titleTouched || requirementTitle.trim().length >= 3;
    const isDescValid = !descTouched || isInputValid;

    // Disabled reason text
    const disabledReason = useMemo(() => {
        if (!requirement.trim()) return 'Enter requirement description to analyze';
        if (requirement.trim().length < 15) {
            return `Minimum 15 characters required (${requirement.trim().length}/15)`;
        }
        return null;
    }, [requirement]);

    // Count of active test types
    const activeCategoriesCount = useMemo(() => {
        return Object.values(selectedCategories).filter(Boolean).length;
    }, [selectedCategories]);

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

    // De-duplicated recent items
    const uniqueWorkspaceHistory = useMemo(() => {
        const seen = new Set();
        const list = [];
        (history || []).forEach(item => {
            const key = (item.title || item.feature || '').trim().toLowerCase() || item.sessionId || item.id;
            if (key && !seen.has(key)) {
                seen.add(key);
                list.push(item);
            }
        });
        return list;
    }, [history]);

    return (
        <div className="app-workspace-container">
            {/* ─── 1. PAGE HEADER (TITLE + DRAFT LEFT, AUTOSAVE STATUS RIGHT) ─── */}
            <header className="app-workspace-header">
                <div className="app-workspace-header__title-row">
                    <h1 className="app-workspace-header__title">Create a test suite</h1>
                    <span className="app-workspace-status-tag draft">Draft</span>
                    {currentVersion > 1 && (
                        <span className="app-workspace-version-tag">v{currentVersion}</span>
                    )}
                </div>

                {/* Autosave Status Pill */}
                <div className="app-workspace-header__status">
                    <div className={`app-workspace-saved-pill ${saveStatus}`}>
                        {saveStatus === 'saving' && <InlineTestSignal size={12} />}
                        {saveStatus === 'saved' && <Check size={13} strokeWidth={2.5} />}
                        {saveStatus === 'failed' && <AlertCircle size={13} />}
                        {saveStatus === 'empty' && <Clock size={13} />}
                        <span>{saveLabel}</span>
                    </div>
                </div>
            </header>

            {/* ─── STICKY WORKFLOW STEPPER (MIN 14PX CHIPS, DONE/CURRENT/UPCOMING) ─── */}
            <nav className="app-workspace-workflow-stepper-wrap" aria-label="Workflow progress stepper">
                <div className="app-workspace-workflow-stepper">
                    {/* Stage 1: Requirement */}
                    <button
                        type="button"
                        className={`app-workspace-step-chip ${workflowStage === 'requirement' ? 'is-current' : 'is-done'}`}
                        onClick={() => { if (!isGenerating) setWorkflowStage('requirement'); }}
                        disabled={isGenerating}
                        aria-current={workflowStage === 'requirement' ? 'step' : undefined}
                    >
                        <div className="app-workspace-step-indicator">
                            {workflowStage !== 'requirement' ? (
                                <Check size={12} strokeWidth={3} />
                            ) : (
                                <span className="app-workspace-step-dot" />
                            )}
                        </div>
                        <span className="app-workspace-step-label">01 Requirement</span>
                    </button>

                    <span className="app-workspace-step-divider">/</span>

                    {/* Stage 2: Analyze */}
                    <button
                        type="button"
                        className={`app-workspace-step-chip ${workflowStage === 'analyze' ? 'is-current' : analysisData ? 'is-done' : 'is-upcoming'}`}
                        onClick={() => { if (analysisData && !isGenerating) setWorkflowStage('analyze'); }}
                        disabled={!analysisData || isGenerating}
                        aria-current={workflowStage === 'analyze' ? 'step' : undefined}
                    >
                        <div className="app-workspace-step-indicator">
                            {analysisData && workflowStage !== 'analyze' ? (
                                <Check size={12} strokeWidth={3} />
                            ) : (
                                <span className="app-workspace-step-dot" />
                            )}
                        </div>
                        <span className="app-workspace-step-label">02 Analyze</span>
                    </button>

                    <span className="app-workspace-step-divider">/</span>

                    {/* Stage 3: Generate */}
                    <button
                        type="button"
                        className={`app-workspace-step-chip ${workflowStage === 'generating' ? 'is-current' : suiteData ? 'is-done' : 'is-upcoming'}`}
                        disabled={true}
                        aria-current={workflowStage === 'generating' ? 'step' : undefined}
                    >
                        <div className="app-workspace-step-indicator">
                            {suiteData && workflowStage !== 'generating' ? (
                                <Check size={12} strokeWidth={3} />
                            ) : (
                                <span className="app-workspace-step-dot" />
                            )}
                        </div>
                        <span className="app-workspace-step-label">03 Generate</span>
                    </button>

                    <span className="app-workspace-step-divider">/</span>

                    {/* Stage 4: Review */}
                    <button
                        type="button"
                        className={`app-workspace-step-chip ${workflowStage === 'review' ? 'is-current' : reviewedCases.length > 0 ? 'is-done' : 'is-upcoming'}`}
                        onClick={() => { if (reviewedCases.length > 0 && !isGenerating) setWorkflowStage('review'); }}
                        disabled={reviewedCases.length === 0 || isGenerating}
                        aria-current={workflowStage === 'review' ? 'step' : undefined}
                    >
                        <div className="app-workspace-step-indicator">
                            <span className="app-workspace-step-dot" />
                        </div>
                        <span className="app-workspace-step-label">04 Review</span>
                    </button>
                </div>
            </nav>

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

            {/* Restored Draft Alert Banner (Strict B&W) */}
            {hasDraftRestored && workflowStage === 'requirement' && (
                <div className="app-workspace-restored-banner" role="status">
                    <div className="app-workspace-restored-content">
                        <Sparkles size={15} color="#FFFFFF" />
                        <span>Restored previous draft from this browser session.</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleDiscardDraft}
                        className="app-workspace-btn-discard-draft"
                    >
                        Discard draft
                    </button>
                </div>
            )}

            {/* ─── STAGE 3: ASYNCHRONOUS GENERATION EXPERIENCE ─── */}
            {workflowStage === 'generating' && (
                <div style={{ margin: '1.5rem 0' }}>
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
                            <Sparkles size={16} color="#FFFFFF" />
                            <span>Requirement analysis: {analysisData.feature}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.72)' }}>Ambiguity rating:</span>
                            <span className="app-workspace-ambiguity-badge">
                                {analysisData.ambiguityAnalysis?.level || 'Low'} ambiguity
                            </span>
                        </div>
                    </div>

                    <div className="app-workspace-analysis-grid">
                        {/* Extracted Business Rules */}
                        <div className="app-workspace-analysis-card">
                            <span className="app-workspace-analysis-card-title">
                                <Check size={14} color="#FFFFFF" /> Extracted business rules ({analysisData.businessRules?.length || 0})
                            </span>
                            <ul className="app-workspace-analysis-list">
                                {(analysisData.businessRules || []).map((rule, idx) => (
                                    <li key={idx}>{rule}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Ambiguities & Missing Info */}
                        <div className="app-workspace-analysis-card">
                            <span className="app-workspace-analysis-card-title">
                                <AlertTriangle size={14} color="#FFFFFF" /> Ambiguities & unstated conditions ({analysisData.ambiguities?.length || 0})
                            </span>
                            {analysisData.ambiguities?.length > 0 ? (
                                <ul className="app-workspace-analysis-list">
                                    {analysisData.ambiguities.map((amb, idx) => (
                                        <li key={idx}>{amb}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.72)', margin: 0 }}>
                                    ✓ No critical ambiguities detected. Requirement has clear acceptance boundaries.
                                </p>
                            )}
                        </div>

                        {/* Grounded Assumptions */}
                        <div className="app-workspace-analysis-card">
                            <span className="app-workspace-analysis-card-title">
                                <FileText size={14} color="#FFFFFF" /> Grounded assumptions
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
                                <Layers size={14} color="#FFFFFF" /> Target suite scope
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.72)' }}>
                                <div>Platform: <strong style={{ color: '#FFFFFF', textTransform: 'capitalize' }}>{settings.type}</strong></div>
                                <div>Depth tier: <strong style={{ color: '#FFFFFF' }}>{settings.level}</strong> (~{analysisData.scopeSummary?.estimatedCases || 18} test cases)</div>
                                <div>Active categories: <strong style={{ color: '#FFFFFF' }}>{Object.keys(selectedCategories).filter(k => selectedCategories[k]).join(', ')}</strong></div>
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
                            <span>Refine requirement</span>
                        </button>

                        <button
                            type="button"
                            className="app-workspace-primary-btn"
                            style={{ width: 'auto', padding: '0.65rem 1.5rem' }}
                            onClick={handleGenerate}
                        >
                            <span>Proceed to generate suite →</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ─── STAGE 4: DEDICATED TEST CASE REVIEW EXPERIENCE ─── */}
            {workflowStage === 'review' && (
                <div className="app-workspace-review-panel">
                    <div className="app-workspace-review-top-bar">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle2 size={16} color="#FFFFFF" />
                                <strong style={{ fontSize: '1.05rem', color: '#FFFFFF' }}>
                                    {suiteData?.testSuiteName || suiteData?.feature || requirementTitle || 'Generated Test Suite'}
                                </strong>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.72)' }}>
                                Review generated test cases before finalizing. Approve, reject, edit, or regenerate individual test cases.
                            </span>
                        </div>

                        <div className="app-workspace-review-stats">
                            <span className="app-workspace-review-stat-pill">Total: <strong>{reviewMetrics.total}</strong></span>
                            <span className="app-workspace-review-stat-pill">Approved: <strong>{reviewMetrics.approved}</strong></span>
                            <span className="app-workspace-review-stat-pill">Rejected: <strong>{reviewMetrics.rejected}</strong></span>
                            <span className="app-workspace-review-stat-pill">Unreviewed: <strong>{reviewMetrics.unreviewed}</strong></span>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="app-workspace-review-filters">
                        {[
                            { id: 'all', label: `All (${reviewedCases.length})` },
                            { id: 'functional', label: 'Functional' },
                            { id: 'negative', label: 'Negative' },
                            { id: 'edge', label: 'Edge cases' },
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
                                <Check size={13} color="#FFFFFF" />
                                <span>Approve all</span>
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
                                                <span className="app-workspace-case-type-badge">
                                                    {tc.type || 'Functional'}
                                                </span>
                                                <span className={`app-workspace-priority-badge ${tc.priority === 'High' || tc.priority === 'P0' ? 'is-high' : 'is-normal'}`}>
                                                    {tc.priority || 'Medium'}
                                                </span>
                                                {tc.requirementId && (
                                                    <span className="app-workspace-case-req-tag">
                                                        {tc.requirementId}
                                                    </span>
                                                )}
                                            </div>

                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.title}
                                                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                                    className="app-workspace-edit-case-input"
                                                />
                                            ) : (
                                                <strong className="app-workspace-case-heading">
                                                    {tc.title}
                                                </strong>
                                            )}
                                        </div>

                                        {/* Actions: Approve / Reject / Edit / Regenerate */}
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
                                                    style={{ borderColor: '#7DD3FC', color: '#7DD3FC' }}
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

                                    {/* Test Steps & Assertions */}
                                    <div className="app-workspace-case-body">
                                        {tc.preconditions && (Array.isArray(tc.preconditions) ? tc.preconditions.length > 0 : Boolean(tc.preconditions)) && (
                                            <div className="app-workspace-case-precond">
                                                <strong>Preconditions:</strong> {Array.isArray(tc.preconditions) ? tc.preconditions.join(', ') : tc.preconditions}
                                            </div>
                                        )}

                                        {Array.isArray(tc.steps) && tc.steps.length > 0 && (
                                            <div className="app-workspace-case-steps">
                                                {tc.steps.map((st, sIdx) => (
                                                    <div key={sIdx} className="app-workspace-case-step-row">
                                                        <span className="app-workspace-step-idx">{sIdx + 1}.</span>
                                                        <span>{typeof st === 'object' ? (st.action || st.step || '') : String(st)}</span>
                                                        {typeof st === 'object' && st.expected && (
                                                            <span className="app-workspace-step-expected">↳ {st.expected}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="app-workspace-case-expected-footer">
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
                            <span>Back to requirements</span>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                                type="button"
                                className="app-workspace-btn-action"
                                onClick={handleGenerate}
                                title="Re-run full generation"
                            >
                                <RefreshCw size={13} />
                                <span>Regenerate suite</span>
                            </button>

                            <button
                                type="button"
                                className="app-workspace-primary-btn"
                                style={{ width: 'auto', padding: '0.65rem 1.5rem' }}
                                onClick={handleFinalizeSuite}
                                disabled={isFinalizingSuite}
                            >
                                <span>{isFinalizingSuite ? 'Creating test suite…' : 'Save & finalize test suite →'}</span>
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
                                <span className="app-workspace-card-label">Requirement specification</span>
                            </div>

                            {/* Visible Quick Examples Chip Row */}
                            <div className="app-workspace-quick-examples-bar">
                                <span className="app-workspace-quick-examples-tag">Quick examples:</span>
                                <div className="app-workspace-quick-examples-chips" role="list">
                                    {QUICK_EXAMPLES.map((ex, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="app-workspace-example-chip"
                                            onClick={() => handleSelectExample(ex)}
                                            title={ex.description}
                                        >
                                            <span>{ex.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Title & Requirement ID (Auto-Generated & Editable) */}
                            <div className="app-workspace-title-row-grid">
                                <div className="app-workspace-field">
                                    <div className="app-workspace-field-row">
                                        <label htmlFor="req-title" className="app-workspace-field-label">
                                            Requirement title <span className="req-required">*</span>
                                        </label>
                                    </div>
                                    <input
                                        id="req-title"
                                        type="text"
                                        className={`app-workspace-title-input ${!isTitleValid ? 'has-error' : ''}`}
                                        value={requirementTitle}
                                        onChange={(e) => setRequirementTitle(e.target.value)}
                                        onBlur={() => setTitleTouched(true)}
                                        placeholder="e.g. Password Reset Flow"
                                        maxLength={120}
                                        aria-required="true"
                                        aria-invalid={!isTitleValid}
                                        aria-describedby={!isTitleValid ? "req-title-error" : undefined}
                                    />
                                    {!isTitleValid && (
                                        <span id="req-title-error" className="app-workspace-inline-error">
                                            Title should be at least 3 characters.
                                        </span>
                                    )}
                                </div>

                                <div className="app-workspace-field">
                                    <div className="app-workspace-field-row">
                                        <label htmlFor="req-id" className="app-workspace-field-label">
                                            Requirement ID
                                        </label>
                                        {isIdAutoGenerated && requirementId && (
                                            <span className="app-workspace-auto-tag">auto</span>
                                        )}
                                    </div>
                                    <input
                                        id="req-id"
                                        type="text"
                                        className="app-workspace-title-input mono"
                                        value={requirementId}
                                        onChange={(e) => {
                                            setRequirementId(e.target.value);
                                            setIsIdAutoGenerated(false);
                                        }}
                                        placeholder="REQ-AUTH-001"
                                        maxLength={30}
                                        title="Identifier linking test cases directly back to specification clauses"
                                    />
                                </div>
                            </div>

                            {/* Main Requirement Description with Paste, Upload, Jira Buttons */}
                            <div className="app-workspace-field">
                                <div className="app-workspace-field-row">
                                    <label htmlFor="req-desc" className="app-workspace-field-label">
                                        Requirement description <span className="req-required">*</span>
                                    </label>

                                    {/* Action Shortcuts Toolbar: Segmented Control */}
                                    <div className="app-workspace-input-toolbar">
                                        <div className="app-workspace-tool-segmented">
                                            <button
                                                type="button"
                                                className="app-workspace-tool-seg-btn"
                                                onClick={handlePaste}
                                                title="Paste text from clipboard"
                                                aria-label="Paste from clipboard"
                                            >
                                                <Clipboard size={12} />
                                                <span>Paste</span>
                                            </button>

                                            <button
                                                type="button"
                                                className="app-workspace-tool-seg-btn"
                                                onClick={() => fileInputRef.current?.click()}
                                                title="Upload requirement file (PDF, DOCX, TXT)"
                                                aria-label="Upload requirement file"
                                            >
                                                <Upload size={12} />
                                                <span>Upload file</span>
                                            </button>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".txt,.pdf,.docx,.doc,.md"
                                                style={{ display: 'none' }}
                                                onChange={handleFileUpload}
                                            />

                                            <button
                                                type="button"
                                                className="app-workspace-tool-seg-btn"
                                                onClick={handleJiraImport}
                                                title="Import Jira user story template"
                                                aria-label="Import from Jira"
                                            >
                                                <FileCode size={12} />
                                                <span>Import Jira</span>
                                            </button>
                                        </div>

                                        {charCount > 0 && (
                                            <button
                                                type="button"
                                                className="app-workspace-toolbar-clear-btn"
                                                onClick={() => setRequirement('')}
                                                title="Clear requirement text"
                                                aria-label="Clear requirement"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="app-workspace-textarea-wrap">
                                    <textarea
                                        id="req-desc"
                                        ref={textareaRef}
                                        className={`app-workspace-textarea ${!isDescValid ? 'has-error' : ''}`}
                                        value={requirement}
                                        onChange={(e) => setRequirement(e.target.value)}
                                        onBlur={() => setDescTouched(true)}
                                        maxLength={maxLength}
                                        placeholder="Describe the software feature, business logic, acceptance criteria, or API payload (e.g. Users can reset password using registered email...)"
                                        aria-label="Requirement description"
                                        aria-required="true"
                                        aria-invalid={!isDescValid}
                                        aria-describedby={!isDescValid ? "req-desc-error" : undefined}
                                        rows={8}
                                    />
                                    {/* 0 / 3000 counter moved to bottom-right inside textarea wrap */}
                                    <span className="app-workspace-textarea-counter">
                                        {charCount} / {maxLength}
                                    </span>
                                </div>

                                {!isDescValid && (
                                    <span id="req-desc-error" className="app-workspace-inline-error">
                                        Requirement description must be at least 15 characters to synthesize tests.
                                    </span>
                                )}

                                {/* Live Ambiguity Detection Inspector (Monochrome White Wavy Underline) */}
                                {detectedAmbiguities.length > 0 && (
                                    <div className="app-workspace-ambiguity-inspector" role="status">
                                        <div className="app-workspace-ambiguity-inspector-title">
                                            <AlertTriangle size={13} color="#FFFFFF" />
                                            <span>
                                                {detectedAmbiguities.length} {detectedAmbiguities.length === 1 ? 'ambiguity hint' : 'ambiguity hints'} detected in description:
                                            </span>
                                        </div>
                                        <div className="app-workspace-ambiguity-chips">
                                            {detectedAmbiguities.map(({ word, hint }, idx) => (
                                                <div key={idx} className="app-workspace-ambiguity-chip" title={hint}>
                                                    <span className="app-workspace-vague-word">"{word}"</span>
                                                    <span className="app-workspace-vague-arrow">→</span>
                                                    <span className="app-workspace-vague-hint">{hint}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Optional Collapsible Section: Acceptance Criteria */}
                            <div className="app-workspace-collapsible-block">
                                <button
                                    type="button"
                                    className="app-workspace-collapsible-header-btn"
                                    onClick={() => setShowCriteriaField(!showCriteriaField)}
                                    aria-expanded={showCriteriaField}
                                >
                                    <div className="app-workspace-collapsible-title-wrap">
                                        <CheckSquare size={15} color="#FFFFFF" />
                                        <div>
                                            <span className="app-workspace-collapsible-title">Acceptance criteria</span>
                                            <span className="app-workspace-collapsible-hint">Define concrete pass/fail conditions to enforce strict test assertions</span>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        size={14}
                                        style={{
                                            transform: showCriteriaField ? 'rotate(180deg)' : 'none',
                                            transition: 'transform 0.18s ease'
                                        }}
                                    />
                                </button>

                                {showCriteriaField && (
                                    <div className="app-workspace-collapsible-body">
                                        <textarea
                                            id="req-criteria"
                                            className="app-workspace-secondary-textarea"
                                            rows={3}
                                            value={acceptanceCriteria}
                                            onChange={e => setAcceptanceCriteria(e.target.value)}
                                            placeholder="1. Given registered user, When email submitted, Then single-use token sent within 60s.&#10;2. Token expires after 15m or single use."
                                            aria-label="Acceptance criteria"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Optional Collapsible Section: Additional Context & Constraints */}
                            <div className="app-workspace-collapsible-block">
                                <button
                                    type="button"
                                    className="app-workspace-collapsible-header-btn"
                                    onClick={() => setShowContextField(!showContextField)}
                                    aria-expanded={showContextField}
                                >
                                    <div className="app-workspace-collapsible-title-wrap">
                                        <SlidersHorizontal size={15} color="#FFFFFF" />
                                        <div>
                                            <span className="app-workspace-collapsible-title">Additional context & constraints</span>
                                            <span className="app-workspace-collapsible-hint">Specify technical constraints, target environments, and compliance scope</span>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        size={14}
                                        style={{
                                            transform: showContextField ? 'rotate(180deg)' : 'none',
                                            transition: 'transform 0.18s ease'
                                        }}
                                    />
                                </button>

                                {showContextField && (
                                    <div className="app-workspace-collapsible-body">
                                        <textarea
                                            id="req-context"
                                            className="app-workspace-secondary-textarea"
                                            rows={2}
                                            value={additionalContext}
                                            onChange={e => setAdditionalContext(e.target.value)}
                                            placeholder="e.g. Integrates with SendGrid API, staging environment, PCI-DSS compliance scope, Chromium & Firefox targets."
                                            aria-label="Additional context and technical constraints"
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
                                <span className="app-workspace-card-label">Generation configuration</span>
                            </div>

                            {/* Target Platform Selector (Strict B&W) */}
                            <div className="app-workspace-field">
                                <label className="app-workspace-field-label">Target platform</label>
                                <div className="app-workspace-segmented" role="radiogroup" aria-label="Target platform">
                                    {[
                                        { id: 'web', label: 'Web', icon: Globe },
                                        { id: 'mobile', label: 'Mobile', icon: Smartphone },
                                        { id: 'api', label: 'API', icon: Server }
                                    ].map(({ id, label, icon: Icon }) => {
                                        const isSelected = settings.type === id;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                className={`app-workspace-seg-btn ${isSelected ? 'is-active' : ''}`}
                                                onClick={() => setSettings({ ...settings, type: id })}
                                                role="radio"
                                                aria-checked={isSelected}
                                            >
                                                <Icon size={14} />
                                                <span>{label}</span>
                                                {isSelected && (
                                                    <div className="app-workspace-check-dot">
                                                        <Check size={10} color="#000000" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Coverage Depth Cards (Shows Estimated Test Count & Time) */}
                            <div className="app-workspace-field">
                                <div className="app-workspace-field-row">
                                    <label className="app-workspace-field-label">Coverage depth</label>
                                </div>
                                <div className="app-workspace-depth-list" role="radiogroup" aria-label="Coverage depth">
                                    {[
                                        {
                                            id: 'Essential',
                                            label: 'Essential',
                                            sub: 'Core happy-path and critical validation scenarios',
                                            estCount: '~6–8 tests',
                                            estTime: '~15s run'
                                        },
                                        {
                                            id: 'Standard',
                                            label: 'Standard',
                                            sub: 'Functional, negative, and edge case coverage',
                                            estCount: '~18–24 tests',
                                            estTime: '~45s run',
                                            isRecommended: true
                                        },
                                        {
                                            id: 'Comprehensive',
                                            label: 'Comprehensive',
                                            sub: 'Deep functional, edge, security vectors, and boundary stress',
                                            estCount: '~40–55 tests',
                                            estTime: '~2m run'
                                        }
                                    ].map(({ id, label, sub, estCount, estTime, isRecommended }) => {
                                        const isSelected = settings.level === id;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                className={`app-workspace-depth-card ${isSelected ? 'is-active' : ''}`}
                                                onClick={() => handleCoverageDepthChange(id)}
                                                role="radio"
                                                aria-checked={isSelected}
                                            >
                                                <div className="app-workspace-depth-card__top">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span className="app-workspace-depth-name">{label}</span>
                                                        {isSelected && (
                                                            <div className="app-workspace-check-dot">
                                                                <Check size={10} color="#000000" strokeWidth={3} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isRecommended && (
                                                        <span className="app-workspace-recommended-badge">RECOMMENDED</span>
                                                    )}
                                                </div>
                                                <span className="app-workspace-depth-sub">{sub}</span>
                                                <div className="app-workspace-depth-meta">
                                                    <span>{estCount}</span>
                                                    <span>•</span>
                                                    <span>{estTime}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Test Suite Includes (With Live Counter & Customized Note) */}
                            <div className="app-workspace-deliverables-compact">
                                <div className="app-workspace-deliverables-header">
                                    <span className="app-workspace-deliverables-compact-label">Test suite includes</span>
                                    <span className="app-workspace-deliverables-count">
                                        {activeCategoriesCount} of 6 selected
                                    </span>
                                </div>

                                {isCategoriesCustomized && (
                                    <div className="app-workspace-customized-note">
                                        <Info size={12} color="var(--text-2)" />
                                        <span>Customized: differs from {settings.level} preset</span>
                                    </div>
                                )}

                                <div className="app-workspace-categories-grid">
                                    {[
                                        { key: 'functional', label: 'Functional' },
                                        { key: 'negative', label: 'Negative' },
                                        { key: 'edge', label: 'Edge cases' },
                                        { key: 'validation', label: 'Validation' },
                                        { key: 'security', label: 'Security vectors' },
                                        { key: 'traceability', label: 'Traceability' }
                                    ].map(({ key, label }) => {
                                        const isChecked = Boolean(selectedCategories[key]);
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                className={`app-workspace-category-toggle ${isChecked ? 'is-checked' : ''}`}
                                                onClick={() => handleCategoryToggle(key)}
                                                role="checkbox"
                                                aria-checked={isChecked}
                                            >
                                                <div className={`app-workspace-fake-checkbox ${isChecked ? 'is-checked' : ''}`}>
                                                    {isChecked && <Check size={11} color="#000000" strokeWidth={3} />}
                                                </div>
                                                <span>{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── P0. STICKY BOTTOM ACTION BAR (INSIDE FORM VIEW) ─── */}
            {workflowStage === 'requirement' && !isGenerating && (
                <div className="app-workspace-sticky-action-bar" role="region" aria-label="Requirement actions">
                    <div className="app-workspace-action-left">
                        <button
                            type="button"
                            className="app-workspace-primary-btn"
                            onClick={handleAnalyze}
                            disabled={!isInputValid || isAnalyzing}
                            id="workspace-analyze-btn"
                        >
                            {isAnalyzing ? (
                                <span>Analyzing requirement…</span>
                            ) : (
                                <>
                                    <span>Analyze requirement</span>
                                    <kbd className="app-workspace-kbd">Ctrl ↵</kbd>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            className="app-workspace-btn-secondary"
                            onClick={handleManualSaveDraft}
                            disabled={!requirement.trim()}
                        >
                            <Save size={13} />
                            <span>Save draft</span>
                        </button>

                        {/* Disabled State Reason Text */}
                        {disabledReason && (
                            <span className="app-workspace-disabled-reason" role="status">
                                {disabledReason}
                            </span>
                        )}
                    </div>

                    <div className="app-workspace-action-right">
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={!isInputValid || isGenerating}
                            className="app-workspace-btn-direct-gen"
                            title="Bypass requirement analysis stage and immediately generate the suite"
                        >
                            <span>Skip to direct generation →</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ─── 5. RECENT WORK SECTION (WITH STATUS CHIPS & DE-DUPLICATION) ─── */}
            {workflowStage === 'requirement' && !isGenerating && (
                <section className="app-workspace-recent-section" aria-labelledby="recent-work-heading">
                    <div className="app-workspace-recent-header">
                        <span id="recent-work-heading" className="app-workspace-recent-label">Recent work</span>
                        {uniqueWorkspaceHistory.length > 0 && (
                            <NavLink to="/app/history" className="app-workspace-recent-link">
                                View all history →
                            </NavLink>
                        )}
                    </div>

                    {uniqueWorkspaceHistory.length === 0 ? (
                        <div className="app-workspace-recent-empty">
                            No previous test suites yet. Formulate your specification above to generate your first suite.
                        </div>
                    ) : (
                        <div className="app-workspace-recent-grid">
                            {uniqueWorkspaceHistory.slice(0, 4).map((item) => {
                                const testCount = item.totalCases || (item.suite ? (
                                    (item.suite.functional?.length || 0) +
                                    (item.suite.negative?.length || 0) +
                                    (item.suite.edge?.length || 0) +
                                    (item.suite.security?.length || 0) +
                                    (item.suite.nonFunctional?.length || 0)
                                ) : (item.summary?.total || 0));

                                const coverage = item.quality?.coverageConfidence
                                    ? `${item.quality.coverageConfidence}% coverage`
                                    : item.summary?.requirementCoverage || (testCount > 0 ? 'Verified lineage' : 'Lineage pending');

                                const reqCode = `REQ-${(item.sessionId || item.id || '001').slice(-3).toUpperCase()}`;
                                const platformLabel = (item.context || item.settings?.type || 'web').toUpperCase();
                                const isDraft = item.status === 'Draft' || !item.suite;
                                const isFailed = item.status === 'Failed';

                                return (
                                    <NavLink
                                        key={item.sessionId || item.id}
                                        to={isDraft ? `/app/workspace/${item.sessionId || item.id}` : `/app/test-suites/${item.sessionId || item.id}`}
                                        className="app-workspace-recent-card"
                                    >
                                        {/* Line 1: Title */}
                                        <div className="app-workspace-recent-card-row1">
                                            <span className="app-workspace-recent-card-title" title={item.title || item.feature || 'Untitled Suite'}>
                                                {item.title || item.feature || 'Untitled Suite'}
                                            </span>
                                        </div>

                                        {/* Line 2: Badges */}
                                        <div className="app-workspace-recent-card-row2">
                                            <span className="app-workspace-recent-tag">{platformLabel}</span>
                                            <span className="app-workspace-recent-tag">{reqCode}</span>
                                            {isFailed ? (
                                                <span className="app-workspace-status-pill is-failed">
                                                    <X size={10} strokeWidth={2.5} /> Failed
                                                </span>
                                            ) : isDraft ? (
                                                <span className="app-workspace-status-pill is-draft">
                                                    Draft
                                                </span>
                                            ) : (
                                                <span className="app-workspace-status-pill is-complete">
                                                    <Check size={10} strokeWidth={2.5} /> Complete
                                                </span>
                                            )}
                                        </div>

                                        {/* Line 3: Fixed 3-column row with small labels above values */}
                                        <div className="app-workspace-recent-stats-row">
                                            <div className="app-workspace-recent-stat-col">
                                                <span className="app-workspace-recent-stat-label">TEST CASES</span>
                                                <span className="app-workspace-recent-stat-val">{testCount}</span>
                                            </div>
                                            <div className="app-workspace-recent-stat-col">
                                                <span className="app-workspace-recent-stat-label">COVERAGE</span>
                                                <span className="app-workspace-recent-stat-val">{coverage}</span>
                                            </div>
                                            <div className="app-workspace-recent-stat-col">
                                                <span className="app-workspace-recent-stat-label">UPDATED</span>
                                                <span className="app-workspace-recent-stat-val">{formatTimeAgo(item.date || item.updatedAt)}</span>
                                            </div>
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
