import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Plus,
    Search,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Check,
    Layers,
    Archive,
    RotateCcw,
    Copy,
    Download,
    MoreHorizontal,
    ExternalLink,
    Edit2,
    RefreshCw,
    X,
    Filter,
    WifiOff,
    CheckCircle2,
    Play
} from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import { executionService } from '../../services/executionService';
import {
    computeSuiteMetrics,
    filterAndSortSuites,
    paginateSuites,
    normalizeSuite
} from '../../utils/testSuiteSelectors';
import '../../styles/app/TestSuitesManagement.css';

const emptyForm = () => ({ name: '', description: '', project: '', tags: '' });

export default function TestSuitesListPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Raw data states
    const [records, setRecords] = useState([]);
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    // Filter, search, and pagination states (synchronized with URL params)
    const queryParam = searchParams.get('q') || '';
    const statusParam = searchParams.get('status') || 'all';
    const platformParam = searchParams.get('platform') || 'all';
    const sortParam = searchParams.get('sort') || 'updated_desc';
    const pageParam = parseInt(searchParams.get('page') || '1', 10);
    const pageSizeParam = parseInt(searchParams.get('pageSize') || '25', 10);

    const [searchInput, setSearchInput] = useState(queryParam);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [lastSelectedId, setLastSelectedId] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [liveMessage, setLiveMessage] = useState('');

    // Modal state for Edit Suite metadata
    const [modal, setModal] = useState(''); // '' | 'edit'
    const [selectedSuite, setSelectedSuite] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Toast state with Undo support (8s timer)
    const [toast, setToast] = useState(null); // { id, message, onUndo, timeoutId }

    // DOM references
    const searchInputRef = useRef(null);
    const headerCheckboxRef = useRef(null);
    const tableBodyRef = useRef(null);

    // Online/Offline detection
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

    // Global keyboard shortcut: "/" focuses the search bar; "Escape" closes menus
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === '/' && document.activeElement !== searchInputRef.current && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'Escape') {
                if (activeMenuId) setActiveMenuId(null);
                if (modal) setModal('');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeMenuId, modal]);

    // Close row menu when clicking outside
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (!e.target.closest('.ts-row-menu-wrap')) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    // Debounce search input to URL query
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== queryParam) {
                updateParam('q', searchInput.trim(), true);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [searchInput, queryParam]);

    // Keep searchInput in sync if queryParam changes externally
    useEffect(() => {
        setSearchInput(queryParam);
    }, [queryParam]);

    // Helper to update search params
    const updateParam = (key, value, resetPage = false) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value && value !== 'all' && value !== 'updated_desc' && value !== '') {
                next.set(key, String(value));
            } else {
                next.delete(key);
            }
            if (resetPage) {
                next.delete('page');
            }
            return next;
        }, { replace: true });
    };

    // Load suites and execution history
    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const first = await sessionService.list({ page: 1, limit: 50, sort: 'updatedAt' });
            if (!first?.success) throw new Error(first?.message || 'Test suites could not be loaded.');
            const allSessions = [...(first.data || [])];
            for (let p = 2; p <= Number(first.pagination?.totalPages || 1); p += 1) {
                const res = await sessionService.list({ page: p, limit: 50, sort: 'updatedAt' });
                if (res?.success && res.data) {
                    allSessions.push(...res.data);
                }
            }
            setRecords(allSessions);

            try {
                const firstRuns = await executionService.listRuns({ page: 1, limit: 100, sort: 'newest' });
                if (firstRuns?.success && firstRuns.data) {
                    const allRuns = [...firstRuns.data];
                    for (let p = 2; p <= Number(firstRuns.pagination?.totalPages || 1); p += 1) {
                        const runRes = await executionService.listRuns({ page: p, limit: 100, sort: 'newest' });
                        if (runRes?.success && runRes.data) {
                            allRuns.push(...runRes.data);
                        }
                    }
                    setRuns(allRuns);
                }
            } catch (runErr) {
                // Non-fatal: test suites load even if run metrics fail
                console.warn('Execution history load warning:', runErr);
                setRuns([]);
            }
        } catch (err) {
            setError(err.message || 'Unable to connect to Testnexa backend.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Normalized suites
    const recordsById = useMemo(() => new Map(records.map(r => [String(r.id || r._id || r.sessionId || ''), r])), [records]);
    const normalizedSuites = useMemo(() => {
        return records.map(r => normalizeSuite(r, runs, recordsById));
    }, [records, runs, recordsById]);

    // Single source of truth metrics
    const metrics = useMemo(() => computeSuiteMetrics(normalizedSuites), [normalizedSuites]);

    // Filtered & sorted suites
    const filteredSuites = useMemo(() => {
        return filterAndSortSuites(normalizedSuites, {
            query: queryParam,
            statusFilter: statusParam,
            platformFilter: platformParam,
            sort: sortParam
        });
    }, [normalizedSuites, queryParam, statusParam, platformParam, sortParam]);

    // Announce search result count to screen readers
    useEffect(() => {
        if (!loading) {
            setLiveMessage(`${filteredSuites.length} suite${filteredSuites.length === 1 ? '' : 's'} found`);
        }
    }, [filteredSuites.length, loading]);

    // Paginated rows
    const pagination = useMemo(() => {
        return paginateSuites(filteredSuites, pageParam, pageSizeParam);
    }, [filteredSuites, pageParam, pageSizeParam]);

    const rows = pagination.rows;

    // Header checkbox indeterminate calculation
    useEffect(() => {
        if (headerCheckboxRef.current) {
            const rowIds = rows.map(r => r.id);
            const selectedOnPage = rowIds.filter(id => selectedIds.has(id)).length;
            const isAll = rowIds.length > 0 && selectedOnPage === rowIds.length;
            const isPartial = selectedOnPage > 0 && selectedOnPage < rowIds.length;
            headerCheckboxRef.current.checked = isAll;
            headerCheckboxRef.current.indeterminate = isPartial;
        }
    }, [rows, selectedIds]);

    // Clear all filters helper
    const handleClearAllFilters = () => {
        setSearchInput('');
        setSearchParams(new URLSearchParams(), { replace: true });
        setLiveMessage('Filters cleared');
    };

    // Show Toast helper with optional undo
    const showToast = (message, onUndo = null) => {
        if (toast?.timeoutId) clearTimeout(toast.timeoutId);
        const timeoutId = setTimeout(() => {
            setToast(null);
        }, 8000);
        setToast({ id: Date.now(), message, onUndo, timeoutId });
        setLiveMessage(message);
    };

    const handleToastUndo = () => {
        if (toast?.onUndo) {
            toast.onUndo();
        }
        if (toast?.timeoutId) clearTimeout(toast.timeoutId);
        setToast(null);
    };

    // Selection handlers (including shift-click range selection)
    const handleRowCheckbox = (e, suiteId) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            const isShift = e.nativeEvent?.shiftKey;

            if (isShift && lastSelectedId) {
                const ids = rows.map(r => r.id);
                const start = ids.indexOf(lastSelectedId);
                const end = ids.indexOf(suiteId);
                if (start !== -1 && end !== -1) {
                    const [minIdx, maxIdx] = start < end ? [start, end] : [end, start];
                    for (let i = minIdx; i <= maxIdx; i++) {
                        next.add(ids[i]);
                    }
                    return next;
                }
            }

            if (next.has(suiteId)) {
                next.delete(suiteId);
            } else {
                next.add(suiteId);
            }
            return next;
        });
        setLastSelectedId(suiteId);
    };

    const togglePageSelection = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            const rowIds = rows.map(r => r.id);
            const allSelected = rowIds.length > 0 && rowIds.every(id => next.has(id));
            rowIds.forEach(id => {
                if (allSelected) {
                    next.delete(id);
                } else {
                    next.add(id);
                }
            });
            return next;
        });
    };

    // Optimistic Archive / Restore with 8s Undo
    const handleToggleArchive = async (suite) => {
        const targetId = suite.id;
        const previousStatus = suite.record?.status || 'Active';
        const previousSuiteStatus = suite.data?.suiteStatus || 'Active';
        const willArchive = !suite.archived;
        const nextStatus = willArchive ? 'Archived' : 'Active';

        // 1. Optimistic Update in UI
        setRecords(prev => prev.map(r => {
            if (String(r.id || r._id || r.sessionId || '') === targetId) {
                return {
                    ...r,
                    status: nextStatus,
                    suiteData: { ...(r.suiteData || {}), managedSuite: true, suiteStatus: nextStatus }
                };
            }
            return r;
        }));

        // 2. Spawn Toast with 8s Undo
        const toastMsg = willArchive ? `Suite "${suite.name}" archived.` : `Suite "${suite.name}" restored.`;
        showToast(toastMsg, async () => {
            // Revert state on Undo
            setRecords(prev => prev.map(r => {
                if (String(r.id || r._id || r.sessionId || '') === targetId) {
                    return {
                        ...r,
                        status: previousStatus,
                        suiteData: { ...(r.suiteData || {}), managedSuite: true, suiteStatus: previousSuiteStatus }
                    };
                }
                return r;
            }));
            await sessionService.update(targetId, {
                status: previousStatus,
                suiteData: { ...suite.data, managedSuite: true, suiteStatus: previousSuiteStatus }
            });
        });

        // 3. Persist API call
        try {
            await sessionService.update(targetId, {
                status: nextStatus,
                suiteData: { ...suite.data, managedSuite: true, suiteStatus: nextStatus }
            });
        } catch (err) {
            console.error('Archive failed:', err);
            // Rollback on failure
            setRecords(prev => prev.map(r => (String(r.id || r._id || r.sessionId || '') === targetId ? suite.record : r)));
            showToast(`Failed to update suite: ${err.message}`);
        }
    };

    // Bulk Archive with Undo
    const handleBulkArchive = async () => {
        const targets = normalizedSuites.filter(s => selectedIds.has(s.id));
        if (!targets.length) return;

        const count = targets.length;
        const previousRecords = [...records];

        // Optimistic archive
        setRecords(prev => prev.map(r => {
            const id = String(r.id || r._id || r.sessionId || '');
            if (selectedIds.has(id)) {
                return {
                    ...r,
                    status: 'Archived',
                    suiteData: { ...(r.suiteData || {}), managedSuite: true, suiteStatus: 'Archived' }
                };
            }
            return r;
        }));
        setSelectedIds(new Set());

        showToast(`${count} suites archived.`, async () => {
            setRecords(previousRecords);
            await Promise.allSettled(targets.map(s => sessionService.update(s.id, {
                status: s.record?.status || 'Active',
                suiteData: { ...s.data, managedSuite: true, suiteStatus: s.data?.suiteStatus || 'Active' }
            })));
        });

        try {
            await Promise.allSettled(targets.map(s => sessionService.update(s.id, {
                status: 'Archived',
                suiteData: { ...s.data, managedSuite: true, suiteStatus: 'Archived' }
            })));
        } catch (err) {
            setRecords(previousRecords);
            showToast('Bulk archive failed. Reverting changes.');
        }
    };

    // Bulk Export to JSON
    const handleBulkExport = () => {
        const targets = normalizedSuites.filter(s => selectedIds.has(s.id));
        if (!targets.length) return;
        const exportData = JSON.stringify(targets, null, 2);
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `testnexa-suites-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Exported ${targets.length} suites.`);
    };

    // Single Suite Export
    const handleExportSuite = (e, suite) => {
        e.stopPropagation();
        setActiveMenuId(null);
        const exportData = JSON.stringify(suite, null, 2);
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `suite-${suite.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Suite "${suite.name}" exported.`);
    };

    // Copy Suite ID
    const handleCopyId = (e, suiteId) => {
        e.stopPropagation();
        setActiveMenuId(null);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(suiteId);
            showToast(`Copied suite ID: ${suiteId}`);
        }
    };

    // Duplicate Suite
    const handleDuplicateSuite = async (e, suite) => {
        e.stopPropagation();
        setActiveMenuId(null);
        try {
            const nextData = {
                ...suite.data,
                managedSuite: true,
                managedSuiteVersion: 1,
                testSuiteName: `Copy of ${suite.name}`,
                testCases: suite.tests
            };
            const res = await sessionService.create({
                title: `Copy of ${suite.name}`,
                requirement: suite.description,
                context: suite.platform.toLowerCase(),
                depth: 'Standard',
                status: 'Draft',
                suiteData: nextData
            });
            if (!res?.success) throw new Error(res?.message || 'Duplication failed');
            showToast(`Suite duplicated as "Copy of ${suite.name}".`);
            await loadData();
        } catch (err) {
            showToast(`Could not duplicate suite: ${err.message}`);
        }
    };

    // Open Edit Suite modal
    const handleOpenEdit = (e, suite) => {
        e.stopPropagation();
        setActiveMenuId(null);
        setSelectedSuite(suite);
        setForm({
            name: suite.name,
            description: suite.description,
            project: suite.project,
            tags: suite.tags.join(', ')
        });
        setFormError('');
        setModal('edit');
    };

    // Save edited suite
    const handleSaveSuite = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setFormError('Suite name is required.');
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
            const nextData = {
                ...selectedSuite.data,
                managedSuite: true,
                testSuiteName: form.name.trim(),
                description: form.description.trim(),
                projectName: form.project.trim(),
                tags
            };
            const response = await sessionService.update(selectedSuite.id, {
                title: form.name.trim(),
                requirement: form.description.trim(),
                suiteData: nextData
            });
            if (!response?.success) throw new Error(response?.message || 'Suite update failed');
            setModal('');
            showToast('Suite updated successfully.');
            await loadData();
        } catch (err) {
            setFormError(err.message || 'Unable to save suite changes.');
        } finally {
            setSaving(false);
        }
    };

    // Sort header click
    const handleSort = (field) => {
        const currentField = sortParam.replace('_asc', '').replace('_desc', '');
        let nextSort = `${field}_desc`;
        if (currentField === field) {
            nextSort = sortParam.endsWith('_desc') ? `${field}_asc` : `${field}_desc`;
        }
        updateParam('sort', nextSort, true);
    };

    // Arrow keys table navigation (Up / Down to focus adjacent row, Enter to navigate)
    const handleRowKeyDown = (e, suite) => {
        if (e.key === 'Enter') {
            navigate(`/app/test-suites/${suite.id}`);
        } else if (e.key === ' ') {
            e.preventDefault();
            handleRowCheckbox(e, suite.id);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextRow = e.currentTarget.nextElementSibling;
            if (nextRow && nextRow.getAttribute('tabindex') !== null) {
                nextRow.focus();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevRow = e.currentTarget.previousElementSibling;
            if (prevRow && prevRow.getAttribute('tabindex') !== null) {
                prevRow.focus();
            }
        }
    };

    // Active filters list for removable chips
    const activeFilters = useMemo(() => {
        const chips = [];
        if (queryParam) {
            chips.push({ id: 'q', label: `Search: "${queryParam}"`, clear: () => updateParam('q', '', true) });
        }
        if (statusParam && statusParam !== 'all') {
            const labels = { active: 'Active', draft: 'Draft', archived: 'Archived', withCases: 'With test cases', withRuns: 'Suites with runs' };
            chips.push({ id: 'status', label: `Status: ${labels[statusParam] || statusParam}`, clear: () => updateParam('status', 'all', true) });
        }
        if (platformParam && platformParam !== 'all') {
            chips.push({ id: 'platform', label: `Platform: ${platformParam.toUpperCase()}`, clear: () => updateParam('platform', 'all', true) });
        }
        return chips;
    }, [queryParam, statusParam, platformParam]);

    const getAriaSort = (field) => {
        if (!sortParam.startsWith(field)) return 'none';
        return sortParam.endsWith('_asc') ? 'ascending' : 'descending';
    };

    const renderSortIndicator = (field) => {
        const isCurrent = sortParam.startsWith(field);
        return (
            <ArrowUpDown
                size={13}
                className={`ts-sort-icon ${isCurrent ? 'is-active' : ''}`}
                aria-hidden="true"
            />
        );
    };

    return (
        <main className="ts-container" role="main">
            {/* Screen Reader Live Announcements */}
            <div aria-live="polite" className="sr-only">
                {liveMessage}
            </div>

            {/* Offline Notification Banner */}
            {!isOnline && (
                <div className="ts-offline-banner" role="status">
                    <WifiOff size={16} aria-hidden="true" />
                    <span>You are currently offline. Changes will sync once your internet connection is restored.</span>
                </div>
            )}

            {/* ─── 1. Header ─── */}
            <header className="ts-header">
                <div className="ts-header-copy">
                    <h1 className="ts-h1">Test suites</h1>
                    <p className="ts-description">
                        Organize test collections, track approved cases, and inspect execution history.
                    </p>
                </div>

                <div className="ts-header-actions">
                    <Link
                        to="/app/workspace"
                        className="ts-btn-primary"
                        aria-label="Create suite in AI Workspace"
                    >
                        <Plus size={16} aria-hidden="true" />
                        <span>Create suite</span>
                    </Link>
                </div>
            </header>

            {/* ─── 2. Stats Overview Strip (Full Width, 4 Equal Columns, Clickable Filters) ─── */}
            <section className="ts-stats-strip" aria-label="Suite summary statistics">
                {/* 1. Total suites */}
                <button
                    type="button"
                    className={`ts-stat-card ${statusParam === 'all' ? 'is-active' : ''}`}
                    onClick={() => updateParam('status', 'all', true)}
                    aria-pressed={statusParam === 'all'}
                >
                    <span className="ts-stat-num">{metrics.all}</span>
                    <span className="ts-stat-label">Total suites</span>
                </button>

                {/* 2. Active suites */}
                <button
                    type="button"
                    className={`ts-stat-card ${statusParam === 'active' ? 'is-active' : ''}`}
                    onClick={() => updateParam('status', 'active', true)}
                    aria-pressed={statusParam === 'active'}
                >
                    <span className="ts-stat-num">{metrics.active}</span>
                    <span className="ts-stat-label">Active suites</span>
                </button>

                {/* 3. Test cases */}
                <button
                    type="button"
                    className={`ts-stat-card ${statusParam === 'withCases' ? 'is-active' : ''}`}
                    onClick={() => updateParam('status', 'withCases', true)}
                    aria-pressed={statusParam === 'withCases'}
                >
                    <span className="ts-stat-num">{metrics.cases}</span>
                    <span className="ts-stat-label">Test cases</span>
                </button>

                {/* 4. Suites with runs */}
                <button
                    type="button"
                    className={`ts-stat-card ${statusParam === 'withRuns' ? 'is-active' : ''}`}
                    onClick={() => updateParam('status', 'withRuns', true)}
                    aria-pressed={statusParam === 'withRuns'}
                >
                    <span className="ts-stat-num">{metrics.withRuns}</span>
                    <span className="ts-stat-label">Suites with runs</span>
                </button>
            </section>

            {/* ─── 3. Filter & Search Toolbar ─── */}
            <div className="ts-toolbar">
                <div className="ts-toolbar-search-wrap">
                    <label className="ts-search-box">
                        <Search size={15} className="ts-search-icon" aria-hidden="true" />
                        <input
                            ref={searchInputRef}
                            type="search"
                            aria-label="Search suites"
                            placeholder="Search by name, ID, description, project or tags... (Press / to focus)"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                        {searchInput && (
                            <button
                                type="button"
                                className="ts-search-clear-btn"
                                onClick={() => setSearchInput('')}
                                aria-label="Clear search text"
                            >
                                <X size={14} aria-hidden="true" />
                            </button>
                        )}
                    </label>
                </div>

                <div className="ts-toolbar-controls">
                    {/* Status filter dropdown */}
                    <div className="ts-select-wrap">
                        <select
                            aria-label="Filter by status"
                            value={statusParam}
                            onChange={(e) => updateParam('status', e.target.value, true)}
                        >
                            <option value="all">All statuses ({metrics.all})</option>
                            <option value="active">Active ({metrics.active})</option>
                            <option value="draft">Draft ({metrics.draft})</option>
                            <option value="archived">Archived ({metrics.archived})</option>
                            <option value="withCases">With cases</option>
                            <option value="withRuns">With runs</option>
                        </select>
                    </div>

                    {/* Platform filter dropdown */}
                    <div className="ts-select-wrap">
                        <select
                            aria-label="Filter by platform"
                            value={platformParam}
                            onChange={(e) => updateParam('platform', e.target.value, true)}
                        >
                            <option value="all">All platforms</option>
                            <option value="web">Web</option>
                            <option value="api">API</option>
                            <option value="mobile">Mobile</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Removable Active Filter Chips */}
            {activeFilters.length > 0 && (
                <div className="ts-filter-chips-row">
                    <span className="ts-filter-chips-label">Active filters:</span>
                    {activeFilters.map(chip => (
                        <button
                            key={chip.id}
                            type="button"
                            className="ts-chip"
                            onClick={chip.clear}
                            aria-label={`Remove filter ${chip.label}`}
                        >
                            <span>{chip.label}</span>
                            <X size={12} aria-hidden="true" />
                        </button>
                    ))}
                    <button
                        type="button"
                        className="ts-chip-clear-all"
                        onClick={handleClearAllFilters}
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Error Banner with Retry */}
            {error && (
                <div className="ts-error-banner" role="alert">
                    <div className="ts-error-content">
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        className="ts-btn-retry"
                        onClick={loadData}
                    >
                        <RefreshCw size={14} aria-hidden="true" />
                        <span>Retry</span>
                    </button>
                </div>
            )}

            {/* ─── 4. Table / Content States ─── */}
            {loading ? (
                /* Loading Skeleton (6 rows matching exact column widths in strict B&W) */
                <div className="ts-table-container">
                    <table className="ts-table" aria-label="Loading test suites">
                        <thead>
                            <tr>
                                <th className="ts-col-check"><span className="ts-skeleton ts-sk-check" /></th>
                                <th>Suite</th>
                                <th className="ts-col-platform">Platform</th>
                                <th>Cases</th>
                                <th className="ts-col-mix">Execution mix</th>
                                <th>Last execution</th>
                                <th>Status</th>
                                <th className="ts-col-updated">Updated</th>
                                <th className="ts-col-actions"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...Array(6)].map((_, i) => (
                                <tr key={i} className="ts-skeleton-row">
                                    <td><span className="ts-skeleton ts-sk-check" /></td>
                                    <td>
                                        <div className="ts-sk-col">
                                            <span className="ts-skeleton ts-sk-title" />
                                            <span className="ts-skeleton ts-sk-desc" />
                                        </div>
                                    </td>
                                    <td className="ts-col-platform"><span className="ts-skeleton ts-sk-badge" /></td>
                                    <td><span className="ts-skeleton ts-sk-text" /></td>
                                    <td className="ts-col-mix"><span className="ts-skeleton ts-sk-bar" /></td>
                                    <td><span className="ts-skeleton ts-sk-text" /></td>
                                    <td><span className="ts-skeleton ts-sk-badge" /></td>
                                    <td className="ts-col-updated"><span className="ts-skeleton ts-sk-text" /></td>
                                    <td><span className="ts-skeleton ts-sk-icon" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : metrics.all === 0 ? (
                /* Empty State (Zero suites in system) */
                <div className="ts-empty-state">
                    <div className="ts-empty-icon-wrap">
                        <Layers size={28} aria-hidden="true" />
                    </div>
                    <h2 className="ts-empty-title">No test suites yet</h2>
                    <p className="ts-empty-sub">
                        Create your first test suite to organize assertions, monitor approval status, and trace execution outcomes.
                    </p>
                    <div className="ts-empty-actions">
                        <Link to="/app/workspace" className="ts-btn-primary">
                            <Plus size={16} aria-hidden="true" />
                            <span>Create suite</span>
                        </Link>
                        <a
                            href="https://testnexa.ai/docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ts-btn-ghost"
                        >
                            How it works
                        </a>
                    </div>
                </div>
            ) : rows.length === 0 ? (
                /* No Results State (Search/filters return 0 suites) */
                <div className="ts-empty-state">
                    <div className="ts-empty-icon-wrap">
                        <Search size={26} aria-hidden="true" />
                    </div>
                    <h2 className="ts-empty-title">No suites match your criteria</h2>
                    <p className="ts-empty-sub">
                        No test suites match the selected filters or search terms. Try clearing your filters.
                    </p>
                    <button
                        type="button"
                        className="ts-btn-secondary"
                        onClick={handleClearAllFilters}
                    >
                        Clear filters
                    </button>
                </div>
            ) : (
                /* Real Data Table */
                <>
                    <div className="ts-table-container">
                        <table className="ts-table" aria-label="Test Suites list">
                            <thead>
                                <tr>
                                    {/* Selection Checkbox */}
                                    <th scope="col" className="ts-col-check">
                                        <input
                                            ref={headerCheckboxRef}
                                            type="checkbox"
                                            aria-label="Select all suites on page"
                                            onChange={togglePageSelection}
                                        />
                                    </th>

                                    {/* Suite Name + Description */}
                                    <th scope="col" aria-sort={getAriaSort('name')}>
                                        <button
                                            type="button"
                                            className="ts-th-sort"
                                            onClick={() => handleSort('name')}
                                        >
                                            <span>Suite</span>
                                            {renderSortIndicator('name')}
                                        </button>
                                    </th>

                                    {/* Platform Tag */}
                                    <th scope="col" className="ts-col-platform">
                                        Platform
                                    </th>

                                    {/* Cases */}
                                    <th scope="col" aria-sort={getAriaSort('cases')}>
                                        <button
                                            type="button"
                                            className="ts-th-sort"
                                            onClick={() => handleSort('cases')}
                                        >
                                            <span>Cases</span>
                                            {renderSortIndicator('cases')}
                                        </button>
                                    </th>

                                    {/* Execution Mix */}
                                    <th scope="col" className="ts-col-mix">
                                        Execution mix
                                    </th>

                                    {/* Last execution */}
                                    <th scope="col" aria-sort={getAriaSort('last_run')}>
                                        <button
                                            type="button"
                                            className="ts-th-sort"
                                            onClick={() => handleSort('last_run')}
                                        >
                                            <span>Last execution</span>
                                            {renderSortIndicator('last_run')}
                                        </button>
                                    </th>

                                    {/* Status */}
                                    <th scope="col" aria-sort={getAriaSort('status')}>
                                        <button
                                            type="button"
                                            className="ts-th-sort"
                                            onClick={() => handleSort('status')}
                                        >
                                            <span>Status</span>
                                            {renderSortIndicator('status')}
                                        </button>
                                    </th>

                                    {/* Updated */}
                                    <th scope="col" className="ts-col-updated" aria-sort={getAriaSort('updated')}>
                                        <button
                                            type="button"
                                            className="ts-th-sort"
                                            onClick={() => handleSort('updated')}
                                        >
                                            <span>Updated</span>
                                            {renderSortIndicator('updated')}
                                        </button>
                                    </th>

                                    {/* Row Menu Actions */}
                                    <th scope="col" className="ts-col-actions">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>

                            <tbody ref={tableBodyRef}>
                                {rows.map(suite => {
                                    const isSelected = selectedIds.has(suite.id);
                                    const mixPercent = suite.totalCases > 0
                                        ? Math.round((suite.automatedCases / suite.totalCases) * 100)
                                        : 0;

                                    return (
                                        <tr
                                            key={suite.id}
                                            className={`ts-row ${isSelected ? 'is-selected' : ''}`}
                                            tabIndex={0}
                                            onClick={() => navigate(`/app/test-suites/${encodeURIComponent(suite.id)}`)}
                                            onKeyDown={(e) => handleRowKeyDown(e, suite)}
                                            role="row"
                                            aria-selected={isSelected}
                                        >
                                            {/* 1. Checkbox */}
                                            <td className="ts-col-check" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select suite ${suite.name}`}
                                                    checked={isSelected}
                                                    onChange={(e) => handleRowCheckbox(e, suite.id)}
                                                />
                                            </td>

                                            {/* 2. Suite Name + Description */}
                                            <td>
                                                <div className="ts-cell-suite">
                                                    <Link
                                                        to={`/app/test-suites/${encodeURIComponent(suite.id)}`}
                                                        className="ts-suite-title"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {suite.name}
                                                    </Link>

                                                    {suite.description && (
                                                        <p
                                                            className="ts-suite-desc"
                                                            title={suite.description}
                                                        >
                                                            {suite.description}
                                                        </p>
                                                    )}

                                                    {/* Responsive meta displayed under name on narrow viewports */}
                                                    <div className="ts-cell-mobile-meta">
                                                        <span className="ts-platform-tag">{suite.platform}</span>
                                                        <span>·</span>
                                                        <span>{suite.approvedCases} of {suite.totalCases} approved</span>
                                                        {suite.lastRun && (
                                                            <>
                                                                <span>·</span>
                                                                <span>Last: {new Date(suite.lastRun.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 3. Platform */}
                                            <td className="ts-col-platform">
                                                <span className="ts-platform-tag">
                                                    {suite.platform}
                                                </span>
                                            </td>

                                            {/* 4. Cases */}
                                            <td>
                                                <div className="ts-cases-cell">
                                                    <span className="ts-cases-approved-text">
                                                        {suite.approvedCases} of {suite.totalCases} approved
                                                    </span>
                                                </div>
                                            </td>

                                            {/* 5. Execution Mix Split Bar */}
                                            <td className="ts-col-mix">
                                                <div
                                                    className="ts-mix-wrap"
                                                    title={`${suite.manualCases} manual, ${suite.automatedCases} automated (${mixPercent}% automated)`}
                                                >
                                                    <div className="ts-mix-bar">
                                                        <div
                                                            className="ts-mix-automated"
                                                            style={{ width: `${mixPercent}%` }}
                                                        />
                                                    </div>
                                                    <span className="ts-mix-label">
                                                        {suite.automatedCases}A / {suite.manualCases}M
                                                    </span>
                                                </div>
                                            </td>

                                            {/* 6. Last Execution */}
                                            <td>
                                                {suite.lastRun ? (
                                                    <div className="ts-last-run-wrap">
                                                        <span className="ts-last-run-date">
                                                            {new Date(suite.lastRun.date).toLocaleDateString(undefined, {
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </span>
                                                        <span
                                                            className={`ts-outcome-pill is-${suite.lastRun.status}`}
                                                        >
                                                            {suite.lastRun.status === 'passed' ? 'Passed' : suite.lastRun.status === 'failed' ? 'Failed' : suite.lastRun.status}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="ts-no-run-wrap" onClick={(e) => e.stopPropagation()}>
                                                        <span className="ts-no-runs-text">No runs yet</span>
                                                        <button
                                                            type="button"
                                                            className="ts-btn-mini-run"
                                                            title={`Run tests for ${suite.name}`}
                                                            onClick={() => navigate(`/app/runs?suite=${encodeURIComponent(suite.id)}`)}
                                                        >
                                                            <Play size={10} aria-hidden="true" />
                                                            <span>Run</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>

                                            {/* 7. Status Pill */}
                                            <td>
                                                <span className={`ts-status-pill is-${suite.status.toLowerCase()}`}>
                                                    {suite.status === 'Active' && <span className="ts-status-dot" />}
                                                    {suite.status === 'Draft' && <span className="ts-status-ring" />}
                                                    <span>{suite.status}</span>
                                                </span>
                                            </td>

                                            {/* 8. Updated */}
                                            <td className="ts-col-updated">
                                                <span className="ts-updated-text">
                                                    {suite.updatedAt
                                                        ? new Date(suite.updatedAt).toLocaleDateString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })
                                                        : '—'}
                                                </span>
                                            </td>

                                            {/* 9. Row Menu (⋯) */}
                                            <td className="ts-col-actions" onClick={(e) => e.stopPropagation()}>
                                                <div className="ts-row-menu-wrap">
                                                    <button
                                                        type="button"
                                                        className="ts-row-menu-trigger"
                                                        aria-label={`Actions for ${suite.name}`}
                                                        aria-haspopup="menu"
                                                        aria-expanded={activeMenuId === suite.id}
                                                        onClick={() => setActiveMenuId(prev => prev === suite.id ? null : suite.id)}
                                                    >
                                                        <MoreHorizontal size={16} aria-hidden="true" />
                                                    </button>

                                                    {activeMenuId === suite.id && (
                                                        <div className="ts-dropdown-menu" role="menu">
                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                className="ts-dropdown-item"
                                                                onClick={() => {
                                                                    setActiveMenuId(null);
                                                                    navigate(`/app/test-suites/${encodeURIComponent(suite.id)}`);
                                                                }}
                                                            >
                                                                <ExternalLink size={14} aria-hidden="true" />
                                                                <span>Open</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                className="ts-dropdown-item"
                                                                onClick={(e) => handleOpenEdit(e, suite)}
                                                            >
                                                                <Edit2 size={14} aria-hidden="true" />
                                                                <span>Edit</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                className="ts-dropdown-item"
                                                                onClick={(e) => handleDuplicateSuite(e, suite)}
                                                            >
                                                                <Copy size={14} aria-hidden="true" />
                                                                <span>Duplicate</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                className="ts-dropdown-item"
                                                                onClick={(e) => handleCopyId(e, suite.id)}
                                                            >
                                                                <Copy size={14} aria-hidden="true" />
                                                                <span>Copy suite ID</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                className="ts-dropdown-item"
                                                                onClick={(e) => handleExportSuite(e, suite)}
                                                            >
                                                                <Download size={14} aria-hidden="true" />
                                                                <span>Export</span>
                                                            </button>

                                                            <div className="ts-dropdown-divider" />

                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                className="ts-dropdown-item ts-dropdown-item-danger"
                                                                onClick={() => {
                                                                    setActiveMenuId(null);
                                                                    handleToggleArchive(suite);
                                                                }}
                                                            >
                                                                <Archive size={14} aria-hidden="true" />
                                                                <span>{suite.archived ? 'Restore' : 'Archive'}</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ─── 5. Pager (Hidden when 1 page, otherwise '1-25 of N') ─── */}
                    {pagination.totalPages > 1 && (
                        <div className="ts-pagination">
                            <span className="ts-pagination-info">
                                {pagination.startIndex}-{pagination.endIndex} of {pagination.totalCount} suites
                            </span>

                            <div className="ts-pagination-controls">
                                <label className="ts-page-size-wrap">
                                    <span className="ts-page-size-label">Rows per page:</span>
                                    <select
                                        aria-label="Rows per page"
                                        value={pagination.pageSize}
                                        onChange={(e) => {
                                            updateParam('pageSize', e.target.value);
                                            updateParam('page', 1);
                                        }}
                                    >
                                        <option value="10">10</option>
                                        <option value="25">25</option>
                                        <option value="50">50</option>
                                    </select>
                                </label>

                                <div className="ts-pager-buttons">
                                    <button
                                        type="button"
                                        className="ts-pager-btn"
                                        aria-label="Previous page"
                                        disabled={pagination.page <= 1}
                                        onClick={() => updateParam('page', pagination.page - 1)}
                                    >
                                        <ChevronLeft size={16} aria-hidden="true" />
                                    </button>
                                    <span className="ts-pager-current">
                                        Page {pagination.page} of {pagination.totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        className="ts-pager-btn"
                                        aria-label="Next page"
                                        disabled={pagination.page >= pagination.totalPages}
                                        onClick={() => updateParam('page', pagination.page + 1)}
                                    >
                                        <ChevronRight size={16} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ─── 6. Sticky Bulk Bar ─── */}
            {selectedIds.size > 0 && (
                <aside className="ts-bulk-bar" role="toolbar" aria-label="Bulk actions">
                    <span className="ts-bulk-label">
                        <strong>{selectedIds.size}</strong> selected
                    </span>

                    <div className="ts-bulk-actions">
                        <button
                            type="button"
                            className="ts-btn-bulk-secondary"
                            onClick={handleBulkArchive}
                        >
                            <Archive size={14} aria-hidden="true" />
                            <span>Archive</span>
                        </button>

                        <button
                            type="button"
                            className="ts-btn-bulk-secondary"
                            onClick={handleBulkExport}
                        >
                            <Download size={14} aria-hidden="true" />
                            <span>Export</span>
                        </button>

                        <button
                            type="button"
                            className="ts-btn-bulk-clear"
                            onClick={() => setSelectedIds(new Set())}
                            aria-label="Clear selection"
                        >
                            Clear
                        </button>
                    </div>
                </aside>
            )}

            {/* ─── 7. Toast with 8s Undo ─── */}
            {toast && (
                <div className="ts-toast-container" role="status" aria-live="assertive">
                    <div className="ts-toast">
                        <span className="ts-toast-message">{toast.message}</span>
                        {toast.onUndo && (
                            <button
                                type="button"
                                className="ts-toast-undo-btn"
                                onClick={handleToastUndo}
                            >
                                <RotateCcw size={13} aria-hidden="true" />
                                <span>Undo</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ─── 8. Edit Metadata Modal ─── */}
            {modal === 'edit' && selectedSuite && createPortal(
                <div
                    className="ts-modal-backdrop"
                    role="presentation"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget && !saving) setModal('');
                    }}
                >
                    <section
                        className="ts-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ts-modal-title"
                    >
                        <header className="ts-modal-header">
                            <h2 id="ts-modal-title" className="ts-modal-title">
                                Edit Suite Details
                            </h2>
                            <button
                                type="button"
                                className="ts-modal-close-btn"
                                aria-label="Close dialog"
                                onClick={() => setModal('')}
                                disabled={saving}
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </header>

                        <form onSubmit={handleSaveSuite} className="ts-modal-form">
                            {formError && (
                                <div className="ts-modal-error" role="alert">
                                    {formError}
                                </div>
                            )}

                            <label className="ts-form-field">
                                <span className="ts-form-label">Suite name *</span>
                                <input
                                    autoFocus
                                    maxLength={140}
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                    className="ts-form-input"
                                />
                            </label>

                            <label className="ts-form-field">
                                <span className="ts-form-label">Description</span>
                                <textarea
                                    rows={3}
                                    maxLength={2000}
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="ts-form-textarea"
                                />
                            </label>

                            <label className="ts-form-field">
                                <span className="ts-form-label">Project label</span>
                                <input
                                    maxLength={120}
                                    value={form.project}
                                    onChange={(e) => setForm({ ...form, project: e.target.value })}
                                    placeholder="e.g. AuthService, Storefront"
                                    className="ts-form-input"
                                />
                            </label>

                            <label className="ts-form-field">
                                <span className="ts-form-label">Tags</span>
                                <input
                                    maxLength={300}
                                    value={form.tags}
                                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                                    placeholder="Comma-separated (e.g. security, jwt, checkout)"
                                    className="ts-form-input"
                                />
                            </label>

                            <footer className="ts-modal-footer">
                                <button
                                    type="button"
                                    className="ts-btn-secondary"
                                    disabled={saving}
                                    onClick={() => setModal('')}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="ts-btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? 'Saving…' : 'Save changes'}
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>,
                document.body
            )}
        </main>
    );
}
