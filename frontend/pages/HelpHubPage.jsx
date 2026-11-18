import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
    ArrowRight, ChevronDown, ChevronRight, FileText,
    Layers, Shield, GitBranch, Terminal, HelpCircle,
    CheckCircle2, Compass, LifeBuoy, BookOpen
} from 'lucide-react';
import helpIndex from '../content/help-index.json';
import HelpSearchBar from '../components/help/HelpSearchBar';
import ContactSupportModal from '../components/help/ContactSupportModal';

// Icons for category rows
const CATEGORY_ICONS = {
    'getting-started': Compass,
    'test-authoring': FileText,
    'analysis': Layers,
    'export': Terminal,
    'integrations': GitBranch,
    'security': Shield,
    'account': BookOpen,
    'execution': CheckCircle2,
    'troubleshooting': HelpCircle,
    'resources': BookOpen
};

const POPULAR_SLUGS = [
    'create-your-first-test-suite',
    'linked-vs-verified-coverage',
    'review-and-approve-cases',
    'export-formats'
];

const FAQS = [
    {
        id: 'faq-1',
        question: 'How does Testnexa generate test cases?',
        answer: 'Testnexa parses your natural language requirements or acceptance criteria, evaluates them against established QA heuristics across positive, negative, and edge vectors, and produces deterministic test cases with clear preconditions, steps, and expected outcomes.'
    },
    {
        id: 'faq-2',
        question: 'Does Testnexa save incomplete drafts or session history?',
        answer: 'No. Testnexa operates statelessly during generation. Nothing is stored in your workspace until a test suite is fully generated and saved. Testnexa does not maintain unfinished drafts or unsaved generation history.'
    },
    {
        id: 'faq-3',
        question: 'What is the difference between Linked and Verified coverage?',
        answer: 'Linked coverage is a design-time metric representing requirement acceptance criteria mapped to approved test cases. Verified coverage is an execution-time metric representing test cases that have successfully executed and passed within your CI/CD runner.'
    },
    {
        id: 'faq-4',
        question: 'Does Testnexa execute tests directly in the cloud?',
        answer: 'Test execution is currently performed inside your own CI/CD pipeline (such as GitHub Actions) using exported Playwright suites. In-app cloud test execution is coming soon in Phase 2.'
    },
    {
        id: 'faq-5',
        question: 'Which export formats are supported?',
        answer: 'Testnexa supports exporting approved test suites to Playwright (TypeScript and Python), Cypress (JavaScript), Cucumber/Gherkin (.feature files), and standard JSON and CSV data interchange formats.'
    }
];

