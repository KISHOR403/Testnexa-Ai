import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
    AlertTriangle, Clock, Download, Printer, RefreshCw,
    ChevronDown, ChevronUp, Check, AlertCircle, Copy,
    Camera, Video, Network, Terminal, FileText
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../loading';
import '../../styles/app/WorkspaceDesignSystem.css';
import '../../styles/app/ExecutionReport.css';
import '../../styles/app/ExecutionDiagnostics.css';

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

const formatDisplayValue = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') {
        try {
            return JSON.stringify(val);
        } catch {
            return String(val);
        }
    }
    return String(val);
};

const formatUserLabel = (user) => {
    if (!user) return 'QA Automation Engineer';
    if (typeof user === 'string') return user;
    if (typeof user === 'object') return user.name || user.email || user.username || user.id || 'QA Automation Engineer';
    return String(user);
};

const diagnosticArtifactKind = (artifact) => {
    const type = String(artifact.artifactType || '').toLowerCase();
    const mime = String(artifact.mimeType || '').toLowerCase();
    const name = String(artifact.name || '').toLowerCase();
    if (type.includes('trace') || name.endsWith('.zip') && artifact.metadata?.trace) return 'trace';
    if (type.includes('video') || mime.startsWith('video/')) return 'video';
    if (type.includes('log') || mime.startsWith('text/')) return 'console';
    if (type.includes('screenshot') || mime.startsWith('image/')) return 'screenshots';
    return 'other';
};

