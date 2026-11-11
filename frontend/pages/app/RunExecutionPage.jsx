import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate, NavLink } from 'react-router-dom';
import {
    ArrowLeft, Play, RefreshCw, CheckCircle2, XCircle,
    AlertTriangle, MinusCircle, Clock, Shield, User, Bot,
    Terminal, FileText, Camera, Upload, Trash2,
    ChevronRight, ChevronDown, Check, AlertCircle, StopCircle, Eye, Download, Copy,
    Wand2, RotateCcw, Edit3, Code, Layers, GitCompare, Search, History,
    Bug, PanelRightClose, PanelRightOpen, ExternalLink, FileCheck, Save
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../../components/loading';
import Modal from '../../components/ui/Modal';
import RunReportView from '../../components/execution/RunReportView';
import RunComparisonView from '../../components/execution/RunComparisonView';
import RerunResultComparisonView from '../../components/execution/RerunResultComparisonView';
import RerunModal from '../../components/execution/RerunModal';
import RerunHistoryDrawer from '../../components/execution/RerunHistoryDrawer';
import ComingSoonModal from '../../components/execution/ComingSoonModal';
import { getExecutionMethod, isExecutionMethodEnabled } from '../../config/executionFeatures';
import '../../styles/app/WorkspaceDesignSystem.css';
import '../../styles/app/RunWorkspace.css';
import '../../styles/app/ArtifactEvidence.css';
import '../../styles/app/RerunWorkspace.css';

const SCRIPT_TEMPLATES = {
    smoke: `async (page, expect) => {
  // 1. Navigate to target environment
  await page.goto('/');
  // 2. Validate essential layout rendering
  await expect(page.locator('body')).toBeVisible();
  const pageTitle = await page.title();
  expect(pageTitle).toBeTruthy();
}`,
    form_submit: `async (page, expect) => {
  // 1. Navigate to form page
  await page.goto('/login');
  // 2. Fill credentials if input exists
  const emailField = page.locator('input[type="email"], input[name="email"]');
  if (await emailField.count() > 0) {
    await emailField.fill('testnexa.tester@example.com');
  }
  // 3. Submit form action
  const submitButton = page.locator('button[type="submit"]');
  if (await submitButton.count() > 0) {
    await submitButton.click();
  }
  await expect(page.locator('body')).toBeVisible();
}`,
    api_status: `async (page, expect) => {
  // 1. Request test endpoint or target view
  const res = await page.goto('/api/health');
  // 2. Verify HTTP response
  if (res) {
    expect(res.status()).toBeLessThan(400);
  }
  await expect(page.locator('body')).toBeVisible();
}`,
    custom: `async (page, expect) => {
  // Write custom Playwright automation logic here
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
}`
};

const StatusBadge = ({ status }) => {
    const raw = typeof status === 'object' && status !== null ? (status.status || status.label || status.name || 'not_run') : (status || 'not_run');
    const s = String(raw).toLowerCase();
    const config = {
        passed: { label: 'Passed', bg: 'rgba(139, 175, 154, 0.15)', color: '#8BAF9A', border: 'rgba(139, 175, 154, 0.3)' },
        failed: { label: 'Failed', bg: 'rgba(224, 108, 117, 0.15)', color: '#E06C75', border: 'rgba(224, 108, 117, 0.3)' },
        timed_out: { label: 'Timed Out', bg: 'rgba(209, 154, 102, 0.15)', color: '#D19A66', border: 'rgba(209, 154, 102, 0.3)' },
        cancelled: { label: 'Cancelled', bg: 'rgba(160, 165, 165, 0.15)', color: '#A0A5A5', border: 'rgba(160, 165, 165, 0.3)' },
        infrastructure_error: { label: 'Infra Error', bg: 'rgba(224, 108, 117, 0.2)', color: '#FF6B6B', border: 'rgba(224, 108, 117, 0.4)' },
        queued: { label: 'Queued', bg: 'rgba(229, 192, 123, 0.15)', color: '#E5C07B', border: 'rgba(229, 192, 123, 0.3)' },
        running: { label: 'Running', bg: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: 'rgba(56, 189, 248, 0.3)' },
        completed: { label: 'Completed', bg: 'rgba(139, 175, 154, 0.15)', color: '#8BAF9A', border: 'rgba(139, 175, 154, 0.3)' },
        partially_completed: { label: 'Partially Completed', bg: 'rgba(229, 192, 123, 0.15)', color: '#E5C07B', border: 'rgba(229, 192, 123, 0.3)' },
        blocked: { label: 'Blocked', bg: 'rgba(229, 192, 123, 0.15)', color: '#E5C07B', border: 'rgba(229, 192, 123, 0.3)' },
        skipped: { label: 'Skipped', bg: 'rgba(198, 120, 221, 0.15)', color: '#C678DD', border: 'rgba(198, 120, 221, 0.3)' },
        in_progress: { label: 'In Progress', bg: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: 'rgba(56, 189, 248, 0.3)' },
        pending: { label: 'Pending', bg: 'rgba(255, 255, 255, 0.05)', color: '#A0A5A5', border: '#292D2D' },
        not_run: { label: 'Not Run', bg: 'rgba(255, 255, 255, 0.05)', color: '#A0A5A5', border: '#292D2D' }
    }[s] || { label: String(raw), bg: '#161819', color: '#F2F3F3', border: '#292D2D' };

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            background: config.bg,
            color: config.color,
            border: `1px solid ${config.border}`
        }}>
            {String(config.label || 'Not Run')}
        </span>
    );
};

const PriorityBadge = ({ priority }) => {
    const raw = typeof priority === 'object' && priority !== null ? (priority.level || priority.name || priority.priority || 'medium') : (priority || 'medium');
    const p = String(raw).toLowerCase();
    const className = ['critical', 'high', 'medium', 'low'].includes(p) ? p : 'medium';
    return (
        <span className={`qa-priority-pill ${className}`}>
            {String(raw || 'Medium')}
        </span>
    );
};

const CaseMethodBadge = ({ c }) => {
    const isAuto = c.executionType === 'automated';
    if (!isAuto) {
        return <span className="qa-method-pill manual">Manual</span>;
    }
    const map = c.caseSnapshot?.automationMapping;
    const isReady = map && (map.mappingStatus === 'configured' || map.mappingStatus === 'enabled') &&
        (Boolean(map.scriptCode) || (map.scriptSource === 'existing' && Boolean(map.scriptRef)));
    if (isReady) {
        return <span className="qa-method-pill playwright">Playwright</span>;
    }
    return <span className="qa-method-pill unmapped">Unmapped</span>;
};

const getEvidenceKind = (artifact) => {
    const type = String(artifact.artifactType || '').toLowerCase();
    const mime = String(artifact.mimeType || '').toLowerCase();
    const name = String(artifact.name || '').toLowerCase();
    if (type.includes('trace') || name.endsWith('.zip') && (artifact.metadata?.framework === 'playwright' || artifact.metadata?.trace)) return 'trace';
    if (type.includes('video') || mime.startsWith('video/') || /\.(webm|mp4|mov)$/.test(name)) return 'video';
    if (type.includes('log') || mime.startsWith('text/') || /\.(log|txt|json)$/.test(name)) return 'log';
    if (type.includes('manual') || type.includes('attachment')) return 'manual';
    if (type.includes('screenshot') || mime.startsWith('image/')) return 'screenshot';
    return 'manual';
};

const formatBytes = (bytes = 0) => {
    const size = Number(bytes);
    if (!size) return 'Size unavailable';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const safeFormatValue = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    if (Array.isArray(val)) {
        if (val.length === 0) return fallback;
        const formatted = val.map(v => {
            if (v === null || v === undefined) return '';
            if (typeof v === 'object') {
                return v.description || v.text || v.step || v.action || v.title || v.name || '';
            }
            return String(v);
        }).filter(Boolean).join(', ');
        return formatted || fallback;
    }
    if (typeof val === 'object') {
        const str = val.description || val.text || val.name || val.title || val.summary || val.code || val.label || '';
        return str || fallback;
    }
    const str = String(val).trim();
    return str || fallback;
};

const formatSuiteTitle = (suite, fallback = 'Test Suite') => {
    if (!suite) return fallback;
    if (typeof suite === 'string') return suite.trim() || fallback;
    if (typeof suite === 'object') {
        return suite.title || suite.name || suite.feature || suite.testSuiteName || fallback;
    }
    return String(suite || fallback);
};

const formatEnvironmentName = (env) => {
    if (!env) return 'Default Staging';
    if (typeof env === 'string') return env.trim() || 'Default Staging';
    if (typeof env === 'object') {
        return env.name || env.environment || env.baseUrl || env.url || 'Default Staging';
    }
    return String(env || 'Default Staging');
};

const formatAssignedTester = (assigned) => {
    if (!assigned) return 'Unassigned';
    if (typeof assigned === 'string') return assigned.trim() || 'Unassigned';
    if (typeof assigned === 'object') {
        return assigned.name || assigned.fullName || assigned.email || assigned.username || 'Unassigned';
    }
    return String(assigned || 'Unassigned');
};

