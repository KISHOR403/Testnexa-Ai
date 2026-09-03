import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Search, Plus, Sparkles, Filter, Calendar, Clock,
    Layers, Trash2, Archive, Edit3, ArrowRight, Check,
    X, AlertCircle, RefreshCw, ChevronDown, CheckCircle2, Shield
} from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import { useHistory } from '../../hooks/useHistory';
import '../../styles/app/HistoryPage.css';

const formatTimeAgo = (dateInput) => {
    if (!dateInput) return 'Recently';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Recently';
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const HistoryPage = () => {
    const navigate = useNavigate();
    const { loadHistory: refreshSidebarHistory } = useHistory();

    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters & Sorting
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('active'); // 'active' (Draft + Generated), 'all', 'Draft', 'Generated', 'Archived'
    const [contextFilter, setContextFilter] = useState('all');
    const [sortBy, setSortBy] = useState('updatedAt');

    // Inline Editing
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');

    // Delete Modal
    const [sessionToDelete, setSessionToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchSessions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const query = {
                limit: 100,
                sort: sortBy
            };
            if (statusFilter === 'Draft' || statusFilter === 'Generated' || statusFilter === 'Archived') {
                query.status = statusFilter;
            } else if (statusFilter === 'all') {
                // leave empty to fetch all including archived
            }
            // else 'active' by default excludes archived in backend
            if (contextFilter !== 'all') {
                query.context = contextFilter;
            }
            if (search.trim()) {
                query.search = search.trim();
            }

            const response = await sessionService.list(query);
            if (response.success && Array.isArray(response.data)) {
                setSessions(response.data);
            } else {
                setSessions([]);
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
            setError(err.message || 'Failed to load workspace history.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, [statusFilter, contextFilter, sortBy]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchSessions();
        }, 350);
        return () => clearTimeout(timer);
    }, [search]);

    const handleStartRename = (session, e) => {
        e.stopPropagation();
        setEditingId(session._id);
        setEditTitle(session.title || 'Untitled Session');
    };

    const handleSaveRename = async (sessionId, e) => {
        if (e) e.stopPropagation();
        if (!editTitle.trim()) return;
        try {
            await sessionService.update(sessionId, { title: editTitle.trim() });
            setSessions(prev => prev.map(s => s._id === sessionId ? { ...s, title: editTitle.trim() } : s));
            setEditingId(null);
            refreshSidebarHistory();
        } catch (err) {
            console.error('Rename failed:', err);
        }
    };

    const handleCancelRename = (e) => {
        if (e) e.stopPropagation();
        setEditingId(null);
        setEditTitle('');
    };

    const handleToggleArchive = async (session, e) => {
        e.stopPropagation();
        const newStatus = session.status === 'Archived' ? 'Generated' : 'Archived';
        try {
            await sessionService.update(session._id, { status: newStatus });
            setSessions(prev => prev.map(s => s._id === session._id ? { ...s, status: newStatus } : s));
            refreshSidebarHistory();
        } catch (err) {
            console.error('Archive failed:', err);
        }
    };

    const confirmDelete = async () => {
        if (!sessionToDelete) return;
        setIsDeleting(true);
        try {
            await sessionService.delete(sessionToDelete._id);
            setSessions(prev => prev.filter(s => s._id !== sessionToDelete._id));
            setSessionToDelete(null);
            refreshSidebarHistory();
        } catch (err) {
            console.error('Delete failed:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleNewSession = async () => {
        try {
            const response = await sessionService.create({
                requirement: '',
                context: 'web',
                depth: 'Standard',
                title: 'New Session'
            });
            if (response.success && response.data?._id) {
                navigate(`/app/workspace/${response.data._id}`);
            } else {
                navigate('/app/workspace');
            }
        } catch (err) {
            navigate('/app/workspace');
        }
    };

    return (
        <div className="tn-history-page">
            {/* Top Header */}
            <div className="tn-history-header">
                <div>
                    <div className="tn-history-badge">
                        <Clock size={13} />
                        PERSISTENT SESSIONS
                    </div>
                    <h1 className="tn-history-title">Workspace History</h1>
                    <p className="tn-history-subtitle">
                        Browse, resume, edit and manage all your previous AI requirements and generated test suites.
                    </p>
                </div>

                <button
                    type="button"
                    className="tn-history-new-btn"
                    onClick={handleNewSession}
                >
                    <Plus size={16} />
                    <span>+ New Session</span>
                </button>
            </div>

            {/* Controls Bar */}
            <div className="tn-history-controls">
                {/* Search */}
                <div className="tn-history-search-wrap">
                    <Search size={16} className="tn-history-search-icon" />
                    <input
                        type="text"
                        className="tn-history-search-input"
                        placeholder="Search sessions by title, requirement keyword..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button
                            type="button"
                            className="tn-history-search-clear"
                            onClick={() => setSearch('')}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Status Tabs */}
                <div className="tn-history-tabs">
                    <button
                        type="button"
                        className={`tn-history-tab ${statusFilter === 'active' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('active')}
                    >
                        Active
                    </button>
                    <button
                        type="button"
                        className={`tn-history-tab ${statusFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('all')}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        className={`tn-history-tab ${statusFilter === 'Generated' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('Generated')}
                    >
                        Generated
                    </button>
                    <button
                        type="button"
                        className={`tn-history-tab ${statusFilter === 'Draft' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('Draft')}
                    >
                        Drafts
                    </button>
                    <button
                        type="button"
                        className={`tn-history-tab ${statusFilter === 'Archived' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('Archived')}
                    >
                        Archived
                    </button>
                </div>

                {/* Filters & Sorting Dropdowns */}
                <div className="tn-history-selects">
                    <select
                        className="tn-history-select"
                        value={contextFilter}
                        onChange={(e) => setContextFilter(e.target.value)}
                        aria-label="Filter by context"
                    >
                        <option value="all">All Contexts</option>
                        <option value="web">Web Application</option>
                        <option value="mobile">Mobile Application</option>
                        <option value="api">REST / GraphQL API</option>
                    </select>

                    <select
                        className="tn-history-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        aria-label="Sort sessions"
                    >
                        <option value="updatedAt">Recently Updated</option>
                        <option value="createdAt">Creation Date</option>
                        <option value="totalTests">Most Test Cases</option>
                        <option value="title">Alphabetical</option>
                    </select>
                </div>
            </div>

            {/* Content Area */}
            {isLoading ? (
                <div className="tn-history-skeleton-list">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="tn-history-skeleton-card" />
                    ))}
                </div>
            ) : error ? (
                <div className="tn-history-error-card">
                    <AlertCircle size={24} color="#ef4444" />
                    <h3>Failed to load sessions</h3>
                    <p>{error}</p>
                    <button type="button" className="tn-history-retry-btn" onClick={fetchSessions}>
                        <RefreshCw size={14} />
                        Retry
                    </button>
                </div>
            ) : sessions.length === 0 ? (
                <div className="tn-history-empty-card">
                    <div className="tn-history-empty-icon">
                        <Sparkles size={28} />
                    </div>
                    <h3>No workspace sessions found</h3>
                    <p>
                        {search || statusFilter !== 'active' || contextFilter !== 'all'
                            ? 'No sessions match your search filters. Try clearing filters.'
                            : 'Start your first AI workspace session to generate comprehensive test suites with persistent history.'}
                    </p>
                    <button
                        type="button"
                        className="tn-history-new-btn"
                        onClick={handleNewSession}
                    >
                        <Plus size={16} />
                        <span>Start New Session</span>
                    </button>
                </div>
            ) : (
                <div className="tn-history-list">
                    {sessions.map((session) => {
                        const isEditing = editingId === session._id;
                        const isArchived = session.status === 'Archived';
                        const totalTests = session.summary?.total || 0;
                        const confidence = session.quality?.confidenceLevel || session.quality?.coverageConfidence || null;

                        return (
                            <div
                                key={session._id}
                                className={`tn-history-card ${isArchived ? 'is-archived' : ''}`}
                                onClick={() => navigate(`/app/workspace/${session._id}`)}
                            >
                                <div className="tn-history-card-body">
                                    {/* Top Row: Title + Status + Context */}
                                    <div className="tn-history-card-top">
                                        <div className="tn-history-card-title-wrap" onClick={(e) => e.stopPropagation()}>
                                            {isEditing ? (
                                                <div className="tn-history-inline-edit">
                                                    <input
                                                        type="text"
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveRename(session._id, e);
                                                            if (e.key === 'Escape') handleCancelRename(e);
                                                        }}
                                                        autoFocus
                                                        className="tn-history-edit-input"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="tn-history-edit-btn confirm"
                                                        onClick={(e) => handleSaveRename(session._id, e)}
                                                        title="Save title"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="tn-history-edit-btn cancel"
                                                        onClick={handleCancelRename}
                                                        title="Cancel"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="tn-history-card-title-group">
                                                    <h2 className="tn-history-card-title">
                                                        {session.title || 'Untitled Session'}
                                                    </h2>
                                                    <button
                                                        type="button"
                                                        className="tn-history-rename-btn"
                                                        onClick={(e) => handleStartRename(session, e)}
                                                        title="Rename session"
                                                    >
                                                        <Edit3 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="tn-history-card-badges">
                                            <span className={`tn-history-status-pill ${session.status?.toLowerCase()}`}>
                                                {session.status || 'Draft'}
                                            </span>
                                            <span className="tn-history-context-pill">
                                                {session.context?.toUpperCase() || 'WEB'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Requirement preview */}
                                    <p className="tn-history-card-requirement">
                                        {session.requirement
                                            ? session.requirement
                                            : <span className="tn-history-empty-req">No requirement entered yet (Draft)</span>}
                                    </p>

                                    {/* Metrics / Metadata Row */}
                                    <div className="tn-history-card-meta">
                                        <div className="tn-history-meta-stats">
                                            <div className="tn-history-stat-pill">
                                                <Layers size={13} />
                                                <strong>{totalTests}</strong> Tests
                                            </div>
                                            {session.summary?.functional > 0 && (
                                                <div className="tn-history-stat-pill sub">
                                                    <span>{session.summary.functional} Functional</span>
                                                </div>
                                            )}
                                            {session.summary?.edge > 0 && (
                                                <div className="tn-history-stat-pill sub">
                                                    <span>{session.summary.edge} Edge</span>
                                                </div>
                                            )}
                                            {session.currentVersion > 1 && (
                                                <div className="tn-history-stat-pill version">
                                                    <span>v{session.currentVersion}</span>
                                                </div>
                                            )}
                                            {confidence && (
                                                <div className="tn-history-stat-pill confidence">
                                                    <Shield size={12} />
                                                    <span>{confidence}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="tn-history-timestamp">
                                            <Clock size={12} />
                                            <span>Updated {formatTimeAgo(session.updatedAt || session.createdAt)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Column */}
                                <div className="tn-history-card-actions" onClick={(e) => e.stopPropagation()}>
                                    <NavLink
                                        to={`/app/workspace/${session._id}`}
                                        className="tn-history-action-btn primary"
                                        title="Resume session in AI Workspace"
                                    >
                                        <span>Resume</span>
                                        <ArrowRight size={14} />
                                    </NavLink>

                                    <button
                                        type="button"
                                        className={`tn-history-icon-btn ${isArchived ? 'is-archived' : ''}`}
                                        onClick={(e) => handleToggleArchive(session, e)}
                                        title={isArchived ? 'Unarchive session' : 'Archive session'}
                                    >
                                        <Archive size={15} />
                                    </button>

                                    <button
                                        type="button"
                                        className="tn-history-icon-btn danger"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSessionToDelete(session);
                                        }}
                                        title="Delete session"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Confirmation Delete Modal */}
            {sessionToDelete && (
                <div className="tn-history-modal-overlay" onClick={() => setSessionToDelete(null)}>
                    <div className="tn-history-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="tn-history-modal-header">
                            <div className="tn-history-modal-icon-danger">
                                <AlertCircle size={22} />
                            </div>
                            <div>
                                <h3 className="tn-history-modal-title">Delete Workspace Session</h3>
                                <p className="tn-history-modal-subtitle">
                                    Are you sure you want to permanently delete "{sessionToDelete.title}"?
                                </p>
                            </div>
                        </div>

                        <div className="tn-history-modal-body">
                            <p>
                                This will permanently erase the session, all requirement notes, AI conversation turns,
                                and generated test cases. This action cannot be undone.
                            </p>
                        </div>

                        <div className="tn-history-modal-footer">
                            <button
                                type="button"
                                className="tn-history-modal-btn cancel"
                                onClick={() => setSessionToDelete(null)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="tn-history-modal-btn delete"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete Session'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoryPage;
