import React, { useState, useMemo } from 'react';
import {
    ChevronDown, ChevronUp, Target, BarChart3, PieChart,
    Grid3X3, TrendingUp, AlertTriangle, CheckCircle2, Info, ShieldCheck
} from 'lucide-react';
import {
    computeRequirementTraceability,
    computeModuleDistribution,
    computeTypeRatios,
    computeRiskHeatmap,
    computeOverallHealth,
} from '../utils/coverageAnalytics';

// ─── Radial Progress Ring ───
const RadialGauge = ({ percentage, size = 100, strokeWidth = 8, label }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const color = percentage >= 80 ? '#00d4c1' : percentage >= 50 ? '#f59e0b' : '#f87171';

    return (
        <div className="ca-radial-gauge">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={color} strokeWidth={strokeWidth}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
                <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="600">
                    {percentage}%
                </text>
                <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10" fontWeight="600">
                    {label}
                </text>
            </svg>
        </div>
    );
};

// ─── Horizontal Stacked Bar ───
const StackedBar = ({ module, data, maxTotal }) => {
    const segments = [
        { key: 'functional', color: '#4F8CFF', label: 'Functional' },
        { key: 'negative', color: '#f59e0b', label: 'Negative' },
        { key: 'edge', color: '#fb923c', label: 'Edge' },
        { key: 'api', color: '#a3a3a3', label: 'API' },
        { key: 'nonFunctional', color: '#a78bfa', label: 'Non-Func' },
    ];
    const barWidth = maxTotal > 0 ? (data.total / maxTotal) * 100 : 0;

    return (
        <div className="ca-bar-row">
            <span className="ca-bar-label" title={module}>{module}</span>
            <div className="ca-bar-track">
                <div className="ca-bar-fill" style={{ width: `${barWidth}%` }}>
                    {segments.map(seg => {
                        const val = data[seg.key] || 0;
                        if (val === 0) return null;
                        const segWidth = (val / data.total) * 100;
                        return (
                            <div
                                key={seg.key}
                                className="ca-bar-segment"
                                style={{ width: `${segWidth}%`, background: seg.color }}
                                title={`${seg.label}: ${val}`}
                            />
                        );
                    })}
                </div>
            </div>
            <span className="ca-bar-count">{data.total}</span>
        </div>
    );
};

// ─── Heatmap Cell ───
const HeatmapCell = ({ count, maxCount }) => {
    if (count === 0) {
        return <div className="ca-heat-cell empty" title="0 tests">—</div>;
    }
    const intensity = maxCount > 0 ? count / maxCount : 0;
    const bg = intensity >= 0.7
        ? `rgba(79, 140, 255, ${0.15 + intensity * 0.35})`
        : intensity >= 0.3
            ? `rgba(251, 191, 36, ${0.1 + intensity * 0.3})`
            : `rgba(248, 113, 113, ${0.1 + intensity * 0.2})`;

    return (
        <div className="ca-heat-cell" style={{ background: bg }} title={`${count} test(s)`}>
            {count}
        </div>
    );
};

// ─── Factor Progress Bar ───
const FactorBar = ({ name, score, detail }) => {
    const color = score >= 80 ? '#00d4c1' : score >= 50 ? '#f59e0b' : '#f87171';
    return (
        <div className="ca-factor-row">
            <div className="ca-factor-header">
                <span className="ca-factor-name">{name}</span>
                <span className="ca-factor-score" style={{ color }}>{score}%</span>
            </div>
            <div className="ca-factor-track">
                <div
                    className="ca-factor-fill"
                    style={{ width: `${score}%`, background: color, transition: 'width 1s ease-out' }}
                />
            </div>
            <span className="ca-factor-detail">{detail}</span>
        </div>
    );
};

