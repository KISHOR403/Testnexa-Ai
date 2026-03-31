import React from 'react';
import {
    Brain, Layers, SearchCheck, BarChart3,
    FileOutput, Gauge, CheckCircle2, Sparkles
} from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const features = [
    {
        icon: Brain,
        title: 'AI-Powered Analysis',
        description: 'Leverages advanced LLM intelligence to deeply understand your requirements and generate meaningful test scenarios.',
        bullets: ['Context-aware requirement parsing', 'Domain-specific logic understanding'],
        color: 'teal'
    },
    {
        icon: Layers,
        title: 'Multi-Category Tests',
        description: 'Generates comprehensive test suites across functional, negative, edge case, and API testing categories simultaneously.',
        bullets: ['Complete coverage in one pass', 'Boundary & edge case detection'],
        color: 'purple'
    },
    {
        icon: SearchCheck,
        title: 'Ambiguity Detection',
        description: 'Identifies contradictions, missing logic, and unclear specs — then generates targeted clarification questions.',
        bullets: ['Spots requirement gaps early', 'Reduces costly rework cycles'],
        color: 'amber'
    },
    {
        icon: BarChart3,
        title: 'Risk-Based Priority',
        description: 'Automatically assigns High, Medium, or Low priority to each test case based on business impact and complexity.',
        bullets: ['Impact-driven prioritization', 'Focus testing on what matters'],
        color: 'blue'
    },
    {
        icon: FileOutput,
        title: 'Multi-Format Export',
        description: 'Export your generated test suites in JSON, Markdown, or structured formats ready for your test management tools.',
        bullets: ['Copy-paste ready outputs', 'Tool-agnostic flexibility'],
        color: 'green'
    },
    {
        icon: Gauge,
        title: 'Requirement Insights',
        description: 'Get quality scores, coverage metrics, and actionable insights on how well your requirements translate to testable specs.',
        bullets: ['Ambiguity & completeness scores', 'Actionable improvement tips'],
        color: 'rose'
    }
];

const Features = () => {
    const headerReveal = useScrollReveal({ threshold: 0.3 });
    const gridReveal = useScrollReveal({ threshold: 0.1 });

    return (
        <section id="features" className="features-section">
            <div className="container">
                <div
                    ref={headerReveal.ref}
                    className={`features-header scroll-reveal-fade-up ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    <div className="features-badge">
                        <Sparkles size={14} />
                        <span>Powered by Advanced AI</span>
                    </div>
                    <h2 className="features-title">
                        Key Features
                    </h2>
                    <p className="features-subtitle">
                        Everything you need to transform requirements into comprehensive, prioritized test suites.
                    </p>
                </div>

                <div
                    ref={gridReveal.ref}
                    className={`features-grid scroll-reveal-stagger ${gridReveal.isVisible ? 'revealed' : ''}`}
                >
                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className="feature-card glass-card"
                        >
                            <div className={`feature-card-glow ${feature.color}`} />
                            <div className={`feature-icon-box ${feature.color}`}>
                                <feature.icon size={24} />
                            </div>
                            <h3 className="feature-card-title">{feature.title}</h3>
                            <p className="feature-card-desc">{feature.description}</p>
                            <ul className="feature-bullets">
                                {feature.bullets.map((bullet, i) => (
                                    <li key={i}>
                                        <CheckCircle2 size={14} className="bullet-check" />
                                        <span>{bullet}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Features;
