import React, { useState, useEffect, useMemo } from 'react';
import {
    AlertTriangle, Shield, CheckCircle2, ShieldAlert, ArrowRight,
    Filter, Play, XCircle, AlertCircle, Check
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useHistory } from '../../hooks/useHistory';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../../components/loading';

const RisksPage = () => {
    const { history, isLoading: isHistoryLoading } = useHistory();
    const [severityFilter, setSeverityFilter] = useState('All');
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
                console.error('Failed to load runs for risk tracking:', err);
            } finally {
                if (isMounted) setIsLoadingRuns(false);
            }
        };
        fetchRuns();
        return () => { isMounted = false; };
    }, []);

    // Extract real risk vectors from the user's generated test suites
    const riskItems = useMemo(() => {
        const items = [];
        const userSuites = history.filter(item => item.suite);

        userSuites.forEach((item) => {
            const suite = item.suite;
            const suiteId = item.id || item.sessionId;
            const allCases = [
                ...(suite.security || []),
                ...(suite.negative || []),
                ...(suite.edge || []),
                ...(suite.nonFunctional || []),
                ...(suite.functional || [])
            ];

            // Associated runs for this suite
            const suiteRuns = runs.filter(r => r.suite_id === suiteId);

            allCases.forEach((tc) => {
                const isHighRisk = tc.priority === 'High' ||
                    tc.severity === 'Critical' ||
                    tc.type === 'Security' ||
                    tc.type === 'Edge Case' ||
                    tc.type === 'Edge';

                if (isHighRisk) {
                    const level = tc.severity === 'Critical' ? 'Critical' : tc.priority === 'High' ? 'High' : 'Medium';
                    const caseId = String(tc.id || 'TC-001');

                    // Check if this test case has execution outcomes in any run
                    let executionStatus = 'not_run';
                    let executionRunId = null;

                    for (const run of suiteRuns) {
                        // If run has failed cases and suite is associated, check run status
                        if (run.failed_count > 0 && run.status === 'failed') {
                            executionStatus = 'potential_failure';
                            executionRunId = run.id;
                            break;
                        } else if (run.status === 'completed' && run.passed_count > 0) {
                            executionStatus = 'passed';
                            executionRunId = run.id;
                        }
                    }

                    items.push({
                        level,
                        title: tc.title || tc.scenario || 'Unhandled boundary condition',
                        category: tc.type || 'Security',
                        linkedTc: caseId,
                        desc: tc.scenario || tc.expectedResult || tc.title,
                        suiteId,
                        suiteTitle: item.title || item.feature || 'Test Suite',
                        confirmed: tc.status === 'Approved',
                        executionStatus,
                        executionRunId
                    });
                }
            });
        });

        return items;
    }, [history, runs]);

    const criticalCount = riskItems.filter(r => r.level === 'Critical').length;
    const highCount = riskItems.filter(r => r.level === 'High').length;
    const mediumCount = riskItems.filter(r => r.level === 'Medium').length;
    const failingRisksCount = riskItems.filter(r => r.executionStatus === 'potential_failure').length;

    const filteredRisks = severityFilter === 'All'
        ? riskItems
        : severityFilter === 'Failing'
            ? riskItems.filter(r => r.executionStatus === 'potential_failure')
            : riskItems.filter(r => r.level === severityFilter);

    const isLoading = isHistoryLoading || isLoadingRuns;

    return (
        <div className="ws-page-container">
            {/* Header */}
            <div className="ws-page-header">
                <div className="ws-page-title-wrap">
                    <h1>Risk Vectors & Execution Failures</h1>
                    <p>
                        Track boundary vulnerabilities, negative security vectors, and live execution failure hotspots
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

            {isLoading && riskItems.length === 0 ? (
                <DataLoadingState
                    message="Evaluating risk vectors & execution states..."
                    telemetryTag="RISK VECTOR ANALYSIS"
                    skeletonType="table"
                    count={4}
                />
            ) : riskItems.length === 0 ? (
                /* Empty state when user has no risk items */
                <div className="ws-empty-state">
                    <div className="ws-empty-icon-wrap" style={{ background: 'rgba(229, 192, 123, 0.1)', borderColor: 'rgba(229, 192, 123, 0.25)', color: '#E5C07B' }}>
                        <ShieldAlert size={28} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '440px' }}>
                        <h2>No risk vectors identified yet.</h2>
                        <p>
                            Generate a test suite in AI Workspace to evaluate security vulnerabilities, negative edge scenarios, and exception flows.
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
                    {/* Severity Metrics */}
                    <div className="ws-stats-grid">
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">TOTAL RISK VECTORS</span>
                            <h2 className="ws-stat-card__val">{riskItems.length}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">CRITICAL SEVERITY</span>
                            <h2 className="ws-stat-card__val" style={{ color: '#E06C75' }}>{criticalCount}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">HIGH SEVERITY</span>
                            <h2 className="ws-stat-card__val" style={{ color: '#E5C07B' }}>{highCount}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">LIVE RUN FAILURES</span>
                            <h2 className="ws-stat-card__val" style={{ color: failingRisksCount > 0 ? '#E06C75' : '#8BAF9A' }}>
                                {failingRisksCount}
                            </h2>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {['All', 'Critical', 'High', 'Medium', 'Failing'].map((lvl) => (
                            <button
                                key={lvl}
                                type="button"
                                onClick={() => setSeverityFilter(lvl)}
                                className={`tn-filter-pill ${severityFilter === lvl ? 'is-active' : ''}`}
                            >
                                {lvl === 'All'
                                    ? `All Risks (${riskItems.length})`
                                    : lvl === 'Failing'
                                        ? `Active Failures (${failingRisksCount})`
                                        : `${lvl} (${riskItems.filter(r => r.level === lvl).length})`
                                }
                            </button>
                        ))}
                    </div>

                    {/* Risk Vectors List */}
                    <div className="ws-card">
                        <div className="ws-card-header">
                            <span>Identified Risk Vectors, Linked Test Cases & Execution Outcomes</span>
                            <span style={{ fontSize: '0.75rem', color: '#777E7E', fontWeight: 500 }}>
                                {filteredRisks.length} {filteredRisks.length === 1 ? 'Record' : 'Records'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {filteredRisks.map((item, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        gap: '1rem',
                                        padding: '1rem 1.25rem',
                                        borderBottom: '1px solid #292D2D',
                                        transition: 'background 0.12s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: '0.85rem', flex: 1 }}>
                                        <div style={{ flexShrink: 0, marginTop: '2px' }}>
                                            <span className={`tn-prio-tag tn-prio-tag--${item.level.toLowerCase()}`}>
                                                {item.level}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                <span style={{ color: '#F2F3F3', fontWeight: 600, fontSize: '0.88rem' }}>
                                                    {item.title}
                                                </span>
                                                <span className="tn-type-tag tn-type-tag--security">
                                                    {item.category}
                                                </span>
                                                {item.confirmed && (
                                                    <span style={{ fontSize: '0.68rem', color: '#8BAF9A', background: 'rgba(139, 175, 154, 0.1)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(139, 175, 154, 0.25)' }}>
                                                        ✓ Approved
                                                    </span>
                                                )}
                                                {item.executionStatus === 'potential_failure' && (
                                                    <span style={{ fontSize: '0.68rem', color: '#E06C75', background: 'rgba(224, 108, 117, 0.12)', padding: '1px 6px', borderRadius: '3px', border: '1px solid rgba(224, 108, 117, 0.3)', fontWeight: 600 }}>
                                                        ✕ Active Failure in Run
                                                    </span>
                                                )}
                                                {item.executionStatus === 'passed' && (
                                                    <span style={{ fontSize: '0.68rem', color: '#8BAF9A', background: 'rgba(139, 175, 154, 0.1)', padding: '1px 6px', borderRadius: '3px', border: '1px solid rgba(139, 175, 154, 0.25)' }}>
                                                        ✓ Verified Passing
                                                    </span>
                                                )}
                                            </div>

                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#A0A5A5', lineHeight: 1.45 }}>
                                                {item.desc}
                                            </p>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.2rem', fontSize: '0.74rem', color: '#777E7E' }}>
                                                <span>Suite: <strong style={{ color: '#A0A5A5' }}>{item.suiteTitle}</strong></span>
                                                <span>•</span>
                                                <span>Linked Case: <strong style={{ color: '#8BAF9A', fontFamily: 'monospace' }}>{item.linkedTc}</strong></span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                        {item.executionRunId && (
                                            <NavLink
                                                to={`/app/runs/${item.executionRunId}`}
                                                className="ws-btn-secondary"
                                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
                                                title="View Execution Run"
                                            >
                                                <Play size={12} />
                                                <span>Run Details</span>
                                            </NavLink>
                                        )}
                                        <NavLink
                                            to={`/app/test-suites/${item.suiteId}`}
                                            className="ws-btn-secondary"
                                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
                                            title="Inspect Test Case"
                                        >
                                            <span>View Case</span>
                                            <ArrowRight size={13} />
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

export default RisksPage;
