import React, { useState, useMemo } from 'react';
import { Calendar, BarChart2, Info } from 'lucide-react';

export const IntelligenceActivityChart = ({
    timeSeries = [],
    interval = 'daily',
    onIntervalChange,
    isLoading = false
}) => {
    const [hoveredPoint, setHoveredPoint] = useState(null);

    // Chart dimensions
    const width = 800;
    const height = 210;
    const padding = { top: 20, right: 25, bottom: 35, left: 45 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const { maxTotal, points } = useMemo(() => {
        if (!timeSeries || timeSeries.length === 0) {
            return { maxTotal: 10, points: [] };
        }

        const maxT = Math.max(5, ...timeSeries.map(d => (d.totalExecutions || (d.passCount + d.failureCount) || 1)));

        const stepX = timeSeries.length > 1
            ? chartWidth / (timeSeries.length - 1)
            : chartWidth / 2;

        const pts = timeSeries.map((d, i) => {
            const x = timeSeries.length > 1
                ? padding.left + i * stepX
                : padding.left + chartWidth / 2;

            const total = d.totalExecutions || (d.passCount + d.failureCount) || 0;
            const passes = d.passCount || 0;
            const failures = d.failureCount || 0;

            const passH = (passes / maxT) * chartHeight;
            const failH = (failures / maxT) * chartHeight;

            const barWidth = Math.max(12, Math.min(32, (chartWidth / timeSeries.length) * 0.45));

            return {
                ...d,
                x,
                total,
                passes,
                failures,
                passH,
                failH,
                barWidth
            };
        });

        return { maxTotal: maxT, points: pts };
    }, [timeSeries, chartWidth, chartHeight, padding.left, padding.top]);

    if (isLoading) {
        return (
            <div className="eid-chart-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--eid-text-muted)' }}>Loading activity data...</span>
            </div>
        );
    }

    if (!timeSeries || timeSeries.length === 0) {
        return (
            <div className="eid-chart-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--eid-text-subtle)' }}>No completed execution data in selected timeframe.</span>
            </div>
        );
    }

    return (
        <div className="eid-chart-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="eid-chart-legend">
                    <div className="eid-legend-item">
                        <div className="eid-legend-dot" style={{ background: 'var(--eid-pass)' }} />
                        <span>Passed Cases</span>
                    </div>
                    <div className="eid-legend-item">
                        <div className="eid-legend-dot" style={{ background: 'var(--eid-fail)' }} />
                        <span>Failed Cases</span>
                    </div>
                </div>

                <div className="eid-preset-tabs">
                    <button
                        type="button"
                        className={`eid-preset-btn ${interval === 'daily' ? 'active' : ''}`}
                        onClick={() => onIntervalChange && onIntervalChange('daily')}
                    >
                        Daily
                    </button>
                    <button
                        type="button"
                        className={`eid-preset-btn ${interval === 'weekly' ? 'active' : ''}`}
                        onClick={() => onIntervalChange && onIntervalChange('weekly')}
                    >
                        Weekly
                    </button>
                </div>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="eid-chart-svg">
                {/* Background grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = padding.top + chartHeight * (1 - pct);
                    const labelVal = Math.round(maxTotal * pct);
                    return (
                        <g key={idx}>
                            <line
                                x1={padding.left}
                                y1={y}
                                x2={padding.left + chartWidth}
                                y2={y}
                                stroke="var(--eid-border)"
                                strokeDasharray={pct === 0 ? 'none' : '3 3'}
                            />
                            <text
                                x={padding.left - 8}
                                y={y + 3}
                                textAnchor="end"
                                fontSize="9"
                                fill="var(--eid-text-subtle)"
                            >
                                {labelVal}
                            </text>
                        </g>
                    );
                })}

                {/* Bars for passes & failures */}
                {points.map((pt, idx) => {
                    const x = pt.x - pt.barWidth / 2;
                    const baseline = padding.top + chartHeight;
                    const failY = baseline - pt.failH;
                    const passY = failY - pt.passH;

                    return (
                        <g
                            key={idx}
                            className="eid-chart-bar-group"
                            onMouseEnter={() => setHoveredPoint(pt)}
                            onMouseLeave={() => setHoveredPoint(null)}
                        >
                            {/* Failure bar segment (bottom) */}
                            {pt.failH > 0 && (
                                <rect
                                    x={x}
                                    y={failY}
                                    width={pt.barWidth}
                                    height={pt.failH}
                                    fill="var(--eid-fail)"
                                    rx={pt.passH === 0 ? 3 : 0}
                                />
                            )}
                            {/* Pass bar segment (stacked above failures) */}
                            {pt.passH > 0 && (
                                <rect
                                    x={x}
                                    y={passY}
                                    width={pt.barWidth}
                                    height={pt.passH}
                                    fill="var(--eid-pass)"
                                    rx={3}
                                />
                            )}

                            {/* X-axis label */}
                            <text
                                x={pt.x}
                                y={baseline + 16}
                                textAnchor="middle"
                                fontSize="9"
                                fill="var(--eid-text-subtle)"
                            >
                                {pt.label || pt.date?.slice(5)}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {hoveredPoint && (
                <div className="eid-chart-tooltip" style={{ alignSelf: 'flex-start' }}>
                    <strong>{hoveredPoint.label || hoveredPoint.date}</strong>: {hoveredPoint.runsCount || 1} run(s), {hoveredPoint.total} cases executed ({hoveredPoint.passes} passed, {hoveredPoint.failures} failed)
                </div>
            )}
        </div>
    );
};

export default IntelligenceActivityChart;
