import React, { useState, useMemo } from 'react';
import { Calendar, Info } from 'lucide-react';

export const AuthoringActivityChart = ({
    activity = [],
    isLoading = false
}) => {
    const [hoveredPoint, setHoveredPoint] = useState(null);

    const width = 800;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 35, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const { maxTotal, points } = useMemo(() => {
        if (!activity || activity.length === 0) {
            return { maxTotal: 5, points: [] };
        }

        const maxVal = Math.max(
            4,
            ...activity.map(d => (d.suitesCreated || 0) + (d.casesApproved || 0))
        );

        const stepX = activity.length > 1
            ? chartWidth / (activity.length - 1)
            : chartWidth / 2;

        const pts = activity.map((d, i) => {
            const x = activity.length > 1
                ? padding.left + i * stepX
                : padding.left + chartWidth / 2;

            const suites = d.suitesCreated || 0;
            const cases = d.casesApproved || 0;
            const total = suites + cases;

            const suitesHeight = (suites / maxVal) * chartHeight;
            const casesHeight = (cases / maxVal) * chartHeight;
            const barWidth = Math.max(8, Math.min(20, (chartWidth / activity.length) * 0.6));

            return {
                ...d,
                x,
                suites,
                cases,
                total,
                suitesHeight,
                casesHeight,
                barWidth
            };
        });

        return { maxTotal: maxVal, points: pts };
    }, [activity, chartWidth, chartHeight, padding.left]);

    if (isLoading) {
        return (
            <div className="intel-chart-loading" style={{ height: `${height}px` }}>
                <div className="intel-skeleton intel-skeleton-chart" />
            </div>
        );
    }

    if (!activity || activity.length === 0) {
        return (
            <div className="intel-chart-empty" style={{ height: `${height}px` }}>
                <Calendar size={28} className="intel-empty-icon" />
                <p>No activity recorded in the past 30 days.</p>
            </div>
        );
    }

    return (
        <div className="intel-chart-container">
            <div className="intel-chart-header">
                <div className="intel-chart-legend">
                    <div className="intel-legend-item">
                        <span className="intel-legend-color intel-legend-suites" />
                        <span className="intel-legend-label">Suites Created</span>
                    </div>
                    <div className="intel-legend-item">
                        <span className="intel-legend-color intel-legend-approved" />
                        <span className="intel-legend-label">Cases Approved</span>
                    </div>
                </div>
            </div>

            <div className="intel-svg-wrapper">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="intel-activity-svg"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Horizontal Grid lines */}
                    {[0, 0.5, 1].map((ratio) => {
                        const y = padding.top + chartHeight * (1 - ratio);
                        const val = Math.round(maxTotal * ratio);
                        return (
                            <g key={ratio} className="intel-grid-line-group">
                                <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={width - padding.right}
                                    y2={y}
                                    stroke="rgba(255,255,255,0.08)"
                                    strokeDasharray="4 4"
                                />
                                <text
                                    x={padding.left - 8}
                                    y={y + 4}
                                    textAnchor="end"
                                    className="intel-axis-text"
                                    fill="rgba(255,255,255,0.4)"
                                    fontSize="11"
                                >
                                    {val}
                                </text>
                            </g>
                        );
                    })}

                    {/* Bars */}
                    {points.map((pt, idx) => {
                        const barX = pt.x - pt.barWidth / 2;
                        const baseY = padding.top + chartHeight;
                        const suitesY = baseY - pt.suitesHeight;
                        const casesY = suitesY - pt.casesHeight;

                        return (
                            <g
                                key={idx}
                                className="intel-bar-group"
                                onMouseEnter={() => setHoveredPoint(pt)}
                                onMouseLeave={() => setHoveredPoint(null)}
                            >
                                {/* Invisible hover target */}
                                <rect
                                    x={pt.x - (chartWidth / points.length) / 2}
                                    y={padding.top}
                                    width={chartWidth / points.length}
                                    height={chartHeight}
                                    fill="transparent"
                                />

                                {/* Cases Approved (Top segment) */}
                                {pt.cases > 0 && (
                                    <rect
                                        x={barX}
                                        y={casesY}
                                        width={pt.barWidth}
                                        height={pt.casesHeight}
                                        className="intel-bar-approved"
                                        rx="1"
                                    />
                                )}

                                {/* Suites Created (Bottom segment) */}
                                {pt.suites > 0 && (
                                    <rect
                                        x={barX}
                                        y={suitesY}
                                        width={pt.barWidth}
                                        height={pt.suitesHeight}
                                        className="intel-bar-suites"
                                        rx="1"
                                    />
                                )}

                                {/* Subtle column highlight on hover */}
                                {hoveredPoint === pt && (
                                    <line
                                        x1={pt.x}
                                        y1={padding.top}
                                        x2={pt.x}
                                        y2={baseY}
                                        stroke="rgba(255, 255, 255, 0.25)"
                                        strokeDasharray="2 2"
                                    />
                                )}
                            </g>
                        );
                    })}

                    {/* X-axis Date Labels (sample every 5 days) */}
                    {points.map((pt, idx) => {
                        if (idx % 6 !== 0 && idx !== points.length - 1) return null;
                        const dateLabel = pt.date ? pt.date.slice(5) : '';
                        return (
                            <text
                                key={`date-${idx}`}
                                x={pt.x}
                                y={height - 10}
                                textAnchor="middle"
                                className="intel-axis-text"
                                fill="rgba(255,255,255,0.4)"
                                fontSize="11"
                            >
                                {dateLabel}
                            </text>
                        );
                    })}
                </svg>

                {/* Floating Tooltip */}
                {hoveredPoint && (
                    <div
                        className="intel-chart-tooltip"
                        style={{
                            left: `${(hoveredPoint.x / width) * 100}%`,
                            top: `${padding.top}px`
                        }}
                    >
                        <div className="intel-tooltip-date">{hoveredPoint.date}</div>
                        <div className="intel-tooltip-row">
                            <span>Suites created:</span>
                            <strong>{hoveredPoint.suites}</strong>
                        </div>
                        <div className="intel-tooltip-row">
                            <span>Cases approved:</span>
                            <strong>{hoveredPoint.cases}</strong>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthoringActivityChart;
