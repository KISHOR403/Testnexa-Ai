import React, { useEffect, useRef, useState } from 'react';
import {
    AlertCircle, CheckCircle2, ChevronRight,
    MousePointer2, Users, BarChart3, Shield,
    Clock, Search, Cpu, ListChecks, Zap, ShieldAlert, Timer, Sparkles,
    Target, GraduationCap
} from 'lucide-react';

const IndustryInsights = () => {
    return (
        <div className="industry-insights-wrapper">
            <div className="sections-divider" />

            {/* 1. QA Pain Points Section */}
            <section className="insight-section pain-section-2026">
                <div className="pain-section-header">
                    <span className="pain-badge-label">
                        <Sparkles size={12} />
                        Problem vs Solution
                    </span>
                    <h3 className="pain-title-2026">
                        Real QA Pain Points, <span className="title-gradient-accent">Solved.</span>
                    </h3>
                    <p className="pain-subtitle-2026">
                        Every challenge your QA team faces — we've engineered a solution for it.
                    </p>
                </div>

                <div className="pain-grid-2026">
                    <PainCard2026
                        index={0}
                        icon={<ShieldAlert size={22} />}
                        problem="Missing edge cases in fast sprints"
                        solution="Generates functional, negative, edge & API tests"
                        description="AI analysis ensures boundary conditions are never overlooked even under tight deadlines."
                        accentColor="239, 68, 68"
                        solveColor="0, 212, 193"
                        tag="Coverage"
                    />
                    <PainCard2026
                        index={1}
                        icon={<AlertCircle size={22} />}
                        problem="Ambiguous requirements from product"
                        solution="Auto-detects ambiguity and asks clarifications"
                        description="Testnexa AI identifies missing logic early, saving hours of developer back-and-forth."
                        accentColor="251, 146, 60"
                        solveColor="99, 102, 241"
                        tag="Clarity"
                    />
                    <PainCard2026
                        index={2}
                        icon={<Timer size={22} />}
                        problem="Manual test case writing takes hours"
                        solution="Outputs clean, reusable test cases instantly"
                        description="Shift your focus from writing to executing and optimizing your test strategy."
                        accentColor="168, 85, 247"
                        solveColor="34, 211, 238"
                        tag="Speed"
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
                <h3 className="section-title-large">Who is this <span className="title-gradient-accent">for?</span></h3>
                <p className="pain-subtitle-2026" style={{ marginBottom: "3rem" }}>
                    Testnexa AI adapts to your role, delivering insights that matter to you
                </p>

                <div className="audience-grid-2026">
                    <AudienceCard2026
                        icon={<Target size={20} />}
                        iconColor="var(--primary)"
                        iconBg="rgba(0, 212, 193, 0.1)"
                        title="SDETs"
                        subtitle="Software Development Engineers in Test"
                        highlightText="Accelerate test design and automation planning"
                        useCase="You receive a new feature requirement and need to quickly design comprehensive test coverage before writing automation scripts."
                        outcome="Get structured test cases with automation feasibility ratings, execution prerequisites, and API coverage analysis—saving hours of manual test design work."
                    />
                    <AudienceCard2026
                        icon={<Users size={20} />}
                        iconColor="#a855f7"
                        iconBg="rgba(168, 85, 247, 0.1)"
                        title="Product Managers"
                        subtitle="Product & Business Analysts"
                        highlightText="Identify requirement gaps before development starts"
                        useCase="You're finalizing a feature spec and want to ensure all edge cases and acceptance criteria are covered before handoff to engineering."
                        outcome="Receive clear visibility into missing acceptance criteria, business risk areas, and ambiguous requirements—reducing costly rework during UAT."
                    />
                    <AudienceCard2026
                        icon={<GraduationCap size={20} />} 
                        iconColor="#10b981"
                        iconBg="rgba(16, 185, 129, 0.1)"
                        title="QA Freshers"
                        subtitle="Entry-Level QA Engineers"
                        highlightText="Learn testing fundamentals while building real test cases"
                        useCase="You're assigned to test a feature but aren't sure where to start or what testing concepts to apply."
                        outcome="Get guided test cases with explanations of testing concepts (positive, negative, boundary testing) and clear priorities—accelerating your learning curve."
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

const PainCard2026 = ({ index, icon, problem, solution, description, accentColor, solveColor, tag }) => {
    const cardRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => setIsVisible(true), index * 150);
                }
            },
            { threshold: 0.2 }
        );
        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, [index]);

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    return (
        <div
            ref={cardRef}
            className={`pain-card-2026 ${isVisible ? 'pain-card-visible' : ''}`}
            onMouseMove={handleMouseMove}
            style={{
                '--accent': accentColor,
                '--solve': solveColor,
                '--mouse-x': `${mousePos.x}px`,
                '--mouse-y': `${mousePos.y}px`,
                animationDelay: `${index * 0.15}s`,
            }}
        >
            <div className="pain-card-spotlight" />
            <div className="pain-card-border-glow" />
            <div className="pain-card-tag">
                <Zap size={10} />
                {tag}
            </div>
            <div className="pain-card-problem">
                <div className="pain-card-icon-badge pain-icon-problem">
                    {icon}
                </div>
                <div className="pain-card-problem-text">
                    <span className="pain-label-micro">PROBLEM</span>
                    <p>{problem}</p>
                </div>
            </div>
            <div className="pain-card-connector">
                <div className="connector-line" />
                <div className="connector-pulse" />
                <div className="connector-line" />
            </div>
            <div className="pain-card-solution">
                <div className="pain-card-icon-badge pain-icon-solution">
                    <CheckCircle2 size={22} />
                </div>
                <div className="pain-card-solution-text">
                    <span className="pain-label-micro pain-label-solution">SOLUTION</span>
                    <p>{solution}</p>
                </div>
            </div>
            <div className="pain-card-divider-2026" />
            <p className="pain-card-desc-2026">{description}</p>
            <div className="pain-card-ambient" />
        </div>
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

const AudienceCard2026 = ({ title, subtitle, icon, iconColor, iconBg, highlightText, useCase, outcome }) => (
    <div className="audience-card-2026">
        <div className="audience-card-header">
            <div className="audience-icon-box" style={{ color: iconColor, backgroundColor: iconBg, borderColor: iconColor }}>
                {icon}
            </div>
            <div className="audience-title-group">
                <h4 className="audience-title">{title}</h4>
                <span className="audience-subtitle">{subtitle}</span>
            </div>
        </div>
        
        <div className="audience-highlight-box" style={{ borderLeftColor: iconColor }}>
            {highlightText}
        </div>
        
        <div className="audience-content-section">
            <div className="content-block">
                <span className="content-label" style={{ color: iconColor }}>TYPICAL USE CASE:</span>
                <p>{useCase}</p>
            </div>
            <div className="content-block">
                <span className="content-label" style={{ color: iconColor }}>OUTCOME:</span>
                <p>{outcome}</p>
            </div>
        </div>
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
