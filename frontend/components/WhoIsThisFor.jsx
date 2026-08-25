import React from 'react';
import { Target, Users, GraduationCap, CheckCircle2 } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

/* ────────────────────────────────────────────
   Mini UI Visualizations for each role
   ──────────────────────────────────────────── */
const SdetViz = () => (
    <div className="tn-role-viz" aria-hidden="true">
        <div className="tn-role-viz__row">
            <span className="tn-role-viz__tag tn-role-viz__tag--teal">Automation</span>
            <span className="tn-role-viz__tag tn-role-viz__tag--dim">API</span>
        </div>
        <div className="tn-role-viz__code">
            <code>describe('Password Reset', () =&gt; {'{'}</code>
            <code>  it('should send reset email', …)</code>
            <code>  it('should reject expired token', …)</code>
            <code>{'}'})</code>
        </div>
    </div>
);

const PmViz = () => (
    <div className="tn-role-viz" aria-hidden="true">
        <div className="tn-role-viz__checklist">
            <div className="tn-role-viz__check tn-role-viz__check--done">
                <CheckCircle2 size={12} />
                <span>Happy path defined</span>
            </div>
            <div className="tn-role-viz__check tn-role-viz__check--warn">
                <span className="tn-role-viz__warn-dot" />
                <span>Edge case gap detected</span>
            </div>
            <div className="tn-role-viz__check tn-role-viz__check--done">
                <CheckCircle2 size={12} />
                <span>Acceptance criteria mapped</span>
            </div>
        </div>
    </div>
);

const FresherViz = () => (
    <div className="tn-role-viz" aria-hidden="true">
        <div className="tn-role-viz__learn">
            <div className="tn-role-viz__concept">
                <span className="tn-role-viz__concept-label">Positive Test</span>
                <div className="tn-role-viz__bar tn-role-viz__bar--full" />
            </div>
            <div className="tn-role-viz__concept">
                <span className="tn-role-viz__concept-label">Negative Test</span>
                <div className="tn-role-viz__bar tn-role-viz__bar--most" />
            </div>
            <div className="tn-role-viz__concept">
                <span className="tn-role-viz__concept-label">Boundary Test</span>
                <div className="tn-role-viz__bar tn-role-viz__bar--half" />
            </div>
        </div>
    </div>
);

const personas = [
    {
        icon: Target,
        role: 'SDETs',
        value: 'Accelerate test design and automation planning',
        color: 'var(--tn-teal)',
        Viz: SdetViz,
    },
    {
        icon: Users,
        role: 'Product Managers',
        value: 'Identify requirement gaps before development starts',
        color: 'var(--tn-violet)',
        Viz: PmViz,
    },
    {
        icon: GraduationCap,
        role: 'QA Freshers',
        value: 'Learn testing fundamentals while building real test cases',
        color: 'var(--tn-blue)',
        Viz: FresherViz,
    },
];

const WhoIsThisFor = () => {
    const headerReveal = useScrollReveal({ threshold: 0.2 });
    const gridReveal = useScrollReveal({ threshold: 0.08 });

    return (
        <section id="who-is-this-for" className="tn-audience" aria-labelledby="audience-heading">
            <div className="container">
                <div
                    ref={headerReveal.ref}
                    className={`tn-section-header scroll-reveal-fade-up ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    <span className="tn-section-label">Audience</span>
                    <h2 id="audience-heading" className="tn-section-title">
                        Who is this for?
                    </h2>
                    <p className="tn-section-subtitle">
                        Testnexa AI adapts to your role, delivering insights that matter to you.
                    </p>
                </div>

                <div
                    ref={gridReveal.ref}
                    className={`tn-audience__grid scroll-reveal-stagger ${gridReveal.isVisible ? 'revealed' : ''}`}
                >
                    {personas.map((persona) => (
                        <div key={persona.role} className="tn-audience__card">
                            <div className="tn-audience__card-header">
                                <div className="tn-audience__icon" style={{ color: persona.color }}>
                                    <persona.icon size={24} />
                                </div>
                                <h3 className="tn-audience__role">{persona.role}</h3>
                            </div>
                            <p className="tn-audience__value">{persona.value}</p>
                            <div className="tn-audience__viz-wrap">
                                <persona.Viz />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default WhoIsThisFor;
