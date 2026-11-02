import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
    GitCompare, CheckCircle2, XCircle, AlertTriangle, MinusCircle,
    Clock, Search, ArrowRight, Download, FileText, ExternalLink,
    RefreshCw, Layers, ShieldCheck, X, Eye, Copy, Check, ChevronLeft, ChevronRight,
    Camera, FileCode, Play, Terminal
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import '../../styles/app/RerunComparisonView.css';

const formatDuration = (ms) => {
    if (ms === null || ms === undefined || ms <= 0) return '0ms';
    if (ms < 1000) return `${ms}ms`;
    const sec = (ms / 1000).toFixed(1);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remSec = Math.round(sec % 60);
    return `${min}m ${remSec}s`;
};

const formatDate = (iso) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return String(iso);
    }
};

/**
 * Side-by-side failure detail comparison modal
 */
const FailureDetailComparisonModal = ({ testCase, comparisonData, onClose }) => {
    const [copiedError, setCopiedError] = useState(false);

    if (!testCase) return null;

    const orig = testCase.originalDetails || {};
    const rerun = testCase.rerunDetails || {};
    const diff = testCase.diagnosticDifferences || {};

    const handleCopy = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedError(true);
        setTimeout(() => setCopiedError(false), 2000);
    };

    return createPortal(
        <div className="rcv-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="rcv-modal-card" role="dialog" aria-modal="true" aria-labelledby="rcv-detail-title">
                {/* Header */}
                <header className="rcv-modal-header">
                    <div>
                        <div style={{ fontSize: '0.73rem', color: '#8A968E', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span>Failure Diagnostics &amp; Comparison</span>
                            <span>•</span>
                            <span className="rcv-case-id">{testCase.testCaseId}</span>
                        </div>
                        <h3 className="rcv-modal-title" id="rcv-detail-title">
                            {testCase.title}
                        </h3>
                    </div>
                    <button type="button" className="rcv-modal-close" onClick={onClose} aria-label="Close modal">
                        <X size={18} />
                    </button>
                </header>

                {/* Body */}
                <div className="rcv-modal-body">
                    {/* Diagnostic Analysis Strip */}
                    <div className={`rcv-analysis-box ${testCase.transition}`}>
                        <div style={{ fontWeight: 600, color: '#FFFFFF', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <ShieldCheck size={14} color="var(--tc-jade)" />
                            <span>Diagnostic Verdict: {testCase.transitionLabel}</span>
                        </div>
                        <div>{diff.summary || 'Diagnostic inspection between original and rerun attempts.'}</div>
                    </div>

                    {/* Side-by-side comparison columns */}
                    <div className="rcv-diff-columns">
                        {/* Column 1: Original Execution */}
                        <div className="rcv-diff-pane original">
                            <div className="rcv-pane-header">
                                <span className="rcv-pane-title">Original Execution</span>
                                <span className={`rcv-badge ${orig.status}`}>{orig.status}</span>
                            </div>

                            <div style={{ fontSize: '0.74rem', color: '#8A968E', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div>Duration: <strong style={{ color: '#BAC5BE' }}>{formatDuration(orig.durationMs)}</strong></div>
                                <div>Executed: <span>{formatDate(orig.executedAt)}</span> · {orig.executedBy || 'Tester'}</div>
                            </div>

                            {/* Original Error Message */}
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#727D75', textTransform: 'uppercase', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Error Message</span>
                                    {orig.errorMessage && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(orig.errorMessage)}
                                            style={{ background: 'transparent', border: 'none', color: '#8BAF9A', cursor: 'pointer', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                        >
                                            {copiedError ? <Check size={11} /> : <Copy size={11} />}
                                            <span>Copy</span>
                                        </button>
                                    )}
                                </div>
                                {orig.errorMessage ? (
                                    <pre className="rcv-code-block">{orig.errorMessage}</pre>
                                ) : (
                                    <div style={{ fontSize: '0.74rem', color: '#556058', fontStyle: 'italic' }}>No error logged</div>
                                )}
                            </div>

                            {/* Original Stack Trace */}
                            {orig.stackTrace && (
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#727D75', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Stack Trace</div>
                                    <pre className="rcv-code-block stack">{orig.stackTrace}</pre>
                                </div>
                            )}

                            {/* Original Actual Result / Notes */}
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#727D75', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Actual Result &amp; Notes</div>
                                <div style={{ fontSize: '0.76rem', color: '#BAC5BE', background: '#070908', border: '1px solid #1B221D', borderRadius: '4px', padding: '0.55rem 0.75rem', minHeight: '36px' }}>
                                    {orig.actualResult || orig.notes || 'No recorded actual result note.'}
                                </div>
                            </div>

                            {/* Original Artifacts / Evidence */}
                            {orig.artifacts && orig.artifacts.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#727D75', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Evidence Artifacts ({orig.artifacts.length})</div>
                                    <div className="rcv-evidence-gallery">
                                        {orig.artifacts.map((art, idx) => (
                                            <a
                                                key={idx}
                                                href={`/api/v1/runs/${comparisonData.originalRunId}/artifacts/${art.id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rcv-evidence-item"
                                            >
                                                <Camera size={12} />
                                                <span>{art.name || `Artifact #${idx + 1}`}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Column 2: Rerun Execution */}
                        <div className="rcv-diff-pane rerun">
                            <div className="rcv-pane-header">
                                <span className="rcv-pane-title">Rerun Execution</span>
                                <span className={`rcv-badge ${rerun.status}`}>{rerun.status}</span>
                            </div>

                            <div style={{ fontSize: '0.74rem', color: '#8A968E', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div>Duration: <strong style={{ color: '#BAC5BE' }}>{formatDuration(rerun.durationMs)}</strong></div>
                                <div>Executed: <span>{formatDate(rerun.executedAt)}</span> · {rerun.executedBy || 'Tester'}</div>
                            </div>

                            {/* Rerun Error Message */}
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#727D75', textTransform: 'uppercase', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Error Message</span>
                                    {rerun.errorMessage && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(rerun.errorMessage)}
                                            style={{ background: 'transparent', border: 'none', color: '#8BAF9A', cursor: 'pointer', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                        >
                                            {copiedError ? <Check size={11} /> : <Copy size={11} />}
                                            <span>Copy</span>
                                        </button>
                                    )}
                                </div>
                                {rerun.errorMessage ? (
                                    <pre className="rcv-code-block">{rerun.errorMessage}</pre>
                                ) : (
                                    <div style={{ fontSize: '0.74rem', color: '#8BAF9A', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <CheckCircle2 size={13} />
                                        <span>Clean execution — no failure errors logged</span>
                                    </div>
                                )}
                            </div>

                            {/* Rerun Stack Trace */}
                            {rerun.stackTrace && (
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#727D75', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Stack Trace</div>
                                    <pre className="rcv-code-block stack">{rerun.stackTrace}</pre>
                                </div>
                            )}

                            {/* Rerun Actual Result / Notes */}
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#727D75', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Actual Result &amp; Notes</div>
                                <div style={{ fontSize: '0.76rem', color: '#BAC5BE', background: '#070908', border: '1px solid #1B221D', borderRadius: '4px', padding: '0.55rem 0.75rem', minHeight: '36px' }}>
                                    {rerun.actualResult || rerun.notes || (rerun.status === 'passed' ? 'Scenario verified and passed on rerun.' : 'No notes recorded.')}
                                </div>
                            </div>

                            {/* Rerun Artifacts / Evidence */}
                            {rerun.artifacts && rerun.artifacts.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#727D75', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Evidence Artifacts ({rerun.artifacts.length})</div>
                                    <div className="rcv-evidence-gallery">
                                        {rerun.artifacts.map((art, idx) => (
                                            <a
                                                key={idx}
                                                href={`/api/v1/runs/${comparisonData.rerunId}/artifacts/${art.id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rcv-evidence-item"
                                            >
                                                <Camera size={12} />
                                                <span>{art.name || `Artifact #${idx + 1}`}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="rcv-modal-footer">
                    <button type="button" className="rcv-btn-action" onClick={onClose}>
                        Close Diagnostics
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

/**
 * Main Rerun Result Comparison Component
 */
const RerunResultComparisonView = ({ runId, initialRerunId = null, onSelectRun }) => {
    const [comparison, setComparison] = useState(null);
    const [availableReruns, setAvailableReruns] = useState([]);
    const [selectedRerunId, setSelectedRerunId] = useState(initialRerunId || '');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filter, Search, Pagination
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 15;

    // Detailed failure inspection modal
    const [inspectingCase, setInspectingCase] = useState(null);

    // 1. Load available reruns history for this execution
    useEffect(() => {
        let isMounted = true;
        const loadRerunHistory = async () => {
            try {
                const res = await executionService.getRerunHistory(runId);
                if (isMounted && res.success && Array.isArray(res.data)) {
                    setAvailableReruns(res.data);
                    if (!selectedRerunId && res.data.length > 0) {
                        setSelectedRerunId(res.data[0].id);
                    }
                }
            } catch (err) {
                console.warn('Notice loading rerun history:', err);
            }
        };

        if (runId) loadRerunHistory();
        return () => { isMounted = false; };
    }, [runId]);

    // 2. Fetch Comparison Data
    const fetchComparison = useCallback(async (rId, chosenRerunId) => {
        if (!rId) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await executionService.getRerunComparison(rId, chosenRerunId || null);
            if (res.success && res.data) {
                setComparison(res.data);
            } else {
                setError(res.message || 'Unable to compute rerun comparison.');
            }
        } catch (err) {
            setError(err.message || 'Failed to retrieve comparison.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchComparison(runId, selectedRerunId);
    }, [runId, selectedRerunId, fetchComparison]);

    // Handle rerun switch
    const handleSwitchRerun = (e) => {
        const newRerunId = e.target.value;
        setSelectedRerunId(newRerunId);
        setCurrentPage(1);
    };

    // Client-side export handlers
    const handleExportJSON = () => {
        if (!comparison) return;
        const blob = new Blob([JSON.stringify(comparison, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rerun_comparison_${(comparison.originalRunId || 'orig').slice(-6)}_vs_${(comparison.rerunId || 'rerun').slice(-6)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportCSV = () => {
        if (!comparison) return;
        const rows = [
            ['Test Case ID', 'Title', 'Category', 'Execution Method', 'Original Outcome', 'Rerun Outcome', 'Classification', 'Original Duration (ms)', 'Rerun Duration (ms)', 'Duration Delta (ms)']
        ];

        (comparison.comparisons || []).forEach(c => {
            rows.push([
                `"${c.testCaseId || ''}"`,
                `"${(c.title || '').replace(/"/g, '""')}"`,
                `"${c.category || 'Functional'}"`,
                c.executionType || 'manual',
                c.originalStatus || 'not_run',
                c.rerunStatus || 'not_run',
                c.transitionLabel || c.transition,
                c.originalDurationMs || 0,
                c.rerunDurationMs || 0,
                c.durationDiffMs || 0
            ]);
        });

        const csvContent = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rerun_comparison_${(comparison.originalRunId || 'orig').slice(-6)}_vs_${(comparison.rerunId || 'rerun').slice(-6)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Filter & Search Logic
    const allComparisons = comparison?.comparisons || [];

    const filteredComparisons = useMemo(() => {
        return allComparisons.filter(c => {
            // Filter by active classification tab
            if (activeFilter === 'fixed' && c.transition !== 'fixed') return false;
            if (activeFilter === 'still_failing' && c.transition !== 'still_failing') return false;
            if (activeFilter === 'regression' && c.transition !== 'regression') return false;
            if (activeFilter === 'still_passing' && c.transition !== 'still_passing') return false;
            if (activeFilter === 'blocked' && c.transition !== 'blocked') return false;
            if (activeFilter === 'skipped' && c.transition !== 'skipped') return false;
            if (activeFilter === 'pending' && c.transition !== 'pending') return false;
            if (activeFilter === 'added_omitted' && !['added', 'omitted'].includes(c.transition)) return false;

            // Search by Test Case ID or Title
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const matchesId = (c.testCaseId || '').toLowerCase().includes(q);
                const matchesTitle = (c.title || '').toLowerCase().includes(q);
                if (!matchesId && !matchesTitle) return false;
            }

            return true;
        });
    }, [allComparisons, activeFilter, searchQuery]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredComparisons.length / pageSize));
    const paginatedComparisons = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredComparisons.slice(start, start + pageSize);
    }, [filteredComparisons, currentPage, pageSize]);

    if (isLoading) {
        return (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#8BAF9A' }}>
                <RefreshCw size={24} className="mx-spin" style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Calculating Rerun Result Comparison…</div>
                <div style={{ fontSize: '0.74rem', color: '#727D75', marginTop: '0.35rem' }}>Comparing verified test attempts and failure diagnostics</div>
            </div>
        );
    }

    if (error || !comparison) {
        return (
            <div className="rcv-header-banner" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
                <AlertTriangle size={32} color="var(--tc-fail)" style={{ margin: '0 auto 0.6rem' }} />
                <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.05rem' }}>Comparison Unavailable</h3>
                <p style={{ color: '#8A968E', fontSize: '0.78rem', maxWidth: '460px', margin: '0.4rem auto 1.25rem' }}>
                    {error || 'No rerun comparison found for this execution. Ensure at least one rerun has been created.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    <button type="button" className="rcv-btn-action" onClick={() => fetchComparison(runId, selectedRerunId)}>
                        <RefreshCw size={13} />
                        <span>Retry</span>
                    </button>
                    <NavLink to={`/app/runs/${runId}`} className="rcv-btn-action">
                        Return to Run Workspace
                    </NavLink>
                </div>
            </div>
        );
    }

    const summary = comparison.summary || {};
    const isTerminal = comparison.terminalStateReached;

    return (
        <div className="rcv-container">
            {/* 1. Header & Lineage Banner */}
            <header className="rcv-header-banner">
                <div className="rcv-header-top">
                    <div className="rcv-header-title-area">
                        <div className="rcv-breadcrumb">
                            <NavLink to="/app/runs">Execution</NavLink>
                            <span>/</span>
                            <NavLink to={`/app/runs/${comparison.originalRunId}`}>Run {comparison.originalRunId.slice(-8)}</NavLink>
                            <span>/</span>
                            <span>Rerun Comparison</span>
                        </div>
                        <h2 className="rcv-header-title">
                            <GitCompare size={20} color="var(--tc-jade)" />
                            <span>Rerun Result Comparison: {comparison.suiteName || 'Test Suite'}</span>
                        </h2>
                    </div>

                    <div className="rcv-header-actions">
                        <button type="button" className="rcv-btn-action" onClick={handleExportCSV} title="Export comparison rows to CSV">
                            <Download size={13} />
                            <span>Export CSV</span>
                        </button>
                        <button type="button" className="rcv-btn-action" onClick={handleExportJSON} title="Export complete structured comparison to JSON">
                            <FileCode size={13} />
                            <span>Export JSON</span>
                        </button>
                        <NavLink to={`/app/runs/${comparison.rerunId}`} className="rcv-btn-action rcv-btn-primary">
                            <span>Open Rerun Workspace</span>
                            <ArrowRight size={13} />
                        </NavLink>
                    </div>
                </div>

                {/* Metadata Strip */}
                <div className="rcv-meta-strip">
                    <div className="rcv-meta-item">
                        <span>Original Run:</span>
                        <NavLink to={`/app/runs/${comparison.originalRunId}`}>
                            <strong>{comparison.originalRunId.slice(-8)}</strong>
                        </NavLink>
                    </div>

                    <div className="rcv-meta-item">
                        <span>Rerun Execution:</span>
                        {availableReruns.length > 1 ? (
                            <select
                                className="rcv-selector-select"
                                value={comparison.rerunId}
                                onChange={handleSwitchRerun}
                                aria-label="Select rerun execution"
                            >
                                {availableReruns.map((r, idx) => (
                                    <option key={r.id} value={r.id}>
                                        Rerun #{availableReruns.length - idx} ({r.id.slice(-6)}) · {r.status}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <NavLink to={`/app/runs/${comparison.rerunId}`}>
                                <strong>{comparison.rerunId.slice(-8)}</strong>
                            </NavLink>
                        )}
                    </div>

                    <div className="rcv-meta-item">
                        <span>Environment:</span>
                        <strong>{comparison.targetEnvironment?.name || 'Default'}</strong>
                    </div>

                    <div className="rcv-meta-item">
                        <span>Method:</span>
                        <strong>{comparison.executionType === 'automated' ? 'Playwright' : 'Manual QA'}</strong>
                    </div>

                    <div className="rcv-meta-item">
                        <span>Original Started:</span>
                        <span>{formatDate(comparison.originalStartedAt)}</span>
                    </div>

                    <div className="rcv-meta-item">
                        <span>Rerun Completed:</span>
                        <span>{comparison.rerunCompletedAt ? formatDate(comparison.rerunCompletedAt) : (isTerminal ? 'Concluded' : 'In Progress')}</span>
                    </div>

                    <div className="rcv-meta-item" style={{ marginLeft: 'auto' }}>
                        <span className={`rcv-shift-pill ${summary.verdict === 'ALL_FIXED' ? 'fixed' : summary.verdict === 'REGRESSIONS_DETECTED' ? 'regression' : summary.verdict === 'PARTIALLY_FIXED' ? 'fixed' : 'still_failing'}`}>
                            {summary.verdict === 'ALL_FIXED' && <CheckCircle2 size={12} />}
                            {summary.verdict === 'REGRESSIONS_DETECTED' && <AlertTriangle size={12} />}
                            <span>Verdict: {summary.verdict.replace(/_/g, ' ')}</span>
                        </span>
                    </div>
                </div>

                {/* In-progress Notice if Rerun is Still Running */}
                {!isTerminal && (
                    <div className="rcv-active-banner">
                        <RefreshCw size={14} className="mx-spin" />
                        <span>This rerun is currently active. Comparison results will update in real-time as tests complete.</span>
                    </div>
                )}
            </header>

            {/* 2. Metric Summary Cards */}
            <section className="rcv-summary-grid">
                <div className="rcv-card fixed">
                    <span className="rcv-card-label"><CheckCircle2 size={12} color="#8BAF9A" /> Fixed</span>
                    <span className="rcv-card-value">{summary.fixedCount || 0}</span>
                </div>

                <div className="rcv-card still-failing">
                    <span className="rcv-card-label"><XCircle size={12} color="#E06C75" /> Still Failing</span>
                    <span className="rcv-card-value">{summary.stillFailingCount || 0}</span>
                </div>

                {summary.regressionCount > 0 && (
                    <div className="rcv-card regression">
                        <span className="rcv-card-label"><AlertTriangle size={12} color="#F87171" /> Regressions</span>
                        <span className="rcv-card-value">{summary.regressionCount}</span>
                    </div>
                )}

                <div className="rcv-card blocked">
                    <span className="rcv-card-label"><AlertTriangle size={12} color="#E5C07B" /> Blocked</span>
                    <span className="rcv-card-value">{summary.blockedCount || 0}</span>
                </div>

                <div className="rcv-card skipped">
                    <span className="rcv-card-label"><MinusCircle size={12} color="#94A3B8" /> Skipped</span>
                    <span className="rcv-card-value">{summary.skippedCount || 0}</span>
                </div>

                <div className="rcv-card pending">
                    <span className="rcv-card-label"><Clock size={12} color="#38BDF8" /> Pending</span>
                    <span className="rcv-card-value">{summary.pendingCount || 0}</span>
                </div>

                <div className="rcv-card">
                    <span className="rcv-card-label"><Layers size={12} /> Total Compared</span>
                    <span className="rcv-card-value">{summary.totalCompared || 0}</span>
                </div>
            </section>

            {/* 3. Controls & Filter Bar */}
            <div className="rcv-controls-bar">
                <div className="rcv-filter-tabs">
                    <button
                        type="button"
                        className={`rcv-tab-btn ${activeFilter === 'all' ? 'is-active' : ''}`}
                        onClick={() => { setActiveFilter('all'); setCurrentPage(1); }}
                    >
                        All ({allComparisons.length})
                    </button>
                    <button
                        type="button"
                        className={`rcv-tab-btn ${activeFilter === 'fixed' ? 'is-active' : ''}`}
                        onClick={() => { setActiveFilter('fixed'); setCurrentPage(1); }}
                    >
                        Fixed ({summary.fixedCount || 0})
                    </button>
                    <button
                        type="button"
                        className={`rcv-tab-btn ${activeFilter === 'still_failing' ? 'is-active' : ''}`}
                        onClick={() => { setActiveFilter('still_failing'); setCurrentPage(1); }}
                    >
                        Still Failing ({summary.stillFailingCount || 0})
                    </button>
                    {summary.regressionCount > 0 && (
                        <button
                            type="button"
                            className={`rcv-tab-btn ${activeFilter === 'regression' ? 'is-active' : ''}`}
                            onClick={() => { setActiveFilter('regression'); setCurrentPage(1); }}
                        >
                            Regressions ({summary.regressionCount})
                        </button>
                    )}
                    <button
                        type="button"
                        className={`rcv-tab-btn ${activeFilter === 'blocked' ? 'is-active' : ''}`}
                        onClick={() => { setActiveFilter('blocked'); setCurrentPage(1); }}
                    >
                        Blocked ({summary.blockedCount || 0})
                    </button>
                    <button
                        type="button"
                        className={`rcv-tab-btn ${activeFilter === 'skipped' ? 'is-active' : ''}`}
                        onClick={() => { setActiveFilter('skipped'); setCurrentPage(1); }}
                    >
                        Skipped ({summary.skippedCount || 0})
                    </button>
                    <button
                        type="button"
                        className={`rcv-tab-btn ${activeFilter === 'pending' ? 'is-active' : ''}`}
                        onClick={() => { setActiveFilter('pending'); setCurrentPage(1); }}
                    >
                        Pending ({summary.pendingCount || 0})
                    </button>
                    {(summary.omittedCount > 0 || summary.addedCount > 0) && (
                        <button
                            type="button"
                            className={`rcv-tab-btn ${activeFilter === 'added_omitted' ? 'is-active' : ''}`}
                            onClick={() => { setActiveFilter('added_omitted'); setCurrentPage(1); }}
                        >
                            Omitted/Added ({(summary.omittedCount || 0) + (summary.addedCount || 0)})
                        </button>
                    )}
                </div>

                <div className="rcv-search-box">
                    <Search size={14} color="#727D75" />
                    <input
                        type="text"
                        placeholder="Search test case ID or title…"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        aria-label="Filter test cases"
                    />
                </div>
            </div>

            {/* 4. Test Case Comparison Table */}
            <div className="rcv-table-wrapper">
                <table className="rcv-table">
                    <thead>
                        <tr>
                            <th style={{ width: '130px' }}>Test Case ID</th>
                            <th>Title &amp; Scenario</th>
                            <th style={{ width: '90px' }}>Method</th>
                            <th style={{ width: '110px' }}>Original</th>
                            <th style={{ width: '110px' }}>Rerun</th>
                            <th style={{ width: '140px' }}>Classification</th>
                            <th style={{ width: '120px' }}>Duration &amp; Delta</th>
                            <th style={{ width: '110px', textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedComparisons.length > 0 ? (
                            paginatedComparisons.map((c) => {
                                const delta = c.durationDiffMs || 0;
                                return (
                                    <tr key={c.testCaseId}>
                                        <td>
                                            <span className="rcv-case-id">{c.testCaseId}</span>
                                        </td>
                                        <td>
                                            <div className="rcv-case-title" title={c.title}>{c.title}</div>
                                            <div style={{ fontSize: '0.69rem', color: '#727D75', marginTop: '2px' }}>
                                                {c.category} · Priority: {c.priority}
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.72rem', color: '#8A968E', textTransform: 'capitalize' }}>
                                                {c.executionType === 'automated' ? 'Playwright' : 'Manual'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`rcv-badge ${c.originalStatus}`}>
                                                {c.originalStatus}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`rcv-badge ${c.rerunStatus}`}>
                                                {c.rerunStatus}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`rcv-shift-pill ${c.transition}`}>
                                                {c.transition === 'fixed' && <CheckCircle2 size={12} />}
                                                {c.transition === 'still_failing' && <XCircle size={12} />}
                                                {c.transition === 'regression' && <AlertTriangle size={12} />}
                                                {c.transition === 'blocked' && <AlertTriangle size={12} />}
                                                {c.transition === 'skipped' && <MinusCircle size={12} />}
                                                {c.transition === 'pending' && <Clock size={12} />}
                                                <span>{c.transitionLabel}</span>
                                            </span>
                                        </td>
                                        <td>
                                            <div className="rcv-duration">
                                                <span>{formatDuration(c.rerunDurationMs)}</span>
                                                {c.rerunStatus !== 'omitted' && c.originalStatus !== 'omitted' && delta !== 0 && (
                                                    <span className={delta < 0 ? 'rcv-delta-faster' : 'rcv-delta-slower'} style={{ marginLeft: '4px' }}>
                                                        {delta > 0 ? `+${formatDuration(delta)}` : `-${formatDuration(Math.abs(delta))}`}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                type="button"
                                                className="rcv-btn-action"
                                                onClick={() => setInspectingCase(c)}
                                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.71rem' }}
                                                title="Inspect failure diagnostics and side-by-side evidence"
                                            >
                                                <Eye size={12} />
                                                <span>Inspect</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#727D75' }}>
                                    No test cases match the active filter criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination footer */}
                {totalPages > 1 && (
                    <div className="rcv-pagination-bar">
                        <span>Showing {Math.min(filteredComparisons.length, (currentPage - 1) * pageSize + 1)} - {Math.min(filteredComparisons.length, currentPage * pageSize)} of {filteredComparisons.length} test cases</span>
                        <div className="rcv-pagination-btns">
                            <button
                                type="button"
                                className="rcv-page-btn"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft size={13} />
                            </button>
                            <span style={{ padding: '0 0.4rem', color: '#BAC5BE' }}>Page {currentPage} of {totalPages}</span>
                            <button
                                type="button"
                                className="rcv-page-btn"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Side-by-side failure detail comparison modal */}
            {inspectingCase && (
                <FailureDetailComparisonModal
                    testCase={inspectingCase}
                    comparisonData={comparison}
                    onClose={() => setInspectingCase(null)}
                />
            )}
        </div>
    );
};

export default RerunResultComparisonView;
