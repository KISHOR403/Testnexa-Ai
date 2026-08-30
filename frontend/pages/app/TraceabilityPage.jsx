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
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
                        Requirement Traceability Graph
                    </h1>
                    <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', margin: '0.25rem 0 0' }}>
                        End-to-end bidirectional traceability between business requirements and execution test cases
                    </p>
                </div>

                <NavLink to="/app/workspace" className="tn-btn-new-suite">
                    <span>+ New Traceability Map</span>
                </NavLink>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {TRACE_TREE.map((req) => (
                    <div
                        key={req.reqId}
                        style={{
                            background: '#090d16',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.07)',
                            padding: '1.25rem'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ color: '#00f2de', fontWeight: '700', fontSize: '0.85rem' }}>{req.reqId}</span>
                                <h3 style={{ color: '#ffffff', fontSize: '1.1rem', margin: 0, fontWeight: '600' }}>{req.title}</h3>
                            </div>
                            <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '600' }}>{req.status}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid rgba(0,242,222,0.2)' }}>
                            {req.tests.map((tc) => (
                                <div
                                    key={tc.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '0.5rem',
                                        background: 'rgba(255,255,255,0.02)',
                                        padding: '0.65rem 0.85rem',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.04)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: '1', minWidth: '180px' }}>
                                        <span style={{ color: '#00f2de', fontWeight: '600', fontSize: '0.78rem' }}>{tc.id}</span>
                                        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.82rem' }}>{tc.title}</span>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: '#00f2de', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(0,242,222,0.08)', flexShrink: 0 }}>
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
