import React, { useState, useEffect } from 'react';
import {
    Search, Download, Filter, Calendar, Clock, User, Shield,
    CheckCircle2, XCircle, AlertTriangle, Layers, ArrowRight,
    ChevronLeft, ChevronRight, X, ExternalLink, RefreshCw, FileText
} from 'lucide-react';
import { organizationService } from '../../services/organizationService';

const ACTION_CATEGORIES = [
    { id: 'all', label: 'All Categories' },
    { id: 'auth', label: 'Authentication', prefix: 'auth|user.login|user.logout' },
    { id: 'organization', label: 'Organization', prefix: 'organization|member' },
    { id: 'workspace', label: 'Workspaces', prefix: 'workspace' },
    { id: 'suite', label: 'Test Suites & Cases', prefix: 'suite|testcase' },
    { id: 'execution', label: 'Executions & Runs', prefix: 'execution|test_run' },
    { id: 'ai', label: 'AI & Intelligence', prefix: 'ai|readiness' },
    { id: 'integration', label: 'Integrations & CI/CD', prefix: 'integration' },
    { id: 'audit', label: 'Audit Actions', prefix: 'audit' }
];

const OUTCOME_OPTIONS = [
    { id: 'all', label: 'All Outcomes' },
    { id: 'Success', label: 'Success' },
    { id: 'Failure', label: 'Failure' },
    { id: 'Denied', label: 'Denied' }
];

const SOURCE_OPTIONS = [
    { id: 'all', label: 'All Sources' },
    { id: 'Web App', label: 'Web App' },
    { id: 'API', label: 'API' },
    { id: 'CI/CD', label: 'CI/CD' },
    { id: 'Background Worker', label: 'Background Worker' }
];

const DATE_PRESETS = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' }
];