const diagnosticSize = (value = 0) => {
    const size = Number(value);
    if (!size) return 'Size unavailable';
    return size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const STANDARD_CATEGORIES = ['Functional', 'Negative', 'Edge', 'API', 'Non-Functional'];

const normalizeCategories = (rawCats) => {
    const rawMap = new Map();
    const list = Array.isArray(rawCats)
        ? rawCats
        : Object.entries(rawCats || {}).map(([k, v]) => ({ category: k, ...v }));

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
};

const RunReportView = ({ runId, onRerunTriggered }) => {
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Interactive view state
    const [expandedCases, setExpandedCases] = useState({});
    const [caseSearch, setCaseSearch] = useState('');
    const [caseStatusFilter, setCaseStatusFilter] = useState('all');
    const [caseCategoryFilter, setCaseCategoryFilter] = useState('all');
    const [isRerunning, setIsRerunning] = useState(false);
    const [rerunStatus, setRerunStatus] = useState(null);
    const [diagnosticArtifacts, setDiagnosticArtifacts] = useState([]);
    const [isLoadingDiagnosticArtifacts, setIsLoadingDiagnosticArtifacts] = useState(true);
    const [diagnosticArtifactError, setDiagnosticArtifactError] = useState('');
    const [selectedFailureId, setSelectedFailureId] = useState('');
    const [activeEvidenceTab, setActiveEvidenceTab] = useState('console');
    const [selectedDiagnosticArtifact, setSelectedDiagnosticArtifact] = useState(null);
    const [diagnosticBlobUrl, setDiagnosticBlobUrl] = useState('');
    const [diagnosticText, setDiagnosticText] = useState('');
    const [diagnosticPreviewError, setDiagnosticPreviewError] = useState('');
    const [isLoadingDiagnosticPreview, setIsLoadingDiagnosticPreview] = useState(false);
    const [diagnosticNotice, setDiagnosticNotice] = useState('');

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

    useEffect(() => {
        let current = true;
        setIsLoadingDiagnosticArtifacts(true);
        executionService.listRunArtifacts(runId).then(result => {
            if (current && result?.success) setDiagnosticArtifacts(result.data || []);
            else if (current) setDiagnosticArtifactError(result?.message || 'Evidence could not be loaded.');
        }).catch(err => { if (current) setDiagnosticArtifactError(err.message || 'Evidence could not be loaded.'); })
            .finally(() => { if (current) setIsLoadingDiagnosticArtifacts(false); });
        return () => { current = false; };
    }, [runId]);

    useEffect(() => {
        if (!selectedDiagnosticArtifact) return undefined;
        if (diagnosticArtifactKind(selectedDiagnosticArtifact) === 'trace') {
            setIsLoadingDiagnosticPreview(false);
            setDiagnosticBlobUrl('');
            setDiagnosticText('');
            setDiagnosticPreviewError('');
            return undefined;
        }
        let current = true;
        let objectUrl;
        setIsLoadingDiagnosticPreview(true);
        setDiagnosticPreviewError('');
        setDiagnosticBlobUrl('');
        setDiagnosticText('');
        executionService.getArtifactFile(runId, selectedDiagnosticArtifact.id).then(async blob => {
            objectUrl = URL.createObjectURL(blob);
            const text = diagnosticArtifactKind(selectedDiagnosticArtifact) === 'console' ? await blob.text() : '';
            if (current) {
                setDiagnosticBlobUrl(objectUrl);
                setDiagnosticText(text);
            } else URL.revokeObjectURL(objectUrl);
        }).catch(err => { if (current) setDiagnosticPreviewError(err.status === 404 ? 'This evidence file is missing or expired.' : err.message || 'This evidence file could not be loaded.'); })
            .finally(() => { if (current) setIsLoadingDiagnosticPreview(false); });
        return () => { current = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [runId, selectedDiagnosticArtifact]);

    const toggleCaseExpand = (id) => {
        setExpandedCases(prev => ({ ...prev, [id]: !prev[id] }));
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

    const handleRerunFailure = async (failure) => {
        if (!failure?.runCaseId) return;
        setIsRerunning(true);
        setRerunStatus(null);
        try {
            const result = await executionService.rerun({ runId, scope: 'selected', caseIds: [failure.runCaseId] });
            if (!result.success) throw new Error(result.message || 'Rerun could not be started.');
            const count = result.data?.rerunCasesCount || result.data?.rerunCount || 0;
            setRerunStatus(`Rerun queued for ${count} test case${count === 1 ? '' : 's'}.`);
            onRerunTriggered?.(result.data);
            window.setTimeout(loadReport, 1500);
        } catch (err) {
            setRerunStatus(err.message || 'Rerun could not be started.');
        } finally {
            setIsRerunning(false);
        }
    };

    const downloadDiagnosticArtifact = async (artifact) => {
        try {
            const blob = await executionService.getArtifactFile(runId, artifact.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = artifact.name || 'execution-evidence';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            setDiagnosticNotice(err.status === 404 ? 'The evidence file is missing or expired.' : err.message || 'Evidence download failed.');
            window.setTimeout(() => setDiagnosticNotice(''), 3000);
        }
    };

    const copyDiagnosticText = async (text, message) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setDiagnosticNotice(message);
        } catch {
            setDiagnosticNotice('Clipboard access is unavailable in this browser.');
        }
        window.setTimeout(() => setDiagnosticNotice(''), 2200);
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
    const diagnosticSummary = report.diagnosticsSummary || {};
    const coverage = report.coverage || report.requirementCoverage || {};
    const allCases = report.cases || [];
    const selectedFailure = failures.find(item => (item.runCaseId || item.testCaseId) === selectedFailureId) || failures[0] || null;
    const selectedFailureCase = selectedFailure && allCases.find(item => item.id === selectedFailure.runCaseId || item.testCaseId === selectedFailure.testCaseId);
    const selectedFailureArtifacts = selectedFailure
        ? diagnosticArtifacts.filter(item => !item.runCaseId || item.runCaseId === selectedFailure.runCaseId)
        : [];
    const visibleDiagnosticArtifacts = selectedFailureArtifacts.filter(item => diagnosticArtifactKind(item) === activeEvidenceTab);
    const warningCount = diagnosticSummary.warnings ?? null;

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
    const categoriesList = normalizeCategories(rawCats);

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
                        <span className="er-spec-value">{formatUserLabel(meta.assignedTo || meta.createdBy)}</span>
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
                                                                    {formatDisplayValue(c.expectedResult || c.caseSnapshot?.expectedResult, 'System should verify criteria and complete flow.')}
                                                                </div>
                                                            </div>

                                                            <div className="er-detail-block">
                                                                <span className="er-detail-label">Actual Result & Observations</span>
                                                                <div className="er-detail-text">
                                                                    {formatDisplayValue(c.actualResult, 'No deviations reported.')}
                                                                </div>
                                                            </div>

                                                            {c.notes && (
                                                                <div className="er-detail-block">
                                                                    <span className="er-detail-label">Execution Notes</span>
                                                                    <div className="er-detail-text" style={{ fontStyle: 'italic', color: 'var(--er-text-muted)' }}>
                                                                        {formatDisplayValue(c.notes)}
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

            {/* ─── 6. FAILURE DIAGNOSTICS ─── */}
            <section className="er-section diagnostics-workspace">
                <div className="diagnostics-heading">
                    <div>
                        <h3 className="er-section-title">Diagnostics</h3>
                        <p>Recorded failures, attempts and execution evidence for this run.</p>
                    </div>
                </div>

                <div className="diagnostics-overview" aria-label="Diagnostics summary">
                    <span><i className="fail" />Failures <strong>{diagnosticSummary.failures ?? failures.length}</strong></span>
                    <span><i className="error" />Errors <strong>{diagnosticSummary.errors ?? allCases.filter(item => item.status === 'infrastructure_error').length}</strong></span>
                    <span><i className="timeout" />Timeouts <strong>{diagnosticSummary.timeouts ?? allCases.filter(item => item.status === 'timed_out').length}</strong></span>
                    <span><i className="flaky" />Flaky tests <strong>{diagnosticSummary.flaky ?? allCases.filter(item => {
                        const outcomes = (item.attempts || []).map(attempt => attempt.status);
                        return outcomes.includes('passed') && outcomes.some(status => ['failed', 'timed_out', 'infrastructure_error'].includes(status));
                    }).length}</strong></span>
                    <span title={warningCount === null ? 'No warning count is available from stored execution logs' : ''}><i className="warning" />Warnings <strong>{warningCount === null ? '—' : warningCount}</strong></span>
                </div>

                {failures.length === 0 ? (
                    <div className="diagnostics-empty">No failures to investigate.</div>
                ) : (
                    <div className="diagnostics-layout">
                        <nav className="diagnostics-failure-list" aria-label="Failed tests">
                            <div className="diagnostics-list-label">Failures <span>{failures.length}</span></div>
                            {failures.map((failure, index) => {
                                const id = failure.runCaseId || failure.testCaseId || index;
                                const status = failure.status || 'failed';
                                return <button type="button" key={id} className={selectedFailure === failure ? 'active' : ''} onClick={() => { setSelectedFailureId(id); setSelectedDiagnosticArtifact(null); }}>
                                    <span className={`diagnostics-status-dot ${status}`} />
                                    <span className="diagnostics-failure-name"><strong>{failure.testCaseId}</strong><span>{failure.title}</span></span>
                                    <span className="diagnostics-failure-time">{failure.failedAt ? formatTimestamp(failure.failedAt) : '—'}</span>
                                </button>;
                            })}
                        </nav>

                        {selectedFailure && <div className="diagnostics-detail">
                            <header className="diagnostics-case-heading">
                                <div><span>{selectedFailure.testCaseId}</span><h4>{selectedFailure.title}</h4></div>
                                <div className="diagnostics-case-actions">
                                    {selectedFailure.errorMessage && <button type="button" className="er-btn" onClick={() => copyDiagnosticText(selectedFailure.errorMessage, 'Error copied')}><Copy size={13} />Copy error</button>}
                                    {selectedFailure.runCaseId && <button type="button" className="er-btn" disabled={isRerunning} onClick={() => handleRerunFailure(selectedFailure)}><RefreshCw size={13} />{isRerunning ? 'Rerunning…' : 'Rerun failed test'}</button>}
                                </div>
                            </header>

                            {rerunStatus && <div className="diagnostics-notice" role="status">{rerunStatus}</div>}
                            {selectedFailure.errorMessage && <div className="diagnostics-error-message"><div className="diagnostics-section-label">Error message</div><p>{formatDisplayValue(selectedFailure.errorMessage)}</p></div>}

                            <div className="diagnostics-result-grid">
                                <div><span className="diagnostics-section-label">Failed step</span><p>{formatDisplayValue(selectedFailure.failedStep, 'Step detail was not recorded.')}</p></div>
                                <div><span className="diagnostics-section-label">Expected result</span><p>{formatDisplayValue(selectedFailure.expectedResult, 'Expected result was not recorded.')}</p></div>
                                <div><span className="diagnostics-section-label">Actual result</span><p>{formatDisplayValue(selectedFailure.actualResult, 'Actual result was not recorded.')}</p></div>
                            </div>

                            <div className="diagnostics-context-line">
                                <span>Environment <strong>{formatDisplayValue(env.name && env.name !== 'Default Environment' ? env.name : 'Not recorded')}</strong></span>
                                <span>Target <strong>{formatDisplayValue(env.baseUrl && env.baseUrl !== 'N/A' ? env.baseUrl : 'Not recorded')}</strong></span>
                                <span>Browser <strong>{formatDisplayValue(selectedFailure.browserInfo, 'Not recorded')}</strong></span>
                                <span>Duration <strong>{selectedFailure.durationMs ? formatDuration(selectedFailure.durationMs) : 'Not recorded'}</strong></span>
                            </div>

                            <section className="diagnostics-subsection">
                                <div className="diagnostics-subheading"><h5>Failure timeline</h5><span>Attempt and evidence events recorded by this run</span></div>
                                <ol className="diagnostics-timeline">
                                    {[...(selectedFailureCase?.attempts || []).map(attempt => ({
                                        id: `attempt-${attempt.id || attempt.attemptNumber}`,
                                        at: attempt.executedAt,
                                        label: `Attempt ${attempt.attemptNumber || ''} recorded`.trim(),
                                        detail: attempt.status || 'Status unavailable',
                                        duration: attempt.durationMs
                                    })), ...diagnosticArtifacts.filter(item => item.runCaseId === selectedFailure.runCaseId).map(item => ({
                                        id: `artifact-${item.id}`, at: item.createdAt,
                                        label: `${item.artifactType || 'Evidence'} captured`, detail: item.name
                                    }))].filter(event => event.at).sort((a, b) => new Date(a.at) - new Date(b.at)).map(event => <li key={event.id}>
                                        <span className="diagnostics-timeline-marker" />
                                        <div><strong>{event.label}</strong><span>{event.detail}{event.duration ? ` · ${formatDuration(event.duration)}` : ''}</span></div>
                                        <time>{formatTimestamp(event.at)}</time>
                                    </li>)}
                                </ol>
                                <p className="diagnostics-timeline-note">Per-step browser initialization, actions and assertions are not available in the stored execution history.</p>
                            </section>

                            {selectedFailure.stackTrace && <section className="diagnostics-subsection">
                                <div className="diagnostics-subheading"><h5>Stack trace</h5><button type="button" className="er-btn" onClick={() => copyDiagnosticText(selectedFailure.stackTrace, 'Stack trace copied')}><Copy size={13} />Copy trace</button></div>
                                <pre className="diagnostics-stack-trace">{selectedFailure.stackTrace}</pre>
                            </section>}

                            <section className="diagnostics-subsection diagnostics-evidence">
                                <div className="diagnostics-subheading"><h5>Technical evidence</h5></div>
                                <nav className="diagnostics-evidence-tabs" aria-label="Technical evidence type">
                                    {[
                                        ['console', <Terminal size={13} />, 'Console logs'],
                                        ['network', <Network size={13} />, 'Network requests'],
                                        ['trace', <FileText size={13} />, 'Playwright trace'],
                                        ['screenshots', <Camera size={13} />, 'Screenshots'],
                                        ['video', <Video size={13} />, 'Video recordings']
                                    ].map(([key, icon, label]) => <button type="button" key={key} className={activeEvidenceTab === key ? 'active' : ''} onClick={() => { setActiveEvidenceTab(key); setSelectedDiagnosticArtifact(null); }}>{icon}{label}</button>)}
                                </nav>

                                {activeEvidenceTab === 'network' ? <div className="diagnostics-evidence-empty">Network request capture is not available for this execution.</div> : isLoadingDiagnosticArtifacts ? <div className="diagnostics-evidence-empty">Loading execution evidence…</div> : diagnosticArtifactError ? <div className="diagnostics-evidence-empty diagnostics-evidence-error">{diagnosticArtifactError}</div> : visibleDiagnosticArtifacts.length === 0 ? <div className="diagnostics-evidence-empty">No {activeEvidenceTab === 'console' ? 'console logs' : activeEvidenceTab === 'trace' ? 'Playwright traces' : activeEvidenceTab === 'screenshots' ? 'screenshots' : 'video recordings'} were recorded for this test.</div> : (
                                    <div className="diagnostics-evidence-content">
                                        <div className="diagnostics-artifact-list">
                                            {visibleDiagnosticArtifacts.map(artifact => <div key={artifact.id} className={`diagnostics-artifact-row ${selectedDiagnosticArtifact?.id === artifact.id ? 'active' : ''}`}>
                                                <button type="button" onClick={() => setSelectedDiagnosticArtifact(artifact)}><span>{artifact.name}</span><small>{diagnosticSize(artifact.sizeBytes)} · {artifact.createdAt ? formatTimestamp(artifact.createdAt) : 'Timestamp unavailable'}</small></button>
                                                <button type="button" className="diagnostics-icon-button" aria-label={`Download ${artifact.name}`} title="Download" onClick={() => downloadDiagnosticArtifact(artifact)}><Download size={14} /></button>
                                            </div>)}
                                        </div>
                                        {selectedDiagnosticArtifact && <div className="diagnostics-artifact-preview">
                                            {isLoadingDiagnosticPreview ? <span>Loading evidence…</span> : diagnosticPreviewError ? <span className="diagnostics-evidence-error">{diagnosticPreviewError}</span> : diagnosticArtifactKind(selectedDiagnosticArtifact) === 'trace' ? <span>Trace viewer is not integrated. Download this trace to inspect it with Playwright.</span> : diagnosticBlobUrl && diagnosticArtifactKind(selectedDiagnosticArtifact) === 'screenshots' ? <img src={diagnosticBlobUrl} alt={selectedDiagnosticArtifact.name} /> : diagnosticBlobUrl && diagnosticArtifactKind(selectedDiagnosticArtifact) === 'video' ? <video src={diagnosticBlobUrl} controls preload="metadata">Video playback is unavailable in this browser.</video> : diagnosticBlobUrl && diagnosticArtifactKind(selectedDiagnosticArtifact) === 'console' ? <pre>{diagnosticText}</pre> : <span>Preview is not supported for this file type.</span>}
                                            {diagnosticArtifactKind(selectedDiagnosticArtifact) === 'console' && diagnosticBlobUrl && <button type="button" className="er-btn" onClick={() => copyDiagnosticText(diagnosticText, 'Log contents copied')}><Copy size={13} />Copy logs</button>}
                                        </div>}
                                    </div>
                                )}
                            </section>
                        </div>}
                    </div>
                )}
                {diagnosticNotice && <div className="diagnostics-toast" role="status">{diagnosticNotice}</div>}
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

        </div>
    );
};

export default RunReportView;
