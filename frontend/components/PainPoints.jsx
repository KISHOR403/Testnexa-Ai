import React from 'react';
import { Check, X } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const before = ['Missing edge cases & boundary bugs', 'Manual test creation takes days', 'Vague requirements lead to rework', 'Inconsistent coverage across QA engineers'];
const after = ['Complete multi-category coverage', 'Instant AI-generated test suites', 'Automated ambiguity detection', 'Risk-based priority ranking'];

const PainPoints = () => {
    const reveal = useScrollReveal({ threshold: 0.1 });

    return (
        <section id="problem-vs-solution" className="tn-pain" aria-labelledby="pain-heading">
            <div className="tn-container">
                <div
                    ref={reveal.ref}
                    className={`tn-pain__split scroll-reveal-fade-up ${reveal.isVisible ? 'revealed' : ''}`}
                >
                    {/* LEFT 45% */}
                    <div className="tn-pain__copy">
                        <span className="tn-section-kicker">Before and After</span>
                        <h2 id="pain-heading">QA planning should not depend on who happened to read the requirement first.</h2>
                        <p className="tn-pain__desc">
                            Manual test case design is subjective, slow, and full of blind spots.
                            Testnexa turns requirements into structured, high-coverage test suites with standardized quality criteria.
                        </p>
                    </div>

                    {/* RIGHT 55% */}
                    <div className="tn-compare">
                        <div className="tn-compare__side tn-compare__side--before">
                            <div className="tn-compare__side-header">
                                <span className="tn-compare__status-dot tn-compare__status-dot--red" />
                                <span>Without Testnexa</span>
                            </div>
                            <div className="tn-compare__list">
                                {before.map((item) => (
                                    <div className="tn-compare-row" key={item}>
                                        <div className="tn-compare-icon-wrap tn-compare-icon-wrap--cross">
                                            <X size={15} />
                                        </div>
                                        <p>{item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="tn-compare__divider">VS</div>

                        <div className="tn-compare__side tn-compare__side--after">
                            <div className="tn-compare__side-header">
                                <span className="tn-compare__status-dot tn-compare__status-dot--green" />
                                <span>With Testnexa AI</span>
                            </div>
                            <div className="tn-compare__list">
                                {after.map((item) => (
                                    <div className="tn-compare-row" key={item}>
                                        <div className="tn-compare-icon-wrap tn-compare-icon-wrap--check">
                                            <Check size={15} />
                                        </div>
                                        <p>{item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PainPoints;
