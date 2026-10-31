import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
    CheckCircle2, XCircle, AlertTriangle, MinusCircle, Clock,
    Download, Printer, FileText, Bot, User, RefreshCw,
    ChevronDown, ChevronRight, ChevronUp, Check, AlertCircle, Eye,
    Search, Shield, Layers, ExternalLink
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../loading';
import '../../styles/app/WorkspaceDesignSystem.css';
import '../../styles/app/ExecutionReport.css';

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
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return String(iso);
    }
};

const STANDARD_CATEGORIES = ['Functional', 'Negative', 'Edge', 'API', 'Non-Functional'];

const RunReportView = ({ runId, onRerunTriggered, onSwitchToCases }) => {
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Interactive view state
    const [expandedFailures, setExpandedFailures] = useState({});
    const [expandedCases, setExpandedCases] = useState({});
    const [expandedStackTraces, setExpandedStackTraces] = useState({});
    const [caseSearch, setCaseSearch] = useState('');
    const [caseStatusFilter, setCaseStatusFilter] = useState('all');
    const [caseCategoryFilter, setCaseCategoryFilter] = useState('all');
    const [previewImage, setPreviewImage] = useState(null);
    const [isRerunning, setIsRerunning] = useState(false);
    const [rerunStatus, setRerunStatus] = useState(null);

    const loadReport = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await executionService.getRunReport(runId);
            if (res.success && res.data) {
                setReport(res.data);
            } else {
                setError(res.message || 'Unable to generate execution report.');
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch execution report.');
        } finally {
            setIsLoading(false);
        }
    }, [runId]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const toggleFailureExpand = (id) => {
        setExpandedFailures(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleCaseExpand = (id) => {
        setExpandedCases(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleStackTrace = (id) => {
        setExpandedStackTraces(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleRerun = async (scope) => {
        setIsRerunning(true);
        setRerunStatus(null);
        try {
            const res = await executionService.rerun({ runId, scope });
            if (res.success) {
                const count = res.data?.rerunCasesCount || res.data?.rerunCount || 0;
                setRerunStatus(`Rerun initiated (${count} cases queued).`);
                if (onRerunTriggered) onRerunTriggered(res.data);
                setTimeout(() => {
                    loadReport();
                }, 1500);
            } else {
                setRerunStatus(`Rerun failed: ${res.message}`);
            }
        } catch (err) {
            setRerunStatus(`Rerun error: ${err.message}`);
        } finally {
            setIsRerunning(false);
        }
    };

    const handleExport = async (format) => {
        try {
            await executionService.exportReport(runId, format);
        } catch (err) {
            alert(`Export failed: ${err.message}`);
        }
    };

    if (isLoading) {
        return <DataLoadingState message="Synthesizing unified execution intelligence..." />;
    }

    if (error || !report) {
        return (
            <div className="ws-empty-state" style={{ margin: '3rem 0', textAlign: 'center' }}>
                <AlertTriangle size={32} color="var(--er-fail)" />
                <h2 style={{ color: '#FFFFFF', marginTop: '0.75rem' }}>Report Generation Failed</h2>
                <p style={{ color: 'var(--er-text-muted)' }}>{error || 'Execution records could not be loaded.'}</p>
                <button type="button" onClick={loadReport} className="er-btn" style={{ marginTop: '1rem' }}>
                    <RefreshCw size={13} />
                    <span>Retry Report Generation</span>
                </button>
            </div>
        );
    }

    // Normalized safe structures
    const m = report.summary || report.metrics || {};
    const meta = report.identifiers || report.meta || {};
    const timestamps = report.timestamps || {};
    const env = report.environment || meta.targetEnvironment || {};
    const method = report.methodBreakdown || {};
    const rawCats = report.categoryBreakdown || report.categories || [];
    const failures = report.failureInvestigations || report.failures || [];
    const coverage = report.coverage || report.requirementCoverage || {};
    const allCases = report.cases || [];

    // Safely extract method breakdowns
    const autoObj = (typeof method.automated === 'object' && method.automated !== null)
        ? method.automated
        : { total: Number(method.automated) || 0, passRate: 0 };
    const manualObj = (typeof method.manual === 'object' && method.manual !== null)
        ? method.manual
        : { total: Number(method.manual) || 0, passRate: 0 };

    const autoCount = autoObj.total || 0;
    const manualCount = manualObj.total || 0;

    const totalDurationMs = timestamps.durationMs || m.durationMs || 0;
    const avgDurationMs = m.total > 0 ? Math.round(totalDurationMs / m.total) : 0;
    const startedAt = timestamps.startedAt || meta.startedAt;
    const completedAt = timestamps.completedAt || meta.completedAt;

    const runStatus = (meta.status || 'pending').toLowerCase();
    const totalCasesCount = m.total || allCases.length || 0;
    const passedCount = m.passed || 0;
    const failedCount = m.failed || 0;
    const blockedCount = m.blocked || 0;
    const skippedCount = m.skipped || 0;
    const notRunCount = m.notRun ?? m.not_run ?? (totalCasesCount - (passedCount + failedCount + blockedCount + skippedCount));
    const executedCount = totalCasesCount - notRunCount;

    const isPending = runStatus === 'pending' || (executedCount === 0 && passedCount === 0 && failedCount === 0);
    const hasStarted = Boolean(startedAt);

    const passRate = isPending ? 0 : (m.passRate ?? (executedCount > 0 ? Math.round((passedCount / executedCount) * 100) : 0));

    // Progress bar segment percentages
    const passedPct = totalCasesCount > 0 ? (passedCount / totalCasesCount) * 100 : 0;
    const failedPct = totalCasesCount > 0 ? (failedCount / totalCasesCount) * 100 : 0;
    const blockedPct = totalCasesCount > 0 ? (blockedCount / totalCasesCount) * 100 : 0;
    const skippedPct = totalCasesCount > 0 ? (skippedCount / totalCasesCount) * 100 : 0;
    const notRunPct = totalCasesCount > 0 ? (notRunCount / totalCasesCount) * 100 : 0;

    // Requirement metrics
    const coveragePct = isPending ? 0 : (coverage.requirementVerificationPercentage ?? 0);
    const verifiedReqsCount = coverage.verifiedRequirements ?? 0;
    const failedReqsCount = coverage.failedRequirements ?? coverage.failingRequirements ?? 0;
    const uncoveredReqsCount = coverage.uncoveredRequirements ?? 0;
    const requirementsList = coverage.requirements || [];

    // Filter test cases table
    const filteredCases = allCases.filter(c => {
        const query = caseSearch.toLowerCase().trim();
        const matchesQuery = !query ||
            (c.testCaseId && c.testCaseId.toLowerCase().includes(query)) ||
            (c.title && c.title.toLowerCase().includes(query));
        const matchesStatus = caseStatusFilter === 'all' || (c.status && c.status.toLowerCase() === caseStatusFilter);
        const matchesCat = caseCategoryFilter === 'all' || (c.type && c.type.toLowerCase() === caseCategoryFilter.toLowerCase());
        return matchesQuery && matchesStatus && matchesCat;
    });

    // Normalized Categories List ensuring all 5 standard categories exist
    const categoriesList = useMemo(() => {
        const rawMap = new Map();
        const list = Array.isArray(rawCats)
            ? rawCats
            : Object.entries(rawCats).map(([k, v]) => ({ category: k, ...v }));

        list.forEach(item => {
            const name = item.category || item.name || 'General';
            rawMap.set(name.toLowerCase(), {
                name,
                total: Number(item.total) || 0,
                passed: Number(item.passed) || 0,
                failed: Number(item.failed) || 0,
                blocked: Number(item.blocked) || 0,
                skipped: Number(item.skipped) || 0,
                passRate: item.passRate ?? 0
            });
        });

        // Ensure Functional, Negative, Edge, API, Non-Functional are present
        const result = [];
        const seen = new Set();

        STANDARD_CATEGORIES.forEach(std => {
            const key = std.toLowerCase();
            seen.add(key);
            if (rawMap.has(key)) {
                result.push(rawMap.get(key));
            } else {
                result.push({
                    name: std,
                    total: 0,
                    passed: 0,
                    failed: 0,
                    blocked: 0,
                    skipped: 0,
                    passRate: 0
                });
            }
        });

        // Add any remaining custom categories
        rawMap.forEach((v, k) => {
            if (!seen.has(k)) {
                result.push(v);
            }
        });

        return result;
    }, [rawCats]);

    return (
        <div className="er-document">
            {/* ─── 1. REPORT HEADER & ACTIONS ─── */}
            <header className="er-header">
                <div className="er-title-area">
                    <div className="er-breadcrumb">
                        <NavLink to="/app/runs">Execution</NavLink>
                        <span className="er-breadcrumb-sep">/</span>
                        <span>Reports</span>
                        <span className="er-breadcrumb-sep">/</span>
                        <span className="er-breadcrumb-id">Run #{String(meta.runId || runId || '').slice(-8)}</span>
                    </div>

                    <div className="er-title-row">
                        <h1 className="er-title">{meta.suiteName || meta.runName || 'Execution Report'}</h1>
                        <span className="er-run-badge">Run #{String(meta.runId || runId || '').slice(-6)}</span>
                        <span className={`er-status-badge ${runStatus}`}>
                            {runStatus.replace('_', ' ')}
                        </span>
                    </div>

                    <div className="er-meta-context">
                        <span>Environment: <strong>{env.name || 'Default Staging'}</strong></span>
                        <span>•</span>
                        <span>Framework: <strong>{meta.executionType === 'automated' ? 'Playwright / Chromium' : meta.executionType === 'mixed' ? 'Hybrid (Playwright + Manual)' : 'Manual Execution'}</strong></span>
                        <span>•</span>
                        <span>Execution Date: <strong>{formatTimestamp(completedAt || startedAt || meta.createdAt)}</strong></span>
                    </div>
                </div>

                {/* Export & Print Actions Toolbar */}
                <div className="er-actions">
                    {failedCount > 0 && (
                        <button
                            type="button"
                            onClick={() => handleRerun('failed')}
                            disabled={isRerunning}
                            className="er-btn er-btn-danger"
                            title="Rerun only failed test cases"
                        >
                            <RefreshCw size={12} className={isRerunning ? 'animate-spin' : ''} />
                            <span>Rerun Failed ({failedCount})</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => handleRerun('all')}
                        disabled={isRerunning}
                        className="er-btn"
                        title="Rerun complete suite"
                    >
                        <RefreshCw size={12} className={isRerunning ? 'animate-spin' : ''} />
                        <span>Rerun Suite</span>
                    </button>

                    <div className="er-btn-divider" />

                    <button
                        type="button"
                        onClick={() => handleExport('pdf')}
                        className="er-btn"
                        title="Print or export high-fidelity PDF report"
                    >
                        <Printer size={12} />
                        <span>Print / PDF</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleExport('csv')}
                        className="er-btn"
                        title="Download CSV test results"
                    >
                        <Download size={12} />
                        <span>CSV</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleExport('json')}
                        className="er-btn"
                        title="Export JSON report schema"
                    >
                        <FileText size={12} />
                        <span>JSON</span>
                    </button>
                </div>
            </header>

            {rerunStatus && (
                <div style={{
                    padding: '0.65rem 0.95rem',
                    background: rerunStatus.includes('failed') ? 'var(--er-fail-bg)' : 'var(--er-jade-bg)',
                    border: `1px solid ${rerunStatus.includes('failed') ? 'var(--er-fail-border)' : 'var(--er-jade-border)'}`,
                    borderRadius: '5px',
                    color: rerunStatus.includes('failed') ? 'var(--er-fail)' : 'var(--er-jade)',
                    fontSize: '0.82rem'
                }}>
                    {rerunStatus}
                </div>
            )}

            {/* ─── 2. EXECUTION OUTCOME (PRIMARY FOCUS) ─── */}
            <section className="er-outcome-block">
                <div className="er-outcome-header">
                    <div className="er-outcome-primary">
                        <span className={`er-pass-rate ${isPending ? 'pending' : passRate >= 80 ? 'passed' : 'failed'}`}>
                            {isPending ? '—' : `${passRate}%`}
                        </span>
                        <div>
                            <div className="er-outcome-label">
                                {isPending ? 'Pending Execution' : passRate === 100 ? 'All Tests Passed' : passRate >= 80 ? 'Suite Passed' : 'Tests Failed'}
                            </div>
                            <div className="er-outcome-summary-text">
                                {isPending
                                    ? `Suite planned with ${totalCasesCount} cases; execution has not started.`
                                    : `${passedCount} of ${totalCasesCount} test cases completed successfully.`}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Slim Horizontal Progress Line */}
                <div className="er-progress-track" title={`Passed: ${passedCount}, Failed: ${failedCount}, Blocked: ${blockedCount}, Skipped: ${skippedCount}, Not Run: ${notRunCount}`}>
                    {totalCasesCount > 0 && (
                        <>
                            <div className="er-progress-seg passed" style={{ width: `${passedPct}%` }} />
                            <div className="er-progress-seg failed" style={{ width: `${failedPct}%` }} />
                            <div className="er-progress-seg blocked" style={{ width: `${blockedPct}%` }} />
                            <div className="er-progress-seg skipped" style={{ width: `${skippedPct}%` }} />
                            <div className="er-progress-seg not-run" style={{ width: `${notRunPct}%` }} />
                        </>
                    )}
                </div>

                {/* Compact Outcome Counts Row */}
                <div className="er-counts-row">
                    <div className="er-count-item">
                        <span className="er-dot total" />
                        <span>Total: <strong>{totalCasesCount}</strong></span>
                    </div>
                    <div className="er-count-item">
                        <span className="er-dot passed" />
                        <span>Passed: <strong style={{ color: 'var(--er-jade)' }}>{passedCount}</strong></span>
                    </div>
                    <div className="er-count-item">
                        <span className="er-dot failed" />
                        <span>Failed: <strong style={{ color: failedCount > 0 ? 'var(--er-fail)' : 'inherit' }}>{failedCount}</strong></span>
                    </div>
                    <div className="er-count-item">
                        <span className="er-dot blocked" />
                        <span>Blocked: <strong style={{ color: blockedCount > 0 ? 'var(--er-warn)' : 'inherit' }}>{blockedCount}</strong></span>
                    </div>
                    <div className="er-count-item">
                        <span className="er-dot skipped" />
                        <span>Skipped: <strong style={{ color: skippedCount > 0 ? 'var(--er-purple)' : 'inherit' }}>{skippedCount}</strong></span>
                    </div>
                    <div className="er-count-item">
                        <span className="er-dot not-run" />
                        <span>Not Run: <strong>{notRunCount}</strong></span>
                    </div>
                </div>
            </section>

            {/* ─── 3. EXECUTION METADATA (ALIGNED SPEC GRID) ─── */}
            <section className="er-section">
                <h3 className="er-section-title">Execution Specification & Environment</h3>
                <div className="er-spec-grid">
                    <div className="er-spec-item">
                        <span className="er-spec-label">Duration</span>
                        <span className="er-spec-value">
                            {isPending || !hasStarted ? '—' : formatDuration(totalDurationMs)}
                        </span>
                        <span className="er-spec-sub">
                            {isPending ? 'Pending execution' : avgDurationMs > 0 ? `Avg ${formatDuration(avgDurationMs)} per test` : 'Completed'}
                        </span>
                    </div>

                    <div className="er-spec-item">
                        <span className="er-spec-label">Total Test Cases</span>
                        <span className="er-spec-value">{totalCasesCount} cases</span>
                        <span className="er-spec-sub">{executedCount} executed ({totalCasesCount > 0 ? Math.round((executedCount / totalCasesCount) * 100) : 0}% coverage)</span>
                    </div>

                    <div className="er-spec-item">
                        <span className="er-spec-label">Execution Method</span>
                        <span className="er-spec-value" style={{ textTransform: 'capitalize' }}>
                            {meta.executionType || 'Mixed'}
                        </span>
                        <span className="er-spec-sub">
                            {autoCount} Playwright Automated · {manualCount} Manual
                        </span>
                    </div>

                    <div className="er-spec-item">
                        <span className="er-spec-label">Target Environment</span>
                        <span className="er-spec-value">{env.name || 'Default Staging'}</span>
                        <span className="er-spec-sub">{env.baseUrl || 'https://staging.testnexa.dev'}</span>
                    </div>

                    <div className="er-spec-item">
                        <span className="er-spec-label">Browser & Engine</span>
                        <span className="er-spec-value">
                            {meta.executionType === 'manual' ? 'Manual Browser' : 'Playwright (Chromium 1234)'}
                        </span>
                        <span className="er-spec-sub">Isolated worker sandbox</span>
                    </div>

                    <div className="er-spec-item">
                        <span className="er-spec-label">Triggered By</span>
                        <span className="er-spec-value">{meta.assignedTo || meta.createdBy || 'QA Automation Engineer'}</span>
                        <span className="er-spec-sub">Workspace ID: {String(meta.workspaceId || 'default').slice(-8)}</span>
                    </div>
                </div>
            </section>

            {/* ─── 4. RESULTS BY CATEGORY ─── */}
            <section className="er-section">
                <h3 className="er-section-title">Results by Category</h3>
                <div className="er-table-wrap">
                    <table className="er-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Total</th>
                                <th>Passed</th>
                                <th>Failed</th>
                                <th>Blocked</th>
                                <th>Pass Rate</th>
                                <th style={{ width: '180px' }}>Distribution</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categoriesList.map((cat, idx) => {
                                const cTotal = cat.total;
                                const cPassed = cat.passed;
                                const cFailed = cat.failed;
                                const cBlocked = cat.blocked || 0;
                                const pRate = cat.passRate;

                                return (
                                    <tr key={cat.name || idx}>
                                        <td style={{ fontWeight: 500, color: 'var(--er-text)' }}>
                                            {cat.name}
                                        </td>
                                        <td>{cTotal}</td>
                                        <td style={{ color: cPassed > 0 ? 'var(--er-jade)' : 'inherit' }}>{cPassed}</td>
                                        <td style={{ color: cFailed > 0 ? 'var(--er-fail)' : 'inherit' }}>{cFailed}</td>
                                        <td style={{ color: cBlocked > 0 ? 'var(--er-warn)' : 'inherit' }}>{cBlocked}</td>
                                        <td style={{ fontWeight: 600, color: pRate >= 80 ? 'var(--er-jade)' : cTotal > 0 ? 'var(--er-fail)' : 'inherit' }}>
                                            {cTotal > 0 ? `${pRate}%` : '—'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', background: '#1A1D1F' }}>
                                                {cTotal > 0 ? (
                                                    <>
                                                        <div style={{ width: `${(cPassed / cTotal) * 100}%`, background: 'var(--er-jade)' }} />
                                                        <div style={{ width: `${(cFailed / cTotal) * 100}%`, background: 'var(--er-fail)' }} />
                                                        <div style={{ width: `${(cBlocked / cTotal) * 100}%`, background: 'var(--er-warn)' }} />
                                                    </>
                                                ) : (
                                                    <div style={{ width: '100%', background: '#252A2D' }} />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ─── 5. TEST CASE RESULTS (CLEAN EXPANDABLE TABLE) ─── */}
            <section className="er-section">
                <div className="er-table-toolbar">
                    <h3 className="er-section-title">Test Case Results ({filteredCases.length})</h3>
                    <div className="er-table-filters">
                        <input
                            type="text"
                            value={caseSearch}
                            onChange={(e) => setCaseSearch(e.target.value)}
                            placeholder="Filter by ID or name..."
                            className="er-search-input"
                        />
                        <select
                            value={caseStatusFilter}
                            onChange={(e) => setCaseStatusFilter(e.target.value)}
                            className="er-select"
                        >
                            <option value="all">All Outcomes</option>
                            <option value="passed">Passed</option>
                            <option value="failed">Failed</option>
                            <option value="blocked">Blocked</option>
                            <option value="skipped">Skipped</option>
                            <option value="not_run">Not Run</option>
                        </select>
                        <select
                            value={caseCategoryFilter}
                            onChange={(e) => setCaseCategoryFilter(e.target.value)}
                            className="er-select"
                        >
                            <option value="all">All Categories</option>
                            {STANDARD_CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="er-table-wrap">
                    <table className="er-table">
                        <thead>
                            <tr>
                                <th style={{ width: '28px' }}></th>
                                <th>Test ID</th>
                                <th>Test Name</th>
                                <th>Category</th>
                                <th>Method</th>
                                <th>Status</th>
                                <th>Duration</th>
                                <th style={{ width: '24px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCases.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--er-text-dim)' }}>
                                        No test cases match the applied filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredCases.map(c => {
                                    const isExpanded = Boolean(expandedCases[c.id || c.testCaseId]);
                                    const st = (c.status || 'not_run').toLowerCase();

                                    return (
                                        <React.Fragment key={c.id || c.testCaseId}>
                                            <tr
                                                className="clickable"
                                                onClick={() => toggleCaseExpand(c.id || c.testCaseId)}
                                                title="Click to toggle details"
                                            >
                                                <td>
                                                    <span className={`er-dot ${st === 'passed' ? 'passed' : st === 'failed' ? 'failed' : st === 'blocked' ? 'blocked' : st === 'skipped' ? 'skipped' : 'not-run'}`} />
                                                </td>
                                                <td style={{ fontFamily: 'var(--er-mono-font)', color: 'var(--er-jade)', fontSize: '0.8rem' }}>
                                                    {c.testCaseId}
                                                </td>
                                                <td style={{ color: 'var(--er-text)', fontWeight: 500 }}>
                                                    {c.title}
                                                </td>
                                                <td>
                                                    <span className="er-cat-pill">{c.type || 'Functional'}</span>
                                                </td>
                                                <td style={{ color: 'var(--er-text-muted)' }}>
                                                    {c.executionType === 'automated' ? 'Playwright' : 'Manual'}
                                                </td>
                                                <td>
                                                    <span className={`er-status-badge ${st}`}>
                                                        {st.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td style={{ fontFamily: 'var(--er-mono-font)', color: 'var(--er-text-dim)', fontSize: '0.78rem' }}>
                                                    {c.durationMs ? formatDuration(c.durationMs) : '—'}
                                                </td>
                                                <td style={{ color: 'var(--er-text-dim)' }}>
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </td>
                                            </tr>

                                            {/* Expandable Details Drawer */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={8} style={{ padding: 0 }}>
                                                        <div className="er-row-detail">
                                                            <div className="er-detail-block">
                                                                <span className="er-detail-label">Expected Result</span>
                                                                <div className="er-detail-text" style={{ color: 'var(--er-jade)' }}>
                                                                    {c.expectedResult || c.caseSnapshot?.expectedResult || 'System should verify criteria and complete flow.'}
                                                                </div>
                                                            </div>

                                                            <div className="er-detail-block">
                                                                <span className="er-detail-label">Actual Result & Observations</span>
                                                                <div className="er-detail-text">
                                                                    {c.actualResult || 'No deviations reported.'}
                                                                </div>
                                                            </div>

                                                            {c.notes && (
                                                                <div className="er-detail-block">
                                                                    <span className="er-detail-label">Execution Notes</span>
                                                                    <div className="er-detail-text" style={{ fontStyle: 'italic', color: 'var(--er-text-muted)' }}>
                                                                        {c.notes}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="er-detail-block">
                                                                <span className="er-detail-label">Attempt Context</span>
                                                                <div className="er-detail-text" style={{ fontFamily: 'var(--er-mono-font)', fontSize: '0.76rem', color: 'var(--er-text-dim)' }}>
                                                                    Attempt #{c.currentAttempt || 1} • Executed by: {c.executedBy || 'System'}
                                                                </div>
                                                            </div>
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

            {/* ─── 6. FAILURE INVESTIGATION ─── */}
            <section className="er-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 className="er-section-title">Failure Investigation ({failures.length})</h3>
                    {failures.length > 0 && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--er-fail)', fontFamily: 'var(--er-mono-font)' }}>
                            {failures.length} Assertion Failure(s) Recorded
                        </span>
                    )}
                </div>

                {failures.length === 0 ? (
                    <div className="er-empty-failures">
                        <Check size={16} />
                        <span>Zero execution failures recorded. All executed test assertions passed within specified parameters.</span>
                    </div>
                ) : (
                    <div className="er-failures-list">
                        {failures.map((f, idx) => {
                            const fId = f.runCaseId || f.testCaseId || idx;
                            const isTraceOpen = Boolean(expandedStackTraces[fId]);
                            const screenshotUrl = f.screenshotArtifact?.url || f.screenshotUrl;

                            return (
                                <div key={fId} className="er-failure-card">
                                    <div className="er-failure-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            <span style={{ fontFamily: 'var(--er-mono-font)', color: 'var(--er-fail)', fontSize: '0.82rem', fontWeight: 600 }}>
                                                {f.testCaseId}
                                            </span>
                                            <h4 className="er-failure-title">{f.title}</h4>
                                        </div>
                                        <span style={{ fontSize: '0.74rem', color: 'var(--er-text-dim)' }}>
                                            Failed at: {formatTimestamp(f.failedAt)} • {f.durationMs ? formatDuration(f.durationMs) : '0s'}
                                        </span>
                                    </div>

                                    {/* Error Message */}
                                    {f.errorMessage && (
                                        <div>
                                            <span className="er-detail-label" style={{ marginBottom: '4px', display: 'block' }}>Error Message</span>
                                            <div className="er-error-box">{f.errorMessage}</div>
                                        </div>
                                    )}

                                    {/* Expected vs Actual */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                        <div>
                                            <span className="er-detail-label">Expected Result</span>
                                            <div style={{ color: 'var(--er-jade)', fontSize: '0.82rem', marginTop: '2px' }}>
                                                {f.expectedResult || 'Expected scenario to complete successfully.'}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="er-detail-label">Actual Observation</span>
                                            <div style={{ color: 'var(--er-fail)', fontSize: '0.82rem', marginTop: '2px' }}>
                                                {f.actualResult || f.errorMessage || 'Assertion mismatch occurred.'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stack Trace Collapsible */}
                                    {f.stackTrace && (
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => toggleStackTrace(fId)}
                                                className="er-btn"
                                                style={{ fontSize: '0.74rem', padding: '0.3rem 0.6rem', marginBottom: '0.5rem' }}
                                            >
                                                {isTraceOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                <span>{isTraceOpen ? 'Hide Stack Trace' : 'View Stack Trace'}</span>
                                            </button>
                                            {isTraceOpen && (
                                                <pre className="er-stack-trace">{f.stackTrace}</pre>
                                            )}
                                        </div>
                                    )}

                                    {/* Screenshot Artifact Preview */}
                                    {screenshotUrl && (
                                        <div>
                                            <span className="er-detail-label" style={{ marginBottom: '4px', display: 'block' }}>Screenshot Artifact</span>
                                            <img
                                                src={screenshotUrl}
                                                alt={`Failure artifact for ${f.testCaseId}`}
                                                className="er-screenshot-thumb"
                                                onClick={() => setPreviewImage(screenshotUrl)}
                                                title="Click to expand full resolution image"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ─── 7. REQUIREMENT COVERAGE ─── */}
            <section className="er-section">
                <div className="er-coverage-summary">
                    <h3 className="er-section-title">Requirement Traceability & Coverage</h3>
                    <span style={{ fontSize: '0.84rem', color: isPending ? 'var(--er-text-dim)' : 'var(--er-jade)', fontFamily: 'var(--er-mono-font)' }}>
                        {isPending ? '0% Verified (Pending Execution)' : `${coveragePct}% Verified`}
                    </span>
                </div>

                {/* Horizontal Traceability Progress Bar */}
                <div className="er-coverage-bar-track">
                    <div
                        style={{
                            width: `${coveragePct}%`,
                            background: 'var(--er-jade)',
                            height: '100%',
                            transition: 'width 0.3s ease'
                        }}
                    />
                </div>

                <div className="er-coverage-counts">
                    <span>Total Requirements: <strong>{coverage.totalRequirements || 0}</strong></span>
                    <span>•</span>
                    <span style={{ color: 'var(--er-jade)' }}>Verified: <strong>{verifiedReqsCount}</strong></span>
                    <span>•</span>
                    <span style={{ color: failedReqsCount > 0 ? 'var(--er-fail)' : 'inherit' }}>Failing: <strong>{failedReqsCount}</strong></span>
                    <span>•</span>
                    <span style={{ color: uncoveredReqsCount > 0 ? 'var(--er-warn)' : 'inherit' }}>Uncovered: <strong>{uncoveredReqsCount}</strong></span>
                </div>

                {/* Requirements Table */}
                {requirementsList.length > 0 && (
                    <div className="er-table-wrap" style={{ marginTop: '0.5rem' }}>
                        <table className="er-table">
                            <thead>
                                <tr>
                                    <th>Requirement ID</th>
                                    <th>Category</th>
                                    <th>Specification Description</th>
                                    <th>Status</th>
                                    <th>Linked Tests</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requirementsList.map(req => {
                                    const st = req.status;
                                    const isUncovered = st === 'uncovered';

                                    return (
                                        <tr key={req.id}>
                                            <td style={{ fontFamily: 'var(--er-mono-font)', color: isUncovered ? 'var(--er-warn)' : 'var(--er-jade)', fontSize: '0.78rem' }}>
                                                {req.id}
                                            </td>
                                            <td>
                                                <span className="er-cat-pill">{req.category || 'Functional'}</span>
                                            </td>
                                            <td style={{ color: 'var(--er-text)', maxWidth: '420px' }}>
                                                {req.description}
                                            </td>
                                            <td>
                                                <span className={`er-status-badge ${st === 'verified' ? 'passed' : st === 'failed' ? 'failed' : 'pending'}`}>
                                                    {st}
                                                </span>
                                            </td>
                                            <td style={{ fontFamily: 'var(--er-mono-font)', color: 'var(--er-text-dim)', fontSize: '0.78rem' }}>
                                                {(req.linkedCases || []).length} linked
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ─── 8. FINAL REPORT CONCLUSION ─── */}
            <section className="er-section">
                <h3 className="er-section-title">Final Report Summary & Next Actions</h3>
                <div className="er-conclusion-box">
                    <div className={`er-conclusion-status ${isPending ? 'pending' : failedCount === 0 && executedCount > 0 ? 'ready' : 'attention'}`}>
                        {isPending ? (
                            <>
                                <Clock size={16} />
                                <span>Execution Pending — Suite Ready for Run</span>
                            </>
                        ) : failedCount === 0 && executedCount > 0 ? (
                            <>
                                <Check size={16} />
                                <span>Release Ready — All {executedCount} Test Scenarios Passed</span>
                            </>
                        ) : (
                            <>
                                <AlertTriangle size={16} />
                                <span>Remediation Required — {failedCount} Failure(s) Detected</span>
                            </>
                        )}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--er-text-muted)', lineHeight: '1.5' }}>
                        {isPending
                            ? `This execution report reflects a newly created test run consisting of ${totalCasesCount} test cases. No executions have occurred yet. Proceed to trigger the Playwright automation suite or conduct manual step verification.`
                            : failedCount === 0 && executedCount > 0
                            ? `All ${executedCount} executed test cases met functional expectations with zero reported assertion failures or timeouts. The software satisfies the verified requirements in the current build.`
                            : `The test run completed with ${failedCount} failure(s) across ${executedCount} executed tests. Engineering attention is required to address root cause assertions before proceeding with release deployment.`}
                    </div>

                    <div className="er-actions-checklist">
                        <span className="er-detail-label">Recommended Next Actions</span>
                        {failedCount > 0 && (
                            <div className="er-action-item">
                                <span style={{ color: 'var(--er-fail)' }}>•</span>
                                <span>Review failure stack traces and failure screenshot artifacts in the investigation section.</span>
                            </div>
                        )}
                        {uncoveredReqsCount > 0 && (
                            <div className="er-action-item">
                                <span style={{ color: 'var(--er-warn)' }}>•</span>
                                <span>Generate or link additional test cases for the {uncoveredReqsCount} uncovered requirement(s).</span>
                            </div>
                        )}
                        <div className="er-action-item">
                            <span style={{ color: 'var(--er-jade)' }}>•</span>
                            <span>Export or archive executive report artifact (PDF or CSV) for build audit compliance.</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Screenshot Modal Lightbox */}
            {previewImage && (
                <div
                    onClick={() => setPreviewImage(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.88)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem'
                    }}
                >
                    <img
                        src={previewImage}
                        alt="Zoomed failure artifact"
                        style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: '6px', border: '1px solid var(--er-border)' }}
                    />
                </div>
            )}
        </div>
    );
};

export default RunReportView;
