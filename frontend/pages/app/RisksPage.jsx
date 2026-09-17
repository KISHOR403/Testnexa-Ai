import React from 'react';
import { AlertTriangle, Shield, CheckCircle2, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useHistory } from '../../hooks/useHistory';

const RisksPage = () => {
    const { history, isLoading } = useHistory();

    // Extract real risk vectors from the user's generated test suites
    const riskItems = [];
    const userSuites = history.filter(item => item.suite);

    userSuites.forEach((item) => {
        const suite = item.suite;
        const allCases = [
            ...(suite.negative || []),
            ...(suite.edge || []),
            ...(suite.nonFunctional || []),
            ...(suite.functional || [])
        ];

        allCases.forEach((tc) => {
            const isHighRisk = tc.priority === 'High' ||
                tc.severity === 'Critical' ||
                tc.type === 'Security' ||
                tc.type === 'Edge Case';

            if (isHighRisk) {
                riskItems.push({
                    level: tc.severity === 'Critical' ? 'Critical' : tc.priority === 'High' ? 'High' : 'Medium',
                    title: tc.title,
                    category: tc.type || 'Security',
                    linkedTc: tc.id || 'TC',
                    desc: tc.scenario || tc.expectedResult || tc.title,
                    suiteId: item.id || item.sessionId
                });
            }
        });
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#F5F5F5', margin: 0 }}>
                        Risk Vectors & Security Analysis
                    </h1>
                    <p style={{ fontSize: '0.88rem', color: '#A3A3A3', margin: '0.25rem 0 0' }}>
                        Automated AI vulnerability surface detection and mitigation test suites
                    </p>
                </div>

                <NavLink to="/app/workspace" className="app-workspace-session-btn primary" style={{ padding: '0.65rem 1.15rem' }}>
                    <span>+ New Security Audit</span>
                </NavLink>
            </div>

            {isLoading && riskItems.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', gap: '0.75rem', color: '#A3A3A3' }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: '#00D9C0' }} />
                    <span>Loading risk analysis...</span>
                </div>
            ) : riskItems.length === 0 ? (
                /* Empty state when user has no risk items */
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
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#F59E0B'
                    }}>
                        <ShieldAlert size={28} />
                    </div>

                    <div style={{ maxWidth: '440px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#F5F5F5', margin: '0 0 0.5rem' }}>
                            No test suite selected.
                        </h2>
                        <p style={{ fontSize: '0.9rem', color: '#737373', lineHeight: '1.5', margin: 0 }}>
                            Generate or open a test suite to view risk vectors & security audits.
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
                    {riskItems.map((item, idx) => (
                        <div
                            key={idx}
                            style={{
                                background: '#0A0A0A',
                                border: '1px solid #1C1C1C',
                                borderRadius: '12px',
                                padding: '1.25rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.85rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{
                                    fontSize: '0.72rem',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    background: item.level === 'Critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                    color: item.level === 'Critical' ? '#ef4444' : '#f59e0b',
                                    fontWeight: '700',
                                    border: item.level === 'Critical' ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(245,158,11,0.25)'
                                }}>
                                    {item.level} Risk
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#737373' }}>{item.category}</span>
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: '600', color: '#F5F5F5', margin: '0 0 0.4rem' }}>
                                    {item.title}
                                </h3>
                                <p style={{ fontSize: '0.82rem', color: '#A3A3A3', margin: 0, lineHeight: 1.5 }}>
                                    {item.desc}
                                </p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #161616', paddingTop: '0.75rem', fontSize: '0.8rem' }}>
                                <span style={{ color: '#00D9C0', fontWeight: '600' }}>Linked Test: {item.linkedTc}</span>
                                <NavLink
                                    to={`/app/test-suites/${item.suiteId}`}
                                    style={{ color: '#00D9C0', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.82rem' }}
                                >
                                    <span>Inspect Suite</span>
                                    <ArrowRight size={12} />
                                </NavLink>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RisksPage;
