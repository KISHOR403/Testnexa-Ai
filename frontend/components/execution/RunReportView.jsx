import React, { useState, useEffect, useCallback } from 'react';
import {
    CheckCircle2, XCircle, AlertTriangle, MinusCircle, Clock,
    Download, Printer, FileText, Bot, User, Terminal, ArrowRight,
    RefreshCw, Layers, Shield, ExternalLink, ChevronDown, ChevronUp,
    Check, AlertCircle, Eye
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../loading';
import '../../styles/app/WorkspaceDesignSystem.css';

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
            minute: '2-digit',
            second: '2-digit'
        });
    } catch {
        return iso;
    }
};

const RunReportView = ({ runId, onRerunTriggered, onSwitchToCases }) => {
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedFailures, setExpandedFailures] = useState({});
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

    const handleRerun = async (scope) => {
        setIsRerunning(true);
        setRerunStatus(null);
        try {
            const res = await executionService.rerun({ runId, scope });
            if (res.success) {
                setRerunStatus(`Rerun initiated (${res.data?.rerunCount || 0} cases queued).`);
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
            <div className="ws-empty-state" style={{ margin: '2rem 0' }}>
                <AlertTriangle size={32} color="#E06C75" />
                <h2>Report Generation Failed</h2>
                <p>{error || 'Execution records could not be loaded.'}</p>
                <button type="button" onClick={loadReport} className="ws-btn-primary" style={{ marginTop: '1rem' }}>
                    <RefreshCw size={14} />
                    <span>Retry Report Generation</span>
                </button>
            </div>
        );
    }

    const m = report.metrics || {};
    const meta = report.meta || {};
    const method = report.methodBreakdown || {};
    const cats = report.categories || {};
    const failures = report.failures || [];
    const coverage = report.requirementCoverage || {};

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
            {/* ─── 1. Report Header & Quick Actions ─── */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
                borderBottom: '1px solid #292D2D',
                paddingBottom: '1.25rem'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                            padding: '2px 8px',
                            background: meta.status === 'completed' ? 'rgba(139, 175, 154, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            color: meta.status === 'completed' ? '#8BAF9A' : '#38BDF8',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                        }}>
                            {meta.status}
                        </span>
                        <span style={{ color: '#A0A5A5', fontSize: '0.85rem' }}>Run #{meta.runId?.slice(-6)}</span>
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#F2F3F3', margin: 0 }}>
                        {meta.runName || 'Unified Execution Report'}
                    </h1>
                    <p style={{ margin: '4px 0 0', color: '#A0A5A5', fontSize: '0.85rem' }}>
                        Suite: <strong style={{ color: '#F2F3F3' }}>{meta.suiteTitle}</strong> (v{meta.suiteVersion}) • Env: <strong style={{ color: '#F2F3F3' }}>{meta.targetEnvironment?.name || 'Default'}</strong>
                    </p>
                </div>

                {/* Export & Rerun Toolbar */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {m.failed > 0 && (
                        <button
                            type="button"
                            onClick={() => handleRerun('failed')}
                            disabled={isRerunning}
                            className="ws-btn-primary"
                            style={{ background: '#E06C75', borderColor: '#E06C75', color: '#FFFFFF' }}
                            title="Rerun only failed test cases"
                        >
                            <RefreshCw size={13} className={isRerunning ? 'spin' : ''} />
                            <span>Rerun Failed ({m.failed})</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => handleRerun('all')}
                        disabled={isRerunning}
                        className="ws-btn-secondary"
                        title="Rerun the entire suite"
                    >
                        <RefreshCw size={13} className={isRerunning ? 'spin' : ''} />
                        <span>Rerun Full Suite</span>
                    </button>

                    <div style={{ width: '1px', height: '24px', background: '#292D2D', margin: '0 4px' }} />

                    <button
                        type="button"
                        onClick={() => handleExport('pdf')}
                        className="ws-btn-secondary"
                        title="Open Printable PDF Executive Report"
                    >
                        <Printer size={13} />
                        <span>Print / PDF</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleExport('csv')}
                        className="ws-btn-secondary"
                        title="Download CSV Test Results"
                    >
                        <Download size={13} />
                        <span>CSV</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleExport('json')}
                        className="ws-btn-secondary"
                        title="Export JSON Execution Schema"
                    >
                        <FileText size={13} />
                        <span>JSON</span>
                    </button>
                </div>
            </div>

            {rerunStatus && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: rerunStatus.includes('failed') ? 'rgba(224, 108, 117, 0.12)' : 'rgba(139, 175, 154, 0.12)',
                    border: `1px solid ${rerunStatus.includes('failed') ? 'rgba(224, 108, 117, 0.3)' : 'rgba(139, 175, 154, 0.3)'}`,
                    borderRadius: '6px',
                    color: rerunStatus.includes('failed') ? '#E06C75' : '#8BAF9A',
                    fontSize: '0.85rem'
                }}>
                    {rerunStatus}
                </div>
            )}

            {/* ─── 2. Executive KPI Cards Grid ─── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '12px'
            }}>
                <div className="ws-stat-card">
                    <span className="ws-stat-label">TOTAL CASES</span>
                    <span className="ws-stat-value">{m.total}</span>
                    <span className="ws-stat-sub">100% of planned suite</span>
                </div>

                <div className="ws-stat-card" style={{ borderColor: m.passRate >= 80 ? 'rgba(139, 175, 154, 0.3)' : 'rgba(224, 108, 117, 0.3)' }}>
                    <span className="ws-stat-label">PASS RATE</span>
                    <span className="ws-stat-value" style={{ color: m.passRate >= 80 ? '#8BAF9A' : '#E06C75' }}>
                        {m.passRate}%
                    </span>
                    <span className="ws-stat-sub">{m.passed} passed / {m.executed} executed</span>
                </div>

                <div className="ws-stat-card">
                    <span className="ws-stat-label">FAILED CASES</span>
                    <span className="ws-stat-value" style={{ color: m.failed > 0 ? '#E06C75' : '#8BAF9A' }}>
                        {m.failed}
                    </span>
                    <span className="ws-stat-sub">{m.blocked > 0 ? `${m.blocked} blocked` : '0 blocked'}</span>
                </div>

                <div className="ws-stat-card">
                    <span className="ws-stat-label">EXECUTION DURATION</span>
                    <span className="ws-stat-value">{formatDuration(m.durationMs)}</span>
                    <span className="ws-stat-sub">{m.avgDurationMs ? `Avg ${formatDuration(m.avgDurationMs)} / test` : 'Completed'}</span>
                </div>

                <div className="ws-stat-card">
                    <span className="ws-stat-label">EXECUTION METHOD</span>
                    <span className="ws-stat-value" style={{ fontSize: '1.25rem', textTransform: 'capitalize' }}>
                        {meta.executionType}
                    </span>
                    <span className="ws-stat-sub">
                        {method.automated} Playwright · {method.manual} Manual
                    </span>
                </div>
            </div>

            {/* ─── 3. Execution Method Breakdown ─── */}
            <div style={{
                background: '#161819',
                border: '1px solid #292D2D',
                borderRadius: '8px',
                padding: '1.25rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#F2F3F3' }}>
                        Execution Method & Automation Coverage
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#A0A5A5' }}>
                        {method.automationAdoptionRate}% Automated via Playwright
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <Bot size={16} color="#38BDF8" />
                            <strong style={{ color: '#38BDF8', fontSize: '0.9rem' }}>Playwright Automation</strong>
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#F2F3F3' }}>{method.automated} <span style={{ fontSize: '0.8rem', color: '#A0A5A5', fontWeight: 400 }}>cases</span></div>
                        <div style={{ fontSize: '0.75rem', color: '#A0A5A5', marginTop: '4px' }}>{method.automatedPassRate}% pass rate · Isolated Chromium worker</div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid #292D2D', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <User size={16} color="#A0A5A5" />
                            <strong style={{ color: '#F2F3F3', fontSize: '0.9rem' }}>Manual Verification</strong>
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#F2F3F3' }}>{method.manual} <span style={{ fontSize: '0.8rem', color: '#A0A5A5', fontWeight: 400 }}>cases</span></div>
                        <div style={{ fontSize: '0.75rem', color: '#A0A5A5', marginTop: '4px' }}>{method.manualPassRate}% pass rate · Verified by QA engineer</div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(139, 175, 154, 0.05)', border: '1px solid rgba(139, 175, 154, 0.2)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <Clock size={16} color="#8BAF9A" />
                            <strong style={{ color: '#8BAF9A', fontSize: '0.9rem' }}>Timestamps & Duration</strong>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#F2F3F3', marginTop: '6px' }}>Started: <strong>{formatTimestamp(meta.startedAt)}</strong></div>
                        <div style={{ fontSize: '0.8rem', color: '#F2F3F3', marginTop: '2px' }}>Ended: <strong>{formatTimestamp(meta.completedAt)}</strong></div>
                    </div>
                </div>
            </div>

            {/* ─── 4. Failure Investigation Drawer / Section ─── */}
            <div style={{
                background: '#161819',
                border: '1px solid #292D2D',
                borderRadius: '8px',
                padding: '1.25rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#F2F3F3' }}>
                            Failure Investigation & Diagnostics
                        </h2>
                        <p style={{ margin: '2px 0 0', color: '#A0A5A5', fontSize: '0.8rem' }}>
                            Root cause evidence, failed assertions, stack traces, and screenshots from real execution attempts.
                        </p>
                    </div>
                    <span style={{
                        padding: '3px 8px',
                        background: failures.length > 0 ? 'rgba(224, 108, 117, 0.15)' : 'rgba(139, 175, 154, 0.15)',
                        color: failures.length > 0 ? '#E06C75' : '#8BAF9A',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                    }}>
                        {failures.length} {failures.length === 1 ? 'Failure' : 'Failures'} Identified
                    </span>
                </div>

                {failures.length === 0 ? (
                    <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        background: 'rgba(139, 175, 154, 0.05)',
                        borderRadius: '6px',
                        border: '1px dashed rgba(139, 175, 154, 0.25)'
                    }}>
                        <CheckCircle2 size={32} color="#8BAF9A" style={{ margin: '0 auto 8px' }} />
                        <h3 style={{ margin: 0, color: '#8BAF9A', fontSize: '1rem' }}>Zero Execution Failures</h3>
                        <p style={{ margin: '4px 0 0', color: '#A0A5A5', fontSize: '0.85rem' }}>
                            All executed test cases met expectations without assertion errors or timeouts.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {failures.map((f, idx) => {
                            const isExpanded = Boolean(expandedFailures[f.id]);
                            const isAuto = f.executorType === 'automated' || f.isAutomated;

                            return (
                                <div
                                    key={f.id || idx}
                                    style={{
                                        background: '#0D0E0E',
                                        border: '1px solid rgba(224, 108, 117, 0.25)',
                                        borderRadius: '6px',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div
                                        onClick={() => toggleFailureExpand(f.id)}
                                        style={{
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderBottom: isExpanded ? '1px solid #292D2D' : 'none',
                                            background: 'rgba(224, 108, 117, 0.03)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <XCircle size={16} color="#E06C75" />
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontFamily: 'monospace', color: '#E06C75', fontWeight: 600, fontSize: '0.85rem' }}>
                                                        {f.testCaseId}
                                                    </span>
                                                    <span style={{ color: '#F2F3F3', fontWeight: 500, fontSize: '0.9rem' }}>
                                                        {f.title}
                                                    </span>
                                                    <span style={{
                                                        padding: '1px 6px',
                                                        borderRadius: '3px',
                                                        fontSize: '0.68rem',
                                                        background: isAuto ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                        color: isAuto ? '#38BDF8' : '#A0A5A5'
                                                    }}>
                                                        {isAuto ? 'Playwright' : 'Manual'}
                                                    </span>
                                                </div>
                                                <div style={{ color: '#E06C75', fontSize: '0.8rem', marginTop: '3px', fontFamily: 'monospace' }}>
                                                    {f.errorMessage?.slice(0, 110) || f.actualResult || 'Assertion or expectation failed.'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#A0A5A5' }}>
                                                Attempt #{f.attempt || 1} · {formatDuration(f.durationMs)}
                                            </span>
                                            {isExpanded ? <ChevronUp size={16} color="#A0A5A5" /> : <ChevronDown size={16} color="#A0A5A5" />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                            {/* Automated Specific Diagnostic Details */}
                                            {isAuto && (
                                                <>
                                                    {f.failedAssertion && (
                                                        <div>
                                                            <span style={{ fontSize: '0.72rem', color: '#A0A5A5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>FAILED ASSERTION</span>
                                                            <div style={{ fontFamily: 'monospace', color: '#F2F3F3', background: '#161819', padding: '6px 10px', borderRadius: '4px', fontSize: '0.82rem', marginTop: '2px' }}>
                                                                {f.failedAssertion}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {f.scriptRef && (
                                                        <div>
                                                            <span style={{ fontSize: '0.72rem', color: '#A0A5A5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SCRIPT REFERENCE</span>
                                                            <div style={{ fontFamily: 'monospace', color: '#38BDF8', fontSize: '0.8rem', marginTop: '2px' }}>
                                                                {f.scriptRef}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {f.stackTrace && (
                                                        <div>
                                                            <span style={{ fontSize: '0.72rem', color: '#A0A5A5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>STACK TRACE</span>
                                                            <pre style={{
                                                                margin: '4px 0 0',
                                                                padding: '8px 10px',
                                                                background: '#161819',
                                                                border: '1px solid #292D2D',
                                                                borderRadius: '4px',
                                                                color: '#E06C75',
                                                                fontFamily: 'monospace',
                                                                fontSize: '0.75rem',
                                                                overflowX: 'auto',
                                                                maxHeight: '180px'
                                                            }}>
                                                                {f.stackTrace}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Manual Specific Diagnostic Details */}
                                            {!isAuto && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                    <div>
                                                        <span style={{ fontSize: '0.72rem', color: '#A0A5A5', textTransform: 'uppercase' }}>EXPECTED RESULT</span>
                                                        <div style={{ color: '#8BAF9A', fontSize: '0.82rem', marginTop: '2px' }}>{f.expectedResult || 'Expected outcome met'}</div>
                                                    </div>
                                                    <div>
                                                        <span style={{ fontSize: '0.72rem', color: '#A0A5A5', textTransform: 'uppercase' }}>ACTUAL TESTER OBSERVATION</span>
                                                        <div style={{ color: '#E06C75', fontSize: '0.82rem', marginTop: '2px' }}>{f.actualResult || 'No observation recorded'}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Screenshot Evidence Artifact */}
                                            {f.screenshotUrl && (
                                                <div>
                                                    <span style={{ fontSize: '0.72rem', color: '#A0A5A5', textTransform: 'uppercase' }}>FAILURE SCREENSHOT EVIDENCE</span>
                                                    <div style={{ marginTop: '4px' }}>
                                                        <img
                                                            src={f.screenshotUrl}
                                                            alt={`Failure screenshot for ${f.testCaseId}`}
                                                            onClick={() => setPreviewImage(f.screenshotUrl)}
                                                            style={{
                                                                maxWidth: '300px',
                                                                maxHeight: '160px',
                                                                borderRadius: '4px',
                                                                border: '1px solid #292D2D',
                                                                cursor: 'zoom-in',
                                                                objectFit: 'cover'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── 5. Test Category Breakdown Table ─── */}
            <div style={{
                background: '#161819',
                border: '1px solid #292D2D',
                borderRadius: '8px',
                padding: '1.25rem'
            }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: '#F2F3F3' }}>
                    Results by Test Category
                </h2>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #292D2D', textAlign: 'left', color: '#A0A5A5' }}>
                                <th style={{ padding: '8px' }}>Category</th>
                                <th style={{ padding: '8px' }}>Total</th>
                                <th style={{ padding: '8px' }}>Passed</th>
                                <th style={{ padding: '8px' }}>Failed</th>
                                <th style={{ padding: '8px' }}>Pass Rate</th>
                                <th style={{ padding: '8px', width: '220px' }}>Distribution</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(cats).map(([catKey, stat]) => {
                                const pRate = stat.total > 0 ? Math.round((stat.passed / stat.total) * 100) : 0;
                                return (
                                    <tr key={catKey} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                        <td style={{ padding: '10px 8px', fontWeight: 500, color: '#F2F3F3', textTransform: 'capitalize' }}>
                                            {catKey}
                                        </td>
                                        <td style={{ padding: '10px 8px', color: '#A0A5A5' }}>{stat.total}</td>
                                        <td style={{ padding: '10px 8px', color: '#8BAF9A' }}>{stat.passed}</td>
                                        <td style={{ padding: '10px 8px', color: stat.failed > 0 ? '#E06C75' : '#A0A5A5' }}>{stat.failed}</td>
                                        <td style={{ padding: '10px 8px', fontWeight: 600, color: pRate >= 80 ? '#8BAF9A' : '#E06C75' }}>
                                            {pRate}%
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>
                                            <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: '#292D2D' }}>
                                                {stat.total > 0 && (
                                                    <>
                                                        <div style={{ width: `${(stat.passed / stat.total) * 100}%`, background: '#8BAF9A' }} />
                                                        <div style={{ width: `${(stat.failed / stat.total) * 100}%`, background: '#E06C75' }} />
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── 6. Requirement Traceability Coverage ─── */}
            <div style={{
                background: '#161819',
                border: '1px solid #292D2D',
                borderRadius: '8px',
                padding: '1.25rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: '#F2F3F3' }}>
                            Requirement Verification & Coverage
                        </h2>
                        <p style={{ margin: '2px 0 0', color: '#A0A5A5', fontSize: '0.8rem' }}>
                            Traceability linking execution outcomes back to source functional requirements.
                        </p>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: '#8BAF9A', fontWeight: 600 }}>
                        {coverage.coveragePercentage || 100}% Verified
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div className="ws-stat-card">
                        <span className="ws-stat-label">TOTAL REQUIREMENTS</span>
                        <span className="ws-stat-value">{coverage.totalRequirements || 0}</span>
                        <span className="ws-stat-sub">From parent specification</span>
                    </div>

                    <div className="ws-stat-card">
                        <span className="ws-stat-label">VERIFIED (ALL PASSED)</span>
                        <span className="ws-stat-value" style={{ color: '#8BAF9A' }}>{coverage.verifiedRequirements || 0}</span>
                        <span className="ws-stat-sub">All linked test cases passed</span>
                    </div>

                    <div className="ws-stat-card">
                        <span className="ws-stat-label">FAILING REQUIREMENTS</span>
                        <span className="ws-stat-value" style={{ color: coverage.failingRequirements > 0 ? '#E06C75' : '#8BAF9A' }}>
                            {coverage.failingRequirements || 0}
                        </span>
                        <span className="ws-stat-sub">Requires engineering remediation</span>
                    </div>

                    <div className="ws-stat-card">
                        <span className="ws-stat-label">UNCOVERED</span>
                        <span className="ws-stat-value" style={{ color: coverage.uncoveredRequirements > 0 ? '#E5C07B' : '#A0A5A5' }}>
                            {coverage.uncoveredRequirements || 0}
                        </span>
                        <span className="ws-stat-sub">No linked test cases</span>
                    </div>
                </div>
            </div>

            {/* Modal for Zoomed Screenshot Preview */}
            {previewImage && (
                <div
                    onClick={() => setPreviewImage(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.85)',
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
                        style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: '6px', border: '1px solid #292D2D' }}
                    />
                </div>
            )}
        </div>
    );
};

export default RunReportView;
