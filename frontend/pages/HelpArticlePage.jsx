import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import {
    ChevronRight, ArrowLeft, ArrowRight, Check, Copy,
    ThumbsUp, ThumbsDown, MessageSquare, ExternalLink,
    AlertTriangle, Info, CheckCircle2, List, ChevronDown,
    Share2, Calendar, Clock, BookOpen
} from 'lucide-react';
import helpIndex from '../content/help-index.json';
import ContactSupportModal from '../components/help/ContactSupportModal';

// Mapping for legacy / deprecated URLs
const LEGACY_SLUG_MAP = {
    'first-test-suite': { category: 'getting-started', slug: 'create-your-first-test-suite' },
    'getting-started-overview': { category: 'getting-started', slug: 'create-your-first-test-suite' },
    'requirement-to-tests': { category: 'getting-started', slug: 'create-your-first-test-suite' },
    'test-case-structure': { category: 'test-authoring', slug: 'review-and-approve-cases' },
    'coverage-analysis-guide': { category: 'analysis', slug: 'linked-vs-verified-coverage' },
    'traceability-matrix-guide': { category: 'analysis', slug: 'linked-vs-verified-coverage' },
    'risk-assessment-guide': { category: 'analysis', slug: 'risks' },
    'exporting-tests': { category: 'export', slug: 'export-formats' },
    'heuristics-engine': { category: 'resources', slug: 'glossary' },
    'glossary': { category: 'resources', slug: 'glossary' }
};

