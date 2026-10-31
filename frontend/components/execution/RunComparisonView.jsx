import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
    GitCompare, AlertTriangle, CheckCircle2, XCircle, Clock,
    ArrowRight, RefreshCw, Layers, Minus, Download, Printer,
    FileText, ChevronDown, ChevronUp, Check, Search, AlertCircle
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../loading';
import '../../styles/app/WorkspaceDesignSystem.css';
import '../../styles/app/RunComparison.css';

const formatDuration = (ms) => {
    if (!ms || ms <= 0) return '0s';
    if (ms < 1000) return `${ms}ms`;
    const sec = (ms / 1000).toFixed(1);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remSec = Math.round(sec % 60);
    return `${min}m ${remSec}s`;
};

const formatTimestamp = (iso) => {
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

const StatusDot = ({ status }) => {
    const s = (status || 'not_run').toLowerCase();
    return <span className={`rc-status-dot ${s}`} title={s} />;
};

const ShiftPill = ({ shift }) => {
    const s = (shift || 'unchanged').toLowerCase();
    const labels = {
        regression: 'REGRESSION',
        fix: 'FIXED',
        unchanged: 'UNCHANGED',
        new_case: 'NEW TEST',
        removed: 'REMOVED'
    };

    return (
        <span className={`rc-shift-pill ${s}`}>
            {s === 'regression' && <AlertTriangle size={11} />}
            {s === 'fix' && <CheckCircle2 size={11} />}
            {s === 'new_case' && <Layers size={11} />}
            {s === 'removed' && <Minus size={11} />}
            {labels[s] || s.toUpperCase()}
        </span>
    );
};

const RunComparisonView = ({ runId, onSwitchToCases }) => {
    const [previousRuns, setPreviousRuns] = useState([]);
    const [selectedBaselineId, setSelectedBaselineId] = useState('');
    const [currentRun, setCurrentRun] = useState(null);
    const [comparison, setComparison] = useState(null);
    const [isLoadingRuns, setIsLoadingRuns] = useState(true);
    const [isComparing, setIsComparing] = useState(false);
    const [error, setError] = useState(null);

    // Filters and search
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'regressions' | 'fixes' | 'unchanged' | 'structural'
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCaseId, setExpandedCaseId] = useState(null);

    // 1. Fetch available runs in workspace to select as candidate baseline
    useEffect(() => {
        let isCurrent = true;
        const fetchRuns = async () => {
            setIsLoadingRuns(true);
            try {
                // Fetch full runs list for the workspace
                const res = await executionService.listRuns({ limit: 60 });
                if (isCurrent && res.success && Array.isArray(res.data)) {
                    // Identify current run
                    const target = res.data.find(r => r.id === runId);
                    if (target) setCurrentRun(target);

                    // Candidate baselines must be from same workspace and not the same run
                    const candidates = res.data.filter(r => r.id !== runId);

                    // Sort candidates: prioritize runs from the exact same test suite
                    candidates.sort((a, b) => {
                        const aSameSuite = target && a.suiteId === target.suiteId ? 1 : 0;
                        const bSameSuite = target && b.suiteId === target.suiteId ? 1 : 0;
                        if (aSameSuite !== bSameSuite) return bSameSuite - aSameSuite;
                        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                    });

                    setPreviousRuns(candidates);
                    if (candidates.length > 0 && !selectedBaselineId) {
                        setSelectedBaselineId(candidates[0].id);
                    }
                }
            } catch (err) {
                console.error('Failed to load candidate baseline runs:', err);
            } finally {
                if (isCurrent) setIsLoadingRuns(false);
            }
        };

        fetchRuns();
        return () => { isCurrent = false; };
    }, [runId]);

    // 2. Perform comparison against selected baseline
    const runComparison = useCallback(async (baselineId) => {
        if (!baselineId || !runId) return;
        setIsComparing(true);
        setError(null);
        try {
            const res = await executionService.compareRuns(runId, baselineId);
            if (res.success && res.data) {
                setComparison(res.data);
            } else {
                setError(res.message || 'Comparison failed between selected execution runs.');
            }
        } catch (err) {
            setError(err.message || 'Failed to compare execution runs.');
        } finally {
            setIsComparing(false);
        }
    }, [runId]);

    useEffect(() => {
        if (selectedBaselineId) {
            runComparison(selectedBaselineId);
        }
    }, [selectedBaselineId, runComparison]);

    const toggleCaseExpand = (id) => {
        setExpandedCaseId(prev => prev === id ? null : id);
    };

    // Client-side export functionality
    const handleExportJSON = () => {
        if (!comparison) return;
        const blob = new Blob([JSON.stringify(comparison, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comparison_${runId.slice(-6)}_vs_${selectedBaselineId.slice(-6)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportCSV = () => {
        if (!comparison) return;
        const rows = [
            ['Test Case ID', 'Title', 'Baseline Status', 'Target Status', 'Outcome Shift', 'Baseline Duration (ms)', 'Target Duration (ms)', 'Duration Delta (ms)']
        ];

        (comparison.outcomeShifts || []).forEach(s => {
            rows.push([
                `"${s.testCaseId || ''}"`,
                `"${(s.title || '').replace(/"/g, '""')}"`,
                s.baselineStatus || '',
                s.targetStatus || '',
                s.type || s.shift || 'unchanged',
                s.baselineDurationMs || 0,
                s.targetDurationMs || 0,
                s.durationDiffMs || 0
            ]);
        });

        const csvContent = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comparison_${runId.slice(-6)}_vs_${selectedBaselineId.slice(-6)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ALL hooks are declared above. Early loading state returns:
    if (isLoadingRuns) {
        return <DataLoadingState message="Loading available execution runs for comparison..." />;
    }

    if (previousRuns.length === 0) {
        return (
            <div className="ws-empty-state" style={{ margin: '3rem 0', textAlign: 'center' }}>
                <GitCompare size={36} color="var(--rc-text-dim)" />
                <h2 style={{ color: '#FFFFFF', marginTop: '0.75rem' }}>No Historical Runs Available</h2>
                <p style={{ color: 'var(--rc-text-muted)', maxWidth: '440px', margin: '0.5rem auto 0' }}>
                    Comparison requires at least two recorded execution runs in this workspace. Execute another run to unlock regression analysis.
                </p>
            </div>
        );
    }

    const deltas = comparison?.deltas || {};
    const shifts = comparison?.outcomeShifts || [];
    const regressions = comparison?.regressions || [];
    const fixes = comparison?.fixes || [];
    const unchanged = comparison?.unchanged || [];
    const newCases = comparison?.newCases || [];
    const removedCases = comparison?.removedCases || [];
    const baseline = comparison?.baselineRun || comparison?.baseline || {};
    const target = comparison?.targetRun || comparison?.target || currentRun || {};
    const coverageComp = comparison?.coverageComparison || {};

    // Identify chronic failures (failed in both runs)
    const chronicFailures = unchanged.filter(c => (c.baselineStatus === 'failed' || c.baselineStatus === 'blocked') && (c.targetStatus === 'failed' || c.targetStatus === 'blocked'));

    // Check suite version compatibility
    const isCompatible = comparison?.isSuiteVersionCompatible ?? (baseline.suiteVersion === target.suiteVersion || !baseline.suiteVersion);

    // Filtered ledger rows
    const allLedgerItems = [
        ...shifts.map(s => ({ ...s, shiftType: s.type || s.shift || 'shift' })),
        ...newCases.map(c => ({
            testCaseId: c.testCaseId,
            title: c.title,
            baselineStatus: 'none',
            targetStatus: c.status,
            shiftType: 'new_case',
            baselineDurationMs: 0,
            targetDurationMs: c.durationMs || 0,
            durationDiffMs: c.durationMs || 0
        })),
        ...removedCases.map(c => ({
            testCaseId: c.testCaseId,
            title: c.title,
            baselineStatus: c.status,
            targetStatus: 'none',
            shiftType: 'removed',
            baselineDurationMs: c.durationMs || 0,
            targetDurationMs: 0,
            durationDiffMs: -(c.durationMs || 0)
        }))
    ];

    const filteredItems = allLedgerItems.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery = !query ||
            (item.testCaseId && item.testCaseId.toLowerCase().includes(query)) ||
            (item.title && item.title.toLowerCase().includes(query));

        if (!matchesQuery) return false;

        if (activeFilter === 'regressions') return item.shiftType === 'regression';
        if (activeFilter === 'fixes') return item.shiftType === 'fix';
        if (activeFilter === 'unchanged') return item.shiftType === 'unchanged';
        if (activeFilter === 'structural') return item.shiftType === 'new_case' || item.shiftType === 'removed';
        return true;
    });

    return (
        <div className="rc-document">
            {/* ─── 1. HEADER & EXPORT ACTIONS ─── */}
            <header className="rc-header">
                <div>
                    <div className="rc-breadcrumb">
                        <NavLink to="/app/runs">Execution</NavLink>
                        <span style={{ color: 'var(--rc-text-dim)' }}>/</span>
                        <span>Run Comparison</span>
                        <span style={{ color: 'var(--rc-text-dim)' }}>/</span>
                        <span style={{ fontFamily: 'var(--rc-mono-font)', color: 'var(--rc-jade)' }}>
                            Run #{String(runId).slice(-8)}
                        </span>
                    </div>

                    <div className="rc-title-row">
                        <h1 className="rc-title">Run Comparison & Regression Analysis</h1>
                        <span style={{
                            padding: '2px 8px',
                            background: 'var(--rc-surface)',
                            border: '1px solid var(--rc-border)',
                            borderRadius: '4px',
                            fontSize: '0.74rem',
                            fontFamily: 'var(--rc-mono-font)',
                            color: 'var(--rc-text-muted)'
                        }}>
                            {target.name || currentRun?.name || 'Target Run'}
                        </span>
                    </div>

                    <div className="rc-context-meta">
                        <span>Suite: <strong style={{ color: '#FFFFFF' }}>{target.suiteName || currentRun?.suiteTitle || 'Test Suite'}</strong></span>
                        <span>•</span>
                        <span>Baseline: <strong style={{ color: '#FFFFFF' }}>{baseline.name || 'Selected Run'}</strong></span>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="rc-actions">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="rc-btn"
                        title="Print comparison view"
                    >
                        <Printer size={12} />
                        <span>Print</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleExportCSV}
                        disabled={!comparison}
                        className="rc-btn"
                        title="Export CSV differential"
                    >
                        <Download size={12} />
                        <span>CSV</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleExportJSON}
                        disabled={!comparison}
                        className="rc-btn"
                        title="Export JSON diff schema"
                    >
                        <FileText size={12} />
                        <span>JSON</span>
                    </button>
                </div>
            </header>

            {/* ─── 2. RUN SELECTOR STRIP ─── */}
            <section className="rc-selector-strip">
                <div className="rc-selector-pair">
                    <div className="rc-run-chip">
                        <span className="rc-chip-label">Baseline Run (Previous Benchmark)</span>
                        <select
                            id="baseline-run-select"
                            value={selectedBaselineId}
                            onChange={(e) => setSelectedBaselineId(e.target.value)}
                            className="rc-select"
                        >
                            {previousRuns.map(r => {
                                const isSameSuite = currentRun && r.suiteId === currentRun.suiteId;
                                return (
                                    <option key={r.id} value={r.id}>
                                        {r.name} {isSameSuite ? '★ (Same Suite)' : ''} — {formatTimestamp(r.createdAt)}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div style={{ color: 'var(--rc-text-dim)', paddingTop: '1rem' }}>
                        <ArrowRight size={16} />
                    </div>

                    <div className="rc-run-chip">
                        <span className="rc-chip-label">Target Run (Current Evaluation)</span>
                        <div className="rc-chip-val" style={{ padding: '0.45rem 0' }}>
                            <span style={{ color: 'var(--rc-jade)', fontFamily: 'var(--rc-mono-font)' }}>#{String(runId).slice(-6)}</span>
                            <span>{target.name || currentRun?.name}</span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--rc-text-dim)' }}>
                                ({target.environment || 'Staging'})
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={() => runComparison(selectedBaselineId)}
                        disabled={isComparing}
                        className="rc-btn"
                        title="Recompute differential analysis"
                    >
                        <RefreshCw size={12} className={isComparing ? 'animate-spin' : ''} />
                        <span>Recompute Diff</span>
                    </button>
                </div>
            </section>

            {/* Version Compatibility Notice */}
            {!isCompatible && (
                <div className="rc-version-warning">
                    <AlertTriangle size={15} />
                    <span>
                        Suite Version Mismatch: Baseline was executed on <strong>v{baseline.suiteVersion || 1}</strong>, while Target is on <strong>v{target.suiteVersion || 1}</strong>. Some test cases may reflect deliberate specification changes.
                    </span>
                </div>
            )}

            {error && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: 'var(--rc-fail-bg)',
                    border: '1px solid var(--rc-fail-border)',
                    borderRadius: '5px',
                    color: 'var(--rc-fail)',
                    fontSize: '0.82rem'
                }}>
                    {error}
                </div>
            )}

            {isComparing ? (
                <DataLoadingState message="Computing differential ledger and regression shifts..." />
            ) : comparison ? (
                <>
                    {/* ─── 3. COMPARISON SUMMARY RIBBON ─── */}
                    <section className="rc-summary-ribbon">
                        <div className="rc-summary-stat">
                            <span className="rc-stat-label">Newly Failed</span>
                            <span className="rc-stat-val regression">{deltas.regressionsCount || 0}</span>
                            <span className="rc-stat-sub">Regressions</span>
                        </div>

                        <div className="rc-summary-stat">
                            <span className="rc-stat-label">Fixed Failures</span>
                            <span className="rc-stat-val fix">{deltas.fixesCount || 0}</span>
                            <span className="rc-stat-sub">Newly passed</span>
                        </div>

                        <div className="rc-summary-stat">
                            <span className="rc-stat-label">Unchanged</span>
                            <span className="rc-stat-val unchanged">{deltas.unchangedCount || 0}</span>
                            <span className="rc-stat-sub">{chronicFailures.length} chronic fails</span>
                        </div>

                        <div className="rc-summary-stat">
                            <span className="rc-stat-label">Added / Removed</span>
                            <span className="rc-stat-val new">+{deltas.newCasesCount || 0} / -{deltas.removedCasesCount || 0}</span>
                            <span className="rc-stat-sub">Structural shifts</span>
                        </div>

                        <div className="rc-summary-stat">
                            <span className="rc-stat-label">Pass Rate Delta</span>
                            <span className={`rc-stat-val ${(deltas.passRateDelta || 0) >= 0 ? 'fix' : 'regression'}`}>
                                {(deltas.passRateDelta || 0) > 0 ? `+${deltas.passRateDelta}%` : `${deltas.passRateDelta || 0}%`}
                            </span>
                            <span className="rc-stat-sub">From {baseline.passRate || 0}% to {target.passRate || 0}%</span>
                        </div>

                        <div className="rc-summary-stat">
                            <span className="rc-stat-label">Duration Impact</span>
                            <span className="rc-stat-val neutral">
                                {(deltas.durationDiffMs || 0) >= 0 ? `+${formatDuration(deltas.durationDiffMs)}` : `-${formatDuration(Math.abs(deltas.durationDiffMs))}`}
                            </span>
                            <span className="rc-stat-sub">Runtime variance</span>
                        </div>
                    </section>

                    {/* ─── 4. DEDICATED REGRESSION & FIX ANALYSIS ─── */}
                    {(regressions.length > 0 || fixes.length > 0 || chronicFailures.length > 0) && (
                        <section className="rc-section">
                            <div className="rc-section-header">
                                <h3 className="rc-section-title">Critical Outcome Shifts</h3>
                                <span style={{ fontSize: '0.74rem', color: 'var(--rc-text-dim)' }}>
                                    {regressions.length} Regressions • {fixes.length} Fixed • {chronicFailures.length} Chronic Fails
                                </span>
                            </div>

                            <div className="rc-highlight-grid">
                                {/* Newly Introduced Regressions */}
                                {regressions.map(r => (
                                    <div key={`reg-${r.testCaseId}`} className="rc-highlight-card regression">
                                        <div className="rc-card-top">
                                            <span className="rc-card-tc-id regression">{r.testCaseId}</span>
                                            <span className="rc-status-transition">
                                                <StatusDot status={r.baselineStatus} />
                                                <span>Passed</span>
                                                <ArrowRight size={12} className="rc-arrow" />
                                                <StatusDot status={r.targetStatus} />
                                                <strong style={{ color: 'var(--rc-fail)' }}>Failed</strong>
                                            </span>
                                        </div>
                                        <h4 className="rc-card-title">{r.title}</h4>
                                        <div className="rc-reason-box">
                                            {r.reason || 'Assertion failure occurred during target run execution.'}
                                        </div>
                                    </div>
                                ))}

                                {/* Fixed Failures */}
                                {fixes.map(f => (
                                    <div key={`fix-${f.testCaseId}`} className="rc-highlight-card fix">
                                        <div className="rc-card-top">
                                            <span className="rc-card-tc-id fix">{f.testCaseId}</span>
                                            <span className="rc-status-transition">
                                                <StatusDot status={f.baselineStatus} />
                                                <span>Failed</span>
                                                <ArrowRight size={12} className="rc-arrow" />
                                                <StatusDot status={f.targetStatus} />
                                                <strong style={{ color: 'var(--rc-jade)' }}>Passed</strong>
                                            </span>
                                        </div>
                                        <h4 className="rc-card-title">{f.title}</h4>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--rc-jade)' }}>
                                            ✓ Previously failing assertion now resolves successfully.
                                        </div>
                                    </div>
                                ))}

                                {/* Chronic Failures (Failing in both) */}
                                {chronicFailures.map(cf => (
                                    <div key={`chronic-${cf.testCaseId}`} className="rc-highlight-card chronic">
                                        <div className="rc-card-top">
                                            <span className="rc-card-tc-id chronic">{cf.testCaseId}</span>
                                            <span className="rc-status-transition">
                                                <StatusDot status="failed" />
                                                <span>Still Failing</span>
                                            </span>
                                        </div>
                                        <h4 className="rc-card-title">{cf.title}</h4>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--rc-warn)' }}>
                                            ⚠️ Chronic failure: Unresolved across both baseline and target executions.
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ─── 5. COVERAGE COMPARISON ─── */}
                    {coverageComp.targetVerificationPct !== undefined && (
                        <section className="rc-section">
                            <h3 className="rc-section-title">Requirement Coverage Shift</h3>
                            <div className="rc-coverage-box">
                                <div className="rc-coverage-header">
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--rc-text)', fontFamily: 'var(--rc-mono-font)' }}>
                                            {coverageComp.targetVerificationPct}%
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--rc-text-muted)' }}>
                                            Requirement Verification (Baseline: {coverageComp.baselineVerificationPct}%,
                                            <strong style={{ color: coverageComp.verificationDeltaPct >= 0 ? 'var(--rc-jade)' : 'var(--rc-fail)', marginLeft: '4px' }}>
                                                {coverageComp.verificationDeltaPct >= 0 ? `+${coverageComp.verificationDeltaPct}%` : `${coverageComp.verificationDeltaPct}%`}
                                            </strong>)
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--rc-text-dim)' }}>
                                        Verified: {coverageComp.targetVerifiedCount} • Uncovered: {coverageComp.targetUncoveredCount}
                                    </div>
                                </div>

                                <div className="rc-coverage-track">
                                    <div style={{ width: `${coverageComp.targetVerificationPct}%`, background: 'var(--rc-jade)', height: '100%' }} />
                                </div>

                                {/* Shift details if any */}
                                {((coverageComp.newlyCovered || []).length > 0 || (coverageComp.newlyUncovered || []).length > 0) && (
                                    <div className="rc-req-shifts-list">
                                        {(coverageComp.newlyCovered || []).map(req => (
                                            <div key={`cov-${req.id}`} className="rc-req-shift-item">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontFamily: 'var(--rc-mono-font)', color: 'var(--rc-jade)' }}>{req.id}</span>
                                                    <span style={{ color: 'var(--rc-text)' }}>{req.description}</span>
                                                </div>
                                                <span style={{ color: 'var(--rc-jade)', fontSize: '0.72rem', fontWeight: 600 }}>NEWLY COVERED</span>
                                            </div>
                                        ))}
                                        {(coverageComp.newlyUncovered || []).map(req => (
                                            <div key={`uncov-${req.id}`} className="rc-req-shift-item">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontFamily: 'var(--rc-mono-font)', color: 'var(--rc-warn)' }}>{req.id}</span>
                                                    <span style={{ color: 'var(--rc-text)' }}>{req.description}</span>
                                                </div>
                                                <span style={{ color: 'var(--rc-warn)', fontSize: '0.72rem', fontWeight: 600 }}>NEWLY UNCOVERED</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ─── 6. RESULT COMPARISON TABLE & FILTERS ─── */}
                    <section className="rc-section">
                        <div className="rc-filter-bar">
                            <div className="rc-filter-tabs">
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('all')}
                                    className={`rc-tab-pill ${activeFilter === 'all' ? 'active' : ''}`}
                                >
                                    All Changes ({allLedgerItems.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('regressions')}
                                    className={`rc-tab-pill ${activeFilter === 'regressions' ? 'active' : ''}`}
                                >
                                    Regressions ({regressions.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('fixes')}
                                    className={`rc-tab-pill ${activeFilter === 'fixes' ? 'active' : ''}`}
                                >
                                    Fixed ({fixes.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('unchanged')}
                                    className={`rc-tab-pill ${activeFilter === 'unchanged' ? 'active' : ''}`}
                                >
                                    Unchanged ({unchanged.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('structural')}
                                    className={`rc-tab-pill ${activeFilter === 'structural' ? 'active' : ''}`}
                                >
                                    Added/Removed ({newCases.length + removedCases.length})
                                </button>
                            </div>

                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filter tests by ID or name..."
                                className="rc-search-input"
                            />
                        </div>

                        <div className="rc-table-wrap">
                            <table className="rc-table">
                                <thead>
                                    <tr>
                                        <th>Test Case ID</th>
                                        <th>Test Name</th>
                                        <th>Baseline Result</th>
                                        <th>Latest Result</th>
                                        <th>Classification</th>
                                        <th>Duration Impact</th>
                                        <th style={{ width: '24px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--rc-text-dim)' }}>
                                                No test cases match the selected filter criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map(item => {
                                            const isExpanded = expandedCaseId === item.testCaseId;

                                            return (
                                                <React.Fragment key={item.testCaseId}>
                                                    <tr
                                                        className="clickable"
                                                        onClick={() => toggleCaseExpand(item.testCaseId)}
                                                        title="Click to toggle execution details"
                                                    >
                                                        <td style={{ fontFamily: 'var(--rc-mono-font)', color: 'var(--rc-jade)', fontSize: '0.8rem' }}>
                                                            {item.testCaseId}
                                                        </td>
                                                        <td style={{ color: 'var(--rc-text)', fontWeight: 500 }}>
                                                            {item.title}
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                <StatusDot status={item.baselineStatus} />
                                                                <span style={{ textTransform: 'capitalize' }}>
                                                                    {item.baselineStatus}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                <StatusDot status={item.targetStatus} />
                                                                <span style={{ textTransform: 'capitalize', fontWeight: 500, color: item.targetStatus === 'failed' ? 'var(--rc-fail)' : 'inherit' }}>
                                                                    {item.targetStatus}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <ShiftPill shift={item.shiftType} />
                                                        </td>
                                                        <td style={{ fontFamily: 'var(--rc-mono-font)', fontSize: '0.78rem', color: 'var(--rc-text-dim)' }}>
                                                            {formatDuration(item.targetDurationMs)}
                                                            {item.durationDiffMs !== undefined && item.durationDiffMs !== 0 && (
                                                                <span style={{ marginLeft: '4px', color: item.durationDiffMs > 0 ? 'var(--rc-warn)' : 'var(--rc-jade)' }}>
                                                                    ({item.durationDiffMs > 0 ? `+${formatDuration(item.durationDiffMs)}` : `-${formatDuration(Math.abs(item.durationDiffMs))}`})
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ color: 'var(--rc-text-dim)' }}>
                                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </td>
                                                    </tr>

                                                    {/* Expandable Execution Details */}
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={7} style={{ padding: 0 }}>
                                                                <div style={{
                                                                    background: 'var(--rc-surface)',
                                                                    borderBottom: '1px solid var(--rc-border)',
                                                                    padding: '0.85rem 1.25rem',
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                                                    gap: '1rem',
                                                                    fontSize: '0.8rem'
                                                                }}>
                                                                    <div>
                                                                        <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--rc-text-dim)', fontWeight: 600 }}>
                                                                            Execution Method
                                                                        </span>
                                                                        <div style={{ color: 'var(--rc-text)', marginTop: '2px' }}>
                                                                            {item.executionType === 'automated' ? 'Playwright Automated' : 'Manual Verification'}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--rc-text-dim)', fontWeight: 600 }}>
                                                                            Baseline Duration
                                                                        </span>
                                                                        <div style={{ color: 'var(--rc-text)', marginTop: '2px', fontFamily: 'var(--rc-mono-font)' }}>
                                                                            {formatDuration(item.baselineDurationMs)}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--rc-text-dim)', fontWeight: 600 }}>
                                                                            Target Duration
                                                                        </span>
                                                                        <div style={{ color: 'var(--rc-text)', marginTop: '2px', fontFamily: 'var(--rc-mono-font)' }}>
                                                                            {formatDuration(item.targetDurationMs)}
                                                                        </div>
                                                                    </div>
                                                                    {item.reason && (
                                                                        <div style={{ gridColumn: '1 / -1' }}>
                                                                            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--rc-fail)', fontWeight: 600 }}>
                                                                                Failure Reason / Assertion Note
                                                                            </span>
                                                                            <div style={{ color: 'var(--rc-fail)', marginTop: '2px', fontFamily: 'var(--rc-mono-font)', fontSize: '0.78rem' }}>
                                                                                {typeof item.reason === 'object' ? JSON.stringify(item.reason) : item.reason}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            ) : null}
        </div>
    );
};

export default RunComparisonView;
