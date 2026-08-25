import React from 'react';
import { X, Check } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const COMPARISONS = [
    {
        before: 'Missing edge cases',
        after: 'Complete scenario coverage',
    },
    {
        before: 'Ambiguous requirements',
        after: 'AI-detected ambiguity',
    },
    {
        before: 'Manual test creation',
        after: 'Prioritized test suites',
    },
];

const PainPoints = () => {
    const headerReveal = useScrollReveal({ threshold: 0.2 });
    const gridReveal = useScrollReveal({ threshold: 0.1 });

    return (
        <section id="problem-vs-solution" className="tn-pain" aria-labelledby="pain-heading">
            <div className="container">
                <div
                    ref={headerReveal.ref}
                    className={`tn-section-header scroll-reveal-fade-up ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    <span className="tn-section-label">Problem vs Solution</span>
                    <h2 id="pain-heading" className="tn-section-title">
                        QA Work Shouldn't Start<br />
                        With Guesswork.
                    </h2>
                </div>

                <div
                    ref={gridReveal.ref}
                    className={`tn-pain__grid scroll-reveal-stagger ${gridReveal.isVisible ? 'revealed' : ''}`}
                >
                    {COMPARISONS.map((comp, i) => (
                        <div key={i} className="tn-pain__block">
                            {/* Before */}
                            <div className="tn-pain__side tn-pain__side--before">
                                <span className="tn-pain__side-label">BEFORE</span>
                                <div className="tn-pain__item">
                                    <div className="tn-pain__icon tn-pain__icon--before">
                                        <X size={14} />
                                    </div>
                                    <span>{comp.before}</span>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="tn-pain__divider" aria-hidden="true">
                                <div className="tn-pain__divider-line" />
                                <div className="tn-pain__divider-dot" />
                                <div className="tn-pain__divider-line" />
                            </div>

                            {/* After */}
                            <div className="tn-pain__side tn-pain__side--after">
                                <span className="tn-pain__side-label tn-pain__side-label--after">AFTER TESTNEXA</span>
                                <div className="tn-pain__item">
                                    <div className="tn-pain__icon tn-pain__icon--after">
                                        <Check size={14} />
                                    </div>
                                    <span>{comp.after}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default PainPoints;
