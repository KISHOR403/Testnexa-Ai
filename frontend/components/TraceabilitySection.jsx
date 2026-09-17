import React from 'react';
import { GitBranch, Check, AlertTriangle, ArrowRight, ShieldCheck, FileText } from 'lucide-react';

const TRACEABILITY_ROWS = [
    {
        tcId: 'TC-001',
        title: 'Valid password reset dispatch to registered email',
        category: 'Functional',
        clause: 'REQ-142.1 (Core Recovery Flow)',
        status: 'Approved',
        verified: true
    },
    {
        tcId: 'TC-002',
        title: 'Invalid email syntax RFC 5322 schema rejection',
        category: 'Negative',
        clause: 'REQ-142.2 (Input Validation Rules)',
        status: 'Approved',
        verified: true
    },
    {
        tcId: 'TC-003',
        title: 'Expired reset token rejection post-15m TTL',
        category: 'Edge Case',
        clause: 'REQ-142.3 (Token Lifecycle & Expiration)',
        status: 'Needs Review',
        verified: false
    },
    {
        tcId: 'TC-004',
        title: 'API rate limiting enforcement (5 req/min/IP)',
        category: 'Security',
        clause: 'REQ-142.4 (Abuse & DoS Throttling)',
        status: 'Needs Review',
        verified: false
    },
    {
        tcId: 'TC-005',
        title: 'Anti-enumeration uniform timing validation',
        category: 'Negative',
        clause: 'REQ-142.5 (Directory Privacy Protection)',
        status: 'Needs Review',
        verified: false
    }
];

export const TraceabilitySection = () => {
    return (
        <section className="tn-section tn-traceability-section" aria-labelledby="traceability-heading">
            <div className="tn-container">
                <div className="tn-section-header">
                    <span className="tn-kicker">End-to-End Lineage</span>
                    <h2 id="traceability-heading" className="tn-section-title">
                        Every test maps back to a requirement.
                    </h2>
                    <p className="tn-section-subtitle">
                        Trace each case to the clause it verifies. Keep lineage intact from spec to suite.
                    </p>
                </div>

                {/* Practical Enterprise QA Traceability Tree */}
                <div className="tn-trace-card-shell">
                    <div className="tn-trace-card-head">
                        <div className="tn-trace-root-node">
                            <div className="tn-trace-node-icon"><FileText size={16} /></div>
                            <div>
                                <span className="tn-trace-req-code">REQ-142</span>
                                <h3 className="tn-trace-req-name">Password Reset Specification</h3>
                            </div>
                        </div>
                        <div className="tn-trace-meta-stats">
                            <span>5 Linked Test Cases</span>
                            <span>&bull;</span>
                            <span className="text-accent">100% Traceability Ratio</span>
                        </div>
                    </div>

                    <div className="tn-trace-tree-table-wrap">
                        <table className="tn-trace-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '130px' }}>Tree Lineage</th>
                                    <th style={{ width: '92px' }}>Test Case</th>
                                    <th>Scenario & Description</th>
                                    <th style={{ width: '110px' }}>Category</th>
                                    <th style={{ width: '230px' }}>Specification Clause</th>
                                    <th style={{ width: '120px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {TRACEABILITY_ROWS.map((row, index) => {
                                    const isLast = index === TRACEABILITY_ROWS.length - 1;
                                    return (
                                        <tr key={row.tcId} className="tn-trace-row">
                                            <td className="tn-trace-tree-cell">
                                                <div className="tn-tree-line-indicator">
                                                    <span className="tn-tree-glyph">{isLast ? '└──' : '├──'}</span>
                                                    <span className="tn-tree-dot" />
                                                </div>
                                            </td>
                                            <td>
                                                <span className="tn-tc-id-pill">{row.tcId}</span>
                                            </td>
                                            <td>
                                                <span className="tn-trace-title-text">{row.title}</span>
                                            </td>
                                            <td>
                                                <span className={`tn-type-chip tn-type-chip--${row.category.toLowerCase().replace(/\s+/g, '')}`}>
                                                    {row.category}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="tn-clause-text">{row.clause}</span>
                                            </td>
                                            <td>
                                                <span className={`tn-trace-status-badge ${row.status === 'Approved' ? 'is-approved' : 'is-review'}`}>
                                                    {row.status === 'Approved' ? '✓ Approved' : 'Needs Review'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TraceabilitySection;
