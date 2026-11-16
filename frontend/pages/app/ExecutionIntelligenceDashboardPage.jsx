import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
    Activity, RefreshCw, ChevronDown, CheckCircle2,
    Shield, Layers, AlertCircle, ArrowRight, Check,
    Clock, Sparkles, Filter, Zap, WifiOff, ChevronUp
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

    // Activity Timeseries State
    const [activityDays, setActivityDays] = useState(30);
    const [activityData, setActivityData] = useState([]);
    const [isLoadingActivity, setIsLoadingActivity] = useState(false);

    // Rules Disclosure State in Gaps Panel
    const [rulesOpen, setRulesOpen] = useState(false);

    // Offline Status State
    const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

    // Suites Table Sorting State
    const [sortField, setSortField] = useState('gapCount');
    const [sortAsc, setSortAsc] = useState(false);

    // Offline listener
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

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
            if (Array.isArray(data?.activity)) {
                setActivityData(data.activity);
            }
        } catch (err) {
            console.error('Error loading intelligence overview:', err);
            setError(err.message || 'Failed to load intelligence overview');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedSuiteId]);

    // ─── 3. Load Activity Timeseries ───
    const loadActivity = useCallback(async (days = activityDays) => {
        setIsLoadingActivity(true);
        try {
            const res = await intelligenceService.getActivity(selectedSuiteId, days);
            if (Array.isArray(res?.activity)) {
                setActivityData(res.activity);
            }
        } catch (err) {
            console.warn('Failed to load activity timeseries:', err.message);
        } finally {
            setIsLoadingActivity(false);
        }
    }, [selectedSuiteId, activityDays]);

    useEffect(() => {
        loadOverview();
        loadActivity(activityDays);
    }, [loadOverview, loadActivity, activityDays]);

    const handleActivityDaysChange = (days) => {
        setActivityDays(days);
        loadActivity(days);
    };

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
            return {
                id: 'all',
                title: 'All Suites',
                platform: 'Unified workspace',
                totalCases: suites.reduce((acc, s) => acc + (s.totalCases || 0), 0)
            };
        }
        return suites.find(s => String(s.id) === String(selectedSuiteId)) || {
            id: selectedSuiteId,
            title: 'Selected Suite',
            platform: 'Web'
        };
    }, [selectedSuiteId, suites]);

    // Filtered suites in combobox search
    const filteredSuites = useMemo(() => {
        const q = comboboxSearch.trim().toLowerCase();
        if (!q) return suites;
        return suites.filter(s => (s.title || '').toLowerCase().includes(q));
    }, [suites, comboboxSearch]);

    // Sorted Suites Breakdown for Table
    const sortedSuites = useMemo(() => {
        if (!overviewData?.suites || !Array.isArray(overviewData.suites)) return [];
        const copy = [...overviewData.suites];
        copy.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
        return copy;
    }, [overviewData?.suites, sortField, sortAsc]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false); // default desc for counts/dates
        }
    };

    // Loading Skeleton Render
    if (isLoading && !overviewData) {
        return (
            <div className="intel-page">
                <header className="intel-header">
                    <div className="intel-header-left">
                        <h1 className="intel-title">Intelligence</h1>
                        <p className="intel-subtitle">Quality overview of your test suites, review progress and requirement coverage.</p>
                    </div>
                </header>
                <div className="intel-summary-strip">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="intel-tile intel-skeleton" style={{ height: '110px' }} />
                    ))}
                </div>
                <div className="intel-grid">
                    <div className="intel-panel intel-skeleton" style={{ height: '260px' }} />
                    <div className="intel-panel intel-skeleton" style={{ height: '260px' }} />
                    <div className="intel-panel intel-skeleton" style={{ height: '300px' }} />
                    <div className="intel-panel intel-skeleton" style={{ height: '300px' }} />
                    <div className="intel-panel intel-panel-full intel-skeleton" style={{ height: '280px' }} />
                </div>
            </div>
        );
    }

    // Error State
    if (error && !overviewData) {
        return (
            <div className="intel-page">
                <header className="intel-header">
                    <div className="intel-header-left">
                        <h1 className="intel-title">Intelligence</h1>
                        <p className="intel-subtitle">Quality overview of your test suites, review progress and requirement coverage.</p>
                    </div>
                </header>
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
                <header className="intel-header">
                    <div className="intel-header-left">
                        <h1 className="intel-title">Intelligence</h1>
                        <p className="intel-subtitle">Quality overview of your test suites, review progress and requirement coverage.</p>
                    </div>
                </header>
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
        byType = { functional: 0, negative: 0, edge: 0, nonFunctional: 0, security: 0, api: 0 },
        byPriority = { high: 0, medium: 0, low: 0, unset: 0 },
        requirementsBySource = { extracted: 0, derived: 0, manual: 0 },
        gaps = [],
        rulesChecked = [],
        checkedAt = null
    } = overviewData || {};

    const totalCasesCount = Math.max(1, totals.cases);

    // Format honest requirement source string
    const formatRequirementsSource = () => {
        const extracted = requirementsBySource?.extracted || 0;
        const derived = requirementsBySource?.derived || 0;
        if (derived > 0 && extracted === 0) {
            return `${derived} derived from tests`;
        }
        if (extracted > 0 && derived === 0) {
            return `${extracted} extracted from your specification`;
        }
        if (extracted > 0 && derived > 0) {
            return `${extracted} extracted, ${derived} derived`;
        }
        return `${totals.requirements} specifications`;
    };

    return (
        <div className="intel-page">
            {/* ─── Offline Notice ─── */}
            {!isOnline && (
                <div className="intel-offline-banner" role="status" aria-live="polite">
                    <WifiOff size={15} />
                    <span>You are currently offline. Displaying cached intelligence telemetry.</span>
                </div>
            )}

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
                            <span className="intel-combobox-tag">{selectedSuiteObj.platform || 'Suite'}</span>
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

            {/* ─── Summary Strip (6 Metrics with Equal Baseline) ─── */}
            <section className="intel-summary-strip" aria-label="Quality summary strip">
                {/* 1. Suites */}
                <div className="intel-tile">
                    <div className="intel-tile-label">
                        <span>Suites</span>
                        <span className="intel-tile-tag-placeholder" aria-hidden="true" />
                    </div>
                    <div className="intel-tile-value">{totals.suites}</div>
                    <span className="intel-tile-sub">Active test suites</span>
                </div>

                {/* 2. Test Cases */}
                <div className="intel-tile">
                    <div className="intel-tile-label">
                        <span>Test cases</span>
                        <span className="intel-tile-tag-placeholder" aria-hidden="true" />
                    </div>
                    <div className="intel-tile-value">{totals.cases}</div>
                    <span className="intel-tile-sub">Authoring total</span>
                </div>

                {/* 3. Requirements (Honest Provenance) */}
                <div className="intel-tile">
                    <div className="intel-tile-label">
                        <span>Requirements</span>
                        <span className="intel-tile-tag-placeholder" aria-hidden="true" />
                    </div>
                    <div className="intel-tile-value">{totals.requirements}</div>
                    <span className="intel-tile-sub" title={formatRequirementsSource()}>
                        {formatRequirementsSource()}
                    </span>
                </div>

                {/* 4. Approved */}
                <div className="intel-tile">
                    <div className="intel-tile-label">
                        <span>Approved</span>
                        <span className="intel-tile-tag-placeholder" aria-hidden="true" />
                    </div>
                    <div className="intel-tile-value">{review.approvalPct}%</div>
                    <span className="intel-tile-sub">{review.approved} of {totals.cases} cases</span>
                </div>

                {/* 5. Linked % */}
                <div className="intel-tile">
                    <div className="intel-tile-label">
                        <span>Linked</span>
                        <span className="intel-tile-tag-placeholder" aria-hidden="true" />
                    </div>
                    <div className="intel-tile-value">{traceability.linkedPct}%</div>
                    <span className="intel-tile-sub">{traceability.requirementsLinked} of {traceability.requirementsTotal} reqs</span>
                </div>

                {/* 6. Verified % (Soon tag aligned) */}
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
                            Review cases <ArrowRight size={14} />
                        </Link>
                    </div>

                    {/* Segmented Bar */}
                    <div
                        className="intel-segmented-bar"
                        role="progressbar"
                        aria-label="Test case approval progress"
                        aria-valuenow={review.approvalPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className="intel-segment-approved"
                            style={{ width: `${review.approvalPct}%` }}
                            title={`${review.approved} approved (${review.approvalPct}%)`}
                        />
                        <div
                            className="intel-segment-pending"
                            style={{ width: `${100 - review.approvalPct}%` }}
                            title={`${review.notApproved} awaiting review (${100 - review.approvalPct}%)`}
                        />
                    </div>

                    <div className="intel-stats-row">
                        <div className="intel-stat-block">
                            <span className="intel-stat-block-label">Approved</span>
                            <span className="intel-stat-block-val">{review.approved} ({review.approvalPct}%)</span>
                        </div>
                        <div className="intel-stat-block">
                            <span className="intel-stat-block-label">Awaiting Review</span>
                            <span className="intel-stat-block-val">{review.notApproved} ({totals.cases > 0 ? 100 - review.approvalPct : 0}%)</span>
                        </div>
                        <div className="intel-stat-block">
                            <span className="intel-stat-block-label">Total Cases</span>
                            <span className="intel-stat-block-val">{totals.cases}</span>
                        </div>
                    </div>
                </div>

                {/* Panel 2: Requirement Coverage (Two distinct bars) */}
                <div className="intel-panel">
                    <div className="intel-panel-header">
                        <div className="intel-panel-title-group">
                            <h2 className="intel-panel-title">
                                <Shield size={16} /> Requirement Coverage
                            </h2>
                            <p className="intel-panel-desc">Design linkage and verification against specifications</p>
                        </div>
                        <Link to="/app/traceability" className="intel-panel-link">
                            Open traceability <ArrowRight size={14} />
                        </Link>
                    </div>

                    <div className="intel-dual-bars">
                        {/* Bar 1: Linked */}
                        <div className="intel-bar-section">
                            <div className="intel-bar-header">
                                <span className="intel-bar-label">Linked (Design Coverage)</span>
                                <span className="intel-bar-stat">{traceability.linkedPct}% · {traceability.requirementsLinked} of {traceability.requirementsTotal} reqs</span>
                            </div>
                            <div className="intel-progress-track">
                                <div className="intel-progress-fill" style={{ width: `${traceability.linkedPct}%` }} />
                            </div>
                        </div>

                        {/* Bar 2: Verified */}
                        <div className="intel-bar-section">
                            <div className="intel-bar-header">
                                <span className="intel-bar-label">Verified (Execution Runs)</span>
                                <span className="intel-bar-stat">{traceability.verifiedPct}% · 0 of {traceability.requirementsTotal} reqs (soon)</span>
                            </div>
                            <div className="intel-progress-track">
                                <div className="intel-progress-fill" style={{ width: `${traceability.verifiedPct}%` }} />
                            </div>
                        </div>
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
                            <span className="intel-stat-block-label">Total Requirements</span>
                            <span className="intel-stat-block-val">{traceability.requirementsTotal}</span>
                        </div>
                    </div>
                </div>

                {/* Panel 3: Test Mix Panel (Scaled to Total Cases) */}
                <div className="intel-panel">
                    <div className="intel-panel-header">
                        <div className="intel-panel-title-group">
                            <h2 className="intel-panel-title">
                                <Layers size={16} /> Test Mix & Distribution
                            </h2>
                            <p className="intel-panel-desc">Test cases grouped by category and priority relative to total</p>
                        </div>
                        <Link to="/app/test-cases" className="intel-panel-link">
                            All test cases <ArrowRight size={14} />
                        </Link>
                    </div>

                    <div className="intel-test-mix-split">
                        {/* Group 1: By Type */}
                        <div className="intel-mix-group">
                            <h3 className="intel-mix-subheading">BY TYPE</h3>
                            <div className="intel-dist-list">
                                {[
                                    { label: 'Functional', count: byType.functional || 0 },
                                    { label: 'Negative & Boundary', count: byType.negative || 0 },
                                    { label: 'Edge Cases', count: byType.edge || 0 },
                                    { label: 'Non-Functional', count: byType.nonFunctional || 0 },
                                    { label: 'Security', count: byType.security || 0 },
                                    { label: 'API & Integration', count: byType.api || 0 }
                                ].map((item) => {
                                    const pct = totals.cases > 0 ? Math.round((item.count / totalCasesCount) * 100) : 0;
                                    return (
                                        <div key={item.label} className="intel-dist-item">
                                            <div className="intel-dist-item-header">
                                                <span>{item.label}</span>
                                                <span className="intel-dist-count">{item.count} ({pct}%)</span>
                                            </div>
                                            <div className="intel-dist-bar-bg">
                                                <div className="intel-dist-bar-fill" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Group 2: By Priority */}
                        <div className="intel-mix-group">
                            <h3 className="intel-mix-subheading">BY PRIORITY</h3>
                            <div className="intel-dist-list">
                                {[
                                    { label: 'High & Critical', count: byPriority.high || 0 },
                                    { label: 'Medium', count: byPriority.medium || 0 },
                                    { label: 'Low', count: byPriority.low || 0 },
                                    { label: 'Unset', count: byPriority.unset || 0 }
                                ].map((item) => {
                                    const pct = totals.cases > 0 ? Math.round((item.count / totalCasesCount) * 100) : 0;
                                    return (
                                        <div key={item.label} className="intel-dist-item">
                                            <div className="intel-dist-item-header">
                                                <span>{item.label}</span>
                                                <span className="intel-dist-count">{item.count} ({pct}%)</span>
                                            </div>
                                            <div className="intel-dist-bar-bg">
                                                <div className="intel-dist-bar-fill fill-pattern" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Panel 4: Gaps & Opportunities Panel */}
                <div className="intel-panel">
                    <div className="intel-panel-header">
                        <div className="intel-panel-title-group">
                            <h2 className="intel-panel-title">
                                <AlertCircle size={16} /> Gaps & Opportunities
                            </h2>
                            <p className="intel-panel-desc">Deterministic quality rules evaluated across suites</p>
                        </div>
                        <span className="intel-combobox-tag">{gaps.length} detected</span>
                    </div>

                    <div className="intel-gaps-list">
                        {gaps.length > 0 ? (
                            gaps.map((gap, idx) => (
                                <div key={gap.key || idx} className="intel-gap-card">
                                    <div className="intel-gap-header">
                                        <div className="intel-gap-title-group">
                                            <span className={`intel-severity-glyph severity-${gap.severity || 'medium'}`} aria-hidden="true">
                                                {gap.severity === 'high' ? '◆' : (gap.severity === 'low' ? '▲' : '●')}
                                            </span>
                                            <span className="intel-gap-title">{gap.title}</span>
                                            <span className="intel-gap-count">{gap.count}</span>
                                        </div>
                                    </div>
                                    <p className="intel-gap-desc">{gap.description}</p>

                                    {/* First 3 items preview */}
                                    {Array.isArray(gap.items) && gap.items.length > 0 && (
                                        <div className="intel-gap-items-row">
                                            {gap.items.slice(0, 3).map((item, iIdx) => (
                                                <span key={iIdx} className="intel-gap-item-chip" title={item.title || item.id}>
                                                    {item.id || item.title}
                                                </span>
                                            ))}
                                            {gap.items.length > 3 && (
                                                <span className="intel-gap-item-chip intel-gap-item-more">
                                                    +{gap.items.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Action link */}
                                    <div className="intel-gap-action-wrap">
                                        <Link to={gap.actionPath || '/app/traceability'} className="intel-gap-btn">
                                            Resolve <ArrowRight size={13} />
                                        </Link>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="intel-gaps-empty">
                                <Check size={28} />
                                <h3>No gaps found. 5 rules checked.</h3>
                                <p>All suites satisfy single-test, negative validation, priority assignment, and linkage rules.</p>
                                
                                <button
                                    type="button"
                                    className="intel-disclosure-btn"
                                    onClick={() => setRulesOpen(!rulesOpen)}
                                    aria-expanded={rulesOpen}
                                >
                                    <span>{rulesOpen ? "Hide checked rules" : "View rules"}</span>
                                    {rulesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>

                                {rulesOpen && (
                                    <div className="intel-rules-disclosure-content">
                                        <ul className="intel-rules-list">
                                            {rulesChecked.map((rule) => (
                                                <li key={rule}>
                                                    <code>{rule}</code>
                                                </li>
                                            ))}
                                        </ul>
                                        {checkedAt && (
                                            <span className="intel-rules-time">Evaluated at {checkedAt}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel 5: Authoring Activity Timeseries */}
                <div className="intel-panel intel-panel-full">
                    <div className="intel-panel-header">
                        <div className="intel-panel-title-group">
                            <h2 className="intel-panel-title">
                                <Activity size={16} /> Authoring Activity ({activityDays} Days)
                            </h2>
                            <p className="intel-panel-desc">Daily progression of test suite creation and test case reviews from event logs</p>
                        </div>

                        {/* Activity Period Range Selector (7D / 30D / 90D) */}
                        <div className="intel-activity-range-controls" aria-label="Authoring activity date range">
                            <span className="intel-range-label">Range:</span>
                            <div className="intel-period-toggle">
                                {[7, 30, 90].map(d => (
                                    <button
                                        key={d}
                                        type="button"
                                        className={`intel-filter-chip ${activityDays === d ? 'active' : ''}`}
                                        onClick={() => handleActivityDaysChange(d)}
                                        aria-pressed={activityDays === d}
                                    >
                                        {d}D
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <AuthoringActivityChart
                        activity={activityData}
                        isLoading={isLoadingActivity}
                        days={activityDays}
                    />
                </div>

                {/* Panel 6: Suites Breakdown Table (Visible when All suites is selected) */}
                {selectedSuiteId === 'all' && sortedSuites.length > 0 && (
                    <div className="intel-panel intel-panel-full intel-suites-table-panel">
                        <div className="intel-panel-header">
                            <div className="intel-panel-title-group">
                                <h2 className="intel-panel-title">
                                    <Layers size={16} /> Workspace Test Suites ({sortedSuites.length})
                                </h2>
                                <p className="intel-panel-desc">Authoring review status and coverage metrics per suite</p>
                            </div>
                        </div>

                        {/* Desktop & Tablet Table View */}
                        <div className="intel-table-scroll-container">
                            <table className="intel-suites-table" role="table">
                                <thead>
                                    <tr>
                                        <th scope="col" onClick={() => handleSort('name')} className="sortable">
                                            Suite {sortField === 'name' && (sortAsc ? '↑' : '↓')}
                                        </th>
                                        <th scope="col" onClick={() => handleSort('platform')} className="sortable">
                                            Platform {sortField === 'platform' && (sortAsc ? '↑' : '↓')}
                                        </th>
                                        <th scope="col" onClick={() => handleSort('cases')} className="sortable num-col">
                                            Cases {sortField === 'cases' && (sortAsc ? '↑' : '↓')}
                                        </th>
                                        <th scope="col" onClick={() => handleSort('approvedPct')} className="sortable num-col">
                                            Approved {sortField === 'approvedPct' && (sortAsc ? '↑' : '↓')}
                                        </th>
                                        <th scope="col" onClick={() => handleSort('linkedPct')} className="sortable num-col">
                                            Linked {sortField === 'linkedPct' && (sortAsc ? '↑' : '↓')}
                                        </th>
                                        <th scope="col" onClick={() => handleSort('gapCount')} className="sortable num-col">
                                            Gaps {sortField === 'gapCount' && (sortAsc ? '↑' : '↓')}
                                        </th>
                                        <th scope="col" onClick={() => handleSort('updatedAt')} className="sortable">
                                            Updated {sortField === 'updatedAt' && (sortAsc ? '↑' : '↓')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedSuites.map((s) => (
                                        <tr
                                            key={s.id}
                                            onClick={() => navigate(`/app/test-suites/${s.id}`)}
                                            className="intel-table-row"
                                            tabIndex={0}
                                            role="button"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    navigate(`/app/test-suites/${s.id}`);
                                                }
                                            }}
                                        >
                                            <td className="intel-cell-suite-name">
                                                <span className="intel-suite-title-text">{s.name}</span>
                                            </td>
                                            <td>
                                                <span className="intel-combobox-tag">{s.platform}</span>
                                            </td>
                                            <td className="num-col">{s.cases}</td>
                                            <td className="num-col">{s.approvedPct}%</td>
                                            <td className="num-col">{s.linkedPct}%</td>
                                            <td className="num-col">
                                                {s.gapCount > 0 ? (
                                                    <span className="intel-gap-pill">{s.gapCount}</span>
                                                ) : (
                                                    <span className="intel-gap-pill zero">0</span>
                                                )}
                                            </td>
                                            <td className="intel-cell-updated">
                                                {new Date(s.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards View */}
                        <div className="intel-suites-cards-mobile">
                            {sortedSuites.map((s) => (
                                <div
                                    key={s.id}
                                    className="intel-suite-card-mobile"
                                    onClick={() => navigate(`/app/test-suites/${s.id}`)}
                                >
                                    <div className="intel-suite-card-header">
                                        <span className="intel-suite-card-title">{s.name}</span>
                                        <span className="intel-combobox-tag">{s.platform}</span>
                                    </div>
                                    <div className="intel-suite-card-stats">
                                        <div>Cases: <strong>{s.cases}</strong></div>
                                        <div>Approved: <strong>{s.approvedPct}%</strong></div>
                                        <div>Linked: <strong>{s.linkedPct}%</strong></div>
                                        <div>Gaps: <strong>{s.gapCount}</strong></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Panel 7: Execution Insights (Planned) ─── */}
            <section className="intel-soon-card" aria-label="Execution insights preview">
                <div className="intel-soon-header">
                    <div className="intel-soon-title-row">
                        <Zap size={18} />
                        <h2 className="intel-title" style={{ fontSize: '18px' }}>
                            Execution Insights & Failure Telemetry
                        </h2>
                        <span className="intel-badge-soon">Planned</span>
                    </div>
                </div>

                <p className="intel-soon-desc">
                    Test execution (manual testing and automated Playwright runner) is planned for upcoming releases. The runtime telemetry engine will cluster recurring failures, detect flaky test patterns, and provide contextual root cause hints.
                </p>

                <div className="intel-soon-features-grid">
                    <div className="intel-soon-feature-box">
                        <span className="intel-soon-feature-title">Automated runs</span>
                        <span className="intel-soon-feature-desc">Scheduled and on-demand test execution runs across environments.</span>
                    </div>
                    <div className="intel-soon-feature-box">
                        <span className="intel-soon-feature-title">Failure patterns</span>
                        <span className="intel-soon-feature-desc">Clustering recurring test failures to highlight regression trends.</span>
                    </div>
                    <div className="intel-soon-feature-box">
                        <span className="intel-soon-feature-title">Flaky test detection</span>
                        <span className="intel-soon-feature-desc">Historical telemetry tracking to identify unstable and intermittent test results.</span>
                    </div>
                    <div className="intel-soon-feature-box">
                        <span className="intel-soon-feature-title">Root cause hints</span>
                        <span className="intel-soon-feature-desc">Automated failure analysis and contextual guidance to accelerate triage.</span>
                    </div>
                </div>

                <div className="intel-soon-actions">
                    <Link to="/app/traceability" className="intel-btn intel-btn-primary">
                        View Traceability Matrix <ArrowRight size={14} />
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default ExecutionIntelligenceDashboardPage;
