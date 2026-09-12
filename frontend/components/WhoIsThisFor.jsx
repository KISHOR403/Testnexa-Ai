import React from 'react';
import { Braces, CheckCircle2, ClipboardList, GraduationCap, Layers, FileText, ArrowRight } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const roles = [
    {
        title: 'SDETs & Automation Engineers',
        text: 'Production-ready test cases with unique IDs, preconditions, and automation execution hooks.',
        icon: Braces,
        tags: ['Gherkin syntax ready', 'ID & Priority mapping', 'Edge condition asserts'],
    },
    {
        title: 'Product Managers',
        text: 'Requirement ambiguities and logic gaps surfaced before stories are groomed or committed.',
        icon: ClipboardList,
        tags: ['Acceptance criteria audit', 'Unresolved assumption flags', 'Scope risk rating'],
    },
    {
        title: 'QA Engineers & Testers',
        text: 'Deep multi-path suites that accelerate manual testing while eliminating blind spots.',
        icon: GraduationCap,
        tags: ['Negative & Boundary cases', 'Security attack vectors', 'Fast regression packs'],
    },
];

const WhoIsThisFor = () => {
    const reveal = useScrollReveal({ threshold: 0.08 });

    return (
        <section id="who-is-this-for" className="tn-audience" aria-labelledby="audience-heading">
            <div className="tn-container">
                <div
                    ref={reveal.ref}
                    className={`tn-audience-split scroll-reveal-fade-up ${reveal.isVisible ? 'revealed' : ''}`}
                >
                    {/* LEFT COLUMN: Unified Requirement Visual */}
                    <div className="tn-audience-visual">
                        <div className="tn-audience-card">
                            <div className="tn-audience-card__bar">
                                <div className="tn-audience-card__title">
                                    <FileText size={16} />
                                    <span>Single Source of Truth</span>
                                </div>
                                <span className="tn-audience-card__badge">Live Spec</span>
                            </div>

                            <div className="tn-audience-card__source">
                                <span className="tn-audience-card__source-label">Raw Requirement Input</span>
                                <p>"Users can reset their password using their registered email address."</p>
                            </div>

                            <div className="tn-audience-card__tree">
                                <div className="tn-audience-card__tree-title">
                                    <Layers size={14} />
                                    <span>Multi-Stakeholder Synthesis</span>
                                </div>
                                
                                <div className="tn-audience-branch tn-audience-branch--sdet">
                                    <div className="tn-audience-branch__icon"><Braces size={14} /></div>
                                    <div className="tn-audience-branch__text">
                                        <strong>SDET View:</strong>
                                        <span>TC-001 &rarr; POST /api/auth/reset-password [200 OK]</span>
                                    </div>
                                </div>

                                <div className="tn-audience-branch tn-audience-branch--pm">
                                    <div className="tn-audience-branch__icon"><ClipboardList size={14} /></div>
                                    <div className="tn-audience-branch__text">
                                        <strong>PM View:</strong>
                                        <span>Acceptance Criteria: Token expiration & lockout logic verified</span>
                                    </div>
                                </div>

                                <div className="tn-audience-branch tn-audience-branch--qa">
                                    <div className="tn-audience-branch__icon"><GraduationCap size={14} /></div>
                                    <div className="tn-audience-branch__text">
                                        <strong>QA View:</strong>
                                        <span>18 Matrix Tests (8 Functional, 5 Negative, 3 Boundary, 2 Sec)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Section Header + 3 Stakeholder Output Cards */}
                    <div className="tn-audience-content">
                        <div className="tn-audience-header">
                            <span className="tn-section-kicker">Built For QA Teams</span>
                            <h2 id="audience-heading">One requirement, different views for every stakeholder.</h2>
                            <p className="tn-audience-header__desc">
                                Different roles require different outputs from the same specification.
                                Testnexa generates specialized views tailored for engineering, product, and QA.
                            </p>
                        </div>

                        <div className="tn-audience-roles">
                            {roles.map((role) => (
                                <div className="tn-role-card" key={role.title}>
                                    <div className="tn-role-card__header">
                                        <div className="tn-role-card__icon">
                                            <role.icon size={20} />
                                        </div>
                                        <div>
                                            <h3>{role.title}</h3>
                                            <p>{role.text}</p>
                                        </div>
                                    </div>
                                    <div className="tn-role-card__tags">
                                        {role.tags.map((tag) => (
                                            <span className="tn-role-tag" key={tag}>
                                                <CheckCircle2 size={12} />
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WhoIsThisFor;
