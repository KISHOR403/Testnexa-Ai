import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    HelpCircle, LogIn, LogOut, Sparkles,
    ChevronDown, ChevronRight, Settings, MessageSquare,
    FileText, Download, Keyboard, Zap,
    ArrowRight, Menu
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
    const [activeSubMenu, setActiveSubMenu] = useState(null);
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

    return (
        <>
            <nav className={`floating-navbar ${scrolled ? 'floating-navbar-scrolled' : ''}`} ref={navRef}>
                <div className="navbar-left-group">
                    <button className="sidebar-toggle-btn mobile-only" onClick={onToggleSidebar}>
                        <Menu size={20} />
                    </button>
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

                {/* Center Nav Links */}
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
                                <div className="navbar-avatar">
                                    <span className="avatar-letter">{initials}</span>
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
                                            <div className="dropdown-profile-card">
                                                <div className="profile-card-avatar">
                                                    <span>{initials}</span>
                                                </div>
                                                <div className="profile-card-info">
                                                    <span className="profile-card-name">{user?.name || user?.displayName || user?.email?.split('@')[0] || 'User'}</span>
                                                    <span className="profile-card-email">{user?.email || 'user@example.com'}</span>
                                                </div>
                                                <div className="profile-card-badge">Pro</div>
                                            </div>

                                            <div className="dropdown-separator" />

                                            <button className="dropdown-action upgrade-action" onClick={(e) => { e.stopPropagation(); setIsUpgradeOpen(true); setIsDropdownOpen(false); }}>
                                                <div className="action-icon-wrap upgrade-icon-wrap">
                                                    <Sparkles size={14} />
                                                </div>
                                                <span>Upgrade plan</span>
                                                <ArrowRight size={14} className="action-arrow" />
                                            </button>

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
                        <NavLink to="/login" className="floating-nav-cta">
                            Get Started
                        </NavLink>
                    )}
                </div>
            </nav>

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
