import React from 'react';
import {
    AlertCircle, CheckCircle2, ChevronRight,
    MousePointer2, Users, BarChart3, Shield,
    Clock, Search, Cpu, ListChecks
} from 'lucide-react';

const IndustryInsights = () => {
    return (
        <div className="industry-insights-wrapper">
            <div className="sections-divider" />

            {/* 1. QA Pain Points Section */}
            <section className="insight-section">
                <span className="section-label">Problem vs Solution</span>
                <h3 className="section-title-large">Real QA Pain Points, Solved.</h3>

                <div className="pain-grid">
                    <PainCard
                        problem="Missing edge cases in fast sprints"
                        solution="Generates functional, negative, edge & API tests"
                        description="AI analysis ensures boundary conditions are never overlooked even under tight deadlines."
                    />
                    <PainCard
                        problem="Ambiguous requirements from product"
                        solution="Auto-detects ambiguity and asks clarifications"
                        description="Testnexa AI identifies missing logic early, saving hours of developer back-and-forth."
                    />
                    <PainCard
                        problem="Manual test case writing takes hours"
                        solution="Outputs clean, reusable test cases instantly"
                        description="Shift your focus from writing to executing and optimizing your test strategy."
                    />
                </div>
            </section>

            {/* 2. Technical Transparency Section */}
            <section className="insight-section">
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
            </section>

            {/* 3. Use Cases / Audience Section */}
            <section className="insight-section">
                <span className="section-label">Target Audience</span>
                <h3 className="section-title-large">Who is this for?</h3>

                <div className="audience-grid">
                    <AudienceCard
                        title="QA Engineers"
                        description="Faster test design & strategy"
                    />
                    <AudienceCard
                        title="SDETs"
                        description="Better automation planning"
                    />
                    <AudienceCard
                        title="Product Managers"
                        description="Requirement validation"
                    />
                    <AudienceCard
                        title="Freshers"
                        description="Learn real testing patterns"
                    />
                </div>
            </section>

            {/* 4. Management Value Footer */}
            <div className="value-footer">
                <span className="section-label" style={{ color: '#fff', opacity: 1 }}>Decision Maker Value</span>
                <h3 className="section-title-large" style={{ marginBottom: '1rem' }}>Why This Matters</h3>
                <p style={{ color: 'var(--text-dim)', maxWidth: '600px', margin: '0 auto' }}>
                    Quality isn't just about bugs; it's about speed, clarity, and risk management.
                </p>

                <div className="value-grid">
                    <ValueItem
                        icon={<Shield size={24} />}
                        title="Reduce Production Risk"
                        description="Catch critical edge cases before they reach your users."
                    />
                    <ValueItem
                        icon={<Clock size={24} />}
                        title="Accelerate Sprints"
                        description="Reduce manual test design time by up to 80%."
                    />
                    <ValueItem
                        icon={<ListChecks size={24} />}
                        title="Improves Clarity"
                        description="Force requirement precision early in the SDLC."
                    />
                </div>
            </div>
        </div>
    );
};

const PainCard = ({ problem, solution, description }) => (
    <div className="pain-card">
        <div className="pain-header">
            <div className="pain-point">
                <AlertCircle size={16} />
                <span>Problem: {problem}</span>
            </div>
            <div className="solution-point">
                <CheckCircle2 size={16} />
                <span>Solution: {solution}</span>
            </div>
        </div>
        <div className="pain-divider" />
        <p className="pain-description">{description}</p>
    </div>
);

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

const AudienceCard = ({ title, description }) => (
    <div className="audience-card">
        <strong>{title}</strong>
        <span>{description}</span>
    </div>
);

const ValueItem = ({ icon, title, description }) => (
    <div className="value-item">
        <div className="value-icon-box">{icon}</div>
        <h4>{title}</h4>
        <p>{description}</p>
    </div>
);

export default IndustryInsights;
