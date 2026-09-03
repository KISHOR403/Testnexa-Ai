import React from 'react';
import { ShieldCheck, Layers, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const COVERAGE_DATA = [
    { req: 'REQ-001', label: 'Password Reset Core Flow', coverage: 94, tests: 8, status: 'Optimal', type: 'Authentication' },
    { req: 'REQ-002', label: 'Email Format & Domain Validation', coverage: 88, tests: 5, status: 'Good', type: 'Validation' },
    { req: 'REQ-003', label: 'Token Expiration & Single-Use TTL', coverage: 100, tests: 4, status: 'Complete', type: 'Security' },
    { req: 'REQ-004', label: 'Rate Limiting & Cooldown Windows', coverage: 92, tests: 3, status: 'Optimal', type: 'Security' },
    { req: 'REQ-005', label: 'Anti-Enumeration Generic Feedback', coverage: 90, tests: 2, status: 'Optimal', type: 'Privacy' }
];

const CoveragePage = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#F5F5F5', margin: 0 }}>
                        Requirement Coverage Matrix
                    </h1>
                    <p style={{ fontSize: '0.88rem', color: '#A3A3A3', margin: '0.25rem 0 0' }}>
                        Automated AI verification mapping specifications to execution assertions
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <NavLink to="/app/workspace" className="app-workspace-session-btn primary" style={{ padding: '0.65rem 1.15rem' }}>
                        <span>+ Analyze New Requirement</span>
                    </NavLink>
                </div>
            </div>

            {/* Overview Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '1rem' }}>
                <div style={{ background: '#0A0A0A', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid #1C1C1C' }}>
                    <span style={{ fontSize: '0.72rem', color: '#737373', fontWeight: '600' }}>OVERALL COVERAGE</span>
                    <h2 style={{ fontSize: '1.75rem', color: '#00D9C0', margin: '0.25rem 0 0', fontWeight: '700' }}>94.2%</h2>
                </div>
                <div style={{ background: '#0A0A0A', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid #1C1C1C' }}>
                    <span style={{ fontSize: '0.72rem', color: '#737373', fontWeight: '600' }}>TOTAL TEST SCENARIOS</span>
                    <h2 style={{ fontSize: '1.75rem', color: '#F5F5F5', margin: '0.25rem 0 0', fontWeight: '700' }}>22</h2>
                </div>
                <div style={{ background: '#0A0A0A', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid #1C1C1C' }}>
                    <span style={{ fontSize: '0.72rem', color: '#737373', fontWeight: '600' }}>COVERED REQUIREMENTS</span>
                    <h2 style={{ fontSize: '1.75rem', color: '#22C55E', margin: '0.25rem 0 0', fontWeight: '700' }}>5 / 5</h2>
                </div>
                <div style={{ background: '#0A0A0A', padding: '1.25rem 1rem', borderRadius: '12px', border: '1px solid #1C1C1C' }}>
                    <span style={{ fontSize: '0.72rem', color: '#737373', fontWeight: '600' }}>UNTESTED GAPS</span>
                    <h2 style={{ fontSize: '1.75rem', color: '#F59E0B', margin: '0.25rem 0 0', fontWeight: '700' }}>0</h2>
                </div>
            </div>

            {/* Coverage Table */}
            <div style={{ background: '#0A0A0A', borderRadius: '12px', border: '1px solid #1C1C1C', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #161616', fontWeight: '600', color: '#F5F5F5' }}>
                    Active Suite Requirement Coverage Breakdown
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {COVERAGE_DATA.map((item) => (
                        <div
                            key={item.req}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                padding: '1rem 1.25rem',
                                borderBottom: '1px solid #161616'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '220px', flex: '1' }}>
                                <span style={{ color: '#00D9C0', fontWeight: '700', fontSize: '0.8rem', minWidth: '65px' }}>
                                    {item.req}
                                </span>
                                <div>
                                    <div style={{ color: '#F5F5F5', fontWeight: '500', fontSize: '0.88rem' }}>{item.label}</div>
                                    <span style={{ fontSize: '0.72rem', color: '#737373' }}>{item.type}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                                <div style={{ width: '100px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.25rem', color: '#A3A3A3' }}>
                                        <span>{item.coverage}%</span>
                                    </div>
                                    <div style={{ height: '5px', background: '#1C1C1C', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${item.coverage}%`, background: '#00D9C0' }} />
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.78rem', color: '#737373', minWidth: '55px' }}>{item.tests} tests</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CoveragePage;
