import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Play, CheckCircle2, Shield, AlertTriangle, Layers, Zap } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

/* ────────────────────────────────────────────
   Hero Product Demo — Animated SaaS Interface
   ──────────────────────────────────────────── */

const REQUIREMENT_TEXT = 'Users can reset their password using their registered email.';

const ANALYSIS_STEPS = [
    'Analyzing requirement…',
    'Identifying scenarios…',
    'Generating test coverage…',
];

const GENERATED_RESULTS = [
    { icon: CheckCircle2, label: 'Functional scenarios', color: 'var(--tn-teal)' },
    { icon: AlertTriangle, label: 'Negative scenarios', color: 'var(--tn-amber)' },
    { icon: Layers, label: 'Boundary cases', color: 'var(--tn-blue)' },
    { icon: Shield, label: 'Security scenarios', color: 'var(--tn-violet)' },
    { icon: Zap, label: 'Priority classification', color: 'var(--tn-teal)' },
];

const META_ITEMS = [
    { label: 'Coverage', value: '94%' },
    { label: 'Scenarios', value: '18' },
    { label: 'High Priority', value: '6' },
];

/* Typing animation hook */
const useTypingAnimation = (text, speed = 35, startDelay = 800) => {
    const [displayed, setDisplayed] = useState('');
    const [isDone, setIsDone] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        const startTimeout = setTimeout(() => setHasStarted(true), startDelay);
        return () => clearTimeout(startTimeout);
    }, [startDelay]);

    useEffect(() => {
        if (!hasStarted) return;
        if (displayed.length >= text.length) {
            setIsDone(true);
            return;
        }
        const timeout = setTimeout(() => {
            setDisplayed(text.slice(0, displayed.length + 1));
        }, speed);
        return () => clearTimeout(timeout);
    }, [displayed, text, speed, hasStarted]);

    return { displayed, isDone, hasStarted };
};

