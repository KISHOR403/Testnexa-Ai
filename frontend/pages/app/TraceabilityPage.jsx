import React from 'react';
import { GitBranch, CheckCircle2, ChevronRight, Layers, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useHistory } from '../../hooks/useHistory';

const TraceabilityPage = () => {
    const { history, isLoading } = useHistory();

    // Build real traceability trees from the user's generated suites
    const traceTree = history
        .filter(item => item.suite)
        .map((item, idx) => {
            const suite = item.suite;
            const allCases = [
                ...(suite.functional || []),
                ...(suite.negative || []),
                ...(suite.edge || []),
                ...(suite.nonFunctional || [])
            ];

            const reqId = suite.understanding?.requirementId ||
                suite.functional?.[0]?.reqId ||
                `REQ-${String(idx + 1).padStart(3, '0')}`;

            return {
                reqId,
                title: item.title || item.feature || item.requirement?.slice(0, 50) || `Requirement Specification #${idx + 1}`,
                status: item.status === 'Approved' ? '100% Verified' : 'Coverage Mapped',
                suiteId: item.id || item.sessionId,
                tests: allCases.slice(0, 8).map(tc => ({
                    id: tc.id || 'TC',
                    title: tc.title || tc.scenario || 'Verified test scenario',
                    type: tc.type || 'Functional'
                }))
            };
        });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#F5F5F5', margin: 0 }}>
                        Requirement Traceability Graph
                    </h1>
                    <p style={{ fontSize: '0.88rem', color: '#A3A3A3', margin: '0.25rem 0 0' }}>
                        End-to-end bidirectional traceability between business requirements and execution test cases
                    </p>
                </div>

                <NavLink to="/app/workspace" className="app-workspace-session-btn primary" style={{ padding: '0.65rem 1.15rem' }}>
                    <span>+ New Traceability Map</span>
                </NavLink>
            </div>

            {isLoading && traceTree.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', gap: '0.75rem', color: '#A3A3A3' }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: '#00D9C0' }} />
                    <span>Loading traceability graphs...</span>
                </div>
            ) : traceTree.length === 0 ? (
                /* Empty state when user has no suites */
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
                        <GitBranch size={28} />
                    </div>

                    <div style={{ maxWidth: '440px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#F5F5F5', margin: '0 0 0.5rem' }}>
                            No test suite selected.
                        </h2>
                        <p style={{ fontSize: '0.9rem', color: '#737373', lineHeight: '1.5', margin: 0 }}>
                            Generate or open a test suite to view requirement traceability.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <NavLink
                            to="/app/workspace"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.65rem 1.25rem',
                                borderRadius: '8px',
                                background: '#00D9C0',
                                color: '#0A0A0A',
                                fontSize: '0.88rem',
                                textDecoration: 'none',
                                fontWeight: '600'
                            }}
                        >
                            <span>Generate in AI Workspace &rarr;</span>
                        </NavLink>
                        <NavLink
                            to="/app/test-suites"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.65rem 1.25rem',
                                borderRadius: '8px',
                                background: '#121212',
                                border: '1px solid #262626',
                                color: '#F5F5F5',
                                fontSize: '0.88rem',
                                textDecoration: 'none',
                                fontWeight: '500'
                            }}
                        >
                            <span>View All Test Suites</span>
                        </NavLink>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {traceTree.map((req) => (
                        <div
                            key={req.reqId}
                            style={{
                                background: '#0A0A0A',
                                borderRadius: '12px',
                                border: '1px solid #1C1C1C',
                                padding: '1.25rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ color: '#00D9C0', fontWeight: '700', fontSize: '0.85rem' }}>{req.reqId}</span>
                                    <h3 style={{ color: '#F5F5F5', fontSize: '1.1rem', margin: 0, fontWeight: '600' }}>{req.title}</h3>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ color: '#22C55E', fontSize: '0.75rem', fontWeight: '600' }}>{req.status}</span>
                                    <NavLink
                                        to={`/app/test-suites/${req.suiteId}`}
                                        style={{ color: '#00D9C0', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                                    >
                                        <ArrowRight size={14} />
                                    </NavLink>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid rgba(0, 217, 192, 0.25)' }}>
                                {req.tests.map((tc) => (
                                    <div
                                        key={tc.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: '0.5rem',
                                            background: '#050505',
                                            padding: '0.65rem 0.85rem',
                                            borderRadius: '8px',
                                            border: '1px solid #161616'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: '1', minWidth: '180px' }}>
                                            <span style={{ color: '#00D9C0', fontWeight: '600', fontSize: '0.78rem' }}>{tc.id}</span>
                                            <span style={{ color: '#A3A3A3', fontSize: '0.82rem' }}>{tc.title}</span>
                                        </div>
                                        <span style={{ fontSize: '0.72rem', color: '#00D9C0', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(0, 217, 192, 0.08)', border: '1px solid rgba(0, 217, 192, 0.2)', flexShrink: 0 }}>
                                            {tc.type}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TraceabilityPage;
