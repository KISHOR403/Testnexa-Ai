import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X, CheckCircle2, XCircle, AlertTriangle, MinusCircle, Clock,
    Camera, User, Globe, AlertCircle, FileText, Save, RotateCcw,
    Upload, Trash2, ShieldCheck, Check, Layers, Paperclip, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { workspaceService } from '../../services/workspaceService';
import '../../styles/app/ManualExecution.css';

/**
 * Robust step normalizer that deduplicates and standardizes steps
 * from diverse test case representations (strings, objects, arrays).
 */
const normalizeSteps = (testCase) => {
    if (!testCase) return [];
    const source = testCase.steps || testCase.testSteps || testCase.raw?.steps || [];
    const rawList = Array.isArray(source) ? source : [source];
    const seen = new Set();
    const result = [];

    rawList.forEach((raw, idx) => {
        if (!raw) return;
        let action = '';
        let expected = '';
        let testData = '';

        if (typeof raw === 'string') {
            action = raw.trim();
        } else if (typeof raw === 'object') {
            action = raw.action || raw.step || raw.description || raw.text || raw.title || '';
            expected = raw.expectedResult || raw.expected || raw.result || '';
            testData = raw.testData || raw.data || raw.input || '';
        }

        const normAction = action.trim();
        const normExpected = expected.trim();
        const normData = testData.trim();

        if (!normAction && !normExpected) return;

        // Fingerprint to avoid rendering duplicate identical steps
        const fingerprint = `${normAction.toLowerCase()}|${normExpected.toLowerCase()}|${normData.toLowerCase()}`;
        if (seen.has(fingerprint)) return;
        seen.add(fingerprint);

        result.push({
            id: `step_${idx + 1}`,
            stepNumber: result.length + 1,
            action: normAction || `Step ${result.length + 1}`,
            expectedResult: normExpected,
            testData: normData
        });
    });

    return result;
};