export const AuditLogView = ({ activeOrg, workspaces = [] }) => {
    const orgId = activeOrg?.id;

    const [events, setEvents] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [outcomeFilter, setOutcomeFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [workspaceFilter, setWorkspaceFilter] = useState('all');
    const [datePreset, setDatePreset] = useState('all');

    // Selected event for detail drawer
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [drawerLoading, setDrawerLoading] = useState(false);

    // Search debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPagination(prev => ({ ...prev, page: 1 }));
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch logs on filter/page change
    useEffect(() => {
        if (!orgId) return;
        fetchAuditLogs();
    }, [orgId, debouncedSearch, categoryFilter, outcomeFilter, sourceFilter, workspaceFilter, datePreset, pagination.page]);

    const calculateDateRange = (preset) => {
        if (preset === 'today') {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            return { startDate: start };
        }
        if (preset === '7d') {
            const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            return { startDate: start };
        }
        if (preset === '30d') {
            const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            return { startDate: start };
        }
        return {};
    };

    const fetchAuditLogs = async () => {
        if (!orgId) return;
        setIsLoading(true);
        setErrorMessage('');
        try {
            const dateRange = calculateDateRange(datePreset);
            const selectedCat = ACTION_CATEGORIES.find(c => c.id === categoryFilter);

            const filters = {
                page: pagination.page,
                limit: pagination.limit,
                search: debouncedSearch || undefined,
                action: selectedCat && selectedCat.id !== 'all' ? selectedCat.id : undefined,
                outcome: outcomeFilter !== 'all' ? outcomeFilter : undefined,
                source: sourceFilter !== 'all' ? sourceFilter : undefined,
                workspaceId: workspaceFilter !== 'all' ? workspaceFilter : undefined,
                ...dateRange
            };

            const res = await organizationService.getAuditLogs(orgId, filters);
            setEvents(res.data || []);
            if (res.pagination) {
                setPagination(prev => ({
                    ...prev,
                    total: res.pagination.total || 0,
                    totalPages: res.pagination.totalPages || 1
                }));
            }
        } catch (err) {
            setErrorMessage(err.message || 'Failed to fetch audit logs');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportCsv = async () => {
        if (!orgId || isExporting) return;
        setIsExporting(true);
        try {
            const dateRange = calculateDateRange(datePreset);
            const selectedCat = ACTION_CATEGORIES.find(c => c.id === categoryFilter);

            const filters = {
                search: debouncedSearch || undefined,
                action: selectedCat && selectedCat.id !== 'all' ? selectedCat.id : undefined,
                outcome: outcomeFilter !== 'all' ? outcomeFilter : undefined,
                source: sourceFilter !== 'all' ? sourceFilter : undefined,
                workspaceId: workspaceFilter !== 'all' ? workspaceFilter : undefined,
                ...dateRange
            };

            const blob = await organizationService.exportAuditLogs(orgId, filters);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit-log-${orgId}-${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert(err.message || 'Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const handleOpenDetail = async (evt) => {
        setSelectedEvent(evt);
        setDrawerLoading(true);
        try {
            const res = await organizationService.getAuditLogDetails(orgId, evt.id);
            if (res.data) {
                setSelectedEvent(res.data);
            }
        } catch (e) {
            // keep existing row event on error
        } finally {
            setDrawerLoading(false);
        }
    };

    const formatTimestamp = (iso) => {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) + ' ' + d.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    const getOutcomeBadge = (outcome) => {
        switch ((outcome || '').toLowerCase()) {
            case 'success':
                return (
                    <span className="audit-badge audit-badge--success">
                        <CheckCircle2 size={12} /> Success
                    </span>
                );
            case 'failure':
                return (
                    <span className="audit-badge audit-badge--failure">
                        <XCircle size={12} /> Failure
                    </span>
                );
            case 'denied':
                return (
                    <span className="audit-badge audit-badge--denied">
                        <AlertTriangle size={12} /> Denied
                    </span>
                );
            default:
                return <span className="audit-badge">{outcome || 'Unknown'}</span>;
        }
    };

    const getActionCategory = (action = '') => {
        const act = action.toLowerCase();
        if (act.startsWith('auth') || act.startsWith('user.')) return 'Auth';
        if (act.startsWith('org') || act.startsWith('member.')) return 'Org';
        if (act.startsWith('workspace')) return 'Workspace';
        if (act.startsWith('suite') || act.startsWith('testcase')) return 'QA';
        if (act.startsWith('execution') || act.startsWith('test_run')) return 'Execution';
        if (act.startsWith('ai') || act.startsWith('readiness')) return 'AI';
        if (act.startsWith('integration')) return 'CI/CD';
        return 'System';
    };

    return (
        <div className="audit-container">
            {/* Header */}
            <div className="audit-header">
                <div>
                    <h3 className="audit-title">Audit Logs</h3>
                    <p className="audit-subtitle">
                        Comprehensive, immutable audit trail of user actions, authorization decisions, and system operations.
                    </p>
                </div>
                <div className="audit-header__actions">
                    <button
                        className="org-btn org-btn--secondary"
                        onClick={fetchAuditLogs}
                        title="Refresh audit events"
                        disabled={isLoading}
                    >
                        <RefreshCw size={14} className={isLoading ? 'audit-spin' : ''} /> Refresh
                    </button>
                    <button
                        className="org-btn org-btn--primary"
                        onClick={handleExportCsv}
                        disabled={isExporting || events.length === 0}
                    >
                        <Download size={14} /> {isExporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="audit-toolbar">
                <div className="audit-search">
                    <Search size={15} className="audit-search__icon" />
                    <input
                        type="text"
                        placeholder="Search by actor, action, resource, or event ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="audit-search__input"
                    />
                    {searchQuery && (
                        <button className="audit-search__clear" onClick={() => setSearchQuery('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="audit-filter-row">
                    {/* Category Filter */}
                    <div className="audit-filter-item">
                        <label>Category</label>
                        <select
                            value={categoryFilter}
                            onChange={(e) => {
                                setCategoryFilter(e.target.value);
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        >
                            {ACTION_CATEGORIES.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Outcome Filter */}
                    <div className="audit-filter-item">
                        <label>Outcome</label>
                        <select
                            value={outcomeFilter}
                            onChange={(e) => {
                                setOutcomeFilter(e.target.value);
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        >
                            {OUTCOME_OPTIONS.map(o => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Source Filter */}
                    <div className="audit-filter-item">
                        <label>Source</label>
                        <select
                            value={sourceFilter}
                            onChange={(e) => {
                                setSourceFilter(e.target.value);
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        >
                            {SOURCE_OPTIONS.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Workspace Filter */}
                    <div className="audit-filter-item">
                        <label>Workspace</label>
                        <select
                            value={workspaceFilter}
                            onChange={(e) => {
                                setWorkspaceFilter(e.target.value);
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        >
                            <option value="all">All Workspaces</option>
                            {workspaces.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Preset */}
                    <div className="audit-filter-item">
                        <label>Date Range</label>
                        <select
                            value={datePreset}
                            onChange={(e) => {
                                setDatePreset(e.target.value);
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        >
                            {DATE_PRESETS.map(d => (
                                <option key={d.id} value={d.id}>{d.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
                <div className="org-banner org-banner--error" style={{ marginBottom: '1.25rem' }}>
                    <AlertTriangle size={16} /> {errorMessage}
                </div>
            )}

            {/* Main Events Table */}
            <div className="audit-table-card">
                {isLoading ? (
                    <div className="audit-loading">
                        <RefreshCw size={24} className="audit-spin" />
                        <span>Loading audit records...</span>
                    </div>
                ) : events.length === 0 ? (
                    <div className="cicd-empty" style={{ padding: '4rem 2rem' }}>
                        <Clock size={44} className="cicd-empty__icon" style={{ color: '#8BAF9A', opacity: 0.7 }} />
                        <h4 className="cicd-empty__title">No audit events match your criteria</h4>
                        <p className="cicd-empty__desc">
                            Try adjusting your search query, outcome filter, or date range.
                        </p>
                    </div>
                ) : (
                    <div className="audit-table-wrapper">
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th>Timestamp (UTC)</th>
                                    <th>Actor</th>
                                    <th>Action</th>
                                    <th>Resource</th>
                                    <th>Scope / Context</th>
                                    <th>Outcome</th>
                                    <th>Source</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((evt) => {
                                    const category = getActionCategory(evt.action);
                                    const matchedWorkspace = workspaces.find(w => w.id === evt.workspaceId);
                                    return (
                                        <tr
                                            key={evt.id}
                                            className="audit-row"
                                            onClick={() => handleOpenDetail(evt)}
                                        >
                                            <td className="audit-col--time">
                                                <div className="audit-time-main">{formatTimestamp(evt.timestamp)}</div>
                                                <div className="audit-time-sub">{evt.id}</div>
                                            </td>
                                            <td className="audit-col--actor">
                                                <div className="audit-actor-name">
                                                    {evt.actorDisplayName || 'Unknown'}
                                                </div>
                                                <div className="audit-actor-sub">
                                                    {evt.actorEmail ? evt.actorEmail : (evt.actorType || 'User')}
                                                </div>
                                            </td>
                                            <td className="audit-col--action">
                                                <span className={`audit-act-pill audit-act-pill--${category.toLowerCase()}`}>
                                                    {category}
                                                </span>
                                                <span className="audit-action-code">{evt.action}</span>
                                            </td>
                                            <td className="audit-col--resource">
                                                <div className="audit-resource-type">
                                                    {evt.resourceType}
                                                </div>
                                                <div className="audit-resource-title" title={evt.resourceDisplayName || evt.resourceId || ''}>
                                                    {evt.resourceDisplayName || evt.resourceId || '-'}
                                                </div>
                                            </td>
                                            <td className="audit-col--scope">
                                                {matchedWorkspace ? (
                                                    <span className="audit-scope-tag">
                                                        <Layers size={11} /> {matchedWorkspace.name}
                                                    </span>
                                                ) : evt.workspaceId ? (
                                                    <span className="audit-scope-code">{evt.workspaceId.slice(0, 8)}...</span>
                                                ) : (
                                                    <span className="audit-scope-global">Org-wide</span>
                                                )}
                                            </td>
                                            <td className="audit-col--outcome">
                                                {getOutcomeBadge(evt.outcome)}
                                            </td>
                                            <td className="audit-col--source">
                                                <span className="audit-source-tag">{evt.source || 'Web App'}</span>
                                            </td>
                                            <td className="audit-col--action-btn">
                                                <button
                                                    className="audit-view-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenDetail(evt);
                                                    }}
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination.total > 0 && (
                    <div className="audit-pagination">
                        <div className="audit-pagination__info">
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                            <strong>{pagination.total}</strong> events
                        </div>
                        <div className="audit-pagination__nav">
                            <button
                                className="audit-page-btn"
                                disabled={pagination.page <= 1 || isLoading}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            >
                                <ChevronLeft size={14} /> Previous
                            </button>
                            <span className="audit-page-indicator">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                className="audit-page-btn"
                                disabled={pagination.page >= pagination.totalPages || isLoading}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Drawer (Slide-over) */}
            {selectedEvent && (
                <div className="audit-drawer-backdrop" onClick={() => setSelectedEvent(null)}>
                    <div className="audit-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="audit-drawer__header">
                            <div>
                                <span className="audit-drawer__pre">Event Details</span>
                                <h3 className="audit-drawer__title">{selectedEvent.action}</h3>
                            </div>
                            <button
                                className="audit-drawer__close"
                                onClick={() => setSelectedEvent(null)}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="audit-drawer__body">
                            {/* Summary Grid */}
                            <div className="audit-drawer__summary">
                                <div className="audit-drawer__field">
                                    <label>Event ID</label>
                                    <code>{selectedEvent.id}</code>
                                </div>
                                <div className="audit-drawer__field">
                                    <label>Timestamp (UTC)</label>
                                    <span>{new Date(selectedEvent.timestamp).toUTCString()}</span>
                                </div>
                                <div className="audit-drawer__field">
                                    <label>Outcome</label>
                                    <div>{getOutcomeBadge(selectedEvent.outcome)}</div>
                                </div>
                                <div className="audit-drawer__field">
                                    <label>Source</label>
                                    <span>{selectedEvent.source || 'Web App'}</span>
                                </div>
                            </div>

                            {/* Actor Details */}
                            <div className="audit-drawer__section">
                                <h4>Actor Information</h4>
                                <div className="audit-drawer__grid">
                                    <div>
                                        <label>Actor Name</label>
                                        <p>{selectedEvent.actorDisplayName || 'System'}</p>
                                    </div>
                                    <div>
                                        <label>Email</label>
                                        <p>{selectedEvent.actorEmail || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label>Actor Type</label>
                                        <p>{selectedEvent.actorType || 'User'}</p>
                                    </div>
                                    <div>
                                        <label>Actor ID</label>
                                        <code>{selectedEvent.actorId}</code>
                                    </div>
                                </div>
                            </div>

                            {/* Resource Details */}
                            <div className="audit-drawer__section">
                                <h4>Resource Context</h4>
                                <div className="audit-drawer__grid">
                                    <div>
                                        <label>Resource Type</label>
                                        <p style={{ textTransform: 'capitalize' }}>{selectedEvent.resourceType}</p>
                                    </div>
                                    <div>
                                        <label>Resource Name</label>
                                        <p>{selectedEvent.resourceDisplayName || '-'}</p>
                                    </div>
                                    <div>
                                        <label>Resource ID</label>
                                        <code>{selectedEvent.resourceId || '-'}</code>
                                    </div>
                                    <div>
                                        <label>Workspace ID</label>
                                        <code>{selectedEvent.workspaceId || 'Org-wide'}</code>
                                    </div>
                                    <div>
                                        <label>Correlation ID</label>
                                        <code>{selectedEvent.correlationId || '-'}</code>
                                    </div>
                                </div>
                            </div>

                            {/* Before & After Field Diff Table */}
                            {selectedEvent.changes && Object.keys(selectedEvent.changes).length > 0 && (
                                <div className="audit-drawer__section">
                                    <h4>Field Changes (Before vs. After)</h4>
                                    <table className="audit-diff-table">
                                        <thead>
                                            <tr>
                                                <th>Field</th>
                                                <th>Before</th>
                                                <th>After</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(selectedEvent.changes).map(([field, diff]) => (
                                                <tr key={field}>
                                                    <td className="audit-diff-key"><code>{field}</code></td>
                                                    <td className="audit-diff-val audit-diff-val--before">
                                                        {typeof diff?.before === 'object' 
                                                            ? JSON.stringify(diff.before) 
                                                            : String(diff?.before ?? 'null')}
                                                    </td>
                                                    <td className="audit-diff-val audit-diff-val--after">
                                                        {typeof diff?.after === 'object' 
                                                            ? JSON.stringify(diff.after) 
                                                            : String(diff?.after ?? 'null')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Metadata Inspector */}
                            {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                                <div className="audit-drawer__section">
                                    <h4>Event Metadata</h4>
                                    <pre className="audit-json-box">
                                        {JSON.stringify(selectedEvent.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="audit-drawer__footer">
                            <button
                                className="org-btn org-btn--secondary"
                                onClick={() => setSelectedEvent(null)}
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

export default AuditLogView;

