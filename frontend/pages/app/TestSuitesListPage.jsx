import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Layers, Plus, Search, Calendar, CheckCircle2,
    Shield, ArrowRight, Trash2, Filter
} from 'lucide-react';
import { useHistory } from '../../hooks/useHistory';

const DEFAULT_SUITES = [
    {
        id: 'password-reset',
        title: 'Password Reset Suite',
        reqId: 'REQ-001',
        testsCount: 18,
        coverage: '94%',
        highRisk: 3,
        status: 'Approved',
        date: 'Just now'
    },
    {
        id: 'user-auth',
        title: 'User Authentication & 2FA Flow',
        reqId: 'REQ-002',
        testsCount: 24,
        coverage: '96%',
        highRisk: 5,
        status: 'Needs Review',
        date: '2 hours ago'
    },
    {
        id: 'payment-processing',
        title: 'Stripe 3D Secure Checkout',
        reqId: 'REQ-003',
        testsCount: 16,
        coverage: '91%',
        highRisk: 4,
        status: 'Approved',
        date: 'Yesterday'
    }
];

const TestSuitesListPage = () => {
    const { history, deleteFromHistory } = useHistory();
    const [search, setSearch] = useState('');

    const savedSuites = history.map((item, idx) => ({
        id: item.id || `suite-${idx + 1}`,
        title: item.feature || item.requirement?.slice(0, 40) || `Test Suite #${idx + 1}`,
        reqId: `REQ-00${idx + 1}`,
        testsCount: item.suite?.summary?.total || item.totalCases || 18,
        coverage: item.suite?.summary?.requirementCoverage || '94%',
        highRisk: item.suite?.summary?.highPriority || 3,
        status: item.status || 'Needs Review',
        date: new Date(item.date || Date.now()).toLocaleDateString()
    }));

    const allSuites = savedSuites.length > 0 ? savedSuites : DEFAULT_SUITES;

    const filtered = allSuites.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.reqId.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#F5F5F5', margin: 0 }}>
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

            {/* Suites Grid */}
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
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#00D9C0', letterSpacing: '0.05em' }}>
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
        </div>
    );
};

export default TestSuitesListPage;
