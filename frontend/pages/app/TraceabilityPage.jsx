import React, { useState, useEffect, useMemo } from 'react';
import {
    GitBranch, CheckCircle2, ChevronRight, Layers, FileText, ArrowRight,
    Search, Play, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useHistory } from '../../hooks/useHistory';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../../components/loading';

const TraceabilityPage = () => {
    const { history, isLoading: isHistoryLoading } = useHistory();
    const [search, setSearch] = useState('');
    const [runs, setRuns] = useState([]);
    const [isLoadingRuns, setIsLoadingRuns] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchRuns = async () => {
            try {
                const res = await executionService.listRuns({ limit: 100 });
                if (isMounted && res.success) {
                    setRuns(res.data || []);
                }
            } catch (err) {
                console.error('Failed to load runs for traceability matrix:', err);
            } finally {
                if (isMounted) setIsLoadingRuns(false);
            }
        };
        fetchRuns();
        return () => { isMounted = false; };
    }, []);

    // Build real traceability matrix mapping specifications to test cases and execution outcomes
    const traceRows = useMemo(() => {
        const rows = [];

        history
            .filter(item => item.suite || item.totalCases > 0 || ['Generated', 'Approved', 'NeedsReview'].includes(item.status))
            .forEach((item, idx) => {
                const suite = item.suite;
                const suiteId = item.id || item.sessionId;
                const reqId = suite?.understanding?.requirementId ||
                    suite?.functional?.[0]?.reqId ||
                    `REQ-${String(idx + 1).padStart(3, '0')}`;

                const allCases = [
                    ...(suite?.functional || []),
                    ...(suite?.negative || []),
                    ...(suite?.edge || []),
                    ...(suite?.nonFunctional || [])
                ];

                const suiteRuns = runs.filter(r => r.suite_id === suiteId);
                const hasRuns = suiteRuns.length > 0;
                const latestRun = suiteRuns[0] || null;

                if (allCases.length === 0) {
                    rows.push({
                        reqId,
                        title: item.title || item.feature || item.requirement?.slice(0, 45) || `Requirement #${idx + 1}`,
                        suiteId,
                        suiteTitle: item.title || 'Untitled Suite',
                        testCases: [],
                        isCovered: false,
                        hasRuns: false,
                        executionSummary: 'No Tests Linked'
                    });
                } else {
                    let passedCount = 0;
                    let failedCount = 0;
                    if (latestRun) {
                        passedCount = latestRun.passed_count || 0;
                        failedCount = latestRun.failed_count || 0;
                    }

                    rows.push({
                        reqId,
                        title: item.title || item.feature || item.requirement?.slice(0, 45) || `Requirement #${idx + 1}`,
                        suiteId,
                        suiteTitle: item.title || 'Untitled Suite',
                        testCases: allCases.map(tc => {
                            let execState = 'not_run';
                            if (latestRun) {
                                if (latestRun.status === 'completed' && latestRun.failed_count === 0) {
                                    execState = 'passed';
                                } else if (latestRun.failed_count > 0) {
                                    execState = 'failed';
                                }
                            }
                            return {
                                id: tc.id || 'TC',
                                title: tc.title || tc.scenario || 'Verified test scenario',
                                type: tc.type || 'Functional',
                                priority: tc.priority || 'Medium',
                                status: tc.status || 'Needs Review',
                                execState
                            };
                        }),
                        isCovered: true,
                        hasRuns,
                        latestRunId: latestRun?.id || null,
                        executionSummary: hasRuns
                            ? (failedCount > 0 ? `${failedCount} Failed` : `${passedCount} Passed`)
                            : 'Not Executed'
                    });
                }
            });

        return rows;
    }, [history, runs]);

    const filteredRows = traceRows.filter(r =>
        r.reqId.toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase())
    );

    const totalReqs = traceRows.length;
    const coveredReqs = traceRows.filter(r => r.isCovered).length;
    const uncoveredReqs = traceRows.filter(r => !r.isCovered).length;
    const totalMappedTests = traceRows.reduce((acc, r) => acc + r.testCases.length, 0);
    const executedReqs = traceRows.filter(r => r.hasRuns).length;

    const isLoading = isHistoryLoading || isLoadingRuns;

    return (
        <div className="ws-page-container">
            {/* Header */}
            <div className="ws-page-header">
                <div className="ws-page-title-wrap">
                    <h1>Requirement & Execution Traceability</h1>
                    <p>
                        Navigable bidirectional mapping linking specifications to executed test assertions
                    </p>
                </div>

                <div className="ws-header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
                    <NavLink to="/app/runs" className="ws-btn-secondary">
                        <Play size={14} />
                        <span>Execution Runs</span>
                    </NavLink>
                    <NavLink to="/app/workspace" className="ws-btn-primary">
                        <span>+ New Test Suite</span>
                    </NavLink>
                </div>
            </div>

            {isLoading && traceRows.length === 0 ? (
                <DataLoadingState
                    message="Mapping requirement traceability matrix..."
                    telemetryTag="LINEAGE VERIFICATION"
                    skeletonType="table"
                    count={5}
                />
            ) : traceRows.length === 0 ? (
                /* Empty state */
                <div className="ws-empty-state">
                    <div className="ws-empty-icon-wrap">
                        <GitBranch size={28} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '440px' }}>
                        <h2>No traceability matrix available.</h2>
                        <p>
                            Generate a test suite in AI Workspace to establish bidirectional requirement-to-test links.
                        </p>
                    </div>

                    <div className="ws-empty-actions">
                        <NavLink to="/app/workspace" className="ws-btn-primary">
                            <span>Generate in AI Workspace &rarr;</span>
                        </NavLink>
                        <NavLink to="/app/test-suites" className="ws-btn-secondary">
                            <span>All Test Suites</span>
                        </NavLink>
                    </div>
                </div>
            ) : (
                <>
                    {/* Matrix Metrics */}
                    <div className="ws-stats-grid">
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">TOTAL REQUIREMENTS</span>
                            <h2 className="ws-stat-card__val">{totalReqs}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">MAPPED TEST CASES</span>
                            <h2 className="ws-stat-card__val ws-stat-card__val--accent">{totalMappedTests}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">COVERED REQUIREMENTS</span>
                            <h2 className="ws-stat-card__val ws-stat-card__val--success">{coveredReqs}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">EXECUTED REQUIREMENTS</span>
                            <h2 className="ws-stat-card__val" style={{ color: executedReqs > 0 ? '#8BAF9A' : '#E5C07B' }}>
                                {executedReqs} / {totalReqs}
                            </h2>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="ws-search-bar">
                        <Search size={16} style={{ color: '#777E7E' }} />
                        <input
                            type="text"
                            placeholder="Filter by requirement ID (REQ-001) or specification title..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Compact Matrix Table */}
                    <div className="ws-card">
                        <div className="ws-card-header">
                            <span>Bidirectional Traceability Matrix & Execution Status</span>
                            <span style={{ fontSize: '0.75rem', color: '#777E7E', fontWeight: 500 }}>
                                {filteredRows.length} {filteredRows.length === 1 ? 'Requirement' : 'Requirements'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {filteredRows.map((row) => (
                                <div
                                    key={row.suiteId}
                                    style={{
                                        padding: '1.1rem 1.25rem',
                                        borderBottom: '1px solid #292D2D',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{
                                                fontFamily: 'monospace',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                color: '#8BAF9A',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: 'rgba(139, 175, 154, 0.1)',
                                                border: '1px solid rgba(139, 175, 154, 0.2)'
                                            }}>
                                                {row.reqId}
                                            </span>
                                            <span style={{ color: '#F2F3F3', fontWeight: 600, fontSize: '0.88rem' }}>
                                                {row.title}
                                            </span>
                                            {row.isCovered ? (
                                                <span className="tn-tag tn-tag--ready">
                                                    {row.testCases.length} Tests Linked
                                                </span>
                                            ) : (
                                                <span className="tn-tag tn-tag--alert">
                                                    Uncovered
                                                </span>
                                            )}
                                            {row.hasRuns && (
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '1px 6px',
                                                    borderRadius: '3px',
                                                    background: row.executionSummary.includes('Failed') ? 'rgba(224, 108, 117, 0.12)' : 'rgba(139, 175, 154, 0.12)',
                                                    border: `1px solid ${row.executionSummary.includes('Failed') ? 'rgba(224, 108, 117, 0.3)' : 'rgba(139, 175, 154, 0.3)'}`,
                                                    color: row.executionSummary.includes('Failed') ? '#E06C75' : '#8BAF9A',
                                                    fontWeight: 600
                                                }}>
                                                    {row.executionSummary}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {row.latestRunId && (
                                                <NavLink
                                                    to={`/app/runs/${row.latestRunId}`}
                                                    className="ws-btn-secondary"
                                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
                                                    title="View Latest Run"
                                                >
                                                    <Play size={12} />
                                                    <span>Latest Run</span>
                                                </NavLink>
                                            )}
                                            <NavLink
                                                to={`/app/test-suites/${row.suiteId}`}
                                                className="ws-btn-secondary"
                                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
                                            >
                                                <span>Open Suite</span>
                                                <ArrowRight size={13} />
                                            </NavLink>
                                        </div>
                                    </div>

                                    {/* Linked Test Cases Row / Matrix Chips */}
                                    {row.testCases.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', paddingLeft: '0.5rem' }}>
                                            {row.testCases.map((tc) => (
                                                <div
                                                    key={tc.id}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.45rem',
                                                        padding: '0.25rem 0.6rem',
                                                        borderRadius: '4px',
                                                        background: '#161819',
                                                        border: '1px solid #292D2D',
                                                        fontSize: '0.74rem'
                                                    }}
                                                >
                                                    <span style={{ fontFamily: 'monospace', color: '#8BAF9A', fontWeight: 600 }}>
                                                        {tc.id}
                                                    </span>
                                                    <span style={{ color: '#A0A5A5', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {tc.title}
                                                    </span>
                                                    <span className={`tn-prio-tag tn-prio-tag--${tc.priority.toLowerCase()}`} style={{ fontSize: '0.64rem', padding: '1px 4px' }}>
                                                        {tc.priority}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.76rem', color: '#E5C07B', paddingLeft: '0.5rem' }}>
                                            ⚠ No test cases currently mapped to this requirement.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TraceabilityPage;
