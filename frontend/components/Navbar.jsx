import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    LogIn, LogOut, ChevronRight, Menu, X, LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';
import ProfileModal from './ProfileModal';
import UpgradeModal from './UpgradeModal';
import NavbarAccountMenu from './NavbarAccountMenu';

const MARKETING_LINKS = [
    { type: 'scroll', id: 'product-preview', label: 'Product' },
    { type: 'scroll', id: 'workflow', label: 'Workflow' },
    { type: 'scroll', id: 'features', label: 'Features' },
    { type: 'route', path: '/help', label: 'Docs' },
    { type: 'route', path: '/api-reference', label: 'API' }
];

export const Navbar = ({ isMarketingLayout = true }) => {
    const { user, isAuthenticated, logout, isSigningOut } = useAuth();
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const navRef = useRef(null);

    // Smooth scroll helper for in-page anchors
    const handleScrollTo = useCallback((elementId) => {
        const doScroll = () => {
            const el = document.getElementById(elementId);
            if (el) {
                const yOffset = -80;
                const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        };

        if (location.pathname !== '/') {
            navigate('/');
            setTimeout(doScroll, 300);
        } else {
            doScroll();
        }
    }, [location.pathname, navigate]);

    // Scroll state for subtle background solidifying
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile nav on route change
    useEffect(() => {
        setIsMobileNavOpen(false);
    }, [location.pathname]);

    return (
        <>
            <header className={`tn-navbar ${scrolled ? 'is-scrolled' : ''}`} ref={navRef}>
                <div className="tn-navbar__inner tn-container">
                    {/* Brand Logo */}
                    <div className="tn-navbar__brand">
                        <NavLink
                            to="/"
                            className="tn-brand-link"
                            onClick={(e) => {
                                if (location.pathname === '/') {
                                    e.preventDefault();
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }
                            }}
                        >
                            <div className="tn-brand-logo-box">
                                <img
                                    src="/testnexa-logo.png"
                                    alt="TestNexa AI"
                                    width="28"
                                    height="28"
                                    style={{ borderRadius: '6px', objectFit: 'cover' }}
                                />
                            </div>
                            <span className="tn-brand-title">TestNexa</span>
                        </NavLink>
                    </div>

                    {/* Center Navigation Links - Desktop */}
                    <nav className="tn-navbar__nav" aria-label="Main Navigation">
                        {MARKETING_LINKS.map((item) => {
                            if (item.type === 'scroll') {
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="tn-nav-link-btn"
                                        onClick={() => handleScrollTo(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                );
                            }
                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) => `tn-nav-link-btn ${isActive ? 'is-active' : ''}`}
                                >
                                    {item.label}
                                </NavLink>
                            );
                        })}
                    </nav>

                    {/* Right Actions */}
                    <div className="tn-navbar__actions">
                        {isAuthenticated ? (
                            <NavbarAccountMenu showHelpLink={false} />
                        ) : (
                            <div className="tn-auth-buttons-row">
                                <NavLink
                                    to="/login?returnTo=%2Fapp%2Fworkspace"
                                    className="tn-btn-nav-ghost"
                                >
                                    Sign in
                                </NavLink>

                                <a
                                    href={getTargetUrl('/app/workspace')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`tn-btn-nav-primary ${isOpening ? 'is-opening' : ''}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleWorkspaceEntry('/app/workspace');
                                    }}
                                >
                                    <span>{isOpening ? 'Opening…' : 'Get Started'}</span>
                                </a>
                            </div>
                        )}

                        {/* Mobile Hamburger Toggle */}
                        <button
                            type="button"
                            className="tn-mobile-menu-toggle"
                            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                            aria-label="Toggle navigation menu"
                            aria-expanded={isMobileNavOpen}
                        >
                            {isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Navigation Drawer Overlay */}
            {isMobileNavOpen && (
                <div
                    className="tn-mobile-drawer-overlay"
                    onClick={() => setIsMobileNavOpen(false)}
                >
                    <div
                        className="tn-mobile-drawer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="tn-mobile-drawer__header">
                            <span className="tn-brand-title">TestNexa</span>
                            <button
                                type="button"
                                className="tn-btn-icon"
                                onClick={() => setIsMobileNavOpen(false)}
                                aria-label="Close navigation"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="tn-mobile-drawer__nav">
                            {MARKETING_LINKS.map((item) => {
                                if (item.type === 'scroll') {
                                    return (
                                        <button
                                            key={`mob-${item.id}`}
                                            type="button"
                                            className="tn-mobile-link"
                                            onClick={() => {
                                                setIsMobileNavOpen(false);
                                                handleScrollTo(item.id);
                                            }}
                                        >
                                            <span>{item.label}</span>
                                            <ChevronRight size={14} className="text-muted" />
                                        </button>
                                    );
                                }
                                return (
                                    <NavLink
                                        key={`mob-${item.path}`}
                                        to={item.path}
                                        className="tn-mobile-link"
                                        onClick={() => setIsMobileNavOpen(false)}
                                    >
                                        <span>{item.label}</span>
                                        <ChevronRight size={14} className="text-muted" />
                                    </NavLink>
                                );
                            })}
                        </div>

                        <div className="tn-mobile-drawer__footer">
                            {!isAuthenticated ? (
                                <div className="tn-mobile-auth-grid">
                                    <NavLink
                                        to="/login?returnTo=%2Fapp%2Fworkspace"
                                        className="tn-btn-secondary tn-btn-secondary--full"
                                        onClick={() => setIsMobileNavOpen(false)}
                                    >
                                        <LogIn size={15} />
                                        <span>Sign In</span>
                                    </NavLink>
                                    <a
                                        href={getTargetUrl('/app/workspace')}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="tn-btn-primary tn-btn-primary--full"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setIsMobileNavOpen(false);
                                            handleWorkspaceEntry('/app/workspace');
                                        }}
                                    >
                                        <span>Get Started</span>
                                    </a>
                                </div>
                            ) : (
                                <div className="tn-mobile-auth-grid">
                                    <NavLink
                                        to="/app/workspace"
                                        className="tn-btn-primary tn-btn-primary--full"
                                        onClick={() => setIsMobileNavOpen(false)}
                                    >
                                        <LayoutDashboard size={15} />
                                        <span>Open Workspace</span>
                                    </NavLink>
                                    <button
                                        type="button"
                                        className="tn-btn-secondary tn-btn-secondary--full text-danger"
                                        onClick={async () => {
                                            setIsMobileNavOpen(false);
                                            await logout();
                                        }}
                                        disabled={isSigningOut}
                                    >
                                        <LogOut size={15} />
                                        <span>{isSigningOut ? 'Signing out…' : 'Sign Out'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
            />

            <UpgradeModal
                isOpen={isUpgradeOpen}
                onClose={() => setIsUpgradeOpen(false)}
            />
        </>
    );
};

export default Navbar;
