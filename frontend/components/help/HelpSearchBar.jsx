import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, X, ArrowRight, CornerDownLeft, LifeBuoy, FileText } from 'lucide-react';
import helpIndex from '../../content/help-index.json';

const POPULAR_SLUGS = [
    'create-your-first-test-suite',
    'linked-vs-verified-coverage',
    'review-and-approve-cases',
    'export-formats'
];

export const HelpSearchBar = ({ onOpenSupport, autoFocus = false, className = '' }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const navigate = useNavigate();

    // Cache of reported search misses to prevent duplicate reports
    const reportedMissesRef = useRef(new Set());
    const debounceTimeoutRef = useRef(null);

    // Global keyboard shortcut: / or Ctrl+K / Cmd+K
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') ||
                ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
                e.preventDefault();
                inputRef.current?.focus();
                setIsOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter articles based on query
    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];

        const terms = q.split(/\s+/).filter(Boolean);

        return helpIndex.articles
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
            .slice(0, 6)
            .map((item) => item.article);
    }, [query]);

    // Track search misses
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

    // Keyboard navigation within results
    const handleInputKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results.length > 0 && results[selectedIndex]) {
                const target = results[selectedIndex];
                navigate(target.url);
                setIsOpen(false);
                setQuery('');
            } else if (query.trim()) {
                navigate(`/help/search?q=${encodeURIComponent(query.trim())}`);
                setIsOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            inputRef.current?.blur();
        }
    };

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
        <div className={`help-search-box ${className}`} ref={containerRef}>
            <div className="help-search-input-wrap">
                <Search size={16} className="help-search-icon" aria-hidden="true" />
                <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setSelectedIndex(0);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Search docs, guides, and concepts... (Press / or Ctrl+K)"
                    className="help-search-input"
                    aria-label="Search documentation"
                    aria-autocomplete="list"
                    aria-controls="help-search-popover"
                    aria-expanded={isOpen}
                    autoFocus={autoFocus}
                    autoComplete="off"
                    spellCheck="false"
                />
                {query ? (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            inputRef.current?.focus();
                        }}
                        className="help-search-clear-btn"
                        aria-label="Clear search query"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <div className="help-search-kbd-hint" aria-hidden="true">
                        <span>/</span>
                    </div>
                )}
            </div>

            {/* Results Popover Dropdown */}
            {isOpen && query.trim().length > 0 && (
                <div
                    id="help-search-popover"
                    className="help-search-popover"
                    role="listbox"
                    aria-label="Search results"
                >
                    {results.length > 0 ? (
                        <>
                            <div className="help-search-popover-header">
                                <span>{results.length} guide{results.length !== 1 ? 's' : ''} found</span>
                                <span className="help-search-popover-hint">Use ↑↓ to navigate, ↵ to select</span>
                            </div>
                            <div className="help-search-results-list">
                                {results.map((art, idx) => {
                                    const isSelected = idx === selectedIndex;
                                    return (
                                        <Link
                                            key={art.slug}
                                            to={art.url}
                                            onClick={() => {
                                                setIsOpen(false);
                                                setQuery('');
                                            }}
                                            className={`help-search-result-item ${isSelected ? 'is-selected' : ''}`}
                                            role="option"
                                            aria-selected={isSelected}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        >
                                            <div className="help-search-result-left">
                                                <FileText size={15} className="help-search-result-icon" />
                                            </div>
                                            <div className="help-search-result-content">
                                                <div className="help-search-result-top">
                                                    <span className="help-search-result-title">
                                                        {highlightMatches(art.title, query)}
                                                    </span>
                                                    <span className="help-search-result-badge">{art.categoryName}</span>
                                                </div>
                                                <p className="help-search-result-desc">
                                                    {highlightMatches(art.description, query)}
                                                </p>
                                            </div>
                                            <div className="help-search-result-arrow">
                                                <CornerDownLeft size={13} />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                            <div className="help-search-popover-footer">
                                <Link
                                    to={`/help/search?q=${encodeURIComponent(query.trim())}`}
                                    onClick={() => setIsOpen(false)}
                                    className="help-search-all-link"
                                >
                                    <span>View all results for "{query.trim()}"</span>
                                    <ArrowRight size={13} />
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="help-search-no-results">
                            <p className="help-search-no-title">No direct matches for "{query.trim()}"</p>
                            <p className="help-search-no-hint">Suggestions: Try fewer keywords, check for typos, or browse popular guides below.</p>
                            <div className="help-search-popular-list">
                                {helpIndex.articles
                                    .filter(a => POPULAR_SLUGS.includes(a.slug))
                                    .slice(0, 3)
                                    .map(pop => (
                                        <Link
                                            key={pop.slug}
                                            to={pop.url}
                                            onClick={() => setIsOpen(false)}
                                            className="help-search-pop-link"
                                        >
                                            <ArrowRight size={12} />
                                            <span>{pop.title}</span>
                                        </Link>
                                    ))}
                            </div>
                            {onOpenSupport && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onOpenSupport();
                                    }}
                                    className="help-search-support-btn"
                                >
                                    <LifeBuoy size={14} />
                                    <span>Still can't find what you need? Contact support</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HelpSearchBar;
