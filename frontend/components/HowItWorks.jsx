import React, { useState } from 'react';
import { Search, AlertCircle, Cpu, BarChart3, Download } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const STEPS = [
    {
        number: '01',
        icon: Search,
        title: 'Requirement Reconstruction',
        description: 'The input is analyzed and broken down into atomic business rules and logical branches.',
        viz: [
            'Input: "User can reset password via email"',
            '→ Rule 1: User must have registered email',
            '→ Rule 2: Reset link must be time-limited',
            '→ Rule 3: Old password must be invalidated',
        ],
    },
    {
        number: '02',
        icon: AlertCircle,
        title: 'Ambiguity Detection',
        description: 'Identifies contradictory logic or missing information, generating clarification questions.',
        viz: [
            '⚠ What is the reset link expiry time?',
            '⚠ Can users reset with phone number?',
            '⚠ Password complexity requirements?',
        ],
    },
    {
        number: '03',
        icon: Cpu,
        title: 'Multi-Category Generation',
        description: 'Test cases are synthesized across Functional, Negative, Edge, and API categories simultaneously.',
        viz: [
            '✓ TC-001: Valid email reset flow',
            '✓ TC-002: Invalid email format',
            '✓ TC-003: Expired reset link',
            '✓ TC-004: SQL injection in email field',
        ],
    },
    {
        number: '04',
        icon: BarChart3,
        title: 'Risk-Based Prioritization',
        description: 'Each case is assigned High, Medium, or Low priority based on impact and complexity.',
        viz: [
            '🔴 High: Security validation (6 cases)',
            '🟡 Medium: Edge case handling (8 cases)',
            '🟢 Low: UI format checks (4 cases)',
        ],
    },
    {
        number: '05',
        icon: Download,
        title: 'Export & Traceability',
        description: 'Export structured test suites in multiple formats with full requirement traceability.',
        viz: [
            'Export: JSON · Markdown · CSV',
            'Trace: REQ-001 → TC-001, TC-002',
            'Coverage: 18/18 requirements mapped',
        ],
    },
];

const HowItWorks = () => {
    const [activeStep, setActiveStep] = useState(0);
    const headerReveal = useScrollReveal({ threshold: 0.2 });
    const timelineReveal = useScrollReveal({ threshold: 0.05 });

    return (
        <section id="engineering-maturity" className="tn-how" aria-labelledby="how-heading">
            <div className="container">
                <div
                    ref={headerReveal.ref}
                    className={`tn-section-header scroll-reveal-fade-up ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    <span className="tn-section-label">How It Works</span>
                    <h2 id="how-heading" className="tn-section-title">
                        How Testnexa AI Works
                    </h2>
                </div>

                <div
                    ref={timelineReveal.ref}
                    className={`tn-how__timeline-wrap scroll-reveal-fade-up ${timelineReveal.isVisible ? 'revealed' : ''}`}
                >
                    {/* Desktop horizontal timeline */}
                    <div className="tn-how__timeline" role="tablist" aria-label="Process steps">
                        {STEPS.map((step, i) => (
                            <button
                                key={i}
                                className={`tn-how__step ${i === activeStep ? 'tn-how__step--active' : ''}`}
                                onClick={() => setActiveStep(i)}
                                role="tab"
                                aria-selected={i === activeStep}
                                aria-controls={`step-panel-${i}`}
                            >
                                <span className="tn-how__step-number">{step.number}</span>
                                <span className="tn-how__step-title">{step.title}</span>
                            </button>
                        ))}
                        {/* Progress track */}
                        <div className="tn-how__track" aria-hidden="true">
                            <div
                                className="tn-how__track-fill"
                                style={{ width: `${(activeStep / (STEPS.length - 1)) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Active step detail panel */}
                    <div
                        className="tn-how__panel"
                        id={`step-panel-${activeStep}`}
                        role="tabpanel"
                        aria-labelledby={`step-${activeStep}`}
                    >
                        <div className="tn-how__panel-content">
                            <div className="tn-how__panel-icon" style={{ color: 'var(--tn-teal)' }}>
                                {React.createElement(STEPS[activeStep].icon, { size: 24 })}
                            </div>
                            <h3 className="tn-how__panel-title">{STEPS[activeStep].title}</h3>
                            <p className="tn-how__panel-desc">{STEPS[activeStep].description}</p>
                        </div>
                        <div className="tn-how__panel-viz">
                            {STEPS[activeStep].viz.map((line, j) => (
                                <div key={j} className="tn-how__viz-line">
                                    <code>{line}</code>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Mobile vertical timeline */}
                <div className="tn-how__mobile">
                    {STEPS.map((step, i) => (
                        <div key={i} className="tn-how__mobile-step">
                            <div className="tn-how__mobile-marker">
                                <span className="tn-how__mobile-number">{step.number}</span>
                                {i < STEPS.length - 1 && <div className="tn-how__mobile-line" />}
                            </div>
                            <div className="tn-how__mobile-content">
                                <h3>{step.title}</h3>
                                <p>{step.description}</p>
                                <div className="tn-how__mobile-viz">
                                    {step.viz.map((line, j) => (
                                        <code key={j}>{line}</code>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;
