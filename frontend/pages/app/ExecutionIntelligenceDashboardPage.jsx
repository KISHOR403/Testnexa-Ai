import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
    Activity, RefreshCw, ChevronRight, ChevronDown, CheckCircle2,
    Clock, Shield, ArrowUpRight, AlertCircle, Layers, FileText,
    Check, Sparkles, Filter, ExternalLink, Zap
} from 'lucide-react';
import { intelligenceService } from '../../services/intelligenceService';
import { traceabilityService } from '../../services/traceabilityService';
import AuthoringActivityChart from '../../components/intelligence/AuthoringActivityChart';
import '../../styles/app/ExecutionIntelligence.css';

export const ExecutionIntelligenceDashboardPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Suite Selection State
    const [suites, setSuites] = useState([]);
    const [isLoadingSuites, setIsLoadingSuites] = useState(true);
    const selectedSuiteId = searchParams.get('suite') || 'all';

    // Combobox State
    const [comboboxOpen, setComboboxOpen] = useState(false);
    const [comboboxSearch, setComboboxSearch] = useState('');
    const comboboxRef = useRef(null);

    // Overview Data State
    const [overviewData, setOverviewData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Close combobox on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
                setComboboxOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─── 1. Load Suites List ───
    const loadSuites = useCallback(async () => {
        setIsLoadingSuites(true);
        try {
            const list = await traceabilityService.getSuites();
            setSuites(list || []);
            return list || [];
        } catch (err) {
            console.warn('Failed to load suites list for combobox:', err.message);
            return [];
        } finally {
            setIsLoadingSuites(false);
        }
    }, []);

    useEffect(() => {
        loadSuites();
    }, [loadSuites]);

    // ─── 2. Load Overview Metrics ───
    const loadOverview = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const data = await intelligenceService.getOverview(selectedSuiteId);
            setOverviewData(data);
        } catch (err) {
            console.error('Error loading intelligence overview:', err);
            setError(err.message || 'Failed to load intelligence overview');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedSuiteId]);

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    // Update Suite in URL search param
    const handleSelectSuite = (suiteId) => {
        const nextParams = new URLSearchParams(searchParams);
        if (suiteId === 'all') {
            nextParams.delete('suite');
        } else {
            nextParams.set('suite', suiteId);
        }
        setSearchParams(nextParams);
        setComboboxOpen(false);
        setComboboxSearch('');
    };

    // Selected Suite Display Name
    const selectedSuiteObj = useMemo(() => {
        if (selectedSuiteId === 'all') {
            return { id: 'all', title: 'All Suites', platform: 'All', totalCases: suites.reduce((acc, s) => acc + (s.totalCases || 0), 0) };
        }
        return suites.find(s => String(s.id) === String(selectedSuiteId)) || { id: selectedSuiteId, title: 'Selected Suite', platform: 'Web' };
    }, [selectedSuiteId, suites]);

    // Filtered suites in combobox search
    const filteredSuites = useMemo(() => {
        const q = comboboxSearch.trim().toLowerCase();
        if (!q) return suites;
        return suites.filter(s => (s.title || '').toLowerCase().includes(q));
    }, [suites, comboboxSearch]);

    // Loading Skeleton Render
    if (isLoading && !overviewData) {
        return (
            <div className="intel-page">
                <div className="intel-breadcrumb">
                    <Link to="/app" className="intel-breadcrumb-link">Analysis</Link>
                    <ChevronRight size={14} className="intel-breadcrumb-sep" />
                    <span className="intel-breadcrumb-current">Intelligence</span>
                </div>
                <div className="intel-header">
                    <div className="intel-header-left">
                        <h1 className="intel-title">Intelligence</h1>
                        <p className="intel-subtitle">Quality overview of your test suites, review progress and requirement coverage.</p>
                    </div>
                </div>
                <div className="intel-summary-strip">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="intel-tile intel-skeleton" style={{ height: '104px' }} />
                    ))}
                </div>
                <div className="intel-grid">
                    <div className="intel-panel intel-skeleton" style={{ height: '260px' }} />
                    <div className="intel-panel intel-skeleton" style={{ height: '260px' }} />
                    <div className="intel-panel intel-skeleton" style={{ height: '280px' }} />
                    <div className="intel-panel intel-skeleton" style={{ height: '280px' }} />
                    <div className="intel-panel intel-panel-full intel-skeleton" style={{ height: '260px' }} />
                </div>
            </div>
        );
    }

    // Error State
    if (error && !overviewData) {
        return (
            <div className="intel-page">
                <div className="intel-breadcrumb">
                    <Link to="/app" className="intel-breadcrumb-link">Analysis</Link>
                    <ChevronRight size={14} className="intel-breadcrumb-sep" />
                    <span className="intel-breadcrumb-current">Intelligence</span>
                </div>
                <div className="intel-error-container">
                    <AlertCircle size={36} className="intel-error-icon" />
                    <h2 className="intel-error-title">Failed to load intelligence data</h2>
                    <p className="intel-error-message">{error}</p>
                    <button
                        type="button"
                        className="intel-btn intel-btn-primary"
                        onClick={() => loadOverview(false)}
                    >
                        <RefreshCw size={14} /> Retry
                    </button>
                </div>
            </div>
        );
    }

    // Empty State (0 suites)
    if (overviewData && overviewData.totals?.suites === 0) {
        return (
            <div className="intel-page">
                <div className="intel-breadcrumb">
                    <Link to="/app" className="intel-breadcrumb-link">Analysis</Link>
                    <ChevronRight size={14} className="intel-breadcrumb-sep" />
                    <span className="intel-breadcrumb-current">Intelligence</span>
                </div>
                <div className="intel-header">
                    <div className="intel-header-left">
                        <h1 className="intel-title">Intelligence</h1>
                        <p className="intel-subtitle">Quality overview of your test suites, review progress and requirement coverage.</p>
                    </div>
                </div>
                <div className="intel-empty-container">
                    <Layers size={40} strokeWidth={1.5} />
                    <h2 className="intel-empty-title">No test suites available</h2>
                    <p className="intel-empty-desc">
                        Create your first test suite with requirements to view authoring, review, and traceability intelligence.
                    </p>
                    <button
                        type="button"
                        className="intel-btn intel-btn-primary"
                        onClick={() => navigate('/app/workspace')}
                    >
                        Create your first suite
                    </button>
                </div>
            </div>
        );
    }

    const {
        totals = { suites: 0, cases: 0, requirements: 0 },
        review = { approved: 0, notApproved: 0, approvalPct: 0 },
        traceability = { linkedPct: 0, verifiedPct: 0, requirementsLinked: 0, requirementsTotal: 0 },
        byType = { functional: 0, negative: 0, edge: 0, nonFunctional: 0, api: 0 },
        byPriority = { high: 0, medium: 0, low: 0 },
        gaps = [],
        activity = []
    } = overviewData || {};

    const maxTypeCount = Math.max(1, byType.functional, byType.negative, byType.edge, byType.nonFunctional, byType.api);
    const maxPriorityCount = Math.max(1, byPriority.high, byPriority.medium, byPriority.low);

    return (
        <div className="intel-page">
            {/* ─── Breadcrumb ─── */}
            <nav className="intel-breadcrumb" aria-label="Breadcrumb">
                <Link to="/app" className="intel-breadcrumb-link">Analysis</Link>
                <ChevronRight size={14} className="intel-breadcrumb-sep" />
                <span className="intel-breadcrumb-current">Intelligence</span>
            </nav>

            {/* ─── Page Header & Controls ─── */}
            <header className="intel-header">
                <div className="intel-header-left">
                    <h1 className="intel-title">Intelligence</h1>
                    <p className="intel-subtitle">Quality overview of your test suites, review progress and requirement coverage.</p>
                </div>

                <div className="intel-header-controls">
                    {/* Suite Selector Combobox */}
                    <div className="intel-combobox" ref={comboboxRef}>
                        <button
                            type="button"
                            className="intel-combobox-trigger"
                            onClick={() => setComboboxOpen(!comboboxOpen)}
                            aria-expanded={comboboxOpen}
                            aria-haspopup="listbox"
                        >
                            <span className="intel-combobox-title">{selectedSuiteObj.title}</span>
                            <span className="intel-combobox-tag">{selectedSuiteObj.platform || 'All'}</span>
                            <ChevronDown size={14} />
                        </button>

                        {comboboxOpen && (
                            <div className="intel-combobox-menu" role="listbox">
                                <div className="intel-combobox-search-box">
                                    <input
                                        type="text"
                                        className="intel-combobox-search-input"
                                        placeholder="Search suites..."
                                        value={comboboxSearch}
                                        onChange={(e) => setComboboxSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="intel-combobox-list">
                                    <button
                                        type="button"
                                        className={`intel-combobox-item ${selectedSuiteId === 'all' ? 'selected' : ''}`}
                                        onClick={() => handleSelectSuite('all')}
                                        role="option"
                                        aria-selected={selectedSuiteId === 'all'}
                                    >
                                        <div className="intel-combobox-item-info">
                                            <span className="intel-combobox-item-title">All Suites</span>
                                            <span className="intel-combobox-item-sub">Unified workspace quality</span>
                                        </div>
                                        <span className="intel-combobox-tag">All</span>
                                    </button>

                                    {filteredSuites.map((s) => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            className={`intel-combobox-item ${selectedSuiteId === String(s.id) ? 'selected' : ''}`}
                                            onClick={() => handleSelectSuite(s.id)}
                                            role="option"
                                            aria-selected={selectedSuiteId === String(s.id)}
                                        >
                                            <div className="intel-combobox-item-info">
                                                <span className="intel-combobox-item-title">{s.title}</span>
                                                <span className="intel-combobox-item-sub">{s.totalCases} cases · {s.platform}</span>
                                            </div>
                                            <span className="intel-combobox-tag">{s.platform}</span>
                                        </button>
                                    ))}

                                    {filteredSuites.length === 0 && (
                                        <div className="intel-combobox-empty">No suites match your search</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        className="intel-btn-icon"
                        onClick={() => loadOverview(true)}
                        disabled={isRefreshing}
                        title="Refresh intelligence overview"
                        aria-label="Refresh intelligence overview"
                    >
                        <RefreshCw size={15} className={isRefreshing ? 'intel-spin' : ''} />
                    </button>
                </div>
            </header>

            {/* ─── Summary Strip (6 Metrics) ─── */}
            <section className="intel-summary-strip" aria-label="Quality summary strip">
                {/* 1. Suites */}
                <div className="intel-tile">
                    <span className="intel-tile-label">Suites</span>
                    <div className="intel-tile-value">{totals.suites}</div>
                    <span className="intel-tile-sub">Active test suites</span>
                </div>

                {/* 2. Test Cases */}
                <div className="intel-tile">
                    <span className="intel-tile-label">Test cases</span>
                    <div className="intel-tile-value">{totals.cases}</div>
                    <span className="intel-tile-sub">Authoring total</span>
                </div>

                {/* 3. Requirements */}
                <div className="intel-tile">
                    <span className="intel-tile-label">Requirements</span>
                    <div className="intel-tile-value">{totals.requirements}</div>
                    <span className="intel-tile-sub">Extracted specifications</span>
                </div>

                {/* 4. Approved */}
                <div className="intel-tile">
                    <span className="intel-tile-label">Approved</span>
                    <div className="intel-tile-value">{review.approvalPct}%</div>
                    <span className="intel-tile-sub">{review.approved} of {totals.cases} cases</span>
                </div>

                {/* 5. Linked % */}
                <div className="intel-tile">
                    <span className="intel-tile-label">Linked</span>
                    <div className="intel-tile-value">{traceability.linkedPct}%</div>
                    <span className="intel-tile-sub">{traceability.requirementsLinked} of {traceability.requirementsTotal} reqs</span>
                </div>

                {/* 6. Verified % */}
                <div className="intel-tile">
                    <div className="intel-tile-label">
                        <span>Verified</span>
                        <span className="intel-badge-soon">Soon</span>
                    </div>
                    <div className="intel-tile-value">{traceability.verifiedPct}%</div>
                    <span className="intel-tile-sub">Needs test execution (soon)</span>
                </div>
            </section>

            {/* ─── Main Panels Grid ─── */}
            <div className="intel-grid">
                {/* Panel 1: Review Progress */}
                <div className="intel-panel">
                    <div className="intel-panel-header">
                        <div className="intel-panel-title-group">
                            <h2 className="intel-panel-title">
                                <CheckCircle2 size={16} /> Review Progress
                            </h2>
                            <p className="intel-panel-desc">Test case approval status across selected suites</p>
                        </div>
                        <Link to="/app/test-cases?status=needs-review" className="intel-panel-link">
                            Review cases <ArrowUpRight size={13} />
                        </Link>
                    </div>

                    <div className="intel-progress-track" title={`${review.approvalPct}% approved`}>
                        <div className="intel-progress-fill" style={{ width: `${review.approvalPct}%` }} />
                    </div>

                    <div className="intel-stats-row">
                        <div className="intel-stat-block">
                            <span className="intel-stat-block-label">Approved</span>
                            <span className="intel-stat-block-val">{review.approved}</span>
                        </div>
                        <div className="intel-stat-block">
                            <span className="intel-stat-block-label">Awaiting Review</span>
                            <span className="intel-stat-block-val">{review.notApproved}</span>
                        </div>
                        <div className="intel-stat-block">
                            <span className="intel-stat-block-label">Total Cases</span>
                            <span className="intel-stat-block-val">{totals.cases}</span>
                        </div>
                    </div>
                </div>

                {/* Panel 2: Requirement Coverage */}
                <div className="intel-panel">
                    <div className="intel-panel-header">
                        <div className="intel-panel-title-group">
                            <h2 className="intel-panel-title">
                                <Shield size={16} /> Requirement Coverage
                            </h2>
                            <p className="intel-panel-desc">Design linkage and verification against requirements</p>
                        </div>
                        <Link to="/app/traceability" className="intel-panel-link">
                            Traceability matrix <ArrowUpRight size={13} />
                        </Link>
                    </div>

                    <div className="intel-progress-track" title={`${traceability.linkedPct}% requirements linked`}>
                        <div className="intel-progress-fill" style={{ width: `${traceability.linkedPct}%` }} />
                    </div>

                    <div className="intel-stats-row">
                        <div className="intel-stat-block">
                            <span className="intel-stat-block-label">Linked (Design)</span>
                            <span className="intel-stat-block-val">{traceability.linkedPct}%</span>
                        </div>
                        <div className="intel-stat-block">
                            <span className="intel-stat-block-label">Verified (Runs)</span>
                            <span className="intel-stat-block-val">{traceability.verifiedPct}%</span>
                        </div>
                        <div className="intel-stat-block">
                            <span className="intel-stat-block-label">Requirements</span>
                            <span className="intel-stat-block-val">{traceability.requirementsTotal}</span>
                        </div>
                    </div>
                </div>

                {/* Panel 3: Test Mix & Priorities */}
                <div className="intel-panel">
                    <div className="intel-panel-header">
                        <div className="intel-panel-title-group">
                            <h2 className="intel-panel-title">
                                <Layers size={16} /> Test Mix & Priorities
                            </h2>
                            <p className="intel-panel-desc">Breakdown of test types and severity distribution</p>
                        </div>
                        <Link to="/app/test-cases" className="intel-panel-link">
                            All test cases <ArrowUpRight size={13} />
                        </Link>
                    </div>

                    <div className="intel-dist-list">
                        <div className="intel-dist-item">
                            <div className="intel-dist-item-header">
                                <span>Functional</span>
                                <span className="intel-dist-count">{byType.functional}</span>
                            </div>
                            <div className="intel-dist-bar-bg">
                                <div className="intel-dist-bar-fill" style={{ width: `${(byType.functional / maxTypeCount) * 100}%` }} />
                            </div>
                        </div>

                        <div className="intel-dist-item">
                            <div className="intel-dist-item-header">
                                <span>Negative & Boundary</span>
                                <span className="intel-dist-count">{byType.negative}</span>
                            </div>
                            <div className="intel-dist-bar-bg">
                                <div className="intel-dist-bar-fill fill-pattern" style={{ width: `${(byType.negative / maxTypeCount) * 100}%` }} />
                            </div>
                        </div>

                        <div className="intel-dist-item">
                            <div className="intel-dist-item-header">
                                <span>Edge Cases</span>
                                <span className="intel-dist-count">{byType.edge}</span>
                            </div>
                            <div className="intel-dist-bar-bg">
                                <div className="intel-dist-bar-fill fill-pattern" style={{ width: `${(byType.edge / maxTypeCount) * 100}%` }} />
                            </div>
                        </div>

                        <div className="intel-dist-item">
                            <div className="intel-dist-item-header">
                                <span>Non-Functional & Security</span>
                                <span className="intel-dist-count">{byType.nonFunctional}</span>
                            </div>
                            <div className="intel-dist-bar-bg">
                                <div className="intel-dist-bar-fill" style={{ width: `${(byType.nonFunctional / maxTypeCount) * 100}%` }} />
                            </div>
                        </div>

                        <div className="intel-dist-item">
                            <div className="intel-dist-item-header">
                                <span>API & Integration</span>
                                <span className="intel-dist-count">{byType.api}</span>
                            </div>
                            <div className="intel-dist-bar-bg">
                                <div className="intel-dist-bar-fill" style={{ width: `${(byType.api / maxTypeCount) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Panel 4: Authoring Gaps & Opportunities */}
                <div className="intel-panel">
                    <div className="intel-panel-header">
                        <div className="intel-panel-title-group">
                            <h2 className="intel-panel-title">
                                <AlertCircle size={16} /> Gaps & Opportunities
                            </h2>
                            <p className="intel-panel-desc">Deterministic quality rules for risk reduction</p>
                        </div>
                        <span className="intel-combobox-tag">{gaps.length} detected</span>
                    </div>

                    <div className="intel-gaps-list">
                        {gaps.length > 0 ? (
                            gaps.map((gap, idx) => (
                                <div key={idx} className="intel-gap-card">
                                    <div className="intel-gap-header">
                                        <div className="intel-gap-title-group">
                                            <span className="intel-gap-title">{gap.title}</span>
                                            <span className="intel-gap-count">{gap.count}</span>
                                        </div>
                                    </div>
                                    <p className="intel-gap-desc">{gap.description}</p>
                                </div>
                            ))
                        ) : (
                            <div className="intel-gaps-empty">
                                <Check size={24} />
                                <span>No authoring gaps detected in selected suites.</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel 5: Activity (Past 30 Days) */}
                <div className="intel-panel intel-panel-full">
                    <div className="intel-panel-header">
                        <div className="intel-panel-title-group">
                            <h2 className="intel-panel-title">
                                <Activity size={16} /> Authoring Activity (Past 30 Days)
                            </h2>
                            <p className="intel-panel-desc">Daily progression of test suite creation and test case reviews</p>
                        </div>
                    </div>

                    <AuthoringActivityChart
                        activity={activity}
                        isLoading={isLoading}
                    />
                </div>
            </div>

            {/* ─── Panel 6: Execution Insights (Coming Soon) ─── */}
            <section className="intel-soon-card" aria-label="Execution insights preview">
                <div className="intel-soon-header">
                    <div className="intel-soon-title-row">
                        <Zap size={18} />
                        <h2 className="intel-title" style={{ fontSize: '18px' }}>
                            Execution Insights & Failure Fingerprinting
                        </h2>
                        <span className="intel-badge-soon">Coming Soon</span>
                    </div>
                </div>

                <p className="intel-soon-desc">
                    Test execution (manual and automated Playwright runner) is coming soon. The runtime intelligence engine will automatically cluster recurring failure patterns, identify flaky test cases, and analyze error signatures across multi-browser runs.
                </p>

                <div className="intel-soon-features-grid">
                    <div className="intel-soon-feature-box">
                        <span className="intel-soon-feature-title">Automated Playwright Runs</span>
                        <span className="intel-soon-feature-desc">Execute suites across Chromium, Firefox and WebKit with artifact capture.</span>
                    </div>
                    <div className="intel-soon-feature-box">
                        <span className="intel-soon-feature-title">Failure Error Signatures</span>
                        <span className="intel-soon-feature-desc">AI fingerprinting to isolate infrastructure issues from genuine regressions.</span>
                    </div>
                    <div className="intel-soon-feature-box">
                        <span className="intel-soon-feature-title">Flakiness Detection</span>
                        <span className="intel-soon-feature-desc">Deterministic entropy analysis to identify and quarantine unstable test cases.</span>
                    </div>
                    <div className="intel-soon-feature-box">
                        <span className="intel-soon-feature-title">Automated Root Cause Analysis</span>
                        <span className="intel-soon-feature-desc">Detailed stack trace breakdowns and auto-suggested test script fixes.</span>
                    </div>
                </div>

                <div className="intel-soon-actions">
                    <Link to="/app/traceability" className="intel-btn intel-btn-primary">
                        View Traceability Matrix
                    </Link>
                    <Link to="/app/test-cases" className="intel-btn">
                        Explore Test Cases
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default ExecutionIntelligenceDashboardPage;
