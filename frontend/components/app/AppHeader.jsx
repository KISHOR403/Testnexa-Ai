import React from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import {
    Menu, ChevronRight, Sparkles, HelpCircle, Bell,
    Layers, ShieldCheck, AlertTriangle, GitBranch, Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AppHeader = ({ onToggleMobile }) => {
    const location = useLocation();
    const { user } = useAuth();

    // Determine breadcrumbs based on pathname
    const getBreadcrumb = () => {
        const path = location.pathname;
        if (path.includes('/app/workspace')) {
            return { section: 'Workspace', current: 'AI Workspace', link: '/app/workspace' };
        }
        if (path.includes('/app/test-suites/')) {
            const suiteSlug = path.split('/app/test-suites/')[1] || 'Suite';
            const formatted = suiteSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            return { section: 'Test Suites', current: `${formatted} Suite`, link: '/app/test-suites' };
        }
        if (path.includes('/app/test-suites')) {
            return { section: 'Workspace', current: 'All Test Suites', link: '/app/test-suites' };
        }
        if (path.includes('/app/coverage')) {
            return { section: 'QA Analysis', current: 'Coverage Matrix', link: '/app/coverage' };
        }
        if (path.includes('/app/risks')) {
            return { section: 'QA Analysis', current: 'Risk Vectors & Security', link: '/app/risks' };
        }
        if (path.includes('/app/traceability')) {
            return { section: 'QA Analysis', current: 'Requirement Traceability', link: '/app/traceability' };
        }
        if (path.includes('/app/settings')) {
            return { section: 'System', current: 'Settings', link: '/app/settings' };
        }
        return { section: 'Application', current: 'Workspace', link: '/app/workspace' };
    };

    const breadcrumb = getBreadcrumb();
    const initials = (user?.name || user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

    return (
        <header className="app-header">
            <div className="app-header__left">
                <button
                    type="button"
                    className="app-header__mobile-toggle"
                    onClick={onToggleMobile}
                    aria-label="Open Navigation Menu"
                >
                    <Menu size={18} />
                </button>

                <div className="app-header__breadcrumbs">
                    <NavLink to={breadcrumb.link} className="app-header__crumb-link">
                        {breadcrumb.section}
                    </NavLink>
                    <ChevronRight size={13} style={{ opacity: 0.4 }} />
                    <span className="app-header__crumb-current">{breadcrumb.current}</span>
                </div>
            </div>

            <div className="app-header__right">
                <div className="app-header__badge">
                    <span className="app-header__badge-dot" />
                    <span>AI Engine Active</span>
                </div>

                <NavLink to="/help" className="app-header__btn" title="Documentation & Help">
                    <HelpCircle size={16} />
                </NavLink>

                <div
                    className="app-header__btn"
                    title="User Profile"
                    style={{ background: '#111111', border: '1px solid #1C1C1C', color: '#00D9C0', fontWeight: '700', fontSize: '0.78rem' }}
                >
                    {initials}
                </div>
            </div>
        </header>
    );
};

export default AppHeader;
