import React from 'react';
import { Play } from 'lucide-react';
import { useFeature } from '../../config/features';
import { useComingSoon } from '../../context/ComingSoonContext';

/**
 * RunButton component with automatic feature flag handling.
 * When feature is disabled:
 * - Shows an outlined "Soon" badge beside label
 * - Sets aria-haspopup="dialog"
 * - Has accessible name "..., coming soon"
 * - Opens ComingSoonDialog on click without being grayed-out/disabled
 * When feature is enabled:
 * - Executes normal onClick / action
 */
const RunButton = ({
    label = 'Run',
    children,
    icon: IconComponent = Play,
    iconSize = 14,
    showIcon = true,
    className = '',
    style = {},
    onClick,
    feature = 'testRuns',
    showSoonTag = true,
    soonText = 'Soon',
    disabled = false,
    title,
    'aria-label': ariaLabelProp,
    ...rest
}) => {
    const { enabled } = useFeature(feature);
    const { open } = useComingSoon();

    const handleClick = (e) => {
        if (!enabled) {
            e.preventDefault();
            e.stopPropagation();
            open(feature);
            return;
        }

        if (disabled) {
            e.preventDefault();
            return;
        }

        if (typeof onClick === 'function') {
            onClick(e);
        }
    };

    const isFeatureDisabled = !enabled;
    const computedTitle = title || (isFeatureDisabled ? `${label}, coming soon` : label);
    const computedAriaLabel = ariaLabelProp || (isFeatureDisabled ? `${label}, coming soon` : label);

    return (
        <button
            type="button"
            className={`run-button ${className} ${isFeatureDisabled ? 'is-coming-soon' : ''}`}
            style={{
                cursor: disabled && !isFeatureDisabled ? 'not-allowed' : 'pointer',
                ...style
            }}
            onClick={handleClick}
            title={computedTitle}
            aria-label={computedAriaLabel}
            aria-haspopup={isFeatureDisabled ? 'dialog' : undefined}
            disabled={disabled && !isFeatureDisabled}
            {...rest}
        >
            {showIcon && IconComponent && (
                React.isValidElement(IconComponent) ? (
                    IconComponent
                ) : (
                    <IconComponent size={iconSize} aria-hidden="true" />
                )
            )}
            {children || (
                <span>{label}</span>
            )}
            {isFeatureDisabled && showSoonTag && (
                <span className="cs-tag-soon" aria-hidden="true">
                    {soonText}
                </span>
            )}
        </button>
    );
};

export default RunButton;
