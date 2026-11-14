import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppSidebar from '../components/app/AppSidebar';
import AppHeader from '../components/app/AppHeader';
import ScrollToTop from '../components/ScrollToTop';
import ErrorBoundary from '../components/ErrorBoundary';
import SettingsModal from '../components/app/SettingsModal';
import KeyboardShortcutsModal from '../components/app/KeyboardShortcutsModal';
import { SettingsModalProvider, useSettingsModal } from '../context/SettingsModalContext';
import '../styles/app/AppSidebar.css';
import '../styles/app/WorkspaceDesignSystem.css';

const AppLayoutInner = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const userBtnRef = useRef(null);
    const { openSettings } = useSettingsModal();

    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('testnexa_sidebar_collapsed') === 'true';
    });
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

    const handleToggleCollapse = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('testnexa_sidebar_collapsed', String(next));
            return next;
        });
    };

    // Close mobile drawer on route change
    useEffect(() => {
        setIsMobileOpen(false);
    }, [location.pathname]);

    // Global keyboard shortcut: Ctrl/Cmd + / opens keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                setIsShortcutsOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="app-shell-container">
            <ScrollToTop />

            {/* Mobile Drawer Backdrop */}
            <div
                className={`app-mobile-drawer-overlay ${isMobileOpen ? 'mobile-is-open' : ''}`}
                onClick={() => setIsMobileOpen(false)}
            />

            {/* Collapsible Application Sidebar */}
            <AppSidebar
                isCollapsed={isCollapsed}
                onToggleCollapse={handleToggleCollapse}
                isMobileOpen={isMobileOpen}
                onCloseMobile={() => setIsMobileOpen(false)}
                onOpenSettings={(sec) => openSettings(sec, userBtnRef.current)}
                onOpenShortcuts={() => setIsShortcutsOpen(true)}
                userBtnRef={userBtnRef}
            />

            {/* Main Application Area */}
            <div className="app-shell-main">
                <AppHeader onToggleMobile={() => setIsMobileOpen(prev => !prev)} />
                <main className="app-page-content">
                    <ErrorBoundary>
                        <Outlet />
                    </ErrorBoundary>
                </main>
            </div>

            {/* Settings Modal — Rendered ONCE at app layout root, outside sidebar and popover */}
            <SettingsModal />

            {/* Keyboard Shortcuts Dialog */}
            <KeyboardShortcutsModal
                isOpen={isShortcutsOpen}
                onClose={() => setIsShortcutsOpen(false)}
                triggerRef={userBtnRef}
            />
        </div>
    );
};

export const AppLayout = () => {
    return (
        <SettingsModalProvider>
            <AppLayoutInner />
        </SettingsModalProvider>
    );
};

export default AppLayout;
