import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    AlertTriangle, Shield, CheckCircle2, ShieldAlert, ArrowRight,
    Filter, Play, XCircle, AlertCircle, Check, Download, Search,
    X, ChevronDown, ChevronRight, ExternalLink, HelpCircle, RefreshCw,
    Clock, Plus, Trash2, ArrowUpRight
} from 'lucide-react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { riskService } from '../../services/riskService';
import { traceabilityService } from '../../services/traceabilityService';
import RunButton from '../../components/common/RunButton';
import '../../styles/app/RisksPage.css';

const LIKELIHOOD_LABELS = {
    5: 'Frequent',
    4: 'Probable',
    3: 'Occasional',
    2: 'Remote',
    1: 'Improbable'
};

const IMPACT_LABELS = {
    1: 'Negligible',
    2: 'Minor',
    3: 'Moderate',
    4: 'Major',
    5: 'Catastrophic'
};

const SCORE_EXPLANATIONS = {
    critical: 'Critical threat vector that presents an immediate, catastrophic vulnerability to core business workflows. Requires mandatory test verification before release.',
    high: 'High-severity risk vector with substantial likelihood or major impact. Requires approved mitigation tests in the active suite.',
    medium: 'Moderate risk vector representing boundary vulnerabilities or edge conditions. Should be covered by planned regression tests.',
    low: 'Low-severity or improbable edge case. Monitored for regression impact.'
};

const RisksPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Suite combobox state (synced with URL)
    const suiteIdParam = searchParams.get('suite_id') || searchParams.get('suite') || 'all';
    const [selectedSuiteId, setSelectedSuiteId] = useState(suiteIdParam);
    const [suites, setSuites] = useState([]);
    const [isSuiteDropdownOpen, setIsSuiteDropdownOpen] = useState(false);
    const [suiteSearch, setSuiteSearch] = useState('');
    const suiteComboboxRef = useRef(null);

    // Data states
    const [summary, setSummary] = useState(null);
    const [matrixData, setMatrixData] = useState(null);
    const [risks, setRisks] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [mitigationFilter, setMitigationFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [sortOption, setSortOption] = useState('score_desc');
    const [matrixCellFilter, setMatrixCellFilter] = useState(null); // { likelihood, impact }

    // Drawer state
    const [selectedRisk, setSelectedRisk] = useState(null);
    const [drawerRiskDetails, setDrawerRiskDetails] = useState(null);
    const [isLoadingDrawer, setIsLoadingDrawer] = useState(false);
    const [drawerError, setDrawerError] = useState('');
    const [statusDraft, setStatusDraft] = useState('');
    const [acceptedReasonDraft, setAcceptedReasonDraft] = useState('');
    const [isSavingStatus, setIsSavingStatus] = useState(false);
    const [statusSaveError, setStatusSaveError] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const triggerRowRef = useRef(null);
    const drawerRef = useRef(null);

    // Sync selected suite with URL
    useEffect(() => {
        const sid = searchParams.get('suite_id') || searchParams.get('suite') || 'all';
        if (sid !== selectedSuiteId) {
            setSelectedSuiteId(sid);
        }
    }, [searchParams]);

    // Close suite dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (suiteComboboxRef.current && !suiteComboboxRef.current.contains(e.target)) {
                setIsSuiteDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─── 1. Load Suites List ───
    useEffect(() => {
        let isMounted = true;
        const fetchSuites = async () => {
            try {
                const list = await traceabilityService.getSuites();
                if (isMounted) setSuites(list || []);
            } catch (err) {
                console.error('Failed to load suites for risks page:', err);
            }
        };
        fetchSuites();
        return () => { isMounted = false; };
    }, []);

    // ─── 2. Fetch Summary, Matrix & Risks ───
    const loadRisksData = useCallback(async () => {
        setIsLoading(true);
        setIsError(false);
        setErrorMessage('');
        try {
            const [summaryRes, matrixRes, listRes] = await Promise.all([
                riskService.getSummary(selectedSuiteId),
                riskService.getMatrix(selectedSuiteId),
                riskService.listRisks({
                    suiteId: selectedSuiteId,
                    severity: severityFilter !== 'all' ? severityFilter : undefined,
                    category: categoryFilter !== 'all' ? categoryFilter : undefined,
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                    mitigation: mitigationFilter !== 'all' ? mitigationFilter : undefined,
                    source: sourceFilter !== 'all' ? sourceFilter : undefined,
                    q: searchQuery.trim() || undefined,
                    sort: sortOption.startsWith('score') ? 'score' : sortOption.startsWith('severity') ? 'severity' : 'updated_at',
                    order: sortOption.endsWith('asc') ? 'asc' : 'desc',
                    page: 1,
                    limit: 100
                })
            ]);

            setSummary(summaryRes);
            setMatrixData(matrixRes);
            setRisks(listRes.data || []);
            setPagination(listRes.pagination || { page: 1, limit: 100, total: (listRes.data || []).length });
        } catch (err) {
            console.error('Failed to load risks data:', err);
            setIsError(true);
            setErrorMessage(err.message || 'Unable to retrieve risk metrics. Please ensure the backend server is reachable.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedSuiteId, severityFilter, categoryFilter, statusFilter, mitigationFilter, sourceFilter, searchQuery, sortOption]);

    useEffect(() => {
        loadRisksData();
    }, [loadRisksData]);

    // ─── 3. Drawer Management ───
    const openDrawer = async (risk, e) => {
        triggerRowRef.current = e?.currentTarget || null;
        setSelectedRisk(risk);
        setStatusDraft(risk.status);
        setAcceptedReasonDraft(risk.accepted_reason || '');
        setStatusSaveError('');
        setIsLoadingDrawer(true);
        setDrawerError('');

        try {
            const fullDetails = await riskService.getRiskById(risk.id);
            setDrawerRiskDetails(fullDetails);
        } catch (err) {
            console.error('Failed to fetch risk details:', err);
            setDrawerError('Unable to load complete risk history.');
            setDrawerRiskDetails(risk);
        } finally {
            setIsLoadingDrawer(false);
        }
    };

    const closeDrawer = () => {
        setSelectedRisk(null);
        setDrawerRiskDetails(null);
        setStatusSaveError('');
        if (triggerRowRef.current) {
            triggerRowRef.current.focus();
        }
    };

    // Esc key closes drawer
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && selectedRisk) {
                closeDrawer();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRisk]);

    // Handle Status Transition Save in Drawer
    const handleSaveStatus = async () => {
        if (!selectedRisk) return;
        if (statusDraft === 'accepted' && (!acceptedReasonDraft || acceptedReasonDraft.trim().length < 5)) {
            setStatusSaveError('An acceptance rationale (at least 5 characters) is required when accepting a risk.');
            return;
        }

        setIsSavingStatus(true);
        setStatusSaveError('');
        try {
            const updated = await riskService.updateStatus(selectedRisk.id, statusDraft, acceptedReasonDraft.trim());
            setDrawerRiskDetails(updated);
            setSelectedRisk(updated);
            // Refresh list & summary
            loadRisksData();
        } catch (err) {
            setStatusSaveError(err.message || 'Failed to update risk status.');
        } finally {
            setIsSavingStatus(false);
        }
    };

    // ─── 4. Export Risks ───
    const handleExport = async (format = 'csv') => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const data = await riskService.exportRisks(selectedSuiteId, format);
            const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `risk-vectors-${selectedSuiteId}-${new Date().toISOString().slice(0, 10)}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export risks:', err);
        } finally {
            setIsExporting(false);
        }
    };

    // Filter by matrix cell
    const handleCellClick = (rowLikelihood, colImpact, count) => {
        if (count === 0) return;
        if (matrixCellFilter && matrixCellFilter.likelihood === rowLikelihood && matrixCellFilter.impact === colImpact) {
            setMatrixCellFilter(null);
        } else {
            setMatrixCellFilter({ likelihood: rowLikelihood, impact: colImpact });
        }
    };

    // Filter displayed risks client-side if matrix cell is clicked
    const displayedRisks = useMemo(() => {
        if (!matrixCellFilter) return risks;
        return risks.filter(r => r.likelihood === matrixCellFilter.likelihood && r.impact === matrixCellFilter.impact);
    }, [risks, matrixCellFilter]);

    // Suite combobox helpers
    const currentSuite = useMemo(() => {
        if (selectedSuiteId === 'all') {
            return { title: 'All Suites', count: suites.length };
        }
        return suites.find(s => s.id === selectedSuiteId) || { title: 'Selected Suite' };
    }, [suites, selectedSuiteId]);

    const handleSelectSuite = (id) => {
        setSelectedSuiteId(id);
        const newParams = new URLSearchParams(searchParams);
        if (id === 'all') {
            newParams.delete('suite_id');
            newParams.delete('suite');
        } else {
            newParams.set('suite_id', id);
        }
        setSearchParams(newParams);
        setIsSuiteDropdownOpen(false);
        setMatrixCellFilter(null);
    };

    const hasActiveFilters = Boolean(
        searchQuery ||
        severityFilter !== 'all' ||
        categoryFilter !== 'all' ||
        statusFilter !== 'all' ||
        mitigationFilter !== 'all' ||
        sourceFilter !== 'all' ||
        matrixCellFilter
    );

    const clearAllFilters = () => {
        setSearchQuery('');
        setSeverityFilter('all');
        setCategoryFilter('all');
        setStatusFilter('all');
        setMitigationFilter('all');
        setSourceFilter('all');
        setMatrixCellFilter(null);
    };

    // Derived vs Generated source notes
    const sourceStatement = useMemo(() => {
        if (!summary) return 'Loading risk metrics…';
        const derived = summary.derivedCount || 0;
        const generated = summary.generatedCount || 0;
        const total = summary.total || 0;

        if (total === 0) return 'No risks recorded for this suite.';
        if (derived > 0 && generated === 0) {
            return `${derived} risks derived from test cases`;
        }
        if (generated > 0 && derived === 0) {
            return `${generated} risks generated from specification`;
        }
        return `${total} risks evaluated (${derived} derived, ${generated} generated)`;
    }, [summary]);

    return (
        <div className="risks-page-wrapper">
            {/* ─── 1. Header & Source Line ─── */}
            <header className="risks-header">
                <div className="risks-header-left">
                    <h1 className="risks-title">Risks</h1>
                    <p className="risks-description">
                        Threats to your requirements, how severe they are and how well tests cover them.
                    </p>
                    <div className="risks-source-note">
                        <span>{sourceStatement}</span>
                        <span
                            className="risks-source-tooltip-trigger"
                            title="Derived risks are produced from your negative, edge and non-functional tests. Review them."
                            aria-label="Derived risks are produced from your negative, edge and non-functional tests. Review them."
                        >
                            <HelpCircle size={13} />
                        </span>
                    </div>
                </div>

                <div className="risks-header-actions">
                    <button
                        type="button"
                        onClick={() => handleExport('csv')}
                        disabled={isExporting || isLoading || (summary?.total || 0) === 0}
                        className="risks-btn-outlined"
                        aria-label="Export risks as CSV"
                    >
                        <Download size={14} />
                        <span>{isExporting ? 'Exporting…' : 'Export risks'}</span>
                    </button>

                    <RunButton
                        label="Execution Runs"
                        feature="testRuns"
                        className="risks-btn-outlined"
                    />
                </div>
            </header>

            {/* ─── Error State ─── */}
            {isError ? (
                <div className="risks-empty-state" role="alert">
                    <div className="risks-empty-icon">
                        <AlertCircle size={22} />
                    </div>
                    <h2 className="risks-empty-title">Failed to load risk intelligence</h2>
                    <p className="risks-empty-desc">{errorMessage}</p>
                    <button
                        type="button"
                        onClick={loadRisksData}
                        className="risks-btn-solid"
                    >
                        <RefreshCw size={14} />
                        <span>Retry</span>
                    </button>
                </div>
            ) : (
                <>
                    {/* ─── 2. Summary Strip (from /risks/summary) ─── */}
                    <section className="risks-summary-strip" aria-label="Risk summary metrics">
                        {/* Total Risks */}
                        <button
                            type="button"
                            className={`risks-summary-tile ${severityFilter === 'all' && !matrixCellFilter && mitigationFilter === 'all' ? 'is-active' : ''}`}
                            onClick={() => { setSeverityFilter('all'); setMitigationFilter('all'); setMatrixCellFilter(null); }}
                            aria-pressed={severityFilter === 'all' && !matrixCellFilter && mitigationFilter === 'all'}
                        >
                            <div className="risks-summary-tile-label-row">
                                <span className="risks-summary-tile-label">Total risks</span>
                            </div>
                            <div className="risks-summary-tile-val-row">
                                <span className="risks-summary-tile-val">{summary?.total ?? (isLoading ? '—' : 0)}</span>
                            </div>
                        </button>

                        {/* Critical Severity */}
                        <button
                            type="button"
                            className={`risks-summary-tile ${severityFilter === 'critical' ? 'is-active' : ''}`}
                            onClick={() => setSeverityFilter(severityFilter === 'critical' ? 'all' : 'critical')}
                            aria-pressed={severityFilter === 'critical'}
                        >
                            <div className="risks-summary-tile-label-row">
                                <span className="risks-summary-tile-label">Critical</span>
                            </div>
                            <div className="risks-summary-tile-val-row">
                                <span className="risks-summary-tile-val">{summary?.bySeverity?.critical ?? 0}</span>
                            </div>
                        </button>

                        {/* High Severity */}
                        <button
                            type="button"
                            className={`risks-summary-tile ${severityFilter === 'high' ? 'is-active' : ''}`}
                            onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
                            aria-pressed={severityFilter === 'high'}
                        >
                            <div className="risks-summary-tile-label-row">
                                <span className="risks-summary-tile-label">High</span>
                            </div>
                            <div className="risks-summary-tile-val-row">
                                <span className="risks-summary-tile-val">{summary?.bySeverity?.high ?? 0}</span>
                            </div>
                        </button>

                        {/* Medium Severity */}
                        <button
                            type="button"
                            className={`risks-summary-tile ${severityFilter === 'medium' ? 'is-active' : ''}`}
                            onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
                            aria-pressed={severityFilter === 'medium'}
                        >
                            <div className="risks-summary-tile-label-row">
                                <span className="risks-summary-tile-label">Medium</span>
                            </div>
                            <div className="risks-summary-tile-val-row">
                                <span className="risks-summary-tile-val">{summary?.bySeverity?.medium ?? 0}</span>
                            </div>
                        </button>

                        {/* Low Severity */}
                        <button
                            type="button"
                            className={`risks-summary-tile ${severityFilter === 'low' ? 'is-active' : ''}`}
                            onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
                            aria-pressed={severityFilter === 'low'}
                        >
                            <div className="risks-summary-tile-label-row">
                                <span className="risks-summary-tile-label">Low</span>
                            </div>
                            <div className="risks-summary-tile-val-row">
                                <span className="risks-summary-tile-val">{summary?.bySeverity?.low ?? 0}</span>
                            </div>
                        </button>

                        {/* Unmitigated */}
                        <button
                            type="button"
                            className={`risks-summary-tile ${mitigationFilter === 'unmitigated' ? 'is-active' : ''}`}
                            onClick={() => setMitigationFilter(mitigationFilter === 'unmitigated' ? 'all' : 'unmitigated')}
                            aria-pressed={mitigationFilter === 'unmitigated'}
                        >
                            <div className="risks-summary-tile-label-row">
                                <span className="risks-summary-tile-label">Unmitigated</span>
                            </div>
                            <div className="risks-summary-tile-val-row">
                                <span className="risks-summary-tile-val">{summary?.byMitigation?.unmitigated ?? 0}</span>
                            </div>
                        </button>

                        {/* Verified (Soon) */}
                        <NavLink
                            to="/app/cicd"
                            className="risks-summary-tile"
                            style={{ textDecoration: 'none', color: 'inherit' }}
                            title="Verified status is driven by your CI/CD test results. Click to configure GitHub Actions integration."
                        >
                            <div className="risks-summary-tile-label-row">
                                <span className="risks-summary-tile-label">Verified</span>
                                <span className="risks-soon-badge">Soon</span>
                            </div>
                            <div className="risks-summary-tile-val-row">
                                <span className="risks-summary-tile-val">0</span>
                            </div>
                        </NavLink>
                    </section>

                    {/* ─── 3. Overview: 5x5 Matrix + Category Breakdown ─── */}
                    <section className="risks-overview-section" aria-label="Risk matrix and category breakdown">
                        {/* 5x5 Matrix Card */}
                        <div className="risks-card">
                            <div className="risks-card-header">
                                <h2 className="risks-card-title">
                                    <span>5×5 Likelihood × Impact Grid</span>
                                </h2>
                                <span className="risks-card-subtitle">Click cell to filter</span>
                            </div>

                            <div className="risks-matrix-container">
                                <div className="risks-matrix-wrapper">
                                    <div className="risks-matrix-y-axis">Likelihood</div>
                                    <div className="risks-matrix-grid-outer">
                                        {[5, 4, 3, 2, 1].map((rowLikelihood) => (
                                            <div key={rowLikelihood} className="risks-matrix-grid" role="row">
                                                <div className="risks-matrix-y-label">
                                                    {LIKELIHOOD_LABELS[rowLikelihood]} ({rowLikelihood})
                                                </div>
                                                {[1, 2, 3, 4, 5].map((colImpact) => {
                                                    const cellInfo = matrixData?.grid?.[rowLikelihood]?.[colImpact]
                                                        || (Array.isArray(matrixData?.grid)
                                                            ? matrixData.grid.find(c => c.likelihood === rowLikelihood && c.impact === colImpact)
                                                            : null);
                                                    const count = cellInfo?.count || 0;
                                                    const severity = cellInfo?.severity || (rowLikelihood * colImpact >= 20 ? 'critical' : rowLikelihood * colImpact >= 12 ? 'high' : rowLikelihood * colImpact >= 6 ? 'medium' : 'low');
                                                    const isSelected = matrixCellFilter?.likelihood === rowLikelihood && matrixCellFilter?.impact === colImpact;

                                                    let fillClass = 'risks-matrix-cell--empty';
                                                    if (count > 0) {
                                                        fillClass = `risks-matrix-cell--${severity}`;
                                                    }

                                                    return (
                                                        <button
                                                            key={`${rowLikelihood}-${colImpact}`}
                                                            type="button"
                                                            role="gridcell"
                                                            disabled={count === 0}
                                                            onClick={() => handleCellClick(rowLikelihood, colImpact, count)}
                                                            className={`risks-matrix-cell ${fillClass} ${isSelected ? 'is-selected' : ''}`}
                                                            aria-label={`Likelihood ${rowLikelihood} (${LIKELIHOOD_LABELS[rowLikelihood]}), Impact ${colImpact} (${IMPACT_LABELS[colImpact]}): ${count} risks`}
                                                            title={`Likelihood: ${LIKELIHOOD_LABELS[rowLikelihood]} (${rowLikelihood}) × Impact: ${IMPACT_LABELS[colImpact]} (${colImpact}) = Score ${rowLikelihood * colImpact} (${count} risks)`}
                                                        >
                                                            {count > 0 ? count : ''}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ))}

                                        {/* X-axis labels */}
                                        <div className="risks-matrix-x-labels">
                                            <div />
                                            {[1, 2, 3, 4, 5].map((impactVal) => (
                                                <div key={impactVal} className="risks-matrix-x-label">
                                                    {impactVal}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="risks-matrix-x-axis">Impact (1: Negligible → 5: Catastrophic)</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Category Breakdown Card */}
                        <div className="risks-card">
                            <div className="risks-card-header">
                                <h2 className="risks-card-title">Threat Categories</h2>
                                <span className="risks-card-subtitle">{Object.keys(summary?.byCategory || {}).length} Categories</span>
                            </div>

                            <div className="risks-category-list">
                                {Object.entries(summary?.byCategory || {}).length === 0 ? (
                                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                                        No categories identified yet.
                                    </div>
                                ) : (
                                    Object.entries(summary?.byCategory || {}).map(([catName, count]) => {
                                        const pct = (summary?.total || 1) > 0 ? Math.round((count / summary.total) * 100) : 0;
                                        return (
                                            <div key={catName} className="risks-category-item">
                                                <div className="risks-category-item-meta">
                                                    <span className="risks-category-name">{catName.replace(/_/g, ' ')}</span>
                                                    <span className="risks-category-count">{count} ({pct}%)</span>
                                                </div>
                                                <div className="risks-category-bar-track">
                                                    <div className="risks-category-bar-fill" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ─── 4. Filters, Combobox & Tools ─── */}
                    <section className="risks-toolbar" aria-label="Risk filtering controls">
                        <div className="risks-filter-row">
                            {/* Suite Combobox */}
                            <div className="risks-combobox-wrap" ref={suiteComboboxRef} style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsSuiteDropdownOpen(!isSuiteDropdownOpen)}
                                    className="risks-select"
                                    style={{ minWidth: '220px', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                    aria-haspopup="listbox"
                                    aria-expanded={isSuiteDropdownOpen}
                                >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        Suite: <strong>{currentSuite.title}</strong>
                                    </span>
                                </button>

                                {isSuiteDropdownOpen && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            marginTop: '4px',
                                            width: '280px',
                                            background: 'var(--surface-2)',
                                            border: '1px solid var(--line-hi)',
                                            borderRadius: 'var(--radius)',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                            zIndex: 50,
                                            padding: '6px'
                                        }}
                                        role="listbox"
                                    >
                                        <div style={{ padding: '4px 6px 8px 6px' }}>
                                            <input
                                                type="text"
                                                placeholder="Search suites..."
                                                value={suiteSearch}
                                                onChange={e => setSuiteSearch(e.target.value)}
                                                className="risks-search-input"
                                                style={{ height: '30px', fontSize: '12px', paddingLeft: '8px' }}
                                                autoFocus
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            className="risks-dropdown-item"
                                            onClick={() => handleSelectSuite('all')}
                                            style={{
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '6px 8px',
                                                background: selectedSuiteId === 'all' ? 'var(--surface-3)' : 'transparent',
                                                border: 'none',
                                                color: 'var(--text-1)',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            All Suites (Unified)
                                        </button>

                                        {suites
                                            .filter(s => (s.title || '').toLowerCase().includes(suiteSearch.toLowerCase()))
                                            .map(s => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    className="risks-dropdown-item"
                                                    onClick={() => handleSelectSuite(s.id)}
                                                    style={{
                                                        width: '100%',
                                                        textAlign: 'left',
                                                        padding: '6px 8px',
                                                        background: selectedSuiteId === s.id ? 'var(--surface-3)' : 'transparent',
                                                        border: 'none',
                                                        color: 'var(--text-1)',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        borderRadius: '4px'
                                                    }}
                                                >
                                                    {s.title}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Search Field */}
                            <div className="risks-search-wrap">
                                <Search size={14} className="risks-search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search risks (ID, title, threat)…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="risks-search-input"
                                />
                            </div>

                            {/* Severity Filter */}
                            <select
                                value={severityFilter}
                                onChange={e => { setSeverityFilter(e.target.value); setMatrixCellFilter(null); }}
                                className="risks-select"
                                aria-label="Filter by severity"
                            >
                                <option value="all">Severity: All</option>
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>

                            {/* Mitigation Filter */}
                            <select
                                value={mitigationFilter}
                                onChange={e => setMitigationFilter(e.target.value)}
                                className="risks-select"
                                aria-label="Filter by mitigation"
                            >
                                <option value="all">Mitigation: All</option>
                                <option value="unmitigated">Unmitigated</option>
                                <option value="tests_planned">Tests Planned</option>
                                <option value="tests_approved">Tests Approved</option>
                            </select>

                            {/* Status Filter */}
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="risks-select"
                                aria-label="Filter by status"
                            >
                                <option value="all">Status: All</option>
                                <option value="open">Open</option>
                                <option value="mitigating">Mitigating</option>
                                <option value="accepted">Accepted</option>
                                <option value="closed">Closed</option>
                            </select>

                            {/* Source Toggle */}
                            <select
                                value={sourceFilter}
                                onChange={e => setSourceFilter(e.target.value)}
                                className="risks-select"
                                aria-label="Filter by source"
                            >
                                <option value="all">Source: All</option>
                                <option value="derived">Derived</option>
                                <option value="generated">Generated</option>
                                <option value="manual">Manual</option>
                            </select>

                            {/* Sort Select */}
                            <select
                                value={sortOption}
                                onChange={e => setSortOption(e.target.value)}
                                className="risks-select"
                                aria-label="Sort risks"
                            >
                                <option value="score_desc">Score (High to Low)</option>
                                <option value="score_asc">Score (Low to High)</option>
                                <option value="severity_desc">Severity (High to Low)</option>
                                <option value="updated_desc">Recently Updated</option>
                            </select>
                        </div>

                        {/* Active Filter Chips */}
                        {hasActiveFilters && (
                            <div className="risks-active-chips">
                                {searchQuery && (
                                    <span className="risks-chip">
                                        Query: "{searchQuery}"
                                        <button type="button" onClick={() => setSearchQuery('')} className="risks-chip-remove" aria-label="Clear search">
                                            <X size={12} />
                                        </button>
                                    </span>
                                )}
                                {severityFilter !== 'all' && (
                                    <span className="risks-chip">
                                        Severity: {severityFilter}
                                        <button type="button" onClick={() => setSeverityFilter('all')} className="risks-chip-remove" aria-label="Clear severity filter">
                                            <X size={12} />
                                        </button>
                                    </span>
                                )}
                                {mitigationFilter !== 'all' && (
                                    <span className="risks-chip">
                                        Mitigation: {mitigationFilter.replace('_', ' ')}
                                        <button type="button" onClick={() => setMitigationFilter('all')} className="risks-chip-remove" aria-label="Clear mitigation filter">
                                            <X size={12} />
                                        </button>
                                    </span>
                                )}
                                {statusFilter !== 'all' && (
                                    <span className="risks-chip">
                                        Status: {statusFilter}
                                        <button type="button" onClick={() => setStatusFilter('all')} className="risks-chip-remove" aria-label="Clear status filter">
                                            <X size={12} />
                                        </button>
                                    </span>
                                )}
                                {sourceFilter !== 'all' && (
                                    <span className="risks-chip">
                                        Source: {sourceFilter}
                                        <button type="button" onClick={() => setSourceFilter('all')} className="risks-chip-remove" aria-label="Clear source filter">
                                            <X size={12} />
                                        </button>
                                    </span>
                                )}
                                {matrixCellFilter && (
                                    <span className="risks-chip">
                                        Grid: L{matrixCellFilter.likelihood} × I{matrixCellFilter.impact}
                                        <button type="button" onClick={() => setMatrixCellFilter(null)} className="risks-chip-remove" aria-label="Clear grid cell filter">
                                            <X size={12} />
                                        </button>
                                    </span>
                                )}
                                <button type="button" onClick={clearAllFilters} className="risks-clear-all-btn">
                                    Clear all filters
                                </button>
                            </div>
                        )}
                    </section>

                    {/* ─── 5. Risk Vector Table ─── */}
                    <div className="risks-table-card">
                        <div className="risks-table-header" role="row">
                            <div>Severity</div>
                            <div>Threat & Requirement</div>
                            <div>Mitigation</div>
                            <div>Tests</div>
                            <div>Requirements</div>
                            <div style={{ textAlign: 'right' }}>Actions</div>
                        </div>

                        {isLoading ? (
                            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-3)' }}>
                                Evaluating risk vectors and test mitigations…
                            </div>
                        ) : displayedRisks.length === 0 ? (
                            <div className="risks-empty-state">
                                <div className="risks-empty-icon">
                                    <ShieldAlert size={22} />
                                </div>
                                <h3 className="risks-empty-title">
                                    {hasActiveFilters ? 'No matching risk vectors' : 'No risks recorded yet'}
                                </h3>
                                <p className="risks-empty-desc">
                                    {hasActiveFilters
                                        ? 'Adjust your query, severity, or mitigation filters to inspect risks.'
                                        : 'Generate a test suite in AI Workspace to evaluate security vulnerabilities, negative edge scenarios, and exception flows.'}
                                </p>
                                {hasActiveFilters ? (
                                    <button type="button" onClick={clearAllFilters} className="risks-btn-outlined">
                                        Clear all filters
                                    </button>
                                ) : (
                                    <NavLink to="/app/workspace" className="risks-btn-solid">
                                        <span>Create suite in AI Workspace →</span>
                                    </NavLink>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {displayedRisks.map((risk) => {
                                    const sev = risk.severity || 'low';
                                    const mit = risk.mitigation_status || 'unmitigated';
                                    const testsCount = (risk.linked_test_cases || []).length;
                                    const reqs = risk.linked_requirements || [];

                                    return (
                                        <div
                                            key={risk.id}
                                            className="risks-table-row"
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => openDrawer(risk, e)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(risk, e); } }}
                                            aria-label={`View details for risk ${risk.id}: ${risk.title}`}
                                        >
                                            {/* Fixed 88px Badge Column */}
                                            <div className="risks-badge-cell">
                                                <span className={`risks-severity-badge risks-severity-badge--${sev}`}>
                                                    {sev === 'critical' && <AlertTriangle size={12} strokeWidth={2.5} />}
                                                    <span>{sev}</span>
                                                </span>
                                            </div>

                                            {/* Title & Threat Clamped Cell */}
                                            <div className="risks-title-cell">
                                                <div className="risks-row-title-bar">
                                                    <span className="risks-row-id">{risk.id}</span>
                                                    <span className="risks-row-title">{risk.title}</span>
                                                </div>
                                                <p className="risks-threat-statement">
                                                    {risk.threat_statement || risk.description}
                                                </p>
                                                <div className="risks-row-tags">
                                                    <span className="risks-tag">{risk.category?.replace(/_/g, ' ') || 'General'}</span>
                                                    <span className="risks-tag" style={{ textTransform: 'capitalize' }}>
                                                        {risk.source || 'derived'}
                                                    </span>
                                                    {risk.status === 'accepted' && (
                                                        <span className="risks-tag" style={{ border: '1px solid var(--text-2)' }}>
                                                            Accepted
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Mitigation Pill */}
                                            <div className="risks-mitigation-cell">
                                                <span className={`risks-mitigation-pill risks-mitigation-pill--${mit}`}>
                                                    {mit === 'unmitigated' && <AlertCircle size={12} />}
                                                    {mit === 'tests_planned' && <Clock size={12} />}
                                                    {mit === 'tests_approved' && <Check size={12} strokeWidth={2.5} />}
                                                    <span>{mit.replace('_', ' ')}</span>
                                                </span>
                                            </div>

                                            {/* Tests Count */}
                                            <div className="risks-tests-cell">
                                                <span>{testsCount} {testsCount === 1 ? 'test' : 'tests'}</span>
                                            </div>

                                            {/* Requirement Chips */}
                                            <div className="risks-reqs-cell">
                                                {reqs.length === 0 ? (
                                                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>—</span>
                                                ) : (
                                                    reqs.slice(0, 2).map(req => (
                                                        <span key={req.requirement_id || req.requirement_code} className="risks-req-chip" title={req.title || req.requirement_code}>
                                                            {req.requirement_code || req.requirement_id}
                                                        </span>
                                                    ))
                                                )}
                                                {reqs.length > 2 && (
                                                    <span className="risks-req-chip">+{reqs.length - 2}</span>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="risks-actions-cell" onClick={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={(e) => openDrawer(risk, e)}
                                                    className="risks-icon-btn"
                                                    title="View risk detail drawer"
                                                    aria-label="View risk detail drawer"
                                                >
                                                    <ArrowRight size={14} />
                                                </button>
                                                {risk.suite_id && (
                                                    <NavLink
                                                        to={`/app/test-suites/${risk.suite_id}`}
                                                        className="risks-icon-btn"
                                                        title="Inspect Suite"
                                                        aria-label="Inspect Suite"
                                                    >
                                                        <ExternalLink size={13} />
                                                    </NavLink>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ─── 6. Execution "Soon" Bottom Panel ─── */}
                    <div className="risks-execution-soon-panel">
                        <div className="risks-execution-soon-left">
                            <div className="risks-execution-soon-badge-row">
                                <span className="risks-soon-badge">Soon</span>
                                <h3 className="risks-execution-soon-title">Execution Failure Hotspots</h3>
                            </div>
                            <p className="risks-execution-soon-desc">
                                Execution failures and live run hotspots will appear here automatically once test execution is available. You can view test suite specifications and requirement links today.
                            </p>
                        </div>
                        <div className="risks-execution-soon-actions">
                            <NavLink to="/app/traceability" className="risks-btn-outlined">
                                <span>View Traceability</span>
                            </NavLink>
                            <NavLink to="/app/test-cases" className="risks-btn-outlined">
                                <span>View Test Cases</span>
                            </NavLink>
                        </div>
                    </div>
                </>
            )}

            {/* ─── 7. Detail Drawer ─── */}
            {selectedRisk && (
                <div
                    className="risks-drawer-backdrop"
                    onClick={closeDrawer}
                    role="presentation"
                >
                    <div
                        className="risks-drawer-panel"
                        ref={drawerRef}
                        onClick={e => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="drawer-risk-title"
                    >
                        {/* Drawer Header */}
                        <div className="risks-drawer-header">
                            <div className="risks-drawer-title-wrap">
                                <span className="risks-row-id">{selectedRisk.id}</span>
                                <h3 id="drawer-risk-title" className="risks-drawer-title">
                                    {selectedRisk.title}
                                </h3>
                                <span className="risks-drawer-subtitle">
                                    Suite: <strong>{selectedRisk.suite_id || 'All'}</strong>
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={closeDrawer}
                                className="risks-icon-btn"
                                aria-label="Close risk detail drawer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="risks-drawer-body">
                            {/* Threat Statement */}
                            <div className="risks-drawer-section">
                                <h4 className="risks-drawer-section-title">Threat Statement</h4>
                                <p style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.5, margin: 0 }}>
                                    {selectedRisk.threat_statement || selectedRisk.description}
                                </p>
                            </div>

                            {/* Score & Calculation Explanation */}
                            <div className="risks-drawer-section">
                                <h4 className="risks-drawer-section-title">Risk Score & Severity</h4>
                                <div className="risks-score-explanation-box">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>
                                            Likelihood <strong>{selectedRisk.likelihood}</strong> ({LIKELIHOOD_LABELS[selectedRisk.likelihood]}) × Impact <strong>{selectedRisk.impact}</strong> ({IMPACT_LABELS[selectedRisk.impact]})
                                        </span>
                                        <span className={`risks-severity-badge risks-severity-badge--${selectedRisk.severity}`}>
                                            Score: {selectedRisk.score}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-2)' }}>
                                        {SCORE_EXPLANATIONS[selectedRisk.severity] || 'Evaluated boundary risk.'}
                                    </p>
                                </div>
                            </div>

                            {/* Status & Transition Management */}
                            <div className="risks-drawer-section">
                                <h4 className="risks-drawer-section-title">Risk Status</h4>
                                <div className="risks-status-select-wrap">
                                    <select
                                        value={statusDraft}
                                        onChange={e => setStatusDraft(e.target.value)}
                                        className="risks-select"
                                        style={{ width: '100%' }}
                                    >
                                        <option value="open">Open (Active Threat)</option>
                                        <option value="mitigating">Mitigating (Tests in Progress)</option>
                                        <option value="accepted">Accepted (Residual Risk Accepted)</option>
                                        <option value="closed">Closed (Fully Mitigated)</option>
                                    </select>

                                    {/* Acceptance Rationale Required when Accepted */}
                                    {statusDraft === 'accepted' && (
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px' }}>
                                                Acceptance Rationale (Mandatory)
                                            </label>
                                            <textarea
                                                placeholder="Explain why this threat is accepted without further testing (e.g., Compensating perimeter controls, third-party SLA)..."
                                                value={acceptedReasonDraft}
                                                onChange={e => setAcceptedReasonDraft(e.target.value)}
                                                className="risks-textarea"
                                            />
                                        </div>
                                    )}

                                    {statusSaveError && (
                                        <span style={{ fontSize: '12px', color: '#fff', border: '1px solid #fff', padding: '4px 8px', borderRadius: '4px' }}>
                                            {statusSaveError}
                                        </span>
                                    )}

                                    {(statusDraft !== selectedRisk.status || (statusDraft === 'accepted' && acceptedReasonDraft !== selectedRisk.accepted_reason)) && (
                                        <button
                                            type="button"
                                            onClick={handleSaveStatus}
                                            disabled={isSavingStatus}
                                            className="risks-btn-solid"
                                            style={{ marginTop: '4px' }}
                                        >
                                            {isSavingStatus ? 'Updating…' : 'Save Status Change'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Linked Requirements */}
                            <div className="risks-drawer-section">
                                <h4 className="risks-drawer-section-title">Linked Requirements</h4>
                                {(drawerRiskDetails?.linked_requirements || selectedRisk.linked_requirements || []).length === 0 ? (
                                    <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>No requirements currently linked.</p>
                                ) : (
                                    (drawerRiskDetails?.linked_requirements || selectedRisk.linked_requirements || []).map(req => (
                                        <div key={req.requirement_id || req.requirement_code} className="risks-drawer-item-card">
                                            <div>
                                                <strong style={{ color: 'var(--text-1)', fontSize: '13px' }}>
                                                    {req.requirement_code || req.requirement_id}
                                                </strong>
                                                <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{req.title || 'Requirement specification'}</div>
                                            </div>
                                            <NavLink
                                                to={`/app/traceability?req=${encodeURIComponent(req.requirement_code || req.requirement_id)}`}
                                                className="risks-icon-btn"
                                                title="View in Traceability"
                                            >
                                                <ArrowUpRight size={14} />
                                            </NavLink>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Linked Tests */}
                            <div className="risks-drawer-section">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h4 className="risks-drawer-section-title">Mitigating Test Cases</h4>
                                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                                        {(drawerRiskDetails?.linked_test_cases || selectedRisk.linked_test_cases || []).length} linked
                                    </span>
                                </div>

                                {(drawerRiskDetails?.linked_test_cases || selectedRisk.linked_test_cases || []).length === 0 ? (
                                    <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
                                        No tests linked to mitigate this risk.
                                    </p>
                                ) : (
                                    (drawerRiskDetails?.linked_test_cases || selectedRisk.linked_test_cases || []).map(tc => (
                                        <div key={tc.test_case_id} className="risks-drawer-item-card">
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-1)' }}>
                                                        {tc.test_case_id}
                                                    </span>
                                                    <span className="risks-tag" style={{ textTransform: 'capitalize' }}>
                                                        {tc.approval_status || 'Pending'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                                                    {tc.title || 'Test case verification'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {selectedRisk.suite_id && (
                                                    <NavLink
                                                        to={`/app/test-suites/${selectedRisk.suite_id}?testCaseId=${tc.test_case_id}`}
                                                        className="risks-icon-btn"
                                                        title="View Case in Suite"
                                                    >
                                                        <ArrowUpRight size={14} />
                                                    </NavLink>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Audit Event History */}
                            <div className="risks-drawer-section">
                                <h4 className="risks-drawer-section-title">Audit History</h4>
                                {(drawerRiskDetails?.events || []).length === 0 ? (
                                    <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: 0 }}>
                                        Created via {selectedRisk.source || 'derived'} backfill.
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {drawerRiskDetails.events.map((evt, idx) => (
                                            <div key={evt.id || idx} style={{ borderLeft: '2px solid var(--line-hi)', paddingLeft: '10px', fontSize: '12px' }}>
                                                <div style={{ color: 'var(--text-1)', fontWeight: 500 }}>
                                                    {evt.event_type?.replace(/_/g, ' ')}
                                                </div>
                                                <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>
                                                    {new Date(evt.created_at).toLocaleString()}
                                                </div>
                                                {evt.details?.reason && (
                                                    <div style={{ color: 'var(--text-2)', fontStyle: 'italic', marginTop: '2px' }}>
                                                        "{evt.details.reason}"
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="risks-drawer-footer">
                            <button
                                type="button"
                                onClick={closeDrawer}
                                className="risks-btn-outlined"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RisksPage;
