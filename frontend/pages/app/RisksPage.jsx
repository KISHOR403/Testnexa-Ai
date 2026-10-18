import React, { useState } from 'react';
import { AlertTriangle, Shield, CheckCircle2, ShieldAlert, ArrowRight, Filter } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useHistory } from '../../hooks/useHistory';
import { DataLoadingState } from '../../components/loading';

const RisksPage = () => {
    const { history, isLoading } = useHistory();
    const [severityFilter, setSeverityFilter] = useState('All');

    // Extract real risk vectors from the user's generated test suites
    const riskItems = [];
    const userSuites = history.filter(item => item.suite);

    userSuites.forEach((item) => {
        const suite = item.suite;
        const allCases = [
            ...(suite.security || []),
            ...(suite.negative || []),
            ...(suite.edge || []),
            ...(suite.nonFunctional || []),
            ...(suite.functional || [])
        ];

        allCases.forEach((tc) => {
            const isHighRisk = tc.priority === 'High' ||
                tc.severity === 'Critical' ||
                tc.type === 'Security' ||
                tc.type === 'Edge Case' ||
                tc.type === 'Edge';

            if (isHighRisk) {
                const level = tc.severity === 'Critical' ? 'Critical' : tc.priority === 'High' ? 'High' : 'Medium';
                riskItems.push({
                    level,
                    title: tc.title || tc.scenario || 'Unhandled boundary condition',
                    category: tc.type || 'Security',
                    linkedTc: tc.id || 'TC-001',
                    desc: tc.scenario || tc.expectedResult || tc.title,
                    suiteId: item.id || item.sessionId,
                    suiteTitle: item.title || item.feature || 'Test Suite',
                    confirmed: tc.status === 'Approved'
                });
            }
        });
    });

    const criticalCount = riskItems.filter(r => r.level === 'Critical').length;
    const highCount = riskItems.filter(r => r.level === 'High').length;
    const mediumCount = riskItems.filter(r => r.level === 'Medium').length;

    const filteredRisks = severityFilter === 'All'
        ? riskItems
        : riskItems.filter(r => r.level === severityFilter);

    return (
        <div className="ws-page-container">
            {/* Header */}
            <div className="ws-page-header">
                <div className="ws-page-title-wrap">
                    <h1>Risk Vectors & Vulnerabilities</h1>
                    <p>
                        Identified boundary risks, negative security vectors, and mitigated exception paths
                    </p>
                </div>

                <div className="ws-header-actions">
                    <NavLink to="/app/workspace" className="ws-btn-primary">
                        <span>+ New Test Suite</span>
                    </NavLink>
                </div>
            </div>

            {isLoading && riskItems.length === 0 ? (
                <DataLoadingState
                    message="Evaluating risk vectors & exceptions..."
                    telemetryTag="RISK VECTOR ANALYSIS"
                    skeletonType="table"
                    count={4}
                />
            ) : riskItems.length === 0 ? (
                /* Empty state when user has no risk items */
                <div className="ws-empty-state">
                    <div className="ws-empty-icon-wrap" style={{ background: 'rgba(229, 192, 123, 0.1)', borderColor: 'rgba(229, 192, 123, 0.25)', color: '#E5C07B' }}>
                        <ShieldAlert size={28} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '440px' }}>
                        <h2>No risk vectors identified yet.</h2>
                        <p>
                            Generate a test suite in AI Workspace to evaluate security vulnerabilities, negative edge scenarios, and exception flows.
                        </p>
                    </div>

                    <div className="ws-empty-actions">
                        <NavLink to="/app/workspace" className="ws-btn-primary">
                            <span>Generate in AI Workspace &rarr;</span>
                        </NavLink>
                        <NavLink to="/app/test-suites" className="ws-btn-secondary">
                            <span>All Test Suites</span>
                        </NavLink>
                    </div>
                </div>
            ) : (
                <>
                    {/* Severity Metrics */}
                    <div className="ws-stats-grid">
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">TOTAL RISK VECTORS</span>
                            <h2 className="ws-stat-card__val">{riskItems.length}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">CRITICAL SEVERITY</span>
                            <h2 className="ws-stat-card__val" style={{ color: '#E06C75' }}>{criticalCount}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">HIGH SEVERITY</span>
                            <h2 className="ws-stat-card__val" style={{ color: '#E5C07B' }}>{highCount}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">MEDIUM SEVERITY</span>
                            <h2 className="ws-stat-card__val ws-stat-card__val--accent">{mediumCount}</h2>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {['All', 'Critical', 'High', 'Medium'].map((lvl) => (
                            <button
                                key={lvl}
                                type="button"
                                onClick={() => setSeverityFilter(lvl)}
                                className={`tn-filter-pill ${severityFilter === lvl ? 'is-active' : ''}`}
                            >
                                {lvl === 'All' ? `All Risks (${riskItems.length})` : `${lvl} (${riskItems.filter(r => r.level === lvl).length})`}
                            </button>
                        ))}
                    </div>

                    {/* Risk Vectors List */}
                    <div className="ws-card">
                        <div className="ws-card-header">
                            <span>Identified Risk Vectors & Linked Test Cases</span>
                            <span style={{ fontSize: '0.75rem', color: '#777E7E', fontWeight: 500 }}>
                                {filteredRisks.length} {filteredRisks.length === 1 ? 'Record' : 'Records'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {filteredRisks.map((item, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        gap: '1rem',
                                        padding: '1rem 1.25rem',
                                        borderBottom: '1px solid #292D2D',
                                        transition: 'background 0.12s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: '0.85rem', flex: 1 }}>
                                        <div style={{ flexShrink: 0, marginTop: '2px' }}>
                                            <span className={`tn-prio-tag tn-prio-tag--${item.level.toLowerCase()}`}>
                                                {item.level}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                <span style={{ color: '#F2F3F3', fontWeight: 600, fontSize: '0.88rem' }}>
                                                    {item.title}
                                                </span>
                                                <span className="tn-type-tag tn-type-tag--security">
                                                    {item.category}
                                                </span>
                                                {item.confirmed && (
                                                    <span style={{ fontSize: '0.68rem', color: '#8BAF9A', background: 'rgba(139, 175, 154, 0.1)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(139, 175, 154, 0.25)' }}>
                                                        ✓ Confirmed
                                                    </span>
                                                )}
                                            </div>

                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#A0A5A5', lineHeight: 1.45 }}>
                                                {item.desc}
                                            </p>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.2rem', fontSize: '0.74rem', color: '#777E7E' }}>
                                                <span>Suite: <strong style={{ color: '#A0A5A5' }}>{item.suiteTitle}</strong></span>
                                                <span>•</span>
                                                <span>Linked Case: <strong style={{ color: '#8BAF9A', fontFamily: 'monospace' }}>{item.linkedTc}</strong></span>
                                            </div>
                                        </div>
                                    </div>

                                    <NavLink
                                        to={`/app/test-suites/${item.suiteId}`}
                                        className="ws-btn-secondary"
                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem', flexShrink: 0 }}
                                        title="Inspect Test Case"
                                    >
                                        <span>View Case</span>
                                        <ArrowRight size={13} />
                                    </NavLink>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default RisksPage;
