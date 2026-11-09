/**
 * TestNexa AI — Phase 5, Step 2: Advanced Test Analytics & Quality Insights Workspace
 * Authoritative QA analytics console transforming real execution history, failure fingerprints,
 * flaky tests, requirement coverage, and AI insights into actionable quality decisions.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart3, TrendingUp, AlertTriangle, Bug, Sparkles,
    Download, RefreshCw, CheckCircle2, XCircle, Clock,
    Layers, Shield, Eye, HelpCircle, ArrowUpRight, Flame,
    Activity, Filter, ChevronRight, Zap, Target
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { qualityInsightsService } from '../../services/qualityInsightsService';
import '../../styles/app/QualityInsights.css';

export default function QualityInsightsPage() {
    const navigate = useNavigate();
    const { currentWorkspace, user } = useAuth();
    const workspaceId = currentWorkspace?.id || currentWorkspace?._id;

    // Filters
    const [dateRange, setDateRange] = useState('30d');
    const [suiteId, setSuiteId] = useState('all');
    const [environment, setEnvironment] = useState('all');
    const [browser, setBrowser] = useState('all');
    const [executionType, setExecutionType] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [trendInterval, setTrendInterval] = useState('daily');

    // Tab state
    const [activeTab, setActiveTab] = useState('failures');
    const [activeTooltip, setActiveTooltip] = useState(null);

    // Data state
    const [overview, setOverview] = useState(null);
    const [aiInsightsData, setAiInsightsData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState('');

    // Fetch Quality Insights Overview
    const loadOverview = async (refresh = false) => {
        if (!workspaceId) return;
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        setError('');

        try {
            const res = await qualityInsightsService.getOverview({
                workspaceId,
                dateRange,
                suiteId,
                environment,
                browser,
                executionType,
                status: statusFilter,
                interval: trendInterval
            });

            if (res?.data) {
                setOverview(res.data);
            }
        } catch (err) {
            console.error('Failed to load quality insights:', err);
            setError(err.message || 'Unable to retrieve quality insights telemetry.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadOverview();
    }, [workspaceId, dateRange, suiteId, environment, browser, executionType, statusFilter, trendInterval]);

    // Generate AI Insights
    const handleGenerateAI = async () => {
        if (!workspaceId || isGeneratingAI) return;
        setIsGeneratingAI(true);
        try {
            const res = await qualityInsightsService.generateAIInsights({
                workspaceId,
                dateRange,
                suiteId,
                environment,
                browser,
                executionType
            });
            if (res?.data) {
                setAiInsightsData(res.data);
                setActiveTab('ai');
            }
        } catch (err) {
            console.error('Failed to generate AI insights:', err);
            alert(`AI Analysis error: ${err.message}`);
        } finally {
            setIsGeneratingAI(false);
        }
    };

    // Export CSV
    const handleExportCSV = async () => {
        if (!workspaceId || isExporting) return;
        setIsExporting(true);
        try {
            const blob = await qualityInsightsService.exportCSV({
                workspaceId,
                dateRange,
                suiteId,
                environment,
                browser,
                executionType,
                status: statusFilter
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `testnexa-quality-insights-${workspaceId}-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export CSV:', err);
            alert(`Export failed: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    const health = overview?.health || {};
    const trends = overview?.trends || [];
    const failures = overview?.failures || {};
    const flaky = overview?.flaky || {};
    const coverage = overview?.coverage || {};
    const performance = overview?.performance || {};
    const suiteComparison = overview?.suiteComparison || [];

    // Distinct suites from suiteComparison for filter dropdown
    const availableSuites = useMemo(() => {
        return suiteComparison.map(s => ({ id: s.suiteId, name: s.suiteName }));
    }, [suiteComparison]);

    return (
        <div className="qi-container">
            {/* Header */}
            <div className="qi-header">
                <div className="qi-header-titles">
                    <div className="qi-header-title-row">
                        <BarChart3 size={24} color="#8BAF9A" />
                        <h1>Quality Insights & Test Analytics</h1>
                        <span className="qi-header-badge">Production Telemetry</span>
                    </div>
                    <p className="qi-header-subtitle">
                        Transform actual test executions, recurring failure fingerprints, flaky tests, and requirement traceability into actionable quality metrics.
                    </p>
                </div>

                <div className="qi-header-actions">
                    <button
                        className="qi-btn"
                        onClick={() => loadOverview(true)}
                        disabled={isRefreshing}
                        title="Refresh Analytics"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'qi-spin' : ''} />
                        <span>Refresh</span>
                    </button>

                    <button
                        className="qi-btn"
                        onClick={handleExportCSV}
                        disabled={isExporting}
                        title="Export Clean CSV Report"
                    >
                        <Download size={14} />
                        <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
                    </button>

                    <button
                        className="qi-btn qi-btn--primary"
                        onClick={handleGenerateAI}
                        disabled={isGeneratingAI}
                        title="Synthesize telemetry with AI Principal Architect"
                    >
                        <Sparkles size={14} className={isGeneratingAI ? 'qi-spin' : ''} />
                        <span>{isGeneratingAI ? 'Analyzing...' : 'AI Insights'}</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="qi-filter-bar">
                <div className="qi-filter-group">
                    <span className="qi-filter-label">Range:</span>
                    <select
                        className="qi-select"
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                    >
                        <option value="7d">Last 7 Days</option>
                        <option value="14d">Last 14 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                    </select>
                </div>

                <div className="qi-filter-group">
                    <span className="qi-filter-label">Suite:</span>
                    <select
                        className="qi-select"
                        value={suiteId}
                        onChange={(e) => setSuiteId(e.target.value)}
                    >
                        <option value="all">All Test Suites</option>
                        {availableSuites.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <div className="qi-filter-group">
                    <span className="qi-filter-label">Browser:</span>
                    <select
                        className="qi-select"
                        value={browser}
                        onChange={(e) => setBrowser(e.target.value)}
                    >
                        <option value="all">All Browsers</option>
                        <option value="chromium">Chromium</option>
                        <option value="firefox">Firefox</option>
                        <option value="webkit">WebKit (Safari)</option>
                    </select>
                </div>

                <div className="qi-filter-group">
                    <span className="qi-filter-label">Type:</span>
                    <select
                        className="qi-select"
                        value={executionType}
                        onChange={(e) => setExecutionType(e.target.value)}
                    >
                        <option value="all">Manual & Automated</option>
                        <option value="automated">Automated Only</option>
                        <option value="manual">Manual Only</option>
                    </select>
                </div>

                <div className="qi-filter-group">
                    <span className="qi-filter-label">Status:</span>
                    <select
                        className="qi-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Outcomes</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>

                <div className="qi-filter-group" style={{ marginLeft: 'auto' }}>
                    <span className="qi-filter-label">Interval:</span>
                    <select
                        className="qi-select"
                        value={trendInterval}
                        onChange={(e) => setTrendInterval(e.target.value)}
                    >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="qi-card" style={{ borderColor: 'var(--qi-fail-border)', background: 'var(--qi-fail-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--qi-fail)' }}>
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Execution Health KPI Cards */}
            <div className="qi-kpi-grid">
                {/* 1. Total Executions */}
                <div className="qi-kpi-card">
                    <div className="qi-kpi-top">
                        <span className="qi-kpi-label">Total Executions</span>
                        <HelpCircle
                            size={14}
                            className="qi-kpi-info-icon"
                            onMouseEnter={() => setActiveTooltip('runs')}
                            onMouseLeave={() => setActiveTooltip(null)}
                        />
                    </div>
                    {activeTooltip === 'runs' && (
                        <div className="qi-tooltip-box">
                            {health.metricDefinitions?.totalCaseExecutions || 'All executed test cases across runs.'}
                        </div>
                    )}
                    <div className="qi-kpi-value-row">
                        <span className="qi-kpi-value">{health.totalRuns || 0}</span>
                        <span className="qi-kpi-subtext">runs ({health.originalRuns || 0} orig, {health.rerunAttempts || 0} retry)</span>
                    </div>
                    <span className="qi-kpi-subtext">{health.totalCaseExecutions || 0} test cases evaluated</span>
                </div>

                {/* 2. Pass Rate */}
                <div className="qi-kpi-card">
                    <div className="qi-kpi-top">
                        <span className="qi-kpi-label">Pass Rate</span>
                        <HelpCircle
                            size={14}
                            className="qi-kpi-info-icon"
                            onMouseEnter={() => setActiveTooltip('passRate')}
                            onMouseLeave={() => setActiveTooltip(null)}
                        />
                    </div>
                    {activeTooltip === 'passRate' && (
                        <div className="qi-tooltip-box">
                            {health.metricDefinitions?.passRate || 'Passed cases ÷ (Passed + Failed + Blocked + Timed Out) × 100.'}
                        </div>
                    )}
                    <div className="qi-kpi-value-row">
                        <span className="qi-kpi-value qi-kpi-value--pass">{health.passRate ?? 0}%</span>
                        <span className="qi-kpi-subtext">({health.passed || 0} passed)</span>
                    </div>
                    <span className="qi-kpi-subtext">Of {health.terminalExecutedCases || 0} terminal evaluated</span>
                </div>

                {/* 3. Failure Rate */}
                <div className="qi-kpi-card">
                    <div className="qi-kpi-top">
                        <span className="qi-kpi-label">Failure Rate</span>
                        <HelpCircle
                            size={14}
                            className="qi-kpi-info-icon"
                            onMouseEnter={() => setActiveTooltip('failureRate')}
                            onMouseLeave={() => setActiveTooltip(null)}
                        />
                    </div>
                    {activeTooltip === 'failureRate' && (
                        <div className="qi-tooltip-box">
                            {health.metricDefinitions?.failureRate || '(Failed + Blocked + Timed Out) ÷ Terminal Cases × 100.'}
                        </div>
                    )}
                    <div className="qi-kpi-value-row">
                        <span className={`qi-kpi-value ${(health.failureRate || 0) > 0 ? 'qi-kpi-value--fail' : ''}`}>
                            {health.failureRate ?? 0}%
                        </span>
                        <span className="qi-kpi-subtext">({health.failed || 0} failed)</span>
                    </div>
                    <span className="qi-kpi-subtext">{(health.blocked || 0) + (health.timedOut || 0)} blocked / timeout</span>
                </div>

                {/* 4. Flaky Tests */}
                <div className="qi-kpi-card">
                    <div className="qi-kpi-top">
                        <span className="qi-kpi-label">Flaky Tests</span>
                        <Flame size={15} color="#FFB74D" />
                    </div>
                    <div className="qi-kpi-value-row">
                        <span className="qi-kpi-value" style={{ color: flaky.flakyCount > 0 ? '#FFB74D' : 'var(--qi-text)' }}>
                            {flaky.flakyCount || 0}
                        </span>
                        <span className="qi-kpi-subtext">detected</span>
                    </div>
                    <span className="qi-kpi-subtext">{flaky.totalAnalyzedCases || 0} specifications analyzed</span>
                </div>

                {/* 5. Verified Coverage */}
                <div className="qi-kpi-card">
                    <div className="qi-kpi-top">
                        <span className="qi-kpi-label">Verified Coverage</span>
                        <Target size={15} color="#8BAF9A" />
                    </div>
                    <div className="qi-kpi-value-row">
                        <span className="qi-kpi-value">{coverage.verifiedCoveragePct ?? 0}%</span>
                        <span className="qi-kpi-subtext">({coverage.verifiedRequirements || 0}/{coverage.totalRequirements || 0})</span>
                    </div>
                    <span className="qi-kpi-subtext">{coverage.uncoveredRequirements || 0} unlinked requirements</span>
                </div>

                {/* 6. Execution Duration */}
                <div className="qi-kpi-card">
                    <div className="qi-kpi-top">
                        <span className="qi-kpi-label">Median Duration</span>
                        <Clock size={15} color="var(--qi-text-muted)" />
                    </div>
                    <div className="qi-kpi-value-row">
                        <span className="qi-kpi-value">
                            {health.medianDurationMs ? `${(health.medianDurationMs / 1000).toFixed(2)}s` : '0s'}
                        </span>
                        <span className="qi-kpi-subtext">avg {health.avgDurationMs ? `${(health.avgDurationMs / 1000).toFixed(1)}s` : '0s'}</span>
                    </div>
                    <span className="qi-kpi-subtext">Measured across terminal test cases</span>
                </div>
            </div>

            {/* Execution Trends Visualizer */}
            <div className="qi-card">
                <div className="qi-card-header">
                    <h3 className="qi-card-title">
                        <TrendingUp size={18} color="#8BAF9A" />
                        Execution Trends & Quality Trajectory
                    </h3>
                    <div className="qi-chart-legend">
                        <div className="qi-legend-item">
                            <span className="qi-legend-dot qi-legend-dot--pass" />
                            <span>Pass Rate (%)</span>
                        </div>
                        <div className="qi-legend-item">
                            <span className="qi-legend-dot qi-legend-dot--fail" />
                            <span>Failures</span>
                        </div>
                        <div className="qi-legend-item">
                            <span className="qi-legend-dot qi-legend-dot--vol" />
                            <span>Execution Volume</span>
                        </div>
                    </div>
                </div>

                {trends.length === 0 ? (
                    <div className="qi-empty-state">
                        <Activity size={32} />
                        <h3>No Execution Trends Recorded</h3>
                        <p>No historical runs found in the selected date range. Execute test runs to display trend charts.</p>
                    </div>
                ) : (
                    <div className="qi-trend-chart-wrapper">
                        <svg className="qi-svg-chart" viewBox={`0 0 ${Math.max(650, trends.length * 45)} 180`}>
                            {/* Gridlines */}
                            <line x1="0" y1="30" x2="100%" y2="30" stroke="var(--qi-border)" strokeDasharray="3 3" />
                            <line x1="0" y1="80" x2="100%" y2="80" stroke="var(--qi-border)" strokeDasharray="3 3" />
                            <line x1="0" y1="130" x2="100%" y2="130" stroke="var(--qi-border)" strokeDasharray="3 3" />

                            {/* Bars: Execution Volume */}
                            {trends.map((t, idx) => {
                                const maxVol = Math.max(1, ...trends.map(x => x.totalRuns));
                                const barHeight = (t.totalRuns / maxVol) * 110;
                                const x = 20 + idx * 42;
                                const y = 140 - barHeight;

                                return (
                                    <g key={t.date} className="qi-chart-col" onClick={() => navigate('/app/runs')}>
                                        <title>{`${t.date}: ${t.totalRuns} runs (${t.passed} passed, ${t.failed} failed)`}</title>
                                        <rect
                                            x={x}
                                            y={y}
                                            width="24"
                                            height={Math.max(2, barHeight)}
                                            fill={t.failed > 0 ? 'rgba(229, 115, 115, 0.4)' : 'rgba(139, 175, 154, 0.3)'}
                                            rx="3"
                                            stroke={t.failed > 0 ? 'var(--qi-fail)' : 'var(--qi-jade)'}
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={x + 12}
                                            y="160"
                                            fontSize="9"
                                            fill="var(--qi-text-subtle)"
                                            textAnchor="middle"
                                        >
                                            {t.date.slice(5)}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Line: Pass Rate */}
                            {trends.map((t, idx) => {
                                if (idx === 0 || t.passRate === null) return null;
                                const prev = trends[idx - 1];
                                if (prev.passRate === null) return null;

                                const x1 = 32 + (idx - 1) * 42;
                                const y1 = 140 - (prev.passRate / 100) * 110;
                                const x2 = 32 + idx * 42;
                                const y2 = 140 - (t.passRate / 100) * 110;

                                return (
                                    <line
                                        key={`line-${t.date}`}
                                        x1={x1}
                                        y1={y1}
                                        x2={x2}
                                        y2={y2}
                                        stroke="var(--qi-pass)"
                                        strokeWidth="2"
                                    />
                                );
                            })}
                        </svg>
                    </div>
                )}
            </div>

            {/* Investigation Navigation Tabs */}
            <div className="qi-tabs-bar">
                <button
                    className={`qi-tab-btn ${activeTab === 'failures' ? 'active' : ''}`}
                    onClick={() => setActiveTab('failures')}
                >
                    <Bug size={15} />
                    <span>Failure Intelligence</span>
                    <span className="qi-tab-badge">{failures.topSignatures?.length || 0}</span>
                </button>

                <button
                    className={`qi-tab-btn ${activeTab === 'flaky' ? 'active' : ''}`}
                    onClick={() => setActiveTab('flaky')}
                >
                    <Flame size={15} />
                    <span>Flaky Tests</span>
                    <span className="qi-tab-badge">{flaky.flakyCount || 0}</span>
                </button>

                <button
                    className={`qi-tab-btn ${activeTab === 'coverage' ? 'active' : ''}`}
                    onClick={() => setActiveTab('coverage')}
                >
                    <Target size={15} />
                    <span>Requirement Coverage</span>
                    <span className="qi-tab-badge">{coverage.uncoveredRequirements || 0} gaps</span>
                </button>

                <button
                    className={`qi-tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('performance')}
                >
                    <Clock size={15} />
                    <span>Performance & Slow Tests</span>
                    <span className="qi-tab-badge">{performance.slowestCases?.length || 0}</span>
                </button>

                <button
                    className={`qi-tab-btn ${activeTab === 'suites' ? 'active' : ''}`}
                    onClick={() => setActiveTab('suites')}
                >
                    <Layers size={15} />
                    <span>Suite Comparison Matrix</span>
                    <span className="qi-tab-badge">{suiteComparison.length}</span>
                </button>

                <button
                    className={`qi-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai')}
                >
                    <Sparkles size={15} color="#8BAF9A" />
                    <span>AI Quality Observations</span>
                    {aiInsightsData?.insights && (
                        <span className="qi-tab-badge" style={{ background: 'var(--qi-jade)', color: '#080A09' }}>
                            {aiInsightsData.insights.length}
                        </span>
                    )}
                </button>
            </div>

            {/* TAB 1: FAILURE INTELLIGENCE */}
            {activeTab === 'failures' && (
                <div className="qi-card">
                    <h3 className="qi-card-title">
                        <Bug size={17} color="var(--qi-fail)" />
                        Top Recurring Failure Signatures & Affected Cases
                    </h3>

                    {(!failures.topSignatures || failures.topSignatures.length === 0) ? (
                        <div className="qi-empty-state">
                            <CheckCircle2 size={32} color="var(--qi-pass)" />
                            <h3>No Failure Signatures Detected</h3>
                            <p>All executed tests in this period passed without recurring error patterns.</p>
                        </div>
                    ) : (
                        <div className="qi-table-wrapper">
                            <table className="qi-table">
                                <thead>
                                    <tr>
                                        <th>Signature Hash</th>
                                        <th>Normalized Error Pattern</th>
                                        <th>Occurrences</th>
                                        <th>Affected Cases</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {failures.topSignatures.map(sig => (
                                        <tr key={sig.signatureHash}>
                                            <td>
                                                <span className="qi-fingerprint-code">{sig.signatureHash}</span>
                                            </td>
                                            <td style={{ maxWidth: '380px' }}>
                                                <div style={{ fontWeight: 500, color: 'var(--qi-fail)' }}>
                                                    {sig.pattern}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--qi-text-subtle)', marginTop: '0.2rem' }}>
                                                    Sample Error: {sig.sampleError?.slice(0, 90)}...
                                                </div>
                                            </td>
                                            <td>
                                                <span className="qi-pill qi-pill--critical">
                                                    {sig.count} failure{sig.count > 1 ? 's' : ''}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--qi-text-muted)' }}>
                                                    {sig.affectedCaseCount} test case{sig.affectedCaseCount > 1 ? 's' : ''}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--qi-text-subtle)' }}>
                                                    {sig.affectedCases.join(', ')}
                                                </div>
                                            </td>
                                            <td>
                                                <button
                                                    className="qi-btn"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                    onClick={() => navigate(`/app/runs/${sig.sampleRunId}`)}
                                                >
                                                    View Run
                                                    <ArrowUpRight size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: FLAKY TESTS */}
            {activeTab === 'flaky' && (
                <div className="qi-card">
                    <h3 className="qi-card-title">
                        <Flame size={17} color="#FFB74D" />
                        Grounded Statistical Flaky Test Classifications
                    </h3>

                    {(!flaky.flakyCases || flaky.flakyCases.length === 0) ? (
                        <div className="qi-empty-state">
                            <CheckCircle2 size={32} color="var(--qi-pass)" />
                            <h3>Zero Flaky Tests Detected</h3>
                            <p>No tests exhibited flip-flop outcome transitions in the analyzed execution window.</p>
                        </div>
                    ) : (
                        <div className="qi-table-wrapper">
                            <table className="qi-table">
                                <thead>
                                    <tr>
                                        <th>Test Case Specification</th>
                                        <th>Suite</th>
                                        <th>Flaky Score</th>
                                        <th>Flip Count</th>
                                        <th>Failure Rate</th>
                                        <th>Classification</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {flaky.flakyCases.map(fc => (
                                        <tr key={fc.testCaseId}>
                                            <td style={{ fontWeight: 500 }}>{fc.title}</td>
                                            <td style={{ color: 'var(--qi-text-muted)' }}>{fc.suiteName}</td>
                                            <td>
                                                <span className="qi-pill qi-pill--flaky">
                                                    {fc.flakyScore}/100
                                                </span>
                                            </td>
                                            <td>{fc.flipCount} flips</td>
                                            <td>{fc.failureRate}%</td>
                                            <td>
                                                <span className="qi-pill qi-pill--warning">
                                                    {fc.classification.replace('_', ' ')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: REQUIREMENT COVERAGE */}
            {activeTab === 'coverage' && (
                <div className="qi-card">
                    <h3 className="qi-card-title">
                        <Target size={17} color="#8BAF9A" />
                        Requirement Traceability & Verification Health
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', margin: '0.5rem 0' }}>
                        <div className="qi-kpi-card" style={{ padding: '0.75rem' }}>
                            <span className="qi-kpi-label">Total Requirements</span>
                            <span className="qi-kpi-value">{coverage.totalRequirements || 0}</span>
                        </div>
                        <div className="qi-kpi-card" style={{ padding: '0.75rem' }}>
                            <span className="qi-kpi-label">Linked to Tests</span>
                            <span className="qi-kpi-value">{coverage.linkedRequirements || 0}</span>
                        </div>
                        <div className="qi-kpi-card" style={{ padding: '0.75rem' }}>
                            <span className="qi-kpi-label">Fully Verified (Passing)</span>
                            <span className="qi-kpi-value qi-kpi-value--pass">{coverage.verifiedRequirements || 0}</span>
                        </div>
                        <div className="qi-kpi-card" style={{ padding: '0.75rem' }}>
                            <span className="qi-kpi-label">Failing Linked Tests</span>
                            <span className="qi-kpi-value qi-kpi-value--fail">{coverage.failingRequirements || 0}</span>
                        </div>
                    </div>

                    {coverage.uncoveredList && coverage.uncoveredList.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--qi-text-muted)' }}>
                                Top Critical Coverage Gaps Awaiting Verification:
                            </h4>
                            <div className="qi-table-wrapper">
                                <table className="qi-table">
                                    <thead>
                                        <tr>
                                            <th>Req ID</th>
                                            <th>Specification</th>
                                            <th>Priority</th>
                                            <th>Suite</th>
                                            <th>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {coverage.uncoveredList.map(u => (
                                            <tr key={u.requirementId}>
                                                <td><span className="qi-fingerprint-code">{u.requirementId}</span></td>
                                                <td>{u.description}</td>
                                                <td>
                                                    <span className={`qi-pill qi-pill--${u.priority === 'High' ? 'critical' : 'info'}`}>
                                                        {u.priority}
                                                    </span>
                                                </td>
                                                <td>{u.suiteName}</td>
                                                <td style={{ color: 'var(--qi-fail)' }}>{u.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: PERFORMANCE & SLOW TESTS */}
            {activeTab === 'performance' && (
                <div className="qi-card">
                    <h3 className="qi-card-title">
                        <Clock size={17} color="#8BAF9A" />
                        Execution Performance & Long-Running Test Cases
                    </h3>

                    {(!performance.slowestCases || performance.slowestCases.length === 0) ? (
                        <div className="qi-empty-state">
                            <Clock size={32} />
                            <h3>No Execution Durations Recorded</h3>
                            <p>Duration metrics will appear once automated Playwright test cases complete execution.</p>
                        </div>
                    ) : (
                        <div className="qi-table-wrapper">
                            <table className="qi-table">
                                <thead>
                                    <tr>
                                        <th>Test Case</th>
                                        <th>Suite</th>
                                        <th>Executions</th>
                                        <th>Median Duration</th>
                                        <th>Average Duration</th>
                                        <th>Max Observed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {performance.slowestCases.map(s => (
                                        <tr key={s.testCaseId}>
                                            <td style={{ fontWeight: 500 }}>{s.title}</td>
                                            <td style={{ color: 'var(--qi-text-muted)' }}>{s.suiteName}</td>
                                            <td>{s.executionCount}</td>
                                            <td style={{ fontWeight: 600, color: s.medianDurationMs > 5000 ? '#FFB74D' : 'var(--qi-text)' }}>
                                                {(s.medianDurationMs / 1000).toFixed(2)}s
                                            </td>
                                            <td>{(s.avgDurationMs / 1000).toFixed(2)}s</td>
                                            <td>{(s.maxDurationMs / 1000).toFixed(2)}s</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 5: SUITE COMPARISON */}
            {activeTab === 'suites' && (
                <div className="qi-card">
                    <h3 className="qi-card-title">
                        <Layers size={17} color="#8BAF9A" />
                        Test Suite Quality Comparison Matrix
                    </h3>

                    {suiteComparison.length === 0 ? (
                        <div className="qi-empty-state">
                            <Layers size={32} />
                            <h3>No Test Suites Executed</h3>
                            <p>Execute test suites to display comparative health and pass rate telemetry.</p>
                        </div>
                    ) : (
                        <div className="qi-table-wrapper">
                            <table className="qi-table">
                                <thead>
                                    <tr>
                                        <th>Test Suite</th>
                                        <th>Total Cases</th>
                                        <th>Execution Runs</th>
                                        <th>Pass Rate</th>
                                        <th>Failure Rate</th>
                                        <th>Avg Duration</th>
                                        <th>Recurring Failures</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suiteComparison.map(sc => (
                                        <tr key={sc.suiteId}>
                                            <td style={{ fontWeight: 600 }}>{sc.suiteName}</td>
                                            <td>{sc.totalCases}</td>
                                            <td>{sc.executionVolume} runs</td>
                                            <td style={{ color: 'var(--qi-pass)', fontWeight: 600 }}>{sc.passRate}%</td>
                                            <td style={{ color: sc.failureRate > 0 ? 'var(--qi-fail)' : 'var(--qi-text-muted)' }}>
                                                {sc.failureRate}%
                                            </td>
                                            <td>{(sc.avgDurationMs / 1000).toFixed(1)}s</td>
                                            <td>
                                                {sc.recurringFailureCount > 0 ? (
                                                    <span className="qi-pill qi-pill--critical">{sc.recurringFailureCount} patterns</span>
                                                ) : (
                                                    <span style={{ color: 'var(--qi-pass)' }}>0 patterns</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 6: AI QUALITY INSIGHTS */}
            {activeTab === 'ai' && (
                <div className="qi-card">
                    <div className="qi-card-header">
                        <h3 className="qi-card-title">
                            <Sparkles size={18} color="#8BAF9A" />
                            AI Quality Observations & Architectural Recommendations
                        </h3>
                        <button
                            className="qi-btn qi-btn--primary"
                            onClick={handleGenerateAI}
                            disabled={isGeneratingAI}
                        >
                            <Sparkles size={14} className={isGeneratingAI ? 'qi-spin' : ''} />
                            <span>{isGeneratingAI ? 'Re-analyzing Telemetry...' : 'Refresh AI Analysis'}</span>
                        </button>
                    </div>

                    {!aiInsightsData ? (
                        <div className="qi-empty-state">
                            <Sparkles size={36} color="#8BAF9A" />
                            <h3>Ready for AI Quality Synthesis</h3>
                            <p>
                                Analyze actual telemetry with TestNexa AI's Principal QA Architect. Evaluates execution health, failure trends, flaky flip-flops, and coverage gaps without inventing data.
                            </p>
                            <button
                                className="qi-btn qi-btn--primary"
                                onClick={handleGenerateAI}
                                disabled={isGeneratingAI}
                                style={{ marginTop: '0.5rem' }}
                            >
                                <Sparkles size={14} />
                                <span>Generate Quality Insights with AI</span>
                            </button>
                        </div>
                    ) : (
                        <div className="qi-ai-insights-grid">
                            {aiInsightsData.insights?.map((ins, idx) => (
                                <div key={idx} className="qi-insight-card">
                                    <div className="qi-insight-card-top">
                                        <h4 className="qi-insight-title">{ins.title}</h4>
                                        <div className="qi-insight-badges">
                                            <span className={`qi-pill qi-pill--${ins.severity === 'critical' ? 'critical' : ins.severity === 'warning' ? 'warning' : 'info'}`}>
                                                {ins.severity}
                                            </span>
                                            <span className="qi-pill" style={{ background: 'var(--qi-surface-hover)', color: 'var(--qi-text-muted)' }}>
                                                {ins.confidence} confidence
                                            </span>
                                        </div>
                                    </div>

                                    <p className="qi-insight-desc">{ins.description}</p>

                                    <div className="qi-insight-sections">
                                        {ins.observedFacts && ins.observedFacts.length > 0 && (
                                            <div className="qi-insight-row">
                                                <span className="qi-insight-row-label">Facts:</span>
                                                <span className="qi-insight-row-value">{ins.observedFacts.join('; ')}</span>
                                            </div>
                                        )}
                                        {ins.aiHypotheses && ins.aiHypotheses.length > 0 && (
                                            <div className="qi-insight-row">
                                                <span className="qi-insight-row-label">Hypothesis:</span>
                                                <span className="qi-insight-row-value">{ins.aiHypotheses.join('; ')}</span>
                                            </div>
                                        )}
                                        {ins.recommendedInvestigation && (
                                            <div className="qi-insight-row">
                                                <span className="qi-insight-row-label">Next Step:</span>
                                                <span className="qi-insight-row-value" style={{ color: 'var(--qi-text)' }}>
                                                    {ins.recommendedInvestigation}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