/* The interactive product demo panel */
const ProductDemo = () => {
    const { displayed: typedReq, isDone: typingDone } = useTypingAnimation(REQUIREMENT_TEXT, 30, 1200);
    const [analysisStep, setAnalysisStep] = useState(-1);
    const [analysisDone, setAnalysisDone] = useState(false);
    const [visibleResults, setVisibleResults] = useState(0);
    const [showMeta, setShowMeta] = useState(false);

    // Run analysis steps after typing completes
    useEffect(() => {
        if (!typingDone) return;
        let step = 0;
        const interval = setInterval(() => {
            if (step < ANALYSIS_STEPS.length) {
                setAnalysisStep(step);
                step++;
            } else {
                clearInterval(interval);
                setAnalysisDone(true);
            }
        }, 900);
        return () => clearInterval(interval);
    }, [typingDone]);

    // Reveal results sequentially after analysis
    useEffect(() => {
        if (!analysisDone) return;
        let count = 0;
        const interval = setInterval(() => {
            count++;
            setVisibleResults(count);
            if (count >= GENERATED_RESULTS.length) {
                clearInterval(interval);
                setTimeout(() => setShowMeta(true), 400);
            }
        }, 250);
        return () => clearInterval(interval);
    }, [analysisDone]);

    return (
        <div className="tn-demo" role="img" aria-label="Product demonstration showing AI test case generation">
            {/* Window chrome */}
            <div className="tn-demo__chrome">
                <div className="tn-demo__dots">
                    <span /><span /><span />
                </div>
                <span className="tn-demo__title">Testnexa AI — Test Generator</span>
                <div className="tn-demo__dots" style={{ visibility: 'hidden' }}>
                    <span /><span /><span />
                </div>
            </div>

            <div className="tn-demo__body">
                {/* Left panel — Requirement input */}
                <div className="tn-demo__panel tn-demo__panel--left">
                    <div className="tn-demo__panel-header">
                        <span className="tn-demo__panel-label">REQUIREMENT</span>
                    </div>
                    <div className="tn-demo__input-area">
                        <p className="tn-demo__typed-text">
                            {typedReq}
                            {!typingDone && <span className="tn-demo__cursor">|</span>}
                        </p>
                    </div>

                    {/* Analysis progress */}
                    {typingDone && !analysisDone && (
                        <div className="tn-demo__analysis">
                            {ANALYSIS_STEPS.map((step, i) => (
                                <div
                                    key={i}
                                    className={`tn-demo__analysis-step ${i <= analysisStep ? 'tn-demo__analysis-step--active' : ''}`}
                                >
                                    <div className={`tn-demo__analysis-dot ${i <= analysisStep ? 'tn-demo__analysis-dot--pulse' : ''}`} />
                                    <span>{step}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {analysisDone && (
                        <div className="tn-demo__analysis-complete">
                            <CheckCircle2 size={14} />
                            <span>Analysis complete</span>
                        </div>
                    )}
                </div>

                {/* Right panel — Generated results */}
                <div className="tn-demo__panel tn-demo__panel--right">
                    <div className="tn-demo__panel-header">
                        <span className="tn-demo__panel-label">GENERATED RESULTS</span>
                        {showMeta && <span className="tn-demo__status-badge">Complete</span>}
                    </div>

                    <div className="tn-demo__results">
                        {GENERATED_RESULTS.map((result, i) => (
                            <div
                                key={i}
                                className={`tn-demo__result-item ${i < visibleResults ? 'tn-demo__result-item--visible' : ''}`}
                            >
                                <result.icon size={15} style={{ color: result.color, flexShrink: 0 }} />
                                <span>{result.label}</span>
                            </div>
                        ))}

                        {!analysisDone && visibleResults === 0 && (
                            <div className="tn-demo__results-placeholder">
                                <div className="tn-demo__skeleton" />
                                <div className="tn-demo__skeleton tn-demo__skeleton--short" />
                                <div className="tn-demo__skeleton tn-demo__skeleton--medium" />
                            </div>
                        )}
                    </div>

                    {/* Metadata pills */}
                    {showMeta && (
                        <div className="tn-demo__meta">
                            {META_ITEMS.map((item, i) => (
                                <div key={i} className="tn-demo__meta-pill">
                                    <span className="tn-demo__meta-value">{item.value}</span>
                                    <span className="tn-demo__meta-label">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ────────────────────────────────────────────
   Main Hero Component
   ──────────────────────────────────────────── */
const Hero = () => {
    const headerReveal = useScrollReveal({ threshold: 0.1 });
    const demoReveal = useScrollReveal({ threshold: 0.05 });

    const scrollToSection = useCallback((id) => {
        const el = document.getElementById(id);
        if (el) {
            const y = el.getBoundingClientRect().top + window.pageYOffset - 100;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }, []);

    return (
        <section className="tn-hero" aria-labelledby="hero-heading">
            {/* Ambient glow behind hero */}
            <div className="tn-hero__glow" aria-hidden="true" />

            <div className="container tn-hero__inner">
                {/* Text content */}
                <div
                    ref={headerReveal.ref}
                    className={`tn-hero__text scroll-reveal-fade-up ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    {/* Eyebrow badge */}
                    <div className="tn-hero__badge">
                        <span className="tn-hero__badge-dot" />
                        <span>AI-POWERED TEST DESIGN</span>
                    </div>

                    {/* Headline */}
                    <h1 id="hero-heading" className="tn-hero__headline">
                        Turn Requirements Into{' '}
                        <span className="tn-hero__headline-gradient">Production-Ready</span>{' '}
                        Test Suites.
                    </h1>

                    {/* Supporting text */}
                    <p className="tn-hero__subtext">
                        Testnexa AI transforms natural-language requirements into comprehensive,
                        prioritized test scenarios — including functional, negative, edge and
                        boundary cases.
                    </p>

                    {/* CTAs */}
                    <div className="tn-hero__ctas">
                        <a href="/login" className="tn-btn tn-btn--primary">
                            Generate Test Cases
                            <ArrowRight size={16} />
                        </a>
                        <button
                            className="tn-btn tn-btn--ghost"
                            onClick={() => scrollToSection('engineering-maturity')}
                        >
                            <Play size={14} />
                            See How It Works
                        </button>
                    </div>

                    {/* Trust line */}
                    <p className="tn-hero__trust">
                        No credit card required · Free to start · Instant results
                    </p>
                </div>

                {/* Product demo panel */}
                <div
                    ref={demoReveal.ref}
                    className={`tn-hero__demo-wrap scroll-reveal-fade-up ${demoReveal.isVisible ? 'revealed' : ''}`}
                    style={{ transitionDelay: '0.2s' }}
                >
                    <ProductDemo />
                </div>
            </div>
        </section>
    );
};

export default Hero;
