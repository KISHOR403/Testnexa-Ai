import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Play, Search, Plus, Filter, RefreshCw, CheckCircle2,
    XCircle, AlertTriangle, MinusCircle, Clock, ArrowRight,
    User, Bot, Terminal, Shield, Calendar, Layers, StopCircle,
    FileText, GitCompare
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../../components/loading';
import NewTestRunModal from '../../components/execution/NewTestRunModal';
import '../../styles/app/WorkspaceDesignSystem.css';

const StatusPill = ({ status }) => {
    const s = (status || 'pending').toLowerCase();
    const config = {
        pending: { label: 'Pending', bg: 'rgba(160, 165, 165, 0.12)', color: '#A0A5A5', border: '#292D2D' },
        in_progress: { label: 'In Progress', bg: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', border: 'rgba(56, 189, 248, 0.3)' },
        completed: { label: 'Completed', bg: 'rgba(139, 175, 154, 0.12)', color: '#8BAF9A', border: 'rgba(139, 175, 154, 0.3)' },
        cancelled: { label: 'Cancelled', bg: 'rgba(224, 108, 117, 0.12)', color: '#E06C75', border: 'rgba(224, 108, 117, 0.3)' },
        failed: { label: 'Failed', bg: 'rgba(224, 108, 117, 0.12)', color: '#E06C75', border: 'rgba(224, 108, 117, 0.3)' }
    }[s] || { label: status, bg: '#161819', color: '#F2F3F3', border: '#292D2D' };

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            background: config.bg,
            color: config.color,
            border: `1px solid ${config.border}`
        }}>
            <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: config.color
            }} />
            {config.label}
        </span>
    );
};

const ExecutionTypeBadge = ({ type }) => {
    const t = (type || 'manual').toLowerCase();
    if (t === 'automated') {
        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38BDF8',
                border: '1px solid rgba(56, 189, 248, 0.25)'
            }}>
                <Bot size={12} />
                Playwright
            </span>
        );
    }
    if (t === 'mixed') {
        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: 'rgba(139, 175, 154, 0.15)',
                color: '#8BAF9A',
                border: '1px solid rgba(139, 175, 154, 0.25)'
            }}>
                <Terminal size={12} />
                Mixed Mode
            </span>
        );
    }
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 7px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#A0A5A5',
            border: '1px solid #292D2D'
        }}>
            <User size={12} />
            Manual
        </span>
    );
};

