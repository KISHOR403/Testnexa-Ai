import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    Sparkles, Layers, ShieldCheck, AlertTriangle, GitBranch,
    Settings, HelpCircle, ChevronLeft, ChevronRight, Plus,
    Home, X, History, Clock
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
    const { user } = useAuth();
    const { history, recentSessions } = useHistory();
    const location = useLocation();

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
                            <span>Testnexa AI</span>
                            <span className="app-sidebar__brand-badge">APP</span>
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
                    <span className="app-sidebar__group-label">Workspace</span>

                    <NavLink
                        to="/app/workspace"
                        end
                        className={({ isActive }) => `app-sidebar__item ${isActive ? 'active' : ''}`}
                        onClick={handleNavClick}
                        title="AI Workspace"
                    >
                        <Sparkles size={17} className="app-sidebar__item-icon" />
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

                {/* HISTORY GROUP */}
                <div className="app-sidebar__group">
                    <span className="app-sidebar__group-label">History</span>

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

                    {!isCollapsed && recentSessions.length > 0 && (
                        <div className="app-sidebar__history-list">
                            {recentSessions.map((session) => (
                                <NavLink
                                    key={session.id}
                                    to={`/app/workspace/${session.id}`}
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
                                View all history →
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* QA ANALYSIS GROUP */}
                <div className="app-sidebar__group">
                    <span className="app-sidebar__group-label">QA Analysis</span>

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
            <div className="app-sidebar__footer">
                <div className="app-sidebar__user">
                    <div className="app-sidebar__user-avatar">
                        {initials}
                    </div>
                    {!isCollapsed && (
                        <div className="app-sidebar__user-info">
                            <span className="app-sidebar__user-name">
                                {user?.name || user?.email?.split('@')[0] || 'Enterprise QA'}
                            </span>
                            <span className="app-sidebar__user-plan">Pro Workspace</span>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default AppSidebar;
