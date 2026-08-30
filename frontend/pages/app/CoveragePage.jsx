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
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
                        Requirement Coverage Matrix
                    </h1>
                    <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', margin: '0.25rem 0 0' }}>
                        Automated AI verification mapping specifications to execution assertions
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <NavLink to="/app/workspace" className="tn-btn-new-suite">
                        <span>+ Analyze New Requirement</span>
                    </NavLink>
                </div>
            </div>

            {/* Overview Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>OVERALL COVERAGE</span>
                    <h2 style={{ fontSize: '2rem', color: '#00f2de', margin: '0.25rem 0 0', fontWeight: '700' }}>94.2%</h2>
                </div>
                <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>TOTAL TEST SCENARIOS</span>
                    <h2 style={{ fontSize: '2rem', color: '#ffffff', margin: '0.25rem 0 0', fontWeight: '700' }}>22</h2>
                </div>
                <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>COVERED REQUIREMENTS</span>
                    <h2 style={{ fontSize: '2rem', color: '#10b981', margin: '0.25rem 0 0', fontWeight: '700' }}>5 / 5</h2>
                </div>
                <div style={{ background: '#090d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>UNTESTED GAPS</span>
                    <h2 style={{ fontSize: '2rem', color: '#f59e0b', margin: '0.25rem 0 0', fontWeight: '700' }}>0</h2>
                </div>
            </div>

            {/* Coverage Table */}
            <div style={{ background: '#090d16', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: '600', color: '#ffffff' }}>
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
                                padding: '1rem 1.25rem',
                                borderBottom: '1px solid rgba(255,255,255,0.04)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: '#00f2de', fontWeight: '700', fontSize: '0.8rem', minWidth: '70px' }}>
                                    {item.req}
                                </span>
                                <div>
                                    <div style={{ color: '#ffffff', fontWeight: '500', fontSize: '0.9rem' }}>{item.label}</div>
                                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{item.type}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                <div style={{ width: '120px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                        <span>{item.coverage}%</span>
                                    </div>
                                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${item.coverage}%`, background: '#00f2de' }} />
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', minWidth: '60px' }}>{item.tests} tests</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CoveragePage;
