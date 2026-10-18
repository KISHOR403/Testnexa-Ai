import React from 'react';
import InlineTestSignal from './InlineTestSignal';
import PageDataSkeleton from './PageDataSkeleton';

/**
 * DataLoadingState
 * 
 * High-level layout-preserving data loading component for pages.
 * Displays a minimal inline status bar with an active Test Signal indicator,
 * accompanied by an engineering skeleton matching the view structure.
 */
export const DataLoadingState = ({
    message = 'Retrieving data…',
    telemetryTag = 'SYNCING',
    skeletonType = 'cards', // 'cards' | 'metrics-detail' | 'table'
    count = 3,
    className = ''
}) => {
    return (
        <div
            className={`tn-data-loading-wrapper ${className}`.trim()}
            role="status"
            aria-live="polite"
        >
            <div className="tn-data-loading-header">
                <div className="tn-data-loading-status">
                    <InlineTestSignal size={15} />
                    <span>{message}</span>
                </div>
                {telemetryTag && (
                    <span className="tn-data-loading-telemetry">
                        [{telemetryTag}]
                    </span>
                )}
            </div>

            <PageDataSkeleton type={skeletonType} count={count} />
        </div>
    );
};

export default DataLoadingState;
