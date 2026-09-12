import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    Search, X, FileText, CheckSquare, Layers, AlertTriangle,
    GitBranch, Clock, ShieldCheck, Download, ChevronRight,
    ChevronDown, BookOpen, ExternalLink, HelpCircle, ArrowRight,
    Sparkles, CheckCircle2, MessageSquare, Terminal, RefreshCw
} from 'lucide-react';
import '../styles/HelpPage.css';

// ─── DOCUMENTATION ARTICLES DATA ───
const ARTICLES = [
    {
        id: 'first-test-suite',
        title: 'Creating Your First Test Suite',
        category: 'Getting Started',
        summary: 'Step-by-step guide to transforming raw product requirements into a structured, production-ready QA test suite.',
        lastUpdated: 'September 2026',
        keywords: ['create', 'generate', 'suite', 'requirement', 'start', 'first', 'workspace'],
        toc: [
            { id: 'overview', title: 'Overview' },
            { id: 'step-by-step', title: 'Step-by-Step Workflow' },
            { id: 'parameters', title: 'Configuring Parameters' },
            { id: 'reviewing', title: 'Reviewing the Output' },
            { id: 'next-steps', title: 'Next Steps' }
        ],
        content: (
            <>
                <section id="overview">
                    <h2>Overview</h2>
                    <p>
                        Testnexa AI allows software engineers and QA teams to translate unstructured user stories, Jira requirements, or product specifications into organized, production-grade test suites with positive, negative, and edge test cases.
                    </p>
                </section>

                <section id="step-by-step">
                    <h2>Step-by-Step Workflow</h2>
                    <ol>
                        <li>
                            <strong>Open AI Workspace:</strong> Navigate to the main workspace from the navigation menu or dashboard.
                        </li>
                        <li>
                            <strong>Enter Requirement:</strong> Provide a clear title (e.g., <em>Password Reset Flow</em>) and describe what the system should do in the requirement input area.
                        </li>
                        <li>
                            <strong>Select Target Environment:</strong> Choose whether the requirement applies to <em>Web</em>, <em>Mobile</em>, or <em>API</em>.
                        </li>
                        <li>
                            <strong>Select Coverage Depth:</strong> Pick from <em>Essential</em> (fast baseline), <em>Standard</em> (recommended balanced suite), or <em>Comprehensive</em> (deep security and risk analysis).
                        </li>
                        <li>
                            <strong>Generate Suite:</strong> Click <em>Generate Test Suite</em> to synthesize the requirements into structured test cases.
                        </li>
                    </ol>
                </section>

                <section id="parameters">
                    <h2>Configuring Parameters</h2>
                    <div className="help-article-callout">
                        <strong>Pro-Tip:</strong> The quality of generated test cases depends on the clarity of your requirement. Include specific acceptance criteria (e.g., character limits, session timeouts, and expected error messages) for the most thorough coverage.
                    </div>
                </section>

                <section id="reviewing">
                    <h2>Reviewing the Output</h2>
                    <p>
                        Once synthesis completes, your suite is organized into categorized scenarios with clear preconditions, sequential test steps, and exact expected assertions. You can edit any scenario inline or mark the suite as approved.
                    </p>
                </section>

                <section id="next-steps">
                    <h2>Next Steps</h2>
                    <p>
                        After generating your suite, explore the <strong>Coverage Matrix</strong> to verify requirement completeness or export the test cases to Playwright or Cypress.
                    </p>
                </section>
            </>
        ),
        related: ['effective-requirements', 'review-tests', 'coverage-guide']
    },
    {
        id: 'review-tests',
        title: 'Reviewing Generated Test Cases',
        category: 'Test Cases',
        summary: 'Understand the anatomy of test cases, verify assertions, and approve or refine scenarios before testing.',
        lastUpdated: 'September 2026',
        keywords: ['review', 'test cases', 'anatomy', 'steps', 'preconditions', 'assertions', 'approve'],
        toc: [
            { id: 'anatomy', title: 'Anatomy of a Test Case' },
            { id: 'verification', title: 'Verification Criteria' },
            { id: 'editing', title: 'Refining Scenarios' },
            { id: 'approval', title: 'Approving Suites' }
        ],
        content: (
            <>
                <section id="anatomy">
                    <h2>Anatomy of a Test Case</h2>
                    <p>Every test case in Testnexa is structured into distinct, deterministic components:</p>
                    <ul>
                        <li><strong>Identifier & Title:</strong> Unique scenario ID and descriptive action summary.</li>
                        <li><strong>Classification:</strong> Positive happy path, negative validation, edge condition, or security check.</li>
                        <li><strong>Preconditions:</strong> Required system state (e.g., <em>User authenticated with valid role</em>).</li>
                        <li><strong>Test Steps:</strong> Explicit, numbered reproduction steps.</li>
                        <li><strong>Expected Result:</strong> Concrete assertion verifiable in manual or automated testing.</li>
                    </ul>
                </section>
                <section id="verification">
                    <h2>Verification Criteria</h2>
                    <p>Check that all negative paths include proper error states and edge cases account for boundaries.</p>
                </section>
                <section id="editing">
                    <h2>Refining Scenarios</h2>
                    <p>Click any step or expected outcome to adjust wording to match your internal QA conventions.</p>
                </section>
            </>
        ),
        related: ['first-test-suite', 'coverage-guide', 'exporting-tests']
    },
    {
        id: 'coverage-guide',
        title: 'Understanding Requirement Coverage',
        category: 'Coverage & Traceability',
        summary: 'Learn how Testnexa measures requirement coverage, identifies untested edge vectors, and computes coverage percentages.',
        lastUpdated: 'September 2026',
        keywords: ['coverage', 'matrix', 'gap', 'percentage', 'traceability', 'requirements'],
        toc: [
            { id: 'calculation', title: 'How Coverage is Calculated' },
            { id: 'gaps', title: 'Detecting Coverage Gaps' },
            { id: 'improving', title: 'Improving Coverage' }
        ],
        content: (
            <>
                <section id="calculation">
                    <h2>How Coverage is Calculated</h2>
                    <p>
                        Coverage represents the percentage of explicit acceptance criteria and implied security/boundary conditions mapped to at least one verifying test scenario.
                    </p>
                    <div className="help-article-callout">
                        <strong>Formula:</strong> Coverage % = (Covered Acceptance Vectors / Total Identified Vectors) × 100%
                    </div>
                </section>
                <section id="gaps">
                    <h2>Detecting Coverage Gaps</h2>
                    <p>
                        The Coverage Matrix highlights uncovered risks (such as missing rate-limiting tests or unhandled special character inputs) in amber badges so you can add targeted scenarios.
                    </p>
                </section>
            </>
        ),
        related: ['traceability-guide', 'risks-guide', 'first-test-suite']
    },
    {
        id: 'history-guide',
        title: 'Working with Workspace History',
        category: 'Getting Started',
        summary: 'How previous generation sessions, snapshots, and suite versions are saved, retrieved, and continued.',
        lastUpdated: 'September 2026',
        keywords: ['history', 'sessions', 'snapshots', 'previous', 'restore', 'audit'],
        toc: [
            { id: 'sessions', title: 'Workspace Sessions' },
            { id: 'restoring', title: 'Restoring Previous Work' },
            { id: 'audit', title: 'Version Retention' }
        ],
        content: (
            <>
                <section id="sessions">
                    <h2>Workspace Sessions</h2>
                    <p>
                        Every test generation is stored in the workspace history. You can access all past sessions directly from the sidebar history group or by visiting <code>/app/history</code>.
                    </p>
                </section>
                <section id="restoring">
                    <h2>Restoring Previous Work</h2>
                    <p>
                        Clicking any history entry restores the exact requirement prompt, selected target, coverage depth, and generated test cases to your workbench.
                    </p>
                </section>
            </>
        ),
        related: ['first-test-suite', 'exporting-tests']
    },
    {
        id: 'effective-requirements',
        title: 'Writing Effective QA Requirements',
        category: 'Test Suite Generation',
        summary: 'Best practices for formatting user stories, acceptance criteria, and technical constraints to yield higher test quality.',
        lastUpdated: 'September 2026',
        keywords: ['requirements', 'writing', 'user stories', 'acceptance criteria', 'best practices'],
        toc: [
            { id: 'principles', title: 'Core Principles' },
            { id: 'template', title: 'Recommended Template' },
            { id: 'examples', title: 'Good vs Bad Examples' }
        ],
        content: (
            <>
                <section id="principles">
                    <h2>Core Principles</h2>
                    <ul>
                        <li><strong>Be Specific:</strong> Define exact input formats (e.g. minimum 8 characters, 1 special character).</li>
                        <li><strong>Include Failure Modes:</strong> State what should happen when invalid credentials or network drops occur.</li>
                        <li><strong>Specify State Changes:</strong> Note database changes, email notifications sent, or audit logs recorded.</li>
                    </ul>
                </section>
                <section id="template">
                    <h2>Recommended Template</h2>
                    <div className="help-article-callout">
                        <strong>Feature:</strong> [Feature Name]<br />
                        <strong>As a:</strong> [User Role]<br />
                        <strong>I want to:</strong> [Action]<br />
                        <strong>So that:</strong> [Business Goal]<br />
                        <strong>Acceptance Criteria:</strong><br />
                        - Condition 1<br />
                        - Condition 2
                    </div>
                </section>
            </>
        ),
        related: ['first-test-suite', 'review-tests']
    },
    {
        id: 'risks-guide',
        title: 'Identifying & Mitigating QA Risks',
        category: 'Risks & Edge Cases',
        summary: 'How to audit critical security vectors, auth bypasses, race conditions, and boundary degradation.',
        lastUpdated: 'September 2026',
        keywords: ['risks', 'security', 'vectors', 'vulnerabilities', 'mitigation', 'severity'],
        toc: [
            { id: 'classification', title: 'Risk Classification' },
            { id: 'mitigation', title: 'Mitigation Strategies' }
        ],
        content: (
            <>
                <section id="classification">
                    <h2>Risk Classification</h2>
                    <p>Testnexa identifies four primary risk vectors:</p>
                    <ul>
                        <li><strong>Authentication & Authorization:</strong> Token expiration, privilege escalation, and session spoofing.</li>
                        <li><strong>Data Integrity:</strong> Boundary truncation, injection, and invalid encoding.</li>
                        <li><strong>Concurrency & State:</strong> Double submits, race conditions, and distributed lock failures.</li>
                        <li><strong>Service Availability:</strong> Rate limiting, timeouts, and network degradation.</li>
                    </ul>
                </section>
            </>
        ),
        related: ['edge-cases', 'negative-testing', 'coverage-guide']
    },
    {
        id: 'traceability-guide',
        title: 'Requirement-to-Test Traceability',
        category: 'Coverage & Traceability',
        summary: 'Bidirectional mapping linking every acceptance criterion to specific positive, negative, and edge test cases.',
        lastUpdated: 'September 2026',
        keywords: ['traceability', 'matrix', 'mapping', 'compliance', 'audit', 'requirements'],
        toc: [
            { id: 'importance', title: 'Why Traceability Matters' },
            { id: 'matrix', title: 'Using the Traceability Matrix' }
        ],
        content: (
            <>
                <section id="importance">
                    <h2>Why Traceability Matters</h2>
                    <p>
                        In enterprise QA and audit compliance, teams must prove that every specified requirement is backed by concrete test verification.
                    </p>
                </section>
                <section id="matrix">
                    <h2>Using the Traceability Matrix</h2>
                    <p>
                        The Traceability Matrix in Testnexa maps requirement statements directly to verified test scenarios, highlighting untested gaps in red.
                    </p>
                </section>
            </>
        ),
        related: ['coverage-guide', 'review-tests']
    },
    {
        id: 'exporting-tests',
        title: 'Exporting Test Suites',
        category: 'Test Suite Generation',
        summary: 'Export test scenarios into automated frameworks like Playwright, Cypress, or standard CSV/JSON reports.',
        lastUpdated: 'September 2026',
        keywords: ['export', 'playwright', 'cypress', 'json', 'csv', 'gherkin', 'automation'],
        toc: [
            { id: 'formats', title: 'Available Export Formats' },
            { id: 'playwright', title: 'Playwright & Cypress Setup' }
        ],
        content: (
            <>
                <section id="formats">
                    <h2>Available Export Formats</h2>
                    <ul>
                        <li><strong>Playwright (TypeScript / Python):</strong> Ready-to-run test scripts with locator structures.</li>
                        <li><strong>Cypress (JavaScript):</strong> Spec files compatible with Cypress test runner.</li>
                        <li><strong>Gherkin / Cucumber:</strong> BDD feature files formatted with Given / When / Then syntax.</li>
                        <li><strong>JSON / CSV:</strong> Structured datasets for Jira, TestRail, or internal databases.</li>
                    </ul>
                </section>
            </>
        ),
        related: ['first-test-suite', 'review-tests']
    },
    {
        id: 'what-is-a-requirement',
        title: 'What is a Requirement?',
        category: 'QA Fundamentals',
        summary: 'A requirement specifies what an application must do to satisfy user expectations and business specifications.',
        lastUpdated: 'September 2026',
        keywords: ['requirement', 'definition', 'qa basics', 'fundamentals'],
        toc: [
            { id: 'definition', title: 'Definition' },
            { id: 'example', title: 'Real Example' }
        ],
        content: (
            <>
                <section id="definition">
                    <h2>Definition</h2>
                    <p>
                        A requirement is a formal description of system features, constraints, and business logic. It establishes the baseline against which software correctness is evaluated.
                    </p>
                </section>
                <section id="example">
                    <h2>Real Example</h2>
                    <div className="help-article-callout">
                        "User can initiate a password reset using their registered email and must receive an expiration link valid for 15 minutes."
                    </div>
                </section>
            </>
        ),
        related: ['what-is-a-test-case', 'effective-requirements']
    },
    {
        id: 'what-is-a-test-case',
        title: 'What is a Test Case?',
        category: 'QA Fundamentals',
        summary: 'A formalized verification scenario containing preconditions, sequential steps, and definitive pass/fail assertions.',
        lastUpdated: 'September 2026',
        keywords: ['test case', 'definition', 'assertions', 'steps', 'preconditions'],
        toc: [
            { id: 'definition', title: 'Definition' },
            { id: 'components', title: 'Core Components' }
        ],
        content: (
            <>
                <section id="definition">
                    <h2>Definition</h2>
                    <p>
                        A test case is a documented set of inputs, execution conditions, and expected outcomes designed to determine whether an application behaves as intended.
                    </p>
                </section>
                <section id="components">
                    <h2>Core Components</h2>
                    <p>Every test case includes preconditions, steps, test data, and expected results.</p>
                </section>
            </>
        ),
        related: ['what-is-a-requirement', 'negative-testing', 'review-tests']
    },
    {
        id: 'negative-testing',
        title: 'Negative Testing',
        category: 'QA Fundamentals',
        summary: 'Verification methodology designed to ensure software handles invalid inputs, crashes, and exceptions gracefully.',
        lastUpdated: 'September 2026',
        keywords: ['negative', 'error handling', 'validation', 'exceptions', 'robustness'],
        toc: [
            { id: 'definition', title: 'Definition' },
            { id: 'examples', title: 'Common Scenarios' }
        ],
        content: (
            <>
                <section id="definition">
                    <h2>Definition</h2>
                    <p>
                        Negative testing tests a software application for unexpected inputs and boundary violations to ensure the application does not crash and provides clear error feedback.
                    </p>
                </section>
                <section id="examples">
                    <h2>Common Scenarios</h2>
                    <ul>
                        <li>Entering malformed email addresses.</li>
                        <li>Submitting empty required fields.</li>
                        <li>Using expired or tampered session tokens.</li>
                    </ul>
                </section>
            </>
        ),
        related: ['edge-cases', 'what-is-a-test-case']
    },
    {
        id: 'edge-cases',
        title: 'Edge Cases & Boundary Analysis',
        category: 'QA Fundamentals',
        summary: 'Testing behaviors at extreme operational thresholds, null states, and concurrency boundaries.',
        lastUpdated: 'September 2026',
        keywords: ['edge cases', 'boundary', 'extreme', 'limits', 'thresholds'],
        toc: [
            { id: 'definition', title: 'Definition' },
            { id: 'why-matters', title: 'Why Edge Cases Matter' }
        ],
        content: (
            <>
                <section id="definition">
                    <h2>Definition</h2>
                    <p>
                        An edge case occurs at the extreme minimum or maximum operating parameter (boundary condition). While infrequent in casual usage, edge cases account for the majority of production defects.
                    </p>
                </section>
                <section id="why-matters">
                    <h2>Why Edge Cases Matter</h2>
                    <p>Testing boundary values (e.g. 0, 1, max integer, 10,000 simultaneous users) catches memory leaks and off-by-one errors.</p>
                </section>
            </>
        ),
        related: ['negative-testing', 'risks-guide']
    }
];