const MultiProgressBar = ({ summary = {} }) => {
    const total = summary.total || 0;
    if (total === 0) {
        return (
            <div style={{ height: '6px', borderRadius: '3px', background: '#292D2D', width: '100%' }} />
        );
    }

    const passed = (summary.passed || 0);
    const failed = (summary.failed || 0);
    const blocked = (summary.blocked || 0);
    const skipped = (summary.skipped || 0);
    const notRun = (summary.not_run || 0);

    const pPct = (passed / total) * 100;
    const fPct = (failed / total) * 100;
    const bPct = (blocked / total) * 100;
    const sPct = (skipped / total) * 100;
    const nPct = (notRun / total) * 100;

    return (
        <div style={{
            display: 'flex',
            height: '6px',
            borderRadius: '3px',
            overflow: 'hidden',
            background: '#161819',
            width: '100%',
            border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
            {pPct > 0 && <div style={{ width: `${pPct}%`, background: '#8BAF9A' }} title={`Passed: ${passed}`} />}
            {fPct > 0 && <div style={{ width: `${fPct}%`, background: '#E06C75' }} title={`Failed: ${failed}`} />}
            {bPct > 0 && <div style={{ width: `${bPct}%`, background: '#E5C07B' }} title={`Blocked: ${blocked}`} />}
            {sPct > 0 && <div style={{ width: `${sPct}%`, background: '#C678DD' }} title={`Skipped: ${skipped}`} />}
            {nPct > 0 && <div style={{ width: `${nPct}%`, background: '#292D2D' }} title={`Not Run: ${notRun}`} />}
        </div>
    );
};

const TestRunsPage = () => {
    const navigate = useNavigate();
    const [runs, setRuns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        let isCurrent = true;
        const loadRuns = async () => {
            setIsLoading(true);
            try {
                const res = await executionService.listRuns({
                    status: statusFilter,
                    executionType: typeFilter,
                    search: search.trim()
                });
                if (isCurrent && res.success) {
                    setRuns(res.data || []);
                }
            } catch (err) {
                console.error('Failed to load runs:', err);
            } finally {
                if (isCurrent) setIsLoading(false);
            }
        };

        loadRuns();
        return () => { isCurrent = false; };
    }, [statusFilter, typeFilter, search, refreshTrigger]);

    // Aggregate statistics
    const stats = useMemo(() => {
        let total = runs.length;
        let inProgress = 0;
        let completed = 0;
        let totalCases = 0;
        let totalPassed = 0;

        for (const r of runs) {
            if (r.status === 'in_progress') inProgress++;
            if (r.status === 'completed') completed++;
            if (r.summary) {
                totalCases += (r.summary.total || 0);
                totalPassed += (r.summary.passed || 0);
            }
        }

        const passRate = totalCases > 0 ? Math.round((totalPassed / totalCases) * 100) : 0;
        return { total, inProgress, completed, passRate, totalCases };
    }, [runs]);

    return (
        <div className="ws-page-container">
            {/* Page Header */}
            <div className="ws-page-header">
                <div className="ws-page-title-wrap">
                    <h1>Unified Test Execution</h1>
                    <p>
                        Track, coordinate, and inspect manual and Playwright-automated test runs
                    </p>
                </div>

                <div className="ws-header-actions">
                    <button
                        type="button"
                        onClick={() => setRefreshTrigger(t => t + 1)}
                        className="ws-btn-secondary"
                        title="Refresh Test Runs"
                    >
                        <RefreshCw size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="ws-btn-primary"
                    >
                        <Plus size={15} />
                        <span>New Test Run</span>
                    </button>
                </div>
            </div>

            {/* KPI Stat Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{
                    padding: '1rem 1.25rem',
                    background: '#101112',
                    border: '1px solid #292D2D',
                    borderRadius: '8px'
                }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#A0A5A5', textTransform: 'uppercase' }}>
                        Total Test Runs
                    </span>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F2F3F3', marginTop: '0.35rem' }}>
                        {stats.total}
                    </div>
                </div>

                <div style={{
                    padding: '1rem 1.25rem',
                    background: '#101112',
                    border: '1px solid #292D2D',
                    borderRadius: '8px'
                }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#A0A5A5', textTransform: 'uppercase' }}>
                        Active / In Progress
                    </span>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#38BDF8', marginTop: '0.35rem' }}>
                        {stats.inProgress}
                    </div>
                </div>

                <div style={{
                    padding: '1rem 1.25rem',
                    background: '#101112',
                    border: '1px solid #292D2D',
                    borderRadius: '8px'
                }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#A0A5A5', textTransform: 'uppercase' }}>
                        Completed Runs
                    </span>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#8BAF9A', marginTop: '0.35rem' }}>
                        {stats.completed}
                    </div>
                </div>

                <div style={{
                    padding: '1rem 1.25rem',
                    background: '#101112',
                    border: '1px solid #292D2D',
                    borderRadius: '8px'
                }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#A0A5A5', textTransform: 'uppercase' }}>
                        Overall Pass Rate
                    </span>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#8BAF9A', marginTop: '0.35rem' }}>
                        {stats.passRate}%
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                marginBottom: '1.25rem'
            }}>
                <div className="ws-search-bar" style={{ flex: 1, minWidth: '240px' }}>
                    <Search size={16} style={{ color: '#777E7E' }} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search runs by title or description..."
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            padding: '0.55rem 0.85rem',
                            background: '#161819',
                            border: '1px solid #292D2D',
                            borderRadius: '6px',
                            color: '#F2F3F3',
                            fontSize: '0.85rem',
                            outline: 'none'
                        }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        style={{
                            padding: '0.55rem 0.85rem',
                            background: '#161819',
                            border: '1px solid #292D2D',
                            borderRadius: '6px',
                            color: '#F2F3F3',
                            fontSize: '0.85rem',
                            outline: 'none'
                        }}
                    >
                        <option value="all">All Types</option>
                        <option value="manual">Manual Only</option>
                        <option value="automated">Automated (Playwright)</option>
                        <option value="mixed">Mixed Mode</option>
                    </select>
                </div>
            </div>

            {/* Runs List Table */}
            {isLoading ? (
                <DataLoadingState message="Loading test execution runs..." />
            ) : runs.length === 0 ? (
                <div className="ws-empty-state" style={{ margin: '3rem auto', maxWidth: '480px' }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '12px',
                        background: 'rgba(139, 175, 154, 0.1)',
                        border: '1px solid rgba(139, 175, 154, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#8BAF9A',
                        marginBottom: '1rem'
                    }}>
                        <Play size={24} fill="#8BAF9A" />
                    </div>
                    <div className="ws-empty-text-wrap">
                        <h2>No Test Runs Found</h2>
                        <p>
                            Launch your first manual or automated execution run from an existing test suite.
                        </p>
                    </div>
                    <div className="ws-empty-actions" style={{ marginTop: '1.25rem' }}>
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="ws-btn-primary"
                        >
                            <Plus size={15} />
                            <span>Create First Test Run</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    {runs.map(run => {
                        const sum = run.summary || {};
                        const total = sum.total || 0;
                        const passed = sum.passed || 0;
                        const failed = sum.failed || 0;
                        const notRun = sum.not_run || 0;
                        const envName = run.targetEnvironment?.name || 'Staging';

                        return (
                            <div
                                key={run.id}
                                onClick={() => navigate(`/app/runs/${run.id}`)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.85rem',
                                    padding: '1.15rem 1.25rem',
                                    background: '#101112',
                                    border: '1px solid #292D2D',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#383D3D'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#292D2D'; }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '0.75rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <h3 style={{
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            color: '#F2F3F3',
                                            margin: 0
                                        }}>
                                            {run.name}
                                        </h3>
                                        <ExecutionTypeBadge type={run.executionType} />
                                        <StatusPill status={run.status} />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A0A5A5', fontSize: '0.82rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '6px' }}>
                                            <Calendar size={13} />
                                            {new Date(run.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/app/runs/${run.id}?tab=report`);
                                            }}
                                            className="ws-btn-secondary"
                                            style={{ height: '26px', padding: '0 8px', fontSize: '0.72rem' }}
                                            title="View Executive Report"
                                        >
                                            <FileText size={11} />
                                            <span>Report</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/app/runs/${run.id}?tab=compare`);
                                            }}
                                            className="ws-btn-secondary"
                                            style={{ height: '26px', padding: '0 8px', fontSize: '0.72rem' }}
                                            title="Compare with previous run"
                                        >
                                            <GitCompare size={11} />
                                            <span>Compare</span>
                                        </button>
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: '#8BAF9A',
                                            fontWeight: 500,
                                            marginLeft: '4px'
                                        }}>
                                            <span>Open</span>
                                            <ArrowRight size={14} />
                                        </div>
                                    </div>
                                </div>

                                {run.description && (
                                    <p style={{
                                        fontSize: '0.84rem',
                                        color: '#A0A5A5',
                                        margin: 0,
                                        lineHeight: '1.4'
                                    }}>
                                        {run.description}
                                    </p>
                                )}

                                {/* Progress Bar & Metrics */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <MultiProgressBar summary={sum} />
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '0.78rem',
                                        color: '#A0A5A5'
                                    }}>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <span style={{ color: '#8BAF9A' }}>✓ {passed} Passed</span>
                                            {failed > 0 && <span style={{ color: '#E06C75' }}>✕ {failed} Failed</span>}
                                            {sum.blocked > 0 && <span style={{ color: '#E5C07B' }}>⊘ {sum.blocked} Blocked</span>}
                                            {sum.skipped > 0 && <span style={{ color: '#C678DD' }}>⊝ {sum.skipped} Skipped</span>}
                                            <span style={{ color: '#777E7E' }}>○ {notRun} Not Run</span>
                                        </div>

                                        <div>
                                            Target: <strong style={{ color: '#F2F3F3' }}>{envName}</strong> • {total} Cases
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* New Test Run Modal */}
            <NewTestRunModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    );
};

export default TestRunsPage;