export const HelpArticlePage = () => {
    const { category, slug, articleId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const outletCtx = useOutletContext();

    const [localSupportOpen, setLocalSupportOpen] = useState(false);
    const [activeSectionId, setActiveSectionId] = useState('');
    const [copiedAnchorId, setCopiedAnchorId] = useState(null);
    const [copiedCodeIndex, setCopiedCodeIndex] = useState(null);
    const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);

    const openSupport = outletCtx?.onOpenSupport || (() => setLocalSupportOpen(true));

    // Feedback widget state
    const [feedbackVote, setFeedbackVote] = useState(null); // true | false
    const [feedbackComment, setFeedbackComment] = useState('');
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

    // Resolve current article
    const currentArticle = useMemo(() => {
        // Direct category and slug match
        if (category && slug) {
            const found = helpIndex.articles.find(a => a.category === category && a.slug === slug);
            if (found) return found;
        }

        // Handle single param :articleId or fallback
        const targetSlug = slug || articleId || category;
        if (targetSlug) {
            // Check legacy map first
            if (LEGACY_SLUG_MAP[targetSlug]) {
                const mapped = LEGACY_SLUG_MAP[targetSlug];
                return helpIndex.articles.find(a => a.category === mapped.category && a.slug === mapped.slug) || null;
            }
            // Check direct slug match across any category
            const foundBySlug = helpIndex.articles.find(a => a.slug === targetSlug);
            if (foundBySlug) return foundBySlug;
        }

        // Default to first getting started article
        return helpIndex.articles[0];
    }, [category, slug, articleId]);

    // Handle URL normalization redirect if accessed via legacy route
    useEffect(() => {
        if (currentArticle && (category !== currentArticle.category || slug !== currentArticle.slug)) {
            navigate(`/help/${currentArticle.category}/${currentArticle.slug}${location.hash || ''}`, { replace: true });
        }
    }, [currentArticle, category, slug, navigate, location.hash]);

    // Scroll to top or anchor on navigation
    useEffect(() => {
        if (location.hash) {
            const targetId = location.hash.replace('#', '');
            const el = document.getElementById(targetId);
            if (el) {
                setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        } else {
            window.scrollTo(0, 0);
        }
    }, [location.pathname, location.hash]);

    // Check existing feedback in sessionStorage
    useEffect(() => {
        if (currentArticle) {
            const key = `tn_feedback_${currentArticle.slug}`;
            const existing = sessionStorage.getItem(key);
            if (existing) {
                setFeedbackSubmitted(true);
                setFeedbackVote(existing === 'yes');
            } else {
                setFeedbackSubmitted(false);
                setFeedbackVote(null);
                setFeedbackComment('');
            }
        }
    }, [currentArticle]);

    // ScrollSpy observer for sticky Table of Contents
    useEffect(() => {
        if (!currentArticle) return;
        const headingElements = currentArticle.toc
            .map(item => document.getElementById(item.id))
            .filter(Boolean);

        if (headingElements.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.find(e => e.isIntersecting);
                if (visible) {
                    setActiveSectionId(visible.target.id);
                }
            },
            { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
        );

        headingElements.forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, [currentArticle]);

    // Find Previous and Next articles
    const { prevArticle, nextArticle } = useMemo(() => {
        if (!currentArticle) return { prevArticle: null, nextArticle: null };
        const idx = helpIndex.articles.findIndex(a => a.slug === currentArticle.slug);
        return {
            prevArticle: idx > 0 ? helpIndex.articles[idx - 1] : null,
            nextArticle: idx >= 0 && idx < helpIndex.articles.length - 1 ? helpIndex.articles[idx + 1] : null
        };
    }, [currentArticle]);

    // Find Related articles
    const relatedArticles = useMemo(() => {
        if (!currentArticle || !currentArticle.related) return [];
        return currentArticle.related
            .map(relSlug => helpIndex.articles.find(a => a.slug === relSlug))
            .filter(Boolean)
            .slice(0, 3);
    }, [currentArticle]);

    // Copy Anchor link
    const handleCopyAnchor = (headingId) => {
        const fullUrl = `${window.location.origin}${currentArticle.url}#${headingId}`;
        navigator.clipboard.writeText(fullUrl).then(() => {
            setCopiedAnchorId(headingId);
            setTimeout(() => setCopiedAnchorId(null), 2000);
        }).catch(() => {});
    };

    // Copy Code block
    const handleCopyCode = (codeText, blockIndex) => {
        navigator.clipboard.writeText(codeText).then(() => {
            setCopiedCodeIndex(blockIndex);
            setTimeout(() => setCopiedCodeIndex(null), 2000);
        }).catch(() => {});
    };

    // Submit Feedback
    const handleSubmitFeedback = async (isHelpful) => {
        setFeedbackVote(isHelpful);
        setIsSubmittingFeedback(true);

        try {
            await fetch('/api/v1/help/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    article_slug: currentArticle.slug,
                    category: currentArticle.category,
                    helpful: isHelpful,
                    comment: feedbackComment.trim()
                })
            });
            sessionStorage.setItem(`tn_feedback_${currentArticle.slug}`, isHelpful ? 'yes' : 'no');
            setFeedbackSubmitted(true);
        } catch (_) {
            // Still mark submitted locally on network glitch
            setFeedbackSubmitted(true);
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    // Render markdown body elements cleanly
    const renderedBody = useMemo(() => {
        if (!currentArticle) return null;

        const raw = currentArticle.rawBody;
        // Split by code blocks first
        const parts = raw.split(/(```[\s\S]*?```)/g);
        let codeBlockCounter = 0;

        return parts.map((part, partIdx) => {
            if (part.startsWith('```') && part.endsWith('```')) {
                const codeIdx = codeBlockCounter++;
                const firstNewline = part.indexOf('\n');
                const lang = part.slice(3, firstNewline).trim() || 'text';
                const codeContent = part.slice(firstNewline + 1, -3).trim();

                return (
                    <div key={`code-${codeIdx}`} className="help-code-block-wrap">
                        <div className="help-code-block-header">
                            <span className="help-code-block-lang">{lang}</span>
                            <button
                                type="button"
                                onClick={() => handleCopyCode(codeContent, codeIdx)}
                                className="help-code-copy-btn"
                                aria-label="Copy code block to clipboard"
                            >
                                {copiedCodeIndex === codeIdx ? (
                                    <>
                                        <Check size={13} />
                                        <span>Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={13} />
                                        <span>Copy</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <pre className="help-code-pre">
                            <code>{codeContent}</code>
                        </pre>
                    </div>
                );
            }

            // Parse paragraphs, callouts, lists, and headings
            const lines = part.split(/\r?\n/);
            const elements = [];
            let i = 0;

            while (i < lines.length) {
                const line = lines[i];

                if (!line.trim()) {
                    i++;
                    continue;
                }

                // Headings
                const h1Match = line.match(/^#\s+(.+)$/);
                const h2Match = line.match(/^##\s+(.+)$/);
                const h3Match = line.match(/^###\s+(.+)$/);

                if (h1Match) {
                    // Skip H1 as rendered in page hero
                    i++;
                    continue;
                }

                if (h2Match) {
                    const titleText = h2Match[1].replace(/`|[*_]/g, '').trim();
                    const id = titleText.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
                    elements.push(
                        <h2 key={`h2-${i}`} id={id} className="help-article-h2 group">
                            <span className="help-article-heading-text">{h2Match[1]}</span>
                            <button
                                type="button"
                                onClick={() => handleCopyAnchor(id)}
                                className="help-anchor-copy-btn"
                                aria-label={`Copy link to section ${titleText}`}
                                title="Copy link to this section"
                            >
                                {copiedAnchorId === id ? <Check size={14} /> : '#'}
                            </button>
                        </h2>
                    );
                    i++;
                    continue;
                }

                if (h3Match) {
                    const titleText = h3Match[1].replace(/`|[*_]/g, '').trim();
                    const id = titleText.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
                    elements.push(
                        <h3 key={`h3-${i}`} id={id} className="help-article-h3 group">
                            <span className="help-article-heading-text">{h3Match[1]}</span>
                            <button
                                type="button"
                                onClick={() => handleCopyAnchor(id)}
                                className="help-anchor-copy-btn"
                                aria-label={`Copy link to subsection ${titleText}`}
                                title="Copy link to this section"
                            >
                                {copiedAnchorId === id ? <Check size={13} /> : '#'}
                            </button>
                        </h3>
                    );
                    i++;
                    continue;
                }

                // Callouts: > Note: / > Tip: / > Warning:
                if (line.startsWith('>')) {
                    const calloutText = line.replace(/^>\s*/, '').trim();
                    let type = 'note';
                    let IconComp = Info;
                    let label = 'Note';

                    if (calloutText.toLowerCase().startsWith('warning:')) {
                        type = 'warning';
                        IconComp = AlertTriangle;
                        label = 'Warning';
                    } else if (calloutText.toLowerCase().startsWith('tip:')) {
                        type = 'tip';
                        IconComp = CheckCircle2;
                        label = 'Tip';
                    }

                    const bodyText = calloutText.replace(/^(note|tip|warning):\s*/i, '');

                    elements.push(
                        <aside key={`callout-${i}`} className={`help-callout help-callout--${type}`} role="note">
                            <div className="help-callout-header">
                                <IconComp size={15} className="help-callout-icon" aria-hidden="true" />
                                <span className="help-callout-label">{label}</span>
                            </div>
                            <div className="help-callout-body">{renderInlineMarkdown(bodyText)}</div>
                        </aside>
                    );
                    i++;
                    continue;
                }

                // Numbered list items
                if (/^\d+\.\s+/.test(line)) {
                    const listItems = [];
                    while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                        const itemText = lines[i].replace(/^\d+\.\s+/, '');
                        listItems.push(itemText);
                        i++;
                    }
                    elements.push(
                        <ol key={`ol-${i}`} className="help-article-ol">
                            {listItems.map((item, idx) => (
                                <li key={idx} className="help-article-li">
                                    {renderInlineMarkdown(item)}
                                </li>
                            ))}
                        </ol>
                    );
                    continue;
                }

                // Bulleted list items
                if (line.startsWith('- ') || line.startsWith('* ')) {
                    const listItems = [];
                    while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
                        const itemText = lines[i].slice(2);
                        listItems.push(itemText);
                        i++;
                    }
                    elements.push(
                        <ul key={`ul-${i}`} className="help-article-ul">
                            {listItems.map((item, idx) => (
                                <li key={idx} className="help-article-li">
                                    {renderInlineMarkdown(item)}
                                </li>
                            ))}
                        </ul>
                    );
                    continue;
                }

                // Standard paragraph
                elements.push(
                    <p key={`p-${i}`} className="help-article-p">
                        {renderInlineMarkdown(line)}
                    </p>
                );
                i++;
            }

            return <React.Fragment key={`part-${partIdx}`}>{elements}</React.Fragment>;
        });
    }, [currentArticle, copiedAnchorId, copiedCodeIndex]);

    // Inline markdown parser (bold, code, links)
    function renderInlineMarkdown(text) {
        if (!text) return '';
        // Parse links: [label](url)
        const parts = [];
        let lastIdx = 0;
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(text)) !== null) {
            if (match.index > lastIdx) {
                parts.push(text.slice(lastIdx, match.index));
            }
            const label = match[1];
            const href = match[2];
            parts.push(
                <Link key={match.index} to={href} className="help-inline-link">
                    {label}
                </Link>
            );
            lastIdx = match.index + match[0].length;
        }

        if (lastIdx < text.length) {
            parts.push(text.slice(lastIdx));
        }

        return parts.map((part, pIdx) => {
            if (typeof part !== 'string') return part;
            // Parse bold (**bold**) and inline code (`code`)
            const subParts = part.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
            return subParts.map((sub, sIdx) => {
                if (sub.startsWith('`') && sub.endsWith('`')) {
                    return <code key={`${pIdx}-${sIdx}`} className="help-inline-code">{sub.slice(1, -1)}</code>;
                }
                if (sub.startsWith('**') && sub.endsWith('**')) {
                    return <strong key={`${pIdx}-${sIdx}`}>{sub.slice(2, -2)}</strong>;
                }
                return sub;
            });
        });
    }

    if (!currentArticle) {
        return (
            <div className="help-not-found-wrap" style={{ padding: '64px 24px', textAlign: 'center' }}>
                <h2 style={{ fontSize: '24px', color: '#fff', marginBottom: '12px' }}>Article not found</h2>
                <p style={{ color: 'var(--help-text-2)', marginBottom: '24px' }}>The documentation article you requested could not be located.</p>
                <Link to="/help" className="help-btn-primary">Return to Help center</Link>
            </div>
        );
    }

    return (
        <>
            <main id="help-main-content" className="help-article-page-main" tabIndex="-1">
                {/* ─── Breadcrumb ─── */}
                <nav className="help-breadcrumb-nav" aria-label="Breadcrumb">
                    <ol className="help-breadcrumb-list">
                        <li>
                            <Link to="/help" className="help-breadcrumb-link">Help center</Link>
                        </li>
                        <li className="help-breadcrumb-separator" aria-hidden="true">
                            <ChevronRight size={13} />
                        </li>
                        <li>
                            <span className="help-breadcrumb-category">{currentArticle.categoryName}</span>
                        </li>
                        <li className="help-breadcrumb-separator" aria-hidden="true">
                            <ChevronRight size={13} />
                        </li>
                        <li aria-current="page">
                            <span className="help-breadcrumb-current">{currentArticle.title}</span>
                        </li>
                    </ol>
                </nav>

                <div className="help-article-layout-grid">
                    {/* ─── Main Content Column ─── */}
                    <div className="help-article-column">
                        <header className="help-article-header">
                            <div className="help-article-meta-row">
                                <span className="help-article-badge">{currentArticle.categoryName}</span>
                                <div className="help-article-meta-item">
                                    <Clock size={13} />
                                    <span>{currentArticle.readingTimeMinutes} min read</span>
                                </div>
                                <div className="help-article-meta-item">
                                    <Calendar size={13} />
                                    <span>Updated {currentArticle.updated}</span>
                                </div>
                            </div>
                            <h1 className="help-article-title">{currentArticle.title}</h1>
                            <p className="help-article-desc">{currentArticle.description}</p>
                        </header>

                        {/* Mobile Collapsible TOC (< 1024px) */}
                        {currentArticle.toc.length > 0 && (
                            <div className="help-mobile-toc-block">
                                <button
                                    type="button"
                                    onClick={() => setIsMobileTocOpen(!isMobileTocOpen)}
                                    className="help-mobile-toc-btn"
                                    aria-expanded={isMobileTocOpen}
                                >
                                    <div className="help-mobile-toc-btn-left">
                                        <List size={15} />
                                        <span>On this page</span>
                                    </div>
                                    <ChevronDown size={15} className={`help-mobile-toc-chevron ${isMobileTocOpen ? 'is-rotated' : ''}`} />
                                </button>
                                {isMobileTocOpen && (
                                    <div className="help-mobile-toc-panel">
                                        <ul className="help-toc-list">
                                            {currentArticle.toc.map((item) => (
                                                <li key={item.id} className={`help-toc-item help-toc-item--level-${item.level}`}>
                                                    <a
                                                        href={`#${item.id}`}
                                                        onClick={() => setIsMobileTocOpen(false)}
                                                        className={`help-toc-link ${activeSectionId === item.id ? 'is-active' : ''}`}
                                                    >
                                                        {item.title}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Article Markdown Body */}
                        <div className="help-article-body">
                            {renderedBody}
                        </div>

                        {/* ─── Was this helpful? Widget ─── */}
                        <section className="help-feedback-widget" aria-label="Article feedback">
                            {feedbackSubmitted ? (
                                <div className="help-feedback-success">
                                    <CheckCircle2 size={18} className="help-feedback-icon-check" />
                                    <span>Thank you for your feedback! It helps us refine our documentation.</span>
                                </div>
                            ) : (
                                <div>
                                    <div className="help-feedback-prompt">
                                        <span className="help-feedback-title">Was this guide helpful?</span>
                                        <div className="help-feedback-buttons">
                                            <button
                                                type="button"
                                                onClick={() => handleSubmitFeedback(true)}
                                                className={`help-feedback-btn ${feedbackVote === true ? 'is-selected' : ''}`}
                                                disabled={isSubmittingFeedback}
                                                aria-label="Vote yes, this guide was helpful"
                                            >
                                                <ThumbsUp size={14} />
                                                <span>Yes</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFeedbackVote(false)}
                                                className={`help-feedback-btn ${feedbackVote === false ? 'is-selected' : ''}`}
                                                disabled={isSubmittingFeedback}
                                                aria-label="Vote no, this guide was not helpful"
                                            >
                                                <ThumbsDown size={14} />
                                                <span>No</span>
                                            </button>
                                        </div>
                                    </div>

                                    {feedbackVote === false && (
                                        <div className="help-feedback-comment-form">
                                            <textarea
                                                value={feedbackComment}
                                                onChange={(e) => setFeedbackComment(e.target.value)}
                                                placeholder="What could be improved or clarified? (Optional)"
                                                rows={2}
                                                className="help-feedback-textarea"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleSubmitFeedback(false)}
                                                className="help-btn-secondary help-feedback-submit-btn"
                                                disabled={isSubmittingFeedback}
                                            >
                                                Submit feedback
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* ─── Related Articles ─── */}
                        {relatedArticles.length > 0 && (
                            <section className="help-related-section" aria-labelledby="heading-related-articles">
                                <h2 id="heading-related-articles" className="help-related-title">Related guides</h2>
                                <div className="help-related-grid">
                                    {relatedArticles.map((rel) => (
                                        <Link key={rel.slug} to={rel.url} className="help-related-card">
                                            <span className="help-related-category">{rel.categoryName}</span>
                                            <h3 className="help-related-card-title">{rel.title}</h3>
                                            <p className="help-related-card-desc">{rel.description}</p>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ─── Prev / Next Navigation ─── */}
                        <div className="help-article-nav-row">
                            {prevArticle ? (
                                <Link to={prevArticle.url} className="help-article-nav-btn help-article-nav-prev">
                                    <div className="help-nav-arrow-label">
                                        <ArrowLeft size={13} />
                                        <span>Previous</span>
                                    </div>
                                    <span className="help-nav-title">{prevArticle.title}</span>
                                </Link>
                            ) : <div />}

                            {nextArticle ? (
                                <Link to={nextArticle.url} className="help-article-nav-btn help-article-nav-next">
                                    <div className="help-nav-arrow-label">
                                        <span>Next</span>
                                        <ArrowRight size={13} />
                                    </div>
                                    <span className="help-nav-title">{nextArticle.title}</span>
                                </Link>
                            ) : <div />}
                        </div>

                        {/* ─── Footer Action: Edit this page ─── */}
                        <div className="help-article-footer-links">
                            <a
                                href={`https://github.com/testnexa/testnexa-ai/blob/main/${currentArticle.repoPath}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="help-edit-page-link"
                            >
                                <ExternalLink size={13} />
                                <span>Edit this page on GitHub</span>
                            </a>
                        </div>
                    </div>

                    {/* ─── Desktop Sticky TOC (> 1024px) ─── */}
                    {currentArticle.toc.length > 0 && (
                        <aside className="help-desktop-toc-aside" aria-label="Table of contents">
                            <div className="help-desktop-toc-inner">
                                <div className="help-toc-header">
                                    <List size={14} />
                                    <span>On this page</span>
                                </div>
                                <ul className="help-toc-list">
                                    {currentArticle.toc.map((item) => (
                                        <li key={item.id} className={`help-toc-item help-toc-item--level-${item.level}`}>
                                            <a
                                                href={`#${item.id}`}
                                                className={`help-toc-link ${activeSectionId === item.id ? 'is-active' : ''}`}
                                            >
                                                {item.title}
                                            </a>
                                        </li>
                                    ))}
                                </ul>

                                <div className="help-toc-support-box">
                                    <span className="help-toc-support-label">Need assistance?</span>
                                    <p className="help-toc-support-desc">Have a question not addressed in this guide?</p>
                                    <button
                                        type="button"
                                        onClick={openSupport}
                                        className="help-toc-support-btn"
                                    >
                                        Contact support →
                                    </button>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </main>

            {!outletCtx && (
                <ContactSupportModal
                    isOpen={localSupportOpen}
                    onClose={() => setLocalSupportOpen(false)}
                />
            )}
        </>
    );
};

export default HelpArticlePage;
