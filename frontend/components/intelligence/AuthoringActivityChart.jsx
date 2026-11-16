   import React, { useState, useMemo } from 'react';
import { Calendar, Table, Check } from 'lucide-react';

const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    try {
        const parts = String(dateStr).split('-');
        if (parts.length === 3) {
            const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        }
    } catch {
        // fallback
    }
    return dateStr;
};

export const AuthoringActivityChart = ({
    activity = [],
    isLoading = false,
    days = 30
}) => {
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [showTable, setShowTable] = useState(false);

    const width = 800;
    const height = 220;
    const padding = { top: 24, right: 24, bottom: 40, left: 44 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const totalApproved = useMemo(() => {
        return activity.reduce((sum, d) => sum + (d.casesApproved || 0), 0);
    }, [activity]);

    const totalSuitesCreated = useMemo(() => {
        return activity.reduce((sum, d) => sum + (d.suitesCreated || 0), 0);
    }, [activity]);

    const hasAnyActivity = useMemo(() => {
        return totalApproved > 0 || totalSuitesCreated > 0;
    }, [totalApproved, totalSuitesCreated]);

    const { maxVal, yTicks, points, xTickIndices } = useMemo(() => {
        if (!activity || activity.length === 0) {
            return { maxVal: 5, yTicks: [0, 1, 2, 3, 4, 5], points: [], xTickIndices: new Set() };
        }

        const rawMax = Math.max(
            0,
            ...activity.map(d => Math.max(d.suitesCreated || 0, d.casesApproved || 0))
        );

        let maxLimit = 5;
        let ticks = [0, 1, 2, 3, 4, 5];

        if (rawMax === 0) {
            maxLimit = 5;
            ticks = [0, 1, 2, 3, 4, 5];
        } else if (rawMax <= 5) {
            maxLimit = 5;
            ticks = [0, 1, 2, 3, 4, 5];
        } else if (rawMax <= 10) {
            maxLimit = 10;
            ticks = [0, 2, 4, 6, 8, 10];
        } else if (rawMax <= 20) {
            maxLimit = 20;
            ticks = [0, 5, 10, 15, 20];
        } else {
            const step = Math.ceil(rawMax / 4 / 5) * 5;
            maxLimit = step * 4;
            ticks = [0, step, step * 2, step * 3, step * 4];
        }

        const stepX = activity.length > 1
            ? chartWidth / (activity.length - 1)
            : chartWidth / 2;

        const pts = activity.map((d, i) => {
            const x = activity.length > 1
                ? padding.left + i * stepX
                : padding.left + chartWidth / 2;

            const suites = d.suitesCreated || 0;
            const cases = d.casesApproved || 0;

            const suitesHeight = (suites / maxLimit) * chartHeight;
            const casesHeight = (cases / maxLimit) * chartHeight;
            const groupWidth = Math.max(8, Math.min(24, (chartWidth / activity.length) * 0.7));
            const singleBarWidth = Math.max(3, (groupWidth - 2) / 2);

            return {
                ...d,
                x,
                suites,
                cases,
                suitesHeight,
                casesHeight,
                groupWidth,
                singleBarWidth
            };
        });

        // Determine up to 7 evenly spaced X-axis labels
        const tickSet = new Set();
        const totalItems = pts.length;
        if (totalItems <= 7) {
            pts.forEach((_, idx) => tickSet.add(idx));
        } else {
            const numTicks = 7;
            for (let i = 0; i < numTicks; i++) {
                const idx = Math.round((i / (numTicks - 1)) * (totalItems - 1));
                tickSet.add(idx);
            }
        }

        return { maxVal: maxLimit, yTicks: ticks, points: pts, xTickIndices: tickSet };
    }, [activity, chartWidth, chartHeight, padding.left]);

    if (isLoading) {
        return (
            <div className="intel-chart-loading" style={{ height: `${height + 40}px` }}>
                <div className="intel-skeleton intel-skeleton-chart" />
            </div>
        );
    }

    return (
        <div className="intel-chart-container">
            {/* Summary Line & Controls */}
            <div className="intel-chart-header">
                <div className="intel-chart-summary">
                    <span className="intel-chart-summary-text">
                        {totalApproved} case{totalApproved === 1 ? '' : 's'} approved in the last {days} days
                    </span>
                </div>

                <div className="intel-chart-controls">
                    {/* Legend */}
                    <div className="intel-chart-legend">
                        <div className="intel-legend-item">
                            <span className="intel-legend-color intel-legend-suites" />
                            <span className="intel-legend-label">Suites created</span>
                        </div>
                        <div className="intel-legend-item">
                            <span className="intel-legend-color intel-legend-approved" />
                            <span className="intel-legend-label">Cases approved</span>
                        </div>
                    </div>

                    {/* Table Toggle Button */}
                    <button
                        type="button"
                        className={`intel-table-toggle-btn ${showTable ? 'active' : ''}`}
                        onClick={() => setShowTable(prev => !prev)}
                        aria-expanded={showTable}
                        title={showTable ? "Hide data table" : "Show data table"}
                    >
                        <Table size={13} />
                        <span>{showTable ? "Hide table" : "Show data table"}</span>
                    </button>
                </div>
            </div>

            {/* Empty State Banner if no activity */}
            {!hasAnyActivity && (
                <div className="intel-chart-empty-notice">
                    <Calendar size={14} />
                    <span>No activity in this period.</span>
                </div>
            )}

            {/* SVG Visual Chart */}
            <div className="intel-svg-wrapper">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="intel-activity-svg"
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label={`Authoring activity chart showing suites created and cases approved over the last ${days} days`}
                >
                    <defs>
                        {/* Monochrome Hatched Pattern for Cases Approved */}
                        <pattern
                            id="hatched-approved-pattern"
                            width="6"
                            height="6"
                            patternTransform="rotate(45 0 0)"
                            patternUnits="userSpaceOnUse"
                        >
                            <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="6"
                                stroke="rgba(255, 255, 255, 0.72)"
                                strokeWidth="1.5"
                            />
                        </pattern>
                    </defs>

                    {/* Horizontal Grid lines and Y-axis Ticks */}
                    {yTicks.map((val) => {
                        const ratio = maxVal > 0 ? val / maxVal : 0;
                        const y = padding.top + chartHeight * (1 - ratio);
                        return (
                            <g key={val} className="intel-grid-line-group">
                                <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={width - padding.right}
                                    y2={y}
                                    stroke="rgba(255, 255, 255, 0.08)"
                                    strokeDasharray="3 3"
                                />
                                <text
                                    x={padding.left - 10}
                                    y={y + 4}
                                    textAnchor="end"
                                    className="intel-axis-text"
                                    fill="rgba(255, 255, 255, 0.56)"
                                    fontSize="12"
                                >
                                    {val}
                                </text>
                            </g>
                        );
                    })}

                    {/* Grouped Bars */}
                    {points.map((pt, idx) => {
                        const baseY = padding.top + chartHeight;
                        const barW = pt.singleBarWidth;
                        const suitesX = pt.x - pt.groupWidth / 2;
                        const casesX = suitesX + barW + 2;
                        const suitesY = baseY - pt.suitesHeight;
                        const casesY = baseY - pt.casesHeight;
                        const dateFormatted = formatDateLabel(pt.date);

                        return (
                            <g
                                key={pt.date || idx}
                                className="intel-bar-group"
                                onMouseEnter={() => setHoveredPoint(pt)}
                                onMouseLeave={() => setHoveredPoint(null)}
                                onFocus={() => setHoveredPoint(pt)}
                                onBlur={() => setHoveredPoint(null)}
                                tabIndex={0}
                                role="graphics-symbol"
                                aria-label={`${dateFormatted}: ${pt.suites} suites created, ${pt.cases} cases approved`}
                            >
                                {/* Invisible focus/hover column target */}
                                <rect
                                    x={pt.x - (chartWidth / points.length) / 2}
                                    y={padding.top}
                                    width={chartWidth / points.length}
                                    height={chartHeight}
                                    fill="transparent"
                                />

                                {/* Bar 1: Suites Created (Solid White Fill) */}
                                {pt.suites > 0 && (
                                    <rect
                                        x={suitesX}
                                        y={suitesY}
                                        width={barW}
                                        height={pt.suitesHeight}
                                        fill="#FFFFFF"
                                        rx="1"
                                    />
                                )}

                                {/* Bar 2: Cases Approved (Hatched Monochrome Pattern) */}
                                {pt.cases > 0 && (
                                    <rect
                                        x={casesX}
                                        y={casesY}
                                        width={barW}
                                        height={pt.casesHeight}
                                        fill="url(#hatched-approved-pattern)"
                                        stroke="rgba(255, 255, 255, 0.72)"
                                        strokeWidth="1"
                                        rx="1"
                                    />
                                )}

                                {/* Subtle vertical highlight on active column */}
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

                    {/* X-axis Date Labels (up to 7 formatted labels) */}
                    {points.map((pt, idx) => {
                        if (!xTickIndices.has(idx)) return null;
                        const labelText = formatDateLabel(pt.date);

                        return (
                            <text
                                key={`date-${idx}`}
                                x={pt.x}
                                y={height - 12}
                                textAnchor="middle"
                                className="intel-axis-text"
                                fill="rgba(255, 255, 255, 0.56)"
                                fontSize="12"
                            >
                                {labelText}
                            </text>
                        );
                    })}
                </svg>

                {/* Floating Tooltip */}
                {hoveredPoint && (
                    <div
                        className="intel-chart-tooltip"
                        style={{
                            left: `${Math.min(90, Math.max(10, (hoveredPoint.x / width) * 100))}%`,
                            top: `${padding.top}px`
                        }}
                        role="tooltip"
                    >
                        <div className="intel-tooltip-date">{formatDateLabel(hoveredPoint.date)}</div>
                        <div className="intel-tooltip-row">
                            <span className="intel-tooltip-indicator intel-legend-suites" />
                            <span>Suites created:</span>
                            <strong className="intel-tooltip-num">{hoveredPoint.suites}</strong>
                        </div>
                        <div className="intel-tooltip-row">
                            <span className="intel-tooltip-indicator intel-legend-approved" />
                            <span>Cases approved:</span>
                            <strong className="intel-tooltip-num">{hoveredPoint.cases}</strong>
                        </div>
                    </div>
                )}
            </div>

            {/* Accessible Data Table (Toggleable) */}
            {showTable && (
                <div className="intel-accessible-table-container">
                    <table className="intel-accessible-table" role="table" aria-label="Authoring activity table data">
                        <thead>
                            <tr>
                                <th scope="col">Date</th>
                                <th scope="col" style={{ textAlign: 'right' }}>Suites Created</th>
                                <th scope="col" style={{ textAlign: 'right' }}>Cases Approved</th>
                            </tr>
                        </thead>
                        <tbody>
                            {points.map((pt) => (
                                <tr key={pt.date}>
                                    <td>{formatDateLabel(pt.date)} ({pt.date})</td>
                                    <td style={{ textAlign: 'right' }}>{pt.suites}</td>
                                    <td style={{ textAlign: 'right' }}>{pt.cases}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">Total ({days}D)</th>
                                <td style={{ textAlign: 'right' }}>{totalSuitesCreated}</td>
                                <td style={{ textAlign: 'right' }}>{totalApproved}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AuthoringActivityChart;
