import React, { useState } from 'react';
import { BarChart3, Download, FileText, SearchCheck, Cpu } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const workflow = [
    {
        title: 'Requirement',
        icon: FileText,
        panelTitle: 'Source Requirement Ingestion',
        lines: ['Raw user story parsed: "Password reset via registered email"', 'Actor profiles identified: Registered User, Email Service Provider', 'Core preconditions detected: Account active & verified'],
    },
    {
        title: 'Analysis',
        icon: SearchCheck,
        panelTitle: 'AI Requirement Intelligence',
        lines: ['Reconstructed intent: Secure identity recovery & credential refresh', 'Unresolved assumption flagged: Token expiration window undefined', 'Security boundaries highlighted: Enumeration protection & rate limits'],
    },
    {
        title: 'Generation',
        icon: Cpu,
        panelTitle: 'Multi-Category Test Generation',
        lines: ['8 Functional tests covering valid reset link delivery & token consumption', '5 Negative tests for unverified accounts, invalid tokens, and spoofing', '3 Boundary & 2 Security scenarios for token tampering & replay prevention'],
    },
    {
        title: 'Prioritization',
        icon: BarChart3,
        panelTitle: 'Risk-Based Queue & Scoring',
        lines: ['High Priority: Account takeover vectors & token replay vulnerabilities', 'Medium Priority: Expiration fallback handling & rate limit notifications', 'Low Priority: UI copy validation & input formatting helpers'],
    },
    {
        title: 'Export',
        icon: Download,
        panelTitle: 'Handoff & Tool Export',
        lines: ['Export as Markdown / Gherkin for Jira, Linear & Notion', 'Structured JSON payload for Playwright, Cypress & automated CI test runs', 'Traceability matrix linking every test case back to source requirements'],
    },
];

const HowItWorks = () => {
    const [active, setActive] = useState(1);
    const reveal = useScrollReveal({ threshold: 0.08 });
    const ActiveIcon = workflow[active].icon;

    return (
        <section id="engineering-maturity" className="tn-how" aria-labelledby="how-heading">
            <div className="tn-container">
                <div className="tn-section-header-center">
                    <span className="tn-section-kicker">How Testnexa Works</span>
                    <h2 id="how-heading">A complete QA workflow.</h2>
                    <p className="tn-section-subtitle">
                        Move systematically from raw specification to verified test suites with structured AI analysis at every step.
                    </p>
                </div>

                <div
                    ref={reveal.ref}
                    className={`tn-workflow scroll-reveal-fade-up ${reveal.isVisible ? 'revealed' : ''}`}
                >
                    <div className="tn-workflow__tabs" role="tablist" aria-label="Testnexa workflow">
                        {workflow.map((step, index) => (
                            <button
                                key={step.title}
                                className={`tn-workflow__tab-btn ${active === index ? 'is-active' : ''}`}
                                onClick={() => setActive(index)}
                                role="tab"
                                aria-selected={active === index}
                            >
                                <step.icon size={18} />
                                <span>{step.title}</span>
                            </button>
                        ))}
                    </div>

                    <div className="tn-workflow__panel" role="tabpanel">
                        <div className="tn-workflow__panel-copy">
                            <div className="tn-workflow__badge">
                                <ActiveIcon size={22} />
                                <span>Stage {active + 1} of 5</span>
                            </div>
                            <h3>{workflow[active].panelTitle}</h3>
                            <p className="tn-workflow__panel-desc">
                                Continuous context retention ensures every generated scenario is traceable to the source requirement.
                            </p>
                        </div>
                        <div className="tn-workflow__screen">
                            <div className="tn-workflow__screen-header">
                                <span className="tn-workflow__screen-dot" />
                                <span className="tn-workflow__screen-dot" />
                                <span className="tn-workflow__screen-dot" />
                                <span className="tn-workflow__screen-title">Live Pipeline Output</span>
                            </div>
                            {workflow[active].lines.map((line, index) => (
                                <div className="tn-workflow-line" key={line}>
                                    <span className="tn-workflow-line__num">{String(index + 1).padStart(2, '0')}</span>
                                    <p>{line}</p>
                                </div>
                            ))}
                            <div className="tn-workflow__progress">
                                <span style={{ width: `${(active + 1) * 20}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;
