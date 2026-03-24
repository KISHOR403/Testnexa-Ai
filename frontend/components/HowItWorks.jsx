import React from 'react';
import { AlertCircle, Search, Cpu, BarChart3 } from 'lucide-react';

const HowItWorks = () => {
    return (
        <section id="engineering-maturity" className="insight-section">
            <div className="container">
                <span className="section-label">Engineering Maturity</span>
                <h3 className="section-title-large">How Testnexa AI Works</h3>

                <div className="steps-container">
                    <ProcessStep
                        number="1"
                        title="Requirement Deconstruction"
                        description="The input is analyzed and broken down into atomic business rules and logical branches."
                        icon={<Search size={18} />}
                    />
                    <ProcessStep
                        number="2"
                        title="Ambiguity Detection"
                        description="Our engine identifies contradictory logic or missing information, generating clarification questions."
                        icon={<AlertCircle size={18} />}
                    />
                    <ProcessStep
                        number="3"
                        title="Multi-Category Generation"
                        description="Test cases are synthesized across Functional, Negative, Edge, and API categories simultaneously."
                        icon={<Cpu size={18} />}
                    />
                    <ProcessStep
                        number="4"
                        title="Risk-Based Prioritization"
                        description="Each case is assigned a priority (High/Medium/Low) based on impact and complexity."
                        icon={<BarChart3 size={18} />}
                    />
                </div>
            </div>
        </section>
    );
};

const ProcessStep = ({ number, title, description, icon }) => (
    <div className="process-step">
        <div className="step-number">{number}</div>
        <div className="step-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--primary)' }}>{icon}</span>
                <h4>{title}</h4>
            </div>
            <p>{description}</p>
        </div>
    </div>
);

export default HowItWorks;
