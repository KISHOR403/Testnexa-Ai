import React from 'react';
import RevealSection from './RevealSection';
import {
    ShieldAlert,
    Layers,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    Info
} from 'lucide-react';

const COVERAGE_DATA = [
    { category: 'Functional Scenarios', percentage: 94, count: '12 / 13 Cases', status: 'Optimal' },
    { category: 'Negative & Input Validation', percentage: 88, count: '7 / 8 Cases', status: 'Good' },
    { category: 'Security & Token Lifecycles', percentage: 82, count: '5 / 6 Cases', status: 'Review' },
    { category: 'Edge Cases & Race Conditions', percentage: 76, count: '4 / 5 Cases', status: 'Attention' }
];

const RISK_BREAKDOWN = [
    {
        level: 'HIGH',
        count: 3,
        colorClass: 'is-high',
        items: [
            { title: 'Expired Token Invalidation Window', desc: 'Tokens active >15 minutes allow credential hijack if email link is compromised.' },
            { title: 'Token Replay / Nonce Reuse', desc: 'Consumed tokens not burned in single transaction allow replay exploitation.' },
            { title: 'Rate Limiting Omission', desc: 'Absence of IP throttling exposes mail provider to quota exhaustion and flooding.' }
        ]
    },
    {
        level: 'MEDIUM',
        count: 7,
        colorClass: 'is-medium',
        items: [
            { title: 'Account Enumeration Timing Variance', desc: 'Response latency delta between existing and non-existing accounts leaks user directory.' },
            { title: 'Concurrent Session Invalidation Delay', desc: 'Password reset should immediately terminate all active refresh tokens.' }
        ]
    },
    {
        level: 'LOW',
        count: 12,
        colorClass: 'is-low',
        items: [
            { title: 'Inline Form Error Copy Clarity', desc: 'Clarify password complexity error strings for special character requirements.' }
        ]
    }
];

export const CoverageRiskSection = () => {
    return (
        <section className="tn-section tn-coverage-risk-section" aria-labelledby="cov-risk-heading">
            <div className="tn-container">
                <RevealSection className="tn-section-header">
                    <span className="tn-kicker tn-kicker--accent">Test Coverage & Risk</span>
                    <h2 id="cov-risk-heading" className="tn-section-title">
                        See coverage and risk before execution.
                    </h2>
                    <p className="tn-section-subtitle">
                        Measure requirement coverage and surface high-severity gaps before release.
                    </p>
                </RevealSection>

                <div className="tn-cov-risk-grid" data-parallax-offset="10">
                    {/* Left: Coverage Dashboard */}
                    <div className="tn-cov-panel">
                        <div className="tn-cov-panel__header">
                            <div className="tn-cov-panel__title-wrap">
                                <Layers size={18} className="text-accent" />
                                <h3>Coverage Distribution</h3>
                            </div>
                            <div className="tn-cov-overall-badge">
                                <span className="tn-cov-overall-num">87%</span>
                                <span className="tn-cov-overall-label">Overall Coverage</span>
                            </div>
                        </div>

                        <div className="tn-cov-bars-stack">
                            {COVERAGE_DATA.map((item) => (
                                <div key={item.category} className="tn-cov-bar-row">
                                    <div className="tn-cov-bar-meta">
                                        <span className="tn-cov-cat-name">{item.category}</span>
                                        <div className="tn-cov-cat-stats">
                                            <span className="tn-cov-case-count">{item.count}</span>
                                            <span className="tn-cov-pct-val">{item.percentage}%</span>
                                        </div>
                                    </div>
                                    <div className="tn-cov-bar-track">
                                        <div
                                            className="tn-cov-bar-fill"
                                            style={{ width: `${item.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="tn-cov-footer-note">
                            <span className="tn-dot-accent" />
                            <span>Calculated across 28 testable assertions derived from REQ-142</span>
                        </div>
                    </div>

                    {/* Right: Risk Analysis Dashboard */}
                    <div className="tn-risk-panel">
                        <div className="tn-risk-panel__header">
                            <div className="tn-risk-panel__title-wrap">
                                <ShieldAlert size={18} className="text-amber" />
                                <h3>Risk Analysis Matrix</h3>
                            </div>
                            <div className="tn-risk-tally-bar">
                                <span className="tn-tally-pill tn-tally-pill--high">3 High</span>
                                <span className="tn-tally-pill tn-tally-pill--med">7 Medium</span>
                                <span className="tn-tally-pill tn-tally-pill--low">12 Low</span>
                            </div>
                        </div>

                        <div className="tn-risk-tiers-stack">
                            {RISK_BREAKDOWN.map((tier) => (
                                <div key={tier.level} className={`tn-risk-tier-card ${tier.colorClass}`}>
                                    <div className="tn-risk-tier-header">
                                        <span className="tn-tier-level-tag">{tier.level} RISK ({tier.count})</span>
                                    </div>
                                    <div className="tn-tier-items-list">
                                        {tier.items.map((item, idx) => (
                                            <div key={idx} className="tn-tier-item">
                                                <strong>{item.title}</strong>
                                                <p>{item.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CoverageRiskSection;
