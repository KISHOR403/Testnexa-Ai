import React from 'react';
import { FileText, Search, Cpu, BarChart3, Download } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const PIPELINE_STEPS = [
    {
        icon: FileText,
        label: 'RAW REQUIREMENT',
        content: '"Users can reset their password using registered email"',
        color: 'var(--tn-text-dim)',
    },
    {
        icon: Search,
        label: 'AI ANALYSIS',
        content: '3 business rules · 2 implicit assumptions · 1 ambiguity detected',
        color: 'var(--tn-teal)',
    },
    {
        icon: Cpu,
        label: 'TEST GENERATION',
        content: 'Functional (6) · Negative (5) · Boundary (4) · Security (3)',
        color: 'var(--tn-blue)',
    },
    {
        icon: BarChart3,
        label: 'PRIORITIZATION',
        content: (
            <span className="tn-story__priority-badges">
                <span className="tn-story__badge tn-story__badge--high">High × 6</span>
                <span className="tn-story__badge tn-story__badge--medium">Medium × 8</span>
                <span className="tn-story__badge tn-story__badge--low">Low × 4</span>
            </span>
        ),
        color: 'var(--tn-amber)',
    },
    {
        icon: Download,
        label: 'EXPORT',
        content: (
            <span className="tn-story__export-formats">
                <span>JSON</span>
                <span>Markdown</span>
                <span>CSV</span>
            </span>
        ),
        color: 'var(--tn-violet)',
    },
];

const ProductStory = () => {
    const headerReveal = useScrollReveal({ threshold: 0.2 });
    const pipelineReveal = useScrollReveal({ threshold: 0.05 });

    return (
        <section className="tn-story" aria-labelledby="story-heading">
            <div className="container">
                <div
                    ref={headerReveal.ref}
                    className={`tn-section-header scroll-reveal-fade-up ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    <span className="tn-section-label">Product Story</span>
                    <h2 id="story-heading" className="tn-section-title">
                        From Ambiguous Requirements<br />
                        to Complete Test Coverage.
                    </h2>
                </div>

                <div
                    ref={pipelineReveal.ref}
                    className={`tn-story__pipeline scroll-reveal-fade-up ${pipelineReveal.isVisible ? 'revealed' : ''}`}
                >
                    {PIPELINE_STEPS.map((step, i) => (
                        <React.Fragment key={i}>
                            <div className="tn-story__step" style={{ '--step-color': step.color }}>
                                <div className="tn-story__step-icon">
                                    <step.icon size={20} />
                                </div>
                                <span className="tn-story__step-label">{step.label}</span>
                                <div className="tn-story__step-content">
                                    {typeof step.content === 'string' ? (
                                        <p>{step.content}</p>
                                    ) : step.content}
                                </div>
                            </div>
                            {i < PIPELINE_STEPS.length - 1 && (
                                <div className="tn-story__connector" aria-hidden="true">
                                    <div className="tn-story__connector-line" />
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6H10M10 6L7 3M10 6L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ProductStory;
