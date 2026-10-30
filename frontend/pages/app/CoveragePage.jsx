import React, { useState, useEffect, useMemo } from 'react';
import {
    ShieldCheck, Layers, CheckCircle2, AlertTriangle, ArrowRight,
    Info, Play, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useHistory } from '../../hooks/useHistory';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../../components/loading';

const CoveragePage = () => {
    const { history, isLoading: isHistoryLoading } = useHistory();
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
                console.error('Failed to load execution runs for coverage analysis:', err);
            } finally {
                if (isMounted) setIsLoadingRuns(false);
            }
        };
        fetchRuns();
        return () => { isMounted = false; };
    }, []);

    // Derive real coverage items from the authenticated user's workspace
    const userSuites = useMemo(() => {
        return history
            .filter(item => item.suite || item.totalCases > 0 || ['Generated', 'Approved', 'NeedsReview'].includes(item.status))
            .map((item, idx) => {
                const functionalCount = item.suite?.functional?.length || 0;
                const negativeCount = item.suite?.negative?.length || 0;
                const edgeCount = item.suite?.edge?.length || 0;
                const nonFunctionalCount = item.suite?.nonFunctional?.length || 0;
                const totalTests = item.totalCases || item.summary?.total || (functionalCount + negativeCount + edgeCount + nonFunctionalCount);

                const reqId = item.suite?.understanding?.requirementId ||
                    item.suite?.functional?.[0]?.reqId ||
                    `REQ-${String(idx + 1).padStart(3, '0')}`;

                const hasFunctional = functionalCount > 0 ? 1 : 0;
                const hasNegative = negativeCount > 0 ? 1 : 0;
                const hasEdge = edgeCount > 0 ? 1 : 0;
                const dimensionScore = Math.round(((hasFunctional * 45) + (hasNegative * 30) + (hasEdge * 25)));

                const coverageNum = item.quality?.coverageConfidence
                    ? item.quality.coverageConfidence
                    : (item.summary?.requirementCoverage ? parseInt(item.summary.requirementCoverage, 10) : (totalTests > 0 ? dimensionScore : 0));

                const typeLabel = item.context === 'api'
                    ? 'API'
                    : item.context === 'mobile'
                        ? 'Mobile'
                        : 'Web';

                const isApproved = item.status === 'Approved' || item.suite?.status === 'Approved';

                // Find executions associated with this suite
                const suiteId = item.id || item.sessionId;
                const suiteRuns = runs.filter(r => r.suite_id === suiteId);
                const executedCount = suiteRuns.reduce((acc, r) => acc + (r.passed_count || 0) + (r.failed_count || 0) + (r.blocked_count || 0) + (r.skipped_count || 0), 0);
                const passedCount = suiteRuns.reduce((acc, r) => acc + (r.passed_count || 0), 0);
                const failedCount = suiteRuns.reduce((acc, r) => acc + (r.failed_count || 0), 0);

                return {
                    id: suiteId,
                    req: reqId,
                    label: item.title || item.feature || item.requirement?.slice(0, 45) || `Requirement #${idx + 1}`,
                    coverage: coverageNum,
                    tests: totalTests,
                    isApproved,
                    functionalCount,
                    negativeCount,
                    edgeCount,
                    status: coverageNum >= 90 ? 'Optimal' : coverageNum >= 75 ? 'Standard' : 'Needs Review',
                    type: typeLabel,
                    executedCount,
                    passedCount,
                    failedCount,
                    runCount: suiteRuns.length,
                    latestRun: suiteRuns[0] || null
                };
            });
    }, [history, runs]);

    // Metrics distinction: Generated vs Approved vs Actually Executed
    const totalGeneratedCases = userSuites.reduce((acc, s) => acc + s.tests, 0);
    const totalApprovedCases = userSuites.filter(s => s.isApproved).reduce((acc, s) => acc + s.tests, 0);

    const totalExecutionsCount = runs.reduce((acc, r) => acc + (r.passed_count || 0) + (r.failed_count || 0) + (r.blocked_count || 0) + (r.skipped_count || 0), 0);
    const totalPassed = runs.reduce((acc, r) => acc + (r.passed_count || 0), 0);
    const totalFailed = runs.reduce((acc, r) => acc + (r.failed_count || 0), 0);
    const totalBlocked = runs.reduce((acc, r) => acc + (r.blocked_count || 0), 0);

    const executionPassRate = totalExecutionsCount > 0
        ? Math.round((totalPassed / totalExecutionsCount) * 100)
        : 0;

    const actualExecutionCoverage = totalApprovedCases > 0
        ? Math.min(100, Math.round((totalExecutionsCount / totalApprovedCases) * 100))
        : (totalGeneratedCases > 0 ? Math.min(100, Math.round((totalExecutionsCount / totalGeneratedCases) * 100)) : 0);

    const avgSpecCoverage = userSuites.length > 0
        ? (userSuites.reduce((acc, s) => acc + s.coverage, 0) / userSuites.length).toFixed(1) + '%'
        : '0%';

    const isLoading = isHistoryLoading || isLoadingRuns;

    return (
        <div className="ws-page-container">
            {/* Header */}
            <div className="ws-page-header">
                <div className="ws-page-title-wrap">
                    <h1>Requirement & Execution Coverage</h1>
                    <p>
                        Traceability-grounded coverage distinguishing generated specifications from verified execution outcomes
                    </p>
                </div>

                <div className="ws-header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
                    <NavLink to="/app/runs" className="ws-btn-secondary">
                        <Play size={14} />
                        <span>View Test Runs</span>
                    </NavLink>
                    <NavLink to="/app/workspace" className="ws-btn-primary">
                        <span>+ New Test Suite</span>
                    </NavLink>
                </div>
            </div>

            {isLoading && userSuites.length === 0 ? (
                <DataLoadingState
                    message="Evaluating test coverage and execution metrics..."
                    telemetryTag="COVERAGE MATRIX"
                    skeletonType="metrics-detail"
                />
            ) : userSuites.length === 0 ? (
                /* Meaningful Empty State */
                <div className="ws-empty-state">
                    <div className="ws-empty-icon-wrap">
                        <ShieldCheck size={28} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '440px' }}>
                        <h2>No test suite coverage yet.</h2>
                        <p>
                            Generate a test suite in AI Workspace to map requirements to test cases and view real coverage breakdowns.
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
                    {/* Metrics Section 1: Specification & Generation Metrics */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#777E7E', fontWeight: 600, marginBottom: '0.5rem' }}>
                            1. Requirement Specification Coverage
                        </div>
                        <div className="ws-stats-grid">
                            <div className="ws-stat-card">
                                <span className="ws-stat-card__label">SPECIFICATION DEPTH</span>
                                <h2 className="ws-stat-card__val ws-stat-card__val--accent">{avgSpecCoverage}</h2>
                            </div>
                            <div className="ws-stat-card">
                                <span className="ws-stat-card__label">GENERATED TEST CASES</span>
                                <h2 className="ws-stat-card__val">{totalGeneratedCases}</h2>
                            </div>
                            <div className="ws-stat-card">
                                <span className="ws-stat-card__label">APPROVED FOR RUN</span>
                                <h2 className="ws-stat-card__val ws-stat-card__val--success">{totalApprovedCases}</h2>
                            </div>
                            <div className="ws-stat-card">
                                <span className="ws-stat-card__label">ACTIVE SUITES</span>
                                <h2 className="ws-stat-card__val">{userSuites.length}</h2>
                            </div>
                        </div>
                    </div>

                    {/* Metrics Section 2: Actual Execution Verification Metrics */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#777E7E', fontWeight: 600, marginBottom: '0.5rem' }}>
                            2. Actual Execution Engine Outcomes
                        </div>
                        <div className="ws-stats-grid">
                            <div className="ws-stat-card">
                                <span className="ws-stat-card__label">ACTUAL EXECUTION COVERAGE</span>
                                <h2 className="ws-stat-card__val" style={{ color: actualExecutionCoverage > 50 ? '#8BAF9A' : '#E5C07B' }}>
                                    {actualExecutionCoverage}%
                                </h2>
                            </div>
                            <div className="ws-stat-card">
                                <span className="ws-stat-card__label">EXECUTED TEST CASES</span>
                                <h2 className="ws-stat-card__val">{totalExecutionsCount}</h2>
                            </div>
                            <div className="ws-stat-card">
                                <span className="ws-stat-card__label">EXECUTION PASS RATE</span>
                                <h2 className="ws-stat-card__val ws-stat-card__val--success">
                                    {executionPassRate}%
                                </h2>
                            </div>
                            <div className="ws-stat-card">
                                <span className="ws-stat-card__label">TOTAL TEST RUNS</span>
                                <h2 className="ws-stat-card__val">{runs.length}</h2>
                            </div>
                        </div>
                    </div>

                    {/* Coverage Calculation Methodology Notice */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.85rem 1rem',
                        background: '#101112',
                        border: '1px solid #292D2D',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        color: '#A0A5A5',
                        lineHeight: 1.5,
                        marginBottom: '1.5rem'
                    }}>
                        <Info size={16} style={{ color: '#8BAF9A', flexShrink: 0 }} />
                        <span>
                            <strong>Methodology Distinction:</strong> Specification coverage reflects generated requirement depth across functional, negative, and edge dimensions. Actual execution coverage is computed exclusively from verified manual, automated (Playwright), or mixed runs. Unexecuted cases remain tracked as open execution risks.
                        </span>
                    </div>

                    {/* Breakdown Table */}
                    <div className="ws-card">
                        <div className="ws-card-header">
                            <span>Requirement & Execution Coverage Breakdown</span>
                            <span style={{ fontSize: '0.75rem', color: '#777E7E', fontWeight: 500 }}>
                                {userSuites.length} Active {userSuites.length === 1 ? 'Specification' : 'Specifications'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {userSuites.map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '0.85rem',
                                        padding: '1rem 1.25rem',
                                        borderBottom: '1px solid #292D2D',
                                        transition: 'background 0.12s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '240px', flex: '1' }}>
                                        <span style={{
                                            color: '#8BAF9A',
                                            fontWeight: '600',
                                            fontSize: '0.78rem',
                                            fontFamily: 'monospace',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: 'rgba(139, 175, 154, 0.1)',
                                            border: '1px solid rgba(139, 175, 154, 0.2)'
                                        }}>
                                            {item.req}
                                        </span>
                                        <div>
                                            <div style={{ color: '#F2F3F3', fontWeight: '550', fontSize: '0.86rem' }}>{item.label}</div>
                                            <span style={{ fontSize: '0.72rem', color: '#777E7E' }}>
                                                {item.type} Target • {item.functionalCount} fn / {item.negativeCount} neg / {item.edgeCount} edge
                                                {item.isApproved ? ' • Approved' : ' • Needs Review'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Execution Status Badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '120px' }}>
                                            {item.executedCount > 0 ? (
                                                <>
                                                    <span style={{ fontSize: '0.76rem', color: '#8BAF9A', fontWeight: 600 }}>
                                                        ✓ {item.passedCount} Passed {item.failedCount > 0 ? `• ✕ ${item.failedCount} Failed` : ''}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: '#777E7E' }}>
                                                        {item.runCount} {item.runCount === 1 ? 'Run' : 'Runs'} Recorded
                                                    </span>
                                                </>
                                            ) : (
                                                <span style={{ fontSize: '0.74rem', color: '#E5C07B', background: 'rgba(229, 192, 123, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(229, 192, 123, 0.2)' }}>
                                                    Not Yet Executed
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ width: '100px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.25rem', color: '#A0A5A5' }}>
                                                <span>{item.coverage}%</span>
                                                <span style={{ color: item.coverage >= 90 ? '#8BAF9A' : '#E5C07B', fontWeight: 600 }}>{item.status}</span>
                                            </div>
                                            <div style={{ height: '4px', background: '#161819', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${item.coverage}%`,
                                                    background: '#8BAF9A',
                                                    borderRadius: '2px'
                                                }} />
                                            </div>
                                        </div>

                                        <NavLink
                                            to={`/app/test-suites/${item.id}`}
                                            style={{ color: '#8BAF9A', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                                            title="View Test Suite & Execute"
                                        >
                                            <ArrowRight size={15} />
                                        </NavLink>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CoveragePage;
