import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from '../components/app/AppSidebar';
import AppHeader from '../components/app/AppHeader';
import ScrollToTop from '../components/ScrollToTop';
import AnimatedBackground from '../components/AnimatedBackground';
import '../styles/app/AppSidebar.css';
import '../styles/app/WorkspaceDesignSystem.css';

const AppLayout = () => {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('testnexa_sidebar_collapsed') === 'true';
    });
    const [isMobileOpen, setIsMobileOpen] = useState(false);

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
            />

            {/* Main Application Area */}
            <div className="app-shell-main">
                <AppHeader onToggleMobile={() => setIsMobileOpen(prev => !prev)} />
                <main className="app-page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AppLayout;
