import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Play, Search, Plus, Filter, RefreshCw, Clock, ArrowRight,
    User, Bot, Terminal, Calendar, PlayCircle
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../../components/loading';
import NewTestRunModal from '../../components/execution/NewTestRunModal';
import RunButton from '../../components/common/RunButton';
import { useFeature } from '../../config/features';
import '../../styles/app/WorkspaceDesignSystem.css';
import '../../styles/app/ComingSoonDialog.css';
import '../../styles/app/TestRuns.css';

const StatusPill = ({ status }) => {
    const s = (status || 'pending').toLowerCase();
    const label = {
        pending: 'Pending',
        in_progress: 'In Progress',
        completed: 'Completed',
        cancelled: 'Cancelled',
        failed: 'Failed'
    }[s] || status;

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            background: '#111111',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
            <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#ffffff'
            }} />
            {label}
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
                fontSize: '12px',
                fontWeight: 600,
                background: '#111111',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.15)'
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
                fontSize: '12px',
                fontWeight: 600,
                background: '#111111',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.15)'
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
            fontSize: '12px',
            fontWeight: 600,
            background: '#111111',
            color: 'rgba(255, 255, 255, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.15)'
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
            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.10)', width: '100%' }} />
        );
    }

    const passed = (summary.passed || 0);
    const failed = (summary.failed || 0);
    const notRun = (summary.not_run || 0);

    const pPct = (passed / total) * 100;
    const fPct = (failed / total) * 100;
    const nPct = (notRun / total) * 100;

    return (
        <div style={{
            display: 'flex',
            height: '6px',
            borderRadius: '3px',
            overflow: 'hidden',
            background: '#111111',
            width: '100%',
            border: '1px solid rgba(255, 255, 255, 0.10)'
        }}>
            {pPct > 0 && <div style={{ width: `${pPct}%`, background: '#ffffff' }} title={`Passed: ${passed}`} />}
            {fPct > 0 && <div style={{ width: `${fPct}%`, background: 'rgba(255, 255, 255, 0.45)' }} title={`Failed: ${failed}`} />}
            {nPct > 0 && <div style={{ width: `${nPct}%`, background: 'rgba(255, 255, 255, 0.15)' }} title={`Not Run: ${notRun}`} />}
        </div>
    );
};