// ─── Main Coverage Analytics Panel ───
const CoverageAnalytics = ({ result }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const traceability = useMemo(() => computeRequirementTraceability(result), [result]);
    const modules = useMemo(() => computeModuleDistribution(result), [result]);
    const typeRatios = useMemo(() => computeTypeRatios(result), [result]);
    const heatmap = useMemo(() => computeRiskHeatmap(result), [result]);
    const health = useMemo(() => computeOverallHealth(result), [result]);

    const maxModuleTotal = modules.length > 0 ? Math.max(...modules.map(m => m.total)) : 1;

    // Backend confidence data (passthrough)
    const confidenceBreakdown = result?.quality?.confidenceBreakdown || null;
    const coverageGaps = result?.coverageGaps || [];
    const recommendations = result?.recommendations || [];

    const healthColor = health.score >= 80 ? '#00d4c1' : health.score >= 60 ? '#f59e0b' : '#f87171';

    // Empty state — no test cases generated
    if (traceability.total === 0) {
        return (
            <div className="ca-panel glass-card">
                <button className="ca-panel-header" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="ca-panel-title-group">
                        <BarChart3 size={20} className="text-primary" />
                        <h3 className="ca-panel-title">Coverage Analytics</h3>
                        <span className="ca-health-badge" style={{ color: '#f87171', borderColor: '#f87171' }}>
                            No Data
                        </span>
                    </div>
                    <span className="ca-toggle-icon">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </span>
                </button>
                {isExpanded && (
                    <div className="ca-panel-body animate-fade-in">
                        <div className="ca-no-data" style={{ flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '1rem' }}>
                            <AlertTriangle size={32} style={{ color: '#f59e0b' }} />
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', margin: '0 0 0.5rem' }}>
                                    No test cases were generated
                                </p>
                                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>
                                    The AI returned an empty test suite. This can happen when the response is truncated or the model fails to produce structured output. Try regenerating with a more specific requirement.
                                </p>
                            </div>
                            {recommendations.length > 0 && (
                                <div className="ca-recs-section" style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                                    <h5 className="ca-recs-title">
                                        <CheckCircle2 size={14} />
                                        AI Recommendations
                                    </h5>
                                    <ul className="ca-recs-list">
                                        {recommendations.map((rec, i) => (
                                            <li key={i}>{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="ca-panel glass-card">
            {/* Panel Header */}
            <button className="ca-panel-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="ca-panel-title-group">
                    <BarChart3 size={20} className="text-primary" />
                    <h3 className="ca-panel-title">Coverage Analytics</h3>
                    <span className="ca-health-badge" style={{ color: healthColor, borderColor: healthColor }}>
                        {health.score}% — {health.level}
                    </span>
                </div>
                <span className="ca-toggle-icon">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </span>
            </button>

            {isExpanded && (
                <div className="ca-panel-body animate-fade-in">
                    {/* Row 1: Traceability + Type Ratio */}
                    <div className="ca-metrics-row ca-row-two">
                        {/* Requirement Traceability */}
                        <div className="ca-metric-card glass-card">
                            <div className="ca-metric-header">
                                <Target size={16} />
                                <span>Requirement Traceability</span>
                            </div>
                            <div className="ca-traceability-content">
                                <RadialGauge
                                    percentage={traceability.percentage}
                                    size={110}
                                    strokeWidth={10}
                                    label="TRACED"
                                />
                                <div className="ca-traceability-stats">
                                    <div className="ca-stat-item">
                                        <span className="ca-stat-value">{traceability.traced}</span>
                                        <span className="ca-stat-label">Linked to REQ</span>
                                    </div>
                                    <div className="ca-stat-item">
                                        <span className="ca-stat-value">{traceability.total - traceability.traced}</span>
                                        <span className="ca-stat-label">Unlinked</span>
                                    </div>
                                    <div className="ca-stat-item">
                                        <span className="ca-stat-value">{traceability.uniqueRequirements?.length || 0}</span>
                                        <span className="ca-stat-label">Unique REQs</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Type Ratio Breakdown */}
                        <div className="ca-metric-card glass-card">
                            <div className="ca-metric-header">
                                <PieChart size={16} />
                                <span>Functional vs Regression Ratio</span>
                            </div>
                            <div className="ca-type-ratio-content">
                                <div className="ca-ratio-visual">
                                    <div className="ca-ratio-bar-container">
                                        {typeRatios.segments.map((seg, i) => {
                                            const pct = typeRatios.total > 0
                                                ? (seg.value / typeRatios.total) * 100
                                                : 0;
                                            return (
                                                <div
                                                    key={i}
                                                    className="ca-ratio-segment"
                                                    style={{
                                                        width: `${pct}%`,
                                                        background: seg.color,
                                                    }}
                                                    title={`${seg.label}: ${seg.value} (${Math.round(pct)}%)`}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="ca-ratio-label-row">
                                        <span className="ca-ratio-value">{typeRatios.ratioLabel}</span>
                                        <span className="ca-ratio-desc">func : regression</span>
                                    </div>
                                </div>
                                <div className="ca-ratio-legend">
                                    {typeRatios.segments.map((seg, i) => (
                                        <div key={i} className="ca-legend-item">
                                            <span className="ca-legend-dot" style={{ background: seg.color }} />
                                            <span className="ca-legend-label">{seg.label}</span>
                                            <span className="ca-legend-count">{seg.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Module Distribution */}
                    <div className="ca-metric-card glass-card ca-full-width">
                        <div className="ca-metric-header">
                            <BarChart3 size={16} />
                            <span>Test Cases per Module</span>
                            <span className="ca-metric-badge">{modules.length} modules</span>
                        </div>
                        <div className="ca-module-bars">
                            {modules.map((mod) => (
                                <StackedBar
                                    key={mod.module}
                                    module={mod.module}
                                    data={mod}
                                    maxTotal={maxModuleTotal}
                                />
                            ))}
                        </div>
                        <div className="ca-bar-legend">
                            {[
                                { color: '#4F8CFF', label: 'Functional' },
                                { color: '#f59e0b', label: 'Negative' },
                                { color: '#fb923c', label: 'Edge' },
                                { color: '#a3a3a3', label: 'API' },
                                { color: '#a78bfa', label: 'Non-Functional' },
                            ].map((item, i) => (
                                <div key={i} className="ca-legend-item">
                                    <span className="ca-legend-dot" style={{ background: item.color }} />
                                    <span className="ca-legend-label">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Row 3: Risk Coverage Heatmap */}
                    <div className="ca-metric-card glass-card ca-full-width">
                        <div className="ca-metric-header">
                            <Grid3X3 size={16} />
                            <span>Risk Coverage Heatmap</span>
                        </div>
                        <div className="ca-heatmap-wrapper">
                            <div className="ca-heatmap-grid" style={{
                                gridTemplateColumns: `minmax(120px, 1.5fr) repeat(3, 1fr)`,
                            }}>
                                {/* Header row */}
                                <div className="ca-heat-header ca-heat-module-header">Module</div>
                                <div className="ca-heat-header high">High</div>
                                <div className="ca-heat-header medium">Medium</div>
                                <div className="ca-heat-header low">Low</div>

                                {/* Data rows */}
                                {heatmap.modules.map((mod) => (
                                    <React.Fragment key={mod.module}>
                                        <div className={`ca-heat-module ${mod.riskLevel}`} title={`Risk: ${mod.riskLevel}`}>
                                            {mod.module}
                                            {mod.riskLevel === 'at-risk' && <AlertTriangle size={12} className="ca-risk-icon" />}
                                            {mod.riskLevel === 'covered' && <CheckCircle2 size={12} className="ca-covered-icon" />}
                                        </div>
                                        <HeatmapCell count={mod.high} maxCount={heatmap.maxCount} />
                                        <HeatmapCell count={mod.medium} maxCount={heatmap.maxCount} />
                                        <HeatmapCell count={mod.low} maxCount={heatmap.maxCount} />
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="ca-heatmap-legend">
                                <span className="ca-heat-legend-label">Density:</span>
                                <div className="ca-heat-scale">
                                    <span className="ca-heat-scale-cell" style={{ background: 'rgba(248,113,113,0.15)' }}>Low</span>
                                    <span className="ca-heat-scale-cell" style={{ background: 'rgba(251,191,36,0.25)' }}>Med</span>
                                    <span className="ca-heat-scale-cell" style={{ background: 'rgba(79, 140, 255,0.35)' }}>High</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 4: Health Factors + Backend Confidence */}
                    <div className="ca-metrics-row ca-row-two">
                        {/* Computed Health Factors */}
                        <div className="ca-metric-card glass-card">
                            <div className="ca-metric-header">
                                <TrendingUp size={16} />
                                <span>Coverage Health Factors</span>
                            </div>
                            <div className="ca-factors-list">
                                {health.factors.map((f, i) => (
                                    <FactorBar key={i} name={f.name} score={f.score} detail={f.detail} />
                                ))}
                            </div>
                        </div>

                        {/* Backend Confidence + Gaps */}
                        <div className="ca-metric-card glass-card">
                            <div className="ca-metric-header">
                                <ShieldCheck size={16} />
                                <span>AI Confidence & Gaps</span>
                            </div>
                            <div className="ca-confidence-content">
                                {confidenceBreakdown ? (
                                    <div className="ca-confidence-factors">
                                        {Object.entries(confidenceBreakdown).map(([key, val]) => {
                                            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                            const score = Math.round(val * 100);
                                            return <FactorBar key={key} name={label} score={score} detail={`AI-computed`} />;
                                        })}
                                    </div>
                                ) : (
                                    <div className="ca-no-data">
                                        <Info size={16} />
                                        <span>AI confidence breakdown not available for this generation</span>
                                    </div>
                                )}

                                {coverageGaps.length > 0 && (
                                    <div className="ca-gaps-section">
                                        <h5 className="ca-gaps-title">
                                            <AlertTriangle size={14} />
                                            Coverage Gaps
                                        </h5>
                                        <ul className="ca-gaps-list">
                                            {coverageGaps.map((gap, i) => (
                                                <li key={i}>{typeof gap === 'string' ? gap : gap.description || JSON.stringify(gap)}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {recommendations.length > 0 && (
                                    <div className="ca-recs-section">
                                        <h5 className="ca-recs-title">
                                            <CheckCircle2 size={14} />
                                            Recommendations
                                        </h5>
                                        <ul className="ca-recs-list">
                                            {recommendations.map((rec, i) => (
                                                <li key={i}>{rec}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoverageAnalytics;
