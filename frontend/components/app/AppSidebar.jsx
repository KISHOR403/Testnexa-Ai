import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    FileText, Layers, ShieldCheck, AlertTriangle, GitBranch,
    Settings, HelpCircle, ChevronLeft, ChevronRight, Plus,
    Home, X, History, Clock, User, Award, LogOut, ArrowRight, ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';
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
    const { user, logout, isSigningOut } = useAuth();
    const { history, recentSessions } = useHistory();
    const location = useLocation();
    const navigate = useNavigate();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const userMenuRef = useRef(null);

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
            {/* Header */}
            <div className="app-sidebar__header">
                <NavLink to="/app/workspace" className="app-sidebar__brand" onClick={handleNavClick}>
                    <img src="/testnexa-logo.png" alt="Testnexa" className="app-sidebar__logo" />
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

            {/* + New Test Suite CTA */}
            <div className="app-sidebar__action-wrap">
                <NavLink
                    to="/app/workspace"
                    className="app-sidebar__new-btn"
                    onClick={handleNavClick}
                    title="New Test Suite"
                >
                    <Plus size={16} />
                    <span>+ New Test Suite</span>
                </NavLink>
            </div>

            {/* Navigation Groups */}
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
                </div>

                {/* RECENT WORK GROUP */}
                <div className="app-sidebar__group">
                    <span className="app-sidebar__group-label">RECENT</span>

                    {!isCollapsed && recentSessions.length > 0 ? (
                        <div className="app-sidebar__history-list">
                            {recentSessions.slice(0, 4).map((session) => (
                                <NavLink
                                    key={session.id}
                                    to={session.status === 'Draft' && !session.suite ? `/app/workspace/${session.id}` : `/app/test-suites/${session.id}`}
                                    className={({ isActive }) => `app-sidebar__history-item ${isActive ? 'active' : ''}`}
                                    onClick={handleNavClick}
                                    title={session.title}
                                >
                                    <div className="app-sidebar__history-item-top">
                                        <span className="app-sidebar__history-item-title">{session.title}</span>
                                    </div>
                                    <div className="app-sidebar__history-item-meta">
                                        <span className="app-sidebar__history-context">{session.context || 'web'}</span>
                                        <span>•</span>
                                        <span>{session.totalCases || session.summary?.total || 0} tests</span>
                                        <span>•</span>
                                        <span>{formatTimeAgo(session.date)}</span>
                                    </div>
                                </NavLink>
                            ))}
                            <NavLink
                                to="/app/history"
                                className="app-sidebar__view-all-link"
                                onClick={handleNavClick}
                            >
                                View All →
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

                {/* ANALYSIS GROUP */}
                <div className="app-sidebar__group">
                    <span className="app-sidebar__group-label">ANALYSIS</span>

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
                </div>

                {/* SYSTEM GROUP */}
                <div className="app-sidebar__group" style={{ marginTop: 'auto' }}>
                    <span className="app-sidebar__group-label">System</span>

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
                            <div style={{ marginTop: '0.45rem', display: 'inline-flex', alignItems: 'center', fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(0, 217, 192, 0.12)', color: '#00D9C0', border: '1px solid rgba(0, 217, 192, 0.25)', letterSpacing: '0.04em' }}>
                                PRO WORKSPACE
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
                            <span style={{ color: '#00D9C0', fontWeight: 600 }}>Billing & Usage</span>
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
                                        border: '2px solid rgba(239, 68, 68, 0.2)',
                                        borderTopColor: '#EF4444',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                ) : (
                                    <LogOut size={15} />
                                )}
                            </div>
                            <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
                        </button>
                    </div>
                )}

                <div
                    className="app-sidebar__user"
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsMenuOpen(prev => !prev)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setIsMenuOpen(prev => !prev);
                        }
                    }}
                    title={isCollapsed ? (user?.name || user?.email || 'Account Menu') : undefined}
                    aria-haspopup="true"
                    aria-expanded={isMenuOpen}
                >
                    <div className="app-sidebar__user-avatar">
                        {initials}
                    </div>
                    {!isCollapsed && (
                        <>
                            <div className="app-sidebar__user-info">
                                <span className="app-sidebar__user-name">
                                    {user?.name || user?.email?.split('@')[0] || 'Enterprise QA'}
                                </span>
                                <span className="app-sidebar__user-plan">Pro Workspace</span>
                            </div>
                            <ChevronUp
                                size={14}
                                className={`app-sidebar__user-chevron ${isMenuOpen ? 'is-open' : ''}`}
                            />
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default AppSidebar;
