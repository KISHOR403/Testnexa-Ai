import React from 'react';

export const TypographicStatement = ({ tag, text, hasConnector = true }) => {
    return (
        <section className="vt-statement-section" aria-label={text}>
            <div className="vt-container">
                {tag && <span className="vt-statement-tag">{tag}</span>}
                <h2 className="vt-statement-title">{text}</h2>
                {hasConnector && <div className="vt-statement-vertical-connector" aria-hidden="true" />}
            </div>
        </section>
    );
};

export default TypographicStatement;
