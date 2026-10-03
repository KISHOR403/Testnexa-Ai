import React, { useState } from 'react';
import { GitBranch, Check, AlertTriangle, Shield, CheckCircle2, ChevronRight, Layers, FileText } from 'lucide-react';
import RevealSection from './RevealSection';

const TREE_NODES = {
    requirement: {
        id: 'REQ-142',
        title: 'Password Reset Recovery',
        type: 'Requirement',
        spec: 'Users can reset password via registered email',
        badge: 'Specification Root'
    },
    scenarios: [
        {
            id: 'SC-01',
            title: 'Valid Email Dispatch',
            type: 'Functional',
            tests: [
                { id: 'TC-001', name: 'Submit registered email & assert token dispatch', priority: 'High', status: 'Verified' },
                { id: 'TC-002', name: 'Assert single-use token consumption', priority: 'High', status: 'Verified' }
            ]
        },
        {
            id: 'SC-02',
            title: 'Negative Input & Abuse',
            type: 'Negative & Security',
            tests: [
                { id: 'TC-003', name: 'Reject malformed email syntax (RFC 5322)', priority: 'High', status: 'Verified' },
                { id: 'TC-004', name: 'Enforce 5 req/min IP rate limiting (HTTP 429)', priority: 'High', status: 'Verified' }
            ]
        }
    ],
    risks: [
        { id: 'RISK-01', title: 'Token TTL Invalidation Window', level: 'High', mitigatedBy: 'TC-003' },
        { id: 'RISK-02', title: 'Mail Gateway Quota Flooding', level: 'High', mitigatedBy: 'TC-004' }
    ],
    coverage: {
        clauseCoverage: '94.2%',
        orphanTests: '0',
        lineageStatus: '100% Mapped'
    }
};