const formatSeconds = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const ManualExecutionModal = ({
    isOpen = true,
    onClose,
    testCase,
    onRecord,
    onSave,
    onSaveDraft,
    isRecording = false
}) => {
    const recordHandler = onRecord || onSave;
    const { user } = useAuth();
    const fileInputRef = useRef(null);

    // Normalized, deduplicated steps
    const steps = useMemo(() => normalizeSteps(testCase), [testCase]);

    // Step-level outcomes and observations
    const [stepOutcomes, setStepOutcomes] = useState({});
    const [stepObservations, setStepObservations] = useState({});

    // Overall actual result & notes
    const [actualResult, setActualResult] = useState('');
    const [notes, setNotes] = useState('');

    // Environments & selection
    const [environments, setEnvironments] = useState([]);
    const [selectedEnvId, setSelectedEnvId] = useState('');

    // Evidence & attachments
    const [evidence, setEvidence] = useState(null);
    const [evidenceTargetStep, setEvidenceTargetStep] = useState('overall');

    // UI Feedback & Draft State
    const [validationError, setValidationError] = useState('');
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [draftSavedAt, setDraftSavedAt] = useState(null);
    const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
    const [draftNotice, setDraftNotice] = useState('');

    // Live Execution Timer
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const timerRef = useRef(null);

    // Unique storage key for local draft persistence
    const draftStorageKey = useMemo(() => {
        if (!testCase) return null;
        return `testnexa_draft_${testCase.suiteId || 'def'}_${testCase.id || 'tc'}`;
    }, [testCase]);

    // Start timer on mount
    useEffect(() => {
        if (!isOpen) return;
        timerRef.current = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isOpen]);

    // Load available workspace environments
    useEffect(() => {
        let mounted = true;
        const loadEnvs = async () => {
            try {
                const res = await workspaceService.getEnvironments();
                if (mounted && Array.isArray(res?.data) && res.data.length > 0) {
                    setEnvironments(res.data);
                    if (!selectedEnvId) setSelectedEnvId(res.data[0].id);
                }
            } catch {
                // Fallback: Default Staging
            }
        };
        if (isOpen) {
            loadEnvs();
        }
        return () => { mounted = false; };
    }, [isOpen]);

    // Initialize or restore draft state when testCase opens
    useEffect(() => {
        if (!isOpen || !testCase) return;

        // Initial default: all steps 'not_run'
        const initialOutcomes = {};
        const initialObservations = {};
        steps.forEach((st, idx) => {
            initialOutcomes[idx] = 'not_run';
            initialObservations[idx] = '';
        });

        // 1. Check for draft in localStorage or testCase snapshot
        let restored = false;
        try {
            const rawDraft = draftStorageKey ? localStorage.getItem(draftStorageKey) : null;
            const draftData = rawDraft ? JSON.parse(rawDraft) : (testCase.draftState || null);

            if (draftData && typeof draftData === 'object') {
                if (draftData.stepOutcomes && Object.keys(draftData.stepOutcomes).length > 0) {
                    setStepOutcomes({ ...initialOutcomes, ...draftData.stepOutcomes });
                } else {
                    setStepOutcomes(initialOutcomes);
                }

                if (draftData.stepObservations) {
                    setStepObservations({ ...initialObservations, ...draftData.stepObservations });
                }

                if (draftData.actualResult) setActualResult(draftData.actualResult);
                if (draftData.notes) setNotes(draftData.notes);
                if (draftData.environmentId) setSelectedEnvId(draftData.environmentId);
                if (draftData.evidence) setEvidence(draftData.evidence);
                if (draftData.durationMs) setElapsedSeconds(Math.floor(draftData.durationMs / 1000));

                const timestamp = draftData.savedAt ? new Date(draftData.savedAt).toLocaleTimeString() : 'earlier session';
                setDraftNotice(`Restored in-progress draft from ${timestamp}.`);
                setHasRestoredDraft(true);
                restored = true;
            }
        } catch (err) {
            console.warn('Could not parse execution draft:', err);
        }

        if (!restored) {
            setStepOutcomes(initialOutcomes);
            setStepObservations(initialObservations);
            setActualResult('');
            setNotes('');
            setEvidence(null);
            setElapsedSeconds(0);
            setDraftNotice('');
            setHasRestoredDraft(false);
        }

        setValidationError('');
    }, [isOpen, testCase, steps, draftStorageKey]);

    // Handle step outcome toggle
    const handleStepOutcome = (stepIndex, outcome) => {
        setStepOutcomes(prev => ({
            ...prev,
            [stepIndex]: outcome
        }));
        setValidationError('');
    };

    // Handle step observation change
    const handleStepObservation = (stepIndex, text) => {
        setStepObservations(prev => ({
            ...prev,
            [stepIndex]: text
        }));
    };

    // Calculate live step statistics
    const metrics = useMemo(() => {
        const total = steps.length;
        const outcomeValues = Object.values(stepOutcomes);

        const passed = outcomeValues.filter(o => o === 'passed').length;
        const failed = outcomeValues.filter(o => o === 'failed').length;
        const blocked = outcomeValues.filter(o => o === 'blocked').length;
        const skipped = outcomeValues.filter(o => o === 'skipped').length;
        const notRun = total - (passed + failed + blocked + skipped);

        const completionPct = total > 0 ? Math.round(((total - Math.max(0, notRun)) / total) * 100) : 0;

        // Auto-computed overall outcome rule
        let computedOutcome = 'not_run';
        let outcomeLabel = 'Not Run';

        if (failed > 0) {
            computedOutcome = 'failed';
            outcomeLabel = 'Failed';
        } else if (blocked > 0) {
            computedOutcome = 'blocked';
            outcomeLabel = 'Blocked';
        } else if (total > 0 && passed === total) {
            computedOutcome = 'passed';
            outcomeLabel = 'Passed';
        } else if (total > 0 && skipped === total) {
            computedOutcome = 'skipped';
            outcomeLabel = 'Skipped';
        } else if (passed > 0 || skipped > 0 || failed > 0 || blocked > 0) {
            computedOutcome = 'in_progress';
            outcomeLabel = 'In Progress';
        } else if (total === 0) {
            computedOutcome = 'passed';
            outcomeLabel = 'Passed';
        }

        return {
            total,
            passed,
            failed,
            blocked,
            skipped,
            notRun: Math.max(0, notRun),
            completionPct,
            computedOutcome,
            outcomeLabel
        };
    }, [steps, stepOutcomes]);

    // Evidence file selection
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // File size check: limit to 15MB
        if (file.size > 15 * 1024 * 1024) {
            setValidationError('File size exceeds the 15MB limit. Please upload a smaller artifact.');
            return;
        }

        const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'];
        if (!allowedMimes.includes(file.type)) {
            setValidationError('Unsupported file format. Please upload PNG, JPG, WebP, PDF or TXT.');
            return;
        }

        setValidationError('');
        const reader = new FileReader();
        reader.onload = (event) => {
            setEvidence({
                name: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
                data: event.target?.result,
                targetStep: evidenceTargetStep,
                uploadedAt: new Date().toISOString()
            });
        };
        reader.readAsDataURL(file);
    };

    // Remove attached evidence
    const handleRemoveEvidence = () => {
        setEvidence(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Save Draft
    const handleSaveDraft = async () => {
        setIsSavingDraft(true);
        setValidationError('');

        const draftPayload = {
            testCaseId: testCase.id,
            suiteId: testCase.suiteId,
            stepOutcomes,
            stepObservations,
            actualResult: actualResult.trim(),
            notes: notes.trim(),
            environmentId: selectedEnvId,
            evidence,
            durationMs: elapsedSeconds * 1000,
            savedAt: new Date().toISOString()
        };

        try {
            // 1. Save to backend if handler provided
            if (onSaveDraft) {
                await onSaveDraft(draftPayload);
            }

            // 2. Persist in localStorage as resilient cache
            if (draftStorageKey) {
                localStorage.setItem(draftStorageKey, JSON.stringify(draftPayload));
            }

            const nowTime = new Date().toLocaleTimeString();
            setDraftSavedAt(nowTime);
            setDraftNotice(`Draft saved at ${nowTime}. You can safely return later.`);
        } catch (err) {
            setValidationError(`Failed to save draft: ${err.message}`);
        } finally {
            setIsSavingDraft(false);
        }
    };

    // Discard Draft
    const handleDiscardDraft = () => {
        if (draftStorageKey) {
            localStorage.removeItem(draftStorageKey);
        }
        const initialOutcomes = {};
        const initialObservations = {};
        steps.forEach((_, idx) => {
            initialOutcomes[idx] = 'not_run';
            initialObservations[idx] = '';
        });
        setStepOutcomes(initialOutcomes);
        setStepObservations(initialObservations);
        setActualResult('');
        setNotes('');
        setEvidence(null);
        setElapsedSeconds(0);
        setHasRestoredDraft(false);
        setDraftNotice('');
    };

    // Reset all step outcomes to Not Run
    const handleResetAllSteps = () => {
        const resetOutcomes = {};
        steps.forEach((_, idx) => {
            resetOutcomes[idx] = 'not_run';
        });
        setStepOutcomes(resetOutcomes);
        setValidationError('');
    };

    // Submit Complete Execution
    const handleCompleteExecution = async (e) => {
        if (e) e.preventDefault();
        setValidationError('');

        const { total, notRun, failed, blocked, computedOutcome } = metrics;

        // 1. Validation: Cannot submit "Passed" if steps are still not run
        if (computedOutcome === 'passed' && notRun > 0 && total > 0) {
            setValidationError('Cannot complete as "Passed" while verification steps remain "Not Run". Please execute all steps or mark remaining as Blocked/Skipped.');
            return;
        }

        // 2. Validation: Cannot submit inconclusive outcome
        if (computedOutcome === 'not_run' || computedOutcome === 'in_progress') {
            setValidationError('Execution is still in progress. Please execute all verification steps before completing, or click "Save Draft" to resume later.');
            return;
        }

        // 3. Validation: If Failed, require failure explanation
        if (failed > 0) {
            const hasStepReason = Object.entries(stepOutcomes).some(([idx, st]) => st === 'failed' && Boolean(stepObservations[idx]?.trim()));
            const hasOverallReason = Boolean(actualResult.trim());
            if (!hasStepReason && !hasOverallReason) {
                setValidationError('A failure explanation is required. Please provide step-level failure observations or overall actual results explaining the defect.');
                return;
            }
        }

        // 4. Validation: If Blocked, require blocking impediment
        if (blocked > 0) {
            const hasBlockReason = Object.entries(stepOutcomes).some(([idx, st]) => st === 'blocked' && Boolean(stepObservations[idx]?.trim()));
            const hasOverallReason = Boolean(actualResult.trim());
            if (!hasBlockReason && !hasOverallReason) {
                setValidationError('A blocking reason is required. Please specify the dependency or impediment blocking step completion.');
                return;
            }
        }

        const selectedEnv = environments.find(e => e.id === selectedEnvId) || {
            id: selectedEnvId || 'default',
            name: 'Workspace Staging'
        };

        const finalPayload = {
            status: computedOutcome,
            outcome: computedOutcome,
            actualResult: actualResult.trim() || (computedOutcome === 'passed' ? 'All verification steps confirmed expected acceptance criteria.' : 'Execution completed.'),
            notes: notes.trim(),
            durationMs: Math.max(500, elapsedSeconds * 1000),
            stepOutcomes,
            stepObservations,
            environment: selectedEnv,
            executedBy: user?.displayName || user?.name || user?.email || 'Lead QA Engineer',
            artifact: evidence ? {
                name: evidence.name,
                data: evidence.data,
                mimeType: evidence.mimeType,
                sizeBytes: evidence.sizeBytes,
                targetStep: evidence.targetStep
            } : null
        };

        try {
            if (recordHandler) {
                await recordHandler(finalPayload);
            }

            // Clear persisted draft on successful execution completion
            if (draftStorageKey) {
                localStorage.removeItem(draftStorageKey);
            }

            onClose();
        } catch (err) {
            setValidationError(err.message || 'Execution recording failed on backend.');
        }
    };

    if (!isOpen || !testCase) return null;

    const preconditions = Array.isArray(testCase.preconditions)
        ? testCase.preconditions.join(', ')
        : String(testCase.preconditions || '');

    return createPortal(
        <div className="mx-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !isRecording && !isSavingDraft) onClose(); }}>
            <section
                className="mx-workspace"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mx-workspace-title"
            >
                {/* ─── 1. FIXED HEADER ──────────────────────────────────────────────── */}
                <header className="mx-header">
                    <div className="mx-header-top">
                        <div className="mx-header-title-block">
                            <span className="mx-eyebrow">
                                <Layers size={13} />
                                Manual Execution Workspace • {testCase.suiteName || 'Suite'}
                            </span>
                            <div className="mx-title-row">
                                <span className="mx-case-id-badge">{testCase.id}</span>
                                <h2 id="mx-workspace-title">{testCase.title}</h2>
                            </div>
                        </div>

                        <div className="mx-header-actions">
                            <div className="mx-timer-pill" title="Elapsed test execution duration">
                                <Clock size={13} color="#8BAF9A" />
                                <span>{formatSeconds(elapsedSeconds)}</span>
                            </div>

                            <button
                                type="button"
                                className="mx-close-btn"
                                onClick={onClose}
                                disabled={isRecording || isSavingDraft}
                                title="Close execution workspace"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="mx-header-meta">
                        <div className="mx-meta-item">
                            <Globe size={13} color="#8BAF9A" />
                            <span>Environment:</span>
                            <select
                                className="mx-meta-select"
                                value={selectedEnvId}
                                onChange={e => setSelectedEnvId(e.target.value)}
                            >
                                <option value="">Default Staging</option>
                                {environments.map(env => (
                                    <option key={env.id} value={env.id}>
                                        {env.name} {env.baseUrl ? `(${env.baseUrl})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mx-meta-item">
                            <User size={13} color="#8BAF9A" />
                            <span>Tester:</span>
                            <strong>{user?.displayName || user?.name || user?.email || 'QA Engineer'}</strong>
                        </div>

                        <div className="mx-meta-item">
                            <span>Priority:</span>
                            <strong>{testCase.priority || 'Medium'}</strong>
                        </div>

                        <div className="mx-meta-item">
                            <span>Type:</span>
                            <strong>{testCase.type || 'Functional'}</strong>
                        </div>

                        {testCase.requirementId && (
                            <div className="mx-meta-item">
                                <span>Requirement:</span>
                                <strong style={{ color: '#8BAF9A' }}>{testCase.requirementId}</strong>
                            </div>
                        )}
                    </div>
                </header>

                {/* ─── DRAFT RESTORATION BANNER ───────────────────────────────────────── */}
                {draftNotice && (
                    <div className="mx-draft-banner">
                        <div className="mx-draft-banner-left">
                            <Save size={14} />
                            <span>{draftNotice}</span>
                        </div>
                        {hasRestoredDraft && (
                            <button
                                type="button"
                                className="mx-draft-discard-btn"
                                onClick={handleDiscardDraft}
                                title="Discard saved draft and restart clean"
                            >
                                Discard Draft
                            </button>
                        )}
                    </div>
                )}

                {/* ─── 2. SCROLLABLE CONTENT BODY ────────────────────────────────────── */}
                <div className="mx-body">
                    {/* Preconditions & Expected Result */}
                    {(preconditions || testCase.expectedResult) && (
                        <div className="mx-context-grid">
                            {preconditions && (
                                <div className="mx-context-box">
                                    <span className="mx-context-label">
                                        <ShieldCheck size={12} /> Preconditions
                                    </span>
                                    <span className="mx-context-val">{preconditions}</span>
                                </div>
                            )}
                            {testCase.expectedResult && (
                                <div className="mx-context-box expected">
                                    <span className="mx-context-label">
                                        <Check size={12} /> Overall Expected Result
                                    </span>
                                    <span className="mx-context-val">{testCase.expectedResult}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── 3. LIVE EXECUTION SUMMARY BAR ─────────────────────────────── */}
                    <div className="mx-summary-bar">
                        <div className="mx-summary-row">
                            <div className="mx-metrics-pills">
                                <span className="mx-metric-pill">
                                    Steps: <strong>{metrics.total}</strong>
                                </span>
                                <span className="mx-metric-pill pass">
                                    ✓ {metrics.passed} Pass
                                </span>
                                <span className="mx-metric-pill fail">
                                    ✕ {metrics.failed} Fail
                                </span>
                                <span className="mx-metric-pill block">
                                    ⚠ {metrics.blocked} Blocked
                                </span>
                                <span className="mx-metric-pill not-run">
                                    ○ {metrics.notRun} Not Run
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.74rem', color: '#929B96' }}>
                                    Progress: <strong>{metrics.completionPct}%</strong>
                                </span>
                                <div className={`mx-outcome-badge ${metrics.computedOutcome}`}>
                                    {metrics.computedOutcome === 'passed' && <CheckCircle2 size={13} />}
                                    {metrics.computedOutcome === 'failed' && <XCircle size={13} />}
                                    {metrics.computedOutcome === 'blocked' && <AlertTriangle size={13} />}
                                    {metrics.computedOutcome === 'in_progress' && <Clock size={13} />}
                                    {metrics.computedOutcome === 'not_run' && <MinusCircle size={13} />}
                                    <span>{metrics.outcomeLabel}</span>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mx-progress-track">
                            <div
                                className="mx-progress-fill"
                                style={{
                                    width: `${metrics.completionPct}%`,
                                    background: metrics.failed > 0
                                        ? '#E06C75'
                                        : metrics.blocked > 0
                                            ? '#E5C07B'
                                            : metrics.completionPct === 100
                                                ? '#8BAF9A'
                                                : '#61AFEF'
                                }}
                            />
                        </div>
                    </div>

                    {/* ─── 4. TEST STEPS LIST ────────────────────────────────────────── */}
                    <div className="mx-steps-section">
                        <div className="mx-section-header">
                            <div className="mx-section-title">
                                <FileText size={14} color="#8BAF9A" />
                                <span>Verification Steps ({steps.length})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="mx-section-hint">Individual outcomes required per step</span>
                                <button
                                    type="button"
                                    onClick={handleResetAllSteps}
                                    style={{ background: 'transparent', border: 0, color: '#728177', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                    title="Reset all steps to Not Run"
                                >
                                    <RotateCcw size={11} /> Reset
                                </button>
                            </div>
                        </div>

                        {steps.length > 0 ? (
                            <div className="mx-step-cards">
                                {steps.map((st, idx) => {
                                    const currentOutcome = stepOutcomes[idx] || 'not_run';
                                    const observation = stepObservations[idx] || '';
                                    const isFailOrBlock = currentOutcome === 'failed' || currentOutcome === 'blocked';

                                    return (
                                        <div key={st.id || idx} className={`mx-step-card ${currentOutcome}`}>
                                            <div className="mx-step-top">
                                                <div className="mx-step-info">
                                                    <div className="mx-step-action-row">
                                                        <span className="mx-step-num">Step {st.stepNumber}</span>
                                                        <span className="mx-step-action-text">{st.action}</span>
                                                    </div>

                                                    {st.expectedResult && (
                                                        <div className="mx-step-expected-row">
                                                            ↳ Expected: {st.expectedResult}
                                                        </div>
                                                    )}

                                                    {st.testData && (
                                                        <div className="mx-step-data-row">
                                                            Test Data: <code>{st.testData}</code>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 4-State Toggle Controls */}
                                                <div className="mx-step-controls">
                                                    <button
                                                        type="button"
                                                        className={`mx-step-btn pass ${currentOutcome === 'passed' ? 'active' : ''}`}
                                                        onClick={() => handleStepOutcome(idx, 'passed')}
                                                        title="Mark step verified and passed"
                                                    >
                                                        ✓ Pass
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`mx-step-btn fail ${currentOutcome === 'failed' ? 'active' : ''}`}
                                                        onClick={() => handleStepOutcome(idx, 'failed')}
                                                        title="Mark step failed"
                                                    >
                                                        ✕ Fail
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`mx-step-btn block ${currentOutcome === 'blocked' ? 'active' : ''}`}
                                                        onClick={() => handleStepOutcome(idx, 'blocked')}
                                                        title="Mark step blocked by impediment"
                                                    >
                                                        ⚠ Blocked
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`mx-step-btn not-run ${currentOutcome === 'not_run' ? 'active' : ''}`}
                                                        onClick={() => handleStepOutcome(idx, 'not_run')}
                                                        title="Not executed yet"
                                                    >
                                                        ○ Not Run
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expandable Step Observation (Required on Fail or Block) */}
                                            {isFailOrBlock && (
                                                <div className="mx-step-observation-box">
                                                    <label className={`mx-step-observation-label ${currentOutcome === 'failed' ? 'required' : 'blocked'}`}>
                                                        <span>
                                                            {currentOutcome === 'failed'
                                                                ? 'Observed Failure & Error Details * (Required):'
                                                                : 'Blocking Issue / Impediment * (Required):'}
                                                        </span>
                                                    </label>
                                                    <textarea
                                                        className={`mx-step-textarea ${!observation.trim() ? 'error' : ''}`}
                                                        rows={2}
                                                        placeholder={currentOutcome === 'failed' ? 'Describe observed deviation or error message...' : 'Specify dependency or system blocker...'}
                                                        value={observation}
                                                        onChange={e => handleStepObservation(idx, e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p style={{ color: '#728177', fontSize: '0.78rem', fontStyle: 'italic', margin: '4px 0' }}>
                                No individual steps specified for this test case. You can record an overall execution outcome below.
                            </p>
                        )}
                    </div>

                    {/* ─── 5. ACTUAL RESULTS & NOTES ─────────────────────────────────── */}
                    <div className="mx-notes-grid">
                        <div className="mx-field-group">
                            <label className="mx-field-label">
                                <span>Actual Result & Observations</span>
                                {(metrics.failed > 0 || metrics.blocked > 0) && (
                                    <span className="mx-field-required">* Required on Fail/Blocked</span>
                                )}
                            </label>
                            <textarea
                                className={`mx-main-textarea ${(metrics.failed > 0 || metrics.blocked > 0) && !actualResult.trim() ? 'required-missing' : ''}`}
                                rows={3}
                                placeholder={metrics.failed > 0 ? 'Explain why the test case failed and observed UI/system defect...' : 'Describe observed behavior confirming expected acceptance criteria...'}
                                value={actualResult}
                                onChange={e => { setActualResult(e.target.value); setValidationError(''); }}
                            />
                        </div>

                        <div className="mx-field-group">
                            <label className="mx-field-label">
                                <span>Tester Notes & Environment Details</span>
                                <span style={{ fontSize: '0.68rem', color: '#728177' }}>(Optional)</span>
                            </label>
                            <textarea
                                className="mx-main-textarea"
                                rows={3}
                                placeholder="e.g., Verified on Chrome 124, 1920x1080 resolution, staging build #91"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* ─── 6. EVIDENCE & ARTIFACT ATTACHMENT ─────────────────────────── */}
                    <div className="mx-evidence-section">
                        <div className="mx-evidence-top">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Camera size={14} color="#8BAF9A" />
                                <strong style={{ fontSize: '0.78rem', color: '#EDF1EE' }}>Evidence & Screenshots</strong>
                                <span style={{ fontSize: '0.7rem', color: '#7A8680' }}>(PNG, JPG, WebP, PDF up to 15MB)</span>
                            </div>

                            <label className="mx-upload-btn-label">
                                <Upload size={13} />
                                <span>{evidence ? 'Replace Attachment' : 'Attach Evidence'}</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>

                        {evidence && (
                            <div className="mx-evidence-preview-card">
                                <div className="mx-evidence-thumb-row">
                                    {evidence.mimeType.startsWith('image/') ? (
                                        <img src={evidence.data} alt="Evidence preview" className="mx-evidence-thumb" />
                                    ) : (
                                        <div className="mx-evidence-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileText size={16} color="#8BAF9A" />
                                        </div>
                                    )}

                                    <div className="mx-evidence-meta">
                                        <span className="mx-evidence-name" title={evidence.name}>{evidence.name}</span>
                                        <div className="mx-evidence-sub">
                                            <span>{Math.round(evidence.sizeBytes / 1024)} KB</span>
                                            <span>•</span>
                                            <span>Associate to:</span>
                                            <select
                                                className="mx-step-bind-select"
                                                value={evidenceTargetStep}
                                                onChange={e => {
                                                    setEvidenceTargetStep(e.target.value);
                                                    setEvidence(prev => prev ? { ...prev, targetStep: e.target.value } : null);
                                                }}
                                            >
                                                <option value="overall">Entire Execution</option>
                                                {steps.map(s => (
                                                    <option key={s.stepNumber} value={`step_${s.stepNumber}`}>
                                                        Step {s.stepNumber}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="mx-evidence-remove-btn"
                                    onClick={handleRemoveEvidence}
                                    title="Remove this attachment"
                                    aria-label="Remove evidence"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Action Error Banner */}
                    {validationError && (
                        <div className="mx-error-banner" role="alert">
                            <AlertCircle size={15} style={{ flexShrink: 0 }} />
                            <span>{validationError}</span>
                        </div>
                    )}
                </div>

                {/* ─── 7. SINGLE FIXED FOOTER ────────────────────────────────────────── */}
                <footer className="mx-footer">
                    <div className="mx-footer-left">
                        <button
                            type="button"
                            className="mx-btn mx-btn-draft"
                            onClick={handleSaveDraft}
                            disabled={isRecording || isSavingDraft}
                            title="Save current progress and resume later"
                        >
                            <Save size={13} className={isSavingDraft ? 'mx-spin' : ''} />
                            <span>{isSavingDraft ? 'Saving Draft…' : 'Save Draft'}</span>
                        </button>

                        {draftSavedAt && (
                            <span className="mx-draft-saved-text">
                                <Check size={12} /> Saved at {draftSavedAt}
                            </span>
                        )}
                    </div>

                    <div className="mx-footer-right">
                        <button
                            type="button"
                            className="mx-btn mx-btn-secondary"
                            onClick={onClose}
                            disabled={isRecording || isSavingDraft}
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            className="mx-btn mx-btn-primary"
                            onClick={handleCompleteExecution}
                            disabled={isRecording || isSavingDraft}
                        >
                            {isRecording ? (
                                <>
                                    <RefreshCw size={13} className="mx-spin" />
                                    <span>Recording Execution…</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={14} />
                                    <span>Complete Execution</span>
                                </>
                            )}
                        </button>
                    </div>
                </footer>
            </section>
        </div>,
        document.body
    );
};

export default ManualExecutionModal;
