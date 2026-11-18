import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Search,
    ChevronDown,
    Check,
    X,
    Filter,
    Download,
    ArrowUpRight,
    Clock,
    AlertCircle,
    MinusCircle,
    CheckCircle2,
    XCircle,
    Layers,
    Grid,
    Table as TableIcon,
    RefreshCw,
    Plus,
    Edit3,
    Play
} from 'lucide-react';
import { traceabilityService } from '../../services/traceabilityService';
import RunButton from '../../components/common/RunButton';
import { useFeature } from '../../config/features';
import { useComingSoon } from '../../context/ComingSoonContext';
import {
    filterRequirements,
    computeTraceabilitySummary,
    computeTraceabilityGaps,
    buildTraceabilityMatrix
} from '../../utils/traceabilitySelectors';
import '../../styles/app/CoverageTraceability.css';

/**
 * Formats timestamps cleanly
 */
const formatUpdated = (timestamp) => {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

/**
 * Status pill component with outline shapes and monochrome icons
 */
const StatusPill = ({ status, count }) => {
    switch (status) {
        case 'verified':
            return (
                <span className="trace-status-pill status-verified" title="All linked test cases verified and passed">
                    <CheckCircle2 size={13} />
                    <span>Verified</span>
                    {count !== undefined && <small>({count})</small>}
                </span>
            );
        case 'partial':
            return (
                <span className="trace-status-pill status-partial" title="Partially verified or some tests blocked/skipped">
                    <MinusCircle size={13} />
                    <span>Partial</span>
                    {count !== undefined && <small>({count})</small>}
                </span>
            );
        case 'failing':
            return (
                <span className="trace-status-pill status-failing" title="One or more linked test cases have failed">
                    <XCircle size={13} />
                    <span>Failing</span>
                    {count !== undefined && <small>({count})</small>}
                </span>
            );
        case 'unverified':
            return (
                <span className="trace-status-pill status-unverified" title="Test cases linked but not yet executed">
                    <Clock size={13} />
                    <span>Unverified</span>
                    {count !== undefined && <small>({count})</small>}
                </span>
            );
        case 'uncovered':
        default:
            return (
                <span className="trace-status-pill status-uncovered" title="No test cases are linked to this requirement">
                    <AlertCircle size={13} />
                    <span>Uncovered</span>
                    {count !== undefined && <small>({count})</small>}
                </span>
            );
    }
};

/**
 * Source provenance tag pill
 */
const SourceTag = ({ source }) => {
    const clean = (source || 'extracted').toLowerCase();
    const label = clean === 'manual' ? 'Manual' : clean === 'derived' ? 'Derived' : 'Extracted';
    return (
        <span
            className={`trace-source-tag source-${clean}`}
            title={clean === 'derived' ? 'Derived from test labels. Review.' : clean === 'manual' ? 'Manually authored or modified' : 'Extracted from user specification text'}
        >
            {label}
        </span>
    );
};

/**
 * Short test ID generator (e.g. TC_FUNC_AUTH_001 -> AUTH_001)
 */
const getShortTestId = (id) => {
    return String(id || '').replace(/^TC[_-]?([A-Z]+[_-])?/i, '');
};

const INITIAL_SUMMARY = {
    total: 0,
    verified: 0,
    partial: 0,
    failing: 0,
    unverified: 0,
    uncovered: 0,
    linked: 0,
    linkedPercent: 0,
    verifiedPercent: 0,
    updatedAt: null
};

const CoverageTraceabilityPage = ({ view = 'traceability' }) => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { enabled: testRunsEnabled } = useFeature('testRuns');
    const { open: openComingSoon } = useComingSoon();

    // ─── State Management ───
    const [suites, setSuites] = useState([]);
    const [isLoadingSuites, setIsLoadingSuites] = useState(true);
    const [suitesError, setSuitesError] = useState(null);

    const [requirements, setRequirements] = useState([]);
    const [summary, setSummary] = useState(INITIAL_SUMMARY);
    const [gaps, setGaps] = useState([]);
    const [matrixData, setMatrixData] = useState(null);

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [dataError, setDataError] = useState(null);

    // Selected suite ID (sync with ?suite= in URL)
    const suiteParam = searchParams.get('suite');
    const [selectedSuiteId, setSelectedSuiteId] = useState(suiteParam || '');

    // Combobox state
    const [comboboxOpen, setComboboxOpen] = useState(false);
    const [comboboxSearch, setComboboxSearch] = useState('');
    const comboboxRef = useRef(null);

    // View toggle: 'table' | 'matrix'
    const [viewMode, setViewMode] = useState('table');

    // Filters and search
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState(searchParams.get('sort') || 'id_asc');

    // Selected requirement for detail panel
    const [selectedReqKey, setSelectedReqKey] = useState(searchParams.get('req') || '');
    const [isDetailOpen, setIsDetailOpen] = useState(Boolean(searchParams.get('req')));
    const [selectedTableIndex, setSelectedTableIndex] = useState(0);

    // Matrix highlighting & grid coordinates
    const [highlightedCell, setHighlightedCell] = useState(null); // { reqKey, tcId }
    const [matrixGridFocus, setMatrixGridFocus] = useState({ row: 0, col: 0 });

    // Export dropdown and toast
    const [exportOpen, setExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const searchInputRef = useRef(null);

    // Edit Requirement Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({ id: '', title: '', description: '', priority: 'Medium' });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // "Run Tests" Modal State
    const [isRunModalOpen, setIsRunModalOpen] = useState(false);
    const [runEnvironment, setRunEnvironment] = useState('Staging');

    // ─── 1. Load Suites List ───
    const loadSuites = useCallback(async () => {
        setIsLoadingSuites(true);
        setSuitesError(null);
        try {
            const list = await traceabilityService.getSuites();
            setSuites(list);
            return list;
        } catch (err) {
            setSuitesError(err.message || 'Failed to load test suites.');
            return [];
        } finally {
            setIsLoadingSuites(false);
        }
    }, []);

    useEffect(() => {
        loadSuites().then(list => {
            if (list.length > 0) {
                const currentInUrl = searchParams.get('suite');
                if (currentInUrl && (currentInUrl === 'all' || list.some(s => s.id === currentInUrl))) {
                    setSelectedSuiteId(currentInUrl);
                } else {
                    const sorted = [...list].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                    const defaultId = sorted[0]?.id || list[0]?.id;
                    setSelectedSuiteId(defaultId);
                    setSearchParams(prev => {
                        const next = new URLSearchParams(prev);
                        next.set('suite', defaultId);
                        return next;
                    }, { replace: true });
                }
            }
        });
    }, [loadSuites]);

    // Synchronize selectedSuiteId with URL changes
    useEffect(() => {
        const inUrl = searchParams.get('suite');
        if (inUrl && inUrl !== selectedSuiteId) {
            setSelectedSuiteId(inUrl);
        }
    }, [searchParams]);

    // ─── 2. Load Traceability Data for Selected Suite ───
    const loadTraceabilityData = useCallback(async (suiteId) => {
        if (!suiteId) return;
        setIsLoadingData(true);
        setDataError(null);
        try {
            const [reqs, sum, g, mat] = await Promise.all([
                traceabilityService.getRequirements(suiteId),
                traceabilityService.getSummary(suiteId),
                traceabilityService.getGaps(suiteId),
                traceabilityService.getMatrix(suiteId)
            ]);

            setRequirements(reqs);
            setSummary(sum || computeTraceabilitySummary(reqs));
            setGaps(g || []);
            setMatrixData(mat);

            if (reqs.length > 0) {
                const reqParam = searchParams.get('req');
                const matched = reqs.find(r => r.id === reqParam || r.key === reqParam);
                if (matched) {
                    setSelectedReqKey(matched.key);
                    setIsDetailOpen(true);
                } else if (!selectedReqKey) {
                    setSelectedReqKey(reqs[0].key);
                }
            }
        } catch (err) {
            setDataError(err.message || 'Failed to load requirement traceability.');
        } finally {
            setIsLoadingData(false);
        }
    }, [searchParams, selectedReqKey]);

    useEffect(() => {
        if (selectedSuiteId) {
            loadTraceabilityData(selectedSuiteId);
        }
    }, [selectedSuiteId, loadTraceabilityData]);

    // ─── 3. Filtered Requirements ───
    const filteredRows = useMemo(() => {
        return filterRequirements(requirements, {
            query: searchQuery,
            statusFilter,
            priorityFilter,
            sort: sortOrder
        });
    }, [requirements, searchQuery, statusFilter, priorityFilter, sortOrder]);

    const activeRequirement = useMemo(() => {
        return requirements.find(r => r.key === selectedReqKey) || filteredRows[0] || null;
    }, [requirements, selectedReqKey, filteredRows]);

    const selectedSuiteObj = useMemo(() => {
        if (selectedSuiteId === 'all') {
            return { title: 'All Suites', platform: 'Multi', totalCases: suites.reduce((acc, s) => acc + (s.totalCases || 0), 0) };
        }
        return suites.find(s => s.id === selectedSuiteId) || null;
    }, [suites, selectedSuiteId]);

    // Check if any requirements are derived
    const hasDerivedReqs = useMemo(() => {
        return requirements.some(r => r.source === 'derived');
    }, [requirements]);

    // Group test case columns by type for the Matrix view
    const matrixCategoryGroups = useMemo(() => {
        if (!matrixData?.testCases || matrixData.testCases.length === 0) return [];
        const groups = [];
        let currentGroup = null;
        matrixData.testCases.forEach(tc => {
            const cat = tc.type || 'Functional';
            if (!currentGroup || currentGroup.category !== cat) {
                currentGroup = { category: cat, count: 1, testCases: [tc] };
                groups.push(currentGroup);
            } else {
                currentGroup.count += 1;
                currentGroup.testCases.push(tc);
            }
        });
        return groups;
    }, [matrixData?.testCases]);

    // ─── 4. Keyboard Shortcuts: "/" to focus search, Esc to close detail ───
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === '/' && document.activeElement !== searchInputRef.current && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'Escape') {
                if (comboboxOpen) setComboboxOpen(false);
                if (exportOpen) setExportOpen(false);
                if (isDetailOpen) handleCloseDetail();
                if (isEditModalOpen) setIsEditModalOpen(false);
                if (isRunModalOpen) setIsRunModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [comboboxOpen, exportOpen, isDetailOpen, isEditModalOpen, isRunModalOpen]);

    // Table Arrow Key Navigation
    const handleTableKeyDown = (e) => {
        if (filteredRows.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedTableIndex(prev => {
                const next = Math.min(prev + 1, filteredRows.length - 1);
                setSelectedReqKey(filteredRows[next]?.key);
                return next;
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedTableIndex(prev => {
                const next = Math.max(prev - 1, 0);
                setSelectedReqKey(filteredRows[next]?.key);
                return next;
            });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            setIsDetailOpen(true);
        }
    };

    // Matrix Grid Keyboard Navigation
    const handleMatrixKeyDown = (e) => {
        if (!matrixData?.requirements || !matrixData?.testCases) return;
        const totalRows = matrixData.requirements.length;
        const totalCols = matrixData.testCases.length;
        if (totalRows === 0 || totalCols === 0) return;

        let { row, col } = matrixGridFocus;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            row = Math.min(row + 1, totalRows - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            row = Math.max(row - 1, 0);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            col = Math.min(col + 1, totalCols - 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            col = Math.max(col - 1, 0);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const targetReq = matrixData.requirements[row];
            const targetTc = matrixData.testCases[col];
            if (targetReq) {
                setSelectedReqKey(targetReq.key || targetReq.id);
                setHighlightedCell({ reqKey: targetReq.id, tcId: targetTc?.id });
                setIsDetailOpen(true);
            }
            return;
        } else {
            return;
        }

        setMatrixGridFocus({ row, col });
        const targetReq = matrixData.requirements[row];
        const targetTc = matrixData.testCases[col];
        if (targetReq && targetTc) {
            setHighlightedCell({ reqKey: targetReq.id, tcId: targetTc.id });
        }
    };

    // ─── 5. Actions ───
    const handleSelectSuite = (id) => {
        setSelectedSuiteId(id);
        setComboboxOpen(false);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('suite', id);
            next.delete('req');
            return next;
        });
    };

    const handleSortChange = (newSort) => {
        setSortOrder(newSort);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('sort', newSort);
            return next;
        }, { replace: true });
    };

    const handleOpenDetail = (row, index) => {
        setSelectedReqKey(row.key);
        setSelectedTableIndex(index);
        setIsDetailOpen(true);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('req', row.id || row.key);
            return next;
        }, { replace: true });
    };

    const handleCloseDetail = () => {
        setIsDetailOpen(false);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('req');
            return next;
        }, { replace: true });
    };

    const handleExport = async (format) => {
        setIsExporting(true);
        setExportOpen(false);
        try {
            if (format === 'pdf') {
                window.print();
                setToastMessage('Opened print report preview');
            } else {
                await traceabilityService.exportReport(selectedSuiteId, format);
                setToastMessage(`Exported traceability report (${format.toUpperCase()})`);
            }
            setTimeout(() => setToastMessage(''), 4000);
        } catch (err) {
            setToastMessage(`Export failed: ${err.message}`);
            setTimeout(() => setToastMessage(''), 4000);
        } finally {
            setIsExporting(false);
        }
    };

    // Filter by summary metric button
    const handleSummaryFilterClick = (statusKey) => {
        setStatusFilter(prev => prev === statusKey ? 'all' : statusKey);
    };

    // Open Requirement Edit Modal
    const handleOpenEditModal = (req) => {
        if (!req) return;
        setEditFormData({
            id: req.id,
            title: req.title,
            description: req.description || req.title,
            priority: req.priority || 'Medium'
        });
        setIsEditModalOpen(true);
    };

    // Submit Requirement Edit
    const handleSaveRequirementEdit = async (e) => {
        e.preventDefault();
        if (!editFormData.id) return;
        setIsSavingEdit(true);
        try {
            await traceabilityService.updateRequirement(editFormData.id, {
                title: editFormData.title,
                description: editFormData.description,
                priority: editFormData.priority,
                suiteId: selectedSuiteId
            });

            // Update in-memory requirements
            setRequirements(prev => prev.map(r => {
                if (String(r.id) === String(editFormData.id) || String(r.key) === String(editFormData.id)) {
                    return {
                        ...r,
                        title: editFormData.title,
                        description: editFormData.description,
                        priority: editFormData.priority,
                        source: 'manual'
                    };
                }
                return r;
            }));

            setToastMessage(`Updated requirement ${editFormData.id}`);
            setTimeout(() => setToastMessage(''), 4000);
            setIsEditModalOpen(false);
        } catch (err) {
            setToastMessage(`Update failed: ${err.message}`);
            setTimeout(() => setToastMessage(''), 4000);
        } finally {
            setIsSavingEdit(false);
        }
    };

    // ─── 6. Computed Segmented Bar Values (5 Mutually Exclusive States) ───
    const segmentPercentages = useMemo(() => {
        if (!summary || summary.total === 0) return { verified: 0, partial: 0, failing: 0, unverified: 0, uncovered: 100 };
        const total = summary.total;
        return {
            verified: (summary.verified / total) * 100,
            partial: (summary.partial / total) * 100,
            failing: (summary.failing / total) * 100,
            unverified: (summary.unverified / total) * 100,
            uncovered: (summary.uncovered / total) * 100
        };
    }, [summary]);

    // Check celebration state: All requirements verified
    const isCelebration = summary && summary.total > 0 && summary.verified === summary.total;

    const pageTitle = view === 'coverage' ? 'Coverage' : 'Traceability';
    const pageDesc = 'End-to-end requirement-to-test mapping, execution verification, and coverage analysis.';

    return (
        <div className="traceability-page" role="region" aria-label="Coverage and Traceability Matrix">
            {/* ─── Header ─── */}
            <header className="trace-header">
                <div className="trace-header-main">
                    <div className="trace-header-title">
                        <h1>{pageTitle}</h1>
                        <p className="trace-header-desc">
                            {pageDesc}
                        </p>
                        <div className="trace-header-meta">
                            {summary?.updatedAt && <span>Updated {formatUpdated(summary.updatedAt)}</span>}
                            <span>Linked: {summary?.linkedPercent ?? 0}%</span>
                            <span>Verified: {summary?.verifiedPercent ?? 0}%</span>
                            {selectedSuiteObj?.platform && <span>{selectedSuiteObj.platform}</span>}
                            {selectedSuiteObj?.totalCases !== undefined && <span>{selectedSuiteObj.totalCases} test cases</span>}
                        </div>
                    </div>

                    <div className="trace-header-actions">
                        {/* ─── Suite Combobox ─── */}
                        <div className="trace-combobox" ref={comboboxRef}>
                            {isLoadingSuites ? (
                                <div className="trace-skeleton" style={{ width: 260, height: 38 }} />
                            ) : suitesError ? (
                                <button type="button" className="trace-combobox-trigger" onClick={loadSuites}>
                                    <span>Failed to load suites</span>
                                    <RefreshCw size={14} />
                                </button>
                            ) : suites.length === 0 ? (
                                <button type="button" className="trace-combobox-trigger" onClick={() => navigate('/app/workspace')}>
                                    <span>No suites found · Create</span>
                                    <Plus size={14} />
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="trace-combobox-trigger"
                                        aria-haspopup="listbox"
                                        aria-expanded={comboboxOpen}
                                        onClick={() => setComboboxOpen(prev => !prev)}
                                    >
                                        <span className="trace-combobox-title">
                                            {selectedSuiteObj?.title || 'Select a suite'}
                                        </span>
                                        {selectedSuiteObj?.platform && (
                                            <span className="trace-combobox-tag">{selectedSuiteObj.platform}</span>
                                        )}
                                        <ChevronDown size={14} />
                                    </button>

                                    {comboboxOpen && (
                                        <div className="trace-combobox-menu" role="listbox">
                                            <div className="trace-combobox-search">
                                                <Search size={14} />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Search suites..."
                                                    value={comboboxSearch}
                                                    onChange={e => setComboboxSearch(e.target.value)}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={selectedSuiteId === 'all'}
                                                className={`trace-combobox-item ${selectedSuiteId === 'all' ? 'selected' : ''}`}
                                                onClick={() => handleSelectSuite('all')}
                                            >
                                                <div className="trace-combobox-item-info">
                                                    <span className="trace-combobox-item-title">All Suites</span>
                                                    <span className="trace-combobox-item-sub">Unified workspace coverage</span>
                                                </div>
                                                <span className="trace-combobox-tag">All</span>
                                            </button>
                                            {suites
                                                .filter(s => (s.title || '').toLowerCase().includes(comboboxSearch.toLowerCase()))
                                                .map(s => (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={selectedSuiteId === s.id}
                                                        className={`trace-combobox-item ${selectedSuiteId === s.id ? 'selected' : ''}`}
                                                        onClick={() => handleSelectSuite(s.id)}
                                                    >
                                                        <div className="trace-combobox-item-info">
                                                            <span className="trace-combobox-item-title">{s.title}</span>
                                                            <span className="trace-combobox-item-sub">
                                                                {s.totalCases || 0} cases · {s.requirementsCount || 0} reqs
                                                            </span>
                                                        </div>
                                                        <span className="trace-combobox-tag">{s.platform || 'Web'}</span>
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ─── View Toggle (Table | Matrix) ─── */}
                        <div className="trace-view-toggle" role="group" aria-label="View selection">
                            <button
                                type="button"
                                className={viewMode === 'table' ? 'active' : ''}
                                onClick={() => setViewMode('table')}
                                aria-pressed={viewMode === 'table'}
                            >
                                <TableIcon size={14} />
                                <span>Table</span>
                            </button>
                            <button
                                type="button"
                                className={viewMode === 'matrix' ? 'active' : ''}
                                onClick={() => setViewMode('matrix')}
                                aria-pressed={viewMode === 'matrix'}
                            >
                                <Grid size={14} />
                                <span>Matrix</span>
                            </button>
                        </div>

                        {/* ─── Export Report Menu ─── */}
                        <div className="trace-export-container">
                            <button
                                type="button"
                                className="trace-export-btn"
                                onClick={() => setExportOpen(prev => !prev)}
                                disabled={requirements.length === 0 || isExporting}
                                title={requirements.length === 0 ? 'Select a suite with requirements' : 'Export traceability report'}
                            >
                                <Download size={14} />
                                <span>{isExporting ? 'Exporting…' : 'Export report'}</span>
                            </button>
                            {exportOpen && (
                                <div className="trace-export-menu" role="menu">
                                    <button type="button" role="menuitem" onClick={() => handleExport('csv')}>
                                        Export CSV (.csv)
                                    </button>
                                    <button type="button" role="menuitem" onClick={() => handleExport('json')}>
                                        Export JSON (.json)
                                    </button>
                                    <button type="button" role="menuitem" onClick={() => handleExport('pdf')}>
                                        Print / PDF Report
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ─── Toast Feedback ─── */}
            {toastMessage && (
                <div className="trace-toast" role="status" aria-live="polite">
                    <Check size={16} />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* ─── Derived Notice Banner (When Requirements were Inferred) ─── */}
            {hasDerivedReqs && (
                <div className="trace-derived-notice" role="alert">
                    <AlertCircle size={15} />
                    <span>
                        <strong>Derived from test labels. Review:</strong> Some requirements were synthesized from test scenario names. Edit requirements to align with your specifications.
                    </span>
                </div>
            )}

            {/* ─── Summary Strip & Segmented Bar (5 Mutually Exclusive States) ─── */}
            <section className="trace-summary-strip" aria-label="Traceability Summary">
                <div className="trace-summary-metrics">
                    <button
                        type="button"
                        className={`trace-summary-btn ${statusFilter === 'verified' ? 'active' : ''}`}
                        onClick={() => handleSummaryFilterClick('verified')}
                        aria-pressed={statusFilter === 'verified'}
                    >
                        <span className="trace-summary-btn-val">{summary?.verified ?? 0}</span>
                        <span className="trace-summary-btn-label">Verified</span>
                    </button>
                    <button
                        type="button"
                        className={`trace-summary-btn ${statusFilter === 'partial' ? 'active' : ''}`}
                        onClick={() => handleSummaryFilterClick('partial')}
                        aria-pressed={statusFilter === 'partial'}
                    >
                        <span className="trace-summary-btn-val">{summary?.partial ?? 0}</span>
                        <span className="trace-summary-btn-label">Partial</span>
                    </button>
                    <button
                        type="button"
                        className={`trace-summary-btn ${statusFilter === 'failing' ? 'active' : ''}`}
                        onClick={() => handleSummaryFilterClick('failing')}
                        aria-pressed={statusFilter === 'failing'}
                    >
                        <span className="trace-summary-btn-val">{summary?.failing ?? 0}</span>
                        <span className="trace-summary-btn-label">Failing</span>
                    </button>
                    <button
                        type="button"
                        className={`trace-summary-btn ${statusFilter === 'unverified' ? 'active' : ''}`}
                        onClick={() => handleSummaryFilterClick('unverified')}
                        aria-pressed={statusFilter === 'unverified'}
                    >
                        <span className="trace-summary-btn-val">{summary?.unverified ?? 0}</span>
                        <span className="trace-summary-btn-label">Unverified</span>
                    </button>
                    <button
                        type="button"
                        className={`trace-summary-btn ${statusFilter === 'uncovered' ? 'active' : ''}`}
                        onClick={() => handleSummaryFilterClick('uncovered')}
                        aria-pressed={statusFilter === 'uncovered'}
                    >
                        <span className="trace-summary-btn-val">{summary?.uncovered ?? 0}</span>
                        <span className="trace-summary-btn-label">Uncovered</span>
                    </button>
                </div>

                {/* ─── Segmented Coverage Bar with Hatched Shades ─── */}
                <div className="trace-segmented-bar-wrapper">
                    <div
                        className="trace-segmented-bar"
                        role="progressbar"
                        aria-valuenow={summary?.linkedPercent ?? 0}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-label="Requirement coverage breakdown"
                    >
                        {segmentPercentages.verified > 0 && (
                            <div
                                className="trace-segment trace-segment-verified"
                                style={{ width: `${segmentPercentages.verified}%` }}
                                title={`Verified: ${summary?.verified ?? 0} (${Math.round(segmentPercentages.verified)}%)`}
                            />
                        )}
                        {segmentPercentages.partial > 0 && (
                            <div
                                className="trace-segment trace-segment-partial"
                                style={{ width: `${segmentPercentages.partial}%` }}
                                title={`Partial: ${summary?.partial ?? 0} (${Math.round(segmentPercentages.partial)}%)`}
                            />
                        )}
                        {segmentPercentages.failing > 0 && (
                            <div
                                className="trace-segment trace-segment-failing"
                                style={{ width: `${segmentPercentages.failing}%` }}
                                title={`Failing: ${summary?.failing ?? 0} (${Math.round(segmentPercentages.failing)}%)`}
                            />
                        )}
                        {segmentPercentages.unverified > 0 && (
                            <div
                                className="trace-segment trace-segment-unverified"
                                style={{ width: `${segmentPercentages.unverified}%` }}
                                title={`Unverified: ${summary?.unverified ?? 0} (${Math.round(segmentPercentages.unverified)}%)`}
                            />
                        )}
                        {segmentPercentages.uncovered > 0 && (
                            <div
                                className="trace-segment trace-segment-uncovered"
                                style={{ width: `${segmentPercentages.uncovered}%` }}
                                title={`Uncovered: ${summary?.uncovered ?? 0} (${Math.round(segmentPercentages.uncovered)}%)`}
                            />
                        )}
                    </div>

                    <div className="trace-segmented-legend">
                        <span className="trace-legend-item">
                            <span className="trace-legend-box verified" /> Verified: {summary?.verified ?? 0} ({Math.round(segmentPercentages.verified)}%)
                        </span>
                        <span className="trace-legend-item">
                            <span className="trace-legend-box partial" /> Partial: {summary?.partial ?? 0} ({Math.round(segmentPercentages.partial)}%)
                        </span>
                        <span className="trace-legend-item">
                            <span className="trace-legend-box failing" /> Failing: {summary?.failing ?? 0} ({Math.round(segmentPercentages.failing)}%)
                        </span>
                        <span className="trace-legend-item">
                            <span className="trace-legend-box unverified" /> Unverified: {summary?.unverified ?? 0} ({Math.round(segmentPercentages.unverified)}%)
                        </span>
                        <span className="trace-legend-item">
                            <span className="trace-legend-box uncovered" /> Uncovered: {summary?.uncovered ?? 0} ({Math.round(segmentPercentages.uncovered)}%)
                        </span>
                        <span style={{ marginLeft: 'auto', fontWeight: 500 }}>
                            Linked: {summary?.linkedPercent ?? 0}% · Verified: {summary?.verifiedPercent ?? 0}%
                        </span>
                    </div>

                    {!testRunsEnabled && (
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.72)', marginTop: '10px' }}>
                            Verification statuses update when your <NavLink to="/app/cicd" style={{ color: '#fff', textDecoration: 'underline' }}>CI/CD workflow</NavLink> reports test results back to Testnexa.
                        </div>
                    )}
                </div>
            </section>

            {/* ─── Gaps Panel (Actionable Cards) ─── */}
            {gaps.length > 0 && (
                <section className="trace-gaps-section" aria-label="Coverage Gaps">
                    <div className="trace-gaps-title">Coverage Gaps &amp; Opportunities</div>
                    <div className="trace-gaps-grid">
                        {gaps.map((gap, i) => (
                            <div key={i} className="trace-gap-card">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <span className="trace-gap-text">{gap.message}</span>
                                    {gap.type === 'unverified' && !testRunsEnabled && (
                                        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.56)' }}>
                                            Verification needs test execution, which is coming soon.
                                        </span>
                                    )}
                                </div>
                                {gap.type === 'unverified' ? (
                                    <RunButton
                                        label={gap.action}
                                        className="trace-gap-action-btn"
                                        onClick={() => setIsRunModalOpen(true)}
                                        feature="testRuns"
                                        showIcon={false}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        className="trace-gap-action-btn"
                                        onClick={() => {
                                            if (gap.type === 'uncovered') {
                                                setStatusFilter('uncovered');
                                            } else if (gap.type === 'failing') {
                                                setStatusFilter('failing');
                                            } else if (gap.type === 'single_test') {
                                                const singleReq = requirements.find(r => r.linkedCount === 1);
                                                if (singleReq) {
                                                    setSelectedReqKey(singleReq.key);
                                                    setIsDetailOpen(true);
                                                }
                                            } else if (gap.type === 'missing_negative_or_security') {
                                                navigate('/app/workspace');
                                            } else if (selectedSuiteId && selectedSuiteId !== 'all') {
                                                navigate(`/app/test-suites/${selectedSuiteId}`);
                                            }
                                        }}
                                    >
                                        {gap.action}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ─── Toolbar (Search, Filter Chips, Clear All) ─── */}
            <div className="trace-toolbar">
                <div className="trace-toolbar-left">
                    <div className="trace-search-box">
                        <Search size={14} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search requirements by ID or text (Press '/' to focus)"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <kbd className="trace-search-shortcut">/</kbd>
                    </div>

                    <div className="trace-filter-chips">
                        <button
                            type="button"
                            className={`trace-filter-chip ${statusFilter === 'verified' ? 'active' : ''}`}
                            onClick={() => setStatusFilter(prev => prev === 'verified' ? 'all' : 'verified')}
                            aria-pressed={statusFilter === 'verified'}
                        >
                            Verified
                        </button>
                        <button
                            type="button"
                            className={`trace-filter-chip ${statusFilter === 'unverified' ? 'active' : ''}`}
                            onClick={() => setStatusFilter(prev => prev === 'unverified' ? 'all' : 'unverified')}
                            aria-pressed={statusFilter === 'unverified'}
                        >
                            Unverified
                        </button>
                        <button
                            type="button"
                            className={`trace-filter-chip ${statusFilter === 'failing' ? 'active' : ''}`}
                            onClick={() => setStatusFilter(prev => prev === 'failing' ? 'all' : 'failing')}
                            aria-pressed={statusFilter === 'failing'}
                        >
                            Failing
                        </button>
                        <button
                            type="button"
                            className={`trace-filter-chip ${statusFilter === 'uncovered' ? 'active' : ''}`}
                            onClick={() => setStatusFilter(prev => prev === 'uncovered' ? 'all' : 'uncovered')}
                            aria-pressed={statusFilter === 'uncovered'}
                        >
                            Uncovered
                        </button>

                        {/* Priority Filter */}
                        <button
                            type="button"
                            className={`trace-filter-chip ${priorityFilter === 'high' ? 'active' : ''}`}
                            onClick={() => setPriorityFilter(prev => prev === 'high' ? 'all' : 'high')}
                            aria-pressed={priorityFilter === 'high'}
                        >
                            High Priority
                        </button>

                        {(statusFilter !== 'all' || priorityFilter !== 'all' || searchQuery.trim()) && (
                            <button
                                type="button"
                                className="trace-clear-all-btn"
                                onClick={() => {
                                    setStatusFilter('all');
                                    setPriorityFilter('all');
                                    setSearchQuery('');
                                }}
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                </div>

                <div className="trace-filtered-indicator">
                    {filteredRows.length !== requirements.length ? (
                        <span>Filtered: {filteredRows.length} of {requirements.length}</span>
                    ) : (
                        <span>Showing all {requirements.length} requirements</span>
                    )}
                </div>
            </div>

            {/* ─── Celebration State: All Requirements Verified ─── */}
            {isCelebration && (
                <div className="trace-empty-state trace-celebration-state" style={{ marginBottom: 20 }}>
                    <CheckCircle2 size={32} />
                    <h3>All {summary.total} requirements verified!</h3>
                    <p>Every requirement specification has at least one associated test case and has successfully passed execution verification.</p>
                </div>
            )}

            {/* ─── Main Content Split: Table or Matrix ─── */}
            {isLoadingData ? (
                <div className="trace-empty-state">
                    <div className="trace-skeleton" style={{ width: '100%', height: 260 }} />
                </div>
            ) : dataError ? (
                <div className="trace-empty-state">
                    <AlertCircle size={24} />
                    <h3>Requirement Traceability Unavailable</h3>
                    <p>{dataError}</p>
                    <button type="button" className="trace-primary-btn" onClick={() => loadTraceabilityData(selectedSuiteId)}>
                        Retry
                    </button>
                </div>
            ) : requirements.length === 0 ? (
                <div className="trace-empty-state">
                    <Layers size={32} />
                    <h3>No requirements found</h3>
                    <p>This suite has not generated or mapped requirement records yet.</p>
                    {selectedSuiteId && selectedSuiteId !== 'all' && (
                        <button
                            type="button"
                            className="trace-primary-btn"
                            onClick={() => navigate(`/app/test-suites/${selectedSuiteId}`)}
                        >
                            Add test cases or requirements
                        </button>
                    )}
                </div>
            ) : filteredRows.length === 0 ? (
                <div className="trace-empty-state">
                    <Filter size={24} />
                    <h3>No requirements match these filters</h3>
                    <p>Try adjusting your search query, status filter, or priority filter.</p>
                    <button
                        type="button"
                        className="trace-primary-btn"
                        onClick={() => {
                            setStatusFilter('all');
                            setPriorityFilter('all');
                            setSearchQuery('');
                        }}
                    >
                        Clear all filters
                    </button>
                </div>
            ) : viewMode === 'matrix' ? (
                /* ─── Matrix View ─── */
                <div className="trace-matrix-wrapper">
                    {/* Monochrome Shape Legend */}
                    <div className="trace-matrix-legend" aria-label="Matrix glyph legend">
                        <span className="trace-matrix-legend-item">
                            <span className="trace-matrix-symbol symbol-dot">●</span> Linked
                        </span>
                        <span className="trace-matrix-legend-item">
                            <span className="trace-matrix-symbol symbol-check">✓</span> Passed
                        </span>
                        <span className="trace-matrix-legend-item">
                            <span className="trace-matrix-symbol symbol-x">✕</span> Failed
                        </span>
                        <span className="trace-matrix-legend-item">
                            <span className="trace-matrix-symbol symbol-circle">○</span> Not executed
                        </span>
                        <span className="trace-matrix-legend-item">
                            <span style={{ color: 'var(--text-3)' }}>—</span> Not linked
                        </span>
                    </div>

                    <div
                        className="trace-matrix-container"
                        tabIndex={0}
                        role="grid"
                        aria-label="Requirements Traceability Matrix"
                        onKeyDown={handleMatrixKeyDown}
                    >
                        <table className="trace-matrix-table">
                            <thead>
                                {/* Top Category Group Headers */}
                                <tr>
                                    <th className="sticky-col" rowSpan={2}>Requirement \ Test Case</th>
                                    {matrixCategoryGroups.map((group, gIdx) => (
                                        <th
                                            key={gIdx}
                                            colSpan={group.count}
                                            className="trace-matrix-group-th"
                                        >
                                            {group.category}
                                        </th>
                                    ))}
                                </tr>
                                {/* Subheader: Short Test IDs */}
                                <tr>
                                    {matrixData?.testCases.map((tc, tcIdx) => (
                                        <th
                                            key={tc.id}
                                            className={highlightedCell?.tcId === tc.id ? 'trace-matrix-col-highlight' : ''}
                                            title={`${tc.id}: ${tc.title} (${tc.type})`}
                                        >
                                            <div className="trace-matrix-tc-header">
                                                {getShortTestId(tc.id)}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {matrixData?.requirements.map((req, rIdx) => {
                                    const isRowHighlighted = highlightedCell?.reqKey === req.id || highlightedCell?.reqKey === req.key;
                                    return (
                                        <tr key={req.id} className={isRowHighlighted ? 'trace-matrix-row-highlight' : ''}>
                                            <th className="sticky-col" title={req.title}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className="trace-req-key">{req.id}</span>
                                                    <SourceTag source={req.source} />
                                                </div>
                                                <div className="trace-req-title-text" style={{ fontSize: 12 }}>
                                                    {req.title.length > 34 ? `${req.title.slice(0, 34)}…` : req.title}
                                                </div>
                                            </th>
                                            {matrixData?.testCases.map((tc, cIdx) => {
                                                const cell = matrixData.cells?.[req.id]?.[tc.id] || matrixData.cells?.[req.key]?.[tc.id] || { linked: false };
                                                const isSelected = highlightedCell?.reqKey === req.id && highlightedCell?.tcId === tc.id;
                                                const isFocused = matrixGridFocus.row === rIdx && matrixGridFocus.col === cIdx;

                                                return (
                                                    <td
                                                        key={`${req.id}-${tc.id}`}
                                                        className={`trace-matrix-cell ${isSelected || isFocused ? 'highlighted' : ''}`}
                                                        onClick={() => {
                                                            setHighlightedCell({ reqKey: req.id, tcId: tc.id });
                                                            setMatrixGridFocus({ row: rIdx, col: cIdx });
                                                            handleOpenDetail(req, rIdx);
                                                        }}
                                                        title={cell.linked ? `Linked: ${req.id} ↔ ${tc.id}\nStatus: ${cell.status}\nRationale: ${cell.rationale}` : 'Not linked'}
                                                        role="gridcell"
                                                        aria-selected={isSelected}
                                                    >
                                                        {cell.linked ? (
                                                            cell.status === 'passed' ? (
                                                                <span className="trace-matrix-symbol symbol-check">✓</span>
                                                            ) : cell.status === 'failed' ? (
                                                                <span className="trace-matrix-symbol symbol-x">✕</span>
                                                            ) : cell.status === 'not_run' ? (
                                                                <span className="trace-matrix-symbol symbol-circle">○</span>
                                                            ) : (
                                                                <span className="trace-matrix-symbol symbol-dot">●</span>
                                                            )
                                                        ) : (
                                                            <span style={{ color: 'var(--line)' }}>—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* ─── Table View (Default View) ─── */
                <div
                    className={`trace-content-split ${isDetailOpen ? 'panel-open' : ''}`}
                    onKeyDown={handleTableKeyDown}
                    tabIndex={0}
                >
                    <div className="trace-table-container">
                        <table className="trace-table" aria-label="Requirements List">
                            <thead>
                                <tr>
                                    <th
                                        className="sortable"
                                        onClick={() => handleSortChange(sortOrder === 'id_asc' ? 'id_desc' : 'id_asc')}
                                        aria-sort={sortOrder.startsWith('id') ? (sortOrder === 'id_asc' ? 'ascending' : 'descending') : 'none'}
                                    >
                                        Requirement
                                    </th>
                                    <th>Source</th>
                                    <th
                                        className="sortable"
                                        onClick={() => handleSortChange(sortOrder === 'priority_desc' ? 'priority_asc' : 'priority_desc')}
                                        aria-sort={sortOrder.startsWith('priority') ? (sortOrder === 'priority_desc' ? 'descending' : 'ascending') : 'none'}
                                    >
                                        Priority
                                    </th>
                                    <th
                                        className="sortable"
                                        onClick={() => handleSortChange(sortOrder === 'linked_desc' ? 'linked_asc' : 'linked_desc')}
                                        aria-sort={sortOrder.startsWith('linked') ? (sortOrder === 'linked_desc' ? 'descending' : 'ascending') : 'none'}
                                    >
                                        Linked Tests
                                    </th>
                                    <th>Status</th>
                                    <th>Executed / Passed / Failed</th>
                                    <th>Last Run</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row, index) => {
                                    const isActive = isDetailOpen && activeRequirement?.key === row.key;
                                    const totalLinked = row.linkedCount || 0;
                                    const passPct = totalLinked > 0 ? (row.passedCount / totalLinked) * 100 : 0;
                                    const failPct = totalLinked > 0 ? (row.failedCount / totalLinked) * 100 : 0;
                                    const notRunPct = 100 - (passPct + failPct);

                                    return (
                                        <tr
                                            key={row.key}
                                            className={isActive ? 'active-row' : ''}
                                            onClick={() => handleOpenDetail(row, index)}
                                        >
                                            <td>
                                                <div className="trace-table-cell-title">
                                                    <span className="trace-req-key">{row.id}</span>
                                                    <span className="trace-req-title-text">{row.title}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <SourceTag source={row.source} />
                                            </td>
                                            <td>
                                                <span className={`trace-priority-tag priority-${(row.priority || 'medium').toLowerCase()}`}>
                                                    {row.priority || 'Medium'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="trace-mini-bar-container">
                                                    <strong>{row.linkedCount}</strong>
                                                    {totalLinked > 0 && (
                                                        <div
                                                            className="trace-mini-bar"
                                                            title={`${row.passedCount} passed, ${row.failedCount} failed, ${totalLinked - row.executedCount} not executed`}
                                                        >
                                                            {passPct > 0 && <div className="trace-mini-bar-seg passed" style={{ width: `${passPct}%` }} />}
                                                            {failPct > 0 && <div className="trace-mini-bar-seg failed" style={{ width: `${failPct}%` }} />}
                                                            {notRunPct > 0 && <div className="trace-mini-bar-seg not-run" style={{ width: `${notRunPct}%` }} />}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <StatusPill status={row.status} />
                                            </td>
                                            <td>
                                                <div className="trace-table-cell-counts">
                                                    <span>{row.executedCount} exec</span>
                                                    <span>·</span>
                                                    <span>{row.passedCount} pass</span>
                                                    <span>·</span>
                                                    <span>{row.failedCount} fail</span>
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                                                {row.lastRun ? formatUpdated(row.lastRun) : 'Never'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ─── Detail Drawer (Right-Hand Panel) ─── */}
                    {isDetailOpen && activeRequirement && (
                        <aside className="trace-detail-drawer" aria-label="Requirement Details">
                            <div className="trace-detail-top">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="trace-req-key">{activeRequirement.id}</span>
                                    <SourceTag source={activeRequirement.source} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <button
                                        type="button"
                                        className="trace-detail-action-link"
                                        onClick={() => handleOpenEditModal(activeRequirement)}
                                        title="Edit requirement"
                                    >
                                        <Edit3 size={13} />
                                        <span>Edit</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="trace-detail-close-btn"
                                        onClick={handleCloseDetail}
                                        aria-label="Close detail panel"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="trace-detail-body">
                                <h2>{activeRequirement.title}</h2>
                                <p className="trace-detail-desc">{activeRequirement.description}</p>

                                {activeRequirement.source_quote && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4, letterSpacing: '0.04em' }}>
                                            Specification Source Quote
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-2)', background: 'var(--surface-2)', borderLeft: '2px solid var(--text-1)', padding: '8px 12px', fontStyle: 'italic' }}>
                                            "{activeRequirement.source_quote}"
                                        </div>
                                    </div>
                                )}

                                <div className="trace-detail-meta-grid">
                                    <div>
                                        <span>Priority</span>
                                        <strong>{activeRequirement.priority || 'Medium'}</strong>
                                    </div>
                                    <div>
                                        <span>Status</span>
                                        <div style={{ marginTop: 4 }}>
                                            <StatusPill status={activeRequirement.status} />
                                        </div>
                                    </div>
                                </div>

                                <div className="trace-detail-tests-header">
                                    <h3>Linked Test Cases ({activeRequirement.linkedCount})</h3>
                                    {activeRequirement.linkedCount > 0 && (
                                        <RunButton
                                            label="Run tests"
                                            className="trace-gap-action-btn"
                                            iconSize={11}
                                            onClick={() => setIsRunModalOpen(true)}
                                            feature="testRuns"
                                        />
                                    )}
                                </div>

                                {activeRequirement.linkedTests.length === 0 ? (
                                    <div className="trace-empty-state" style={{ padding: '24px 12px' }}>
                                        <AlertCircle size={20} />
                                        <p style={{ margin: '8px 0 12px', fontSize: 12 }}>No test cases are linked to this requirement.</p>
                                        {selectedSuiteId && selectedSuiteId !== 'all' && (
                                            <button
                                                type="button"
                                                className="trace-primary-btn"
                                                style={{ fontSize: 12, padding: '4px 10px' }}
                                                onClick={() => navigate(`/app/test-suites/${selectedSuiteId}`)}
                                            >
                                                Add tests to this requirement
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="trace-detail-tests-list">
                                        {activeRequirement.linkedTests.map(tc => (
                                            <div key={tc.testCaseId} className="trace-detail-test-card">
                                                <div className="trace-detail-test-header">
                                                    <span className="trace-test-id-pill">{tc.testCaseId}</span>
                                                    <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-2)' }}>
                                                        {tc.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <h4 className="trace-detail-test-title">{tc.title}</h4>
                                                <div className="trace-detail-test-meta">
                                                    <span>{tc.category}</span> · <span>{tc.priority} priority</span> · <span>{tc.approvalStatus}</span>
                                                </div>
                                                {tc.rationale && (
                                                    <div className="trace-detail-test-rationale">
                                                        <strong>Rationale:</strong> {tc.rationale}
                                                    </div>
                                                )}
                                                <div className="trace-detail-test-actions">
                                                    {selectedSuiteId && selectedSuiteId !== 'all' && (
                                                        <button
                                                            type="button"
                                                            className="trace-detail-action-link"
                                                            onClick={() => navigate(`/app/test-suites/${selectedSuiteId}?testCaseId=${tc.testCaseId}`)}
                                                        >
                                                            <span>Open test case</span>
                                                            <ArrowUpRight size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </aside>
                    )}
                </div>
            )}

            {/* ─── Edit Requirement Modal ─── */}
            {isEditModalOpen && (
                <div className="trace-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-req-title">
                    <div className="trace-modal-card">
                        <div className="trace-modal-header">
                            <h3 id="edit-req-title">Edit Requirement {editFormData.id}</h3>
                            <button
                                type="button"
                                className="trace-modal-close"
                                onClick={() => setIsEditModalOpen(false)}
                                aria-label="Close dialog"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveRequirementEdit}>
                            <div className="trace-form-group">
                                <label htmlFor="edit-req-title-input">Requirement Title</label>
                                <input
                                    id="edit-req-title-input"
                                    type="text"
                                    className="trace-form-input"
                                    required
                                    value={editFormData.title}
                                    onChange={e => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                                />
                            </div>
                            <div className="trace-form-group">
                                <label htmlFor="edit-req-desc-input">Requirement Description</label>
                                <textarea
                                    id="edit-req-desc-input"
                                    className="trace-form-textarea"
                                    rows={4}
                                    value={editFormData.description}
                                    onChange={e => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>
                            <div className="trace-form-group">
                                <label htmlFor="edit-req-priority-select">Priority</label>
                                <select
                                    id="edit-req-priority-select"
                                    className="trace-form-select"
                                    value={editFormData.priority}
                                    onChange={e => setEditFormData(prev => ({ ...prev, priority: e.target.value }))}
                                >
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                            <div className="trace-modal-actions">
                                <button
                                    type="button"
                                    className="trace-btn-secondary"
                                    onClick={() => setIsEditModalOpen(false)}
                                    disabled={isSavingEdit}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="trace-primary-btn"
                                    disabled={isSavingEdit || !editFormData.title.trim()}
                                >
                                    {isSavingEdit ? 'Saving…' : 'Save changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Run Tests Modal ─── */}
            {isRunModalOpen && (
                <div className="trace-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="run-tests-title">
                    <div className="trace-modal-card">
                        <div className="trace-modal-header">
                            <h3 id="run-tests-title">Execute Verification Run</h3>
                            <button
                                type="button"
                                className="trace-modal-close"
                                onClick={() => setIsRunModalOpen(false)}
                                aria-label="Close dialog"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '0 0 12px 0' }}>
                                Start a verification run for <strong>{selectedSuiteObj?.title || 'Suite'}</strong>. Test execution will run associated test cases and update requirement verification status.
                            </p>
                            <div className="trace-form-group">
                                <label htmlFor="run-env-select">Target Environment</label>
                                <select
                                    id="run-env-select"
                                    className="trace-form-select"
                                    value={runEnvironment}
                                    onChange={e => setRunEnvironment(e.target.value)}
                                >
                                    <option value="Staging">Staging (Default)</option>
                                    <option value="Production">Production</option>
                                    <option value="Local">Local Host</option>
                                </select>
                            </div>
                        </div>
                        <div className="trace-modal-actions">
                            <button
                                type="button"
                                className="trace-btn-secondary"
                                onClick={() => setIsRunModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <RunButton
                                label="Start execution run"
                                className="trace-primary-btn"
                                iconSize={14}
                                onClick={() => {
                                    setIsRunModalOpen(false);
                                    navigate(`/app/runs${selectedSuiteId && selectedSuiteId !== 'all' ? `?suiteId=${selectedSuiteId}` : ''}`);
                                }}
                                feature="testRuns"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoverageTraceabilityPage;
