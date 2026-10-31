import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation, NavLink } from 'react-router-dom';
import {
    ArrowLeft, Play, RefreshCw, CheckCircle2, XCircle,
    AlertTriangle, MinusCircle, Clock, Shield, User, Bot,
    Terminal, FileText, Camera, Upload, Trash2,
    ChevronRight, ChevronDown, Check, AlertCircle, StopCircle, Eye, Download, Copy,
    Wand2, RotateCcw, Edit3, Code, Layers, GitCompare, Search
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../../components/loading';
import Modal from '../../components/ui/Modal';
import RunReportView from '../../components/execution/RunReportView';
import RunComparisonView from '../../components/execution/RunComparisonView';
import '../../styles/app/WorkspaceDesignSystem.css';
import '../../styles/app/RunWorkspace.css';
import '../../styles/app/ArtifactEvidence.css';

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
    const s = (status || 'not_run').toLowerCase();
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
    }[s] || { label: status, bg: '#161819', color: '#F2F3F3', border: '#292D2D' };

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
            {config.label}
        </span>
    );
};

const PriorityBadge = ({ priority }) => {
    const p = (priority || 'medium').toLowerCase();
    const className = ['critical', 'high', 'medium', 'low'].includes(p) ? p : 'medium';
    return (
        <span className={`qa-priority-pill ${className}`}>
            {priority || 'Medium'}
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
        return val.map(v => typeof v === 'object' ? (v.description || v.text || v.step || v.action || JSON.stringify(v)) : String(v)).join(', ');
    }
    if (typeof val === 'object') {
        return val.description || val.text || val.name || JSON.stringify(val);
    }
    return String(val);
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

    // Active Automation Job Polling state
    const [activeJob, setActiveJob] = useState(null);
    const [isTriggeringAuto, setIsTriggeringAuto] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab); // 'cases' | 'report' | 'compare' | 'artifacts'
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
                    screenshotName
                }
            }));
        }
        setActiveCaseId(newCaseId);
        setIsMobileDetailOpen(true);
    };

    // Fetch active case details and attempt history when activeCaseId changes
    useEffect(() => {
        if (!runId || !activeCaseId) return;

        let isCurrent = true;
        const fetchDetails = async () => {
            try {
                const res = await executionService.getRunCase(runId, activeCaseId);
                if (isCurrent && res.success && res.data) {
                    setActiveCaseDetails(res.data);
                    const draft = caseDrafts[activeCaseId];
                    if (draft) {
                        setFormStatus(draft.formStatus || (res.data.status !== 'not_run' ? res.data.status : 'passed'));
                        setActualResult(draft.actualResult ?? res.data.actualResult ?? '');
                        setNotes(draft.notes ?? res.data.notes ?? '');
                        setScreenshotData(draft.screenshotData || null);
                        setScreenshotName(draft.screenshotName || '');
                    } else {
                        setActualResult(res.data.actualResult || '');
                        setNotes(res.data.notes || '');
                        setFormStatus(res.data.status !== 'not_run' ? res.data.status : 'passed');
                        setScreenshotData(null);
                        setScreenshotName('');
                    }
                    setSaveMessage(null);
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
        };
        reader.readAsDataURL(file);
    };

    // Save manual execution attempt
    const handleSaveExecution = async () => {
        if (!activeCaseId) return;

        setIsSaving(true);
        setSaveMessage(null);

        try {
            const payload = {
                status: formStatus,
                actualResult: actualResult.trim(),
                notes: notes.trim(),
                durationMs: 3000,
                executorType: 'manual',
                artifact: screenshotData ? {
                    name: screenshotName || `evidence_${activeCaseId}.png`,
                    data: screenshotData,
                    mimeType: 'image/png'
                } : null
            };

            const res = await executionService.recordExecution(runId, activeCaseId, payload);
            if (res.success) {
                setSaveMessage('Execution attempt recorded successfully.');
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
            }
        } catch (err) {
            alert(`Execution recording failed: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Trigger Playwright Automated Execution
    const handleTriggerAutomated = async () => {
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
                        <h1 className="qa-run-title">{run.name}</h1>
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
                            Environment: <strong>{run.targetEnvironment?.name || 'Default Staging'}</strong>
                            {run.targetEnvironment?.baseUrl && <span style={{ color: 'var(--qa-text-dim)', marginLeft: '4px' }}>({run.targetEnvironment.baseUrl})</span>}
                        </span>
                        <span style={{ color: 'var(--qa-text-dim)' }}>•</span>
                        <span className="qa-header-meta-item">
                            Suite: <strong>{run.suiteTitle || run.suiteName || 'Test Suite'}</strong> (v{run.suiteVersion || 1})
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
                            onClick={handleRerunFailed}
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
                            title="Rerun only failed test cases with Playwright"
                        >
                            <RotateCcw size={14} className={isRerunningFailed ? 'animate-spin' : ''} />
                            <span>{isRerunningFailed ? 'Rerunning...' : `Rerun Failed (${sum.failed})`}</span>
                        </button>
                    )}

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
                <RunComparisonView
                    runId={runId}
                    currentRun={run}
                />
            ) : activeTab === 'artifacts' ? (
                /* TAB: ARTIFACTS & LOGS */
                <section className="evidence-browser">
                    <div className="evidence-heading">
                        <div>
                            <div className="evidence-breadcrumb"><NavLink to="/app/runs">Execution</NavLink><span>/</span><span>Artifacts &amp; Evidence</span></div>
                            <h2>{evidenceSuiteName || run.suiteName || run.suite?.name || run.suite?.title || 'Test suite'} <span className="evidence-run-number">Run {run.runNumber || run.run_number || String(run.id).slice(0, 8)}</span></h2>
                            <div className="evidence-run-meta"><StatusBadge status={run.status} /><span>{run.targetEnvironment?.name || 'Environment not specified'}</span><span>{artifacts.length} {artifacts.length === 1 ? 'artifact' : 'artifacts'}</span></div>
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
                /* ─── 4. MAIN WORKSPACE: TWO-PANEL MASTER-DETAIL LAYOUT ─── */
                <div className="qa-master-detail-grid">
                    {/* LEFT PANEL: Master Case Navigator (32% width) */}
                    <div className={`qa-master-panel ${isMobileDetailOpen ? 'mobile-hidden' : ''}`}>
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
                                                                        {c.testCaseId}
                                                                    </span>
                                                                    <div className="qa-case-badges">
                                                                        <PriorityBadge priority={c.caseSnapshot?.priority} />
                                                                        <CaseMethodBadge c={c} />
                                                                        <StatusBadge status={c.status} />
                                                                    </div>
                                                                </div>
                                                                <div className="qa-case-title-text">
                                                                    {c.caseSnapshot?.title || 'Untitled Test Case'}
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
                    </div>

                    {/* RIGHT PANEL: Selected Case Detail Only (68% width) */}
                    <div className={`qa-detail-panel ${!isMobileDetailOpen ? 'mobile-hidden' : ''}`}>
                        {activeCase ? (
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
                                                {activeCase.testCaseId}
                                            </span>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--qa-text-muted)' }}>
                                                {snapshot.module || 'General'} • {snapshot.type || 'Functional'}
                                            </span>
                                            <PriorityBadge priority={snapshot.priority} />
                                            <CaseMethodBadge c={activeCase} />
                                            <StatusBadge status={activeCase.status} />
                                        </div>
                                        <span style={{ fontSize: '0.74rem', color: 'var(--qa-text-muted)' }}>
                                            Current: <strong>Attempt #{activeCase.currentAttempt || 1}</strong>
                                        </span>
                                    </div>
                                    <h2 className="qa-case-detail-title">{snapshot.title}</h2>
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

                                {/* ─── 4. Test Steps ─── */}
                                {Array.isArray(snapshot.steps) && snapshot.steps.length > 0 && (
                                    <div className="qa-section-block">
                                        <h3 className="qa-section-title">
                                            <span>Test Execution Steps</span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--qa-text-dim)', fontWeight: 400 }}>
                                                ({snapshot.steps.length} steps)
                                            </span>
                                        </h3>
                                        <div className="qa-steps-list">
                                            {snapshot.steps.map((st, idx) => (
                                                <div key={idx} className="qa-step-item">
                                                    <span className="qa-step-num">{idx + 1}</span>
                                                    <div className="qa-step-body">
                                                        <div>{safeFormatValue(typeof st === 'object' ? (st.action || st.step || st.description || st.text) : st)}</div>
                                                        {st && typeof st === 'object' && st.expected && (
                                                            <span className="qa-step-expected">↳ Expected: {safeFormatValue(st.expected)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ─── 5. Manual & Retest Execution Station ─── */}
                                <div className="qa-section-block">
                                    <h3 className="qa-section-title">
                                        <span>Record Execution Outcome</span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--qa-text-dim)', fontWeight: 400 }}>
                                            (Attempt #{activeCase.currentAttempt || 1})
                                        </span>
                                    </h3>

                                    <div className="qa-execution-station">
                                        {/* Status Selector */}
                                        <div className="qa-field-group">
                                            <span className="qa-field-label">Verification Outcome *</span>
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
                                                placeholder="Describe observed UI outcome, network status, assertion confirmation, or error messages..."
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

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                            <button
                                                type="button"
                                                onClick={handleSaveExecution}
                                                disabled={isSaving}
                                                className="ws-btn-primary"
                                                style={{ height: '36px', padding: '0 1.5rem', fontWeight: 600 }}
                                            >
                                                {isSaving ? 'Recording Execution...' : activeCase.status !== 'not_run' ? 'Log Retest Attempt' : 'Save Execution'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ─── 6. Historical Execution Attempts Timeline ─── */}
                                {attempts.length > 0 && (
                                    <div className="qa-section-block">
                                        <h3 className="qa-section-title">
                                            <span>Historical Execution Attempts</span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--qa-text-dim)', fontWeight: 400 }}>
                                                ({attempts.length} attempts recorded)
                                            </span>
                                        </h3>
                                        <div className="qa-attempts-timeline">
                                            {attempts.map(att => (
                                                <div key={att.id} className="qa-attempt-entry">
                                                    <div className="qa-attempt-header">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <strong>Attempt #{att.attemptNumber}</strong>
                                                            <StatusBadge status={att.status} />
                                                            <span style={{ color: 'var(--qa-text-dim)' }}>
                                                                ({att.executorType || 'manual'})
                                                            </span>
                                                        </div>
                                                        <span style={{ color: 'var(--qa-text-dim)' }}>
                                                            {new Date(att.executedAt || att.createdAt).toLocaleTimeString()} • {new Date(att.executedAt || att.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    {att.actualResult && (
                                                        <div style={{ fontSize: '0.82rem', color: 'var(--qa-text)', lineHeight: '1.4' }}>
                                                            {att.actualResult}
                                                        </div>
                                                    )}
                                                    {att.notes && (
                                                        <div style={{ fontSize: '0.76rem', color: 'var(--qa-text-muted)', fontStyle: 'italic' }}>
                                                            Note: {att.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--qa-text-dim)' }}>
                                Select a test case from the master navigation panel to view its details or record execution outcomes.
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                                {activeCase?.testCaseId}
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F2F3F3' }}>
                                {activeCase?.caseSnapshot?.title || 'Selected Test Case'}
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
                                            {templateWarnings.map((w, i) => <li key={i}>{w}</li>)}
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
                                    {validationResult.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                                </ul>
                            )}

                            {validationResult.warnings?.length > 0 && (
                                <ul style={{ margin: '6px 0 0 1.25rem', padding: 0, color: '#E5C07B' }}>
                                    {validationResult.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
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
                                            <span style={{ color: '#8BAF9A', fontWeight: 600, marginRight: '8px' }}>v{h.version}</span>
                                            <span style={{ color: '#A0A5A5' }}>{h.scriptRef || h.automationTestId}</span>
                                            <span style={{ color: '#777E7E', marginLeft: '8px' }}>({new Date(h.savedAt).toLocaleDateString()})</span>
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
        </div>
    );
};

export default RunExecutionPage;

