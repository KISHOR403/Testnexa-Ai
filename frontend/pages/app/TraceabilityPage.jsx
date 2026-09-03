import React from 'react';
import { GitBranch, CheckCircle2, ChevronRight, Layers, FileText } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const TRACE_TREE = [
    {
        reqId: 'REQ-001',
        title: 'User Password Recovery Specification',
        status: '100% Verified',
        tests: [
            { id: 'TC-001', title: 'Verify standard password recovery email dispatch', type: 'Functional' },
            { id: 'TC-002', title: 'Validate client & server RFC 5322 compliance', type: 'Negative' },
            { id: 'TC-003', title: 'Ensure required field constraints are strictly enforced', type: 'Validation' },
            { id: 'TC-004', title: 'Verify token expiration window strictly blocks credential update', type: 'Edge Case' },
            { id: 'TC-005', title: 'Prevent replay attacks by enforcing one-time nonce invalidation', type: 'Security' }
        ]
    }
];

const TraceabilityPage = () => {
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {TRACE_TREE.map((req) => (
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
                            <span style={{ color: '#22C55E', fontSize: '0.75rem', fontWeight: '600' }}>{req.status}</span>
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
        </div>
    );
};

export default TraceabilityPage;
