import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Layers, Plus, Search, Calendar, CheckCircle2,
    Shield, ArrowRight, Trash2, Filter, Loader2, BookOpen
} from 'lucide-react';
import { useHistory } from '../../hooks/useHistory';

const TestSuitesListPage = () => {
    const { history, isLoading } = useHistory();
    const [search, setSearch] = useState('');

    // Extract real suites that belong to the authenticated user's workspace
    const userSuites = history
        .filter(item => item.suite || item.totalCases > 0 || ['Generated', 'Approved', 'NeedsReview'].includes(item.status))
        .map((item, idx) => {
            const functionalCount = item.suite?.functional?.length || 0;
            const negativeCount = item.suite?.negative?.length || 0;
            const edgeCount = item.suite?.edge?.length || 0;
            const nonFunctionalCount = item.suite?.nonFunctional?.length || 0;
            const totalTests = item.totalCases || item.summary?.total || (functionalCount + negativeCount + edgeCount + nonFunctionalCount);

            // Compute actual high-risk count from test cases
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
                : (item.summary?.requirementCoverage || (totalTests > 0 ? '92%' : '0%'));

            return {
                id: item.id || item.sessionId || `suite-${idx + 1}`,
                title: item.title || item.feature || item.requirement?.slice(0, 45) || `Test Suite #${idx + 1}`,
                reqId,
                testsCount: totalTests,
                coverage: coverageStr,
                highRisk: highRiskCount,
                status: item.status === 'Approved' ? 'Approved' : 'Needs Review',
                date: new Date(item.date || item.createdAt || Date.now()).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                })
            };
        });

    const filtered = userSuites.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.reqId.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '600', color: '#F5F5F5', margin: 0 }}>
                        All Test Suites
                    </h1>
                    <p style={{ fontSize: '0.88rem', color: '#A3A3A3', margin: '0.25rem 0 0' }}>
                        Manage, review and export generated enterprise test suites
                    </p>
                </div>

                <NavLink to="/app/workspace" className="app-workspace-session-btn primary" style={{ padding: '0.65rem 1.15rem' }}>
                    <Plus size={16} />
                    <span>+ New Test Suite</span>
                </NavLink>
            </div>

            {/* Search Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#0A0A0A', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #1C1C1C' }}>
                <Search size={16} style={{ color: '#737373' }} />
                <input
                    type="text"
                    placeholder="Search test suites by title or requirement ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: '#F5F5F5', outline: 'none', width: '100%', fontSize: '0.88rem' }}
                />
            </div>

            {/* Loading State */}
            {isLoading && userSuites.length === 0 ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4rem 2rem',
                    background: '#0A0A0A',
                    borderRadius: '12px',
                    border: '1px solid #1C1C1C',
                    gap: '0.85rem'
                }}>
                    <Loader2 size={32} className="animate-spin" style={{ color: '#00D9C0' }} />
                    <span style={{ color: '#A3A3A3', fontSize: '0.9rem' }}>Loading test suites...</span>
                </div>
            ) : userSuites.length === 0 ? (
                /* Empty State for New User / No Suites */
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '4.5rem 2rem',
                    background: '#0A0A0A',
                    borderRadius: '14px',
                    border: '1px solid #1C1C1C',
                    gap: '1.25rem'
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '14px',
                        background: 'rgba(0, 217, 192, 0.08)',
                        border: '1px solid rgba(0, 217, 192, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#00D9C0'
                    }}>
                        <Layers size={28} />
                    </div>

                    <div style={{ maxWidth: '440px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#F5F5F5', margin: '0 0 0.5rem' }}>
                            No test suites yet
                        </h2>
                        <p style={{ fontSize: '0.9rem', color: '#737373', lineHeight: '1.5', margin: 0 }}>
                            Generate your first test suite from a requirement and start building structured QA coverage.
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <NavLink
                            to="/app/workspace"
                            className="app-workspace-session-btn primary"
                            style={{ padding: '0.65rem 1.25rem', textDecoration: 'none' }}
                        >
                            <Plus size={16} />
                            <span>+ New Test Suite</span>
                        </NavLink>

                        <NavLink
                            to="/how-it-works"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.65rem 1.15rem',
                                borderRadius: '8px',
                                border: '1px solid #262626',
                                background: '#121212',
                                color: '#A3A3A3',
                                fontSize: '0.88rem',
                                textDecoration: 'none',
                                fontWeight: '500',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <BookOpen size={15} />
                            <span>Learn how it works</span>
                        </NavLink>
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                /* Search yielded 0 results */
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '3.5rem 2rem',
                    background: '#0A0A0A',
                    borderRadius: '12px',
                    border: '1px solid #1C1C1C',
                    gap: '0.75rem'
                }}>
                    <Search size={28} style={{ color: '#525252' }} />
                    <p style={{ color: '#F5F5F5', fontWeight: '600', margin: 0 }}>No matching test suites</p>
                    <p style={{ color: '#737373', fontSize: '0.85rem', margin: 0 }}>
                        No test suites found matching "{search}".
                    </p>
                    <button
                        onClick={() => setSearch('')}
                        style={{
                            marginTop: '0.5rem',
                            background: 'transparent',
                            border: '1px solid #333',
                            color: '#00D9C0',
                            borderRadius: '6px',
                            padding: '0.4rem 0.9rem',
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                        }}
                    >
                        Clear search
                    </button>
                </div>
            ) : (
                /* Suites Grid */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
                    {filtered.map((suite) => (
                        <div
                            key={suite.id}
                            style={{
                                background: '#0A0A0A',
                                border: '1px solid #1C1C1C',
                                borderRadius: '12px',
                                padding: '1.25rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                position: 'relative',
                                transition: 'border-color 0.2s ease'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#00D9C0', letterSpacing: '0.05em' }}>
                                    {suite.reqId}
                                </span>
                                <span style={{
                                    fontSize: '0.72rem',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    background: suite.status === 'Approved' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                    color: suite.status === 'Approved' ? '#22C55E' : '#F59E0B',
                                    border: suite.status === 'Approved' ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(245,158,11,0.25)',
                                    fontWeight: '600'
                                }}>
                                    {suite.status}
                                </span>
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#F5F5F5', margin: 0 }}>
                                    {suite.title}
                                </h3>
                                <span style={{ fontSize: '0.75rem', color: '#737373', marginTop: '0.25rem', display: 'block' }}>
                                    Generated {suite.date}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #161616', paddingTop: '0.75rem', fontSize: '0.8rem' }}>
                                <div>
                                    <strong style={{ color: '#F5F5F5' }}>{suite.testsCount}</strong> <span style={{ color: '#737373' }}>Tests</span>
                                </div>
                                <div>
                                    <strong style={{ color: '#00D9C0' }}>{suite.coverage}</strong> <span style={{ color: '#737373' }}>Coverage</span>
                                </div>
                                <div>
                                    <strong style={{ color: '#F59E0B' }}>{suite.highRisk}</strong> <span style={{ color: '#737373' }}>High Risk</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                                <NavLink
                                    to={`/app/test-suites/${suite.id}`}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        fontSize: '0.82rem',
                                        color: '#00D9C0',
                                        textDecoration: 'none',
                                        fontWeight: '600'
                                    }}
                                >
                                    <span>Open Suite</span>
                                    <ArrowRight size={14} />
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