const TestRunsPage = () => {
    const navigate = useNavigate();
    const { enabled } = useFeature('testRuns');

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
            if (!enabled) {
                setRuns([]);
                setIsLoading(false);
                return;
            }
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
    }, [enabled, statusFilter, typeFilter, search, refreshTrigger]);

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
        <div className="ws-page-container test-runs-container">
            {/* Page Header */}
            <div className="test-runs-header">
                <div className="test-runs-title-group">
                    <div className="test-runs-title-row">
                        <h1 className="test-runs-title">Test runs</h1>
                        {!enabled && (
                            <span className="cs-tag-soon" aria-hidden="true">
                                Soon
                            </span>
                        )}
                    </div>
                    <p className="test-runs-subtitle">
                        Track, coordinate, and inspect manual and Playwright-automated test runs
                    </p>
                </div>

                <div className="test-runs-actions">
                    {enabled && (
                        <button
                            type="button"
                            onClick={() => setRefreshTrigger(t => t + 1)}
                            className="ws-btn-secondary"
                            title="Refresh Test Runs"
                            aria-label="Refresh Test Runs"
                        >
                            <RefreshCw size={15} />
                        </button>
                    )}
                    <RunButton
                        label="New Test Run"
                        className="ws-btn-primary"
                        icon={Plus}
                        iconSize={15}
                        onClick={() => setIsCreateModalOpen(true)}
                        feature="testRuns"
                    />
                </div>
            </div>

            {/* When Test Execution is Coming Soon (Disabled) */}
            {!enabled ? (
                <div className="test-runs-cs-panel" data-testid="test-runs-cs-panel">
                    <div className="test-runs-cs-icon-wrap" aria-hidden="true">
                        <PlayCircle size={38} />
                    </div>
                    <h2 className="test-runs-cs-heading">Test execution is coming soon</h2>
                    <p className="test-runs-cs-desc">
                        We are building manual test runners and headless Playwright execution. In the meantime, you can author suites, define requirements and trace coverage.
                    </p>

                    <div className="test-runs-cs-planned">
                        <div className="test-runs-cs-planned-label">What's planned</div>
                        <ul className="test-runs-cs-list">
                            <li className="test-runs-cs-list-item">
                                <span className="test-runs-cs-bullet" aria-hidden="true" />
                                <span>Manual step-by-step test execution</span>
                            </li>
                            <li className="test-runs-cs-list-item">
                                <span className="test-runs-cs-bullet" aria-hidden="true" />
                                <span>Headless Playwright runner & live assertions</span>
                            </li>
                            <li className="test-runs-cs-list-item">
                                <span className="test-runs-cs-bullet" aria-hidden="true" />
                                <span>Trace capture and execution timeline</span>
                            </li>
                            <li className="test-runs-cs-list-item">
                                <span className="test-runs-cs-bullet" aria-hidden="true" />
                                <span>Pass/fail regression and test telemetry</span>
                            </li>
                        </ul>
                    </div>

                    <div className="test-runs-cs-actions">
                        <NavLink
                            to="/app/test-cases"
                            className="test-runs-btn-primary"
                        >
                            View test cases
                        </NavLink>
                        <NavLink
                            to="/app/test-suites"
                            className="test-runs-btn-secondary"
                        >
                            Back to test suites
                        </NavLink>
                    </div>
                </div>
            ) : isLoading ? (
                <DataLoadingState message="Loading execution runs..." />
            ) : runs.length === 0 ? (
                /* Empty state when enabled but no runs created yet */
                <div className="ws-empty-state" style={{ minHeight: '340px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: '#111111',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        marginBottom: '1rem'
                    }}>
                        <Play size={20} />
                    </div>
                    <div className="ws-empty-text-wrap">
                        <h2>No Test Runs Found</h2>
                        <p>
                            Launch your first manual or automated execution run from an existing test suite.
                        </p>
                    </div>
                    <div className="ws-empty-actions" style={{ marginTop: '1.25rem' }}>
                        <RunButton
                            label="Create First Test Run"
                            className="ws-btn-primary"
                            icon={Plus}
                            iconSize={15}
                            onClick={() => setIsCreateModalOpen(true)}
                            feature="testRuns"
                        />
                    </div>
                </div>
            ) : (
                /* Active runs list (when enabled) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                                className="test-runs-row-card"
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                                            {run.name}
                                        </h3>
                                        <ExecutionTypeBadge type={run.executionType} />
                                        <StatusPill status={run.status} />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.72)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Calendar size={13} />
                                            {new Date(run.createdAt).toLocaleDateString()}
                                        </span>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: '#ffffff',
                                            fontWeight: 500
                                        }}>
                                            <span>Open</span>
                                            <ArrowRight size={14} />
                                        </div>
                                    </div>
                                </div>

                                {run.description && (
                                    <p style={{
                                        fontSize: '0.84rem',
                                        color: 'rgba(255, 255, 255, 0.72)',
                                        margin: 0,
                                        lineHeight: '1.4'
                                    }}>
                                        {run.description}
                                    </p>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <MultiProgressBar summary={sum} />
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '12px',
                                        color: 'rgba(255, 255, 255, 0.72)'
                                    }}>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <span style={{ color: '#ffffff' }}>✓ {passed} Passed</span>
                                            {failed > 0 && <span style={{ color: 'rgba(255, 255, 255, 0.72)' }}>✕ {failed} Failed</span>}
                                            <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>○ {notRun} Not Run</span>
                                        </div>

                                        <div>
                                            Target: <strong style={{ color: '#ffffff' }}>{envName}</strong> • {total} Cases
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