const EvidenceThumbnail = ({ runId, artifact, onSelect }) => {
    const [src, setSrc] = useState('');
    useEffect(() => {
        let current = true;
        let objectUrl;
        executionService.getArtifactFile(runId, artifact.id).then(blob => {
            objectUrl = URL.createObjectURL(blob);
            if (current) setSrc(objectUrl);
            else URL.revokeObjectURL(objectUrl);
        }).catch(() => {});
        return () => { current = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [runId, artifact.id]);
    return src ? (
        <button type="button" className="evidence-thumb" onClick={onSelect} aria-label={`Preview ${artifact.name}`}>
            {getEvidenceKind(artifact) === 'video' ? <video src={src} muted preload="metadata" /> : <img src={src} alt="" loading="lazy" />}
        </button>
    ) : <button type="button" className="evidence-thumb evidence-thumb-pending" onClick={onSelect} aria-label={`Load preview for ${artifact.name}`}><span>Preview</span></button>;
};

const RunExecutionPage = () => {
    const { runId } = useParams();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') || 'cases';
    const initialCaseId = searchParams.get('caseId');

    const [run, setRun] = useState(null);
    const [cases, setCases] = useState([]);
    const [activeCaseId, setActiveCaseId] = useState(initialCaseId);
    const [activeCaseDetails, setActiveCaseDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [methodFilter, setMethodFilter] = useState('all');
    const [collapsedCategories, setCollapsedCategories] = useState({});
    const [caseDrafts, setCaseDrafts] = useState({});
    const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

    // Execution input form state
    const [formStatus, setFormStatus] = useState('passed');
    const [actualResult, setActualResult] = useState('');
    const [notes, setNotes] = useState('');
    const [screenshotData, setScreenshotData] = useState(null);
    const [screenshotName, setScreenshotName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState(null);

    // Step-level interactive verification state
    const [stepOutcomes, setStepOutcomes] = useState({});

    // API Testing execution state
    const [executionStationMode, setExecutionStationMode] = useState('manual'); // 'manual' | 'api'
    const [apiConfig, setApiConfig] = useState({
        method: 'GET',
        url: '',
        headers: '{\n  "Accept": "application/json"\n}',
        body: '',
        expectedStatus: 200,
        jsonPath: '',
        expectedValue: ''
    });
    const [isExecutingApi, setIsExecutingApi] = useState(false);
    const [apiResponse, setApiResponse] = useState(null);

    // Multiple Execution History across runs state
    const [historicalAttempts, setHistoricalAttempts] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

    const navigate = useNavigate();
    // Active Automation Job Polling state
    const [activeJob, setActiveJob] = useState(null);
    const [isTriggeringAuto, setIsTriggeringAuto] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab); // 'cases' | 'report' | 'compare' | 'artifacts'
    const [isRerunModalOpen, setIsRerunModalOpen] = useState(false);
    const [isRerunHistoryOpen, setIsRerunHistoryOpen] = useState(false);
    const [artifacts, setArtifacts] = useState([]);
    const [isArtifactsLoading, setIsArtifactsLoading] = useState(true);
    const [artifactsError, setArtifactsError] = useState('');
    const [evidenceSuiteName, setEvidenceSuiteName] = useState('');
    const [previewArtifact, setPreviewArtifact] = useState(null);
    const [previewBlobUrl, setPreviewBlobUrl] = useState('');
    const [previewText, setPreviewText] = useState('');
    const [previewError, setPreviewError] = useState('');
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [evidenceKind, setEvidenceKind] = useState('all');
    const [evidenceSearch, setEvidenceSearch] = useState('');
    const [evidenceCase, setEvidenceCase] = useState('all');
    const [evidenceStatus, setEvidenceStatus] = useState('all');
    const [evidenceFrom, setEvidenceFrom] = useState('');
    const [evidenceTo, setEvidenceTo] = useState('');
    const [evidenceMime, setEvidenceMime] = useState('all');
    const [copyMessage, setCopyMessage] = useState('');
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    // Playwright Mapping & Configuration state
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [isSavingMapping, setIsSavingMapping] = useState(false);
    const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
    const [isRerunningFailed, setIsRerunningFailed] = useState(false);
    const [configMethod, setConfigMethod] = useState('existing'); // 'existing' | 'custom'
    const [inventorySuites, setInventorySuites] = useState([]);
    const [selectedSuiteFile, setSelectedSuiteFile] = useState('');
    const [selectedTestId, setSelectedTestId] = useState('');
    const [validationResult, setValidationResult] = useState(null);
    const [dryRunResult, setDryRunResult] = useState(null);
    const [isValidatingScript, setIsValidatingScript] = useState(false);
    const [isTestingScript, setIsTestingScript] = useState(false);
    const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
    const [templateWarnings, setTemplateWarnings] = useState([]);
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [mappingForm, setMappingForm] = useState({
        framework: 'playwright',
        automationTestId: '',
        scriptSource: 'existing',
        scriptRef: '',
        scriptCode: '',
        scriptVersion: '1.0.0',
        targetEnvironment: '',
        executionTimeout: 15000,
        mappingStatus: 'draft',
        preset: 'smoke'
    });
    const [showScriptPreview, setShowScriptPreview] = useState(false);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [comingSoonMethod, setComingSoonMethod] = useState(null);

    // 3-Panel Manual Workspace 2.0 State
    const [isContextPanelCollapsed, setIsContextPanelCollapsed] = useState(false);
    const [contextActiveTab, setContextActiveTab] = useState('metadata'); // 'metadata' | 'requirements' | 'history' | 'defects'
    const [runDefects, setRunDefects] = useState([]);
    const [caseDefects, setCaseDefects] = useState([]);
    const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
    const [isSubmittingDefect, setIsSubmittingDefect] = useState(false);
    const [defectForm, setDefectForm] = useState({
        title: '',
        description: '',
        severity: 'high',
        priority: 'P1',
        stepIndex: null,
        expectedResult: '',
        actualResult: ''
    });

    // Completion Confirmation Breakdown Modal
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
    const [completionBreakdown, setCompletionBreakdown] = useState(null);

    // Autosave & Recovery Engine
    const [autosaveStatus, setAutosaveStatus] = useState('saved'); // 'idle' | 'saving' | 'saved' | 'unsaved' | 'error'
    const [lastSavedTime, setLastSavedTime] = useState('');
    const autosaveTimerRef = useRef(null);

    // Filtered Test Cases list based on search, statusFilter, and methodFilter
    const filteredCases = useMemo(() => {
        return cases.filter(c => {
            const title = c.caseSnapshot?.title || '';
            const tcId = c.testCaseId || '';
            const matchesSearch = title.toLowerCase().includes(search.toLowerCase()) ||
                tcId.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
            const matchesMethod = methodFilter === 'all' || c.executionType === methodFilter;
            return matchesSearch && matchesStatus && matchesMethod;
        });
    }, [cases, search, statusFilter, methodFilter]);

    const loadRunDefects = useCallback(async () => {
        if (!runId) return;
        try {
            const res = await executionService.getRunDefects(runId);
            if (res.success && res.data) {
                setRunDefects(res.data);
            }
        } catch (err) {
            console.warn('Failed to fetch run defects:', err.message);
        }
    }, [runId]);

    const loadCaseDefects = useCallback(async (cId) => {
        if (!runId || !cId) return;
        try {
            const res = await executionService.getCaseDefects(runId, cId);
            if (res.success && res.data) {
                setCaseDefects(res.data);
            }
        } catch (err) {
            console.warn('Failed to fetch case defects:', err.message);
        }
    }, [runId]);

    const triggerDebouncedAutosave = useCallback((caseId, draftPayload) => {
        if (!caseId || !runId) return;
        setAutosaveStatus('unsaved');
        try {
            localStorage.setItem(`testnexa_exec_draft_${runId}_${caseId}`, JSON.stringify(draftPayload));
        } catch {}

        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
        }

        autosaveTimerRef.current = setTimeout(async () => {
            setAutosaveStatus('saving');
            try {
                await executionService.saveCaseDraft(runId, caseId, draftPayload);
                setAutosaveStatus('saved');
                setLastSavedTime(new Date().toLocaleTimeString());
            } catch (err) {
                console.warn('Backend draft autosave notice:', err.message);
                setAutosaveStatus('saved'); // Persisted locally in localStorage
                setLastSavedTime(new Date().toLocaleTimeString());
            }
        }, 800);
    }, [runId]);

    // Fetch Run details & cases
    const loadRunData = useCallback(async () => {
        if (!runId) return;
        try {
            const res = await executionService.getRun(runId);
            if (res.success && res.data) {
                setRun(res.data);
                const caseList = res.data.cases || [];
                setCases(caseList);

                // Set initial active case if none selected
                if (!activeCaseId && caseList.length > 0) {
                    setActiveCaseId(caseList[0].id);
                }
            }

            // Also check latest automation job
            const jobRes = await executionService.getRunJob(runId).catch(() => null);
            if (jobRes?.success && jobRes.data) {
                setActiveJob(jobRes.data);
            }

            // Artifacts are loaded only through the authenticated, workspace-checked execution service.
            setIsArtifactsLoading(true);
            setArtifactsError('');
            try {
                const artRes = await executionService.listRunArtifacts(runId);
                if (artRes?.success) setArtifacts(artRes.data || []);
                else setArtifactsError(artRes?.message || 'Evidence could not be loaded.');
            } catch (artifactError) {
                setArtifactsError(artifactError.message || 'Evidence could not be loaded.');
            } finally {
                setIsArtifactsLoading(false);
            }

            // Also load defects for this run
            loadRunDefects();
        } catch (err) {
            console.error('Failed to load run details:', err);
        } finally {
            setIsLoading(false);
        }
    }, [runId, activeCaseId]);

    useEffect(() => {
        loadRunData();
    }, [loadRunData]);

    useEffect(() => {
        if (activeTab !== 'artifacts' || !runId) return undefined;
        let current = true;
        executionService.getRunReport(runId).then(result => {
            if (current && result?.success) setEvidenceSuiteName(result.data?.identifiers?.suiteName || 'Independent Test Suite');
        }).catch(() => { if (current) setEvidenceSuiteName(''); });
        return () => { current = false; };
    }, [activeTab, runId]);

    useEffect(() => {
        if (!previewArtifact) return undefined;
        let isCurrent = true;
        let objectUrl;
        setIsPreviewLoading(true);
        setPreviewError('');
        setPreviewText('');
        setPreviewBlobUrl('');
        executionService.getArtifactFile(runId, previewArtifact.id).then(async blob => {
            const kind = getEvidenceKind(previewArtifact);
            if (kind === 'trace') return;
            objectUrl = URL.createObjectURL(blob);
            let text = '';
            if (kind === 'log') text = await blob.text();
            if (isCurrent) {
                setPreviewBlobUrl(objectUrl);
                setPreviewText(text);
            } else URL.revokeObjectURL(objectUrl);
        }).catch(error => {
            if (isCurrent) setPreviewError(error.status === 404 ? 'This artifact is missing or has expired.' : error.message || 'This artifact could not be loaded.');
        }).finally(() => { if (isCurrent) setIsPreviewLoading(false); });
        return () => { isCurrent = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [runId, previewArtifact]);

    const handleSelectCase = (newCaseId) => {
        if (!newCaseId || newCaseId === activeCaseId) {
            setIsMobileDetailOpen(true);
            return;
        }
        if (activeCaseId) {
            setCaseDrafts(prev => ({
                ...prev,
                [activeCaseId]: {
                    formStatus,
                    actualResult,
                    notes,
                    screenshotData,
                    screenshotName,
                    stepOutcomes,
                    executionStationMode,
                    apiConfig
                }
            }));
        }
        setActiveCaseId(newCaseId);
        setIsMobileDetailOpen(true);
    };

    // Helper: derive overall execution status from individual step evaluations
    const deriveOverallStatusFromSteps = (stepsMap, stepCount) => {
        if (!stepCount || stepCount === 0) return 'passed';
        const values = Object.values(stepsMap);
        if (values.length < stepCount) return 'in_progress';
        const statuses = values.map(v => v.status);
        if (statuses.some(s => s === 'pending')) return 'in_progress';
        if (statuses.some(s => s === 'failed')) return 'failed';
        if (statuses.some(s => s === 'blocked')) return 'blocked';
        if (statuses.every(s => s === 'skipped')) return 'skipped';
        return 'passed';
    };

    const handleStepStatusChange = (stepIdx, newStatus) => {
        setStepOutcomes(prev => {
            const next = {
                ...prev,
                [stepIdx]: {
                    ...(prev[stepIdx] || {}),
                    status: newStatus
                }
            };
            const steps = activeCaseDetails?.snapshot?.steps || activeCase?.snapshot?.steps || [];
            const derived = deriveOverallStatusFromSteps(next, steps.length);
            if (derived !== 'in_progress') {
                setFormStatus(derived);
            }
            triggerDebouncedAutosave(activeCaseId, {
                formStatus: derived !== 'in_progress' ? derived : formStatus,
                actualResult,
                notes,
                screenshotData,
                screenshotName,
                stepOutcomes: next,
                executionStationMode,
                apiConfig
            });
            return next;
        });
    };

    const handleStepActualChange = (stepIdx, text) => {
        setStepOutcomes(prev => {
            const next = {
                ...prev,
                [stepIdx]: {
                    ...(prev[stepIdx] || {}),
                    actual: text
                }
            };
            triggerDebouncedAutosave(activeCaseId, {
                formStatus,
                actualResult,
                notes,
                screenshotData,
                screenshotName,
                stepOutcomes: next,
                executionStationMode,
                apiConfig
            });
            return next;
        });
    };

    const handleMarkAllStepsPassed = () => {
        const steps = activeCaseDetails?.snapshot?.steps || activeCase?.snapshot?.steps || [];
        const next = {};
        steps.forEach((_, idx) => {
            next[idx] = {
                ...(stepOutcomes[idx] || {}),
                status: 'passed'
            };
        });
        setStepOutcomes(next);
        setFormStatus('passed');
        triggerDebouncedAutosave(activeCaseId, {
            formStatus: 'passed',
            actualResult: actualResult || 'All test steps verified successfully.',
            notes,
            screenshotData,
            screenshotName,
            stepOutcomes: next,
            executionStationMode,
            apiConfig
        });
    };

    const handleResetAllSteps = () => {
        const steps = activeCaseDetails?.snapshot?.steps || activeCase?.snapshot?.steps || [];
        const next = {};
        steps.forEach((_, idx) => {
            next[idx] = {
                status: 'pending',
                actual: '',
                notes: ''
            };
        });
        setStepOutcomes(next);
        setFormStatus('in_progress');
        triggerDebouncedAutosave(activeCaseId, {
            formStatus: 'in_progress',
            actualResult: '',
            notes,
            screenshotData: null,
            screenshotName: '',
            stepOutcomes: next,
            executionStationMode,
            apiConfig
        });
    };

    // Load full historical attempts across all runs for active test case
    const loadCaseHistory = async (targetCaseId) => {
        if (!targetCaseId) return;
        setIsHistoryLoading(true);
        try {
            const res = await executionService.getTestCaseHistory(targetCaseId);
            if (res.success && res.data) {
                setHistoricalAttempts(res.data);
            }
        } catch (err) {
            console.warn('Historical executions fetch notice:', err.message);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    // Fetch active case details and attempt history when activeCaseId changes
    useEffect(() => {
        if (!runId || !activeCaseId) return;

        let isCurrent = true;
        const fetchDetails = async () => {
            try {
                const res = await executionService.getRunCase(runId, activeCaseId);
                if (isCurrent && res.success && res.data) {
                    const caseData = res.data;
                    setActiveCaseDetails(caseData);

                    // Check draft: local memory -> localStorage -> backend server draft
                    let draft = caseDrafts[activeCaseId];
                    if (!draft) {
                        try {
                            const cached = localStorage.getItem(`testnexa_exec_draft_${runId}_${activeCaseId}`);
                            if (cached) draft = JSON.parse(cached);
                        } catch {}
                    }
                    if (!draft) {
                        try {
                            const sDraft = await executionService.getCaseDraft(runId, activeCaseId);
                            if (sDraft?.success && sDraft.data) draft = sDraft.data;
                        } catch {}
                    }

                    if (draft) {
                        setFormStatus(draft.formStatus || (caseData.status !== 'not_run' ? caseData.status : 'passed'));
                        setActualResult(draft.actualResult ?? caseData.actualResult ?? '');
                        setNotes(draft.notes ?? caseData.notes ?? '');
                        setScreenshotData(draft.screenshotData || null);
                        setScreenshotName(draft.screenshotName || '');
                        setStepOutcomes(draft.stepOutcomes || {});
                        setExecutionStationMode(draft.executionStationMode || (caseData.executionType === 'api' ? 'api' : 'manual'));
                        if (draft.apiConfig) setApiConfig(draft.apiConfig);
                        setAutosaveStatus('saved');
                        setLastSavedTime(draft.savedAt || new Date().toLocaleTimeString());
                    } else {
                        setActualResult(caseData.actualResult || '');
                        setNotes(caseData.notes || '');
                        setFormStatus(caseData.status !== 'not_run' ? caseData.status : 'passed');
                        setScreenshotData(null);
                        setScreenshotName('');
                        setExecutionStationMode(caseData.executionType === 'api' || run?.executionType === 'api' ? 'api' : 'manual');

                        // Reconstruct stepOutcomes from past step executions or default to pending
                        const steps = caseData.steps || caseData.snapshot?.steps || [];
                        const initSteps = {};
                        steps.forEach((st, idx) => {
                            initSteps[idx] = {
                                status: st.status || (caseData.status === 'passed' ? 'passed' : 'pending'),
                                actual: st.actualResult || st.actual || '',
                                notes: st.notes || ''
                            };
                        });
                        setStepOutcomes(initSteps);

                        if (caseData.apiConfig || caseData.snapshot?.apiConfig) {
                            const cfg = caseData.apiConfig || caseData.snapshot?.apiConfig;
                            setApiConfig({
                                method: cfg.method || 'GET',
                                url: cfg.url || run?.targetEnvironment || '',
                                headers: cfg.headers ? (typeof cfg.headers === 'string' ? cfg.headers : JSON.stringify(cfg.headers, null, 2)) : '{\n  "Accept": "application/json"\n}',
                                body: cfg.body ? (typeof cfg.body === 'string' ? cfg.body : JSON.stringify(cfg.body, null, 2)) : '',
                                expectedStatus: cfg.expectedStatus || 200,
                                jsonPath: cfg.jsonPath || '',
                                expectedValue: cfg.expectedValue || ''
                            });
                        } else if (run?.targetEnvironment) {
                            setApiConfig(prev => ({ ...prev, url: run.targetEnvironment }));
                        }
                    }
                    setSaveMessage(null);
                    setApiResponse(null);

                    // Fetch multi-run historical executions & case defects
                    const tcId = caseData.testCaseId || caseData.id;
                    if (tcId) {
                        loadCaseHistory(tcId);
                    }
                    loadCaseDefects(activeCaseId);
                }
            } catch (err) {
                console.error('Failed to fetch case details:', err);
            }
        };

        fetchDetails();
        return () => { isCurrent = false; };
    }, [runId, activeCaseId]);

    // Poll active automation job if running or queued
    useEffect(() => {
        if (!activeJob || (activeJob.status !== 'queued' && activeJob.status !== 'running')) return;

        const interval = setInterval(async () => {
            try {
                const jobRes = await executionService.getRunJob(runId);
                if (jobRes.success && jobRes.data) {
                    setActiveJob(jobRes.data);
                    if (jobRes.data.status === 'completed' || jobRes.data.status === 'failed') {
                        // Refresh full run data on completion
                        loadRunData();
                    }
                }
            } catch (err) {
                console.error('Error polling automation job:', err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [activeJob, runId, loadRunData]);

    // Screenshot file upload handler
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert('File exceeds 10MB limit.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setScreenshotData(reader.result);
            setScreenshotName(file.name);
            triggerDebouncedAutosave(activeCaseId, {
                formStatus,
                actualResult,
                notes,
                screenshotData: reader.result,
                screenshotName: file.name,
                stepOutcomes,
                executionStationMode,
                apiConfig
            });
        };
        reader.readAsDataURL(file);
    };

    // Save manual execution attempt as a draft
    const handleSaveDraft = async () => {
        if (!activeCaseId) return;
        const draftPayload = {
            formStatus: 'in_progress',
            actualResult,
            notes,
            screenshotData,
            screenshotName,
            stepOutcomes,
            executionStationMode,
            apiConfig
        };
        setCaseDrafts(prev => ({
            ...prev,
            [activeCaseId]: draftPayload
        }));
        try {
            localStorage.setItem(`testnexa_exec_draft_${runId}_${activeCaseId}`, JSON.stringify(draftPayload));
            await executionService.saveCaseDraft(runId, activeCaseId, draftPayload);
        } catch {}
        setAutosaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString());
        setSaveMessage('Draft progress saved successfully.');
        setTimeout(() => setSaveMessage(null), 3000);
    };

    // Open Completion Confirmation Breakdown modal
    const handleOpenCompletionModal = () => {
        if (!activeCaseId) return;
        const steps = activeCaseDetails?.snapshot?.steps || activeCase?.snapshot?.steps || activeCase?.caseSnapshot?.steps || [];
        const total = steps.length;
        let pCount = 0;
        let fCount = 0;
        let bCount = 0;
        let sCount = 0;
        let pendingCount = 0;

        steps.forEach((_, idx) => {
            const st = stepOutcomes[idx]?.status || 'pending';
            if (st === 'passed') pCount++;
            else if (st === 'failed') fCount++;
            else if (st === 'blocked') bCount++;
            else if (st === 'skipped') sCount++;
            else pendingCount++;
        });

        // Determine derived status
        let derivedStatus = 'passed';
        if (fCount > 0) derivedStatus = 'failed';
        else if (bCount > 0) derivedStatus = 'blocked';
        else if (total > 0 && sCount === total) derivedStatus = 'skipped';
        else if (pendingCount > 0) derivedStatus = 'in_progress';
        else derivedStatus = 'passed';

        const canPass = (total === 0 && actualResult.trim().length > 0) || (total > 0 && pendingCount === 0 && fCount === 0 && bCount === 0);

        setCompletionBreakdown({
            total,
            passed: pCount,
            failed: fCount,
            blocked: bCount,
            skipped: sCount,
            pending: pendingCount,
            derivedStatus: (formStatus && formStatus !== 'in_progress') ? formStatus : derivedStatus,
            canPass
        });
        setIsCompletionModalOpen(true);
    };

    const handleConfirmCompletion = async (overrideStatus = null) => {
        setIsCompletionModalOpen(false);
        const targetStatus = overrideStatus || completionBreakdown?.derivedStatus || formStatus || 'passed';
        await handleSaveExecution(targetStatus);
    };

    // Save & Complete manual execution attempt
    const handleSaveExecution = async (overrideStatus = null) => {
        if (!activeCaseId) return;

        const steps = activeCaseDetails?.snapshot?.steps || activeCase?.snapshot?.steps || activeCase?.caseSnapshot?.steps || [];
        const stepsCount = steps.length;
        const finalStatus = overrideStatus || formStatus;

        // Completion validation: If tester selected Passed, all steps must be evaluated
        if (finalStatus === 'passed' && stepsCount > 0) {
            const evaluatedCount = Object.values(stepOutcomes).filter(s => s && s.status && s.status !== 'pending').length;
            if (evaluatedCount < stepsCount) {
                const confirmSaveDraft = window.confirm(
                    `Incomplete Step Verification: ${evaluatedCount} of ${stepsCount} steps evaluated.\n\nA test case cannot be completed as Passed while steps remain unverified. Would you like to mark all remaining steps Passed and complete, or Cancel to review?`
                );
                if (!confirmSaveDraft) {
                    return;
                }
                handleMarkAllStepsPassed();
            }
        }

        setIsSaving(true);
        setSaveMessage(null);

        try {
            const formattedSteps = steps.map((st, idx) => ({
                stepNumber: idx + 1,
                action: typeof st === 'object' ? (st.action || st.step || st.description || st.text) : String(st),
                expected: typeof st === 'object' ? st.expected : '',
                actual: stepOutcomes[idx]?.actual || '',
                status: stepOutcomes[idx]?.status || (finalStatus === 'passed' ? 'passed' : 'pending'),
                notes: stepOutcomes[idx]?.notes || ''
            }));

            const payload = {
                status: finalStatus,
                actualResult: actualResult.trim() || (finalStatus === 'passed' ? 'All test steps verified successfully.' : 'Verification complete.'),
                notes: notes.trim(),
                steps: formattedSteps,
                durationMs: 3500,
                executorType: 'manual',
                artifact: screenshotData ? {
                    name: screenshotName || `evidence_${activeCaseId}.png`,
                    data: screenshotData,
                    mimeType: 'image/png'
                } : null
            };

            const res = await executionService.recordExecution(runId, activeCaseId, payload);
            if (res.success) {
                setSaveMessage('Execution attempt recorded and committed to audit history.');
                try {
                    localStorage.removeItem(`testnexa_exec_draft_${runId}_${activeCaseId}`);
                } catch {}
                setAutosaveStatus('saved');
                setLastSavedTime(new Date().toLocaleTimeString());
                setCaseDrafts(prev => {
                    const next = { ...prev };
                    delete next[activeCaseId];
                    return next;
                });
                // Refresh active case details and run summary
                const updatedCaseRes = await executionService.getRunCase(runId, activeCaseId);
                if (updatedCaseRes.success) {
                    setActiveCaseDetails(updatedCaseRes.data);
                }
                loadRunData();
                setScreenshotData(null);
                setScreenshotName('');

                // Refresh history & defects
                const tcId = activeCase?.testCaseId || activeCaseId;
                if (tcId) loadCaseHistory(tcId);
                loadCaseDefects(activeCaseId);
            }
        } catch (err) {
            alert(`Execution recording rejected: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Defect Modal Handlers
    const handleOpenDefectModal = (stepIdx = null) => {
        const steps = activeCaseDetails?.snapshot?.steps || activeCase?.snapshot?.steps || activeCase?.caseSnapshot?.steps || [];
        const step = stepIdx !== null && steps[stepIdx] ? steps[stepIdx] : null;
        const stepText = step ? (typeof step === 'object' ? (step.action || step.step || step.description) : String(step)) : '';
        const stepExpected = step && typeof step === 'object' ? step.expected : (snapshot.expectedResult || '');
        const observed = stepIdx !== null ? (stepOutcomes[stepIdx]?.actual || actualResult) : actualResult;

        setDefectForm({
            title: stepIdx !== null
                ? `[Defect] ${snapshot.title || 'Step Failure'} - Step ${stepIdx + 1} Failed`
                : `[Defect] ${snapshot.title || 'Test Execution Failure'}`,
            description: `Test Case: ${activeCase?.testCaseId || ''} - ${snapshot.title || ''}\n` +
                (stepIdx !== null ? `Step ${stepIdx + 1}: ${stepText}\n` : '') +
                `Expected Result: ${stepExpected}\n` +
                `Observed Result: ${observed || 'Application did not behave as expected.'}`,
            severity: 'high',
            priority: 'P1',
            stepIndex: stepIdx,
            expectedResult: stepExpected,
            actualResult: observed
        });
        setIsDefectModalOpen(true);
    };

    const handleCreateDefect = async (e) => {
        if (e) e.preventDefault();
        if (!activeCaseId || !defectForm.title.trim()) return;

        setIsSubmittingDefect(true);
        try {
            const payload = {
                title: defectForm.title.trim(),
                description: defectForm.description.trim(),
                severity: defectForm.severity,
                priority: defectForm.priority,
                stepNumber: defectForm.stepIndex !== null ? defectForm.stepIndex + 1 : undefined,
                expectedResult: defectForm.expectedResult,
                actualResult: defectForm.actualResult,
                evidence: screenshotData ? [{
                    name: screenshotName || `defect_${Date.now()}.png`,
                    data: screenshotData,
                    mimeType: 'image/png'
                }] : []
            };

            const res = await executionService.createDefect(runId, activeCaseId, payload);
            if (res.success) {
                setSaveMessage('Defect logged and linked to this execution.');
                setIsDefectModalOpen(false);
                loadRunDefects();
                loadCaseDefects(activeCaseId);
                setContextActiveTab('defects');
                if (isContextPanelCollapsed) setIsContextPanelCollapsed(false);
            }
        } catch (err) {
            alert(`Failed to log defect: ${err.message}`);
        } finally {
            setIsSubmittingDefect(false);
        }
    };

    // Navigation between cases (Alt+P, Alt+N)
    const handlePrevCase = useCallback(() => {
        if (!filteredCases || filteredCases.length <= 1) return;
        const currentIdx = filteredCases.findIndex(c => c.id === activeCaseId);
        if (currentIdx > 0) {
            handleSelectCase(filteredCases[currentIdx - 1].id);
        } else {
            handleSelectCase(filteredCases[filteredCases.length - 1].id);
        }
    }, [filteredCases, activeCaseId]);

    const handleNextCase = useCallback(() => {
        if (!filteredCases || filteredCases.length <= 1) return;
        const currentIdx = filteredCases.findIndex(c => c.id === activeCaseId);
        if (currentIdx >= 0 && currentIdx < filteredCases.length - 1) {
            handleSelectCase(filteredCases[currentIdx + 1].id);
        } else {
            handleSelectCase(filteredCases[0].id);
        }
    }, [filteredCases, activeCaseId]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault();
                handleNextCase();
            } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                handlePrevCase();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNextCase, handlePrevCase]);

    // Execute real HTTP API Test Case
    const handleExecuteApi = async () => {
        if (!activeCaseId) return;

        let parsedHeaders = {};
        if (apiConfig.headers && apiConfig.headers.trim()) {
            try {
                parsedHeaders = JSON.parse(apiConfig.headers);
            } catch {
                alert('Invalid JSON in Request Headers. Please provide a valid JSON object.');
                return;
            }
        }

        let parsedBody = null;
        if (apiConfig.body && apiConfig.body.trim()) {
            try {
                parsedBody = JSON.parse(apiConfig.body);
            } catch {
                parsedBody = apiConfig.body.trim();
            }
        }

        const targetUrl = apiConfig.url?.trim() || run?.targetEnvironment || 'https://httpbin.org/get';

        setIsExecutingApi(true);
        setApiResponse(null);
        setSaveMessage(null);

        try {
            const assertions = [
                { type: 'statusCode', expected: Number(apiConfig.expectedStatus) || 200 }
            ];
            if (apiConfig.jsonPath?.trim() && apiConfig.expectedValue?.trim()) {
                assertions.push({
                    type: 'bodyPath',
                    property: apiConfig.jsonPath.trim(),
                    expected: apiConfig.expectedValue.trim()
                });
            }

            const payload = {
                url: targetUrl,
                method: apiConfig.method || 'GET',
                headers: parsedHeaders,
                body: parsedBody,
                expectedStatus: Number(apiConfig.expectedStatus) || 200,
                assertions
            };

            const res = await executionService.executeApiCase(runId, activeCaseId, payload);
            if (res.success && res.data) {
                setApiResponse(res.data.executionResult);
                const isPassed = res.data.status === 'passed';
                setSaveMessage(`API Execution completed: ${res.data.status.toUpperCase()} (${res.data.executionResult?.durationMs || 0}ms)`);

                // Refresh active case details and run summary
                const updatedCaseRes = await executionService.getRunCase(runId, activeCaseId);
                if (updatedCaseRes.success) {
                    setActiveCaseDetails(updatedCaseRes.data);
                }
                loadRunData();

                // Refresh history
                const tcId = activeCase?.testCaseId || activeCaseId;
                if (tcId) loadCaseHistory(tcId);
            }
        } catch (err) {
            alert(`API Execution failed: ${err.message}`);
        } finally {
            setIsExecutingApi(false);
        }
    };

    // Trigger Playwright Automated Execution
    const handleTriggerAutomated = async () => {
        if (!isExecutionMethodEnabled('playwright')) {
            setComingSoonMethod(getExecutionMethod('playwright'));
            return;
        }

        setIsTriggeringAuto(true);
        try {
            const res = await executionService.triggerAutomatedRun(runId, {
                adapter: 'playwright',
                targetEnvironment: run?.targetEnvironment
            });
            if (res.success && res.data) {
                setActiveJob(res.data);
            }
        } catch (err) {
            alert(`Failed to trigger automated execution: ${err.message}`);
        } finally {
            setIsTriggeringAuto(false);
        }
    };

    // Safe Run Cancellation
    const handleCancelRun = async () => {
        try {
            const res = await executionService.cancelRun(runId);
            if (res.success) {
                setIsCancelModalOpen(false);
                loadRunData();
            }
        } catch (err) {
            alert(`Failed to cancel run: ${err.message}`);
        }
    };

    const downloadEvidence = async (artifact) => {
        try {
            const blob = await executionService.getArtifactFile(runId, artifact.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = artifact.name || 'test-evidence';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            setPreviewError(error.status === 404 ? 'This artifact is missing or has expired.' : error.message || 'Download failed.');
            setPreviewArtifact(artifact);
        }
    };

    const copyEvidenceReference = async (artifact) => {
        const reference = `run:${runId}/artifact:${artifact.id}`;
        try {
            await navigator.clipboard.writeText(reference);
            setCopyMessage('Artifact reference copied');
            window.setTimeout(() => setCopyMessage(''), 1800);
        } catch {
            setCopyMessage('Clipboard access is unavailable in this browser');
            window.setTimeout(() => setCopyMessage(''), 2400);
        }
    };

    const copyLogContent = async () => {
        try {
            await navigator.clipboard.writeText(previewText);
            setCopyMessage('Log contents copied');
            window.setTimeout(() => setCopyMessage(''), 1800);
        } catch {
            setCopyMessage('Clipboard access is unavailable in this browser');
            window.setTimeout(() => setCopyMessage(''), 2400);
        }
    };

    const evidenceById = useMemo(() => new Map(cases.map(item => [item.id, item])), [cases]);
    const filteredArtifacts = useMemo(() => artifacts.filter(artifact => {
        const kind = getEvidenceKind(artifact);
        const linkedCase = evidenceById.get(artifact.runCaseId);
        const query = evidenceSearch.trim().toLowerCase();
        const created = artifact.createdAt ? new Date(artifact.createdAt) : null;
        const mime = String(artifact.mimeType || '').toLowerCase();
        const mimeGroup = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('text/') || mime.includes('json') ? 'text' : mime ? 'application' : 'other';
        return (evidenceKind === 'all' || kind === evidenceKind) &&
            (!query || `${artifact.name} ${linkedCase?.testCaseId || ''} ${linkedCase?.caseSnapshot?.title || ''}`.toLowerCase().includes(query)) &&
            (evidenceCase === 'all' || artifact.runCaseId === evidenceCase) &&
            (evidenceStatus === 'all' || linkedCase?.status === evidenceStatus) &&
            (!evidenceFrom || created && created >= new Date(`${evidenceFrom}T00:00:00`)) &&
            (!evidenceTo || created && created <= new Date(`${evidenceTo}T23:59:59.999`)) &&
            (evidenceMime === 'all' || mimeGroup === evidenceMime);
    }), [artifacts, evidenceById, evidenceKind, evidenceSearch, evidenceCase, evidenceStatus, evidenceFrom, evidenceTo, evidenceMime]);

    // Group filtered cases by Category (Functional, Negative, Edge, API, etc.)
    const groupedCases = useMemo(() => {
        const groups = {};
        for (const c of filteredCases) {
            const raw = c.caseSnapshot?.type || c.caseSnapshot?.category || c.type || 'Functional';
            const cat = raw.charAt(0).toUpperCase() + raw.slice(1);
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(c);
        }
        return groups;
    }, [filteredCases]);

    const toggleCategoryCollapse = (cat) => {
        setCollapsedCategories(prev => ({
            ...prev,
            [cat]: !prev[cat]
        }));
    };

    const { readyCount, invalidCount, unmappedCount } = useMemo(() => {
        let ready = 0;
        let invalid = 0;
        let unmapped = 0;

        for (const c of cases) {
            const map = c.caseSnapshot?.automationMapping;
            const isConfigured = map && (map.mappingStatus === 'configured' || map.mappingStatus === 'enabled');
            if (!isConfigured) {
                unmapped++;
            } else {
                const hasCode = Boolean(map.scriptCode && map.scriptCode.trim());
                const hasRef = Boolean(map.scriptSource === 'existing' && map.scriptRef && map.scriptRef.trim());
                const hasId = Boolean(map.automationTestId && map.automationTestId.trim());

                if ((hasCode || hasRef) && hasId) {
                    ready++;
                } else {
                    invalid++;
                }
            }
        }

        return { readyCount: ready, invalidCount: invalid, unmappedCount: unmapped };
    }, [cases]);

    const automationReadyCount = readyCount;
    const unconfiguredCount = unmappedCount;

    if (isLoading) {
        return <DataLoadingState message="Loading test execution workspace..." />;
    }

    if (!run) {
        return (
            <div className="ws-page-container">
                <div className="ws-empty-state">
                    <h2>Test Run Not Found</h2>
                    <NavLink to="/app/runs" className="ws-btn-primary" style={{ marginTop: '1rem' }}>
                        Return to Test Runs
                    </NavLink>
                </div>
            </div>
        );
    }

    const sum = run.summary || {};
    const activeCase = activeCaseDetails || cases.find(c => c.id === activeCaseId);
    const snapshot = activeCase?.caseSnapshot || {};
    const hasAutomation = Boolean(snapshot.automationMapping);
    const attempts = activeCaseDetails?.executions || [];
    const targetAppUrl = typeof run?.targetEnvironment === 'string'
        ? (run.targetEnvironment.trim() || null)
        : (run?.targetEnvironment?.baseUrl || run?.targetEnvironment?.url || activeCase?.targetUrl || null);

    // Open Automation Mapping Modal for a specific case
    const handleOpenMappingModal = async (caseItem) => {
        const c = caseItem || activeCase;
        if (!c) return;
        const snap = c.caseSnapshot || {};
        const existing = snap.automationMapping || {};

        let suites = inventorySuites;
        if (suites.length === 0) {
            try {
                const invRes = await executionService.getAutomationInventory();
                if (invRes?.success && Array.isArray(invRes.data)) {
                    suites = invRes.data;
                    setInventorySuites(suites);
                }
            } catch (invErr) {
                console.error('Failed to load automation inventory:', invErr);
            }
        }

        const source = existing.scriptSource || (existing.scriptRef && !existing.scriptCode ? 'existing' : 'custom');
        setConfigMethod(source);

        let initialFile = '';
        let initialTestId = '';
        if (existing.scriptRef) {
            const parts = existing.scriptRef.split('#');
            initialFile = parts[0] || '';
            initialTestId = parts[1] || existing.automationTestId || '';
        } else if (suites.length > 0) {
            initialFile = suites[0].file;
            initialTestId = suites[0].tests?.[0]?.testId || '';
        }

        setSelectedSuiteFile(initialFile);
        setSelectedTestId(initialTestId);

        const defaultTestId = existing.automationTestId || initialTestId || `playwright-${(c.testCaseId || 'test').toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const defaultRef = existing.scriptRef || (initialFile ? `${initialFile}#${defaultTestId}` : `tests/e2e/suite.spec.js#${defaultTestId}`);
        const defaultCode = existing.scriptCode || SCRIPT_TEMPLATES.smoke;

        setMappingForm({
            framework: existing.framework || 'playwright',
            automationTestId: defaultTestId,
            scriptSource: source,
            scriptRef: defaultRef,
            scriptCode: defaultCode,
            scriptVersion: existing.scriptVersion || '1.0.0',
            targetEnvironment: existing.targetEnvironment || run?.targetEnvironment?.baseUrl || '',
            executionTimeout: existing.executionTimeout || 15000,
            mappingStatus: existing.mappingStatus || 'draft',
            preset: 'smoke'
        });

        setValidationResult(null);
        setDryRunResult(null);
        setTemplateWarnings([]);
        setShowHistoryDrawer(false);
        setIsMappingModalOpen(true);
    };

    // Static Script Validation
    const handleValidateScript = async () => {
        if (!activeCase) return;
        setIsValidatingScript(true);
        try {
            const payload = {
                framework: mappingForm.framework,
                automationTestId: mappingForm.automationTestId,
                scriptSource: configMethod,
                scriptRef: mappingForm.scriptRef,
                scriptCode: mappingForm.scriptCode,
                scriptVersion: mappingForm.scriptVersion,
                targetEnvironment: mappingForm.targetEnvironment ? { baseUrl: mappingForm.targetEnvironment } : run?.targetEnvironment,
                executionTimeout: mappingForm.executionTimeout
            };
            const res = await executionService.validateCaseScript(runId, activeCase.id, payload);
            if (res.success && res.data) {
                setValidationResult(res.data);
                if (res.data.valid) {
                    setMappingForm(prev => ({
                        ...prev,
                        mappingStatus: prev.mappingStatus === 'enabled' ? 'enabled' : 'validated'
                    }));
                } else {
                    setMappingForm(prev => ({ ...prev, mappingStatus: 'invalid' }));
                }
            }
        } catch (err) {
            alert(`Validation failed: ${err.message}`);
        } finally {
            setIsValidatingScript(false);
        }
    };

    // Dry Run Single Test Execution
    const handleDryRunScript = async () => {
        if (!activeCase) return;
        setIsTestingScript(true);
        setDryRunResult(null);
        try {
            const payload = {
                framework: mappingForm.framework,
                automationTestId: mappingForm.automationTestId,
                scriptSource: configMethod,
                scriptRef: mappingForm.scriptRef,
                scriptCode: mappingForm.scriptCode,
                executionTimeout: mappingForm.executionTimeout,
                targetEnvironment: mappingForm.targetEnvironment ? { baseUrl: mappingForm.targetEnvironment } : run?.targetEnvironment
            };
            const res = await executionService.testCaseScript(runId, activeCase.id, payload);
            if (res.success && res.data) {
                setDryRunResult(res.data);
            }
        } catch (err) {
            alert(`Dry run test error: ${err.message}`);
        } finally {
            setIsTestingScript(false);
        }
    };

    // Scenario-Specific Template Generation
    const handleGenerateScenarioTemplate = async () => {
        if (!activeCase) return;
        setIsGeneratingTemplate(true);
        try {
            const res = await executionService.suggestCaseTemplate(runId, activeCase.id);
            if (res.success && res.data) {
                setMappingForm(prev => ({
                    ...prev,
                    scriptCode: res.data.scriptCode,
                    automationTestId: prev.automationTestId || res.data.suggestedTestId,
                    scriptRef: prev.scriptRef || res.data.suggestedRef
                }));
                setTemplateWarnings(res.data.warnings || []);
            }
        } catch (err) {
            alert(`Failed to generate scenario template: ${err.message}`);
        } finally {
            setIsGeneratingTemplate(false);
        }
    };

    // Save Case Automation Mapping
    const handleSaveMapping = async () => {
        if (!activeCase) return;
        setIsSavingMapping(true);
        try {
            const payload = {
                framework: mappingForm.framework,
                automationTestId: mappingForm.automationTestId.trim(),
                scriptSource: configMethod,
                scriptRef: mappingForm.scriptRef.trim(),
                scriptCode: configMethod === 'custom' ? mappingForm.scriptCode : (mappingForm.scriptCode || ''),
                scriptVersion: mappingForm.scriptVersion,
                targetEnvironment: mappingForm.targetEnvironment ? { baseUrl: mappingForm.targetEnvironment } : null,
                executionTimeout: parseInt(mappingForm.executionTimeout, 10),
                mappingStatus: mappingForm.mappingStatus
            };

            const res = await executionService.updateCaseAutomationMapping(runId, activeCase.id, payload);
            if (res.success) {
                setIsMappingModalOpen(false);
                await loadRunData();
                if (activeCaseId) {
                    const refreshed = await executionService.getRunCase(runId, activeCaseId);
                    if (refreshed.success && refreshed.data) {
                        setActiveCaseDetails(refreshed.data);
                    }
                }
            }
        } catch (err) {
            alert(`Failed to save automation mapping: ${err.message}`);
        } finally {
            setIsSavingMapping(false);
        }
    };

    // Batch Auto-Configure Approved Scripts
    const handleAutoConfigureApproved = async () => {
        setIsAutoConfiguring(true);
        try {
            const res = await executionService.autoConfigureMappings(runId);
            if (res.success) {
                await loadRunData();
                if (activeCaseId) {
                    const refreshed = await executionService.getRunCase(runId, activeCaseId);
                    if (refreshed.success && refreshed.data) {
                        setActiveCaseDetails(refreshed.data);
                    }
                }
                alert(`Auto-configuration complete: ${res.data?.configuredCount || 0} cases bound to verified Playwright scripts.`);
            }
        } catch (err) {
            alert(`Auto-configure failed: ${err.message}`);
        } finally {
            setIsAutoConfiguring(false);
        }
    };

    // Rerun Failed Cases
    const handleRerunFailed = async () => {
        setIsRerunningFailed(true);
        try {
            const res = await executionService.rerunFailed(runId);
            if (res.success && res.data?.job) {
                setActiveJob(res.data.job);
                await loadRunData();
            } else if (res.message) {
                alert(res.message);
            }
        } catch (err) {
            alert(`Rerun failed cases error: ${err.message}`);
        } finally {
            setIsRerunningFailed(false);
        }
    };

return (
        <div className="qa-workspace">
            {/* Rerun Lineage Banner */}
            {(run.originalRunId || run.isRerun) && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 1.15rem',
                    background: '#0D1310',
                    border: '1px solid #1E2922',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.78rem',
                    color: '#BAC5BE',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#8BAF9A', fontWeight: 700 }}>⚡ RERUN EXECUTION:</span>
                        <span>Ancestry linked to original</span>
                        <NavLink to={`/app/runs/${run.originalRunId}`} style={{ color: '#8BAF9A', fontFamily: 'ui-monospace, monospace', textDecoration: 'underline', fontWeight: 600 }}>
                            Run #{String(run.originalRunId).slice(-8)}
                        </NavLink>
                        <span style={{ color: '#727D75' }}>({safeFormatValue(run.rerunType, 'failed')} tests scope)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <NavLink
                            to={`/app/runs/${run.id}/compare`}
                            className="ws-btn-secondary"
                            style={{ height: '28px', padding: '0 0.75rem', fontSize: '0.74rem', color: '#8BAF9A', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                            <GitCompare size={12} />
                            <span>Compare with Original</span>
                        </NavLink>
                    </div>
                </div>
            )}

            {/* ─── 1. TOP HEADER & BREADCRUMBS ─── */}
            <div className="qa-top-header">
                <div>
                    <div className="qa-breadcrumb-nav">
                        <NavLink to="/app/runs">Execution</NavLink>
                        <span className="qa-breadcrumb-sep">/</span>
                        <span>Test Run Workspace</span>
                    </div>

                    <div className="qa-title-cluster">
                        <NavLink
                            to="/app/runs"
                            className="ws-btn-secondary"
                            style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center' }}
                            title="Back to All Test Runs"
                        >
                            <ArrowLeft size={16} />
                        </NavLink>
                        <h1 className="qa-run-title">{safeFormatValue(run.name, 'Untitled Run')}</h1>
                        <span className="qa-run-id-pill">Run #{String(run.id).slice(-8)}</span>
                        <StatusBadge status={run.status} />
                        <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: run.executionType === 'automated' ? 'rgba(56, 189, 248, 0.15)' : run.executionType === 'mixed' ? 'rgba(139, 175, 154, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: run.executionType === 'automated' ? '#38BDF8' : run.executionType === 'mixed' ? '#8BAF9A' : '#A0A5A5',
                            border: '1px solid var(--qa-border)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                        }}>
                            {run.executionType === 'automated' ? 'Automated (Playwright)' : run.executionType === 'mixed' ? 'Hybrid Execution' : 'Manual Execution'}
                        </span>
                    </div>

                    <div className="qa-header-meta-row">
                        <span className="qa-header-meta-item">
                            Environment: <strong>{formatEnvironmentName(run.targetEnvironment)}</strong>
                            {typeof run.targetEnvironment === 'object' && run.targetEnvironment?.baseUrl && <span style={{ color: 'var(--qa-text-dim)', marginLeft: '4px' }}>({run.targetEnvironment.baseUrl})</span>}
                        </span>
                        <span style={{ color: 'var(--qa-text-dim)' }}>•</span>
                        <span className="qa-header-meta-item">
                            Suite: <strong>{formatSuiteTitle(run.suiteTitle || run.suiteName || run.suite)}</strong> (v{typeof run.suiteVersion === 'number' || typeof run.suiteVersion === 'string' ? run.suiteVersion : 1})
                        </span>
                        <span style={{ color: 'var(--qa-text-dim)' }}>•</span>
                        <span className="qa-header-meta-item">
                            Total: <strong>{cases.length} cases</strong>
                        </span>
                    </div>
                </div>

                {/* Header Action Controls */}
                <div className="qa-header-actions">
                    {/* Automation Readiness Pill Ledger */}
                    {(run.executionType === 'automated' || run.executionType === 'mixed') && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '4px 10px',
                            background: 'var(--qa-surface-elevated)',
                            border: '1px solid var(--qa-border)',
                            borderRadius: '6px',
                            fontSize: '0.74rem'
                        }}>
                            <span style={{ color: readyCount > 0 ? '#8BAF9A' : '#777E7E', fontWeight: 600 }}>{readyCount} Ready</span>
                            <span style={{ color: 'var(--qa-text-dim)' }}>•</span>
                            <span style={{ color: invalidCount > 0 ? '#E06C75' : '#777E7E' }}>{invalidCount} Invalid</span>
                            <span style={{ color: 'var(--qa-text-dim)' }}>•</span>
                            <span style={{ color: unmappedCount > 0 ? '#E5C07B' : '#777E7E' }}>{unmappedCount} Unmapped</span>
                        </div>
                    )}

                    {/* Auto-Configure Scripts button */}
                    {(run.executionType === 'automated' || run.executionType === 'mixed') && unconfiguredCount > 0 && readyCount > 0 && (
                        <button
                            type="button"
                            onClick={handleAutoConfigureApproved}
                            disabled={isAutoConfiguring || (activeJob && activeJob.status === 'running')}
                            className="ws-btn-secondary"
                            style={{
                                height: '34px',
                                padding: '0 0.85rem',
                                color: '#38BDF8',
                                borderColor: 'rgba(56, 189, 248, 0.3)',
                                fontSize: '0.82rem',
                                gap: '6px'
                            }}
                            title="Auto-bind approved Playwright scripts to remaining unmapped test cases"
                        >
                            <Wand2 size={14} className={isAutoConfiguring ? 'animate-spin' : ''} />
                            <span>{isAutoConfiguring ? 'Configuring...' : `Auto-Map Remaining (${unconfiguredCount})`}</span>
                        </button>
                    )}

                    {/* Automated Run CTA */}
                    {(run.executionType === 'automated' || run.executionType === 'mixed') && (
                        readyCount === 0 && (!activeJob || (activeJob.status !== 'queued' && activeJob.status !== 'running')) ? (
                            <button
                                type="button"
                                onClick={handleAutoConfigureApproved}
                                disabled={isAutoConfiguring}
                                className="ws-btn-primary"
                                style={{
                                    height: '34px',
                                    padding: '0 1rem',
                                    background: '#38BDF8',
                                    border: 'none',
                                    color: '#080909',
                                    fontWeight: 600,
                                    fontSize: '0.82rem',
                                    gap: '6px'
                                }}
                                title="No test cases have configured Playwright scripts. Click to auto-bind approved suite scripts."
                            >
                                <Wand2 size={14} className={isAutoConfiguring ? 'animate-spin' : ''} />
                                <span>{isAutoConfiguring ? 'Mapping Approved Scripts...' : `Auto-Map Approved Scripts (${cases.length})`}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleTriggerAutomated}
                                disabled={isTriggeringAuto || automationReadyCount === 0 || (activeJob && (activeJob.status === 'queued' || activeJob.status === 'running'))}
                                className="ws-btn-primary"
                                title={`Trigger Playwright execution suite (${readyCount} ready)`}
                                style={{
                                    height: '34px',
                                    padding: '0 1rem',
                                    background: activeJob?.status === 'running'
                                        ? '#38BDF8'
                                        : activeJob?.status === 'queued'
                                        ? '#E5C07B'
                                        : '#8BAF9A',
                                    border: 'none',
                                    color: '#080909',
                                    fontWeight: 600,
                                    fontSize: '0.82rem',
                                    gap: '6px'
                                }}
                            >
                                {activeJob?.status === 'running' ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Playwright Running... ({activeJob.completedCases || 0}/{activeJob.totalCases || 0})</span>
                                    </>
                                ) : activeJob?.status === 'queued' ? (
                                    <>
                                        <Clock size={14} />
                                        <span>Playwright Queued in Worker...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play size={14} fill="#080909" />
                                        <span>Run Test Suite ({automationReadyCount} Ready)</span>
                                    </>
                                )}
                            </button>
                        )
                    )}

                    {/* Rerun Failed Cases */}
                    {sum.failed > 0 && (!activeJob || (activeJob.status !== 'queued' && activeJob.status !== 'running')) && (
                        <button
                            type="button"
                            onClick={() => setIsRerunModalOpen(true)}
                            disabled={isRerunningFailed}
                            className="ws-btn-secondary"
                            style={{
                                height: '34px',
                                padding: '0 0.85rem',
                                color: '#E06C75',
                                borderColor: 'rgba(224, 108, 117, 0.4)',
                                fontSize: '0.82rem',
                                gap: '6px'
                            }}
                            title="Open Rerun Failed Tests focused selection modal"
                        >
                            <RotateCcw size={14} className={isRerunningFailed ? 'animate-spin' : ''} />
                            <span>{isRerunningFailed ? 'Rerunning...' : `Rerun Failed (${sum.failed})`}</span>
                        </button>
                    )}

                    {/* Rerun History & Lineage Button */}
                    <button
                        type="button"
                        onClick={() => setIsRerunHistoryOpen(true)}
                        className="ws-btn-secondary"
                        style={{ height: '34px', padding: '0 0.85rem', gap: '6px', fontSize: '0.82rem' }}
                        title="View rerun ancestry and execution history"
                    >
                        <History size={14} />
                        <span>Reruns</span>
                    </button>

                    {/* Compare Button */}
                    <NavLink
                        to={`/app/runs/${run.id}/compare`}
                        className="ws-btn-secondary"
                        style={{ height: '34px', padding: '0 0.85rem', gap: '6px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', color: '#8BAF9A', textDecoration: 'none' }}
                        title="Compare execution outcomes with rerun"
                    >
                        <GitCompare size={14} />
                        <span>Compare</span>
                    </NavLink>

                    {/* Toggle Live Runner Logs */}
                    <button
                        type="button"
                        onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                        className="ws-btn-secondary"
                        style={{
                            height: '34px',
                            padding: '0 0.75rem',
                            color: isTerminalOpen ? '#38BDF8' : 'var(--qa-text-muted)',
                            borderColor: isTerminalOpen ? 'rgba(56, 189, 248, 0.4)' : 'var(--qa-border)'
                        }}
                        title="Toggle Playwright Worker Console"
                    >
                        <Terminal size={14} />
                    </button>

                    {run.status !== 'completed' && run.status !== 'cancelled' && (
                        <button
                            type="button"
                            onClick={() => setIsCancelModalOpen(true)}
                            className="ws-btn-secondary"
                            style={{ height: '34px', padding: '0 0.85rem', color: '#E06C75', borderColor: 'rgba(224, 108, 117, 0.3)' }}
                        >
                            <StopCircle size={14} />
                            <span>Cancel Run</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={loadRunData}
                        className="ws-btn-secondary"
                        style={{ height: '34px', padding: '0 0.75rem' }}
                        title="Refresh execution state"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* ─── 2. COMPACT HORIZONTAL EXECUTION OVERVIEW ─── */}
            <div className="qa-overview-ribbon">
                <div className="qa-metric-strip">
                    <div className="qa-metric-chip total">
                        <Layers size={14} />
                        <span>{sum.total || cases.length} Total</span>
                    </div>
                    <div className="qa-metric-chip passed">
                        <CheckCircle2 size={14} />
                        <span>{sum.passed || 0} Passed</span>
                    </div>
                    <div className="qa-metric-chip failed">
                        <XCircle size={14} />
                        <span>{sum.failed || 0} Failed</span>
                    </div>
                    <div className="qa-metric-chip blocked">
                        <AlertTriangle size={14} />
                        <span>{sum.blocked || 0} Blocked</span>
                    </div>
                    <div className="qa-metric-chip skipped">
                        <MinusCircle size={14} />
                        <span>{sum.skipped || 0} Skipped</span>
                    </div>
                    <div className="qa-metric-chip not-run">
                        <Clock size={14} />
                        <span>{sum.not_run || 0} Not Run</span>
                    </div>
                </div>

                <div className="qa-progress-container">
                    <div className="qa-progress-bar-track">
                        {cases.length > 0 && (
                            <>
                                <div style={{ width: `${((sum.passed || 0) / cases.length) * 100}%` }} className="qa-progress-fill-passed" title={`Passed: ${sum.passed || 0}`} />
                                <div style={{ width: `${((sum.failed || 0) / cases.length) * 100}%` }} className="qa-progress-fill-failed" title={`Failed: ${sum.failed || 0}`} />
                                <div style={{ width: `${((sum.blocked || 0) / cases.length) * 100}%` }} className="qa-progress-fill-blocked" title={`Blocked: ${sum.blocked || 0}`} />
                                <div style={{ width: `${((sum.skipped || 0) / cases.length) * 100}%` }} className="qa-progress-fill-skipped" title={`Skipped: ${sum.skipped || 0}`} />
                            </>
                        )}
                    </div>
                    <span className="qa-progress-percent">
                        {cases.length > 0 ? Math.round(((cases.length - (sum.not_run || 0)) / cases.length) * 100) : 0}%
                    </span>
                </div>
            </div>

            {/* ─── 3. WORKSPACE VIEW TABS ─── */}
            <div className="qa-tab-strip">
                <button
                    type="button"
                    onClick={() => setActiveTab('cases')}
                    className={`qa-tab-btn ${activeTab === 'cases' ? 'active' : ''}`}
                >
                    <Layers size={14} />
                    <span>Execution Workspace ({cases.length})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('report')}
                    className={`qa-tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                >
                    <FileText size={14} />
                    <span>Executive Report</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('compare')}
                    className={`qa-tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
                >
                    <GitCompare size={14} />
                    <span>Run Comparison</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('artifacts')}
                    className={`qa-tab-btn ${activeTab === 'artifacts' ? 'active' : ''}`}
                >
                    <Camera size={14} />
                    <span>Artifacts & Evidence ({artifacts.length})</span>
                </button>
            </div>

            {/* TAB: EXECUTIVE REPORT */}
            {activeTab === 'report' ? (
                <RunReportView
                    runId={runId}
                    onRerunTriggered={() => loadRunData()}
                    onSwitchToCases={() => setActiveTab('cases')}
                />
            ) : activeTab === 'compare' ? (
                /* TAB: RUN COMPARISON */
                <RerunResultComparisonView
                    runId={runId}
                    initialRerunId={run?.originalRunId ? run.id : null}
                    onSelectRun={(id) => navigate(`/app/runs/${id}`)}
                />
            ) : activeTab === 'artifacts' ? (
                /* TAB: ARTIFACTS & LOGS */
                <section className="evidence-browser">
                    <div className="evidence-heading">
                        <div>
                            <div className="evidence-breadcrumb"><NavLink to="/app/runs">Execution</NavLink><span>/</span><span>Artifacts &amp; Evidence</span></div>
                            <h2>{formatSuiteTitle(evidenceSuiteName || run.suiteName || run.suite)} <span className="evidence-run-number">Run {safeFormatValue(run.runNumber || run.run_number || String(run.id).slice(0, 8))}</span></h2>
                            <div className="evidence-run-meta"><StatusBadge status={run.status} /><span>{formatEnvironmentName(run.targetEnvironment)}</span><span>{artifacts.length} {artifacts.length === 1 ? 'artifact' : 'artifacts'}</span></div>
                        </div>
                        {previewArtifact && <button type="button" className="evidence-download evidence-heading-download" onClick={() => downloadEvidence(previewArtifact)}><Download size={14} /> Download selected</button>}
                    </div>

                    <nav className="evidence-kind-tabs" aria-label="Evidence type">
                        {[['all', 'All'], ['screenshot', 'Screenshots'], ['video', 'Videos'], ['log', 'Execution logs'], ['trace', 'Playwright traces'], ['manual', 'Manual attachments']].map(([value, label]) => (
                            <button type="button" key={value} className={evidenceKind === value ? 'active' : ''} onClick={() => setEvidenceKind(value)}>{label}<span>{value === 'all' ? artifacts.length : artifacts.filter(a => getEvidenceKind(a) === value).length}</span></button>
                        ))}
                    </nav>

                    <div className="evidence-filter-row">
                        <label className="evidence-search"><Search size={15} /><input value={evidenceSearch} onChange={event => setEvidenceSearch(event.target.value)} placeholder="Search files or test cases" aria-label="Search evidence" /></label>
                        <select value={evidenceCase} onChange={event => setEvidenceCase(event.target.value)} aria-label="Filter by test case"><option value="all">All test cases</option>{cases.map(item => <option key={item.id} value={item.id}>{item.testCaseId} · {item.caseSnapshot?.title || 'Untitled test'}</option>)}</select>
                        <select value={evidenceStatus} onChange={event => setEvidenceStatus(event.target.value)} aria-label="Filter by execution status"><option value="all">All statuses</option>{[...new Set(cases.map(item => item.status).filter(Boolean))].map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select>
                        <label className="evidence-date-filter">From<input type="date" value={evidenceFrom} onChange={event => setEvidenceFrom(event.target.value)} aria-label="From date" /></label>
                        <label className="evidence-date-filter">To<input type="date" value={evidenceTo} onChange={event => setEvidenceTo(event.target.value)} aria-label="To date" /></label>
                        <select value={evidenceMime} onChange={event => setEvidenceMime(event.target.value)} aria-label="Filter by file type"><option value="all">All file types</option><option value="image">Images</option><option value="video">Video</option><option value="text">Text / JSON</option><option value="application">Application files</option><option value="other">Unknown type</option></select>
                    </div>

                    {isArtifactsLoading ? <div className="evidence-state"><span className="evidence-state-title">Loading evidence</span><span>Retrieving artifact records for this run…</span></div> : artifactsError ? (
                        <div className="evidence-state evidence-state-error"><span className="evidence-state-title">Evidence could not be loaded</span><span>{artifactsError}</span><button type="button" onClick={loadRunData}>Try again</button></div>
                    ) : artifacts.length === 0 ? (
                        <div className="evidence-state"><span className="evidence-state-title">No evidence for this run</span><span>Evidence appears here when a manual or automated execution records an artifact.</span></div>
                    ) : filteredArtifacts.length === 0 ? (
                        <div className="evidence-state"><span className="evidence-state-title">No matching evidence</span><span>Adjust or clear the search and filters to see more files.</span><button type="button" onClick={() => { setEvidenceSearch(''); setEvidenceKind('all'); setEvidenceCase('all'); setEvidenceStatus('all'); setEvidenceFrom(''); setEvidenceTo(''); setEvidenceMime('all'); }}>Clear filters</button></div>
                    ) : (
                        <div className="evidence-list" role="list">
                            {filteredArtifacts.map(artifact => {
                                const kind = getEvidenceKind(artifact);
                                const linkedCase = evidenceById.get(artifact.runCaseId);
                                const isSelected = previewArtifact?.id === artifact.id;
                                return <article className={`evidence-row ${isSelected ? 'selected' : ''}`} key={artifact.id} role="listitem">
                                    {kind === 'screenshot' || kind === 'video' ? <EvidenceThumbnail runId={runId} artifact={artifact} onSelect={() => setPreviewArtifact(artifact)} /> : <button type="button" className="evidence-file-mark" onClick={() => setPreviewArtifact(artifact)} aria-label={`Inspect ${artifact.name}`}>{kind === 'trace' ? 'TRACE' : kind === 'log' ? 'LOG' : 'FILE'}</button>}
                                    <button type="button" className="evidence-row-main" onClick={() => setPreviewArtifact(artifact)}>
                                        <span className="evidence-filename">{artifact.name}</span>
                                            <span className="evidence-case-name">{linkedCase ? `${linkedCase.testCaseId} · ${linkedCase.caseSnapshot?.title || 'Untitled test'}` : 'Run-level artifact'}</span>
                                        <span className="evidence-row-meta"><span>{kind === 'trace' ? 'Playwright trace' : kind === 'manual' ? 'Manual attachment' : kind === 'log' ? 'Execution log' : kind}</span><span>{formatBytes(artifact.sizeBytes)}</span><span>{artifact.createdAt ? new Date(artifact.createdAt).toLocaleString() : 'Timestamp unavailable'}</span>{artifact.metadata?.uploader && <span>Uploaded by {artifact.metadata.uploader}</span>}</span>
                                    </button>
                                    {linkedCase ? <StatusBadge status={linkedCase.status} /> : <span className="evidence-no-status">No linked test</span>}
                                    <button type="button" className="evidence-icon-action" onClick={() => downloadEvidence(artifact)} aria-label={`Download ${artifact.name}`} title="Download"><Download size={15} /></button>
                                </article>;
                            })}
                        </div>
                    )}
                    {copyMessage && <div className="evidence-toast" role="status">{copyMessage}</div>}
                </section>
            ) : (
                /* ─── 4. MAIN WORKSPACE: THREE-PANEL MANUAL EXECUTION WORKSPACE ─── */
                <div className={`qa-master-detail-grid ${isContextPanelCollapsed ? 'context-collapsed' : ''}`}>
                    {/* PANEL 1: Master Case Navigator */}
                    <div className={`qa-master-panel ${isMobileDetailOpen ? 'mobile-hidden' : ''}`}>
                        {/* Progress Bar & Summary */}
                        <div className="qa-navigator-progress">
                            <div className="qa-nav-progress-row">
                                <span style={{ fontWeight: 600 }}>Test Run Progress</span>
                                <span>
                                    <strong>{((sum.passed || 0) + (sum.failed || 0) + (sum.blocked || 0) + (sum.skipped || 0))}</strong> / {cases.length} Executed
                                </span>
                            </div>
                            <div className="qa-nav-progress-bar">
                                <div className="qa-nav-prog-fill passed" style={{ width: `${((sum.passed || 0) / (cases.length || 1)) * 100}%` }} title={`Passed: ${sum.passed || 0}`} />
                                <div className="qa-nav-prog-fill failed" style={{ width: `${((sum.failed || 0) / (cases.length || 1)) * 100}%` }} title={`Failed: ${sum.failed || 0}`} />
                                <div className="qa-nav-prog-fill blocked" style={{ width: `${((sum.blocked || 0) / (cases.length || 1)) * 100}%` }} title={`Blocked: ${sum.blocked || 0}`} />
                                <div className="qa-nav-prog-fill skipped" style={{ width: `${((sum.skipped || 0) / (cases.length || 1)) * 100}%` }} title={`Skipped: ${sum.skipped || 0}`} />
                            </div>
                            {/* Horizontal Filter Pills */}
                            <div className="qa-navigator-filter-pills">
                                {[
                                    { id: 'all', label: `All (${cases.length})` },
                                    { id: 'not_run', label: `Not Run (${sum.not_run || 0})` },
                                    { id: 'passed', label: `Passed (${sum.passed || 0})` },
                                    { id: 'failed', label: `Failed (${sum.failed || 0})` },
                                    { id: 'blocked', label: `Blocked (${sum.blocked || 0})` },
                                    { id: 'skipped', label: `Skipped (${sum.skipped || 0})` }
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        className={`qa-filter-pill-btn ${statusFilter === p.id ? 'active' : ''}`}
                                        onClick={() => setStatusFilter(p.id)}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search and Filters */}
                        <div className="qa-master-panel-header">
                            <div className="qa-search-box">
                                <Search size={14} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search test cases by title or ID..."
                                    className="qa-search-input"
                                />
                            </div>

                            <div className="qa-filter-controls">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="qa-select-input"
                                >
                                    <option value="all">All Outcomes ({cases.length})</option>
                                    <option value="passed">Passed ({sum.passed || 0})</option>
                                    <option value="failed">Failed ({sum.failed || 0})</option>
                                    <option value="blocked">Blocked ({sum.blocked || 0})</option>
                                    <option value="skipped">Skipped ({sum.skipped || 0})</option>
                                    <option value="not_run">Not Run ({sum.not_run || 0})</option>
                                </select>

                                <select
                                    value={methodFilter}
                                    onChange={(e) => setMethodFilter(e.target.value)}
                                    className="qa-select-input"
                                >
                                    <option value="all">All Methods</option>
                                    <option value="manual">Manual Only</option>
                                    <option value="automated">Playwright</option>
                                </select>
                            </div>
                        </div>

                        {/* Grouped Category Accordions */}
                        <div className="qa-case-list-scroll">
                            {Object.keys(groupedCases).length === 0 ? (
                                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--qa-text-muted)', fontSize: '0.84rem' }}>
                                    No test cases match the applied search and outcome filters.
                                </div>
                            ) : (
                                Object.entries(groupedCases).map(([catName, catCases]) => {
                                    const isCollapsed = Boolean(collapsedCategories[catName]);
                                    return (
                                        <div key={catName} className="qa-category-group">
                                            <div
                                                onClick={() => toggleCategoryCollapse(catName)}
                                                className="qa-category-header"
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                                    <span>{catName}</span>
                                                </div>
                                                <span className="qa-category-count-badge">{catCases.length}</span>
                                            </div>

                                            {!isCollapsed && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                                    {catCases.map(c => {
                                                        const isSelected = c.id === activeCaseId;
                                                        return (
                                                            <div
                                                                key={c.id}
                                                                onClick={() => handleSelectCase(c.id)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        handleSelectCase(c.id);
                                                                    }
                                                                }}
                                                                role="button"
                                                                tabIndex={0}
                                                                aria-pressed={isSelected}
                                                                className={`qa-case-card ${isSelected ? 'active' : ''}`}
                                                            >
                                                                <div className="qa-case-card-top">
                                                                    <span className="qa-case-id-text">
                                                                        {safeFormatValue(c.testCaseId, 'TC')}
                                                                    </span>
                                                                    <div className="qa-case-badges">
                                                                        <PriorityBadge priority={c.caseSnapshot?.priority} />
                                                                        <CaseMethodBadge c={c} />
                                                                        <StatusBadge status={c.status} />
                                                                    </div>
                                                                </div>
                                                                <div className="qa-case-title-text">
                                                                    {safeFormatValue(c.caseSnapshot?.title, 'Untitled Test Case')}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Keyboard shortcut helper */}
                        <div className="qa-keyboard-shortcut-hint">
                            <span>Navigation</span>
                            <span><kbd>Alt+P</kbd> Prev • <kbd>Alt+N</kbd> Next</span>
                        </div>
                    </div>

                    {/* CENTER PANEL: Primary Execution Area */}
                    <div className={`qa-detail-panel ${!isMobileDetailOpen ? 'mobile-hidden' : ''}`}>
                        {activeCase ? (
                            <>
                                <div className="qa-detail-scroll-area">
                                    <div className="qa-detail-content">
                                {/* Mobile Back Button */}
                                {isMobileDetailOpen && (
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '-0.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => setIsMobileDetailOpen(false)}
                                            className="ws-btn-secondary"
                                            style={{ height: '30px', fontSize: '0.78rem', gap: '6px' }}
                                        >
                                            <ArrowLeft size={13} />
                                            <span>Back to Test Cases</span>
                                        </button>
                                    </div>
                                )}

                                {/* ─── 1. Identity & Priority Header ─── */}
                                <div className="qa-section-block">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                                            <span className="qa-case-id-text" style={{ fontSize: '0.86rem' }}>
                                                {safeFormatValue(activeCase.testCaseId, 'TC')}
                                            </span>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--qa-text-muted)' }}>
                                                {safeFormatValue(snapshot.module, 'General')} • {safeFormatValue(snapshot.type, 'Functional')}
                                            </span>
                                            <PriorityBadge priority={snapshot.priority} />
                                            <CaseMethodBadge c={activeCase} />
                                            <StatusBadge status={activeCase.status} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            {targetAppUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => window.open(targetAppUrl, '_blank', 'noopener,noreferrer')}
                                                    className="ws-btn-secondary"
                                                    style={{ height: '28px', fontSize: '0.74rem', gap: '5px' }}
                                                    title="Open target application in external browser tab"
                                                >
                                                    <ExternalLink size={12} />
                                                    <span>Open Target App</span>
                                                </button>
                                            )}
                                            <span style={{ fontSize: '0.74rem', color: 'var(--qa-text-muted)' }}>
                                                Current: <strong>Attempt #{activeCase.currentAttempt || 1}</strong>
                                            </span>
                                        </div>
                                    </div>
                                    <h2 className="qa-case-detail-title">{safeFormatValue(snapshot.title, 'Untitled Test Case')}</h2>
                                </div>

                                {/* ─── 2. Automation Readiness & Mapping Info ─── */}
                                {(() => {
                                    const map = snapshot.automationMapping;
                                    const isAutoReady = hasAutomation &&
                                        (map?.mappingStatus === 'configured' || map?.mappingStatus === 'enabled') &&
                                        (Boolean(map?.scriptCode) || (map?.scriptSource === 'existing' && Boolean(map?.scriptRef)));

                                    return (
                                        <div className="qa-section-block">
                                            <div className="qa-section-header">
                                                <h3 className="qa-section-title">
                                                    <Bot size={15} style={{ color: isAutoReady ? 'var(--qa-jade)' : 'var(--qa-warn)' }} />
                                                    <span>Playwright Automation Readiness</span>
                                                </h3>
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    textTransform: 'uppercase',
                                                    background: isAutoReady ? 'var(--qa-jade-dim)' : 'var(--qa-warn-dim)',
                                                    color: isAutoReady ? 'var(--qa-jade)' : 'var(--qa-warn)',
                                                    border: `1px solid ${isAutoReady ? 'var(--qa-jade-border)' : 'rgba(229, 192, 123, 0.3)'}`
                                                }}>
                                                    {isAutoReady ? 'Ready for Execution' : 'Unmapped / Draft'}
                                                </span>
                                            </div>

                                            <div className={`qa-automation-card ${isAutoReady ? 'ready' : 'unmapped'}`}>
                                                <div className="qa-auto-grid">
                                                    <div className="qa-auto-meta-item">
                                                        <label>Framework</label>
                                                        <span>{map?.framework || 'Playwright (Chromium)'}</span>
                                                    </div>
                                                    <div className="qa-auto-meta-item">
                                                        <label>Automation Test ID</label>
                                                        <span style={{ fontFamily: 'ui-monospace, monospace' }}>{map?.automationTestId || 'None bound'}</span>
                                                    </div>
                                                    <div className="qa-auto-meta-item">
                                                        <label>Script Reference</label>
                                                        <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--qa-text-muted)' }}>
                                                            {map?.scriptRef || 'Inline custom script'}
                                                        </span>
                                                    </div>
                                                    <div className="qa-auto-meta-item">
                                                        <label>Timeout</label>
                                                        <span>{map?.executionTimeout || 15000}ms</span>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                                                    <div style={{ fontSize: '0.8rem', color: isAutoReady ? 'var(--qa-jade)' : 'var(--qa-warn)' }}>
                                                        {isAutoReady
                                                            ? '✓ Verified Playwright test bound to this scenario.'
                                                            : 'Automation mapping is missing or incomplete.'}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {isAutoReady && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowScriptPreview(!showScriptPreview)}
                                                                className="ws-btn-secondary"
                                                                style={{ height: '30px', fontSize: '0.76rem', padding: '0 0.75rem' }}
                                                            >
                                                                <Code size={13} />
                                                                <span>{showScriptPreview ? 'Hide Script' : 'View Script'}</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenMappingModal(activeCase)}
                                                            className={isAutoReady ? 'ws-btn-secondary' : 'ws-btn-primary'}
                                                            style={{ height: '30px', fontSize: '0.76rem', padding: '0 0.85rem', gap: '5px' }}
                                                        >
                                                            <Edit3 size={13} />
                                                            <span>{isAutoReady ? 'Configure Script' : 'Configure Automation'}</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Script Code Preview */}
                                                {showScriptPreview && map?.scriptCode && (
                                                    <pre style={{
                                                        margin: '0.5rem 0 0',
                                                        padding: '0.85rem',
                                                        background: 'var(--qa-bg)',
                                                        border: '1px solid var(--qa-border)',
                                                        borderRadius: '6px',
                                                        color: 'var(--qa-jade)',
                                                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                                                        fontSize: '0.78rem',
                                                        maxHeight: '200px',
                                                        overflowY: 'auto',
                                                        lineHeight: '1.45',
                                                        whiteSpace: 'pre-wrap'
                                                    }}>
                                                        {map.scriptCode}
                                                    </pre>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* ─── 3. Preconditions & Target Assertion ─── */}
                                <div className="qa-section-block">
                                    <div className="qa-preconditions-grid">
                                        <div className="qa-meta-box">
                                            <label>Preconditions & Context</label>
                                            <p>{safeFormatValue(snapshot.preconditions, 'None specified')}</p>
                                        </div>
                                        <div className="qa-meta-box">
                                            <label>Target Expected Result</label>
                                            <p style={{ color: 'var(--qa-jade)' }}>
                                                {safeFormatValue(snapshot.expectedResult, 'Expected scenario outcome meets acceptance criteria.')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* ─── 4. Test Steps with Per-Step Verification ─── */}
                                {Array.isArray(snapshot.steps) && snapshot.steps.length > 0 && (
                                    <div className="qa-section-block">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <h3 className="qa-section-title" style={{ margin: 0 }}>
                                                <span>Interactive Step Verification</span>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--qa-text-dim)', fontWeight: 400 }}>
                                                    ({snapshot.steps.length} steps)
                                                </span>
                                            </h3>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {targetAppUrl && (
                                                    <button
                                                        type="button"
                                                        onClick={() => window.open(targetAppUrl, '_blank', 'noopener,noreferrer')}
                                                        className="ws-btn-secondary"
                                                        style={{ height: '28px', fontSize: '0.75rem', gap: '5px' }}
                                                        title="Open target application in a new tab for side-by-side verification"
                                                    >
                                                        <Eye size={13} />
                                                        <span>Launch App</span>
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={handleMarkAllStepsPassed}
                                                    className="ws-btn-secondary"
                                                    style={{ height: '28px', fontSize: '0.75rem', gap: '5px', color: 'var(--qa-jade)' }}
                                                    title="Mark all steps as Passed with one click"
                                                >
                                                    <CheckCircle2 size={13} />
                                                    <span>Mark All Passed</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={handleResetAllSteps}
                                                    className="ws-btn-secondary"
                                                    style={{ height: '28px', fontSize: '0.75rem', gap: '5px' }}
                                                    title="Reset all steps to pending"
                                                >
                                                    <RotateCcw size={12} />
                                                    <span>Reset</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="qa-steps-list">
                                            {snapshot.steps.map((st, idx) => {
                                                const stepState = stepOutcomes[idx] || { status: 'pending', actual: '' };
                                                const stepStatus = stepState.status || 'pending';

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="qa-step-item"
                                                        style={{
                                                            borderLeft: `3px solid ${
                                                                stepStatus === 'passed' ? 'var(--qa-jade)' :
                                                                stepStatus === 'failed' ? 'var(--qa-fail)' :
                                                                stepStatus === 'blocked' ? 'var(--qa-warn)' :
                                                                stepStatus === 'skipped' ? 'var(--qa-purple)' : 'var(--qa-border)'
                                                            }`,
                                                            padding: '0.75rem',
                                                            marginBottom: '0.65rem',
                                                            background: 'rgba(255,255,255,0.02)',
                                                            borderRadius: '4px'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                                            <div style={{ display: 'flex', gap: '0.6rem', flex: 1 }}>
                                                                <span className="qa-step-num">{idx + 1}</span>
                                                                <div className="qa-step-body" style={{ flex: 1 }}>
                                                                    <div style={{ fontWeight: 500, color: 'var(--qa-text)' }}>
                                                                        {safeFormatValue(typeof st === 'object' ? (st.action || st.step || st.description || st.text) : st)}
                                                                    </div>
                                                                    {st && typeof st === 'object' && st.expected && (
                                                                        <span className="qa-step-expected" style={{ display: 'block', marginTop: '0.25rem', color: 'var(--qa-jade)' }}>
                                                                            ↳ Expected: {safeFormatValue(st.expected)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Step verification outcome buttons */}
                                                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStepStatusChange(idx, 'passed')}
                                                                    style={{
                                                                        height: '24px',
                                                                        padding: '0 7px',
                                                                        fontSize: '0.7rem',
                                                                        borderRadius: '3px',
                                                                        cursor: 'pointer',
                                                                        border: '1px solid',
                                                                        borderColor: stepStatus === 'passed' ? 'var(--qa-jade)' : 'var(--qa-border)',
                                                                        background: stepStatus === 'passed' ? 'rgba(139, 175, 154, 0.25)' : 'transparent',
                                                                        color: stepStatus === 'passed' ? 'var(--qa-jade)' : 'var(--qa-text-dim)',
                                                                        fontWeight: stepStatus === 'passed' ? 700 : 500
                                                                    }}
                                                                >
                                                                    Pass
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStepStatusChange(idx, 'failed')}
                                                                    style={{
                                                                        height: '24px',
                                                                        padding: '0 7px',
                                                                        fontSize: '0.7rem',
                                                                        borderRadius: '3px',
                                                                        cursor: 'pointer',
                                                                        border: '1px solid',
                                                                        borderColor: stepStatus === 'failed' ? 'var(--qa-fail)' : 'var(--qa-border)',
                                                                        background: stepStatus === 'failed' ? 'rgba(224, 108, 117, 0.25)' : 'transparent',
                                                                        color: stepStatus === 'failed' ? 'var(--qa-fail)' : 'var(--qa-text-dim)',
                                                                        fontWeight: stepStatus === 'failed' ? 700 : 500
                                                                    }}
                                                                >
                                                                    Fail
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStepStatusChange(idx, 'blocked')}
                                                                    style={{
                                                                        height: '24px',
                                                                        padding: '0 7px',
                                                                        fontSize: '0.7rem',
                                                                        borderRadius: '3px',
                                                                        cursor: 'pointer',
                                                                        border: '1px solid',
                                                                        borderColor: stepStatus === 'blocked' ? 'var(--qa-warn)' : 'var(--qa-border)',
                                                                        background: stepStatus === 'blocked' ? 'rgba(229, 192, 123, 0.25)' : 'transparent',
                                                                        color: stepStatus === 'blocked' ? 'var(--qa-warn)' : 'var(--qa-text-dim)',
                                                                        fontWeight: stepStatus === 'blocked' ? 700 : 500
                                                                    }}
                                                                >
                                                                    Block
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStepStatusChange(idx, 'skipped')}
                                                                    style={{
                                                                        height: '24px',
                                                                        padding: '0 7px',
                                                                        fontSize: '0.7rem',
                                                                        borderRadius: '3px',
                                                                        cursor: 'pointer',
                                                                        border: '1px solid',
                                                                        borderColor: stepStatus === 'skipped' ? 'var(--qa-purple)' : 'var(--qa-border)',
                                                                        background: stepStatus === 'skipped' ? 'rgba(198, 120, 221, 0.25)' : 'transparent',
                                                                        color: stepStatus === 'skipped' ? 'var(--qa-purple)' : 'var(--qa-text-dim)',
                                                                        fontWeight: stepStatus === 'skipped' ? 700 : 500
                                                                    }}
                                                                >
                                                                    Skip
                                                                </button>
                                                                {stepStatus === 'failed' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenDefectModal(idx)}
                                                                        className="qa-step-defect-btn"
                                                                        title="Log defect from this failed step"
                                                                    >
                                                                        <Bug size={11} />
                                                                        <span>Log Defect</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Optional step observation text */}
                                                        {stepStatus !== 'pending' && (
                                                            <div style={{ marginTop: '0.4rem', marginLeft: '1.8rem' }}>
                                                                <input
                                                                    type="text"
                                                                    value={stepState.actual || ''}
                                                                    onChange={(e) => handleStepActualChange(idx, e.target.value)}
                                                                    placeholder={`Observed step ${idx + 1} behavior (optional)...`}
                                                                    className="qa-text-input"
                                                                    style={{ height: '26px', fontSize: '0.75rem', padding: '0 8px' }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* ─── 5. Execution Station (Manual / API Testing) ─── */}
                                <div className="qa-section-block">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <h3 className="qa-section-title" style={{ margin: 0 }}>
                                            <span>Record Execution Outcome</span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--qa-text-dim)', fontWeight: 400 }}>
                                                (Attempt #{activeCase.currentAttempt || 1})
                                            </span>
                                        </h3>

                                        {/* Execution Mode Tabs: Manual vs API */}
                                        <div style={{ display: 'flex', background: 'var(--qa-surface)', borderRadius: '4px', border: '1px solid var(--qa-border)', padding: '2px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setExecutionStationMode('manual')}
                                                style={{
                                                    background: executionStationMode === 'manual' ? 'var(--qa-bg-card)' : 'transparent',
                                                    color: executionStationMode === 'manual' ? 'var(--qa-jade)' : 'var(--qa-text-dim)',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    padding: '3px 10px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Manual Workflow
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setExecutionStationMode('api')}
                                                style={{
                                                    background: executionStationMode === 'api' ? 'var(--qa-bg-card)' : 'transparent',
                                                    color: executionStationMode === 'api' ? '#38BDF8' : 'var(--qa-text-dim)',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    padding: '3px 10px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                API Execution
                                            </button>
                                        </div>
                                    </div>

                                    {/* ─── MODE A: MANUAL TESTING WORKFLOW ─── */}
                                    {executionStationMode === 'manual' && (
                                        <div className="qa-execution-station">
                                            {/* Status Selector */}
                                            <div className="qa-field-group">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                                    <span className="qa-field-label">Verification Outcome *</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--qa-text-dim)' }}>
                                                        Derived automatically from steps
                                                    </span>
                                                </div>
                                                <div className="qa-outcome-btn-group">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormStatus('passed')}
                                                        className={`qa-outcome-btn pass ${formStatus === 'passed' ? 'selected' : ''}`}
                                                    >
                                                        <CheckCircle2 size={15} />
                                                        <span>Passed</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormStatus('failed')}
                                                        className={`qa-outcome-btn fail ${formStatus === 'failed' ? 'selected' : ''}`}
                                                    >
                                                        <XCircle size={15} />
                                                        <span>Failed</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormStatus('blocked')}
                                                        className={`qa-outcome-btn blocked ${formStatus === 'blocked' ? 'selected' : ''}`}
                                                    >
                                                        <AlertTriangle size={15} />
                                                        <span>Blocked</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormStatus('skipped')}
                                                        className={`qa-outcome-btn skipped ${formStatus === 'skipped' ? 'selected' : ''}`}
                                                    >
                                                        <MinusCircle size={15} />
                                                        <span>Skipped</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Actual Result & Observations */}
                                            <div className="qa-field-group">
                                                <label className="qa-field-label">Actual Result & Tester Observations</label>
                                                <textarea
                                                    rows={3}
                                                    value={actualResult}
                                                    onChange={(e) => setActualResult(e.target.value)}
                                                    placeholder="Describe observed UI outcome, network behavior, assertion results, or encountered issues..."
                                                    className="qa-textarea"
                                                />
                                            </div>

                                            {/* Execution Notes */}
                                            <div className="qa-field-group">
                                                <label className="qa-field-label">Execution Notes & Context</label>
                                                <input
                                                    type="text"
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    placeholder="e.g., Verified on Chrome 124, 1920x1080 resolution, staging build #91"
                                                    className="qa-text-input"
                                                />
                                            </div>

                                            {/* Evidence Attachment */}
                                            <div className="qa-field-group">
                                                <label className="qa-field-label">Supporting Evidence / Failure Screenshot</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                    <label className="ws-btn-secondary" style={{ height: '32px', cursor: 'pointer', gap: '6px' }}>
                                                        <Camera size={14} />
                                                        <span>Attach Screenshot</span>
                                                        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                                    </label>

                                                    {screenshotName && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--qa-jade)' }}>
                                                            <span>✓ {screenshotName} attached</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setScreenshotData(null); setScreenshotName(''); }}
                                                                style={{ background: 'none', border: 'none', color: 'var(--qa-fail)', cursor: 'pointer', padding: 0 }}
                                                                title="Remove screenshot"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {screenshotData && (
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        <img
                                                            src={screenshotData}
                                                            alt="Evidence preview"
                                                            style={{ maxWidth: '260px', maxHeight: '140px', borderRadius: '4px', border: '1px solid var(--qa-border)' }}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {saveMessage && (
                                                <div style={{ color: 'var(--qa-jade)', fontSize: '0.84rem', fontWeight: 600 }}>
                                                    ✓ {saveMessage}
                                                </div>
                                            )}

                                            {/* Action Buttons: Save Draft vs Complete */}
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveDraft}
                                                    className="ws-btn-secondary"
                                                    style={{ height: '36px', padding: '0 1rem', fontSize: '0.8rem' }}
                                                    title="Save in-progress verification draft without recording final completion"
                                                >
                                                    Save as Draft
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={handleSaveExecution}
                                                    disabled={isSaving}
                                                    className="ws-btn-primary"
                                                    style={{ height: '36px', padding: '0 1.5rem', fontWeight: 600 }}
                                                >
                                                    {isSaving ? 'Recording Execution...' : activeCase.status !== 'not_run' ? 'Log Retest Attempt' : 'Complete Execution'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ─── MODE B: REAL HTTP API EXECUTION STATION ─── */}
                                    {executionStationMode === 'api' && (
                                        <div className="qa-execution-station" style={{ borderLeft: '3px solid #38BDF8' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <label className="qa-field-label">HTTP Method</label>
                                                    <select
                                                        value={apiConfig.method}
                                                        onChange={(e) => setApiConfig(prev => ({ ...prev, method: e.target.value }))}
                                                        className="qa-text-input"
                                                        style={{ height: '36px', fontWeight: 700 }}
                                                    >
                                                        <option value="GET">GET</option>
                                                        <option value="POST">POST</option>
                                                        <option value="PUT">PUT</option>
                                                        <option value="PATCH">PATCH</option>
                                                        <option value="DELETE">DELETE</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="qa-field-label">Endpoint URL *</label>
                                                    <input
                                                        type="text"
                                                        value={apiConfig.url}
                                                        onChange={(e) => setApiConfig(prev => ({ ...prev, url: e.target.value }))}
                                                        placeholder="https://api.example.com/v1/resource or target environment URL"
                                                        className="qa-text-input"
                                                        style={{ height: '36px' }}
                                                    />
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <label className="qa-field-label">Request Headers (JSON)</label>
                                                    <textarea
                                                        rows={3}
                                                        value={apiConfig.headers}
                                                        onChange={(e) => setApiConfig(prev => ({ ...prev, headers: e.target.value }))}
                                                        placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                                                        className="qa-textarea"
                                                        style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="qa-field-label">Request Body (JSON / Payload)</label>
                                                    <textarea
                                                        rows={3}
                                                        value={apiConfig.body}
                                                        onChange={(e) => setApiConfig(prev => ({ ...prev, body: e.target.value }))}
                                                        placeholder='{"title": "Test Resource", "status": "active"}'
                                                        className="qa-textarea"
                                                        style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                                                    />
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <label className="qa-field-label">Expected Status</label>
                                                    <input
                                                        type="number"
                                                        value={apiConfig.expectedStatus}
                                                        onChange={(e) => setApiConfig(prev => ({ ...prev, expectedStatus: e.target.value }))}
                                                        className="qa-text-input"
                                                        style={{ height: '36px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="qa-field-label">Assert JSON Property (optional)</label>
                                                    <input
                                                        type="text"
                                                        value={apiConfig.jsonPath}
                                                        onChange={(e) => setApiConfig(prev => ({ ...prev, jsonPath: e.target.value }))}
                                                        placeholder="e.g. data.success or status"
                                                        className="qa-text-input"
                                                        style={{ height: '36px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="qa-field-label">Expected Value</label>
                                                    <input
                                                        type="text"
                                                        value={apiConfig.expectedValue}
                                                        onChange={(e) => setApiConfig(prev => ({ ...prev, expectedValue: e.target.value }))}
                                                        placeholder="e.g. true or completed"
                                                        className="qa-text-input"
                                                        style={{ height: '36px' }}
                                                    />
                                                </div>
                                            </div>

                                            {saveMessage && (
                                                <div style={{ color: 'var(--qa-jade)', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                                    ✓ {saveMessage}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={handleExecuteApi}
                                                    disabled={isExecutingApi}
                                                    className="ws-btn-primary"
                                                    style={{ height: '36px', padding: '0 1.5rem', fontWeight: 600, background: '#0284C7' }}
                                                >
                                                    {isExecutingApi ? 'Executing HTTP Request...' : 'Dispatch Live API Call'}
                                                </button>
                                            </div>

                                            {/* Live API Response Display */}
                                            {apiResponse && (
                                                <div style={{ marginTop: '1rem', background: '#0B0F12', border: '1px solid var(--qa-border)', borderRadius: '6px', padding: '1rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                background: apiResponse.status < 400 ? 'rgba(139, 175, 154, 0.2)' : 'rgba(224, 108, 117, 0.2)',
                                                                color: apiResponse.status < 400 ? 'var(--qa-jade)' : 'var(--qa-fail)'
                                                            }}>
                                                                HTTP {apiResponse.status} {apiResponse.statusText}
                                                            </span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--qa-text-dim)' }}>
                                                                Latency: <strong>{apiResponse.durationMs}ms</strong>
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Assertions report */}
                                                    {Array.isArray(apiResponse.assertions) && apiResponse.assertions.length > 0 && (
                                                        <div style={{ marginBottom: '0.75rem' }}>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--qa-text-dim)', marginBottom: '0.25rem', fontWeight: 600 }}>
                                                                Assertions:
                                                            </div>
                                                            {apiResponse.assertions.map((ass, i) => (
                                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: ass.passed ? 'var(--qa-jade)' : 'var(--qa-fail)' }}>
                                                                    {ass.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                                    <span>{ass.message || `${ass.type}: expected ${ass.expected}, received ${ass.actual}`}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Response body */}
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--qa-text-dim)', marginBottom: '0.25rem', fontWeight: 600 }}>
                                                            Response Payload:
                                                        </div>
                                                        <pre style={{
                                                            margin: 0,
                                                            padding: '0.75rem',
                                                            background: 'rgba(0,0,0,0.5)',
                                                            borderRadius: '4px',
                                                            fontSize: '0.72rem',
                                                            maxHeight: '180px',
                                                            overflowY: 'auto',
                                                            color: '#E2E8F0'
                                                        }}>
                                                            {typeof apiResponse.data === 'object' ? JSON.stringify(apiResponse.data, null, 2) : String(apiResponse.data || '')}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ─── 6. Historical Execution Attempts Timeline (Cross-Run Auditing) ─── */}
                                <div className="qa-section-block">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <h3 className="qa-section-title" style={{ margin: 0 }}>
                                            <span>Multiple Execution History</span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--qa-text-dim)', fontWeight: 400 }}>
                                                ({historicalAttempts.length > 0 ? historicalAttempts.length : attempts.length} total attempts across runs)
                                            </span>
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => loadCaseHistory(activeCase.testCaseId || activeCaseId)}
                                            disabled={isHistoryLoading}
                                            className="ws-btn-secondary"
                                            style={{ height: '24px', fontSize: '0.7rem', gap: '4px' }}
                                        >
                                            <RefreshCw size={11} className={isHistoryLoading ? 'animate-spin' : ''} />
                                            <span>Refresh History</span>
                                        </button>
                                    </div>

                                    <div className="qa-attempts-timeline">
                                        {(historicalAttempts.length > 0 ? historicalAttempts : attempts).map((att, idx) => (
                                            <div key={att.id || idx} className="qa-attempt-entry">
                                                <div className="qa-attempt-header">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <strong>Attempt #{att.attemptNumber || (idx + 1)}</strong>
                                                        <StatusBadge status={att.status} />
                                                        <span style={{ color: 'var(--qa-text-dim)', fontSize: '0.75rem' }}>
                                                            ({att.executorType || 'manual'})
                                                        </span>
                                                        {att.runName && (
                                                            <span style={{ fontSize: '0.72rem', color: '#94A3B8', border: '1px solid var(--qa-border)', borderRadius: '3px', padding: '1px 5px' }}>
                                                                {att.runName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span style={{ color: 'var(--qa-text-dim)', fontSize: '0.75rem' }}>
                                                        {new Date(att.executedAt || att.createdAt).toLocaleTimeString()} • {new Date(att.executedAt || att.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {Boolean(safeFormatValue(att.actualResult)) && (
                                                    <div style={{ fontSize: '0.82rem', color: 'var(--qa-text)', lineHeight: '1.4' }}>
                                                        {safeFormatValue(att.actualResult)}
                                                    </div>
                                                )}
                                                {Boolean(safeFormatValue(att.notes)) && (
                                                    <div style={{ fontSize: '0.76rem', color: 'var(--qa-text-muted)', fontStyle: 'italic' }}>
                                                        Note: {safeFormatValue(att.notes)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sticky Bottom Execution Action Footer */}
                        <div className="qa-sticky-execution-footer">
                                    <div className={`qa-autosave-indicator ${autosaveStatus}`}>
                                        <span className="qa-autosave-dot" />
                                        <span>
                                            {autosaveStatus === 'saving' ? 'Saving draft...' :
                                             autosaveStatus === 'unsaved' ? 'Unsaved changes' :
                                             autosaveStatus === 'error' ? 'Autosave error' :
                                             `Saved ${lastSavedTime ? 'at ' + lastSavedTime : ''}`}
                                        </span>
                                    </div>

                                    <div className="qa-footer-actions">
                                        <button
                                            type="button"
                                            onClick={handlePrevCase}
                                            className="ws-btn-secondary"
                                            style={{ height: '34px', fontSize: '0.78rem', gap: '4px' }}
                                            title="Navigate to previous test case (Alt+P)"
                                        >
                                            <ArrowLeft size={13} />
                                            <span>Previous (Alt+P)</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleSaveDraft}
                                            className="ws-btn-secondary"
                                            style={{ height: '34px', fontSize: '0.78rem', gap: '5px' }}
                                            title="Save in-progress draft without recording final completion"
                                        >
                                            <Save size={13} />
                                            <span>Save Draft</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleOpenCompletionModal}
                                            disabled={isSaving}
                                            className="ws-btn-primary"
                                            style={{ height: '34px', padding: '0 1.25rem', fontWeight: 600, fontSize: '0.8rem', gap: '6px' }}
                                        >
                                            <CheckCircle2 size={14} />
                                            <span>Complete Execution</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleNextCase}
                                            className="ws-btn-secondary"
                                            style={{ height: '34px', fontSize: '0.78rem', gap: '4px' }}
                                            title="Navigate to next test case (Alt+N)"
                                        >
                                            <span>Next (Alt+N)</span>
                                            <ChevronRight size={13} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--qa-text-dim)' }}>
                                Select a test case from the master navigation panel to view its details or record execution outcomes.
                            </div>
                        )}
                    </div>

                    {/* PANEL 3: Collapsible Context Panel (Metadata | Traceability | History | Defects) */}
                    <div className={`qa-context-panel ${isContextPanelCollapsed ? 'collapsed' : ''}`}>
                        {isContextPanelCollapsed ? (
                            <div className="qa-context-collapsed-rail">
                                <button
                                    type="button"
                                    className="qa-context-collapse-btn"
                                    onClick={() => setIsContextPanelCollapsed(false)}
                                    title="Expand Context Panel"
                                >
                                    <PanelRightOpen size={16} />
                                </button>
                                <span className="qa-context-rail-text" onClick={() => setIsContextPanelCollapsed(false)}>
                                    Context &amp; Traceability
                                </span>
                            </div>
                        ) : (
                            <>
                                <div className="qa-context-panel-header">
                                    <h4 className="qa-context-title">
                                        <Shield size={14} style={{ color: 'var(--qa-jade)' }} />
                                        <span>Execution Context</span>
                                    </h4>
                                    <button
                                        type="button"
                                        className="qa-context-collapse-btn"
                                        onClick={() => setIsContextPanelCollapsed(true)}
                                        title="Collapse Context Panel"
                                    >
                                        <PanelRightClose size={15} />
                                    </button>
                                </div>

                                <div className="qa-context-tabs">
                                    <button
                                        type="button"
                                        className={`qa-context-tab-btn ${contextActiveTab === 'metadata' ? 'active' : ''}`}
                                        onClick={() => setContextActiveTab('metadata')}
                                    >
                                        <FileText size={12} />
                                        <span>Metadata</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`qa-context-tab-btn ${contextActiveTab === 'requirements' ? 'active' : ''}`}
                                        onClick={() => setContextActiveTab('requirements')}
                                    >
                                        <Layers size={12} />
                                        <span>Traceability</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`qa-context-tab-btn ${contextActiveTab === 'history' ? 'active' : ''}`}
                                        onClick={() => setContextActiveTab('history')}
                                    >
                                        <History size={12} />
                                        <span>History</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`qa-context-tab-btn ${contextActiveTab === 'defects' ? 'active' : ''}`}
                                        onClick={() => setContextActiveTab('defects')}
                                    >
                                        <Bug size={12} />
                                        <span>Defects ({caseDefects.length})</span>
                                    </button>
                                </div>

                                <div className="qa-context-body">
                                    {contextActiveTab === 'metadata' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <div className="qa-context-meta-row">
                                                <span className="qa-context-meta-label">Run ID</span>
                                                <span className="qa-context-meta-val" style={{ fontFamily: 'monospace' }}>{run.id?.slice(0, 10)}...</span>
                                            </div>
                                            <div className="qa-context-meta-row">
                                                <span className="qa-context-meta-label">Environment</span>
                                                <span className="qa-context-meta-val">{formatEnvironmentName(run.targetEnvironment)}</span>
                                            </div>
                                            <div className="qa-context-meta-row">
                                                <span className="qa-context-meta-label">Assigned Tester</span>
                                                <span className="qa-context-meta-val">{formatAssignedTester(run.assignedTo)}</span>
                                            </div>
                                            <div className="qa-context-meta-row">
                                                <span className="qa-context-meta-label">Suite Version</span>
                                                <span className="qa-context-meta-val">{run.suiteVersion ? `v${run.suiteVersion}` : '1.0.0'}</span>
                                            </div>
                                            <div className="qa-context-meta-row">
                                                <span className="qa-context-meta-label">Execution Type</span>
                                                <span className="qa-context-meta-val" style={{ textTransform: 'capitalize' }}>{activeCase?.executionType || run.executionType || 'manual'}</span>
                                            </div>
                                            <div className="qa-context-meta-row">
                                                <span className="qa-context-meta-label">Current Attempt</span>
                                                <span className="qa-context-meta-val">#{activeCase?.currentAttempt || 1}</span>
                                            </div>
                                            <div className="qa-context-meta-row">
                                                <span className="qa-context-meta-label">Last Executed</span>
                                                <span className="qa-context-meta-val">{activeCase?.executedAt ? new Date(activeCase.executedAt).toLocaleString() : 'Not Yet Executed'}</span>
                                            </div>
                                        </div>
                                    )}

                                    {contextActiveTab === 'requirements' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--qa-text-dim)' }}>
                                                Requirements linked to this test scenario:
                                            </div>
                                            {(() => {
                                                const reqs = snapshot.requirements || snapshot.linkedRequirements || (snapshot.requirementId ? [{ id: snapshot.requirementId, title: snapshot.requirementTitle || 'Linked Requirement' }] : []);
                                                if (reqs.length === 0) {
                                                    return (
                                                        <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', color: 'var(--qa-text-dim)', fontSize: '0.75rem' }}>
                                                            No specific requirements linked. Test scenario covers module: <strong>{safeFormatValue(snapshot.module, 'Core')}</strong>
                                                        </div>
                                                    );
                                                }
                                                return reqs.map((r, i) => (
                                                    <div key={i} style={{ padding: '0.6rem 0.75rem', background: 'var(--qa-surface-elevated)', border: '1px solid var(--qa-border-subtle)', borderRadius: '5px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--qa-jade)', fontFamily: 'monospace' }}>
                                                                {typeof r === 'object' ? (r.code || r.id || `REQ-${i + 1}`) : `REQ-${r}`}
                                                            </span>
                                                            <StatusBadge status={activeCase?.status || 'not_run'} />
                                                        </div>
                                                        <div style={{ fontSize: '0.78rem', color: 'var(--qa-text)' }}>
                                                            {typeof r === 'object' ? (r.title || r.name || 'Acceptance Criteria') : String(r)}
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    )}

                                    {contextActiveTab === 'history' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--qa-text-dim)' }}>
                                                    Past Executions ({historicalAttempts.length})
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => loadCaseHistory(activeCase?.testCaseId || activeCaseId)}
                                                    className="ws-btn-secondary"
                                                    style={{ height: '22px', fontSize: '0.68rem', padding: '0 6px' }}
                                                >
                                                    <RefreshCw size={10} className={isHistoryLoading ? 'animate-spin' : ''} />
                                                    <span>Refresh</span>
                                                </button>
                                            </div>
                                            {historicalAttempts.length === 0 ? (
                                                <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', color: 'var(--qa-text-dim)', fontSize: '0.75rem' }}>
                                                    No prior execution history for this test case.
                                                </div>
                                            ) : (
                                                historicalAttempts.map((att, idx) => (
                                                    <div key={att.id || idx} className="qa-attempt-entry" style={{ padding: '0.5rem 0.65rem' }}>
                                                        <div className="qa-attempt-header">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <strong style={{ fontSize: '0.75rem' }}>#{att.attemptNumber || idx + 1}</strong>
                                                                <StatusBadge status={att.status} />
                                                            </div>
                                                            <span style={{ fontSize: '0.68rem', color: 'var(--qa-text-dim)' }}>
                                                                {new Date(att.executedAt || att.createdAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        {Boolean(safeFormatValue(att.actualResult)) && (
                                                            <div style={{ fontSize: '0.74rem', color: 'var(--qa-text)', lineHeight: '1.3' }}>
                                                                {safeFormatValue(att.actualResult)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {contextActiveTab === 'defects' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--qa-text-dim)' }}>
                                                    Logged Defects ({caseDefects.length})
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDefectModal(null)}
                                                    className="ws-btn-primary"
                                                    style={{ height: '22px', fontSize: '0.68rem', padding: '0 8px', gap: '4px' }}
                                                >
                                                    <Bug size={11} />
                                                    <span>Log Defect</span>
                                                </button>
                                            </div>

                                            {caseDefects.length === 0 ? (
                                                <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', color: 'var(--qa-text-dim)', fontSize: '0.75rem' }}>
                                                    No defects logged for this test case yet.
                                                </div>
                                            ) : (
                                                caseDefects.map((def) => (
                                                    <div key={def.id} className="qa-defect-card">
                                                        <div className="qa-defect-meta">
                                                            <span className={`qa-defect-sev-badge ${def.severity || 'high'}`}>
                                                                {def.severity || 'high'}
                                                            </span>
                                                            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--qa-warn)' }}>
                                                                {def.status || 'open'}
                                                            </span>
                                                        </div>
                                                        <div className="qa-defect-title">{safeFormatValue(def.title, 'Untitled Defect')}</div>
                                                        {def.stepNumber && (
                                                            <div style={{ fontSize: '0.68rem', color: 'var(--qa-text-dim)' }}>
                                                                Failed Step: {safeFormatValue(def.stepNumber)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Defect Quick-Log Modal */}
            <Modal
                isOpen={isDefectModalOpen}
                onClose={() => setIsDefectModalOpen(false)}
                title="Log Defect from Test Execution"
                size="md"
            >
                <form onSubmit={handleCreateDefect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: '#F2F3F3' }}>
                    <div>
                        <label className="qa-field-label">Defect Title *</label>
                        <input
                            type="text"
                            required
                            value={defectForm.title}
                            onChange={(e) => setDefectForm(prev => ({ ...prev, title: e.target.value }))}
                            className="qa-text-input"
                            style={{ height: '36px' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                            <label className="qa-field-label">Severity</label>
                            <select
                                value={defectForm.severity}
                                onChange={(e) => setDefectForm(prev => ({ ...prev, severity: e.target.value }))}
                                className="qa-text-input"
                                style={{ height: '36px' }}
                            >
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>

                        <div>
                            <label className="qa-field-label">Priority</label>
                            <select
                                value={defectForm.priority}
                                onChange={(e) => setDefectForm(prev => ({ ...prev, priority: e.target.value }))}
                                className="qa-text-input"
                                style={{ height: '36px' }}
                            >
                                <option value="P0">P0 (Blocker)</option>
                                <option value="P1">P1 (High)</option>
                                <option value="P2">P2 (Medium)</option>
                                <option value="P3">P3 (Low)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="qa-field-label">Description &amp; Steps to Reproduce *</label>
                        <textarea
                            rows={4}
                            required
                            value={defectForm.description}
                            onChange={(e) => setDefectForm(prev => ({ ...prev, description: e.target.value }))}
                            className="qa-textarea"
                        />
                    </div>

                    {screenshotName && (
                        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(139, 175, 154, 0.1)', border: '1px solid rgba(139, 175, 154, 0.3)', borderRadius: '4px', fontSize: '0.78rem', color: 'var(--qa-jade)' }}>
                            Attached Evidence: {screenshotName}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={() => setIsDefectModalOpen(false)}
                            className="ws-btn-secondary"
                            style={{ height: '34px' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmittingDefect}
                            className="ws-btn-primary"
                            style={{ height: '34px', padding: '0 1.25rem', gap: '5px' }}
                        >
                            <Bug size={13} />
                            <span>{isSubmittingDefect ? 'Logging Defect...' : 'Submit Defect'}</span>
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Execution Completion Breakdown Confirmation Modal */}
            <Modal
                isOpen={isCompletionModalOpen}
                onClose={() => setIsCompletionModalOpen(false)}
                title="Review & Confirm Test Execution"
                size="md"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: '#F2F3F3' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--qa-surface-elevated)', borderRadius: '6px', border: '1px solid var(--qa-border)' }}>
                        <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--qa-text-dim)', textTransform: 'uppercase' }}>Target Test Case</div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{safeFormatValue(activeCase?.testCaseId, 'TC')}: {safeFormatValue(snapshot.title, 'Untitled Test Case')}</div>
                        </div>
                        <StatusBadge status={completionBreakdown?.derivedStatus || formStatus} />
                    </div>

                    {/* Step Breakdown Cards */}
                    <div className="qa-breakdown-grid">
                        <div className="qa-breakdown-box">
                            <div className="qa-breakdown-num" style={{ color: 'var(--qa-text)' }}>{completionBreakdown?.total || 0}</div>
                            <div className="qa-breakdown-lbl">Total Steps</div>
                        </div>
                        <div className="qa-breakdown-box">
                            <div className="qa-breakdown-num" style={{ color: 'var(--qa-jade)' }}>{completionBreakdown?.passed || 0}</div>
                            <div className="qa-breakdown-lbl">Passed</div>
                        </div>
                        <div className="qa-breakdown-box">
                            <div className="qa-breakdown-num" style={{ color: 'var(--qa-fail)' }}>{completionBreakdown?.failed || 0}</div>
                            <div className="qa-breakdown-lbl">Failed</div>
                        </div>
                        <div className="qa-breakdown-box">
                            <div className="qa-breakdown-num" style={{ color: 'var(--qa-warn)' }}>{completionBreakdown?.pending || 0}</div>
                            <div className="qa-breakdown-lbl">Incomplete</div>
                        </div>
                    </div>

                    {/* Incomplete step constraint alert */}
                    {completionBreakdown?.pending > 0 && formStatus === 'passed' && (
                        <div style={{ padding: '0.75rem', background: 'rgba(229, 192, 123, 0.15)', border: '1px solid rgba(229, 192, 123, 0.4)', borderRadius: '6px', color: '#E5C07B', fontSize: '0.8rem', lineHeight: '1.4' }}>
                            <strong>Incomplete Verification Alert:</strong> {completionBreakdown.pending} step(s) have not been evaluated. According to TestNexa QA guidelines, a test case cannot be marked Passed while steps remain unverified.
                            <div style={{ marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleMarkAllStepsPassed();
                                        handleConfirmCompletion('passed');
                                    }}
                                    className="ws-btn-secondary"
                                    style={{ height: '28px', fontSize: '0.75rem', color: 'var(--qa-jade)' }}
                                >
                                    Mark Remaining Steps Passed &amp; Complete
                                </button>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="qa-field-label">Actual Result Summary</label>
                        <div style={{ fontSize: '0.82rem', padding: '0.6rem 0.75rem', background: 'var(--qa-surface)', border: '1px solid var(--qa-border)', borderRadius: '4px', color: 'var(--qa-text)' }}>
                            {actualResult || (completionBreakdown?.derivedStatus === 'passed' ? 'All test steps verified successfully.' : 'Verification complete.')}
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={() => setIsCompletionModalOpen(false)}
                            className="ws-btn-secondary"
                            style={{ height: '34px' }}
                        >
                            Back to Review
                        </button>
                        <button
                            type="button"
                            onClick={() => handleConfirmCompletion()}
                            disabled={isSaving || (completionBreakdown?.pending > 0 && formStatus === 'passed')}
                            className="ws-btn-primary"
                            style={{ height: '34px', padding: '0 1.25rem', fontWeight: 600 }}
                        >
                            {isSaving ? 'Recording...' : 'Confirm & Record Execution'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Artifact Preview Modal */}
            {previewArtifact && (
                <Modal
                    isOpen={Boolean(previewArtifact)}
                    onClose={() => setPreviewArtifact(null)}
                    title={previewArtifact.name}
                    size="lg"
                    id="evidence-preview-dialog"
                >
                    <div className="evidence-inspector">
                        <div className="evidence-preview-stage">
                            {isPreviewLoading ? <div className="evidence-state">Loading artifact preview…</div> : previewError ? <div className="evidence-state evidence-state-error"><span className="evidence-state-title">Preview unavailable</span><span>{previewError}</span></div> : getEvidenceKind(previewArtifact) === 'trace' ? (
                                <div className="evidence-state"><span className="evidence-state-title">Trace viewer unavailable</span><span>This stored Playwright trace can be downloaded and opened with a compatible Playwright trace viewer.</span></div>
                            ) : previewBlobUrl && String(previewArtifact.mimeType || '').startsWith('image/') ? <img className="evidence-large-preview" src={previewBlobUrl} alt={previewArtifact.name} /> : previewBlobUrl && String(previewArtifact.mimeType || '').startsWith('video/') ? <video className="evidence-large-preview" src={previewBlobUrl} controls preload="metadata">Video playback is not supported by this browser.</video> : previewBlobUrl && getEvidenceKind(previewArtifact) === 'log' ? <pre className="evidence-log-preview">{previewText}</pre> : previewBlobUrl && previewArtifact.mimeType === 'application/pdf' ? <iframe className="evidence-pdf-preview" src={previewBlobUrl} title={`Preview ${previewArtifact.name}`} /> : previewBlobUrl ? <div className="evidence-state"><span className="evidence-state-title">Preview not supported</span><span>This file type can still be downloaded for inspection.</span></div> : null}
                        </div>
                        <dl className="evidence-inspector-meta">
                            <div><dt>File type</dt><dd>{previewArtifact.mimeType || previewArtifact.artifactType || 'Unknown'}</dd></div>
                            <div><dt>File size</dt><dd>{formatBytes(previewArtifact.sizeBytes)}</dd></div>
                            <div><dt>Test case</dt><dd>{evidenceById.get(previewArtifact.runCaseId)?.testCaseId || 'Run-level artifact'}</dd></div>
                            <div><dt>Run ID</dt><dd>{runId}</dd></div>
                            <div><dt>Execution timestamp</dt><dd>{evidenceById.get(previewArtifact.runCaseId)?.executedAt ? new Date(evidenceById.get(previewArtifact.runCaseId).executedAt).toLocaleString() : previewArtifact.createdAt ? new Date(previewArtifact.createdAt).toLocaleString() : 'Timestamp unavailable'}</dd></div>
                            <div><dt>Execution status</dt><dd>{evidenceById.get(previewArtifact.runCaseId)?.status || 'Not linked'}</dd></div>
                            <div><dt>Uploaded by</dt><dd>{previewArtifact.metadata?.uploader || 'Uploader not recorded'}</dd></div>
                        </dl>
                        <div className="evidence-inspector-actions">
                            {getEvidenceKind(previewArtifact) === 'log' && <button type="button" className="evidence-secondary-action" onClick={copyLogContent}><Copy size={14} /> Copy log contents</button>}
                            <button type="button" className="evidence-secondary-action" onClick={() => copyEvidenceReference(previewArtifact)}><Copy size={14} /> Copy file reference</button>
                            <button type="button" className="evidence-download" onClick={() => downloadEvidence(previewArtifact)}><Download size={14} /> Download</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Configure Playwright Script Modal */}
            <Modal
                isOpen={isMappingModalOpen}
                onClose={() => setIsMappingModalOpen(false)}
                title={`Configure Playwright Automation: ${activeCase?.testCaseId || ''}`}
                size="xl"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#F2F3F3' }}>
                    {/* Top Case Context Ribbon */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: '#161819',
                        borderRadius: '6px',
                        border: '1px solid #292D2D',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'rgba(139, 175, 154, 0.15)',
                                color: '#8BAF9A',
                                border: '1px solid rgba(139, 175, 154, 0.3)',
                                fontSize: '0.75rem',
                                fontWeight: 700
                            }}>
                                {safeFormatValue(activeCase?.testCaseId, 'TC')}
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F2F3F3' }}>
                                {safeFormatValue(activeCase?.caseSnapshot?.title, 'Selected Test Case')}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {activeCase?.caseSnapshot?.automationMapping?.version && (
                                <span style={{
                                    fontSize: '0.72rem',
                                    color: '#A0A5A5',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: '#1D2021',
                                    border: '1px solid #292D2D'
                                }}>
                                    Current Version: v{activeCase.caseSnapshot.automationMapping.version}
                                </span>
                            )}
                            {activeCase?.caseSnapshot?.automationMapping?.versionHistory?.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                                    className="ws-btn-secondary"
                                    style={{ height: '26px', fontSize: '0.72rem', padding: '0 8px' }}
                                >
                                    <Clock size={12} />
                                    <span>History ({activeCase.caseSnapshot.automationMapping.versionHistory.length})</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Method Tabs: A (Existing Playwright Test) vs B (Custom Automation Script) */}
                    <div>
                        <div style={{
                            display: 'flex',
                            borderBottom: '1px solid #292D2D',
                            gap: '1rem',
                            marginBottom: '1rem'
                        }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setConfigMethod('existing');
                                    setMappingForm(prev => ({ ...prev, scriptSource: 'existing' }));
                                }}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: configMethod === 'existing' ? '2px solid #8BAF9A' : '2px solid transparent',
                                    color: configMethod === 'existing' ? '#8BAF9A' : '#A0A5A5',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Bot size={15} />
                                <span>A. Existing Approved Playwright Test</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setConfigMethod('custom');
                                    setMappingForm(prev => ({ ...prev, scriptSource: 'custom' }));
                                }}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: configMethod === 'custom' ? '2px solid #8BAF9A' : '2px solid transparent',
                                    color: configMethod === 'custom' ? '#8BAF9A' : '#A0A5A5',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Code size={15} />
                                <span>B. Custom Automation Script</span>
                            </button>
                        </div>

                        {/* Method A: Existing Playwright Test from Repository Inventory */}
                        {configMethod === 'existing' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#F2F3F3', marginBottom: '4px' }}>
                                            Select Approved Test Suite Spec File:
                                        </label>
                                        <select
                                            value={selectedSuiteFile}
                                            onChange={e => {
                                                const file = e.target.value;
                                                setSelectedSuiteFile(file);
                                                const suite = inventorySuites.find(s => s.file === file);
                                                const firstTest = suite?.tests?.[0];
                                                if (firstTest) {
                                                    setSelectedTestId(firstTest.testId);
                                                    setMappingForm(prev => ({
                                                        ...prev,
                                                        scriptRef: `${file}#${firstTest.testId}`,
                                                        automationTestId: firstTest.testId,
                                                        scriptVersion: firstTest.version || suite.version,
                                                        scriptCode: firstTest.code || ''
                                                    }));
                                                }
                                            }}
                                            className="ws-input"
                                            style={{ height: '36px', fontSize: '0.82rem' }}
                                        >
                                            <option value="">-- Choose Approved Test Suite --</option>
                                            {inventorySuites.map(s => (
                                                <option key={s.file} value={s.file}>
                                                    {s.file} ({s.testsCount} tests)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#F2F3F3', marginBottom: '4px' }}>
                                            Select Playwright Test Identifier / Title:
                                        </label>
                                        <select
                                            value={selectedTestId}
                                            onChange={e => {
                                                const tId = e.target.value;
                                                setSelectedTestId(tId);
                                                const suite = inventorySuites.find(s => s.file === selectedSuiteFile);
                                                const testItem = suite?.tests?.find(t => t.testId === tId);
                                                if (testItem) {
                                                    setMappingForm(prev => ({
                                                        ...prev,
                                                        scriptRef: `${selectedSuiteFile}#${tId}`,
                                                        automationTestId: tId,
                                                        scriptVersion: testItem.version || suite?.version || '1.0.0',
                                                        scriptCode: testItem.code || ''
                                                    }));
                                                }
                                            }}
                                            className="ws-input"
                                            style={{ height: '36px', fontSize: '0.82rem' }}
                                            disabled={!selectedSuiteFile}
                                        >
                                            <option value="">-- Choose Test Identifier --</option>
                                            {(inventorySuites.find(s => s.file === selectedSuiteFile)?.tests || []).map(t => (
                                                <option key={t.testId} value={t.testId}>
                                                    {t.testId} — {t.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {selectedSuiteFile && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.5rem 0.75rem',
                                        background: '#0E1011',
                                        borderRadius: '6px',
                                        border: '1px solid #292D2D',
                                        fontSize: '0.75rem',
                                        color: '#A0A5A5',
                                        flexWrap: 'wrap'
                                    }}>
                                        <span>Framework: <strong style={{ color: '#8BAF9A' }}>Playwright</strong></span>
                                        <span>•</span>
                                        <span>Suite Version: <strong style={{ color: '#F2F3F3' }}>{inventorySuites.find(s => s.file === selectedSuiteFile)?.version || '1.0.0'}</strong></span>
                                        <span>•</span>
                                        <span>Spec: <strong style={{ color: '#F2F3F3', fontFamily: 'monospace' }}>{selectedSuiteFile}</strong></span>
                                    </div>
                                )}

                                {/* Read-only code preview for existing test */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#A0A5A5', marginBottom: '4px' }}>
                                        Registered Spec Code Preview (Read-Only):
                                    </label>
                                    <pre style={{
                                        margin: 0,
                                        padding: '0.75rem',
                                        background: '#080909',
                                        border: '1px solid #292D2D',
                                        borderRadius: '6px',
                                        fontFamily: 'monospace',
                                        fontSize: '0.78rem',
                                        color: '#8BAF9A',
                                        maxHeight: '160px',
                                        overflowY: 'auto',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {mappingForm.scriptCode || '// Test code executes through repository spec runner.'}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* Method B: Custom Automation Script Editor */}
                        {configMethod === 'custom' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Scenario Template Generation Ribbon */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.75rem 1rem',
                                    background: '#161819',
                                    borderRadius: '6px',
                                    border: '1px solid #292D2D',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F2F3F3' }}>
                                            Scenario-Specific Template Generator
                                        </div>
                                        <div style={{ fontSize: '0.74rem', color: '#A0A5A5' }}>
                                            Translates steps, expected results, and test data into contextual Playwright assertions
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleGenerateScenarioTemplate}
                                        disabled={isGeneratingTemplate}
                                        className="ws-btn-secondary"
                                        style={{ height: '32px', fontSize: '0.78rem', gap: '6px', borderColor: '#8BAF9A', color: '#8BAF9A' }}
                                    >
                                        <Wand2 size={13} />
                                        <span>{isGeneratingTemplate ? 'Generating...' : 'Generate Scenario Template'}</span>
                                    </button>
                                </div>

                                {/* Template Warnings Banner */}
                                {templateWarnings.length > 0 && (
                                    <div style={{
                                        padding: '0.65rem 0.85rem',
                                        background: 'rgba(229, 192, 123, 0.1)',
                                        border: '1px solid rgba(229, 192, 123, 0.3)',
                                        borderRadius: '6px',
                                        fontSize: '0.78rem',
                                        color: '#E5C07B'
                                    }}>
                                        <div style={{ fontWeight: 600, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <AlertTriangle size={13} />
                                            <span>Configuration Warnings:</span>
                                        </div>
                                        <ul style={{ margin: '4px 0 0 1rem', padding: 0 }}>
                                            {templateWarnings.map((w, i) => <li key={i}>{safeFormatValue(w)}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {/* Code Editor Area */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '0.76rem', fontWeight: 600, color: '#F2F3F3' }}>
                                            Playwright Script Code (JavaScript):
                                        </label>
                                        <span style={{ fontSize: '0.72rem', color: '#A0A5A5' }}>
                                            Signature: <code>async (page, expect) =&gt; &#123; ... &#125;</code>
                                        </span>
                                    </div>

                                    <textarea
                                        value={mappingForm.scriptCode}
                                        onChange={e => setMappingForm({ ...mappingForm, scriptCode: e.target.value })}
                                        onKeyDown={e => {
                                            if (e.key === 'Tab') {
                                                e.preventDefault();
                                                const start = e.target.selectionStart;
                                                const end = e.target.selectionEnd;
                                                const val = mappingForm.scriptCode;
                                                const next = val.substring(0, start) + '  ' + val.substring(end);
                                                setMappingForm({ ...mappingForm, scriptCode: next });
                                                setTimeout(() => {
                                                    e.target.selectionStart = e.target.selectionEnd = start + 2;
                                                }, 0);
                                            }
                                        }}
                                        rows={10}
                                        className="ws-textarea"
                                        style={{
                                            width: '100%',
                                            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                            fontSize: '0.82rem',
                                            lineHeight: '1.45',
                                            background: '#080909',
                                            color: '#8BAF9A',
                                            padding: '0.75rem',
                                            border: '1px solid #292D2D',
                                            borderRadius: '6px'
                                        }}
                                        placeholder="// Enter async Playwright automation code here..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metadata & Configuration Fields Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '0.75rem',
                        padding: '1rem',
                        background: '#121415',
                        border: '1px solid #292D2D',
                        borderRadius: '6px'
                    }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A0A5A5', marginBottom: '3px' }}>
                                Test Case ID (Read-Only)
                            </label>
                            <input
                                type="text"
                                value={activeCase?.testCaseId || ''}
                                readOnly
                                disabled
                                className="ws-input"
                                style={{ height: '32px', fontSize: '0.8rem', background: '#0E1011', opacity: 0.85 }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A0A5A5', marginBottom: '3px' }}>
                                Automation Test ID *
                            </label>
                            <input
                                type="text"
                                value={mappingForm.automationTestId}
                                onChange={e => setMappingForm({ ...mappingForm, automationTestId: e.target.value })}
                                placeholder="e.g. checkout-express-shipping"
                                className="ws-input"
                                style={{ height: '32px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A0A5A5', marginBottom: '3px' }}>
                                Framework
                            </label>
                            <input
                                type="text"
                                value="Playwright"
                                readOnly
                                disabled
                                className="ws-input"
                                style={{ height: '32px', fontSize: '0.8rem', background: '#0E1011', opacity: 0.85 }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A0A5A5', marginBottom: '3px' }}>
                                Script Reference / File *
                            </label>
                            <input
                                type="text"
                                value={mappingForm.scriptRef}
                                onChange={e => setMappingForm({ ...mappingForm, scriptRef: e.target.value })}
                                placeholder="tests/e2e/checkout.spec.js#test-id"
                                className="ws-input"
                                style={{ height: '32px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A0A5A5', marginBottom: '3px' }}>
                                Script Version
                            </label>
                            <input
                                type="text"
                                value={mappingForm.scriptVersion}
                                onChange={e => setMappingForm({ ...mappingForm, scriptVersion: e.target.value })}
                                placeholder="1.0.0"
                                className="ws-input"
                                style={{ height: '32px', fontSize: '0.8rem' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A0A5A5', marginBottom: '3px' }}>
                                Target Environment
                            </label>
                            <input
                                type="text"
                                value={mappingForm.targetEnvironment}
                                onChange={e => setMappingForm({ ...mappingForm, targetEnvironment: e.target.value })}
                                placeholder="https://staging.example.com"
                                className="ws-input"
                                style={{ height: '32px', fontSize: '0.8rem' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A0A5A5', marginBottom: '3px' }}>
                                Execution Timeout (ms)
                            </label>
                            <input
                                type="number"
                                min={1000}
                                max={120000}
                                step={1000}
                                value={mappingForm.executionTimeout}
                                onChange={e => setMappingForm({ ...mappingForm, executionTimeout: e.target.value })}
                                className="ws-input"
                                style={{ height: '32px', fontSize: '0.8rem' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#A0A5A5', marginBottom: '3px' }}>
                                Mapping Status
                            </label>
                            <select
                                value={mappingForm.mappingStatus}
                                onChange={e => setMappingForm({ ...mappingForm, mappingStatus: e.target.value })}
                                className="ws-input"
                                style={{ height: '32px', fontSize: '0.8rem', fontWeight: 600 }}
                            >
                                <option value="draft">Draft</option>
                                <option value="validated">Validated</option>
                                <option value="enabled">Enabled</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </div>
                    </div>

                    {/* Validation Feedback Card */}
                    {validationResult && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '6px',
                            background: validationResult.valid ? 'rgba(139, 175, 154, 0.12)' : 'rgba(224, 108, 117, 0.12)',
                            border: `1px solid ${validationResult.valid ? 'rgba(139, 175, 154, 0.3)' : 'rgba(224, 108, 117, 0.3)'}`,
                            fontSize: '0.8rem'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: 600,
                                color: validationResult.valid ? '#8BAF9A' : '#E06C75'
                            }}>
                                {validationResult.valid ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                <span>{validationResult.valid ? 'Script Configuration & Syntax Valid' : 'Script Validation Failed'}</span>
                            </div>

                            {validationResult.errors?.length > 0 && (
                                <ul style={{ margin: '6px 0 0 1.25rem', padding: 0, color: '#E06C75' }}>
                                    {validationResult.errors.map((e, idx) => <li key={idx}>{safeFormatValue(e)}</li>)}
                                </ul>
                            )}

                            {validationResult.warnings?.length > 0 && (
                                <ul style={{ margin: '6px 0 0 1.25rem', padding: 0, color: '#E5C07B' }}>
                                    {validationResult.warnings.map((w, idx) => <li key={idx}>{safeFormatValue(w)}</li>)}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Dry Run Test Result Card */}
                    {dryRunResult && (
                        <div style={{
                            padding: '0.85rem 1rem',
                            borderRadius: '6px',
                            background: '#161819',
                            border: '1px solid #292D2D',
                            fontSize: '0.8rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <StatusBadge status={dryRunResult.status} />
                                    <span style={{ fontSize: '0.78rem', color: '#A0A5A5' }}>
                                        Duration: <strong>{dryRunResult.durationMs}ms</strong>
                                    </span>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#8BAF9A', fontWeight: 600 }}>
                                    Headless Chromium Context
                                </span>
                            </div>

                            {dryRunResult.errorMessage && (
                                <div style={{ color: '#E06C75', fontFamily: 'monospace', fontSize: '0.76rem', marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                                    {dryRunResult.errorMessage}
                                </div>
                            )}

                            {dryRunResult.screenshotBase64 && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#A0A5A5', marginBottom: '4px' }}>
                                        Failure Screenshot Artifact:
                                    </span>
                                    <img
                                        src={`data:image/png;base64,${dryRunResult.screenshotBase64}`}
                                        alt="Dry run failure artifact"
                                        style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '4px', border: '1px solid #292D2D' }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Collapsible Version History Drawer */}
                    {showHistoryDrawer && activeCase?.caseSnapshot?.automationMapping?.versionHistory?.length > 0 && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            background: '#0D0E0F',
                            border: '1px solid #292D2D',
                            borderRadius: '6px'
                        }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', color: '#F2F3F3' }}>
                                Historical Mapping Versions
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '140px', overflowY: 'auto' }}>
                                {activeCase.caseSnapshot.automationMapping.versionHistory.map((h, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '4px 8px',
                                            background: '#161819',
                                            borderRadius: '4px',
                                            border: '1px solid #292D2D',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        <div>
                                            <span style={{ color: '#8BAF9A', fontWeight: 600, marginRight: '8px' }}>v{safeFormatValue(h.version, '1.0.0')}</span>
                                            <span style={{ color: '#A0A5A5' }}>{safeFormatValue(h.scriptRef || h.automationTestId, 'Default')}</span>
                                            <span style={{ color: '#777E7E', marginLeft: '8px' }}>({h.savedAt ? new Date(h.savedAt).toLocaleDateString() : 'Recent'})</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMappingForm(prev => ({
                                                    ...prev,
                                                    automationTestId: h.automationTestId || prev.automationTestId,
                                                    scriptRef: h.scriptRef || prev.scriptRef,
                                                    scriptCode: h.scriptCode || prev.scriptCode,
                                                    scriptVersion: h.scriptVersion || prev.scriptVersion
                                                }));
                                            }}
                                            className="ws-btn-secondary"
                                            style={{ height: '22px', fontSize: '0.7rem', padding: '0 6px' }}
                                        >
                                            Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Modal Bottom Actions */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid #292D2D',
                        paddingTop: '1rem',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={handleValidateScript}
                                disabled={isValidatingScript}
                                className="ws-btn-secondary"
                                style={{ height: '34px', fontSize: '0.8rem', gap: '6px' }}
                            >
                                <CheckCircle2 size={14} />
                                <span>{isValidatingScript ? 'Validating...' : 'Validate Script'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleDryRunScript}
                                disabled={isTestingScript || (!mappingForm.scriptCode && !mappingForm.scriptRef)}
                                className="ws-btn-secondary"
                                style={{ height: '34px', fontSize: '0.8rem', gap: '6px', borderColor: '#38BDF8', color: '#38BDF8' }}
                            >
                                <Play size={13} />
                                <span>{isTestingScript ? 'Running Dry Run...' : 'Run Test (Dry Run)'}</span>
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsMappingModalOpen(false)}
                                className="ws-btn-secondary"
                                style={{ height: '34px', fontSize: '0.82rem' }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveMapping}
                                disabled={isSavingMapping || !mappingForm.automationTestId}
                                className="ws-btn-primary"
                                style={{ height: '34px', fontSize: '0.82rem' }}
                            >
                                {isSavingMapping ? 'Saving...' : 'Save Mapping'}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Safe Run Cancel Modal */}
            <Modal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                title="Cancel Test Execution Run"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ color: '#F2F3F3', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                        Are you sure you want to cancel this test run? Any running Playwright browser sessions will be safely terminated and remaining cases will be marked as cancelled.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={() => setIsCancelModalOpen(false)}
                            className="ws-btn-secondary"
                        >
                            Keep Running
                        </button>
                        <button
                            type="button"
                            onClick={handleCancelRun}
                            className="ws-btn-primary"
                            style={{ background: '#E06C75', borderColor: '#E06C75' }}
                        >
                            Yes, Cancel Run
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Playwright Runner Console Drawer */}
            {isTerminalOpen && (
                <div style={{
                    marginTop: '1.5rem',
                    background: '#0B0C0E',
                    border: '1px solid #292D2D',
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 1rem',
                        background: '#121416',
                        borderBottom: '1px solid #222526'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Terminal size={14} style={{ color: '#38BDF8' }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F2F3F3' }}>
                                Playwright Runner Console
                            </span>
                            {activeJob && (
                                <span style={{
                                    padding: '1px 6px',
                                    borderRadius: '3px',
                                    fontSize: '0.7rem',
                                    background: activeJob.status === 'running' ? 'rgba(56,189,248,0.15)' : 'rgba(139,175,154,0.15)',
                                    color: activeJob.status === 'running' ? '#38BDF8' : '#8BAF9A',
                                    textTransform: 'uppercase'
                                }}>
                                    {activeJob.status}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsTerminalOpen(false)}
                            style={{ background: 'none', border: 'none', color: '#777E7E', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                            ✕ Close
                        </button>
                    </div>
                    <div style={{
                        padding: '0.85rem 1rem',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        lineHeight: '1.6',
                        color: '#A0A5A5'
                    }}>
                        <div>[Playwright Runner] Workspace: {run?.workspaceId || 'default'} | Run: {run?.name}</div>
                        <div>[Environment] Adapter: Playwright Headless Chromium | Target: {run?.targetEnvironment?.name || 'Default Staging'}</div>
                        {activeJob ? (
                            <>
                                <div>[Job ID] {activeJob.id} - Status: {activeJob.status}</div>
                                <div>[Progress] {activeJob.completedCases || 0} / {activeJob.totalCases || 0} automated cases evaluated</div>
                                {Array.isArray(activeJob.logs) && activeJob.logs.map((log, lIdx) => (
                                    <div key={lIdx} style={{ color: log.includes('ERR') || log.includes('fail') ? '#E06C75' : '#8BAF9A' }}>
                                        {log}
                                    </div>
                                ))}
                                {activeJob.status === 'running' && (
                                    <div style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                        <RefreshCw size={12} className="animate-spin" />
                                        <span>Worker active... executing tests in headless browser</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ color: '#777E7E' }}>No active or previous runner jobs recorded for this test run.</div>
                        )}
                    </div>
                </div>
            )}
            {isRerunModalOpen && (
                <RerunModal
                    isOpen={isRerunModalOpen}
                    originalRun={run}
                    runCases={cases}
                    onClose={() => setIsRerunModalOpen(false)}
                    onRerunCreated={(newRunData) => {
                        setIsRerunModalOpen(false);
                        navigate(`/app/runs/${newRunData.newRunId}`);
                    }}
                />
            )}

            {isRerunHistoryOpen && (
                <RerunHistoryDrawer
                    isOpen={isRerunHistoryOpen}
                    runId={runId}
                    onClose={() => setIsRerunHistoryOpen(false)}
                    onOpenComparison={(targetRerunId) => {
                        setIsRerunHistoryOpen(false);
                        navigate(`/app/runs/${targetRerunId}/compare`);
                    }}
                />
            )}

            {/* Coming Soon Modal for Automation Capabilities */}
            <ComingSoonModal
                isOpen={Boolean(comingSoonMethod)}
                onClose={() => setComingSoonMethod(null)}
                method={comingSoonMethod}
            />
        </div>
    );
};

export default RunExecutionPage;

