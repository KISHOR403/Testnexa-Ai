import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    HelpCircle, LogIn, LogOut,
    ChevronDown, ChevronRight, Settings, MessageSquare,
    FileText, Download, Keyboard, Zap,
    ArrowRight, Menu, X, LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';
import UpgradeModal from './UpgradeModal';

const NAV_SECTIONS = [
    { id: 'features', label: 'Features' },
    { id: 'problem-vs-solution', label: 'Solutions' },
    { id: 'engineering-maturity', label: 'How It Works' },
    { id: 'who-is-this-for', label: 'Audience' },
    { id: 'why-this-matters', label: 'Why Us' },
];

const Navbar = ({ isSidebarOpen, onToggleSidebar, onNewAnalysis }) => {
    const { user, isAuthenticated, logout } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [activeSubMenu, setActiveSubMenu] = useState(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [activeSection, setActiveSection] = useState('');
    const [localAvatar, setLocalAvatar] = useState(() => localStorage.getItem('testnexa_avatar_url') || null);
    const location = useLocation();
    const navigate = useNavigate();
    const navRef = useRef(null);

    useEffect(() => {
        const handleAvatarUpdate = () => {
            setLocalAvatar(localStorage.getItem('testnexa_avatar_url'));
        };
        window.addEventListener('avatarUpdated', handleAvatarUpdate);
        return () => window.removeEventListener('avatarUpdated', handleAvatarUpdate);
    }, []);

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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (navRef.current && !navRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
                setActiveSubMenu(null);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isDropdownOpen]);

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
                        <div className="navbar-user-section">
                            <button
                                className="navbar-avatar-trigger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDropdownOpen(!isDropdownOpen);
                                }}
                            >
                                <div className="navbar-avatar-wrapper">
                                    <div className="navbar-avatar">
                                        {localAvatar ? (
                                            <img src={localAvatar} alt="avatar" className="navbar-avatar-img" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }} />
                                        ) : (
                                            <span className="avatar-letter">{initials}</span>
                                        )}
                                        <span className="avatar-status-dot"></span>
                                    </div>
                                </div>
                                <ChevronDown
                                    size={13}
                                    className={`avatar-chevron ${isDropdownOpen ? 'chevron-flipped' : ''}`}
                                />
                            </button>

                            {isDropdownOpen && (
                                <div className="navbar-dropdown" onClick={(e) => e.stopPropagation()}>
                                    <div className="dropdown-glow-effect" />
                                    {activeSubMenu === null ? (
                                        <>
                                            <div className="dropdown-profile-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'stretch' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                    <div className="profile-card-avatar">
                                                        {localAvatar ? (
                                                            <img src={localAvatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <span>{initials}</span>
                                                        )}
                                                    </div>
                                                    <div className="profile-card-info" style={{ flex: 1, minWidth: 0 }}>
                                                        <span className="profile-card-name" style={{ display: 'block' }}>{user?.name || user?.displayName || user?.email?.split('@')[0] || 'User'}</span>
                                                        <span className="profile-card-email" style={{ display: 'block' }}>{user?.email || 'user@example.com'}</span>
                                                    </div>
                                                    <div className="profile-card-badge">Pro</div>
                                                </div>
                                                <div className="dropdown-usage-container" style={{ marginTop: '0.15rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.2rem' }}>
                                                        <span>Generations</span>
                                                        <span style={{ color: '#00f2de', fontWeight: '600' }}>342 / 1000</span>
                                                    </div>
                                                    <div className="dropdown-usage-bar" style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <div className="dropdown-usage-progress" style={{ width: '34.2%', height: '100%', background: '#00D9C0', borderRadius: '2px' }} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="dropdown-separator" />

                                            <button className="dropdown-action upgrade-action" onClick={(e) => { e.stopPropagation(); setIsUpgradeOpen(true); setIsDropdownOpen(false); }}>
                                                <div className="action-icon-wrap upgrade-icon-wrap">
                                                    <Zap size={14} />
                                                </div>
                                                <span>Upgrade plan</span>
                                                <ArrowRight size={14} className="action-arrow" />
                                            </button>

                                            <NavLink to="/app/workspace" className="dropdown-action" onClick={() => setIsDropdownOpen(false)} style={{ textDecoration: 'none' }}>
                                                <div className="action-icon-wrap">
                                                    <LayoutDashboard size={14} />
                                                </div>
                                                <span>AI Workspace</span>
                                            </NavLink>

                                            <button className="dropdown-action" onClick={(e) => { e.stopPropagation(); setIsProfileOpen(true); setIsDropdownOpen(false); }}>
                                                <div className="action-icon-wrap">
                                                    <Zap size={14} />
                                                </div>
                                                <span>Personalization</span>
                                            </button>

                                            <button className="dropdown-action" onClick={(e) => { e.stopPropagation(); setIsProfileOpen(true); setIsDropdownOpen(false); }}>
                                                <div className="action-icon-wrap">
                                                    <Settings size={14} />
                                                </div>
                                                <span>Settings</span>
                                            </button>

                                            <div className="dropdown-separator" />

                                            <button
                                                className="dropdown-action has-submenu"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveSubMenu('help');
                                                }}
                                            >
                                                <div className="action-icon-wrap">
                                                    <HelpCircle size={14} />
                                                </div>
                                                <span>Help</span>
                                                <ChevronRight size={13} className="action-arrow" />
                                            </button>

                                            <button className="dropdown-action logout-action" onClick={logout}>
                                                <div className="action-icon-wrap logout-icon-wrap">
                                                    <LogOut size={14} />
                                                </div>
                                                <span>Log out</span>
                                            </button>
                                        </>
                                    ) : activeSubMenu === 'help' ? (
                                        <div className="submenu-panel">
                                            <button className="submenu-back-btn" onClick={(e) => { e.stopPropagation(); setActiveSubMenu(null); }}>
                                                <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
                                                <span>Help</span>
                                            </button>
                                            <div className="dropdown-separator" />
                                            <button className="dropdown-action" onClick={() => { navigate('/help'); setIsDropdownOpen(false); setActiveSubMenu(null); }}>
                                                <div className="action-icon-wrap"><HelpCircle size={14} /></div>
                                                <span>Help center</span>
                                            </button>
                                            <button className="dropdown-action" onClick={() => { navigate('/best-practices'); setIsDropdownOpen(false); setActiveSubMenu(null); }}>
                                                <div className="action-icon-wrap"><Zap size={14} /></div>
                                                <span>Release notes</span>
                                            </button>
                                            <button className="dropdown-action" onClick={() => { navigate('/terms'); setIsDropdownOpen(false); setActiveSubMenu(null); }}>
                                                <div className="action-icon-wrap"><FileText size={14} /></div>
                                                <span>Terms & policies</span>
                                            </button>
                                            <button className="dropdown-action" onClick={() => { navigate('/contact'); setIsDropdownOpen(false); setActiveSubMenu(null); }}>
                                                <div className="action-icon-wrap"><MessageSquare size={14} /></div>
                                                <span>Report Bug</span>
                                            </button>
                                            <button className="dropdown-action" onClick={() => { navigate('/about'); setIsDropdownOpen(false); setActiveSubMenu(null); }}>
                                                <div className="action-icon-wrap"><Download size={14} /></div>
                                                <span>About Us</span>
                                            </button>
                                            <button className="dropdown-action" onClick={() => { navigate('/privacy'); setIsDropdownOpen(false); setActiveSubMenu(null); }}>
                                                <div className="action-icon-wrap"><Keyboard size={14} /></div>
                                                <span>Privacy Policy</span>
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    ) : (
                        <NavLink
                            to="/app/workspace"
                            className="floating-nav-cta"
                        >
                            Get Started
                        </NavLink>
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
                            <NavLink
                                to="/app/workspace"
                                className="floating-mobile-primary-btn"
                                onClick={() => setIsMobileNavOpen(false)}
                            >
                                <LayoutDashboard size={16} />
                                <span>Open Workspace</span>
                            </NavLink>

                            {!isAuthenticated ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <NavLink
                                        to="/login"
                                        className="floating-mobile-secondary-btn"
                                        onClick={() => setIsMobileNavOpen(false)}
                                    >
                                        <LogIn size={15} />
                                        <span>Sign In</span>
                                    </NavLink>
                                    <NavLink
                                        to="/signup"
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
                                        onClick={() => {
                                            setIsMobileNavOpen(false);
                                            logout();
                                        }}
                                        style={{ color: '#ef4444' }}
                                    >
                                        <LogOut size={15} />
                                        <span>Log Out</span>
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
