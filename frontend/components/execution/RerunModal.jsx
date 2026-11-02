import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    RotateCcw, X, AlertTriangle, Play, Clock, Check, Layers,
    ShieldAlert, AlertCircle, RefreshCw, CheckCircle2, ChevronRight
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import '../../styles/app/RerunWorkspace.css';

const RerunModal = ({
    isOpen = true,
    onClose,
    run,
    cases = [],
    onRerunCreated
}) => {
    // 1. Extract eligible failed/blocked cases
    const eligibleFailures = useMemo(() => {
        return cases.filter(c => {
            const st = String(c.status || '').toLowerCase();
            return st === 'failed' || st === 'blocked';
        });
    }, [cases]);

    // Selection mode: 'failed' (all eligible) | 'selected' (user choice)
    const [scopeMode, setScopeMode] = useState('failed');
    const [selectedIds, setSelectedIds] = useState(() => new Set(eligibleFailures.map(c => c.id)));
    const [searchFilter, setSearchFilter] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionError, setActionError] = useState('');
    const [confirmingSingleCase, setConfirmingSingleCase] = useState(null);
    const [step, setStep] = useState('select'); // 'select' | 'confirm'

    // Filtered list based on search
    const filteredFailures = useMemo(() => {
        if (!searchFilter.trim()) return eligibleFailures;
        const q = searchFilter.trim().toLowerCase();
        return eligibleFailures.filter(c => {
            const id = String(c.testCaseId || c.caseSnapshot?.id || '').toLowerCase();
            const title = String(c.caseSnapshot?.title || c.title || '').toLowerCase();
            const cat = String(c.caseSnapshot?.type || c.type || '').toLowerCase();
            return id.includes(q) || title.includes(q) || cat.includes(q);
        });
    }, [eligibleFailures, searchFilter]);

    // Selection helpers
    const toggleSelectAll = () => {
        if (selectedIds.size === eligibleFailures.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(eligibleFailures.map(c => c.id)));
        }
    };

    const toggleSelectCase = (caseId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(caseId)) next.delete(caseId);
            else next.add(caseId);
            return next;
        });
    };

    // Calculate effective targets
    const effectiveSelectedCases = useMemo(() => {
        if (confirmingSingleCase) return [confirmingSingleCase];
        if (scopeMode === 'failed') return eligibleFailures;
        return eligibleFailures.filter(c => selectedIds.has(c.id));
    }, [scopeMode, eligibleFailures, selectedIds, confirmingSingleCase]);

    // Inspect automation readiness
    const automatedCasesCount = useMemo(() => {
        return effectiveSelectedCases.filter(c => {
            const snap = c.caseSnapshot || {};
            const map = snap.automationMapping || c.automationMapping;
            const hasMapping = Boolean(
                map &&
                map.mappingStatus === 'configured' &&
                (map.scriptCode || map.code || (map.scriptSource === 'existing' && map.scriptRef))
            );
            return (c.executionType === 'automated' || run?.executionType === 'automated') && hasMapping;
        }).length;
    }, [effectiveSelectedCases, run]);

    const derivedExecutionType = useMemo(() => {
        if (effectiveSelectedCases.length === 0) return 'manual';
        if (automatedCasesCount === effectiveSelectedCases.length) return 'automated';
        if (automatedCasesCount === 0) return 'manual';
        return 'mixed';
    }, [effectiveSelectedCases, automatedCasesCount]);

    // Handle single test case quick rerun trigger
    const handleTriggerSingle = (caseItem) => {
        setConfirmingSingleCase(caseItem);
        setStep('confirm');
    };

    // Submit rerun to backend
    const handleConfirmSubmit = async () => {
        setIsSubmitting(true);
        setActionError('');

        try {
            let res;
            if (confirmingSingleCase) {
                const targetId = confirmingSingleCase.testCaseId || confirmingSingleCase.id;
                res = await executionService.rerunSingleCase({
                    runId: run.id,
                    caseId: targetId
                });
            } else if (scopeMode === 'failed') {
                res = await executionService.rerun({
                    runId: run.id,
                    scope: 'failed'
                });
            } else {
                const targetCaseIds = effectiveSelectedCases.map(c => c.testCaseId || c.id);
                res = await executionService.rerunSelected({
                    runId: run.id,
                    caseIds: targetCaseIds
                });
            }

            if (res?.success) {
                if (onRerunCreated) {
                    onRerunCreated(res.data);
                }
                onClose();
            } else {
                throw new Error(res?.message || 'Failed to initiate rerun execution.');
            }
        } catch (err) {
            setActionError(err.message || 'Rerun initiation failed on the server.');
            setStep('select');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !run) return null;

    return createPortal(
        <div
            className="rerun-backdrop"
            role="presentation"
            onMouseDown={e => {
                if (e.target === e.currentTarget && !isSubmitting) onClose();
            }}
        >
            <div
                className="rerun-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rerun-modal-title"
            >
                {/* 1. Header */}
                <header className="rerun-header">
                    <div className="rerun-header-titles">
                        <span className="rerun-eyebrow">
                            <RotateCcw size={13} />
                            Phase 2 Rerun Execution Engine
                        </span>
                        <div className="rerun-title-row">
                            <h2 id="rerun-modal-title">
                                {step === 'confirm' ? 'Confirm Rerun Execution' : 'Rerun Failed Tests'}
                            </h2>
                            <span className="rerun-run-pill">Original Run #{String(run.id).slice(-8)}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="rerun-close-btn"
                        onClick={onClose}
                        disabled={isSubmitting}
                        aria-label="Close rerun modal"
                    >
                        <X size={18} />
                    </button>
                </header>

                {/* 2. Context Strip */}
                <div className="rerun-context-strip">
                    <span className="rerun-meta-item">
                        Suite: <strong>{run.suiteTitle || run.suiteName || 'Test Suite'}</strong>
                    </span>
                    <span>•</span>
                    <span className="rerun-meta-item">
                        Environment: <strong>{run.targetEnvironment?.name || 'Default Staging'}</strong>
                    </span>
                    <span>•</span>
                    <span className="rerun-meta-item">
                        Method: <strong>{run.executionType === 'automated' ? 'Playwright Automated' : run.executionType === 'mixed' ? 'Hybrid (Playwright + Manual)' : 'Manual Verification'}</strong>
                    </span>
                    <span>•</span>
                    <span className="rerun-meta-item" style={{ color: '#E06C75' }}>
                        Eligible Failures: <strong>{eligibleFailures.length}</strong>
                    </span>
                </div>

                {/* Error Banner */}
                {actionError && (
                    <div className="rerun-notice error" role="alert">
                        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            <strong>Rerun Error:</strong> {actionError}
                        </div>
                    </div>
                )}

                {/* Notice Banner */}
                <div className="rerun-notice">
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#8BAF9A' }} />
                    <div>
                        <strong>Immutable Original Execution:</strong> The original test run and historical attempt records remain completely untouched. A dedicated new execution record linked to this run will be initiated.
                    </div>
                </div>

                {/* STEP 1: SELECTION VIEW */}
                {step === 'select' && (
                    <>
                        {eligibleFailures.length === 0 ? (
                            <div className="rerun-body" style={{ textAlign: 'center', padding: '40px 20px', color: '#87928B' }}>
                                <CheckCircle2 size={36} color="#8BAF9A" style={{ margin: '0 auto 12px' }} />
                                <h3 style={{ color: '#FFFFFF', margin: '0 0 6px', fontSize: '1rem' }}>No Eligible Failures Discovered</h3>
                                <p style={{ fontSize: '0.8rem', maxWidth: '420px', margin: '0 auto' }}>
                                    All test cases in this run passed or were skipped. There are no failed or blocked tests eligible for rerun.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Selection Controls Strip */}
                                <div className="rerun-controls-bar">
                                    <div className="rerun-scope-selector">
                                        <button
                                            type="button"
                                            className={`rerun-scope-btn ${scopeMode === 'failed' ? 'active' : ''}`}
                                            onClick={() => {
                                                setScopeMode('failed');
                                                setSelectedIds(new Set(eligibleFailures.map(c => c.id)));
                                            }}
                                        >
                                            Rerun All Failures ({eligibleFailures.length})
                                        </button>
                                        <button
                                            type="button"
                                            className={`rerun-scope-btn ${scopeMode === 'selected' ? 'active' : ''}`}
                                            onClick={() => setScopeMode('selected')}
                                        >
                                            Custom Selection
                                        </button>
                                    </div>

                                    <div className="rerun-selection-actions">
                                        {scopeMode === 'selected' && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="rerun-link-btn"
                                                    onClick={toggleSelectAll}
                                                >
                                                    {selectedIds.size === eligibleFailures.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                                <span>•</span>
                                            </>
                                        )}
                                        <span className="rerun-count-badge">
                                            Selected: <strong>{effectiveSelectedCases.length}</strong> of {eligibleFailures.length}
                                        </span>
                                    </div>
                                </div>

                                {/* Scrollable Table of Failed Cases */}
                                <div className="rerun-body">
                                    <div className="rerun-table-wrap">
                                        <table className="rerun-table">
                                            <thead>
                                                <tr>
                                                    {scopeMode === 'selected' && (
                                                        <th style={{ width: '36px', textAlign: 'center' }}>
                                                            <input
                                                                type="checkbox"
                                                                className="rerun-checkbox"
                                                                checked={selectedIds.size === eligibleFailures.length && eligibleFailures.length > 0}
                                                                onChange={toggleSelectAll}
                                                                aria-label="Select all failed test cases"
                                                            />
                                                        </th>
                                                    )}
                                                    <th>Case ID & Title</th>
                                                    <th>Category</th>
                                                    <th>Priority</th>
                                                    <th>Method</th>
                                                    <th>Status</th>
                                                    <th>Automation</th>
                                                    <th style={{ textAlign: 'right' }}>Direct Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredFailures.map(c => {
                                                    const isChecked = selectedIds.has(c.id);
                                                    const snap = c.caseSnapshot || {};
                                                    const caseId = c.testCaseId || snap.id || c.id;
                                                    const title = snap.title || c.title || 'Untitled';
                                                    const category = snap.type || c.type || 'Functional';
                                                    const priority = snap.priority || c.priority || 'Medium';
                                                    const isAuto = c.executionType === 'automated' || run.executionType === 'automated';
                                                    const mapping = snap.automationMapping || c.automationMapping;
                                                    const isReady = isAuto && mapping?.mappingStatus === 'configured';

                                                    return (
                                                        <tr
                                                            key={c.id}
                                                            className={isChecked && scopeMode === 'selected' ? 'selected' : ''}
                                                        >
                                                            {scopeMode === 'selected' && (
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="rerun-checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => toggleSelectCase(c.id)}
                                                                        aria-label={`Select test case ${caseId}`}
                                                                    />
                                                                </td>
                                                            )}
                                                            <td>
                                                                <span className="rerun-case-id">{caseId}</span>
                                                                <span className="rerun-case-title" title={title}>{title}</span>
                                                            </td>
                                                            <td>{category}</td>
                                                            <td>
                                                                <span style={{
                                                                    color: priority === 'Critical' ? '#E06C75' : priority === 'High' ? '#E5C07B' : '#C0CFC5',
                                                                    fontWeight: 600
                                                                }}>
                                                                    {priority}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`rerun-badge ${isAuto ? 'automated' : 'manual'}`}>
                                                                    {isAuto ? 'Automated' : 'Manual'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`rerun-badge ${String(c.status).toLowerCase()}`}>
                                                                    {String(c.status).toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {isAuto ? (
                                                                    <span className={`rerun-badge ${isReady ? 'ready' : 'unmapped'}`}>
                                                                        {isReady ? 'Ready' : 'Unmapped'}
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ color: '#777E7E', fontSize: '0.7rem' }}>Manual QA</span>
                                                                )}
                                                            </td>
                                                            <td className="rerun-action-btn-cell">
                                                                <button
                                                                    type="button"
                                                                    className="rerun-single-btn"
                                                                    onClick={() => handleTriggerSingle(c)}
                                                                    title={`Rerun only ${caseId}`}
                                                                >
                                                                    <RotateCcw size={12} />
                                                                    <span>Rerun Single</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* STEP 2: CONFIRMATION VIEW */}
                {step === 'confirm' && (
                    <div className="rerun-body" style={{ padding: '20px 22px' }}>
                        <div style={{ background: '#080A09', border: '1px solid #1E2521', borderRadius: '6px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle2 size={16} color="#8BAF9A" />
                                Review New Execution Parameters
                            </h4>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.78rem' }}>
                                <div>
                                    <span style={{ color: '#87928B' }}>Target Cases:</span>
                                    <div style={{ color: '#FFFFFF', fontWeight: 600, marginTop: '2px' }}>
                                        {effectiveSelectedCases.length} case{effectiveSelectedCases.length === 1 ? '' : 's'}
                                        {confirmingSingleCase && ` (${confirmingSingleCase.testCaseId || confirmingSingleCase.id})`}
                                    </div>
                                </div>

                                <div>
                                    <span style={{ color: '#87928B' }}>Execution Mode:</span>
                                    <div style={{ color: '#8BAF9A', fontWeight: 600, marginTop: '2px', textTransform: 'capitalize' }}>
                                        {derivedExecutionType} ({automatedCasesCount} automated, {effectiveSelectedCases.length - automatedCasesCount} manual)
                                    </div>
                                </div>

                                <div>
                                    <span style={{ color: '#87928B' }}>Original Execution Reference:</span>
                                    <div style={{ color: '#FFFFFF', fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>
                                        {run.id}
                                    </div>
                                </div>

                                <div>
                                    <span style={{ color: '#87928B' }}>Target Environment:</span>
                                    <div style={{ color: '#FFFFFF', fontWeight: 600, marginTop: '2px' }}>
                                        {run.targetEnvironment?.name || 'Default Staging'}
                                    </div>
                                </div>
                            </div>

                            {automatedCasesCount > 0 && (
                                <div style={{ fontSize: '0.74rem', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.08)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                                    Automated cases will be queued immediately into the headless Chromium Playwright worker.
                                </div>
                            )}

                            {effectiveSelectedCases.length - automatedCasesCount > 0 && (
                                <div style={{ fontSize: '0.74rem', color: '#C0CFC5', background: 'rgba(255, 255, 255, 0.04)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    Manual cases will be initialized in the new execution workspace ready for step-by-step verification.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 6. Fixed Footer */}
                <footer className="rerun-footer">
                    <div className="rerun-footer-notice">
                        {step === 'select' ? (
                            <span>Selected {effectiveSelectedCases.length} eligible test case{effectiveSelectedCases.length === 1 ? '' : 's'}.</span>
                        ) : (
                            <span>Ready to create new execution. Original remains unchanged.</span>
                        )}
                    </div>

                    <div className="rerun-footer-actions">
                        {step === 'confirm' ? (
                            <>
                                <button
                                    type="button"
                                    className="rerun-btn-secondary"
                                    onClick={() => {
                                        setConfirmingSingleCase(null);
                                        setStep('select');
                                    }}
                                    disabled={isSubmitting}
                                >
                                    Back to Selection
                                </button>
                                <button
                                    type="button"
                                    className="rerun-btn-primary"
                                    onClick={handleConfirmSubmit}
                                    disabled={isSubmitting || effectiveSelectedCases.length === 0}
                                >
                                    <RotateCcw size={14} className={isSubmitting ? 'animate-spin' : ''} />
                                    <span>{isSubmitting ? 'Creating Rerun...' : `Launch Rerun (${effectiveSelectedCases.length})`}</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="rerun-btn-secondary"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="rerun-btn-primary"
                                    onClick={() => setStep('confirm')}
                                    disabled={isSubmitting || effectiveSelectedCases.length === 0}
                                >
                                    <span>Review & Launch</span>
                                    <ChevronRight size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default RerunModal;

