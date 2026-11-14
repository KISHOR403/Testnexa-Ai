import React from 'react';

/**
 * Reusable SettingsSection component:
 * - Title and description header
 * - Children container with section-level layout
 */
export const SettingsSection = ({ title, description, badge, children, className = '' }) => {
    return (
        <section className={`tn-settings-section ${className}`}>
            <div className="tn-settings-section__header">
                <div className="tn-settings-section__title-row">
                    <h2 className="tn-settings-section__title">{title}</h2>
                    {badge && <span className="tn-settings-section__badge">{badge}</span>}
                </div>
                {description && <p className="tn-settings-section__desc">{description}</p>}
            </div>
            <div className="tn-settings-section__body">
                {children}
            </div>
        </section>
    );
};

export default SettingsSection;
