import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { User, LogOut, Layers, ExternalLink, Menu, X } from 'lucide-react';
import TestNexaLogo from '../TestNexaLogo';

export const HelpHeader = ({ onOpenSupport }) => {
    const [user, setUser] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        try {
            const raw = localStorage.getItem('user') || localStorage.getItem('auth_user');
            if (raw) setUser(JSON.parse(raw));
        } catch (_) {}
    }, []);

    const handleSignOut = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth_user');
        setUser(null);
        navigate('/login');
    };

    return (
        <header className="help-header-root" role="banner">
            <a href="#help-main-content" className="help-skip-link">
                Skip to content
            </a>

            <div className="help-header-container">
                <div className="help-header-left">
                    <Link to="/" className="help-header-logo-link" aria-label="Testnexa home">
                        <TestNexaLogo size={24} />
                        <span className="help-header-brand">Testnexa</span>
                    </Link>
                    <span className="help-header-divider" aria-hidden="true">/</span>
                    <Link to="/help" className="help-header-subbrand">
                        Docs
                    </Link>
                </div>

                <nav className="help-header-nav" aria-label="Documentation navigation">
                    <NavLink to="/how-it-works" className="help-nav-link">
                        Product
                    </NavLink>
                    <NavLink to="/help" className={({ isActive }) => `help-nav-link ${isActive ? 'is-active' : ''}`}>
                        Docs
                    </NavLink>
                    <NavLink to="/api-reference" className="help-nav-link">
                        API
                    </NavLink>
                    {onOpenSupport && (
                        <button
                            type="button"
                            onClick={onOpenSupport}
                            className="help-nav-link help-nav-btn-link"
                        >
                            Support
                        </button>
                    )}
                </nav>

                <div className="help-header-right">
                    {user ? (
                        <div className="help-header-user-menu">
                            <button
                                type="button"
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="help-header-avatar-btn"
                                aria-label="User account menu"
                                aria-expanded={isMenuOpen}
                            >
                                <div className="help-avatar-circle">
                                    {user.name ? user.name[0].toUpperCase() : 'U'}
                                </div>
                                <span className="help-avatar-name">{user.name || user.email?.split('@')[0]}</span>
                            </button>

                            {isMenuOpen && (
                                <div className="help-avatar-dropdown" role="menu">
                                    <div className="help-avatar-dropdown-header">
                                        <div className="help-avatar-dropdown-email">{user.email}</div>
                                        <div className="help-avatar-dropdown-role">{user.role || 'Member'}</div>
                                    </div>
                                    <Link to="/app" className="help-avatar-dropdown-item" role="menuitem">
                                        <Layers size={14} />
                                        <span>AI Workspace</span>
                                    </Link>
                                    <Link to="/app/suites" className="help-avatar-dropdown-item" role="menuitem">
                                        <span>Test Suites</span>
                                    </Link>
                                    <Link to="/app/settings" className="help-avatar-dropdown-item" role="menuitem">
                                        <User size={14} />
                                        <span>Settings</span>
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={handleSignOut}
                                        className="help-avatar-dropdown-item is-danger"
                                        role="menuitem"
                                    >
                                        <LogOut size={14} />
                                        <span>Sign out</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="help-header-auth-buttons">
                            <Link to="/login" className="help-btn-secondary help-header-btn-sm">
                                Sign in
                            </Link>
                            <Link to="/signup" className="help-btn-primary help-header-btn-sm">
                                Get started
                            </Link>
                        </div>
                    )}

                    {/* Mobile menu toggle */}
                    <button
                        type="button"
                        onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                        className="help-mobile-nav-toggle"
                        aria-label="Toggle navigation menu"
                        aria-expanded={isMobileNavOpen}
                    >
                        {isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Drawer */}
            {isMobileNavOpen && (
                <div className="help-mobile-nav-drawer" role="dialog" aria-modal="true">
                    <nav className="help-mobile-nav-links">
                        <Link to="/" className="help-mobile-nav-item" onClick={() => setIsMobileNavOpen(false)}>
                            Home
                        </Link>
                        <Link to="/help" className="help-mobile-nav-item is-active" onClick={() => setIsMobileNavOpen(false)}>
                            Documentation Hub
                        </Link>
                        <Link to="/help/resources/glossary" className="help-mobile-nav-item" onClick={() => setIsMobileNavOpen(false)}>
                            QA Glossary
                        </Link>
                        <Link to="/api-reference" className="help-mobile-nav-item" onClick={() => setIsMobileNavOpen(false)}>
                            API Reference
                        </Link>
                        {onOpenSupport && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileNavOpen(false);
                                    onOpenSupport();
                                }}
                                className="help-mobile-nav-item"
                                style={{ textAlign: 'left', background: 'none', border: 'none', color: 'inherit', width: '100%' }}
                            >
                                Contact Support
                            </button>
                        )}
                        <div className="help-mobile-nav-divider" />
                        {user ? (
                            <Link to="/app" className="help-btn-primary" onClick={() => setIsMobileNavOpen(false)}>
                                Open AI Workspace
                            </Link>
                        ) : (
                            <div className="help-mobile-auth-grid">
                                <Link to="/login" className="help-btn-secondary" onClick={() => setIsMobileNavOpen(false)}>
                                    Sign in
                                </Link>
                                <Link to="/signup" className="help-btn-primary" onClick={() => setIsMobileNavOpen(false)}>
                                    Get started
                                </Link>
                            </div>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
};

export default HelpHeader;
