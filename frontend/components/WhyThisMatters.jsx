import React from 'react';
import { Shield, Clock, ListChecks } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const WhyThisMatters = () => {
    const headerReveal = useScrollReveal({ threshold: 0.3 });
    const gridReveal = useScrollReveal({ threshold: 0.15 });

    return (
        <div id="why-this-matters" className="value-footer">
            <div className="container">
                <div
                    ref={headerReveal.ref}
                    className={`scroll-reveal-blur ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    <span className="section-label" style={{ color: '#fff', opacity: 1 }}>Decision Maker Value</span>
                    <h3 className="section-title-large" style={{ marginBottom: '1rem' }}>Why This Matters</h3>
                    <p style={{ color: 'var(--text-dim)', maxWidth: '600px', margin: '0 auto 3rem' }}>
                        Quality isn't just about bugs; it's about speed, clarity, and risk management.
                    </p>
                </div>

                <div
                    ref={gridReveal.ref}
                    className={`value-grid scroll-reveal-stagger ${gridReveal.isVisible ? 'revealed' : ''}`}
                >
                    <ValueItem
                        icon={<Shield size={24} />}
                        title="Reduce Production Risk"
                        description="Catch critical edge cases before they reach your users."
                    />
                    <ValueItem
                        icon={<Clock size={24} />}
                        title="Accelerate Sprints"
                        description="Reduce manual test design time by up to 80%."
                    />
                    <ValueItem
                        icon={<ListChecks size={24} />}
                        title="Improves Clarity"
                        description="Force requirement precision early in the SDLC."
                    />
                </div>
            </div>
        </div>
    );
};

const ValueItem = ({ icon, title, description }) => (
    <div className="value-item">
        <div className="value-icon-box">{icon}</div>
        <h4>{title}</h4>
        <p>{description}</p>
    </div>
);

export default WhyThisMatters;
