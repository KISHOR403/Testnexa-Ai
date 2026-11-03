import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Activity, RefreshCw, Layers, AlertTriangle, CheckCircle2,
    XCircle, Clock, Monitor, Globe, ChevronRight, ArrowUpRight,
    AlertCircle, TrendingDown, TrendingUp, Minus, ShieldCheck,
    GitBranch, Play, ExternalLink, Filter, HelpCircle
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { sessionService } from '../../services/sessionService';
import IntelligenceActivityChart from '../../components/intelligence/IntelligenceActivityChart';
import '../../styles/app/ExecutionIntelligence.css';

const DATE_PRESETS = [
    { label: '7D', days: 7 },
    { label: '14D', days: 14 },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 }
];

export const ExecutionIntelligenceDashboardPage = () => {
    // Filter State
    const [selectedDays, setSelectedDays] = useState(30);
    const [interval, setInterval] = useState('daily');
    const [selectedSuiteId, setSelectedSuiteId] = useState('all');
    const [selectedBrowser, setSelectedBrowser] = useState('all');
    const [selectedEnvironment, setSelectedEnvironment] = useState('all');
    const [selectedMethod, setSelectedMethod] = useState('all');

    // Data State
    const [suites, setSuites] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Load available test suites
    useEffect(() => {
        const loadSuites = async () => {
            try {
                const res = await sessionService.list({ page: 1, limit: 100 });
                if (res?.success && Array.isArray(res.data)) {
                    setSuites(res.data);
                }
            } catch (err) {
                console.warn('Could not load test suites:', err.message);
            }
        };
        loadSuites();
    }, []);

    // Load Execution Intelligence Dashboard data
    const loadDashboard = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const startDate = new Date(Date.now() - (selectedDays * 24 * 60 * 60 * 1000)).toISOString();
            const res = await executionService.getIntelligenceDashboard({
                suiteId: selectedSuiteId !== 'all' ? selectedSuiteId : undefined,
                interval,
                startDate,
                browser: selectedBrowser !== 'all' ? selectedBrowser : undefined,
                environment: selectedEnvironment !== 'all' ? selectedEnvironment : undefined,
                executionMethod: selectedMethod !== 'all' ? selectedMethod : undefined
            });

            if (res?.success && res.data) {
                setDashboardData(res.data);
            } else {
                throw new Error(res?.message || 'Failed to fetch execution intelligence data');
            }
        } catch (err) {
            setError(err.message || 'Error loading dashboard');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedDays, interval, selectedSuiteId, selectedBrowser, selectedEnvironment, selectedMethod]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    // Helpers
    const formatDuration = (ms) => {
        if (!ms || ms <= 0) return '0s';
        if (ms < 1000) return `${ms}ms`;
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remSecs = seconds % 60;
        return `${minutes}m ${remSecs}s`;
    };

    const formatDate = (isoString) => {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const health = dashboardData?.healthSummary || {
        totalCompletedRuns: 0,
        totalExecutedCases: 0,
        passedCases: 0,
        failedCases: 0,
        blockedCases: 0,
        skippedCases: 0,
        passRate: 0,
        failureRate: 0,
        qualityTrajectory: 'steady',
        trajectoryDelta: 0
    };

    const signals = dashboardData?.qualitySignals || {
        flakyTestsCount: 0,
        recurringSignaturesCount: 0,
        newFailuresCount: 0,
        resolvedFailuresCount: 0,
        rerunFixRate: 0,
        uncoveredRequirementsCount: 0
    };

    const coverage = dashboardData?.coverageOverview || {
        totalRequirements: 0,
        linkedRequirements: 0,
        verifiedRequirements: 0,
        uncoveredRequirements: 0,
        failingRequirements: 0,
        linkedCoveragePct: 0,
        verifiedCoveragePct: 0,
        uncoveredList: []
    };

    const attentionQueue = dashboardData?.attentionQueue || [];
    const recentRuns = dashboardData?.recentRuns || [];
    const timeSeries = dashboardData?.activityChart?.timeSeries || [];

    return (
        <div className="eid-container">
            {/* ─── 1. Header & Filters ─── */}
            <header className="eid-header">
                <div className="eid-header-titles">
                    <div className="eid-badge-eyebrow">
                        <Activity size={14} />
                        <span>Execution Intelligence</span>
                    </div>
                    <h1 className="eid-title">QA Health & Execution Intelligence</h1>
                    <p className="eid-subtitle">
                        Unified operational overview of test health, quality trajectory, and requirement verification.
                    </p>
                </div>

                <div className="eid-filter-bar">
                    {/* Suite filter */}
                    <select
                        className="eid-select"
                        value={selectedSuiteId}
                        onChange={(e) => setSelectedSuiteId(e.target.value)}
                        aria-label="Filter by Test Suite"
                    >
                        <option value="all">All Test Suites</option>
                        {suites.map((s) => (
                            <option key={s.id || s._id} value={s.id || s._id}>
                                {s.title || s.suiteData?.testSuiteName || 'Untitled Suite'}
                            </option>
                        ))}
                    </select>

                    {/* Date Presets */}
                    <div className="eid-preset-tabs">
                        {DATE_PRESETS.map((dp) => (
                            <button
                                key={dp.days}
                                type="button"
                                className={`eid-preset-btn ${selectedDays === dp.days ? 'active' : ''}`}
                                onClick={() => setSelectedDays(dp.days)}
                            >
                                {dp.label}
                            </button>
                        ))}
                    </div>

                    {/* Browser filter */}
                    <select
                        className="eid-select"
                        value={selectedBrowser}
                        onChange={(e) => setSelectedBrowser(e.target.value)}
                        aria-label="Filter by Browser"
                    >
                        <option value="all">All Browsers</option>
                        <option value="chromium">Chromium</option>
                        <option value="firefox">Firefox</option>
                        <option value="webkit">WebKit</option>
                    </select>

                    {/* Environment filter */}
                    <select
                        className="eid-select"
                        value={selectedEnvironment}
                        onChange={(e) => setSelectedEnvironment(e.target.value)}
                        aria-label="Filter by Environment"
                    >
                        <option value="all">All Environments</option>
                        <option value="staging">Staging</option>
                        <option value="production">Production</option>
                        <option value="local">Local</option>
                        <option value="ci">CI/CD</option>
                    </select>

                    {/* Refresh action */}
                    <button
                        type="button"
                        className="eid-action-btn"
                        onClick={() => loadDashboard(true)}
                        disabled={isLoading || isRefreshing}
                        title="Refresh data"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </header>

            {error && (
                <div style={{
                    padding: '0.85rem 1.25rem',
                    background: 'var(--eid-fail-bg)',
                    border: '1px solid var(--eid-fail-border)',
                    borderRadius: '8px',
                    color: 'var(--eid-fail)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* ─── 2. Compact Execution Health Summary Bar ─── */}
            <section className="eid-health-bar" aria-label="Execution Health Summary">
                <div className="eid-health-stats">
                    <div className="eid-stat-item">
                        <span className="eid-stat-label">Completed Runs</span>
                        <span className="eid-stat-value">{health.totalCompletedRuns}</span>
                    </div>

                    <div className="eid-stat-divider" />

                    <div className="eid-stat-item">
                        <span className="eid-stat-label">Executed Cases</span>
                        <span className="eid-stat-value">{health.totalExecutedCases}</span>
                    </div>

                    <div className="eid-stat-divider" />

                    <div className="eid-stat-item">
                        <span className="eid-stat-label">Passed Cases</span>
                        <span className="eid-stat-value pass">{health.passedCases}</span>
                    </div>

                    <div className="eid-stat-item">
                        <span className="eid-stat-label">Failed Cases</span>
                        <span className="eid-stat-value fail">{health.failedCases}</span>
                    </div>

                    <div className="eid-stat-divider" />

                    <div className="eid-stat-item">
                        <span className="eid-stat-label">Pass Rate</span>
                        <span className="eid-stat-value pass">{health.passRate}%</span>
                    </div>

                    <div className="eid-stat-item">
                        <span className="eid-stat-label">Failure Rate</span>
                        <span className="eid-stat-value fail">{health.failureRate}%</span>
                    </div>
                </div>

                {/* Trajectory Indicator */}
                <div>
                    {health.qualityTrajectory === 'improving' && (
                        <div className="eid-trajectory-badge improving" title="Failure rate dropped in recent executions">
                            <TrendingDown size={15} />
                            <span>Improving Trajectory ({health.trajectoryDelta}%)</span>
                        </div>
                    )}
                    {health.qualityTrajectory === 'declining' && (
                        <div className="eid-trajectory-badge declining" title="Failure rate increased in recent executions">
                            <TrendingUp size={15} />
                            <span>Declining Trajectory (+{health.trajectoryDelta}%)</span>
                        </div>
                    )}
                    {health.qualityTrajectory === 'steady' && (
                        <div className="eid-trajectory-badge steady" title="Failure rate is consistent across analyzed period">
                            <Minus size={15} />
                            <span>Steady Quality ({health.trajectoryDelta}%)</span>
                        </div>
                    )}
                </div>
            </section>

            {/* ─── 3. Quality Signals Strip ─── */}
            <section className="eid-signals-strip" aria-label="Quality Signals">
                <Link to="/app/flaky-tests" className="eid-signal-card">
                    <div className="eid-signal-info">
                        <span className="eid-signal-title">Potentially Flaky</span>
                        <span className="eid-signal-count" style={{ color: signals.flakyTestsCount > 0 ? 'var(--eid-warn)' : '#FFFFFF' }}>
                            {signals.flakyTestsCount}
                        </span>
                    </div>
                    <div className="eid-signal-icon-box" style={{ background: 'var(--eid-warn-bg)', color: 'var(--eid-warn)' }}>
                        <AlertTriangle size={18} />
                    </div>
                </Link>

                <Link to="/app/failure-trends" className="eid-signal-card">
                    <div className="eid-signal-info">
                        <span className="eid-signal-title">Recurring Signatures</span>
                        <span className="eid-signal-count" style={{ color: signals.recurringSignaturesCount > 0 ? 'var(--eid-fail)' : '#FFFFFF' }}>
                            {signals.recurringSignaturesCount}
                        </span>
                    </div>
                    <div className="eid-signal-icon-box" style={{ background: 'var(--eid-fail-bg)', color: 'var(--eid-fail)' }}>
                        <XCircle size={18} />
                    </div>
                </Link>

                <Link to="/app/failure-trends" className="eid-signal-card">
                    <div className="eid-signal-info">
                        <span className="eid-signal-title">New Failure Patterns</span>
                        <span className="eid-signal-count" style={{ color: signals.newFailuresCount > 0 ? '#FFA726' : '#FFFFFF' }}>
                            {signals.newFailuresCount}
                        </span>
                    </div>
                    <div className="eid-signal-icon-box" style={{ background: 'rgba(255, 152, 0, 0.15)', color: '#FFA726' }}>
                        <Activity size={18} />
                    </div>
                </Link>

                <div className="eid-signal-card" style={{ cursor: 'default' }}>
                    <div className="eid-signal-info">
                        <span className="eid-signal-title">Resolved Failures</span>
                        <span className="eid-signal-count" style={{ color: 'var(--eid-pass)' }}>
                            {signals.resolvedFailuresCount}
                        </span>
                    </div>
                    <div className="eid-signal-icon-box" style={{ background: 'var(--eid-pass-bg)', color: 'var(--eid-pass)' }}>
                        <CheckCircle2 size={18} />
                    </div>
                </div>

                <div className="eid-signal-card" style={{ cursor: 'default' }}>
                    <div className="eid-signal-info">
                        <span className="eid-signal-title">Rerun Fix Rate</span>
                        <span className="eid-signal-count" style={{ color: 'var(--eid-jade)' }}>
                            {signals.rerunFixRate}%
                        </span>
                    </div>
                    <div className="eid-signal-icon-box" style={{ background: 'var(--eid-jade-glow)', color: 'var(--eid-jade)' }}>
                        <GitBranch size={18} />
                    </div>
                </div>

                <Link to="/app/traceability" className="eid-signal-card">
                    <div className="eid-signal-info">
                        <span className="eid-signal-title">Coverage Gaps</span>
                        <span className="eid-signal-count" style={{ color: signals.uncoveredRequirementsCount > 0 ? 'var(--eid-info)' : '#FFFFFF' }}>
                            {signals.uncoveredRequirementsCount}
                        </span>
                    </div>
                    <div className="eid-signal-icon-box" style={{ background: 'var(--eid-info-bg)', color: 'var(--eid-info)' }}>
                        <ShieldCheck size={18} />
                    </div>
                </Link>
            </section>

            {/* ─── 4. Main Two-Column Analytics Layout ─── */}
            <div className="eid-main-grid">
                {/* LEFT COLUMN: Activity Chart + Recent Runs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Execution Activity Chart */}
                    <div className="eid-panel">
                        <div className="eid-panel-header">
                            <h2 className="eid-panel-title">
                                <Activity size={16} style={{ color: 'var(--eid-jade)' }} />
                                <span>Execution Volume & Outcomes</span>
                            </h2>
                        </div>
                        <div className="eid-panel-body">
                            <IntelligenceActivityChart
                                timeSeries={timeSeries}
                                interval={interval}
                                onIntervalChange={(newInt) => setInterval(newInt)}
                                isLoading={isLoading}
                            />
                        </div>
                    </div>

                    {/* Recent Execution Activity */}
                    <div className="eid-panel">
                        <div className="eid-panel-header">
                            <h2 className="eid-panel-title">
                                <Clock size={16} style={{ color: 'var(--eid-jade)' }} />
                                <span>Recent Executions</span>
                            </h2>
                            <Link to="/app/runs" className="eid-action-btn" style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}>
                                <span>All Runs</span>
                                <ChevronRight size={13} />
                            </Link>
                        </div>
                        <div className="eid-panel-body" style={{ padding: 0 }}>
                            {recentRuns.length === 0 ? (
                                <div className="eid-empty-state">
                                    <div className="eid-empty-icon"><Clock size={20} /></div>
                                    <p className="eid-empty-title">No executions recorded yet</p>
                                    <p className="eid-empty-desc">Run tests manually or launch Playwright automation to see activity here.</p>
                                </div>
                            ) : (
                                <table className="eid-runs-table">
                                    <thead>
                                        <tr>
                                            <th>Run / Suite</th>
                                            <th>Status</th>
                                            <th>Method</th>
                                            <th>Results</th>
                                            <th>Duration</th>
                                            <th>Started</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentRuns.map((r) => (
                                            <tr key={r.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{r.name}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--eid-text-subtle)' }}>ID: {r.id.slice(-8)}</div>
                                                </td>
                                                <td>
                                                    <span className={`eid-run-status-badge ${r.status}`}>
                                                        {r.status === 'in_progress' && <span className="animate-spin" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
                                                        {r.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ textTransform: 'capitalize', color: 'var(--eid-text-muted)' }}>{r.executionType}</span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem' }}>
                                                        <span style={{ color: 'var(--eid-pass)', fontWeight: 600 }}>{r.passCount}P</span>
                                                        {r.failCount > 0 && <span style={{ color: 'var(--eid-fail)', fontWeight: 600 }}>{r.failCount}F</span>}
                                                        <span style={{ color: 'var(--eid-text-subtle)' }}>/ {r.totalCases}</span>
                                                    </div>
                                                </td>
                                                <td style={{ color: 'var(--eid-text-muted)' }}>{formatDuration(r.durationMs)}</td>
                                                <td style={{ color: 'var(--eid-text-subtle)' }}>{formatDate(r.startedAt)}</td>
                                                <td>
                                                    <Link to={r.reportUrl || `/app/runs/${r.id}?tab=report`} className="eid-action-btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}>
                                                        <span>Report</span>
                                                        <ArrowUpRight size={12} />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Needs Attention Triage Queue + Requirement Coverage */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Needs Attention Priority Queue */}
                    <div className="eid-panel">
                        <div className="eid-panel-header">
                            <h2 className="eid-panel-title">
                                <AlertCircle size={16} style={{ color: 'var(--eid-fail)' }} />
                                <span>Needs Immediate Attention</span>
                            </h2>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--eid-text-subtle)' }}>
                                {attentionQueue.length} issues
                            </span>
                        </div>
                        <div className="eid-panel-body">
                            {attentionQueue.length === 0 ? (
                                <div className="eid-empty-state" style={{ padding: '1.5rem 1rem' }}>
                                    <div className="eid-empty-icon" style={{ color: 'var(--eid-pass)' }}>
                                        <CheckCircle2 size={22} />
                                    </div>
                                    <p className="eid-empty-title">All Quiet</p>
                                    <p className="eid-empty-desc">No active regressions, recurring failure patterns, or coverage gaps detected.</p>
                                </div>
                            ) : (
                                <div className="eid-attention-list">
                                    {attentionQueue.map((item) => (
                                        <div key={item.id} className="eid-attention-item">
                                            <div className="eid-attention-main">
                                                <div className="eid-attention-header">
                                                    <span className={`eid-badge-pill ${
                                                        item.badge === 'RECURRING' ? 'recurring' :
                                                        item.badge === 'POTENTIAL FLAKE' ? 'flake' :
                                                        item.badge === 'COVERAGE GAP' ? 'coverage' : 'new'
                                                    }`}>
                                                        {item.badge}
                                                    </span>
                                                    <span className="eid-attention-title">{item.title}</span>
                                                </div>
                                                <div className="eid-attention-desc">{item.description}</div>
                                                {item.lastOccurred && (
                                                    <div className="eid-attention-meta">
                                                        <span>Last seen: {formatDate(item.lastOccurred)}</span>
                                                        {item.affectedCount && <span>{item.affectedCount} case(s) affected</span>}
                                                    </div>
                                                )}
                                            </div>
                                            <Link to={item.actionUrl} className="eid-attention-action">
                                                <span>{item.actionLabel || 'Inspect'}</span>
                                                <ArrowUpRight size={13} />
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Requirement Coverage & Verification Overview */}
                    <div className="eid-panel">
                        <div className="eid-panel-header">
                            <h2 className="eid-panel-title">
                                <ShieldCheck size={16} style={{ color: 'var(--eid-jade)' }} />
                                <span>Requirement Coverage</span>
                            </h2>
                            <Link to="/app/traceability" className="eid-action-btn" style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}>
                                <span>Matrix</span>
                                <ExternalLink size={12} />
                            </Link>
                        </div>
                        <div className="eid-panel-body">
                            <div className="eid-coverage-metrics">
                                <div className="eid-coverage-card">
                                    <div className="eid-coverage-title">Linked Coverage</div>
                                    <div className="eid-coverage-value">{coverage.linkedCoveragePct}%</div>
                                    <div className="eid-progress-bar-bg">
                                        <div
                                            className="eid-progress-bar-fill"
                                            style={{ width: `${coverage.linkedCoveragePct}%`, background: 'var(--eid-info)' }}
                                        />
                                    </div>
                                    <div className="eid-coverage-subtext">
                                        {coverage.linkedRequirements} of {coverage.totalRequirements} requirements linked to tests
                                    </div>
                                </div>

                                <div className="eid-coverage-card">
                                    <div className="eid-coverage-title">Verified Coverage</div>
                                    <div className="eid-coverage-value" style={{ color: 'var(--eid-pass)' }}>
                                        {coverage.verifiedCoveragePct}%
                                    </div>
                                    <div className="eid-progress-bar-bg">
                                        <div
                                            className="eid-progress-bar-fill"
                                            style={{ width: `${coverage.verifiedCoveragePct}%`, background: 'var(--eid-pass)' }}
                                        />
                                    </div>
                                    <div className="eid-coverage-subtext">
                                        {coverage.verifiedRequirements} requirements passing in recent runs
                                    </div>
                                </div>
                            </div>

                            {/* Gaps List */}
                            {coverage.uncoveredList && coverage.uncoveredList.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--eid-text-subtle)', textTransform: 'uppercase' }}>
                                        Uncovered & Failing Requirements ({coverage.uncoveredList.length})
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '200px', overflowY: 'auto' }}>
                                        {coverage.uncoveredList.slice(0, 5).map((gap, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    background: 'var(--eid-surface-raised)',
                                                    border: '1px solid var(--eid-border)',
                                                    borderRadius: '6px',
                                                    padding: '0.5rem 0.75rem',
                                                    fontSize: '0.78rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                                                    <span style={{ fontWeight: 600, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {gap.requirementId}: {gap.description}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: gap.status === 'failing' ? 'var(--eid-fail)' : 'var(--eid-warn)' }}>
                                                        {gap.reason}
                                                    </span>
                                                </div>
                                                <Link
                                                    to="/app/traceability"
                                                    style={{ fontSize: '0.72rem', color: 'var(--eid-jade)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                                                >
                                                    Link Tests &rarr;
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecutionIntelligenceDashboardPage;
