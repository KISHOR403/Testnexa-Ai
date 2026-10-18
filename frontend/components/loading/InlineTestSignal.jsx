import React from 'react';

/**
 * InlineTestSignal
 * 
 * Compact inline progress indicator for buttons, status badges, and table rows.
 * Replaces generic oversized spinners with a crisp, brand-aligned signal trace.
 */
export const InlineTestSignal = ({
    size = 14,
    label,
    className = '',
    style = {},
    color = '#8BAF9A'
}) => {
    return (
        <span
            className={`tn-inline-signal ${className}`.trim()}
            style={style}
            role="status"
            aria-label={label || 'Processing'}
        >
            <span
                className="tn-inline-signal-icon"
                style={{ width: `${size}px`, height: `${size}px` }}
                aria-hidden="true"
            >
                <svg viewBox="0 0 24 24">
                    {/* Background track */}
                    <circle
                        cx="12"
                        cy="12"
                        r="9"
                        className="tn-inline-signal-ring"
                    />
                    {/* Active moving signal arc */}
                    <circle
                        cx="12"
                        cy="12"
                        r="9"
                        className="tn-inline-signal-active"
                        style={{ stroke: color }}
                    />
                </svg>
            </span>
            {label && <span>{label}</span>}
        </span>
    );
};

export default InlineTestSignal;
