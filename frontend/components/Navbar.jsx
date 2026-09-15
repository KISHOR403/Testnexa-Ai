import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    HelpCircle, LogIn, LogOut,
    ChevronDown, ChevronRight, Settings, MessageSquare,
    FileText, Download, Keyboard, Zap,
    ArrowRight, Menu, X, LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';
import ProfileModal from './ProfileModal';
import UpgradeModal from './UpgradeModal';
import NavbarAccountMenu from './NavbarAccountMenu';

const NAV_SECTIONS = [
    { id: 'features', label: 'Features' },
    { id: 'problem-vs-solution', label: 'Solutions' },
    { id: 'engineering-maturity', label: 'How It Works' },
    { id: 'who-is-this-for', label: 'Audience' },
    { id: 'why-this-matters', label: 'Why Us' },
];

const Navbar = ({ isSidebarOpen, onToggleSidebar, onNewAnalysis }) => {
    const { user, isAuthenticated, logout, isSigningOut } = useAuth();
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [activeSection, setActiveSection] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    const navRef = useRef(null);

    // Scroll to a section, navigating to home first if needed
    const scrollToSection = useCallback((sectionId) => {
        const doScroll = () => {
            const el = document.getElementById(sectionId);
            if (el) {
                const yOffset = -100;
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

    // Track active section via IntersectionObserver
    useEffect(() => {
        const sectionIds = [...new Set(NAV_SECTIONS.map(s => s.id))];
        const observers = [];
        const visibleSections = new Set();

        const handleIntersect = (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    visibleSections.add(entry.target.id);
                } else {
                    visibleSections.delete(entry.target.id);
                }
            });

            if (visibleSections.size === 0) {
                setActiveSection('');
            } else {
                // Pick the first visible section in DOM order
                const first = sectionIds.find(id => visibleSections.has(id));
                if (first) setActiveSection(first);
            }
        };

        sectionIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const observer = new IntersectionObserver(handleIntersect, {
                    rootMargin: '-30% 0px -60% 0px',
                    threshold: 0,
                });
                observer.observe(el);
                observers.push(observer);
            }
        });

        return () => observers.forEach(o => o.disconnect());
    }, [location.pathname]);

    const initials = (user?.name || user?.displayName || user?.email || 'U').charAt(0);

    // Scroll detection for navbar style change
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
            <nav className={`floating-navbar ${scrolled ? 'floating-navbar-scrolled' : ''}`} ref={navRef}>
                <div className="navbar-left-group">
                    {/* Logo */}
                    <NavLink to="/" className="floating-nav-logo" onClick={(e) => {
                        if (location.pathname === '/') {
                            e.preventDefault();
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }}>
                    <div className="floating-logo-icon">
                        <img src="/testnexa-logo.png" alt="Testnexa AI" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                    </div>
                    <div className="floating-logo-text">
                        <span className="floating-logo-brand">Testnexa</span>
                        <span className="floating-logo-sub">AI Test Generator</span>
                    </div>
                    </NavLink>
                </div>

                {/* Center Nav Links - Desktop */}
                <div className="floating-nav-links">
                    {NAV_SECTIONS.map((section, index) => (
                        <button
                            key={`${section.id}-${index}`}
                            className={`floating-nav-link ${activeSection === section.id ? 'floating-nav-link-active' : ''}`}
                            onClick={() => scrollToSection(section.id)}
                        >
                            {section.label}
                        </button>
                    ))}
                </div>

                {/* Right Actions */}
                <div className="floating-nav-actions">
                    {isAuthenticated ? (
                        <NavbarAccountMenu showHelpLink={true} />
                    ) : (
                        <a
                            href={getTargetUrl('/app/workspace')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="floating-nav-cta"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                        >
                            {isOpening ? 'Opening…' : 'Get Started'}
                        </a>
                    )}

                    {/* Mobile Hamburger Toggle */}
                    <button
                        type="button"
                        className="floating-nav-mobile-toggle"
                        onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                        aria-label="Toggle mobile menu"
                        aria-expanded={isMobileNavOpen}
                    >
                        {isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Navigation Drawer Overlay */}
            {isMobileNavOpen && (
                <div
                    className="floating-mobile-menu-overlay"
                    onClick={() => setIsMobileNavOpen(false)}
                >
                    <div
                        className="floating-mobile-menu-card"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="floating-mobile-menu-header">
                            <div className="floating-logo-text">
                                <span className="floating-logo-brand">Navigation</span>
                            </div>
                            <button
                                type="button"
                                className="floating-mobile-close-btn"
                                onClick={() => setIsMobileNavOpen(false)}
                                aria-label="Close navigation"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="floating-mobile-nav-list">
                            {NAV_SECTIONS.map((section, index) => (
                                <button
                                    key={`mob-${section.id}-${index}`}
                                    className={`floating-mobile-nav-item ${activeSection === section.id ? 'is-active' : ''}`}
                                    onClick={() => {
                                        scrollToSection(section.id);
                                        setIsMobileNavOpen(false);
                                    }}
                                >
                                    <span>{section.label}</span>
                                    <ChevronRight size={14} style={{ opacity: 0.5 }} />
                                </button>
                            ))}
                        </div>

                        <div className="floating-mobile-menu-divider" />

                        <div className="floating-mobile-actions">
                            <a
                                href={getTargetUrl('/app/workspace')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="floating-mobile-primary-btn"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setIsMobileNavOpen(false);
                                    handleWorkspaceEntry('/app/workspace');
                                }}
                            >
                                <LayoutDashboard size={16} />
                                <span>{isOpening ? 'Opening…' : 'Open Workspace'}</span>
                            </a>

                            {!isAuthenticated ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <NavLink
                                        to="/login?returnTo=%2Fapp%2Fworkspace"
                                        className="floating-mobile-secondary-btn"
                                        onClick={() => setIsMobileNavOpen(false)}
                                    >
                                        <LogIn size={15} />
                                        <span>Sign In</span>
                                    </NavLink>
                                    <NavLink
                                        to="/signup?returnTo=%2Fapp%2Fworkspace"
                                        className="floating-mobile-secondary-btn"
                                        onClick={() => setIsMobileNavOpen(false)}
                                    >
                                        <span>Sign Up</span>
                                    </NavLink>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                                    <NavLink
                                        to="/app/test-suites"
                                        className="floating-mobile-secondary-btn"
                                        onClick={() => setIsMobileNavOpen(false)}
                                    >
                                        <span>All Test Suites</span>
                                    </NavLink>
                                    <button
                                        type="button"
                                        className="floating-mobile-secondary-btn"
                                        onClick={async () => {
                                            setIsMobileNavOpen(false);
                                            await logout();
                                        }}
                                        disabled={isSigningOut}
                                        style={{ color: '#ef4444', opacity: isSigningOut ? 0.6 : 1, cursor: isSigningOut ? 'not-allowed' : 'pointer' }}
                                    >
                                        {isSigningOut ? (
                                            <div style={{
                                                width: '14px',
                                                height: '14px',
                                                border: '2px solid rgba(239, 68, 68, 0.2)',
                                                borderTopColor: '#EF4444',
                                                borderRadius: '50%',
                                                animation: 'spin 0.8s linear infinite'
                                            }} />
                                        ) : (
                                            <LogOut size={15} />
                                        )}
                                        <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
                                    </button>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '0.85rem' }}>
                                <NavLink
                                    to="/help"
                                    className="floating-mobile-link"
                                    onClick={() => setIsMobileNavOpen(false)}
                                >
                                    Help
                                </NavLink>
                                <NavLink
                                    to="/terms"
                                    className="floating-mobile-link"
                                    onClick={() => setIsMobileNavOpen(false)}
                                >
                                    Terms
                                </NavLink>
                                <NavLink
                                    to="/privacy"
                                    className="floating-mobile-link"
                                    onClick={() => setIsMobileNavOpen(false)}
                                >
                                    Privacy
                                </NavLink>
                            </div>
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
