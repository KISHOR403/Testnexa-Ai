import React from 'react';

/**
 * Reusable SettingRow component:
 * - CSS Grid: minmax(0,1fr) minmax(260px,360px), column-gap 24px
 * - Stacks vertically on container sc (max-width: 640px) or when stacked={true}
 * - Label and hint on the left, control on the right
 * - Control vertically aligned to the label's first line box
 * - Min-width: 0 on text children to prevent text overflow
 */
export const SettingRow = ({
    label,
    hint,
    labelBadge,
    control,
    children,
    stacked = false,
    disabled = false,
    className = '',
    id
}) => {
    return (
        <div
            className={`tn-setting-row ${stacked ? 'is-stacked' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
        >
            <div className="tn-setting-row__info">
                {label && (
                    <div className="tn-setting-row__label-wrap">
                        <label htmlFor={id} className="tn-setting-row__label">
                            {label}
                        </label>
                        {labelBadge && (
                            <span className="tn-setting-row__label-badge">
                                {labelBadge}
                            </span>
                        )}
                    </div>
                )}
                {hint && <p className="tn-setting-row__hint">{hint}</p>}
            </div>
            <div className="tn-setting-row__control">
                {control || children}
            </div>
        </div>
    );
};

export default SettingRow;
