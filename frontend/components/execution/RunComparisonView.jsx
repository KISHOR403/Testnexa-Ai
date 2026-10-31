import React, { useState, useEffect, useCallback } from 'react';
import {
    GitCompare, AlertTriangle, CheckCircle2, XCircle, Clock,
    ArrowRight, RefreshCw, Layers, TrendingUp, TrendingDown,
    Minus, AlertCircle
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../loading';
import '../../styles/app/WorkspaceDesignSystem.css';

const formatDuration = (ms) => {
    if (!ms || ms <= 0) return '0s';
    if (ms < 1000) return `${ms}ms`;
    const sec = (ms / 1000).toFixed(1);
    return `${sec}s`;
};

const StatusPill = ({ status }) => {
    const s = (status || 'not_run').toLowerCase();
    const config = {
        passed: { label: 'Passed', bg: 'rgba(139, 175, 154, 0.15)', color: '#8BAF9A' },
        failed: { label: 'Failed', bg: 'rgba(224, 108, 117, 0.15)', color: '#E06C75' },
        blocked: { label: 'Blocked', bg: 'rgba(229, 192, 123, 0.15)', color: '#E5C07B' },
        skipped: { label: 'Skipped', bg: 'rgba(198, 120, 221, 0.15)', color: '#C678DD' },
        not_run: { label: 'Not Run', bg: 'rgba(255, 255, 255, 0.05)', color: '#A0A5A5' }
    }[s] || { label: status, bg: '#161819', color: '#F2F3F3' };

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            background: config.bg,
            color: config.color
        }}>
            {config.label}
        </span>
    );
};

const ShiftBadge = ({ shift }) => {
    const config = {
        regression: { label: 'REGRESSION', bg: 'rgba(224, 108, 117, 0.2)', color: '#E06C75', icon: AlertTriangle },
        fix: { label: 'FIXED', bg: 'rgba(139, 175, 154, 0.2)', color: '#8BAF9A', icon: CheckCircle2 },
        new_case: { label: 'NEW TEST', bg: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', icon: Layers },
        removed: { label: 'REMOVED', bg: 'rgba(160, 165, 165, 0.15)', color: '#A0A5A5', icon: Minus },
        unchanged: { label: 'UNCHANGED', bg: 'rgba(255, 255, 255, 0.04)', color: '#6A6F6F', icon: Minus }
    }[shift] || { label: shift, bg: '#161819', color: '#A0A5A5', icon: Minus };

    const Icon = config.icon;

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            background: config.bg,
            color: config.color
        }}>
            <Icon size={11} />
            {config.label}
        </span>
    );
};

