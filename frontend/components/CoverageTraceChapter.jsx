import React, { useState } from 'react';
import RevealSection from './RevealSection';
import {
    ShieldAlert,
    Layers,
    CheckCircle2,
    AlertTriangle,
    GitBranch,
    ArrowRight,
    Shield,
    Check,
    Info,
    FileText
} from 'lucide-react';

const COVERAGE_DIMENSIONS = [
    { category: 'Functional Scenarios', percentage: 94, count: '12 / 13 Cases', status: 'Optimal' },
    { category: 'Negative & Input Validation', percentage: 88, count: '7 / 8 Cases', status: 'Good' },
    { category: 'Security & Token Lifecycles', percentage: 100, count: '5 / 5 Cases', status: 'Optimal' },
    { category: 'Edge Cases & TTL Limits', percentage: 80, count: '4 / 5 Cases', status: 'Attention' }
];

const SEVERITY_RISKS = [
    {
        id: 'RISK-01',
        level: 'HIGH',
        badgeClass: 'tn-badge--red',
        title: 'Expired Token Invalidation Window',
        desc: 'Tokens active >15 minutes allow credential hijack if email link is intercepted.',
        mitigatedBy: 'TC-003'
    },
    {
        id: 'RISK-02',
        level: 'HIGH',
        badgeClass: 'tn-badge--red',
        title: 'Token Replay & Nonce Reuse',
        desc: 'Consumed tokens not burned in atomic transaction allow replay exploitation.',
        mitigatedBy: 'TC-001'
    },
    {
        id: 'RISK-03',
        level: 'HIGH',
        badgeClass: 'tn-badge--red',
        title: 'Rate Limiting Omission on Auth Gateway',
        desc: 'Absence of IP throttling exposes mail provider to quota exhaustion and flooding.',
        mitigatedBy: 'TC-004'
    }
];

const TRACEABILITY_ITEMS = [
    {
        clauseId: 'REQ-142.1',
        clauseName: 'Core Recovery Flow',
        tcId: 'TC-001',
        tcTitle: 'Valid password reset dispatch & token delivery',
        category: 'Functional',
        status: 'Verified',
        verified: true
    },
    {
        clauseId: 'REQ-142.2',
        clauseName: 'Input Validation Rules',
        tcId: 'TC-002',
        tcTitle: 'RFC 5322 email syntax validation & HTTP 422',
        category: 'Negative',
        status: 'Verified',
        verified: true
    },
    {
        clauseId: 'REQ-142.3',
        clauseName: 'Token Lifecycle & TTL',
        tcId: 'TC-003',
        tcTitle: 'Expired reset token rejection post-15m TTL',
        category: 'Edge Case',
        status: 'Verified',
        verified: true
    },
    {
        clauseId: 'REQ-142.4',
        clauseName: 'Abuse & DoS Throttling',
        tcId: 'TC-004',
        tcTitle: 'Enforce 5 req/min rate limit per client IP',
        category: 'Security',
        status: 'Verified',
        verified: true
    },
    {
        clauseId: 'REQ-142.5',
        clauseName: 'Directory Privacy',
        tcId: 'TC-005',
        tcTitle: 'Anti-enumeration uniform timing validation',
        category: 'Negative',
        status: 'Verified',
        verified: true
    }
];

