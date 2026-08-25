import React from 'react';
import {
    Brain, Layers, SearchCheck, BarChart3,
    FileOutput, Gauge, ArrowRight
} from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

/* ────────────────────────────────────────────
   Featured UI Visualization — Requirement Parsing
   ──────────────────────────────────────────── */
const RequirementParsingViz = () => (
    <div className="tn-feat-viz" aria-hidden="true">
        <div className="tn-feat-viz__input">
            <span className="tn-feat-viz__label">Input</span>
            <p>"User can add items to cart and proceed to checkout with saved payment method"</p>
        </div>
        <div className="tn-feat-viz__arrow">
            <ArrowRight size={16} />
        </div>
        <div className="tn-feat-viz__output">
            <span className="tn-feat-viz__label">Parsed Rules</span>
            <div className="tn-feat-viz__nodes">
                <span className="tn-feat-viz__node tn-feat-viz__node--teal">Add to cart</span>
                <span className="tn-feat-viz__node tn-feat-viz__node--violet">Checkout flow</span>
                <span className="tn-feat-viz__node tn-feat-viz__node--blue">Payment validation</span>
                <span className="tn-feat-viz__node tn-feat-viz__node--amber">Auth required</span>
            </div>
        </div>
    </div>
);

/* ────────────────────────────────────────────
   Supporting Feature Data
   ──────────────────────────────────────────── */
const supportingFeatures = [
    {
        icon: Layers,
        title: 'Multi-Category Tests',
        description: 'Generates functional, negative, edge case, and API testing categories simultaneously in one pass.',
        indicator: '4 categories',
        color: 'var(--tn-violet)',
    },
    {
        icon: SearchCheck,
        title: 'Ambiguity Detection',
        description: 'Identifies contradictions, missing logic, and unclear specs — then generates targeted clarification questions.',
        indicator: 'Auto-detect',
        color: 'var(--tn-amber)',
    },
    {
        icon: BarChart3,
        title: 'Risk-Based Prioritization',
        description: 'Assigns High, Medium, or Low priority to each test case based on business impact and complexity.',
        indicator: 'Impact-driven',
        color: 'var(--tn-blue)',
    },
    {
        icon: FileOutput,
        title: 'Multi-Format Export',
        description: 'Export test suites in JSON, Markdown, or structured formats ready for your test management tools.',
        indicator: 'JSON · MD · CSV',
        color: 'var(--tn-teal)',
    },
    {
        icon: Gauge,
        title: 'Requirement Insights',
        description: 'Get quality scores, coverage metrics, and actionable insights on requirement testability.',
        indicator: 'Quality score',
        color: 'var(--tn-rose)',
    },
];

/* ────────────────────────────────────────────
   Features Section
   ──────────────────────────────────────────── */
const Features = () => {
    const headerReveal = useScrollReveal({ threshold: 0.2 });
    const featuredReveal = useScrollReveal({ threshold: 0.1 });
    const gridReveal = useScrollReveal({ threshold: 0.08 });

    return (
        <section id="features" className="tn-features" aria-labelledby="features-heading">
            <div className="container">
                {/* Section header */}
                <div
                    ref={headerReveal.ref}
                    className={`tn-section-header scroll-reveal-fade-up ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    <span className="tn-section-label">Capabilities</span>
                    <h2 id="features-heading" className="tn-section-title">
                        Everything you need to transform<br />
                        requirements into test suites.
                    </h2>
                </div>

                {/* Featured card — large */}
                <div
                    ref={featuredReveal.ref}
                    className={`tn-feat-featured scroll-reveal-fade-up ${featuredReveal.isVisible ? 'revealed' : ''}`}
                >
                    <div className="tn-feat-featured__content">
                        <div className="tn-feat-featured__icon" style={{ color: 'var(--tn-teal)' }}>
                            <Brain size={28} />
                        </div>
                        <h3 className="tn-feat-featured__title">AI-Powered Requirement Analysis</h3>
                        <p className="tn-feat-featured__desc">
                            Advanced LLM intelligence deeply understands your requirements,
                            parsing natural language into atomic business rules with
                            context-aware domain understanding.
                        </p>
                    </div>
                    <div className="tn-feat-featured__viz">
                        <RequirementParsingViz />
                    </div>
                </div>

                {/* Supporting features grid — varied layout */}
                <div
                    ref={gridReveal.ref}
                    className={`tn-feat-grid scroll-reveal-stagger ${gridReveal.isVisible ? 'revealed' : ''}`}
                >
                    {supportingFeatures.map((feat, i) => (
                        <div
                            key={feat.title}
                            className={`tn-feat-card ${i < 2 ? 'tn-feat-card--medium' : 'tn-feat-card--small'}`}
                        >
                            <div className="tn-feat-card__icon" style={{ color: feat.color }}>
                                <feat.icon size={22} />
                            </div>
                            <h3 className="tn-feat-card__title">{feat.title}</h3>
                            <p className="tn-feat-card__desc">{feat.description}</p>
                            <span className="tn-feat-card__indicator" style={{ color: feat.color }}>
                                {feat.indicator}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Features;
