import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowRight,
    CheckCircle2,
    CircleDot,
    FileText,
    Layers3,
    Play,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const requirement = 'Users can reset their password using their registered email.';

const analysisSteps = [
    'Requirement reconstructed',
    'Ambiguity checked',
    'Scenarios generated',
];

const testRows = [
    { id: 'TC-001', title: 'Valid registered email receives reset link', type: 'Functional', priority: 'High' },
    { id: 'TC-002', title: 'Unregistered email returns safe confirmation', type: 'Negative', priority: 'High' },
    { id: 'TC-003', title: 'Expired reset token blocks password update', type: 'Boundary', priority: 'Medium' },
    { id: 'TC-004', title: 'Email field rejects injection payloads', type: 'Security', priority: 'High' },
];

const suiteStats = [
    ['Functional Tests', '8'],
    ['Negative Tests', '5'],
    ['Boundary Tests', '3'],
    ['Security Tests', '2'],
];

const useHeroSequence = () => {
    const [stage, setStage] = useState(0);

    useEffect(() => {
        const timers = [700, 1500, 2300, 3100, 3800, 4300].map((delay, index) =>
            setTimeout(() => setStage(index + 1), delay)
        );
        return () => timers.forEach(clearTimeout);
    }, []);

    return stage;
};

export const ProductWorkbench = ({ compact = false }) => {
    const stage = useHeroSequence();
    const typedRequirement = useMemo(() => {
        const visibleChars = Math.min(requirement.length, Math.max(0, stage) * 18);
        return stage >= 3 ? requirement : requirement.slice(0, visibleChars);
    }, [stage]);

    return (
        <div className={`tn-workbench ${compact ? 'tn-workbench--compact' : ''}`}>
            <div className="tn-workbench__topbar">
                <div>
                    <strong>Testnexa AI</strong>
                    <span>Requirement Analyzer</span>
                </div>
                <div className="tn-workbench__status">
                    <span />
                    AI Ready
                </div>
            </div>

            <div className="tn-workbench__content">
                <aside className="tn-workbench__rail" aria-label="Analysis tools">
                    <button className="is-active"><FileText size={17} /></button>
                    <button><Sparkles size={17} /></button>
                    <button><Layers3 size={17} /></button>
                    <button><ShieldCheck size={17} /></button>
                </aside>

                <section className="tn-workbench__left">
                    <div className="tn-panel-label">Requirement</div>
                    <div className="tn-requirement-box">
                        <p>{typedRequirement}<span className={stage < 3 ? 'tn-caret' : ''} /></p>
                    </div>

                    <div className="tn-analysis-stack">
                        <div className="tn-analysis-title">AI Analysis</div>
                        {analysisSteps.map((item, index) => {
                            const done = stage >= index + 3;
                            return (
                                <div className={`tn-analysis-row ${done ? 'is-done' : ''}`} key={item}>
                                    {done ? <CheckCircle2 size={16} /> : <CircleDot size={16} />}
                                    <span>{done ? item : index === 0 && stage >= 2 ? 'Analyzing requirement...' : item}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="tn-intel-grid">
                        <div>
                            <span>Intent</span>
                            <strong>Password recovery</strong>
                        </div>
                        <div>
                            <span>Actor</span>
                            <strong>Registered user</strong>
                        </div>
                        <div>
                            <span>Gap</span>
                            <strong>Token expiry undefined</strong>
                        </div>
                    </div>
                </section>

                <section className="tn-workbench__right">
                    <div className="tn-suite-header">
                        <div>
                            <div className="tn-panel-label">Generated Test Suite</div>
                            <h3>Password reset coverage</h3>
                        </div>
                        <span className="tn-priority-pill">High priority</span>
                    </div>

                    <div className="tn-suite-stats">
                        {suiteStats.map(([label, value]) => (
                            <div key={label}>
                                <span>{label}</span>
                                <strong>{value}</strong>
                            </div>
                        ))}
                    </div>

                    <div className="tn-suite-meter">
                        <div className="tn-suite-meter__top">
                            <span>Coverage</span>
                            <strong>94%</strong>
                        </div>
                        <div className="tn-suite-meter__track">
                            <span />
                        </div>
                    </div>

                    <div className="tn-test-table">
                        {testRows.map((row, index) => (
                            <div
                                className={`tn-test-row ${stage >= index + 3 ? 'is-visible' : ''}`}
                                key={row.id}
                                style={{ transitionDelay: `${index * 80}ms` }}
                            >
                                <code>{row.id}</code>
                                <span>{row.title}</span>
                                <em>{row.type}</em>
                                <b>{row.priority}</b>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

const Hero = () => {
    const headerReveal = useScrollReveal({ threshold: 0.1 });
    const demoReveal = useScrollReveal({ threshold: 0.05 });

    const scrollToSection = useCallback((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const y = el.getBoundingClientRect().top + window.pageYOffset - 96;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }, []);

    return (
        <section className="tn-hero" aria-labelledby="hero-heading">
            <div className="tn-hero__glow" aria-hidden="true" />
            <div className="tn-container tn-hero__inner">
                <div
                    ref={headerReveal.ref}
                    className={`tn-hero__text scroll-reveal-fade-up ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    <div className="tn-eyebrow">AI-powered QA engine</div>
                    <h1 id="hero-heading" className="tn-hero__headline">
                        Turn Requirements Into <span>Production-Ready</span> Test Suites.
                    </h1>
                    <p className="tn-hero__subtext">
                        Transform messy product requirements into complete, prioritized test coverage
                        with AI-powered analysis.
                    </p>
                    <div className="tn-hero__ctas">
                        <a href="/login" className="tn-btn tn-btn--primary tn-btn--lg">
                            Generate Test Suite
                            <ArrowRight size={18} />
                        </a>
                        <button className="tn-btn tn-btn--secondary tn-btn--lg" onClick={() => scrollToSection('engineering-maturity')}>
                            <Play size={17} />
                            See How It Works
                        </button>
                    </div>
                </div>

                <div
                    ref={demoReveal.ref}
                    className={`tn-hero__demo-wrap scroll-reveal-fade-up ${demoReveal.isVisible ? 'revealed' : ''}`}
                >
                    <ProductWorkbench />
                </div>
            </div>
        </section>
    );
};

export default Hero;
