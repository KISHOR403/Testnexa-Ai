import React from 'react';
import { ArrowRight, Brain, CheckCircle2, FileText, Gauge, Layers3 } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const steps = [
    { num: '01', icon: FileText, label: 'Raw Requirement', detail: 'User input & spec ingestion' },
    { num: '02', icon: Brain, label: 'AI Analysis', detail: 'Deconstructs intent, actors & gaps' },
    { num: '03', icon: Layers3, label: 'Scenario Generation', detail: 'Functional, negative & edge paths' },
    { num: '04', icon: Gauge, label: 'Risk Priority', detail: 'Impact scoring & security flags' },
    { num: '05', icon: CheckCircle2, label: 'Export & Handoff', detail: 'Executable suites & tickets' },
];

const ProductStory = () => {
    const reveal = useScrollReveal({ threshold: 0.08 });

    return (
        <section className="tn-story" aria-labelledby="story-heading">
            <div className="tn-container">
                <div className="tn-section-header-center">
                    <span className="tn-section-kicker">Requirement to Coverage</span>
                    <h2 id="story-heading">From Ambiguous Requirements to Complete Test Coverage.</h2>
                    <p className="tn-section-subtitle">How Testnexa parses, decomposes, and generates high-confidence test suites from a single specification.</p>
                </div>

                <div
                    ref={reveal.ref}
                    className={`tn-transform-pipeline scroll-reveal-fade-up ${reveal.isVisible ? 'revealed' : ''}`}
                >
                    {steps.map((step, index) => (
                        <div className="tn-pipeline-step" key={step.label}>
                            <div className="tn-pipeline-step__top">
                                <div className="tn-pipeline-step__icon">
                                    <step.icon size={20} />
                                </div>
                                <span className="tn-pipeline-step__num">{step.num}</span>
                            </div>
                            <div className="tn-pipeline-step__body">
                                <strong>{step.label}</strong>
                                <p>{step.detail}</p>
                            </div>
                            {index < steps.length - 1 && (
                                <div className="tn-pipeline-step__connector" aria-hidden="true">
                                    <ArrowRight size={16} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ProductStory;
