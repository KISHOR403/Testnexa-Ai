import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, ArrowRight, BookOpen, ShieldCheck, CheckSquare, Layers, FileText } from 'lucide-react';
import '../styles/bestPractices.css';

const CHECKLIST_ITEMS = [
    { id: 'actor', label: 'User persona or actor is clearly defined (e.g. Admin, Registered User, Guest)' },
    { id: 'behavior', label: 'Expected behavior and acceptance criteria are explicitly stated' },
    { id: 'valid_inputs', label: 'Valid input parameters and accepted formats are specified' },
    { id: 'invalid_inputs', label: 'Invalid inputs, character limits, and constraints are defined' },
    { id: 'boundaries', label: 'Boundary conditions and timeout thresholds are known (e.g. 15m TTL)' },
    { id: 'error_handling', label: 'Error handling rules and failure feedback states are documented' },
    { id: 'permissions', label: 'User authorization levels and access controls are specified' },
    { id: 'dependencies', label: 'External dependencies, email delivery, or database state identified' },
];

const BestPracticesPage = () => {
    const [activeSection, setActiveSection] = useState('overview');
    const [checkedItems, setCheckedItems] = useState({
        actor: true,
        behavior: true,
        valid_inputs: true,
    });

    const toggleChecklistItem = (id) => {
        setCheckedItems(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const scrollTo = (id) => {
        setActiveSection(id);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Track active section on scroll
    useEffect(() => {
        const sections = [
            'overview',
            'writing-requirements',
            'expected-behavior',
            'test-coverage',
            'negative-edge-cases',
            'do-avoid',
            'requirement-checklist',
            'testnexa-workflow',
            'api-ui-guidelines',
            'reviewing-test-cases'
        ];

        const handleScroll = () => {
            const scrollPosition = window.scrollY + 140;
            for (let i = sections.length - 1; i >= 0; i--) {
                const section = document.getElementById(sections[i]);
                if (section && section.offsetTop <= scrollPosition) {
                    setActiveSection(sections[i]);
                    break;
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const completedChecklistCount = Object.values(checkedItems).filter(Boolean).length;

    return (
        <div className="tn-bp-root">
            {/* ─── Compact Header & Breadcrumb ─── */}
            <header className="tn-bp-header">
                <div className="tn-bp-header__container">
                    <nav className="tn-bp-breadcrumb" aria-label="Breadcrumb">
                        <Link to="/help">Documentation</Link>
                        <span className="tn-bp-breadcrumb-separator">/</span>
                        <span>Best Practices</span>
                    </nav>
                    <h1 className="tn-bp-title">Best Practices</h1>
                    <p className="tn-bp-subtitle">
                        Practical guidelines for creating clear, complete, and testable requirements to achieve comprehensive QA coverage.
                    </p>
                </div>
            </header>

            {/* ─── 3-Column Documentation Layout ─── */}
            <div className="tn-bp-layout">
                {/* ─── Left Sidebar Navigation ─── */}
                <aside className="tn-bp-sidebar" aria-label="Documentation Navigation">
                    <h2 className="tn-bp-sidebar-heading">Best Practices</h2>
                    <ul className="tn-bp-sidebar-list">
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-sidebar-btn ${activeSection === 'overview' ? 'active' : ''}`}
                                onClick={() => scrollTo('overview')}
                            >
                                Overview
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-sidebar-btn ${activeSection === 'writing-requirements' ? 'active' : ''}`}
                                onClick={() => scrollTo('writing-requirements')}
                            >
                                Writing Requirements
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-sidebar-btn ${activeSection === 'expected-behavior' ? 'active' : ''}`}
                                onClick={() => scrollTo('expected-behavior')}
                            >
                                Expected Behavior
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-sidebar-btn ${activeSection === 'test-coverage' ? 'active' : ''}`}
                                onClick={() => scrollTo('test-coverage')}
                            >
                                Test Coverage
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-sidebar-btn ${activeSection === 'negative-edge-cases' ? 'active' : ''}`}
                                onClick={() => scrollTo('negative-edge-cases')}
                            >
                                Negative & Edge Cases
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-sidebar-btn ${activeSection === 'do-avoid' ? 'active' : ''}`}
                                onClick={() => scrollTo('do-avoid')}
                            >
                                Do & Avoid
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-sidebar-btn ${activeSection === 'requirement-checklist' ? 'active' : ''}`}
                                onClick={() => scrollTo('requirement-checklist')}
                            >
                                Requirement Checklist
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-sidebar-btn ${activeSection === 'testnexa-workflow' ? 'active' : ''}`}
                                onClick={() => scrollTo('testnexa-workflow')}
                            >
                                Workflow Guidance
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-sidebar-btn ${activeSection === 'api-ui-guidelines' ? 'active' : ''}`}
                                onClick={() => scrollTo('api-ui-guidelines')}
                            >
                                API & UI Guidelines
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-sidebar-btn ${activeSection === 'reviewing-test-cases' ? 'active' : ''}`}
                                onClick={() => scrollTo('reviewing-test-cases')}
                            >
                                Reviewing Test Cases
                            </button>
                        </li>
                    </ul>
                </aside>

                {/* ─── Center Main Content ─── */}
                <main className="tn-bp-main">
                    {/* SECTION: Overview */}
                    <section id="overview" className="tn-bp-section">
                        <h2 className="tn-bp-section-h2">Overview</h2>
                        <p className="tn-bp-section-desc">
                            Testnexa transforms feature specifications into structured, prioritized test suites. The quality and depth of the generated test cases depend directly on the completeness, clarity, and boundaries defined in the input requirements. These guidelines outline how to draft testable requirements, define expected behavior, and configure meaningful QA coverage.
                        </p>
                    </section>

                    {/* SECTION: Writing Requirements */}
                    <section id="writing-requirements" className="tn-bp-section">
                        <h2 className="tn-bp-section-h2">Write Better Requirements</h2>
                        <p className="tn-bp-section-desc">
                            Clear requirements give Testnexa enough context to generate meaningful test coverage, unambiguous assertions, and boundary checks.
                        </p>

                        <div className="tn-bp-comparison-grid">
                            <div className="tn-bp-comp-card tn-bp-comp-card--weak">
                                <span className="tn-bp-comp-label tn-bp-comp-label--weak">
                                    <X size={13} />
                                    Weak Requirement
                                </span>
                                <p className="tn-bp-comp-text">
                                    “User can reset their password.”
                                </p>
                            </div>

                            <div className="tn-bp-comp-card tn-bp-comp-card--better">
                                <span className="tn-bp-comp-label tn-bp-comp-label--better">
                                    <Check size={13} />
                                    Better Requirement
                                </span>
                                <p className="tn-bp-comp-text">
                                    “Registered users can request a password reset using their email address. A valid reset link expires after 15 minutes and can only be used once.”
                                </p>
                            </div>
                        </div>

                        <div className="tn-bp-why-box">
                            <h3 className="tn-bp-why-title">Why This Is Better</h3>
                            <ul className="tn-bp-why-list">
                                <li className="tn-bp-why-item">
                                    <Check size={14} className="tn-bp-why-icon" />
                                    <span><strong>Defines the actor:</strong> Registered user</span>
                                </li>
                                <li className="tn-bp-why-item">
                                    <Check size={14} className="tn-bp-why-icon" />
                                    <span><strong>Defines the input:</strong> Email address format</span>
                                </li>
                                <li className="tn-bp-why-item">
                                    <Check size={14} className="tn-bp-why-icon" />
                                    <span><strong>Defines expected behavior:</strong> Reset link dispatched</span>
                                </li>
                                <li className="tn-bp-why-item">
                                    <Check size={14} className="tn-bp-why-icon" />
                                    <span><strong>Defines expiration:</strong> 15-minute validity window</span>
                                </li>
                                <li className="tn-bp-why-item">
                                    <Check size={14} className="tn-bp-why-icon" />
                                    <span><strong>Defines security constraints:</strong> Single-use token</span>
                                </li>
                                <li className="tn-bp-why-item">
                                    <Check size={14} className="tn-bp-why-icon" />
                                    <span><strong>Enables testability:</strong> Negative and edge case scenarios</span>
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* SECTION: Define Expected Behavior */}
                    <section id="expected-behavior" className="tn-bp-section">
                        <h2 className="tn-bp-section-h2">Define Expected Behavior</h2>
                        <p className="tn-bp-section-desc">
                            Requirements should explicitly state system behavior across both standard operations and abnormal conditions. Ensure specifications state what occurs when:
                        </p>

                        <div className="tn-bp-scenario-list">
                            <div className="tn-bp-scenario-item">
                                <div className="tn-bp-scenario-name">
                                    <span className="tn-bp-scenario-name-dot" />
                                    Valid Input
                                </div>
                                <p className="tn-bp-scenario-desc">
                                    What state changes occur, which screens render, and what confirmation message appears.
                                </p>
                            </div>
                            <div className="tn-bp-scenario-item">
                                <div className="tn-bp-scenario-name">
                                    <span className="tn-bp-scenario-name-dot" />
                                    Invalid Input
                                </div>
                                <p className="tn-bp-scenario-desc">
                                    Which field highlights in error, what message displays, and whether submission is blocked.
                                </p>
                            </div>
                            <div className="tn-bp-scenario-item">
                                <div className="tn-bp-scenario-name">
                                    <span className="tn-bp-scenario-name-dot" />
                                    Missing Information
                                </div>
                                <p className="tn-bp-scenario-desc">
                                    How mandatory fields behave when left empty or partially completed.
                                </p>
                            </div>
                            <div className="tn-bp-scenario-item">
                                <div className="tn-bp-scenario-name">
                                    <span className="tn-bp-scenario-name-dot" />
                                    Boundary Thresholds
                                </div>
                                <p className="tn-bp-scenario-desc">
                                    What occurs at min/max character lengths, zero values, or file size maximums.
                                </p>
                            </div>
                            <div className="tn-bp-scenario-item">
                                <div className="tn-bp-scenario-name">
                                    <span className="tn-bp-scenario-name-dot" />
                                    Unauthorized Access
                                </div>
                                <p className="tn-bp-scenario-desc">
                                    Redirect behavior or HTTP 401/403 responses when privileges are insufficient.
                                </p>
                            </div>
                            <div className="tn-bp-scenario-item">
                                <div className="tn-bp-scenario-name">
                                    <span className="tn-bp-scenario-name-dot" />
                                    External Failure
                                </div>
                                <p className="tn-bp-scenario-desc">
                                    Fallback behavior when third-party auth, SMTP, or backend microservices fail.
                                </p>
                            </div>
                        </div>

                        <div className="tn-bp-comparison-grid">
                            <div className="tn-bp-comp-card tn-bp-comp-card--weak">
                                <span className="tn-bp-comp-label tn-bp-comp-label--weak">
                                    <X size={13} />
                                    Ambiguous
                                </span>
                                <p className="tn-bp-comp-text">
                                    “Login should work.”
                                </p>
                            </div>
                            <div className="tn-bp-comp-card tn-bp-comp-card--better">
                                <span className="tn-bp-comp-label tn-bp-comp-label--better">
                                    <Check size={13} />
                                    Explicit Behavior
                                </span>
                                <p className="tn-bp-comp-text">
                                    “Users with valid credentials can sign in and are redirected to the dashboard. Invalid credentials display an appropriate error without revealing whether the email exists.”
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* SECTION: Test Coverage Configuration */}
                    <section id="test-coverage" className="tn-bp-section">
                        <h2 className="tn-bp-section-h2">Configure Meaningful Test Coverage</h2>
                        <p className="tn-bp-section-desc">
                            Choose coverage depth based on the risk, blast radius, and complexity of the feature rather than generating every possible scenario indiscriminately.
                        </p>

                        <div className="tn-bp-coverage-grid">
                            <div className="tn-bp-coverage-card">
                                <span className="tn-bp-coverage-tier">Basic</span>
                                <h3 className="tn-bp-coverage-title">Essential Coverage</h3>
                                <p className="tn-bp-coverage-desc">
                                    Core happy-path scenarios, primary navigation flows, and critical form validations.
                                </p>
                                <ul className="tn-bp-coverage-points">
                                    <li className="tn-bp-coverage-point">
                                        <Check size={12} className="tn-bp-coverage-point-check" />
                                        Primary user journeys
                                    </li>
                                    <li className="tn-bp-coverage-point">
                                        <Check size={12} className="tn-bp-coverage-point-check" />
                                        Mandatory field checks
                                    </li>
                                    <li className="tn-bp-coverage-point">
                                        <Check size={12} className="tn-bp-coverage-point-check" />
                                        Smoke & sanity tests
                                    </li>
                                </ul>
                            </div>

                            <div className="tn-bp-coverage-card">
                                <span className="tn-bp-coverage-tier">Medium</span>
                                <h3 className="tn-bp-coverage-title">Standard Coverage</h3>
                                <p className="tn-bp-coverage-desc">
                                    Balanced test suites covering functional flows, negative validation, and common edge cases.
                                </p>
                                <ul className="tn-bp-coverage-points">
                                    <li className="tn-bp-coverage-point">
                                        <Check size={12} className="tn-bp-coverage-point-check" />
                                        Full validation paths
                                    </li>
                                    <li className="tn-bp-coverage-point">
                                        <Check size={12} className="tn-bp-coverage-point-check" />
                                        Negative inputs & formats
                                    </li>
                                    <li className="tn-bp-coverage-point">
                                        <Check size={12} className="tn-bp-coverage-point-check" />
                                        Regression verification
                                    </li>
                                </ul>
                            </div>

                            <div className="tn-bp-coverage-card">
                                <span className="tn-bp-coverage-tier">Detailed</span>
                                <h3 className="tn-bp-coverage-title">Comprehensive Coverage</h3>
                                <p className="tn-bp-coverage-desc">
                                    Exhaustive coverage including boundary values, security vectors, failure modes, and race conditions.
                                </p>
                                <ul className="tn-bp-coverage-points">
                                    <li className="tn-bp-coverage-point">
                                        <Check size={12} className="tn-bp-coverage-point-check" />
                                        Security & authentication risks
                                    </li>
                                    <li className="tn-bp-coverage-point">
                                        <Check size={12} className="tn-bp-coverage-point-check" />
                                        Token replay & concurrency
                                    </li>
                                    <li className="tn-bp-coverage-point">
                                        <Check size={12} className="tn-bp-coverage-point-check" />
                                        API contract assertions
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* SECTION: Negative & Edge Cases */}
                    <section id="negative-edge-cases" className="tn-bp-section">
                        <h2 className="tn-bp-section-h2">Include Negative and Edge Cases</h2>
                        <p className="tn-bp-section-desc">
                            High-quality QA test plans place equal emphasis on failure modes. Below are common vectors to specify when drafting requirements:
                        </p>

                        <div className="tn-bp-cases-grid">
                            <div className="tn-bp-case-group">
                                <h3 className="tn-bp-case-heading">Authentication</h3>
                                <ul className="tn-bp-case-list">
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Incorrect password</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Unknown or malformed email</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Empty or whitespace credentials</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Locked or suspended account</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Expired or invalidated session</li>
                                </ul>
                            </div>

                            <div className="tn-bp-case-group">
                                <h3 className="tn-bp-case-heading">Password Reset</h3>
                                <ul className="tn-bp-case-list">
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Expired reset link (TTL exceeded)</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Already-consumed token replay</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Tampered or malformed token</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Unregistered email generic feedback</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Multiple rapid reset requests</li>
                                </ul>
                            </div>

                            <div className="tn-bp-case-group">
                                <h3 className="tn-bp-case-heading">REST API Endpoints</h3>
                                <ul className="tn-bp-case-list">
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Missing required JSON field</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Invalid data type (string as int)</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Maximum payload length exceeded</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Missing Bearer auth header</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> HTTP 429 rate limit exceeded</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* SECTION: Do / Avoid */}
                    <section id="do-avoid" className="tn-bp-section">
                        <h2 className="tn-bp-section-h2">Do & Avoid</h2>
                        <p className="tn-bp-section-desc">
                            Core principles to maintain when writing requirement specifications for automated test generation:
                        </p>

                        <div className="tn-bp-do-avoid-grid">
                            <div className="tn-bp-do-box">
                                <h3 className="tn-bp-do-title">
                                    <Check size={16} />
                                    Do
                                </h3>
                                <ul className="tn-bp-guideline-list">
                                    <li className="tn-bp-guideline-item">
                                        <Check size={14} className="tn-bp-check-icon" />
                                        <span>Define concrete expected behavior for all user interactions.</span>
                                    </li>
                                    <li className="tn-bp-guideline-item">
                                        <Check size={14} className="tn-bp-check-icon" />
                                        <span>Specify exact validation rules, regex formats, and field lengths.</span>
                                    </li>
                                    <li className="tn-bp-guideline-item">
                                        <Check size={14} className="tn-bp-check-icon" />
                                        <span>Include security and expiration constraints (e.g. single-use, TTL).</span>
                                    </li>
                                    <li className="tn-bp-guideline-item">
                                        <Check size={14} className="tn-bp-check-icon" />
                                        <span>Define user roles and required authorization levels.</span>
                                    </li>
                                    <li className="tn-bp-guideline-item">
                                        <Check size={14} className="tn-bp-check-icon" />
                                        <span>Mention external dependencies (gateways, SMTP, OAuth).</span>
                                    </li>
                                    <li className="tn-bp-guideline-item">
                                        <Check size={14} className="tn-bp-check-icon" />
                                        <span>Explicitly detail failure and boundary scenarios.</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="tn-bp-avoid-box">
                                <h3 className="tn-bp-avoid-title">
                                    <X size={16} />
                                    Avoid
                                </h3>
                                <ul className="tn-bp-guideline-list">
                                    <li className="tn-bp-guideline-item">
                                        <X size={14} className="tn-bp-cross-icon" />
                                        <span>Vague requirements with ambiguous acceptance criteria.</span>
                                    </li>
                                    <li className="tn-bp-guideline-item">
                                        <X size={14} className="tn-bp-cross-icon" />
                                        <span>Only describing the happy path while ignoring error handling.</span>
                                    </li>
                                    <li className="tn-bp-guideline-item">
                                        <X size={14} className="tn-bp-cross-icon" />
                                        <span>Leaving validation rules and error messages undefined.</span>
                                    </li>
                                    <li className="tn-bp-guideline-item">
                                        <X size={14} className="tn-bp-cross-icon" />
                                        <span>Assuming system behavior without documenting constraints.</span>
                                    </li>
                                    <li className="tn-bp-guideline-item">
                                        <X size={14} className="tn-bp-cross-icon" />
                                        <span>Omitting user permissions and unauthorized access states.</span>
                                    </li>
                                    <li className="tn-bp-guideline-item">
                                        <X size={14} className="tn-bp-cross-icon" />
                                        <span>Leaving edge cases and boundary limits unspecified.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* SECTION: Pre-Generation Requirement Checklist */}
                    <section id="requirement-checklist" className="tn-bp-section">
                        <h2 className="tn-bp-section-h2">Requirement Checklist</h2>
                        <p className="tn-bp-section-desc">
                            Before generating a test suite, ensure the requirement contains sufficient information to prevent coverage gaps and ambiguity.
                        </p>

                        <div className="tn-bp-checklist-card">
                            <div className="tn-bp-checklist-header">
                                <h3 className="tn-bp-checklist-title">Pre-Generation Verification</h3>
                                <span className="tn-bp-checklist-progress">
                                    {completedChecklistCount} of {CHECKLIST_ITEMS.length} verified
                                </span>
                            </div>

                            <div className="tn-bp-checklist-grid">
                                {CHECKLIST_ITEMS.map((item) => {
                                    const isChecked = Boolean(checkedItems[item.id]);
                                    return (
                                        <label
                                            key={item.id}
                                            className="tn-bp-check-label"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                toggleChecklistItem(item.id);
                                            }}
                                        >
                                            <div className={`tn-bp-custom-checkbox ${isChecked ? 'checked' : ''}`}>
                                                {isChecked && <Check size={12} color="#050505" strokeWidth={3} />}
                                            </div>
                                            <span className={`tn-bp-check-text ${isChecked ? 'checked' : ''}`}>
                                                {item.label}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* SECTION: Testnexa Workflow Guidance */}
                    <section id="testnexa-workflow" className="tn-bp-section">
                        <h2 className="tn-bp-section-h2">Get Better Test Suites from Testnexa</h2>
                        <p className="tn-bp-section-desc">
                            Follow this production QA engineering workflow to achieve reliable, reproducible test plans:
                        </p>

                        <ol className="tn-bp-steps-list">
                            <li className="tn-bp-step-item">
                                <span className="tn-bp-step-number">1</span>
                                <div className="tn-bp-step-content">
                                    <h3 className="tn-bp-step-title">Provide a Clear Requirement</h3>
                                    <p className="tn-bp-step-desc">
                                        Paste the user story, acceptance criteria, or technical specification. Ensure minimum length of 20 characters with explicit actor, inputs, and outcomes.
                                    </p>
                                </div>
                            </li>
                            <li className="tn-bp-step-item">
                                <span className="tn-bp-step-number">2</span>
                                <div className="tn-bp-step-content">
                                    <h3 className="tn-bp-step-title">Select the Target Platform</h3>
                                    <p className="tn-bp-step-desc">
                                        Choose <code>Web</code>, <code>Mobile</code>, or <code>API</code>. This shapes generated verification assertions, DOM vs network expectations, and environment-specific assertions.
                                    </p>
                                </div>
                            </li>
                            <li className="tn-bp-step-item">
                                <span className="tn-bp-step-number">3</span>
                                <div className="tn-bp-step-content">
                                    <h3 className="tn-bp-step-title">Choose Required Coverage Depth</h3>
                                    <p className="tn-bp-step-desc">
                                        Select <code>Essential</code> for sanity checks, <code>Standard</code> for regular sprints, or <code>Comprehensive</code> for critical security and payment flows.
                                    </p>
                                </div>
                            </li>
                            <li className="tn-bp-step-item">
                                <span className="tn-bp-step-number">4</span>
                                <div className="tn-bp-step-content">
                                    <h3 className="tn-bp-step-title">Generate the Test Suite</h3>
                                    <p className="tn-bp-step-desc">
                                        Testnexa analyzes requirements, derives test vectors, categorizes scenarios (functional, negative, edge cases), and assigns initial priority rankings.
                                    </p>
                                </div>
                            </li>
                            <li className="tn-bp-step-item">
                                <span className="tn-bp-step-number">5</span>
                                <div className="tn-bp-step-content">
                                    <h3 className="tn-bp-step-title">Review Coverage & Risk Insights</h3>
                                    <p className="tn-bp-step-desc">
                                        Inspect the generated test workbench: review identified coverage gaps, verify preconditions, and adjust test case priorities or assertions inline.
                                    </p>
                                </div>
                            </li>
                            <li className="tn-bp-step-item">
                                <span className="tn-bp-step-number">6</span>
                                <div className="tn-bp-step-content">
                                    <h3 className="tn-bp-step-title">Refine or Regenerate as Specs Change</h3>
                                    <p className="tn-bp-step-desc">
                                        When product requirements evolve, update the requirement text and create a new version snapshot to keep test suites synchronized with code changes.
                                    </p>
                                </div>
                            </li>
                        </ol>
                    </section>

                    {/* SECTION: API & UI Testing Guidelines */}
                    <section id="api-ui-guidelines" className="tn-bp-section">
                        <h2 className="tn-bp-section-h2">API & UI Testing Guidelines</h2>
                        <p className="tn-bp-section-desc">
                            Different testing tiers require distinct focus points when formulating requirements:
                        </p>

                        <div className="tn-bp-comparison-grid">
                            <div className="tn-bp-comp-card">
                                <h3 style={{ fontSize: '0.86rem', color: '#f5f5f5', margin: '0 0 8px' }}>REST API Guidelines</h3>
                                <ul className="tn-bp-case-list">
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Specify HTTP methods (GET, POST, PUT, DELETE)</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Document request header expectations (Authorization)</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Detail JSON body schemas and field types</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> List expected status codes (200, 201, 400, 401, 404, 500)</li>
                                </ul>
                            </div>

                            <div className="tn-bp-comp-card">
                                <h3 style={{ fontSize: '0.86rem', color: '#f5f5f5', margin: '0 0 8px' }}>Web & Mobile UI Guidelines</h3>
                                <ul className="tn-bp-case-list">
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Specify form field states (disabled, focus, error)</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Document loading spinners and button disablement</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Detail toast messages and inline validation banners</li>
                                    <li className="tn-bp-case-item"><span className="tn-bp-case-bullet" /> Specify navigation redirects after action completion</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* SECTION: Reviewing Test Cases */}
                    <section id="reviewing-test-cases" className="tn-bp-section">
                        <h2 className="tn-bp-section-h2">Reviewing Test Cases & Risks</h2>
                        <p className="tn-bp-section-desc">
                            Once a test suite is generated, review the test cases for alignment with business logic:
                        </p>

                        <ul className="tn-bp-guideline-list" style={{ marginBottom: '24px' }}>
                            <li className="tn-bp-guideline-item">
                                <Check size={14} className="tn-bp-check-icon" />
                                <span><strong>Audit Preconditions:</strong> Verify that required database records, sessions, or user states are explicitly documented.</span>
                            </li>
                            <li className="tn-bp-guideline-item">
                                <Check size={14} className="tn-bp-check-icon" />
                                <span><strong>Inspect Expected Results:</strong> Ensure assertions are measurable and verifiable (avoid subjective phrases like "works properly").</span>
                            </li>
                            <li className="tn-bp-guideline-item">
                                <Check size={14} className="tn-bp-check-icon" />
                                <span><strong>Review Risk Assessments:</strong> Check the identified risk items and confirm whether critical failure modes require additional negative tests.</span>
                            </li>
                        </ul>

                        {/* ─── Compact Contextual CTA ─── */}
                        <div className="tn-bp-cta-box">
                            <div className="tn-bp-cta-text-wrap">
                                <h3 className="tn-bp-cta-title">Ready to generate a test suite?</h3>
                                <p className="tn-bp-cta-desc">
                                    Apply these guidelines to your user stories in the Testnexa workspace.
                                </p>
                            </div>
                            <div className="tn-bp-cta-actions">
                                <Link to="/app/workspace" className="tn-bp-btn-primary">
                                    Generate Test Suite
                                    <ArrowRight size={14} />
                                </Link>
                                <Link to="/help" className="tn-bp-btn-secondary">
                                    View Documentation
                                </Link>
                            </div>
                        </div>
                    </section>
                </main>

                {/* ─── Right "On This Page" Navigation ─── */}
                <aside className="tn-bp-toc" aria-label="Table of Contents">
                    <h2 className="tn-bp-toc-heading">On This Page</h2>
                    <ul className="tn-bp-toc-list">
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-toc-btn ${activeSection === 'writing-requirements' ? 'active' : ''}`}
                                onClick={() => scrollTo('writing-requirements')}
                            >
                                Write clear requirements
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-toc-btn ${activeSection === 'expected-behavior' ? 'active' : ''}`}
                                onClick={() => scrollTo('expected-behavior')}
                            >
                                Define expected behavior
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-toc-btn ${activeSection === 'test-coverage' ? 'active' : ''}`}
                                onClick={() => scrollTo('test-coverage')}
                            >
                                Configure coverage
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-toc-btn ${activeSection === 'negative-edge-cases' ? 'active' : ''}`}
                                onClick={() => scrollTo('negative-edge-cases')}
                            >
                                Include negative cases
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-toc-btn ${activeSection === 'do-avoid' ? 'active' : ''}`}
                                onClick={() => scrollTo('do-avoid')}
                            >
                                Do and avoid
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-toc-btn ${activeSection === 'requirement-checklist' ? 'active' : ''}`}
                                onClick={() => scrollTo('requirement-checklist')}
                            >
                                Requirement checklist
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                className={`tn-bp-toc-btn ${activeSection === 'testnexa-workflow' ? 'active' : ''}`}
                                onClick={() => scrollTo('testnexa-workflow')}
                            >
                                Workflow guidance
                            </button>
                        </li>
                    </ul>
                </aside>
            </div>
        </div>
    );
};

export default BestPracticesPage;
