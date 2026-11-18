import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link, useOutletContext } from 'react-router-dom';
import { Search, X, FileText, ArrowRight, CornerDownLeft, LifeBuoy } from 'lucide-react';
import helpIndex from '../content/help-index.json';
import ContactSupportModal from '../components/help/ContactSupportModal';

const POPULAR_SLUGS = [
    'create-your-first-test-suite',
    'linked-vs-verified-coverage',
    'review-and-approve-cases',
    'export-formats'
];

export const HelpSearchPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQuery = searchParams.get('q') || '';
    const [query, setQuery] = useState(initialQuery);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [localSupportOpen, setLocalSupportOpen] = useState(false);
    const outletCtx = useOutletContext();

    const openSupport = outletCtx?.onOpenSupport || (() => setLocalSupportOpen(true));

    const inputRef = useRef(null);
    const reportedMissesRef = useRef(new Set());
    const debounceTimeoutRef = useRef(null);

    // Keep state in sync with URL ?q=
    useEffect(() => {
        const qParam = searchParams.get('q') || '';
        if (qParam !== query) {
            setQuery(qParam);
        }
    }, [searchParams]);

    const handleQueryChange = (val) => {
        setQuery(val);
        setSearchParams(val.trim() ? { q: val } : {}, { replace: true });
    };

    // Filter and score articles
    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];

        const terms = q.split(/\s+/).filter(Boolean);

        return helpIndex.articles
            .filter((art) => selectedCategory === 'all' || art.category === selectedCategory)
            .map((art) => {
                let score = 0;
                const titleLower = art.title.toLowerCase();
                const descLower = art.description.toLowerCase();
                const kwStr = (art.keywords || []).join(' ').toLowerCase();
                const headingsStr = (art.toc || []).map(t => t.title).join(' ').toLowerCase();
                const bodyTokens = art.searchTokens?.snippet?.toLowerCase() || '';

                for (const term of terms) {
                    if (titleLower.includes(term)) score += 10;
                    if (descLower.includes(term)) score += 5;
                    if (kwStr.includes(term)) score += 6;
                    if (headingsStr.includes(term)) score += 4;
                    if (bodyTokens.includes(term)) score += 2;
                }

                return { article: art, score };
            })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((item) => item.article);
    }, [query, selectedCategory]);

    // Send search miss telemetry once
    useEffect(() => {
        const q = query.trim();
        if (q.length >= 3 && results.length === 0 && !reportedMissesRef.current.has(q.toLowerCase())) {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = setTimeout(() => {
                const normalized = q.toLowerCase();
                reportedMissesRef.current.add(normalized);
                try {
                    fetch('/api/v1/help/search-misses', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: normalized })
                    }).catch(() => {});
                } catch (_) {}
            }, 800);
        }
        return () => {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        };
    }, [query, results]);

    const highlightMatches = (text, q) => {
        if (!q.trim() || !text) return text;
        const terms = q.trim().split(/\s+/).filter(Boolean);
        const regex = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) =>
            regex.test(part) ? <mark key={i} className="help-search-mark">{part}</mark> : part
        );
    };

    return (
        <>
            <main id="help-main-content" className="help-search-page-main" tabIndex="-1">
                <div className="help-search-page-container">
                    <header className="help-search-page-header">
                        <span className="help-eyebrow">Search documentation</span>
                        <h1 className="help-search-page-title">Search</h1>

                        <div className="help-search-page-input-box">
                            <Search size={18} className="help-search-page-icon" aria-hidden="true" />
                            <input
                                ref={inputRef}
                                type="search"
                                value={query}
                                onChange={(e) => handleQueryChange(e.target.value)}
                                placeholder="Search all articles, guides, and terms..."
                                className="help-search-page-input"
                                autoFocus
                                spellCheck="false"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => handleQueryChange('')}
                                    className="help-search-clear-btn"
                                    aria-label="Clear search input"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Category filter tabs */}
                        <div className="help-search-filter-pills" role="tablist" aria-label="Filter results by category">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={selectedCategory === 'all'}
                                onClick={() => setSelectedCategory('all')}
                                className={`help-filter-pill ${selectedCategory === 'all' ? 'is-active' : ''}`}
                            >
                                All categories
                            </button>
                            {helpIndex.categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={selectedCategory === cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`help-filter-pill ${selectedCategory === cat.id ? 'is-active' : ''}`}
                                >
                                    {cat.name} ({cat.count})
                                </button>
                            ))}
                        </div>
                    </header>

                    {/* Results list or no-results state */}
                    <div className="help-search-page-body">
                        {query.trim() === '' ? (
                            <div className="help-search-empty-prompt">
                                <p>Type keywords, requirements concepts, or export formats above to explore guides.</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="help-search-full-results">
                                <div className="help-search-count-bar">
                                    <span>Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query.trim()}"</span>
                                </div>
                                <div className="help-search-cards-grid">
                                    {results.map((art) => (
                                        <Link key={art.slug} to={art.url} className="help-search-card">
                                            <div className="help-search-card-header">
                                                <span className="help-search-card-category">{art.categoryName}</span>
                                                <span className="help-search-card-time">{art.readingTimeMinutes} min read</span>
                                            </div>
                                            <h2 className="help-search-card-title">
                                                {highlightMatches(art.title, query)}
                                            </h2>
                                            <p className="help-search-card-desc">
                                                {highlightMatches(art.description, query)}
                                            </p>
                                            <div className="help-search-card-arrow">
                                                <span>Read guide</span>
                                                <ArrowRight size={13} />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="help-search-no-results-page">
                                <h2 className="help-search-no-title">No matching guides found for "{query.trim()}"</h2>
                                <p className="help-search-no-hint">
                                    Suggestions: Try broader keywords, check spelling, or explore our popular guides below.
                                </p>

                                <div className="help-search-fallback-popular">
                                    <h3 className="help-search-fallback-title">Recommended guides</h3>
                                    <div className="help-popular-grid">
                                        {helpIndex.articles
                                            .filter(a => POPULAR_SLUGS.includes(a.slug))
                                            .map((guide) => (
                                                <Link key={guide.slug} to={guide.url} className="help-popular-card">
                                                    <span className="help-popular-card-category">{guide.categoryName}</span>
                                                    <h4 className="help-popular-card-title">{guide.title}</h4>
                                                    <p className="help-popular-card-desc">{guide.description}</p>
                                                </Link>
                                            ))}
                                    </div>
                                </div>

                                <div className="help-search-support-banner">
                                    <LifeBuoy size={20} />
                                    <div>
                                        <h4>Still looking for answers?</h4>
                                        <p>Our engineering support team is available to assist with custom setups and requirements analysis.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={openSupport}
                                        className="help-btn-primary"
                                    >
                                        Contact support
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
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

export default HelpSearchPage;