// ─── FAQ ACCORDIONS DATA ───
const FAQS = [
    {
        question: 'How does Testnexa generate test cases?',
        answer: 'Testnexa parses your natural-language requirement, decomposes it into explicit acceptance criteria and implied failure modes, and applies structured QA heuristics across positive paths, negative error states, edge boundaries, and security vectors to generate executable test scenarios.'
    },
    {
        question: 'Can I edit generated test cases?',
        answer: 'Yes. From any Test Suite detail page, you can click on individual test cases to update their preconditions, execution steps, or expected assertions to match your exact internal specifications.'
    },
    {
        question: 'Can I regenerate an individual test case or scenario?',
        answer: 'Yes. You can regenerate individual test scenarios or adjust the coverage depth (e.g. Essential, Standard, or Comprehensive) to re-synthesize variations of specific test vectors.'
    },
    {
        question: 'How is requirement coverage calculated?',
        answer: 'Coverage is calculated as the ratio of verified acceptance criteria and risk conditions to the total requirements identified in your prompt. The Coverage Matrix displays full percentage breakdowns across Web, Mobile, and API surfaces.'
    },
    {
        question: 'Can I export my test suite into Playwright or Cypress?',
        answer: 'Yes. Testnexa provides direct exports into runnable Playwright (TypeScript and Python), Cypress (JavaScript), Gherkin / Cucumber BDD feature files, and standard JSON/CSV reports.'
    },
    {
        question: 'Where can I find my previous test suites?',
        answer: 'All your previous generation sessions and snapshots are automatically saved to your workspace History. You can access them at any time from the application sidebar or by visiting /app/history.'
    }
];

