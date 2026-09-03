import React from 'react';
import { AlertTriangle, Shield, CheckCircle2, ShieldAlert, ArrowRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const RISK_ITEMS = [
    { level: 'Critical', title: 'Expired Token Invalidation Gap', category: 'Security', linkedTc: 'TC-004', desc: 'Failure to enforce server-side expiration allows indefinite password reset window.' },
    { level: 'Critical', title: 'Token Replay / Nonce Reuse', category: 'Security', linkedTc: 'TC-005', desc: 'Tokens not invalidated immediately after first successful redemption expose replay vulnerabilities.' },
    { level: 'Medium', title: 'Email Address Enumeration Timing', category: 'Privacy', linkedTc: 'TC-001', desc: 'Different response times for existing vs non-existing emails expose user directory.' },
    { level: 'High', title: 'Rate Limiting Burst Flooding', category: 'API Security', linkedTc: 'TC-006', desc: 'Unrestricted endpoint triggers mail server spamming and resource exhaustion.' }
];

const RisksPage = () => {
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
                {RISK_ITEMS.map((item, idx) => (
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
                            <NavLink to="/app/test-suites/password-reset" style={{ color: '#737373', textDecoration: 'none' }}>
                                Inspect Test →
                            </NavLink>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RisksPage;
