import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    FileText, Layers, ShieldCheck, AlertTriangle, GitBranch, ClipboardList,
    Settings, HelpCircle, ChevronLeft, ChevronRight, ChevronDown, Plus,
    Home, X, History, Clock, User, Award, LogOut, ArrowRight, ChevronUp,
    PlayCircle, Activity, BarChart3, Sparkles, Wrench, Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';
import TestNexaLogo from '../TestNexaLogo';
import '../../styles/app/AppSidebar.css';

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
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const AppSidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) => {
    const { user, logout, isSigningOut, currentWorkspace } = useAuth();
    const { history, recentSessions } = useHistory();
    const location = useLocation();
    const navigate = useNavigate();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const userMenuRef = useRef(null);

    // Analysis group collapsible state with auto-open on active page
    const analysisRoutes = useMemo(() => [
        '/app/intelligence',
        '/app/quality-insights',
        '/app/coverage',
        '/app/risks',
        '/app/traceability',
        '/app/failure-trends',
        '/app/recommendations',
        '/app/maintenance',
        '/app/integrations'
    ], []);

    const isAnalysisActive = useMemo(() => {
        return analysisRoutes.some(route => location.pathname.startsWith(route));
    }, [analysisRoutes, location.pathname]);

    const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);

    // Auto-open Analysis group whenever user navigates to an analysis page
    useEffect(() => {
        if (isAnalysisActive) {
            setIsAnalysisExpanded(true);
        }
    }, [isAnalysisActive]);

    // De-duplicate recent items by unique key (title/id)
    const uniqueRecentSessions = useMemo(() => {
        const seen = new Set();
        const list = [];
        (recentSessions || []).forEach(session => {
            const key = (session.title || '').trim().toLowerCase() || session.id;
            if (key && !seen.has(key)) {
                seen.add(key);
                list.push(session);
            }
        });
        return list;
    }, [recentSessions]);

    // Helper to resolve status chip
    const getStatusChip = (session, totalTests) => {
        const status = (session.status || '').toLowerCase();
        if (status === 'failed') {
            return <span className="app-sidebar__status-chip is-failed">Failed</span>;
        }
        if (status === 'approved' || status === 'completed' || status === 'generated' || totalTests > 0) {
            return <span className="app-sidebar__status-chip is-complete">Complete</span>;
        }
        return <span className="app-sidebar__status-chip is-draft">Draft</span>;
    };

    // Close menu when clicking outside or pressing Escape
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                setIsMenuOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMenuOpen]);

    const initials = (user?.name || user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

    const handleNavClick = () => {
        if (onCloseMobile) onCloseMobile();
    };

    return (
        <aside className={`app-sidebar ${isCollapsed ? 'is-collapsed' : ''} ${isMobileOpen ? 'mobile-is-open' : ''}`}>
            {/* Stationary Top Header Section */}
            <div className="app-sidebar__top">
                <div className="app-sidebar__header">
                    <NavLink to="/app/workspace" className="app-sidebar__brand" onClick={handleNavClick}>
                        <TestNexaLogo size={26} className="app-sidebar__logo" />
                        {!isCollapsed && (
                            <div className="app-sidebar__brand-name">
                                <span>TESTNEXA AI</span>
                            </div>
                        )}
                    </NavLink>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                            type="button"
                            className="app-sidebar__collapse-btn"
                            onClick={onToggleCollapse}
                            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            aria-label="Toggle Sidebar Collapse"
                        >
                            {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                        </button>
                        <button
                            type="button"
                            className="app-sidebar__mobile-close-btn"
                            onClick={onCloseMobile}
                            title="Close sidebar"
                            aria-label="Close mobile sidebar"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* + New Test Suite CTA (Single plus icon, sentence case, white fill, black text) */}
                <div className="app-sidebar__action-wrap">
                    <NavLink
                        to="/app/workspace"
                        className="app-sidebar__new-btn"
                        onClick={handleNavClick}
                        title="New test suite"
                    >
                        <Plus size={16} />
                        <span>New test suite</span>
                    </NavLink>
                </div>
            </div>

            {/* Scrollable Middle Navigation Section */}
            <nav className="app-sidebar__nav">
                {/* WORKSPACE GROUP */}
                <div className="app-sidebar__group">
                    <span className="app-sidebar__group-label">WORKSPACE</span>

                    <NavLink
                        to="/app/workspace"
                        end
                        className={({ isActive }) => `app-sidebar__item ${isActive ? 'active' : ''}`}
                        onClick={handleNavClick}
                        title="AI Workspace"
                    >
                        <FileText size={17} className="app-sidebar__item-icon" />
                        <span>AI Workspace</span>
                    </NavLink>

                    <NavLink
                        to="/app/test-suites"
                        className={({ isActive }) => `app-sidebar__item ${isActive || location.pathname.startsWith('/app/test-suites') ? 'active' : ''}`}
                        onClick={handleNavClick}
                        title="Test Suites"
                    >
                        <Layers size={17} className="app-sidebar__item-icon" />
                        <span>Test Suites</span>
                    </NavLink>

                    <NavLink
                        to="/app/test-cases"
                        className={({ isActive }) => `app-sidebar__item ${isActive ? 'active' : ''}`}
                        onClick={handleNavClick}
                        title="Test Cases"
                    >
                        <ClipboardList size={17} className="app-sidebar__item-icon" />
                        <span>Test Cases</span>
                    </NavLink>

                    <NavLink
                        to="/app/runs"
                        className={({ isActive }) => `app-sidebar__item ${isActive || location.pathname.startsWith('/app/runs') ? 'active' : ''}`}
                        onClick={handleNavClick}
                        title="Test Runs"
                    >
                        <PlayCircle size={17} className="app-sidebar__item-icon" />
                        <span>Test Runs</span>
                    </NavLink>
                </div>

                {/* RECENT WORK GROUP */}
                <div className="app-sidebar__group">
                    <span className="app-sidebar__group-label">RECENT</span>

                    {!isCollapsed && uniqueRecentSessions.length > 0 ? (
                        <div className="app-sidebar__history-list">
                            {uniqueRecentSessions.slice(0, 4).map((session) => {
                                const targetUrl = `/app/test-suites/${session.id}`;
                                return (
                                    <NavLink
                                        key={session.id}
                                        to={targetUrl}
                                        className={({ isActive }) => `app-sidebar__history-row ${isActive ? 'active' : ''}`}
                                        onClick={handleNavClick}
                                        title={session.title}
                                    >
                                        <span className="app-sidebar__history-row-title">{session.title}</span>
                                        <span className="app-sidebar__history-row-time">{formatTimeAgo(session.date || session.updatedAt)}</span>
                                    </NavLink>
                                );
                            })}
                            <NavLink
                                to="/app/history"
                                className="app-sidebar__view-all-link"
                                onClick={handleNavClick}
                            >
                                View all →
                            </NavLink>
                        </div>
                    ) : (
                        <NavLink
                            to="/app/history"
                            className={({ isActive }) => `app-sidebar__item ${isActive || location.pathname.startsWith('/app/history') ? 'active' : ''}`}
                            onClick={handleNavClick}
                            title="Workspace History"
                        >
                            <History size={17} className="app-sidebar__item-icon" />
                            <span>History</span>
                            {!isCollapsed && history.length > 0 && (
                                <span className="app-sidebar__badge">{history.length}</span>
                            )}
                        </NavLink>
                    )}
                </div>

                {/* ANALYSIS GROUP (COLLAPSIBLE WITH AUTO-OPEN) */}
                <div className="app-sidebar__group">
                    <button
                        type="button"
                        className="app-sidebar__group-header-btn"
                        onClick={() => setIsAnalysisExpanded(prev => !prev)}
                        aria-expanded={isAnalysisExpanded}
                        title={isAnalysisExpanded ? "Collapse Analysis group" : "Expand Analysis group"}
                    >
                        <span className="app-sidebar__group-label">ANALYSIS</span>
                        {!isCollapsed && (
                            <div className="app-sidebar__group-toggle">
                                <span className="app-sidebar__group-count">9</span>
                                <ChevronDown
                                    size={13}
                                    style={{
                                        transform: isAnalysisExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                        transition: 'transform 0.18s ease'
                                    }}
                                />
                            </div>
                        )}
                    </button>

                    {(!isCollapsed ? isAnalysisExpanded : true) && (
                        <div className="app-sidebar__collapsible-items">
                            <NavLink
                                to="/app/intelligence"
                                className={({ isActive }) => `app-sidebar__item ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title="Execution Intelligence"
                            >
                                <BarChart3 size={17} className="app-sidebar__item-icon" />
                                <span>Intelligence</span>
                            </NavLink>

                            <NavLink
                                to="/app/quality-insights"
                                className={({ isActive }) => `app-sidebar__item ${isActive || location.pathname.includes('quality-insights') ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title="Quality Insights"
                            >
                                <Activity size={17} className="app-sidebar__item-icon" />
                                <span>Quality Insights</span>
                            </NavLink>

                            <NavLink
                                to="/app/coverage"
                                className={({ isActive }) => `app-sidebar__item ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title="Coverage"
                            >
                                <ShieldCheck size={17} className="app-sidebar__item-icon" />
                                <span>Coverage</span>
                            </NavLink>

                            <NavLink
                                to="/app/risks"
                                className={({ isActive }) => `app-sidebar__item ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title="Risks"
                            >
                                <AlertTriangle size={17} className="app-sidebar__item-icon" />
                                <span>Risks</span>
                            </NavLink>

                            <NavLink
                                to="/app/traceability"
                                className={({ isActive }) => `app-sidebar__item ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title="Traceability"
                            >
                                <GitBranch size={17} className="app-sidebar__item-icon" />
                                <span>Traceability</span>
                            </NavLink>

                            <NavLink
                                to="/app/failure-trends"
                                className={({ isActive }) => `app-sidebar__item ${isActive ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title="Failure Trends"
                            >
                                <Activity size={17} className="app-sidebar__item-icon" />
                                <span>Failure Trends</span>
                            </NavLink>

                            <NavLink
                                to="/app/recommendations"
                                className={({ isActive }) => `app-sidebar__item ${isActive || location.pathname.startsWith('/app/recommendations') ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title="Smart Recommendations"
                            >
                                <Sparkles size={17} className="app-sidebar__item-icon" />
                                <span>Recommendations</span>
                            </NavLink>

                            <NavLink
                                to="/app/maintenance"
                                className={({ isActive }) => `app-sidebar__item ${isActive || location.pathname.startsWith('/app/maintenance') ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title="Test Maintenance Intelligence"
                            >
                                <Wrench size={17} className="app-sidebar__item-icon" />
                                <span>Maintenance</span>
                            </NavLink>

                            <NavLink
                                to="/app/integrations"
                                className={({ isActive }) => `app-sidebar__item ${isActive || location.pathname.startsWith('/app/integrations') ? 'active' : ''}`}
                                onClick={handleNavClick}
                                title="CI/CD Integrations"
                            >
                                <GitBranch size={17} className="app-sidebar__item-icon" />
                                <span>CI/CD</span>
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* SYSTEM GROUP */}
                <div className="app-sidebar__group" style={{ marginTop: 'auto' }}>
                    <span className="app-sidebar__group-label">SYSTEM</span>

                    <NavLink
                        to="/app/organization"
                        className={({ isActive }) => `app-sidebar__item ${isActive || location.pathname.startsWith('/app/organization') ? 'active' : ''}`}
                        onClick={handleNavClick}
                        title="Team & Organization"
                    >
                        <Users size={17} className="app-sidebar__item-icon" />
                        <span>Team & Org</span>
                    </NavLink>

                    <NavLink
                        to="/app/settings"
                        className={({ isActive }) => `app-sidebar__item ${isActive ? 'active' : ''}`}
                        onClick={handleNavClick}
                        title="Settings"
                    >
                        <Settings size={17} className="app-sidebar__item-icon" />
                        <span>Settings</span>
                    </NavLink>

                    <NavLink
                        to="/help"
                        className="app-sidebar__item"
                        onClick={handleNavClick}
                        title="Help & Documentation"
                    >
                        <HelpCircle size={17} className="app-sidebar__item-icon" />
                        <span>Help & Docs</span>
                    </NavLink>

                    <NavLink
                        to="/"
                        className="app-sidebar__item"
                        onClick={handleNavClick}
                        title="Exit to Marketing Website"
                    >
                        <Home size={17} className="app-sidebar__item-icon" />
                        <span>Website</span>
                    </NavLink>
                </div>
            </nav>

            {/* User Footer */}
            <div className="app-sidebar__footer" ref={userMenuRef}>
                {/* Popup Menu */}
                {isMenuOpen && (
                    <div className="gpt-profile-popup" role="menu" aria-label="User Account Menu">
                        <div className="gpt-profile-popup-glow" />

                        {/* User info header inside popup */}
                        <div style={{ padding: '0.65rem 0.75rem 0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '0.25rem' }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user?.name || user?.email?.split('@')[0] || 'Enterprise QA'}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#888888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                                {user?.email || 'user@testnexa.ai'}
                            </div>
                            <div style={{ marginTop: '0.45rem', display: 'inline-flex', alignItems: 'center', fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(125, 211, 252, 0.1)', color: '#7DD3FC', border: '1px solid rgba(125, 211, 252, 0.25)', letterSpacing: '0.04em', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {currentWorkspace?.name ? currentWorkspace.name.toUpperCase() : 'PRO WORKSPACE'}
                            </div>
                        </div>

                        <button
                            type="button"
                            className="gpt-profile-popup-item"
                            onClick={() => {
                                setIsMenuOpen(false);
                                navigate('/app/settings?tab=profile');
                                if (onCloseMobile) onCloseMobile();
                            }}
                        >
                            <div className="gpt-popup-icon-wrap">
                                <User size={15} />
                            </div>
                            <span>Profile</span>
                            <ArrowRight size={13} className="gpt-popup-arrow" />
                        </button>

                        <button
                            type="button"
                            className="gpt-profile-popup-item"
                            onClick={() => {
                                setIsMenuOpen(false);
                                navigate('/app/settings?tab=preferences');
                                if (onCloseMobile) onCloseMobile();
                            }}
                        >
                            <div className="gpt-popup-icon-wrap">
                                <Settings size={15} />
                            </div>
                            <span>Preferences</span>
                            <ArrowRight size={13} className="gpt-popup-arrow" />
                        </button>

                        <button
                            type="button"
                            className="gpt-profile-popup-item gpt-upgrade-item"
                            onClick={() => {
                                setIsMenuOpen(false);
                                navigate('/app/settings?tab=billing');
                                if (onCloseMobile) onCloseMobile();
                            }}
                        >
                            <div className="gpt-popup-icon-wrap gpt-upgrade-icon">
                                <Award size={15} />
                            </div>
                            <span style={{ color: '#7DD3FC', fontWeight: 600 }}>Billing & Usage</span>
                            <ArrowRight size={13} className="gpt-popup-arrow" />
                        </button>

                        <button
                            type="button"
                            className="gpt-profile-popup-item"
                            onClick={() => {
                                setIsMenuOpen(false);
                                navigate('/app/settings?tab=security');
                                if (onCloseMobile) onCloseMobile();
                            }}
                        >
                            <div className="gpt-popup-icon-wrap">
                                <ShieldCheck size={15} />
                            </div>
                            <span>Security</span>
                            <ArrowRight size={13} className="gpt-popup-arrow" />
                        </button>

                        <button
                            type="button"
                            className="gpt-profile-popup-item"
                            onClick={() => {
                                setIsMenuOpen(false);
                                navigate('/app/settings?tab=workspace');
                                if (onCloseMobile) onCloseMobile();
                            }}
                        >
                            <div className="gpt-popup-icon-wrap">
                                <Settings size={15} />
                            </div>
                            <span>Workspace Settings</span>
                            <ArrowRight size={13} className="gpt-popup-arrow" />
                        </button>

                        {(user?.role === 'admin' || user?.role === 'super_admin') && (
                            <button
                                type="button"
                                className="gpt-profile-popup-item"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    navigate('/admin');
                                    if (onCloseMobile) onCloseMobile();
                                }}
                            >
                                <div className="gpt-popup-icon-wrap">
                                    <ShieldCheck size={15} />
                                </div>
                                <span style={{ fontWeight: 600 }}>Admin Console</span>
                                <ArrowRight size={13} className="gpt-popup-arrow" />
                            </button>
                        )}

                        <button
                            type="button"
                            className="gpt-profile-popup-item"
                            onClick={() => {
                                setIsMenuOpen(false);
                                navigate('/help');
                                if (onCloseMobile) onCloseMobile();
                            }}
                        >
                            <div className="gpt-popup-icon-wrap">
                                <HelpCircle size={15} />
                            </div>
                            <span>Help & Docs</span>
                            <ArrowRight size={13} className="gpt-popup-arrow" />
                        </button>

                        <div className="gpt-profile-popup-divider" />

                        <button
                            type="button"
                            className={`gpt-profile-popup-item gpt-logout-item ${isSigningOut ? 'is-loading' : ''}`}
                            disabled={isSigningOut}
                            onClick={async () => {
                                setIsMenuOpen(false);
                                await logout();
                            }}
                            style={{ opacity: isSigningOut ? 0.6 : 1, cursor: isSigningOut ? 'not-allowed' : 'pointer' }}
                        >
                            <div className="gpt-popup-icon-wrap gpt-logout-icon">
                                {isSigningOut ? (
                                    <div style={{
                                        width: '13px',
                                        height: '13px',
                                        border: '2px solid rgba(255, 255, 255, 0.2)',
                                        borderTopColor: '#FFFFFF',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                ) : (
                                    <LogOut size={15} />
                                )}
                            </div>
                            <span>{isSigningOut ? 'Signing out…' : 'Log out'}</span>
                        </button>
                    </div>
                )}

                {/* Footer Trigger Button (Pinned Row: Avatar Left, Stacked Name/Role, Chevron Right) */}
                <button
                    type="button"
                    className="app-sidebar__user-btn"
                    onClick={() => setIsMenuOpen(prev => !prev)}
                    aria-expanded={isMenuOpen}
                    aria-label="User Account Menu"
                    title={user?.email || 'User Menu'}
                >
                    <div className="app-sidebar__avatar">
                        <span>{initials}</span>
                    </div>

                    {!isCollapsed && (
                        <>
                            <div className="app-sidebar__user-info">
                                <span className="app-sidebar__user-name">
                                    {user?.name || user?.email?.split('@')[0] || 'Enterprise QA'}
                                </span>
                                <span className="app-sidebar__user-role">
                                    {currentWorkspace?.name ? currentWorkspace.name.toUpperCase() : 'PRO WORKSPACE'}
                                </span>
                            </div>
                            <ChevronRight size={14} className="app-sidebar__user-chevron" />
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
};

export default AppSidebar;
