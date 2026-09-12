import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowRight, Check, Shield, FileText, Code2, Mail, ExternalLink } from 'lucide-react';
import '../styles/aboutPage.css';

const WORKFLOW_STEPS = [
    { num: '1', title: 'Requirement', desc: 'Product specs, user stories, or acceptance criteria' },
    { num: '2', title: 'Test Suite', desc: 'Functional, negative, boundary, and edge cases' },
    { num: '3', title: 'Coverage & Risks', desc: 'Identified gaps, blind spots, and critical paths' },
    { num: '4', title: 'Review & Refine', desc: 'QA engineers audit, edit, and approve test items' },
    { num: '5', title: 'Execution', desc: 'Export and run across QA and testing cycles' },
];

const CAPABILITIES = [
    {
        title: 'Requirement Analysis',
        desc: 'Turn raw product requirements, user stories, and acceptance criteria into structured, testable scenarios.'
    },
    {
        title: 'Test Coverage',
        desc: 'Identify functional, negative, boundary, and edge-case coverage across Web, Mobile, and API targets.'
    },
    {
        title: 'Risk Identification',
        desc: 'Surface overlooked failure modes, race conditions, and security boundaries that require deeper inspection.'
    },
    {
        title: 'Structured Test Cases',
        desc: 'Create standardized test artifacts with explicit preconditions, sequential steps, and measurable expected results.'
    },
    {
        title: 'Traceability',
        desc: 'Maintain transparent linkages between input requirements, generated test cases, and coverage metrics.'
    },
    {
        title: 'Review & Refinement',
        desc: 'Empower QA engineers with granular controls to edit, regenerate, adjust priority, and approve test suites.'
    },
];

const ROLES = [
    {
        role: 'QA Engineers',
        desc: 'Reduce repetitive boilerplate test-case creation and dedicate valuable time to exploratory and non-functional testing.'
    },
    {
        role: 'Developers',
        desc: 'Understand expected behavior, boundary constraints, and important failure scenarios before committing code.'
    },
    {
        role: 'Product Teams',
        desc: 'Translate feature requirements into transparent testing criteria that keep product and quality expectations aligned.'
    },
    {
        role: 'Engineering Teams',
        desc: 'Establish a consistent, repeatable approach to requirement-to-test workflows across distributed squads.'
    },
];

const PRINCIPLES = [
    {
        title: 'Clarity',
        desc: 'Good testing starts with clear requirements. Unambiguous inputs produce predictable, verifiable test outcomes.'
    },
    {
        title: 'Coverage',
        desc: 'Happy paths represent only a fraction of software quality. Robust suites demand equal rigor on negative and boundary conditions.'
    },
    {
        title: 'Human Review',
        desc: 'Generated tests should remain reviewable and editable. Automation must augment engineering judgment, not bypass it.'
    },
    {
        title: 'Consistency',
        desc: 'Structured test artifacts make testing easier to communicate, review, and maintain across release cycles.'
    },
];

