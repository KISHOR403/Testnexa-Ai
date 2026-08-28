import React from 'react';
import { AlertTriangle, Brain, Download, Gauge, Layers3, ScanSearch } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const capabilities = [
    ['Ambiguity Detection', 'Flags missing expiry rules, unclear actors, conflicting acceptance criteria.'],
    ['Risk-Based Prioritization', 'Orders coverage by user impact, security sensitivity, and failure cost.'],
    ['Multi-Category Tests', 'Functional, negative, boundary, security, API, and regression paths in one suite.'],
    ['Multi-Format Export', 'Structured output for docs, backlog tickets, QA tools, and automation planning.'],
];

const Features = () => {
    const reveal = useScrollReveal({ threshold: 0.08 });

    return (
        <section id="features" className="tn-features" aria-labelledby="features-heading">
            <div className="tn-container">
                <div className="tn-section-header-split">
                    <div className="tn-section-header-split__left">
                        <span className="tn-section-kicker">Product Intelligence</span>
                        <h2 id="features-heading">Everything you need to transform requirements into complete test suites.</h2>
                    </div>
                    <div className="tn-section-header-split__right">
                        <p>Testnexa does not just format test cases. It reads the requirement, reconstructs intent, finds risk, and turns that understanding into actionable QA coverage.</p>
                    </div>
                </div>

                <div
                    ref={reveal.ref}
                    className={`tn-analysis-showcase scroll-reveal-fade-up ${reveal.isVisible ? 'revealed' : ''}`}
                >
                    <div className="tn-analysis-showcase__copy">
                        <div className="tn-feature-icon-badge">
                            <Brain size={28} />
                        </div>
                        <h3>AI Requirement Intelligence</h3>
                        <p>
                            A requirement becomes a working model of actors, conditions, expected behavior,
                            edge cases, and unresolved assumptions before the first test is written.
                        </p>
                    </div>

                    <div className="tn-requirement-map">
                        <div className="tn-map-source">
                            <span>Source Requirement</span>
                            <p>"Users can reset their password using their registered email."</p>
                        </div>
                        <div className="tn-map-grid">
                            <div><span>Intent</span><strong>Recover account access</strong></div>
                            <div><span>Actors</span><strong>Registered user, mail service</strong></div>
                            <div><span>Conditions</span><strong>Email exists, token valid</strong></div>
                            <div><span>Expected Behavior</span><strong>Secure reset link delivered</strong></div>
                            <div className="tn-map-wide"><span>Edge Cases</span><strong>Expired token, duplicate requests, invalid email, rate limits</strong></div>
                        </div>
                    </div>
                </div>

                <div className="tn-capability-strip">
                    {capabilities.map(([title, text], index) => {
                        const Icon = [AlertTriangle, Gauge, Layers3, Download][index];
                        return (
                            <div className="tn-capability-item" key={title}>
                                <div className="tn-capability-item__icon">
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <strong>{title}</strong>
                                    <span>{text}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="tn-asym-feature">
                    <div className="tn-feature-interface">
                        <div className="tn-feature-interface__bar">
                            <div className="tn-feature-interface__title">
                                <ScanSearch size={16} />
                                <span>Requirement Trace Graph</span>
                            </div>
                            <span className="tn-feature-interface__badge">Live Analysis</span>
                        </div>
                        <div className="tn-graph-pipeline">
                            <div className="tn-graph-node tn-graph-node--source">
                                <span className="tn-graph-node__tag">Input</span>
                                <strong>Registered email</strong>
                            </div>
                            <div className="tn-graph-node tn-graph-node--primary">
                                <span className="tn-graph-node__tag">Generated</span>
                                <strong>Reset link dispatched</strong>
                            </div>
                            <div className="tn-graph-node tn-graph-node--warn">
                                <span className="tn-graph-node__tag">Risk Flagged</span>
                                <strong>Expiry rule missing</strong>
                            </div>
                            <div className="tn-graph-node tn-graph-node--success">
                                <span className="tn-graph-node__tag">Verified</span>
                                <strong>Password updated & saved</strong>
                            </div>
                        </div>
                    </div>
                    <div className="tn-asym-feature__copy">
                        <span className="tn-section-kicker">Featured Capability</span>
                        <h3>Continuous Graph Traceability</h3>
                        <p>Testnexa turns vague product language into a precise testing surface, so QA teams can see what is known, what is risky, and what needs immediate clarification.</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Features;