export const TraceabilityGraph = () => {
    const [selectedBranch, setSelectedBranch] = useState('scenarios'); // 'scenarios' | 'risks' | 'coverage'
    const [selectedTest, setSelectedTest] = useState('TC-001');

    return (
        <section id="traceability" className="tn-section tn-trace-graph-section" aria-labelledby="traceability-heading">
            <div className="tn-container">
                <RevealSection className="tn-section-header">
                    <div className="tn-chapter-eyebrow">
                        <span className="tn-chapter-pill">TRACEABILITY ARCHITECTURE</span>
                        <span className="tn-chapter-sub">Deterministic Quality Lineage</span>
                    </div>
                    <h2 id="traceability-heading" className="tn-section-title">
                        Every test maps back to a requirement.
                    </h2>
                    <p className="tn-section-subtitle">
                        Eliminate orphan test cases and undocumented gaps. Testnexa maintains strict, verifiable bidirectional lineage from requirement to scenario to test case to risk mitigation.
                    </p>
                </RevealSection>

                {/* ─── Technical Traceability Canvas ─── */}
                <div className="tn-trace-canvas" aria-label="Requirement Traceability Graph">
                    {/* Top Tree Legend & Quick Filters */}
                    <div className="tn-trace-top-bar">
                        <div className="tn-trace-legend">
                            <span className="tn-legend-item">
                                <span className="tn-legend-dot tn-legend-dot--req" />
                                <span>Requirement Root</span>
                            </span>
                            <span className="tn-legend-item">
                                <span className="tn-legend-dot tn-legend-dot--scen" />
                                <span>Scenario Group</span>
                            </span>
                            <span className="tn-legend-item">
                                <span className="tn-legend-dot tn-legend-dot--tc" />
                                <span>Test Case</span>
                            </span>
                            <span className="tn-legend-item">
                                <span className="tn-legend-dot tn-legend-dot--risk" />
                                <span>Risk Mitigation</span>
                            </span>
                        </div>

                        <div className="tn-trace-status-pill">
                            <CheckCircle2 size={13} className="text-green" />
                            <span>100% Bidirectional Lock</span>
                        </div>
                    </div>

                    {/* ─── Hierarchy Visualization ─── */}
                    <div className="tn-trace-tree-wrapper">
                        
                        {/* ROOT: REQUIREMENT NODE */}
                        <div className="tn-tree-level tn-tree-level--root">
                            <div className="tn-tree-node tn-tree-node--root is-selected">
                                <div className="tn-node-pill">
                                    <FileText size={13} className="text-accent" />
                                    <span>REQUIREMENT SPEC</span>
                                </div>
                                <div className="tn-node-main">
                                    <strong className="tn-node-title">REQ-142: Password Reset Recovery</strong>
                                    <p className="tn-node-desc">"Users can reset their password using their registered email address."</p>
                                </div>
                                <div className="tn-node-meta-foot">
                                    <span>Jira: PROD-842</span>
                                    <span>Coverage: 94.2%</span>
                                    <span className="text-green">Status: Verified</span>
                                </div>
                            </div>
                        </div>

                        {/* CONNECTOR STEM TO SUB-BRANCHES */}
                        <div className="tn-tree-stem-connector" aria-hidden="true">
                            <div className="tn-stem-vertical" />
                            <div className="tn-stem-horizontal-bar" />
                        </div>

                        {/* THREE MAIN BRANCHES: SCENARIOS | RISKS | COVERAGE */}
                        <div className="tn-tree-branches-grid">
                            
                            {/* BRANCH 1: SCENARIOS & ATTACHED TEST CASES */}
                            <div className={`tn-branch-col ${selectedBranch === 'scenarios' ? 'is-active-branch' : ''}`}>
                                <div 
                                    className="tn-branch-header"
                                    onClick={() => setSelectedBranch('scenarios')}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div className="tn-branch-title-row">
                                        <Layers size={14} className="text-accent" />
                                        <strong>Scenarios & Test Cases</strong>
                                    </div>
                                    <span className="tn-badge tn-badge--neutral">4 Linked Tests</span>
                                </div>

                                <div className="tn-branch-children-list">
                                    {TREE_NODES.scenarios.map((scen) => (
                                        <div key={scen.id} className="tn-scen-group-block">
                                            <div className="tn-scen-group-head">
                                                <span className="tn-scen-tag">{scen.id}</span>
                                                <span className="tn-scen-name">{scen.title}</span>
                                                <span className="tn-scen-type">{scen.type}</span>
                                            </div>

                                            <div className="tn-scen-tests-list">
                                                {scen.tests.map((tc) => {
                                                    const isSelected = selectedTest === tc.id;
                                                    return (
                                                        <div
                                                            key={tc.id}
                                                            onClick={() => setSelectedTest(tc.id)}
                                                            className={`tn-tree-leaf-node ${isSelected ? 'is-selected' : ''}`}
                                                            role="button"
                                                            tabIndex={0}
                                                        >
                                                            <div className="tn-leaf-top">
                                                                <span className="tn-tc-id">{tc.id}</span>
                                                                <span className="tn-priority-tag tn-priority-tag--high">{tc.priority}</span>
                                                                <span className="tn-leaf-status">
                                                                    <Check size={11} className="text-green" />
                                                                    <span>{tc.status}</span>
                                                                </span>
                                                            </div>
                                                            <span className="tn-leaf-name">{tc.name}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* BRANCH 2: IDENTIFIED RISKS & MITIGATIONS */}
                            <div className={`tn-branch-col ${selectedBranch === 'risks' ? 'is-active-branch' : ''}`}>
                                <div 
                                    className="tn-branch-header"
                                    onClick={() => setSelectedBranch('risks')}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div className="tn-branch-title-row">
                                        <AlertTriangle size={14} className="text-amber" />
                                        <strong>Identified Risks</strong>
                                    </div>
                                    <span className="tn-badge tn-badge--amber">2 High Severity</span>
                                </div>

                                <div className="tn-branch-children-list">
                                    {TREE_NODES.risks.map((risk) => (
                                        <div key={risk.id} className="tn-risk-leaf-node">
                                            <div className="tn-risk-leaf-head">
                                                <span className="tn-badge tn-badge--red">{risk.level}</span>
                                                <strong className="tn-risk-title">{risk.id}: {risk.title}</strong>
                                            </div>
                                            <div className="tn-risk-mitigation-tag">
                                                <span>Mitigated By:</span>
                                                <code>{risk.mitigatedBy}</code>
                                                <Check size={11} className="text-green" />
                                            </div>
                                        </div>
                                    ))}

                                    <div className="tn-risk-note-box">
                                        <span>Risk Engine Assurance:</span>
                                        <p>Every identified omission is structurally bound to at least one executable test asserting boundary compliance.</p>
                                    </div>
                                </div>
                            </div>

                            {/* BRANCH 3: CLAUSE COVERAGE & LINEAGE AUDIT */}
                            <div className={`tn-branch-col ${selectedBranch === 'coverage' ? 'is-active-branch' : ''}`}>
                                <div 
                                    className="tn-branch-header"
                                    onClick={() => setSelectedBranch('coverage')}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div className="tn-branch-title-row">
                                        <GitBranch size={14} className="text-accent" />
                                        <strong>Coverage & Lineage</strong>
                                    </div>
                                    <span className="tn-badge tn-badge--green">Validated</span>
                                </div>

                                <div className="tn-branch-children-list">
                                    <div className="tn-cov-leaf-stat">
                                        <span className="tn-cov-label">Clause Coverage</span>
                                        <span className="tn-cov-value text-green font-mono">{TREE_NODES.coverage.clauseCoverage}</span>
                                        <span className="tn-cov-sub">All specified requirements tested</span>
                                    </div>

                                    <div className="tn-cov-leaf-stat">
                                        <span className="tn-cov-label">Orphan Test Cases</span>
                                        <span className="tn-cov-value font-mono">{TREE_NODES.coverage.orphanTests}</span>
                                        <span className="tn-cov-sub">Zero unmapped tests detected</span>
                                    </div>

                                    <div className="tn-cov-leaf-stat">
                                        <span className="tn-cov-label">Bidirectional Integrity</span>
                                        <span className="tn-cov-value text-accent font-mono">{TREE_NODES.coverage.lineageStatus}</span>
                                        <span className="tn-cov-sub">Cryptographically signed manifest</span>
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>

                    {/* Active Inspector Lineage Footer */}
                    <div className="tn-trace-footer-inspect">
                        <div className="tn-inspect-lineage">
                            <span className="tn-trace-path-label">Active Lineage Path:</span>
                            <div className="tn-trace-breadcrumbs">
                                <code>REQ-142</code>
                                <span className="tn-trace-arrow">&rarr;</span>
                                <code>SC-01</code>
                                <span className="tn-trace-arrow">&rarr;</span>
                                <code className="is-highlighted">{selectedTest}</code>
                                <span className="tn-trace-arrow">&rarr;</span>
                                <span className="tn-inspect-verified text-green">100% Traceability Verified</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TraceabilityGraph;