const RunComparisonView = ({ runId, currentRun }) => {
    const [previousRuns, setPreviousRuns] = useState([]);
    const [selectedBaselineId, setSelectedBaselineId] = useState('');
    const [comparison, setComparison] = useState(null);
    const [isLoadingRuns, setIsLoadingRuns] = useState(true);
    const [isComparing, setIsComparing] = useState(false);
    const [error, setError] = useState(null);

    // 1. Fetch available runs to select as baseline
    useEffect(() => {
        let isCurrent = true;
        const fetchRuns = async () => {
            setIsLoadingRuns(true);
            try {
                const res = await executionService.listRuns({ limit: 50 });
                if (isCurrent && res.success && Array.isArray(res.data)) {
                    // Filter out the current run from the candidate baseline list
                    const candidates = res.data.filter(r => r.id !== runId);
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

    if (isLoadingRuns) {
        return <DataLoadingState message="Loading available execution runs for comparison..." />;
    }

    if (previousRuns.length === 0) {
        return (
            <div className="ws-empty-state" style={{ margin: '2rem 0' }}>
                <GitCompare size={36} color="#A0A5A5" />
                <h2>No Previous Runs Available</h2>
                <p>
                    Run comparison requires at least two completed or recorded execution runs in your workspace.
                </p>
            </div>
        );
    }

    const deltas = comparison?.deltas || {};
    const shifts = comparison?.outcomeShifts || [];
    const baseline = comparison?.baseline || {};
    const target = comparison?.target || {};

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
            {/* ─── 1. Baseline Selector Bar ─── */}
            <div style={{
                background: '#161819',
                border: '1px solid #292D2D',
                borderRadius: '8px',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#F2F3F3' }}>
                        Execution Differential Analysis
                    </h2>
                    <p style={{ margin: '2px 0 0', color: '#A0A5A5', fontSize: '0.82rem' }}>
                        Compare current run <strong style={{ color: '#F2F3F3' }}>{target.name || currentRun?.name}</strong> against a baseline attempt.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label htmlFor="baseline-select" style={{ fontSize: '0.82rem', color: '#A0A5A5' }}>
                        Baseline Run:
                    </label>
                    <select
                        id="baseline-select"
                        value={selectedBaselineId}
                        onChange={(e) => setSelectedBaselineId(e.target.value)}
                        style={{
                            background: '#0D0E0E',
                            border: '1px solid #292D2D',
                            color: '#F2F3F3',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            minWidth: '240px'
                        }}
                    >
                        {previousRuns.map(r => (
                            <option key={r.id} value={r.id}>
                                {r.name} ({r.executionType || 'manual'}) — {r.status}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={() => runComparison(selectedBaselineId)}
                        disabled={isComparing}
                        className="ws-btn-secondary"
                        title="Recompute comparison"
                    >
                        <RefreshCw size={13} className={isComparing ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(224, 108, 117, 0.12)',
                    border: '1px solid rgba(224, 108, 117, 0.3)',
                    borderRadius: '6px',
                    color: '#E06C75',
                    fontSize: '0.85rem'
                }}>
                    {error}
                </div>
            )}

            {isComparing ? (
                <DataLoadingState message="Computing regression differential and outcome shifts..." />
            ) : comparison ? (
                <>
                    {/* ─── 2. Comparative Metric Deltas ─── */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                        gap: '12px'
                    }}>
                        <div className="ws-stat-card" style={{ borderColor: deltas.regressions > 0 ? 'rgba(224, 108, 117, 0.4)' : '#292D2D' }}>
                            <span className="ws-stat-label">REGRESSIONS</span>
                            <span className="ws-stat-value" style={{ color: deltas.regressions > 0 ? '#E06C75' : '#8BAF9A' }}>
                                {deltas.regressions}
                            </span>
                            <span className="ws-stat-sub">Passed in baseline, failed now</span>
                        </div>

                        <div className="ws-stat-card" style={{ borderColor: deltas.fixes > 0 ? 'rgba(139, 175, 154, 0.4)' : '#292D2D' }}>
                            <span className="ws-stat-label">FIXES CONFIRMED</span>
                            <span className="ws-stat-value" style={{ color: '#8BAF9A' }}>
                                {deltas.fixes}
                            </span>
                            <span className="ws-stat-sub">Failed previously, now passing</span>
                        </div>

                        <div className="ws-stat-card">
                            <span className="ws-stat-label">UNCHANGED</span>
                            <span className="ws-stat-value">{deltas.unchanged}</span>
                            <span className="ws-stat-sub">Identical outcome</span>
                        </div>

                        <div className="ws-stat-card">
                            <span className="ws-stat-label">PASS RATE DELTA</span>
                            <span className="ws-stat-value" style={{
                                color: (deltas.passRateDelta || 0) > 0 ? '#8BAF9A' : (deltas.passRateDelta || 0) < 0 ? '#E06C75' : '#F2F3F3'
                            }}>
                                {(deltas.passRateDelta || 0) > 0 ? `+${deltas.passRateDelta}%` : `${deltas.passRateDelta || 0}%`}
                            </span>
                            <span className="ws-stat-sub">
                                Baseline: {baseline.summary?.passRate || 0}% → Now: {target.summary?.passRate || 0}%
                            </span>
                        </div>

                        <div className="ws-stat-card">
                            <span className="ws-stat-label">DURATION DELTA</span>
                            <span className="ws-stat-value">
                                {(deltas.durationDeltaMs || 0) >= 0 ? `+${formatDuration(deltas.durationDeltaMs)}` : `-${formatDuration(Math.abs(deltas.durationDeltaMs))}`}
                            </span>
                            <span className="ws-stat-sub">Net execution runtime</span>
                        </div>
                    </div>

                    {/* ─── 3. Side-by-Side Test Case Shifts Table ─── */}
                    <div style={{
                        background: '#161819',
                        border: '1px solid #292D2D',
                        borderRadius: '8px',
                        padding: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#F2F3F3' }}>
                                Test Case Outcome Shift Ledger
                            </h2>
                            <span style={{ fontSize: '0.8rem', color: '#A0A5A5' }}>
                                {shifts.length} Test Cases Evaluated
                            </span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #292D2D', textAlign: 'left', color: '#A0A5A5' }}>
                                        <th style={{ padding: '8px' }}>Test Case</th>
                                        <th style={{ padding: '8px' }}>Baseline Status</th>
                                        <th style={{ padding: '8px' }}>Current Status</th>
                                        <th style={{ padding: '8px' }}>Outcome Shift</th>
                                        <th style={{ padding: '8px' }}>Duration Impact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shifts.map((s, idx) => (
                                        <tr key={s.testCaseId || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                            <td style={{ padding: '10px 8px' }}>
                                                <div style={{ fontFamily: 'monospace', color: '#38BDF8', fontSize: '0.8rem' }}>
                                                    {s.testCaseId}
                                                </div>
                                                <div style={{ color: '#F2F3F3', fontWeight: 500, fontSize: '0.85rem', marginTop: '2px' }}>
                                                    {s.title}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 8px' }}>
                                                <StatusPill status={s.baselineStatus} />
                                            </td>
                                            <td style={{ padding: '10px 8px' }}>
                                                <StatusPill status={s.targetStatus} />
                                            </td>
                                            <td style={{ padding: '10px 8px' }}>
                                                <ShiftBadge shift={s.shift} />
                                            </td>
                                            <td style={{ padding: '10px 8px', color: '#A0A5A5', fontSize: '0.8rem' }}>
                                                {formatDuration(s.targetDurationMs)} {s.durationDeltaMs ? `(${s.durationDeltaMs >= 0 ? '+' : ''}${formatDuration(s.durationDeltaMs)})` : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default RunComparisonView;
