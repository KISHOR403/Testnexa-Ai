import React from 'react';

/**
 * PageDataSkeleton
 * 
 * Experience B: Layout-preserving content skeletons
 * Structured placeholders matching the exact card, table, and metric layouts
 * of TestNexa pages. Prevents layout shifts and flashing blank pages.
 */
export const PageDataSkeleton = ({
    type = 'cards', // 'cards' | 'metrics-detail' | 'table' | 'history'
    count = 3,
    className = ''
}) => {
    if (type === 'metrics-detail') {
        return (
            <div className={`tn-data-loading-wrapper ${className}`.trim()} aria-hidden="true">
                {/* 4 Metric Cards */}
                <div className="tn-skeleton-grid-metrics">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="tn-skeleton-metric-card">
                            <div className="tn-skeleton-line tn-skeleton-line--badge" />
                            <div className="tn-skeleton-line tn-skeleton-line--title" style={{ width: '60%' }} />
                        </div>
                    ))}
                </div>

                {/* Structured Content Card */}
                <div className="tn-skeleton-card" style={{ minHeight: '260px' }}>
                    <div className="tn-skeleton-row" style={{ justifyContent: 'space-between' }}>
                        <div className="tn-skeleton-line tn-skeleton-line--title" style={{ width: '35%' }} />
                        <div className="tn-skeleton-line tn-skeleton-line--badge" />
                    </div>
                    <div className="tn-skeleton-line tn-skeleton-line--sub" />
                    <div className="tn-skeleton-line tn-skeleton-line--sub" style={{ width: '55%' }} />
                    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {[1, 2, 3].map(j => (
                            <div key={j} className="tn-skeleton-row" style={{ gap: '0.85rem' }}>
                                <div className="tn-skeleton-line" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
                                <div className="tn-skeleton-line" style={{ flex: 1 }} />
                                <div className="tn-skeleton-line" style={{ width: '15%' }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'table') {
        return (
            <div className={`tn-data-loading-wrapper ${className}`.trim()} aria-hidden="true">
                <div className="tn-skeleton-table">
                    <div className="tn-skeleton-table-header">
                        <div className="tn-skeleton-line" style={{ width: '12%' }} />
                        <div className="tn-skeleton-line" style={{ width: '30%' }} />
                        <div className="tn-skeleton-line" style={{ width: '20%' }} />
                        <div className="tn-skeleton-line" style={{ width: '15%' }} />
                    </div>
                    {Array.from({ length: count }).map((_, i) => (
                        <div key={i} className="tn-skeleton-table-row">
                            <div className="tn-skeleton-line tn-skeleton-line--badge" style={{ width: '12%' }} />
                            <div className="tn-skeleton-line" style={{ width: '45%' }} />
                            <div className="tn-skeleton-line" style={{ width: '22%' }} />
                            <div className="tn-skeleton-line" style={{ width: '12%' }} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Default 'cards' / 'history'
    return (
        <div className={`tn-skeleton-list ${className}`.trim()} aria-hidden="true">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="tn-skeleton-card">
                    <div className="tn-skeleton-row" style={{ justifyContent: 'space-between' }}>
                        <div className="tn-skeleton-line tn-skeleton-line--title" />
                        <div className="tn-skeleton-line tn-skeleton-line--badge" />
                    </div>
                    <div className="tn-skeleton-line tn-skeleton-line--sub" />
                    <div className="tn-skeleton-row" style={{ marginTop: '0.25rem' }}>
                        <div className="tn-skeleton-line" style={{ width: '90px' }} />
                        <div className="tn-skeleton-line" style={{ width: '110px' }} />
                        <div className="tn-skeleton-line" style={{ width: '80px' }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PageDataSkeleton;