export const HelpHubPage = () => {
    const outletCtx = useOutletContext();
    const [localSupportOpen, setLocalSupportOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState({ 'faq-1': true });

    const openSupport = outletCtx?.onOpenSupport || (() => setLocalSupportOpen(true));

    const toggleFaq = (id) => {
        setOpenFaq(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Find popular guide objects
    const popularGuides = helpIndex.articles.filter(a => POPULAR_SLUGS.includes(a.slug));

    return (
        <>
            <main id="help-main-content" className="help-hub-main" tabIndex="-1">
                {/* ─── Hero Section ─── */}
                <section className="help-hub-hero">
                    <div className="help-hub-hero-inner">
                        <span className="help-eyebrow">Documentation & guides</span>
                        <h1 className="help-hub-title">Help center</h1>
                        <p className="help-hub-desc">
                            Find technical documentation, architecture overviews, and step-by-step guides for generating and verifying test suites.
                        </p>

                        <div className="help-hub-search-wrap">
                            <HelpSearchBar onOpenSupport={openSupport} autoFocus={false} />
                        </div>
                    </div>
                </section>

                <div className="help-hub-container">
                    {/* ─── Popular Guides ─── */}
                    <section className="help-hub-section" aria-labelledby="heading-popular-guides">
                        <div className="help-section-header">
                            <span className="help-eyebrow">Popular guides</span>
                            <h2 id="heading-popular-guides" className="help-section-title">
                                Recommended for getting started
                            </h2>
                        </div>

                        <div className="help-popular-grid">
                            {popularGuides.map((guide) => (
                                <Link key={guide.slug} to={guide.url} className="help-popular-card">
                                    <div className="help-popular-card-top">
                                        <span className="help-popular-card-category">{guide.categoryName}</span>
                                        <span className="help-popular-card-time">{guide.readingTimeMinutes} min read</span>
                                    </div>
                                    <h3 className="help-popular-card-title">{guide.title}</h3>
                                    <p className="help-popular-card-desc">{guide.description}</p>
                                    <div className="help-popular-card-arrow">
                                        <span>Read guide</span>
                                        <ArrowRight size={14} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* ─── Browse by Topic ─── */}
                    <section className="help-hub-section" aria-labelledby="heading-browse-topics">
                        <div className="help-section-header">
                            <span className="help-eyebrow">Browse by topic</span>
                            <h2 id="heading-browse-topics" className="help-section-title">
                                Explore all documentation categories
                            </h2>
                        </div>

                        <div className="help-topic-list">
                            {helpIndex.categories.map((cat) => {
                                const IconComponent = CATEGORY_ICONS[cat.id] || FileText;
                                const firstArticle = cat.articles[0];
                                return (
                                    <div key={cat.id} className="help-topic-row">
                                        <div className="help-topic-row-icon">
                                            <IconComponent size={18} />
                                        </div>
                                        <div className="help-topic-row-info">
                                            <div className="help-topic-row-header">
                                                <h3 className="help-topic-row-name">{cat.name}</h3>
                                                <span className="help-topic-row-count">
                                                    {cat.count} article{cat.count !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <p className="help-topic-row-desc">{cat.description}</p>

                                            <div className="help-topic-article-links">
                                                {cat.articles.slice(0, 3).map((art) => (
                                                    <Link key={art.slug} to={art.url} className="help-topic-sublink">
                                                        <span>{art.title}</span>
                                                    </Link>
                                                ))}
                                                {cat.count > 3 && firstArticle && (
                                                    <Link to={firstArticle.url} className="help-topic-more-link">
                                                        <span>+{cat.count - 3} more</span>
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                        <div className="help-topic-row-action">
                                            {firstArticle && (
                                                <Link to={firstArticle.url} className="help-topic-action-btn" aria-label={`View ${cat.name} articles`}>
                                                    <ChevronRight size={16} />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* ─── Top Questions (FAQ) ─── */}
                    <section className="help-hub-section" aria-labelledby="heading-top-questions">
                        <div className="help-section-header">
                            <span className="help-eyebrow">Frequently asked questions</span>
                            <h2 id="heading-top-questions" className="help-section-title">
                                Top questions about Testnexa
                            </h2>
                        </div>

                        <div className="help-faq-list" role="region" aria-label="Frequently Asked Questions Accordions">
                            {FAQS.map((faq) => {
                                const isOpen = !!openFaq[faq.id];
                                return (
                                    <div key={faq.id} className={`help-faq-item ${isOpen ? 'is-open' : ''}`}>
                                        <button
                                            type="button"
                                            onClick={() => toggleFaq(faq.id)}
                                            className="help-faq-question-btn"
                                            aria-expanded={isOpen}
                                            aria-controls={`${faq.id}-answer`}
                                        >
                                            <span className="help-faq-question-text">{faq.question}</span>
                                            <ChevronDown size={16} className={`help-faq-chevron ${isOpen ? 'is-rotated' : ''}`} />
                                        </button>
                                        <div
                                            id={`${faq.id}-answer`}
                                            className="help-faq-answer-panel"
                                            hidden={!isOpen}
                                        >
                                            <p className="help-faq-answer-text">{faq.answer}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* ─── Support & Status Block ─── */}
                    <section className="help-hub-section">
                        <div className="help-support-card">
                            <div className="help-support-card-left">
                                <div className="help-support-card-icon">
                                    <LifeBuoy size={24} />
                                </div>
                                <div>
                                    <h2 className="help-support-card-title">Still have questions?</h2>
                                    <p className="help-support-card-desc">
                                        Our engineering and QA specialists typically respond within 4 business hours. No bots, just direct assistance.
                                    </p>
                                </div>
                            </div>
                            <div className="help-support-card-right">
                                <button
                                    type="button"
                                    onClick={openSupport}
                                    className="help-btn-primary"
                                >
                                    Contact support
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {/* Fallback if rendered outside HelpLayout */}
            {!outletCtx && (
                <ContactSupportModal
                    isOpen={localSupportOpen}
                    onClose={() => setLocalSupportOpen(false)}
                />
            )}
        </>
    );
};

export default HelpHubPage;
