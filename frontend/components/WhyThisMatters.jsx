import React from 'react';
import { GitBranch, ListChecks, Route, TimerReset } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const values = [
    {
        icon: TimerReset,
        title: 'Faster test planning',
        text: 'Move from rough product language to a complete first-pass suite without starting from a blank page.'
    },
    {
        icon: ListChecks,
        title: 'Broader scenario coverage',
        text: 'Expose happy paths, negative paths, boundary cases, and security-sensitive flows together in one go.'
    },
    {
        icon: GitBranch,
        title: 'Clearer requirements',
        text: 'Show product and engineering where assumptions, gaps, and ambiguities still exist before coding starts.'
    },
    {
        icon: Route,
        title: 'Traceable test design',
        text: 'Keep every generated case connected to the source requirement and its inferred intent with audit logs.'
    },
];

const WhyThisMatters = () => {
    const reveal = useScrollReveal({ threshold: 0.1 });

    return (
        <section id="why-this-matters" className="tn-value" aria-labelledby="value-heading">
            <div className="tn-container">
                <div
                    ref={reveal.ref}
                    className={`tn-value__layout scroll-reveal-fade-up ${reveal.isVisible ? 'revealed' : ''}`}
                >
                    {/* LEFT COLUMN */}
                    <div className="tn-value__copy">
                        <span className="tn-section-kicker">Why It Matters</span>
                        <h2 id="value-heading">
                            Better requirements.<br />
                            Better tests.<br />
                            Less rework.
                        </h2>
                        <p className="tn-value__lead">
                            Defects caught during requirement analysis cost 10x less to fix than defects found in production.
                            Testnexa builds quality directly into the earliest phase of your SDLC.
                        </p>
                    </div>

                    {/* RIGHT COLUMN: 2x2 Clean Grid */}
                    <div className="tn-value__grid">
                        {values.map((item) => (
                            <div className="tn-value-item" key={item.title}>
                                <div className="tn-value-item__icon">
                                    <item.icon size={20} />
                                </div>
                                <strong>{item.title}</strong>
                                <p>{item.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WhyThisMatters;