const AboutUsPage = () => {
    return (
        <div className="tn-about-root">
            {/* ─── Compact Header & Breadcrumb ─── */}
            <header className="tn-about-header">
                <div className="tn-about-container">
                    <nav className="tn-about-breadcrumb" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span className="tn-about-breadcrumb-separator">/</span>
                        <span>About</span>
                    </nav>
                    <h1 className="tn-about-title">About TestNexa</h1>
                    <p className="tn-about-subtitle">
                        TestNexa helps software teams turn requirements into structured test coverage, identify risks, and spend more time on the testing that requires human judgment.
                    </p>
                </div>
            </header>

            <main className="tn-about-container tn-about-content">
                {/* ─── SECTION 1: What TestNexa Does ─── */}
                <section className="tn-about-section">
                    <div className="tn-about-section-header">
                        <h2 className="tn-about-section-h2">What TestNexa Does</h2>
                        <p className="tn-about-section-desc">
                            TestNexa helps QA engineers and development teams transform product requirements into structured test suites. Instead of starting every feature from a blank page, teams can generate test cases, review coverage, identify risks, and refine their testing workflow from a single unified workspace.
                        </p>
                    </div>

                    {/* Horizontal Workflow Pipeline */}
                    <div className="tn-about-workflow" role="region" aria-label="TestNexa Workflow Pipeline">
                        {WORKFLOW_STEPS.map((step, idx) => (
                            <React.Fragment key={step.num}>
                                <div className="tn-about-wf-step">
                                    <span className="tn-about-wf-num">{step.num}</span>
                                    <h3 className="tn-about-wf-title">{step.title}</h3>
                                    <p className="tn-about-wf-desc">{step.desc}</p>
                                </div>
                                {idx < WORKFLOW_STEPS.length - 1 && (
                                    <ChevronRight size={18} className="tn-about-wf-arrow" aria-hidden="true" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </section>

                {/* ─── SECTION 2: Why We Built TestNexa ─── */}
                <section className="tn-about-section">
                    <div className="tn-about-section-header">
                        <h2 className="tn-about-section-h2">Why We Built TestNexa</h2>
                    </div>
                    <p className="tn-about-narrative">
                        Writing test cases is necessary, but creating them repeatedly from scratch can consume valuable engineering time. The harder part is often identifying what needs to be tested beyond the obvious happy path — such as concurrent states, expired tokens, and boundary failures.
                    </p>
                    <p className="tn-about-narrative" style={{ marginBottom: 0 }}>
                        TestNexa is designed to reduce that repetitive manual overhead while keeping QA engineers in complete control of the final test suite and test strategy.
                    </p>

                    <div className="tn-about-principle-callout">
                        <div className="tn-about-principle-quote">
                            “Automation should accelerate QA judgment — not replace it.”
                        </div>
                        <p className="tn-about-principle-sub">
                            We build software to eliminate repetitive boilerplate so teams can focus on exploratory testing, performance boundaries, and critical business logic.
                        </p>
                    </div>
                </section>

                {/* ─── SECTION 3: What We Help With ─── */}
                <section className="tn-about-section">
                    <div className="tn-about-section-header">
                        <h2 className="tn-about-section-h2">What We Help With</h2>
                        <p className="tn-about-section-desc">
                            Core QA engineering capabilities provided by the TestNexa platform:
                        </p>
                    </div>

                    <div className="tn-about-grid-2col">
                        {CAPABILITIES.map((cap) => (
                            <div key={cap.title} className="tn-about-card">
                                <h3 className="tn-about-card-title">
                                    <span className="tn-about-card-dot" />
                                    {cap.title}
                                </h3>
                                <p className="tn-about-card-desc">{cap.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ─── SECTION 4: Our Approach to AI ─── */}
                <section className="tn-about-section">
                    <div className="tn-about-section-header">
                        <h2 className="tn-about-section-h2">Our Approach to AI</h2>
                        <p className="tn-about-section-desc">
                            AI should assist the testing process, not operate as a black box. TestNexa is designed around a human-in-the-loop workflow where generated test cases can be reviewed, edited, refined, and approved by QA engineers before execution.
                        </p>
                    </div>

                    <div className="tn-about-ai-comparison">
                        <div className="tn-about-ai-col">
                            <div className="tn-about-ai-col-header">
                                <span className="tn-about-ai-col-tag tn-about-ai-col-tag--ai">Capability</span>
                                <h3 className="tn-about-ai-col-title">AI Assists With</h3>
                            </div>
                            <ul className="tn-about-ai-list">
                                <li className="tn-about-ai-item">
                                    <Check size={14} className="tn-about-ai-item-bullet" />
                                    <span><strong>Requirement Interpretation:</strong> Parsing user stories and technical specs into distinct functional blocks.</span>
                                </li>
                                <li className="tn-about-ai-item">
                                    <Check size={14} className="tn-about-ai-item-bullet" />
                                    <span><strong>Scenario Generation:</strong> Drafting comprehensive functional and validation scenarios rapidly.</span>
                                </li>
                                <li className="tn-about-ai-item">
                                    <Check size={14} className="tn-about-ai-item-bullet" />
                                    <span><strong>Edge-Case Discovery:</strong> Surfacing boundary values, timeout limits, and malformed payload states.</span>
                                </li>
                                <li className="tn-about-ai-item">
                                    <Check size={14} className="tn-about-ai-item-bullet" />
                                    <span><strong>Coverage Analysis:</strong> Identifying potential blind spots in requirement coverage.</span>
                                </li>
                                <li className="tn-about-ai-item">
                                    <Check size={14} className="tn-about-ai-item-bullet" />
                                    <span><strong>Risk Identification:</strong> Highlighting critical failure vectors for engineering attention.</span>
                                </li>
                            </ul>
                        </div>

                        <div className="tn-about-ai-col">
                            <div className="tn-about-ai-col-header">
                                <span className="tn-about-ai-col-tag tn-about-ai-col-tag--qa">Governance</span>
                                <h3 className="tn-about-ai-col-title">QA Engineers Control</h3>
                            </div>
                            <ul className="tn-about-ai-list">
                                <li className="tn-about-ai-item">
                                    <Check size={14} className="tn-about-ai-item-bullet--qa" />
                                    <span><strong>Final Test Cases:</strong> Editing steps, expected results, and preconditions inline.</span>
                                </li>
                                <li className="tn-about-ai-item">
                                    <Check size={14} className="tn-about-ai-item-bullet--qa" />
                                    <span><strong>Business Rules:</strong> Ensuring verification criteria reflect exact organizational requirements.</span>
                                </li>
                                <li className="tn-about-ai-item">
                                    <Check size={14} className="tn-about-ai-item-bullet--qa" />
                                    <span><strong>Test Priorities:</strong> Setting priority and severity tiers according to release risk.</span>
                                </li>
                                <li className="tn-about-ai-item">
                                    <Check size={14} className="tn-about-ai-item-bullet--qa" />
                                    <span><strong>Suite Approvals:</strong> Formally approving test suites for test execution.</span>
                                </li>
                                <li className="tn-about-ai-item">
                                    <Check size={14} className="tn-about-ai-item-bullet--qa" />
                                    <span><strong>Execution Decisions:</strong> Determining test automation strategy and manual testing paths.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* ─── SECTION 5: Built for Modern QA Workflows ─── */}
                <section className="tn-about-section">
                    <div className="tn-about-section-header">
                        <h2 className="tn-about-section-h2">Built for Modern QA Workflows</h2>
                        <p className="tn-about-section-desc">
                            Designed to bridge product specifications and software quality across the delivery team:
                        </p>
                    </div>

                    <div className="tn-about-roles-grid">
                        {ROLES.map((r) => (
                            <div key={r.role} className="tn-about-role-card">
                                <h3 className="tn-about-role-title">{r.role}</h3>
                                <p className="tn-about-role-desc">{r.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ─── SECTION 6: What We Believe ─── */}
                <section className="tn-about-section">
                    <div className="tn-about-section-header">
                        <h2 className="tn-about-section-h2">What We Believe</h2>
                        <p className="tn-about-section-desc">
                            The engineering principles that guide how we design and build TestNexa:
                        </p>
                    </div>

                    <div className="tn-about-principles-grid">
                        {PRINCIPLES.map((p) => (
                            <div key={p.title} className="tn-about-principle-card">
                                <h3 className="tn-about-principle-card-title">{p.title}</h3>
                                <p className="tn-about-principle-card-desc">{p.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ─── SECTION 7: Product & Company Resources ─── */}
                <section className="tn-about-section">
                    <div className="tn-about-section-header">
                        <h2 className="tn-about-section-h2">Product Resources</h2>
                        <p className="tn-about-section-desc">
                            Explore guides, references, and developer tools to get the most out of TestNexa:
                        </p>
                    </div>

                    <div className="tn-about-resources-box">
                        <div className="tn-about-res-group">
                            <h3 className="tn-about-res-title">Documentation & Guides</h3>
                            <ul className="tn-about-res-links">
                                <li>
                                    <Link to="/help" className="tn-about-res-link">
                                        <FileText size={14} />
                                        <span>Help Center & Documentation</span>
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/best-practices" className="tn-about-res-link">
                                        <Check size={14} />
                                        <span>QA Best Practices & Guidelines</span>
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/api-reference" className="tn-about-res-link">
                                        <Code2 size={14} />
                                        <span>Developer API Reference</span>
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        <div className="tn-about-res-group">
                            <h3 className="tn-about-res-title">Contact & Security</h3>
                            <ul className="tn-about-res-links">
                                <li>
                                    <Link to="/contact" className="tn-about-res-link">
                                        <Mail size={14} />
                                        <span>Contact Engineering & Support</span>
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/privacy" className="tn-about-res-link">
                                        <Shield size={14} />
                                        <span>Privacy Policy & Data Security</span>
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/terms" className="tn-about-res-link">
                                        <FileText size={14} />
                                        <span>Terms of Service</span>
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* ─── SECTION 8: Contextual CTA ─── */}
                <section className="tn-about-cta">
                    <div className="tn-about-cta-text">
                        <h3 className="tn-about-cta-h3">Ready to improve your testing workflow?</h3>
                        <p className="tn-about-cta-p">
                            Start with a requirement and build a structured, reviewable test suite with TestNexa.
                        </p>
                    </div>
                    <div className="tn-about-cta-btns">
                        <Link to="/app/workspace" className="tn-about-btn-primary">
                            Get Started
                            <ArrowRight size={14} />
                        </Link>
                        <Link to="/help" className="tn-about-btn-secondary">
                            View Documentation
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default AboutUsPage;
