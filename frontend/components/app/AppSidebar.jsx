import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    Sparkles, Layers, ShieldCheck, AlertTriangle, GitBranch,
    Settings, HelpCircle, ChevronLeft, ChevronRight, Plus,
    FileText, LogOut, ArrowLeft, Home, User, CheckCircle2, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';
import '../../styles/app/AppSidebar.css';

const AppSidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) => {
    const { user, isAuthenticated, logout } = useAuth();
    const { history } = useHistory();
    const location = useLocation();
    const navigate = useNavigate();

    const initials = (user?.name || user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

    const recentSuites = history.slice(0, 3).map((item, idx) => ({
        id: item.id || `suite-${idx + 1}`,
        title: item.feature || item.requirement?.slice(0, 26) || `Test Suite #${idx + 1}`,
        path: `/app/test-suites/${item.id || 'password-reset'}`
    }));

    // Fallback recent if history is empty
    const displayRecents = recentSuites.length > 0 ? recentSuites : [
        { id: 'password-reset', title: 'Password Reset Suite', path: '/app/test-suites/password-reset' },
        { id: 'user-auth', title: 'User Auth & 2FA Flow', path: '/app/test-suites/user-auth' }
    ];

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

                    {!isCollapsed && displayRecents.length > 0 && (
                        <div className="app-sidebar__sublist">
                            {displayRecents.map((suite) => (
                                <NavLink
                                    key={suite.id}
                                    to={suite.path}
                                    className={({ isActive }) => `app-sidebar__subitem ${isActive ? 'active' : ''}`}
                                    onClick={handleNavClick}
                                    title={suite.title}
                                >
                                    {suite.title}
                                </NavLink>
                            ))}
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