// ─── DOCUMENTATION CATEGORIES ───
const CATEGORIES = [
    {
        title: 'Getting Started',
        desc: 'Learn the core workflow, terminology, and interface of Testnexa.',
        icon: FileText,
        articleId: 'first-test-suite'
    },
    {
        title: 'Test Suite Generation',
        desc: 'Craft effective requirements, choose coverage depth, and synthesize tests.',
        icon: CheckSquare,
        articleId: 'effective-requirements'
    },
    {
        title: 'Test Cases',
        desc: 'Inspect preconditions, steps, assertions, and verification tags.',
        icon: Layers,
        articleId: 'review-tests'
    },
    {
        title: 'Coverage & Traceability',
        desc: 'Analyze coverage percentages, detect gaps, and map requirements.',
        icon: GitBranch,
        articleId: 'coverage-guide'
    },
    {
        title: 'Risks & Edge Cases',
        desc: 'Audit critical failure vectors, boundary thresholds, and security vectors.',
        icon: AlertTriangle,
        articleId: 'risks-guide'
    },
    {
        title: 'Account & Workspace',
        desc: 'Manage personal profile, billing subscription, and active security sessions.',
        icon: ShieldCheck,
        link: '/app/settings'
    }
];

const HelpPage = () => {
    const { articleId } = useParams();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [openFaqIndices, setOpenFaqIndices] = useState({});

    // Active article lookup
    const activeArticle = useMemo(() => {
        if (!articleId) return null;
        return ARTICLES.find(a => a.id === articleId) || null;
    }, [articleId]);

    // Live search results
    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return [];

        return ARTICLES.filter(article => {
            const inTitle = article.title.toLowerCase().includes(query);
            const inSummary = article.summary.toLowerCase().includes(query);
            const inCategory = article.category.toLowerCase().includes(query);
            const inKeywords = article.keywords.some(k => k.toLowerCase().includes(query));
            return inTitle || inSummary || inCategory || inKeywords;
        });
    }, [searchQuery]);

    const toggleFaq = (idx) => {
        setOpenFaqIndices(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    return (
        <div className="help-center-root">
            <div className="help-container">
                {/* ─── BREADCRUMBS ─── */}
                <nav className="help-breadcrumbs" aria-label="Breadcrumb">
                    <Link to="/" className="help-breadcrumb-link">Home</Link>
                    <ChevronRight size={13} style={{ opacity: 0.4 }} />
                    <Link to="/help" className="help-breadcrumb-link">Help Center</Link>
                    {activeArticle && (
                        <>
                            <ChevronRight size={13} style={{ opacity: 0.4 }} />
                            <span style={{ color: '#737373' }}>{activeArticle.category}</span>
                            <ChevronRight size={13} style={{ opacity: 0.4 }} />
                            <span className="help-breadcrumb-current">{activeArticle.title}</span>
                        </>
                    )}
                </nav>

                {/* ══════════════ ARTICLE VIEW ══════════════ */}
                {activeArticle ? (
                    <div className="help-article-view">
                        <div style={{ marginBottom: '1.5rem' }}>
                            <Link
                                to="/help"
                                className="help-btn help-btn--secondary"
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', minHeight: '32px' }}
                            >
                                ← Back to Help Center
                            </Link>
                        </div>

                        <div className="help-article-layout">
                            {/* Left Table of Contents */}
                            <aside className="help-article-toc" aria-label="Table of contents">
                                <span className="help-article-toc-title">Contents</span>
                                {activeArticle.toc.map(item => (
                                    <a key={item.id} href={`#${item.id}`} className="help-article-toc-link">
                                        {item.title}
                                    </a>
                                ))}
                            </aside>

                            {/* Article Body */}
                            <article className="help-article-body">
                                <header className="help-article-header">
                                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#00D9C0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {activeArticle.category}
                                    </span>
                                    <h1 className="help-article-title">{activeArticle.title}</h1>
                                    <p className="help-article-lead">{activeArticle.summary}</p>
                                    <div className="help-article-meta">
                                        <span>Last updated: {activeArticle.lastUpdated}</span>
                                        <span>•</span>
                                        <span>Product Documentation</span>
                                    </div>
                                </header>

                                <div className="help-article-content">
                                    {activeArticle.content}
                                </div>

                                {/* Related Articles */}
                                {activeArticle.related && activeArticle.related.length > 0 && (
                                    <div className="help-article-related">
                                        <h3 className="help-article-related-title">Related Guides</h3>
                                        <div className="help-cards-grid">
                                            {activeArticle.related.map(relId => {
                                                const rel = ARTICLES.find(a => a.id === relId);
                                                if (!rel) return null;
                                                return (
                                                    <Link key={rel.id} to={`/help/${rel.id}`} className="help-card">
                                                        <h4 className="help-card-title">{rel.title}</h4>
                                                        <p className="help-card-desc">{rel.summary}</p>
                                                        <span className="help-card-link">
                                                            Read guide <ArrowRight size={12} />
                                                        </span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </article>
                        </div>
                    </div>
                ) : (
                    /* ══════════════ MAIN HELP CENTER HUB ══════════════ */
                    <div className="help-hub">
                        {/* Hero Section */}
                        <header className="help-hero">
                            <div className="help-hero__badge">
                                <BookOpen size={13} />
                                <span>Product Documentation</span>
                            </div>
                            <h1 className="help-hero__title">Help Center</h1>
                            <p className="help-hero__desc">
                                Find answers, learn how Testnexa works, and get the most out of your QA workflow.
                            </p>

                            {/* Prominent Search Bar */}
                            <div className="help-search-box">
                                <Search size={18} className="help-search-icon" />
                                <input
                                    type="text"
                                    className="help-search-input"
                                    placeholder="Search guides, features, test suites, coverage..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    aria-label="Search documentation"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="help-search-clear"
                                        onClick={() => setSearchQuery('')}
                                        aria-label="Clear search"
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>
                        </header>

                        {/* Search Results Display */}
                        {searchQuery.trim() !== '' && (
                            <section className="help-search-results" aria-live="polite">
                                <div className="help-search-results-header">
                                    <span>Search results ({searchResults.length})</span>
                                    {searchResults.length > 0 && <span>Click any result to read guide</span>}
                                </div>

                                {searchResults.length > 0 ? (
                                    searchResults.map(result => (
                                        <Link key={result.id} to={`/help/${result.id}`} className="help-result-card">
                                            <div className="help-result-card__top">
                                                <span className="help-result-card__title">{result.title}</span>
                                                <span className="help-result-card__cat">{result.category}</span>
                                            </div>
                                            <p className="help-result-card__desc">{result.summary}</p>
                                        </Link>
                                    ))
                                ) : (
                                    <div className="help-search-empty">
                                        <AlertTriangle size={24} color="#A3A3A3" />
                                        <h3>No results found for "{searchQuery}"</h3>
                                        <p>Try searching for terms like "coverage", "test case", "requirements", or "export".</p>
                                        <Link to="/contact" className="help-btn help-btn--secondary" style={{ marginTop: '0.5rem' }}>
                                            Contact Support
                                        </Link>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* ─── SECTION 1: GETTING STARTED ─── */}
                        <section className="help-section">
                            <div className="help-section-header">
                                <span className="help-section-label">Getting Started</span>
                                <h2 className="help-section-title">Start here if you're new to Testnexa</h2>
                                <p className="help-section-desc">Essential workflows to turn requirements into high-coverage test suites.</p>
                            </div>

                            <div className="help-cards-grid">
                                <Link to="/help/first-test-suite" className="help-card">
                                    <div className="help-card-icon-wrap">
                                        <FileText size={16} />
                                    </div>
                                    <h3 className="help-card-title">Create your first test suite</h3>
                                    <p className="help-card-desc">Learn how to input requirements, set coverage depth, and generate test scenarios.</p>
                                    <span className="help-card-link">Read guide <ArrowRight size={12} /></span>
                                </Link>

                                <Link to="/help/review-tests" className="help-card">
                                    <div className="help-card-icon-wrap">
                                        <CheckSquare size={16} />
                                    </div>
                                    <h3 className="help-card-title">Review generated tests</h3>
                                    <p className="help-card-desc">Understand preconditions, execution steps, expected assertions, and review workflows.</p>
                                    <span className="help-card-link">Read guide <ArrowRight size={12} /></span>
                                </Link>

                                <Link to="/help/coverage-guide" className="help-card">
                                    <div className="help-card-icon-wrap">
                                        <Layers size={16} />
                                    </div>
                                    <h3 className="help-card-title">Understand coverage</h3>
                                    <p className="help-card-desc">Learn how requirement coverage is measured and how to eliminate untested edge gaps.</p>
                                    <span className="help-card-link">Read guide <ArrowRight size={12} /></span>
                                </Link>

                                <Link to="/help/history-guide" className="help-card">
                                    <div className="help-card-icon-wrap">
                                        <Clock size={16} />
                                    </div>
                                    <h3 className="help-card-title">Use History</h3>
                                    <p className="help-card-desc">Find, restore, and continue previous generation sessions and saved test suite snapshots.</p>
                                    <span className="help-card-link">Read guide <ArrowRight size={12} /></span>
                                </Link>
                            </div>
                        </section>

                        {/* ─── SECTION 2: DOCUMENTATION CATEGORIES ─── */}
                        <section className="help-section">
                            <div className="help-section-header">
                                <span className="help-section-label">Documentation</span>
                                <h2 className="help-section-title">Explore documentation by topic</h2>
                                <p className="help-section-desc">Comprehensive reference guides for all features and QA methodologies.</p>
                            </div>

                            <div className="help-category-grid">
                                {CATEGORIES.map((cat, i) => {
                                    const Icon = cat.icon;
                                    const destination = cat.link || `/help/${cat.articleId}`;
                                    return (
                                        <Link key={i} to={destination} className="help-category-card">
                                            <div className="help-card-icon-wrap">
                                                <Icon size={16} />
                                            </div>
                                            <div className="help-category-content">
                                                <h3 className="help-category-title">{cat.title}</h3>
                                                <p className="help-category-desc">{cat.desc}</p>
                                            </div>
                                            <ChevronRight size={16} className="help-category-arrow" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>

                        {/* ─── SECTION 3: QA FUNDAMENTALS ─── */}
                        <section className="help-section">
                            <div className="help-section-header">
                                <span className="help-section-label">QA Fundamentals</span>
                                <h2 className="help-section-title">Core software quality principles</h2>
                                <p className="help-section-desc">Foundational testing concepts implemented by the Testnexa platform.</p>
                            </div>

                            <div className="help-qa-list">
                                <div className="help-qa-row">
                                    <div className="help-qa-title">
                                        <FileText size={16} color="#00D9C0" />
                                        <span>Requirement</span>
                                    </div>
                                    <div>
                                        <p className="help-qa-desc">A formal description of what a system should do and how it should respond to user actions.</p>
                                        <span className="help-qa-example">Example: "User can reset password with an email link valid for 15 minutes."</span>
                                    </div>
                                    <Link to="/help/what-is-a-requirement" className="help-btn help-btn--secondary" style={{ padding: '0.35rem 0.75rem', minHeight: '32px', fontSize: '0.78rem' }}>
                                        Read article →
                                    </Link>
                                </div>

                                <div className="help-qa-row">
                                    <div className="help-qa-title">
                                        <CheckSquare size={16} color="#00D9C0" />
                                        <span>Test Case</span>
                                    </div>
                                    <div>
                                        <p className="help-qa-desc">A structured scenario with preconditions, execution steps, and expected outcome assertions.</p>
                                        <span className="help-qa-example">Example: "Verify redirect to dashboard and session token creation after valid login."</span>
                                    </div>
                                    <Link to="/help/what-is-a-test-case" className="help-btn help-btn--secondary" style={{ padding: '0.35rem 0.75rem', minHeight: '32px', fontSize: '0.78rem' }}>
                                        Read article →
                                    </Link>
                                </div>

                                <div className="help-qa-row">
                                    <div className="help-qa-title">
                                        <X size={16} color="#F87171" />
                                        <span>Negative Testing</span>
                                    </div>
                                    <div>
                                        <p className="help-qa-desc">Testing how the system handles invalid input, boundary violations, or unexpected user behavior.</p>
                                        <span className="help-qa-example">Example: "Verify validation error when submitting password shorter than 8 characters."</span>
                                    </div>
                                    <Link to="/help/negative-testing" className="help-btn help-btn--secondary" style={{ padding: '0.35rem 0.75rem', minHeight: '32px', fontSize: '0.78rem' }}>
                                        Read article →
                                    </Link>
                                </div>

                                <div className="help-qa-row">
                                    <div className="help-qa-title">
                                        <AlertTriangle size={16} color="#FBBF24" />
                                        <span>Edge Cases</span>
                                    </div>
                                    <div>
                                        <p className="help-qa-desc">Testing behaviors at extreme operational thresholds, null values, and concurrency conditions.</p>
                                        <span className="help-qa-example">Example: "Verify system response when 10,000 users initiate checkout at the same second."</span>
                                    </div>
                                    <Link to="/help/edge-cases" className="help-btn help-btn--secondary" style={{ padding: '0.35rem 0.75rem', minHeight: '32px', fontSize: '0.78rem' }}>
                                        Read article →
                                    </Link>
                                </div>
                            </div>
                        </section>

                        {/* ─── SECTION 4: FEATURE GUIDES ─── */}
                        <section className="help-section">
                            <div className="help-section-header">
                                <span className="help-section-label">Feature Guides</span>
                                <h2 className="help-section-title">In-depth workflows for each tool</h2>
                                <p className="help-section-desc">Learn how each component in Testnexa accelerates the QA lifecycle.</p>
                            </div>

                            <div className="help-cards-grid">
                                <Link to="/help/first-test-suite" className="help-card">
                                    <h3 className="help-card-title">Test Suite Generator</h3>
                                    <p className="help-card-desc">Generate production-ready test scenarios from user stories in seconds.</p>
                                    <span className="help-card-link">View guide →</span>
                                </Link>

                                <Link to="/help/coverage-guide" className="help-card">
                                    <h3 className="help-card-title">Coverage Matrix</h3>
                                    <p className="help-card-desc">Understand requirement coverage, track tested surfaces, and isolate gaps.</p>
                                    <span className="help-card-link">View guide →</span>
                                </Link>

                                <Link to="/help/risks-guide" className="help-card">
                                    <h3 className="help-card-title">Risk Analysis</h3>
                                    <p className="help-card-desc">Identify high-risk authentication, data integrity, and concurrency vectors.</p>
                                    <span className="help-card-link">View guide →</span>
                                </Link>

                                <Link to="/help/traceability-guide" className="help-card">
                                    <h3 className="help-card-title">Traceability</h3>
                                    <p className="help-card-desc">Connect every requirement statement to its verifying positive and negative tests.</p>
                                    <span className="help-card-link">View guide →</span>
                                </Link>

                                <Link to="/help/history-guide" className="help-card">
                                    <h3 className="help-card-title">History Snapshots</h3>
                                    <p className="help-card-desc">Return to previous QA sessions, recover requirements, and review revisions.</p>
                                    <span className="help-card-link">View guide →</span>
                                </Link>

                                <Link to="/help/exporting-tests" className="help-card">
                                    <h3 className="help-card-title">Suite Export</h3>
                                    <p className="help-card-desc">Export test suites into Playwright, Cypress, Gherkin, JSON, or CSV formats.</p>
                                    <span className="help-card-link">View guide →</span>
                                </Link>
                            </div>
                        </section>

                        {/* ─── SECTION 5: FAQ ACCORDION ─── */}
                        <section className="help-section">
                            <div className="help-section-header">
                                <span className="help-section-label">FAQ</span>
                                <h2 className="help-section-title">Frequently Asked Questions</h2>
                                <p className="help-section-desc">Common questions about generation, coverage, and exports.</p>
                            </div>

                            <div className="help-faq-list">
                                {FAQS.map((faq, idx) => {
                                    const isOpen = !!openFaqIndices[idx];
                                    return (
                                        <div key={idx} className={`help-faq-item ${isOpen ? 'is-open' : ''}`}>
                                            <button
                                                type="button"
                                                className="help-faq-trigger"
                                                onClick={() => toggleFaq(idx)}
                                                aria-expanded={isOpen}
                                            >
                                                <span>{faq.question}</span>
                                                <ChevronDown size={16} className="help-faq-chevron" />
                                            </button>
                                            {isOpen && (
                                                <div className="help-faq-content">
                                                    {faq.answer}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* ─── SECTION 6: SUPPORT CTA ─── */}
                        <section className="help-support-box">
                            <div className="help-support-info">
                                <h3>Still need help?</h3>
                                <p>Can't find what you're looking for? Reach out to our engineering support team.</p>
                            </div>
                            <div className="help-support-actions">
                                <Link to="/contact" className="help-btn help-btn--primary">
                                    Contact Support
                                </Link>
                                <Link to="/app/workspace" className="help-btn help-btn--secondary">
                                    Open Workspace
                                </Link>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HelpPage;
