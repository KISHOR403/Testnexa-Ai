import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

export const FailureActivityChart = ({
    timeSeries = [],
    trajectory = 'stable',
    trajectoryDelta = 0,
    interval = 'daily',
    onIntervalChange,
    isLoading = false
}) => {
    const [hoveredPoint, setHoveredPoint] = useState(null);

    // Chart dimensions
    const width = 800;
    const height = 220;
    const padding = { top: 25, right: 30, bottom: 35, left: 45 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Derived max metrics
    const { maxFailures, maxRate, points } = useMemo(() => {
        if (!timeSeries || timeSeries.length === 0) {
            return { maxFailures: 10, maxRate: 100, points: [] };
        }

        const maxF = Math.max(5, ...timeSeries.map(d => d.failureCount || 0));
        const maxR = 100; // Failure rate is a percentage 0 - 100%

        const stepX = timeSeries.length > 1
            ? chartWidth / (timeSeries.length - 1)
            : chartWidth / 2;

        const pts = timeSeries.map((d, i) => {
            const x = timeSeries.length > 1
                ? padding.left + i * stepX
                : padding.left + chartWidth / 2;
            const yBar = padding.top + chartHeight - ((d.failureCount || 0) / maxF) * chartHeight;
            const yRate = padding.top + chartHeight - ((d.failureRate || 0) / maxR) * chartHeight;
            const barHeight = Math.max(0, padding.top + chartHeight - yBar);

            return {
                ...d,
                x,
                yBar,
                yRate,
                barHeight,
                barWidth: Math.max(12, Math.min(32, (chartWidth / timeSeries.length) * 0.45))
            };
        });

        return { maxFailures: maxF, maxRate: maxR, points: pts };
    }, [timeSeries, chartWidth, chartHeight, padding.left, padding.top]);

    // Generate SVG path for failure rate curve
    const ratePath = useMemo(() => {
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].yRate}`;

        return points.reduce((acc, curr, idx) => {
            if (idx === 0) return `M ${curr.x} ${curr.yRate}`;
            return `${acc} L ${curr.x} ${curr.yRate}`;
        }, '');
    }, [points]);

    // Area under rate path
    const rateAreaPath = useMemo(() => {
        if (points.length === 0) return '';
        const baseline = padding.top + chartHeight;
        return `${ratePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
    }, [ratePath, points, padding.top, chartHeight]);

    const renderTrajectoryBadge = () => {
        if (trajectory === 'increasing') {
            return (
                <span className="fta-trajectory-badge fta-trajectory-increasing" title="Failure rate has increased by >2% across recent runs">
                    <TrendingUp size={13} />
                    <span>Increasing Failure Rate (+{trajectoryDelta}%)</span>
                </span>
            );
        }
        if (trajectory === 'decreasing') {
            return (
                <span className="fta-trajectory-badge fta-trajectory-decreasing" title="Failure rate has decreased by >2% across recent runs">
                    <TrendingDown size={13} />
                    <span>Improving Trajectory ({trajectoryDelta}%)</span>
                </span>
            );
        }
        return (
            <span className="fta-trajectory-badge fta-trajectory-stable" title="Failure activity is steady across analyzed executions">
                <Minus size={13} />
                <span>Steady Failure Trajectory ({trajectoryDelta}%)</span>
            </span>
        );
    };

    if (isLoading) {
        return (
            <div className="fta-chart-card">
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--fta-text-muted)' }}>
                    Analyzing historical execution activity...
                </div>
            </div>
        );
    }

    if (!timeSeries || timeSeries.length === 0) {
        return (
            <div className="fta-chart-card">
                <div className="fta-empty-state">
                    <Info size={28} className="fta-empty-icon" />
                    <h3 className="fta-empty-title">No Completed Execution Data in Selected Range</h3>
                    <p className="fta-empty-desc">
                        No completed runs found matching the active date window and filters.
                        Execute a test run or expand your date range to view failure trends.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fta-chart-card">
            <div className="fta-chart-header">
                <div className="fta-chart-title-block">
                    <h3 className="fta-chart-title">Failure Activity & Trajectory</h3>
                    {renderTrajectoryBadge()}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="fta-chart-legend">
                        <div className="fta-legend-item">
                            <span className="fta-legend-color" style={{ background: 'var(--fta-fail)' }} />
                            <span>Failure Count (Bars)</span>
                        </div>
                        <div className="fta-legend-item">
                            <span className="fta-legend-color" style={{ background: 'var(--fta-jade)' }} />
                            <span>Failure Rate % (Line)</span>
                        </div>
                    </div>

                    <div className="fta-interval-toggle">
                        <button
                            type="button"
                            className={`fta-interval-btn ${interval === 'daily' ? 'active' : ''}`}
                            onClick={() => onIntervalChange && onIntervalChange('daily')}
                        >
                            Daily
                        </button>
                        <button
                            type="button"
                            className={`fta-interval-btn ${interval === 'weekly' ? 'active' : ''}`}
                            onClick={() => onIntervalChange && onIntervalChange('weekly')}
                        >
                            Weekly
                        </button>
                    </div>
                </div>
            </div>

            <div className="fta-chart-canvas-wrap">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="fta-chart-svg"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8BAF9A" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#8BAF9A" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                        const y = padding.top + chartHeight * (1 - pct);
                        const labelValue = Math.round(maxFailures * pct);
                        return (
                            <g key={idx}>
                                <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={padding.left + chartWidth}
                                    y2={y}
                                    stroke="var(--fta-border)"
                                    strokeDasharray="4 4"
                                    strokeWidth="1"
                                />
                                <text
                                    x={padding.left - 8}
                                    y={y + 3}
                                    textAnchor="end"
                                    fill="var(--fta-text-subtle)"
                                    fontSize="10"
                                    fontFamily="monospace"
                                >
                                    {labelValue}
                                </text>
                            </g>
                        );
                    })}

                    {/* Area under failure rate curve */}
                    {points.length > 1 && (
                        <path d={rateAreaPath} fill="url(#rateGradient)" />
                    )}

                    {/* Bars: Failure Counts */}
                    {points.map((pt, idx) => (
                        <rect
                            key={`bar-${idx}`}
                            x={pt.x - pt.barWidth / 2}
                            y={pt.yBar}
                            width={pt.barWidth}
                            height={pt.barHeight}
                            rx={3}
                            fill={hoveredPoint?.key === pt.key ? '#FF8A80' : 'var(--fta-fail)'}
                            opacity={hoveredPoint?.key === pt.key ? 1 : 0.82}
                            style={{ cursor: 'pointer', transition: 'fill 0.15s ease' }}
                            onMouseEnter={() => setHoveredPoint(pt)}
                            onMouseLeave={() => setHoveredPoint(null)}
                        />
                    ))}

                    {/* Line: Failure Rate Percentage */}
                    {points.length > 1 && (
                        <path
                            d={ratePath}
                            fill="none"
                            stroke="var(--fta-jade)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}

                    {/* Point circles for failure rate */}
                    {points.map((pt, idx) => (
                        <circle
                            key={`dot-${idx}`}
                            cx={pt.x}
                            cy={pt.yRate}
                            r={hoveredPoint?.key === pt.key ? 5 : 3}
                            fill="#080A09"
                            stroke="var(--fta-jade)"
                            strokeWidth="2"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredPoint(pt)}
                            onMouseLeave={() => setHoveredPoint(null)}
                        />
                    ))}

                    {/* X-axis labels */}
                    {points.map((pt, idx) => {
                        // Skip dense labels if there are many points
                        const shouldShow = points.length <= 12 || idx % Math.ceil(points.length / 10) === 0 || idx === points.length - 1;
                        if (!shouldShow) return null;

                        return (
                            <text
                                key={`x-${idx}`}
                                x={pt.x}
                                y={padding.top + chartHeight + 18}
                                textAnchor="middle"
                                fill="var(--fta-text-muted)"
                                fontSize="10"
                            >
                                {pt.label}
                            </text>
                        );
                    })}
                </svg>

                {/* Floating Tooltip */}
                {hoveredPoint && (
                    <div
                        className="fta-chart-tooltip"
                        style={{
                            left: `${(hoveredPoint.x / width) * 100}%`,
                            top: `${(hoveredPoint.yRate / height) * 100}%`
                        }}
                    >
                        <div className="fta-tooltip-title">{hoveredPoint.label}</div>
                        <div className="fta-tooltip-row">
                            <span>Failure Count:</span>
                            <strong style={{ color: 'var(--fta-fail)' }}>{hoveredPoint.failureCount}</strong>
                        </div>
                        <div className="fta-tooltip-row">
                            <span>Passed Cases:</span>
                            <strong style={{ color: 'var(--fta-pass)' }}>{hoveredPoint.passCount}</strong>
                        </div>
                        <div className="fta-tooltip-row">
                            <span>Total Executions:</span>
                            <strong>{hoveredPoint.totalExecutions}</strong>
                        </div>
                        <div className="fta-tooltip-row">
                            <span>Failure Rate:</span>
                            <strong style={{ color: 'var(--fta-jade)' }}>{hoveredPoint.failureRate}%</strong>
                        </div>
                        <div className="fta-tooltip-row">
                            <span>Completed Runs:</span>
                            <strong>{hoveredPoint.runsCount}</strong>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default FailureActivityChart;