export const CoverageTraceChapter = () => {
    const [selectedTrace, setSelectedTrace] = useState('REQ-142.1');

    return (
        <section id="coverage" className="tn-section tn-coverage-trace-chapter" aria-labelledby="chapter3-heading">
            <div className="tn-container">
                {/* ─── Chapter Header ─── */}
                <RevealSection className="tn-section-header">
                    <div className="tn-story-chapter-eyebrow">
                        <span className="tn-chapter-pill">CHAPTER 03</span>
                        <span className="tn-chapter-sub">Quality Intelligence</span>
                    </div>
                    <h2 id="chapter3-heading" className="tn-section-title">
                        Know what is covered before execution.
                    </h2>
                    <p className="tn-section-subtitle">
                        Measure requirement coverage, isolate high-severity release risks, and trace every test case back to its source specification.
                    </p>
                </RevealSection>

                {/* ─── ONE Integrated Product Visualization ─── */}
                <div className="tn-covtrace-workspace" data-parallax-offset="15">
                    
                    {/* Top KPI Audit Header */}
                    <div className="tn-covtrace-top-bar">
                        <div className="tn-covtrace-metric">
                            <span className="tn-kpi-label">Clause Coverage</span>
                            <div className="tn-kpi-val text-green">92.4%</div>
                            <span className="tn-kpi-sub">5 of 5 clauses verified</span>
                        </div>
                        <div className="tn-covtrace-metric">
                            <span className="tn-kpi-label">Traceability Integrity</span>
                            <div className="tn-kpi-val text-accent">100%</div>
                            <span className="tn-kpi-sub">Zero orphan test cases</span>
                        </div>
                        <div className="tn-covtrace-metric">
                            <span className="tn-kpi-label">High-Severity Risks</span>
                            <div className="tn-kpi-val text-amber">3 Flagged</div>
                            <span className="tn-kpi-sub">All mitigated by test cases</span>
                        </div>
                        <div className="tn-covtrace-metric">
                            <span className="tn-kpi-label">Audit Engine</span>
                            <div className="tn-kpi-val font-mono" style={{ fontSize: '1.05rem', marginTop: '0.2rem' }}>Pass</div>
                            <span className="tn-kpi-sub">ISO/IEC 29119 Aligned</span>
                        </div>
                    </div>

                    {/* Main Dual-Pane High-Density Display */}
                    <div className="tn-covtrace-grid">
                        
                        {/* Left Pane: Coverage Dimensions & Risk Radar */}
                        <div className="tn-covtrace-left-pane">
                            <div className="tn-pane-title-bar">
                                <Layers size={14} className="text-accent" />
                                <span>Coverage Dimensions & Severity Risk</span>
                            </div>

                            {/* Coverage Dimension Bars */}
                            <div className="tn-dimension-bars-list">
                                {COVERAGE_DIMENSIONS.map((dim) => (
                                    <div key={dim.category} className="tn-dimension-row">
                                        <div className="tn-dim-header">
                                            <span className="tn-dim-name">{dim.category}</span>
                                            <div className="tn-dim-stats">
                                                <span className="tn-dim-count">{dim.count}</span>
                                                <span className="tn-dim-percent font-mono">{dim.percentage}%</span>
                                            </div>
                                        </div>
                                        <div className="tn-dim-track">
                                            <div 
                                                className={`tn-dim-fill ${dim.percentage >= 90 ? 'is-high' : dim.percentage >= 80 ? 'is-good' : 'is-warn'}`}
                                                style={{ width: `${dim.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* High-Severity Risk Mitigations */}
                            <div className="tn-risk-mitigation-box">
                                <span className="tn-risk-box-title">
                                    <AlertTriangle size={13} className="text-amber" />
                                    <span>Identified High Risks & Mitigations</span>
                                </span>
                                <div className="tn-risk-items-list">
                                    {SEVERITY_RISKS.map((risk) => (
                                        <div key={risk.id} className="tn-risk-item-row">
                                            <div className="tn-risk-header">
                                                <span className={`tn-badge ${risk.badgeClass}`}>{risk.level}</span>
                                                <span className="tn-risk-name">{risk.title}</span>
                                                <span className="tn-mitigate-pill">Mitigated: {risk.mitigatedBy}</span>
                                            </div>
                                            <p className="tn-risk-desc">{risk.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Pane: Bidirectional Traceability Tree */}
                        <div className="tn-covtrace-right-pane">
                            <div className="tn-pane-title-bar">
                                <GitBranch size={14} className="text-accent" />
                                <span>Bidirectional Traceability Matrix</span>
                            </div>

                            <p className="tn-trace-subtext">
                                Every requirement clause is mapped to its verified test case. Click any mapping to inspect lineage.
                            </p>

                            <div className="tn-trace-tree-table" role="table" aria-label="Requirement to Test Traceability">
                                <div className="tn-trace-thead" role="row">
                                    <div style={{ width: '30%' }}>Requirement Clause</div>
                                    <div style={{ width: '45%' }}>Verified Test Case</div>
                                    <div style={{ width: '25%', textAlign: 'right' }}>Status</div>
                                </div>

                                <div className="tn-trace-tbody">
                                    {TRACEABILITY_ITEMS.map((item) => {
                                        const isSelected = item.clauseId === selectedTrace;
                                        return (
                                            <div 
                                                key={item.clauseId} 
                                                role="row"
                                                onClick={() => setSelectedTrace(item.clauseId)}
                                                className={`tn-trace-trow ${isSelected ? 'is-selected' : ''}`}
                                            >
                                                <div className="tn-clause-cell">
                                                    <span className="tn-clause-id">{item.clauseId}</span>
                                                    <span className="tn-clause-name">{item.clauseName}</span>
                                                </div>

                                                <div className="tn-testcase-cell">
                                                    <div className="tn-tc-pill-row">
                                                        <span className="tn-tc-tag">{item.tcId}</span>
                                                        <span className="tn-tc-cat">{item.category}</span>
                                                    </div>
                                                    <span className="tn-tc-cell-title">{item.tcTitle}</span>
                                                </div>

                                                <div className="tn-status-cell">
                                                    <span className="tn-trace-verified-pill">
                                                        <Check size={11} className="text-green" />
                                                        <span>{item.status}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Active Traceability Inspector Footnote */}
                            <div className="tn-trace-inspector-foot">
                                <span className="tn-inspect-label">Selected Trace:</span>
                                <code>{selectedTrace} &harr; {TRACEABILITY_ITEMS.find((t) => t.clauseId === selectedTrace)?.tcId}</code>
                                <span className="tn-inspect-desc">Bidirectional lineage lock validated in production manifest.</span>
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        </section>
    );
};

export default CoverageTraceChapter;
