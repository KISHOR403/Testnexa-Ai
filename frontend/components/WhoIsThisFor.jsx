import React from 'react';
import { Users, Target, GraduationCap } from 'lucide-react';

const WhoIsThisFor = () => {
    const personas = [
        {
            icon: Target,
            role: 'SDETs',
            subtitle: 'Software Development Engineers in Test',
            value: 'Accelerate test design and automation planning',
            useCase: 'You receive a new feature requirement and need to quickly design comprehensive test coverage before writing automation scripts.',
            outcome: 'Get structured test cases with automation feasibility ratings, execution prerequisites, and API coverage analysis—saving hours of manual test design work.',
            color: 'teal'
        },
        {
            icon: Users,
            role: 'Product Managers',
            subtitle: 'Product & Business Analysts',
            value: 'Identify requirement gaps before development starts',
            useCase: 'You\'re finalizing a feature spec and want to ensure all edge cases and acceptance criteria are covered before handoff to engineering.',
            outcome: 'Receive clear visibility into missing acceptance criteria, business risk areas, and ambiguous requirements—reducing costly rework during UAT.',
            color: 'purple'
        },
        {
            icon: GraduationCap,
            role: 'QA Freshers',
            subtitle: 'Entry-Level QA Engineers',
            value: 'Learn testing fundamentals while building real test cases',
            useCase: 'You\'re assigned to test a feature but aren\'t sure where to start or what testing concepts to apply.',
            outcome: 'Get guided test cases with explanations of testing concepts (positive, negative, boundary testing) and clear priorities—accelerating your learning curve.',
            color: 'green'
        }
    ];

    return (
        <section id="who-is-this-for" className="who-section">
            <div className="container">
                <div className="section-header">
                    <h2 className="section-title">Who is this for?</h2>
                    <p className="section-subtitle">
                        Testnexa AI adapts to your role, delivering insights that matter to you
                    </p>
                </div>

                <div className="persona-grid">
                    {personas.map((persona, index) => (
                        <div
                            key={persona.role}
                            className="persona-card glass-card"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className={`persona-icon-box ${persona.color}`}>
                                <persona.icon size={28} />
                            </div>

                            <div className="persona-content">
                                <h3 className="persona-role">{persona.role}</h3>
                                <p className="persona-subtitle">{persona.subtitle}</p>

                                <div className="persona-value">
                                    <strong>{persona.value}</strong>
                                </div>

                                <div className="persona-details">
                                    <div className="persona-detail-item">
                                        <span className="detail-label">Typical use case:</span>
                                        <p className="detail-text">{persona.useCase}</p>
                                    </div>

                                    <div className="persona-detail-item">
                                        <span className="detail-label">Outcome:</span>
                                        <p className="detail-text outcome">{persona.outcome}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default WhoIsThisFor;
