import React from 'react';
import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import {
    Menu, ChevronRight, HelpCircle, Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';

const AppHeader = ({ onToggleMobile }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { history } = useHistory();

    // Determine breadcrumbs based on pathname and search
    const getBreadcrumb = () => {
        const path = location.pathname;
        if (path.includes('/app/workspace')) {
            return { section: 'Workspace', current: 'AI Workspace', link: '/app/workspace' };
        }
        if (path.includes('/app/test-suites/')) {
            const suiteSlug = path.split('/app/test-suites/')[1]?.split('?')[0] || '';
            const matching = history?.find(item => item.id === suiteSlug || item.sessionId === suiteSlug);
            const title = matching?.title || matching?.feature;
            if (title) {
                return { section: 'Test Suites', current: title, link: '/app/test-suites' };
            }
            const formatted = (suiteSlug || 'Suite').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            return { section: 'Test Suites', current: `${formatted} Suite`, link: '/app/test-suites' };
        }
        if (path.includes('/app/test-suites')) {
            return { section: 'Workspace', current: 'All Test Suites', link: '/app/test-suites' };
        }
        if (path.includes('/app/coverage')) {
            return { section: 'Analysis', current: 'Coverage Matrix', link: '/app/coverage' };
        }
        if (path.includes('/app/risks')) {
            return { section: 'Analysis', current: 'Risk Vectors & Security', link: '/app/risks' };
        }
        if (path.includes('/app/traceability')) {
            return { section: 'Analysis', current: 'Requirement Traceability', link: '/app/traceability' };
        }
        if (path.includes('/app/runs/')) {
            return { section: 'Execution', current: 'Test Run Workspace', link: '/app/runs' };
        }
        if (path.includes('/app/runs')) {
            return { section: 'Execution', current: 'Unified Test Runs', link: '/app/runs' };
        }
        if (path.includes('/app/history')) {
            return { section: 'Workspace', current: 'Generation History', link: '/app/history' };
        }
        if (path.includes('/app/settings')) {
            const searchParams = new URLSearchParams(location.search);
            const tab = searchParams.get('tab') || 'profile';
            const tabLabels = {
                profile: 'Profile',
                preferences: 'Preferences',
                billing: 'Billing & Usage',
                security: 'Security',
                workspace: 'Workspace Settings',
                members: 'Members',
                integrations: 'Integrations'
            };
            return { section: 'Settings', current: tabLabels[tab] || 'Profile', link: '/app/settings' };
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
                    <ChevronRight size={13} style={{ opacity: 0.35 }} />
                    <span className="app-header__crumb-current">{breadcrumb.current}</span>
                </div>
            </div>

            <div className="app-header__right">
                <NavLink to="/help" className="app-header__btn" title="Documentation & Help">
                    <HelpCircle size={16} />
                </NavLink>

                <button
                    type="button"
                    className="app-header__btn"
                    title="Account Settings"
                    onClick={() => navigate('/app/settings?tab=profile')}
                    style={{
                        background: '#161819',
                        border: '1px solid #292D2D',
                        color: '#8BAF9A',
                        fontWeight: '600',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                    }}
                >
                    {initials}
                </button>
            </div>
        </header>
    );
};

export default AppHeader;
