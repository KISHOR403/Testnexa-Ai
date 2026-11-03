import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Activity, RefreshCw, Search, Filter, Calendar, Layers,
    AlertTriangle, CheckCircle2, Clock, Monitor, Globe, ChevronRight,
    ArrowUpRight, AlertCircle, TrendingDown, Eye
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { sessionService } from '../../services/sessionService';
import FailureActivityChart from '../../components/intelligence/FailureActivityChart';
import FailureDetailModal from '../../components/intelligence/FailureDetailModal';
import '../../styles/app/FailureTrends.css';

const DATE_RANGES = [
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 14 Days', days: 14 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 90 Days', days: 90 }
];

export const FailureTrendAnalysisPage = () => {
    // Filters State
    const [selectedDays, setSelectedDays] = useState(30);
    const [interval, setInterval] = useState('daily');
    const [selectedSuiteId, setSelectedSuiteId] = useState('all');
    const [selectedBrowser, setSelectedBrowser] = useState('all');
    const [selectedEnvironment, setSelectedEnvironment] = useState('all');
    const [selectedMethod, setSelectedMethod] = useState('all');

    // Signatures Tab & Search
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedErrorType, setSelectedErrorType] = useState('all');

    // Data State
    const [suites, setSuites] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal State
    const [selectedSignature, setSelectedSignature] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Load available suites for dropdown
    useEffect(() => {
        const loadSuites = async () => {
            try {
                const res = await sessionService.list({ page: 1, limit: 100 });
                if (res?.success && Array.isArray(res.data)) {
                    setSuites(res.data);
                }
            } catch (err) {
                console.warn('Could not load test suites list:', err.message);
            }
        };
        loadSuites();
    }, []);

    // Load Failure Trends Analysis Data
    const loadAnalysis = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const startDate = new Date(Date.now() - (selectedDays * 24 * 60 * 60 * 1000)).toISOString();
            const res = await executionService.getFullFailureTrends({
                suiteId: selectedSuiteId !== 'all' ? selectedSuiteId : undefined,
                interval,
                startDate,
                browser: selectedBrowser !== 'all' ? selectedBrowser : undefined,
                environment: selectedEnvironment !== 'all' ? selectedEnvironment : undefined,
                executionMethod: selectedMethod !== 'all' ? selectedMethod : undefined
            });

            if (res?.success && res.data) {
                setReportData(res.data);
            } else {
                throw new Error(res?.message || 'Failed to fetch failure trends analysis');
            }
        } catch (err) {
            setError(err.message || 'Error loading failure trend analysis');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDays, interval, selectedSuiteId, selectedBrowser, selectedEnvironment, selectedMethod]);

    useEffect(() => {
        loadAnalysis();
    }, [loadAnalysis]);

    // Filtered Signatures list based on active tab, search, and errorType
    const filteredSignatures = useMemo(() => {
        if (!reportData?.signatures) return [];
        let list = reportData.signatures;

        // Tab filter
        if (activeTab === 'new_failure') {
            list = list.filter(s => s.classification === 'new_failure');
        } else if (activeTab === 'recurring') {
            list = list.filter(s => s.classification === 'recurring');
        } else if (activeTab === 'resolved') {
            list = list.filter(s => s.classification === 'resolved');
        } else if (activeTab === 'still_failing') {
            list = list.filter(s => s.classification === 'still_failing');
        }

        // Error Type filter
        if (selectedErrorType !== 'all') {
            list = list.filter(s => s.errorType.toLowerCase() === selectedErrorType.toLowerCase());
        }

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter(s =>
                s.normalizedMessage.toLowerCase().includes(q) ||
                s.sampleRawMessage.toLowerCase().includes(q) ||
                s.errorType.toLowerCase().includes(q) ||
                (s.affectedCases || []).some(c => (c.testCaseId || '').toLowerCase().includes(q) || (c.title || '').toLowerCase().includes(q))
            );
        }

        return list;
    }, [reportData, activeTab, selectedErrorType, searchQuery]);

    const handleOpenDetail = (sig) => {
        setSelectedSignature(sig);
        setIsDetailModalOpen(true);
    };

    const formatDate = (d) => {
        if (!d) return 'N/A';
        return new Date(d).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const summary = reportData?.summary || {};

    return (
        <div className="fta-container">
            {/* Header */}
            <header className="fta-header">
                <div className="fta-header-titles">
                    <span className="fta-badge-eyebrow">
                        <Activity size={13} />
                        Execution Intelligence · Analytics
                    </span>
                    <h1 className="fta-title">
                        Failure Trend Analysis
                    </h1>
                    <p className="fta-subtitle">
                        Track failure trajectory, recurring error signatures, newly introduced regressions,
                        and verified resolved failures across completed test executions.
                    </p>
                </div>

                <div className="fta-header-controls">
                    {/* Suite Context */}
                    <select
                        className="fta-select"
                        value={selectedSuiteId}
                        onChange={(e) => setSelectedSuiteId(e.target.value)}
                        title="Filter by Test Suite"
                    >
                        <option value="all">All Test Suites</option>
                        {suites.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.title || s.feature || `Suite #${s.id?.slice(-6)}`}
                            </option>
                        ))}
                    </select>

                    {/* Date Range Selector */}
                    <select
                        className="fta-select"
                        value={selectedDays}
                        onChange={(e) => setSelectedDays(Number(e.target.value))}
                        title="Analysis Date Range"
                    >
                        {DATE_RANGES.map(r => (
                            <option key={r.days} value={r.days}>{r.label}</option>
                        ))}
                    </select>

                    {/* Browser Filter */}
                    <select
                        className="fta-select"
                        value={selectedBrowser}
                        onChange={(e) => setSelectedBrowser(e.target.value)}
                        title="Filter by Browser"
                    >
                        <option value="all">All Browsers</option>
                        <option value="Chromium">Chromium</option>
                        <option value="Firefox">Firefox</option>
                        <option value="WebKit">WebKit</option>
                    </select>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        className="fta-btn"
                        onClick={loadAnalysis}
                        disabled={isLoading}
                        title="Refresh failure trends data"
                    >
                        <RefreshCw size={13} className={isLoading ? 'spin-icon' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </header>

            {/* Error Banner */}
            {error && (
                <div style={{
                    padding: '0.85rem 1.25rem',
                    background: 'var(--fta-fail-bg)',
                    border: '1px solid var(--fta-fail-border)',
                    borderRadius: '6px',
                    color: 'var(--fta-fail)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* Compact Metric Indicators Strip */}
            <div className="fta-metrics-strip">
                <div className="fta-metric-tile">
                    <div className="fta-metric-header">
                        <span>Failure Rate</span>
                        <TrendingDown size={14} color="var(--fta-jade)" />
                    </div>
                    <div className="fta-metric-value-row">
                        <span className="fta-metric-value" style={{ color: summary.overallFailureRate > 20 ? 'var(--fta-fail)' : 'var(--fta-jade)' }}>
                            {summary.overallFailureRate || 0}%
                        </span>
                        <span className="fta-metric-subtext">of total runs</span>
                    </div>
                </div>

                <div className="fta-metric-tile">
                    <div className="fta-metric-header">
                        <span>Total Failures</span>
                        <AlertTriangle size={14} color="var(--fta-fail)" />
                    </div>
                    <div className="fta-metric-value-row">
                        <span className="fta-metric-value" style={{ color: 'var(--fta-fail)' }}>
                            {summary.totalFailures || 0}
                        </span>
                        <span className="fta-metric-subtext">occurrences</span>
                    </div>
                </div>

                <div className="fta-metric-tile">
                    <div className="fta-metric-header">
                        <span>Failing Test Cases</span>
                        <Layers size={14} color="var(--fta-text-muted)" />
                    </div>
                    <div className="fta-metric-value-row">
                        <span className="fta-metric-value">
                            {summary.uniqueFailingCases || 0}
                        </span>
                        <span className="fta-metric-subtext">distinct tests</span>
                    </div>
                </div>

                <div className="fta-metric-tile">
                    <div className="fta-metric-header">
                        <span>New Failures</span>
                        <span className="fta-class-badge fta-class-new" style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem' }}>NEW</span>
                    </div>
                    <div className="fta-metric-value-row">
                        <span className="fta-metric-value" style={{ color: '#FFB74D' }}>
                            {summary.newSignaturesCount || 0}
                        </span>
                        <span className="fta-metric-subtext">signatures</span>
                    </div>
                </div>

                <div className="fta-metric-tile">
                    <div className="fta-metric-header">
                        <span>Recurring Patterns</span>
                        <span className="fta-class-badge fta-class-recurring" style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem' }}>RECURRING</span>
                    </div>
                    <div className="fta-metric-value-row">
                        <span className="fta-metric-value" style={{ color: '#E57373' }}>
                            {summary.recurringSignaturesCount || 0}
                        </span>
                        <span className="fta-metric-subtext">patterns</span>
                    </div>
                </div>

                <div className="fta-metric-tile">
                    <div className="fta-metric-header">
                        <span>Resolved Failures</span>
                        <CheckCircle2 size={14} color="var(--fta-pass)" />
                    </div>
                    <div className="fta-metric-value-row">
                        <span className="fta-metric-value" style={{ color: 'var(--fta-pass)' }}>
                            {summary.resolvedFailuresCount || 0}
                        </span>
                        <span className="fta-metric-subtext">verified fixes</span>
                    </div>
                </div>
            </div>

            {/* Failure Activity Chart */}
            <FailureActivityChart
                timeSeries={reportData?.timeSeries || []}
                trajectory={summary.trajectory || 'stable'}
                trajectoryDelta={summary.trajectoryDelta || 0}
                interval={interval}
                onIntervalChange={setInterval}
                isLoading={isLoading}
            />

            {/* Recurring Failure Signatures Section */}
            <section className="fta-signatures-section">
                <div className="fta-signatures-header">
                    <div className="fta-signatures-tabs">
                        <button
                            type="button"
                            className={`fta-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            <span>All Signatures</span>
                            <span className="fta-tab-count">{reportData?.signatures?.length || 0}</span>
                        </button>
                        <button
                            type="button"
                            className={`fta-tab-btn ${activeTab === 'new_failure' ? 'active' : ''}`}
                            onClick={() => setActiveTab('new_failure')}
                        >
                            <span>New Failures</span>
                            <span className="fta-tab-count">{summary.newSignaturesCount || 0}</span>
                        </button>
                        <button
                            type="button"
                            className={`fta-tab-btn ${activeTab === 'recurring' ? 'active' : ''}`}
                            onClick={() => setActiveTab('recurring')}
                        >
                            <span>Recurring</span>
                            <span className="fta-tab-count">{summary.recurringSignaturesCount || 0}</span>
                        </button>
                        <button
                            type="button"
                            className={`fta-tab-btn ${activeTab === 'resolved' ? 'active' : ''}`}
                            onClick={() => setActiveTab('resolved')}
                        >
                            <span>Resolved</span>
                            <span className="fta-tab-count">{summary.resolvedFailuresCount || 0}</span>
                        </button>
                        <button
                            type="button"
                            className={`fta-tab-btn ${activeTab === 'still_failing' ? 'active' : ''}`}
                            onClick={() => setActiveTab('still_failing')}
                        >
                            <span>Still Failing</span>
                            <span className="fta-tab-count">{summary.stillFailingCount || 0}</span>
                        </button>
                    </div>

                    <div className="fta-signatures-search">
                        <select
                            className="fta-select"
                            value={selectedErrorType}
                            onChange={(e) => setSelectedErrorType(e.target.value)}
                            title="Filter by Error Type"
                        >
                            <option value="all">All Error Types</option>
                            <option value="AssertionError">AssertionError</option>
                            <option value="TimeoutError">TimeoutError</option>
                            <option value="ElementNotFoundError">ElementNotFoundError</option>
                            <option value="NetworkError">NetworkError</option>
                            <option value="TypeError">TypeError</option>
                            <option value="StepFailure">StepFailure</option>
                        </select>

                        <div className="fta-search-box">
                            <Search size={14} color="var(--fta-text-subtle)" />
                            <input
                                type="text"
                                className="fta-search-input"
                                placeholder="Search error signatures..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Signatures Table */}
                <div className="fta-table-wrap">
                    {filteredSignatures.length === 0 ? (
                        <div className="fta-empty-state">
                            <CheckCircle2 size={32} color="var(--fta-jade)" />
                            <h3 className="fta-empty-title">No Failure Signatures Found</h3>
                            <p className="fta-empty-desc">
                                {searchQuery || selectedErrorType !== 'all' || activeTab !== 'all'
                                    ? 'No failure signatures match your search and filter criteria.'
                                    : 'All tests executed in this window have completed successfully with zero recorded failures.'}
                            </p>
                        </div>
                    ) : (
                        <table className="fta-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '42%' }}>Error Signature</th>
                                    <th>Classification</th>
                                    <th>Occurrences</th>
                                    <th>Affected Cases</th>
                                    <th>First / Last Seen</th>
                                    <th style={{ textAlign: 'right' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSignatures.map((sig) => (
                                    <tr key={sig.signatureId}>
                                        <td className="fta-sig-col-message">
                                            <div className="fta-sig-title">
                                                <span className={`fta-type-pill fta-type-${sig.errorType}`}>
                                                    {sig.errorType}
                                                </span>
                                                <span style={{ fontSize: '0.78rem', color: 'var(--fta-text)' }}>
                                                    {sig.normalizedMessage}
                                                </span>
                                            </div>
                                            <div className="fta-sig-preview">
                                                {sig.sampleRawMessage}
                                            </div>
                                        </td>

                                        <td>
                                            {sig.classification === 'new_failure' && (
                                                <span className="fta-class-badge fta-class-new">New Failure</span>
                                            )}
                                            {sig.classification === 'recurring' && (
                                                <span className="fta-class-badge fta-class-recurring">Recurring</span>
                                            )}
                                            {sig.classification === 'resolved' && (
                                                <span className="fta-class-badge fta-class-resolved">Resolved</span>
                                            )}
                                            {sig.classification === 'still_failing' && (
                                                <span className="fta-class-badge fta-class-still-failing">Still Failing</span>
                                            )}
                                            {sig.classification === 'insufficient_history' && (
                                                <span className="fta-class-badge fta-class-insufficient">Insufficient History</span>
                                            )}
                                        </td>

                                        <td>
                                            <strong style={{
                                                color: sig.occurrencesCount > 1 ? 'var(--fta-fail)' : 'var(--fta-text)',
                                                fontSize: '0.85rem',
                                                fontFamily: 'monospace'
                                            }}>
                                                {sig.occurrencesCount}x
                                            </strong>
                                        </td>

                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                {(sig.affectedCases || []).slice(0, 3).map((ac, idx) => (
                                                    <span
                                                        key={idx}
                                                        style={{
                                                            fontSize: '0.72rem',
                                                            background: 'var(--fta-surface)',
                                                            border: '1px solid var(--fta-border)',
                                                            padding: '0.1rem 0.35rem',
                                                            borderRadius: '3px',
                                                            color: 'var(--fta-jade)'
                                                        }}
                                                    >
                                                        {ac.testCaseId}
                                                    </span>
                                                ))}
                                                {(sig.affectedCases || []).length > 3 && (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--fta-text-subtle)' }}>
                                                        +{(sig.affectedCases || []).length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--fta-text-muted)' }}>
                                                <div>Last: {formatDate(sig.lastSeen)}</div>
                                                <div style={{ color: 'var(--fta-text-subtle)' }}>First: {formatDate(sig.firstSeen)}</div>
                                            </div>
                                        </td>

                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                type="button"
                                                className="fta-btn"
                                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                                                onClick={() => handleOpenDetail(sig)}
                                                title="Inspect failure details, stack trace and occurrences"
                                            >
                                                <Eye size={12} />
                                                <span>Investigate</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>

            {/* Failure Detail Modal */}
            {isDetailModalOpen && selectedSignature && (
                <FailureDetailModal
                    isOpen={isDetailModalOpen}
                    signature={selectedSignature}
                    onClose={() => setIsDetailModalOpen(false)}
                />
            )}
        </div>
    );
};
export default FailureTrendAnalysisPage;
