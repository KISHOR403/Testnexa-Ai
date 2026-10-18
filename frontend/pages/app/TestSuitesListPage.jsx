import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Layers, Plus, Search, Calendar, CheckCircle2,
    Shield, ArrowRight, Trash2, Filter, BookOpen
} from 'lucide-react';
import { useHistory } from '../../hooks/useHistory';
import { DataLoadingState } from '../../components/loading';

const TestSuitesListPage = () => {
    const { history, isLoading } = useHistory();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    // Extract real suites that belong to the authenticated user's workspace
    const userSuites = history
        .filter(item => item.suite || item.totalCases > 0 || ['Generated', 'Approved', 'NeedsReview'].includes(item.status))
        .map((item, idx) => {
            const functionalCount = item.suite?.functional?.length || 0;
            const negativeCount = item.suite?.negative?.length || 0;
            const edgeCount = item.suite?.edge?.length || 0;
            const nonFunctionalCount = item.suite?.nonFunctional?.length || 0;
            const totalTests = item.totalCases || item.summary?.total || (functionalCount + negativeCount + edgeCount + nonFunctionalCount);

            let highRiskCount = 0;
            if (item.suite) {
                const allCases = [
                    ...(item.suite.functional || []),
                    ...(item.suite.negative || []),
                    ...(item.suite.edge || []),
                    ...(item.suite.nonFunctional || [])
                ];
                highRiskCount = allCases.filter(c =>
                    c.priority === 'High' ||
                    c.severity === 'Critical' ||
                    c.type === 'Security'
                ).length;
            } else if (item.summary?.highPriority !== undefined) {
                highRiskCount = item.summary.highPriority;
            }

            const reqId = item.suite?.understanding?.requirementId ||
                item.suite?.functional?.[0]?.reqId ||
                `REQ-${String(idx + 1).padStart(3, '0')}`;

            const coverageStr = item.quality?.coverageConfidence
                ? `${item.quality.coverageConfidence}%`
                : (item.summary?.requirementCoverage || (totalTests > 0 ? '90%' : '0%'));

            return {
                id: item.id || item.sessionId || `suite-${idx + 1}`,
                title: item.title || item.feature || item.requirement?.slice(0, 45) || `Test Suite #${idx + 1}`,
                reqId,
                testsCount: totalTests,
                coverage: coverageStr,
                highRisk: highRiskCount,
                status: item.status === 'Approved' ? 'Approved' : 'Needs Review',
                date: item.date || item.createdAt
                    ? new Date(item.date || item.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    })
                    : null
            };
        });

    const filtered = userSuites.filter(s => {
        const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase()) ||
            s.reqId.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="ws-page-container">
            {/* Header */}
            <div className="ws-page-header">
                <div className="ws-page-title-wrap">
                    <h1>Test Suites</h1>
                    <p>
                        Manage, inspect, and export verified test suites across all project requirements
                    </p>
                </div>

                <div className="ws-header-actions">
                    <NavLink to="/app/workspace" className="ws-btn-primary">
                        <Plus size={15} />
                        <span>New Test Suite</span>
                    </NavLink>
                </div>
            </div>

            {/* Search and Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="ws-search-bar" style={{ flex: 1, minWidth: '240px' }}>
                    <Search size={16} style={{ color: '#777E7E' }} />
                    <input
                        type="text"
                        placeholder="Search test suites by title or requirement ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {['All', 'Needs Review', 'Approved'].map(status => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                            className={`tn-filter-pill ${statusFilter === status ? 'is-active' : ''}`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading && userSuites.length === 0 ? (
                <DataLoadingState
                    message="Retrieving test suites..."
                    telemetryTag="SUITES INDEX"
                    skeletonType="cards"
                    count={3}
                />
            ) : userSuites.length === 0 ? (
                /* Purposeful Empty State */
                <div className="ws-empty-state">
                    <div className="ws-empty-icon-wrap">
                        <Layers size={28} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '440px' }}>
                        <h2>No test suites saved yet.</h2>
                        <p>
                            Generate your first test suite in the AI Workspace. All generated suites, test cases, and coverage metrics will appear here.
                        </p>
                    </div>

                    <div className="ws-empty-actions">
                        <NavLink to="/app/workspace" className="ws-btn-primary">
                            <Plus size={15} />
                            <span>Create a Test Suite</span>
                        </NavLink>
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="ws-card" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#777E7E' }}>
                    No test suites matching "{search}".
                </div>
            ) : (
                /* Suites Card Grid */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '1rem'
                }}>
                    {filtered.map((suite) => (
                        <div
                            key={suite.id}
                            className="ws-card"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                padding: '1.25rem',
                                gap: '1rem',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                    <span style={{
                                        fontFamily: 'monospace',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        color: '#8BAF9A',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: 'rgba(139, 175, 154, 0.1)',
                                        border: '1px solid rgba(139, 175, 154, 0.2)'
                                    }}>
                                        {suite.reqId}
                                    </span>
                                    <span className={`tn-status-pill ${suite.status === 'Approved' ? 'tn-status-pill--approved' : 'tn-status-pill--review'}`}>
                                        <span className="tn-status-dot" />
                                        {suite.status}
                                    </span>
                                </div>

                                <h3 style={{
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    color: '#F2F3F3',
                                    margin: 0,
                                    lineHeight: 1.35
                                }}>
                                    {suite.title}
                                </h3>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.85rem',
                                    fontSize: '0.76rem',
                                    color: '#777E7E',
                                    flexWrap: 'wrap'
                                }}>
                                    <span><strong>{suite.testsCount}</strong> test cases</span>
                                    <span>•</span>
                                    <span><strong>{suite.coverage}</strong> coverage</span>
                                    {suite.highRisk > 0 && (
                                        <>
                                            <span>•</span>
                                            <span style={{ color: '#E5C07B' }}>{suite.highRisk} high-risk</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingTop: '0.75rem',
                                borderTop: '1px solid #292D2D',
                                fontSize: '0.74rem',
                                color: '#777E7E'
                            }}>
                                <span>{suite.date ? `Updated ${suite.date}` : 'Recently updated'}</span>
                                <NavLink
                                    to={`/app/test-suites/${suite.id}`}
                                    className="ws-btn-secondary"
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                                >
                                    <span>Open Suite</span>
                                    <ArrowRight size={13} />
                                </NavLink>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TestSuitesListPage;
