import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    ChevronDown,
    Layers,
    Settings,
    User,
    Sliders,
    CreditCard,
    Shield,
    HelpCircle,
    LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/NavbarAccountMenu.css';

const NavbarAccountMenu = ({ showHelpLink = true }) => {
    const { user, logout, isSigningOut } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [localAvatar, setLocalAvatar] = useState(() => localStorage.getItem('testnexa_avatar_url') || null);
    const containerRef = useRef(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const navigate = useNavigate();

    // Listen for local avatar updates from profile settings
    useEffect(() => {
        const handleAvatarUpdate = () => {
            setLocalAvatar(localStorage.getItem('testnexa_avatar_url'));
        };
        window.addEventListener('avatarUpdated', handleAvatarUpdate);
        return () => window.removeEventListener('avatarUpdated', handleAvatarUpdate);
    }, []);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    // Close on Escape & Arrow key navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                setIsOpen(false);
                triggerRef.current?.focus();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)');
                if (!items || items.length === 0) return;

                const activeElement = document.activeElement;
                const currentIndex = Array.from(items).indexOf(activeElement);

                if (e.key === 'ArrowDown') {
                    const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                    items[nextIndex]?.focus();
                } else {
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                    items[prevIndex]?.focus();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleNavigate = useCallback((to) => {
        setIsOpen(false);
        navigate(to);
    }, [navigate]);

    const handleLogout = useCallback(async () => {
        setIsOpen(false);
        await logout();
    }, [logout]);

    const displayName = user?.name || user?.displayName || (user?.email ? user.email.split('@')[0] : 'User');
    const displayEmail = user?.email || 'user@example.com';
    const avatarSrc = user?.avatar || localAvatar || null;
    const initials = (displayName || 'U').charAt(0).toUpperCase();
    const userPlan = user?.plan ? `${user.plan.toUpperCase()} WORKSPACE` : 'PRO WORKSPACE';

    return (
        <div className="navbar-account-container" ref={containerRef}>
            {/* 2. Recommended: [navbar content...] [Help] [Avatar] [Chevron] */}
            {showHelpLink && (
                <NavLink
                    to="/help"
                    className="navbar-help-btn"
                    title="Help & Documentation"
                    aria-label="Help & Documentation"
                >
                    <HelpCircle size={16} />
                </NavLink>
            )}

            {/* Avatar Trigger */}
            <button
                ref={triggerRef}
                type="button"
                className={`navbar-avatar-btn ${isOpen ? 'is-open' : ''}`}
                onClick={() => setIsOpen(prev => !prev)}
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={isOpen}
            >
                <div className="navbar-avatar-box">
                    {avatarSrc ? (
                        <img src={avatarSrc} alt={displayName} className="navbar-avatar-img" />
                    ) : (
                        <span className="navbar-avatar-text">{initials}</span>
                    )}
                </div>
                <ChevronDown
                    size={14}
                    className={`navbar-chevron ${isOpen ? 'is-open' : ''}`}
                />
            </button>

            {/* Account Dropdown */}
            {isOpen && (
                <div
                    ref={menuRef}
                    className="navbar-account-dropdown"
                    role="menu"
                    aria-label="Account menu"
                >
                    {/* Header: User Info */}
                    <div className="account-dropdown-header">
                        <div className="account-dropdown-avatar">
                            {avatarSrc ? (
                                <img src={avatarSrc} alt={displayName} className="navbar-avatar-img" />
                            ) : (
                                <span>{initials}</span>
                            )}
                        </div>
                        <div className="account-dropdown-user-info">
                            <div className="account-dropdown-name" title={displayName}>
                                {displayName}
                            </div>
                            <div className="account-dropdown-email" title={displayEmail}>
                                {displayEmail}
                            </div>
                            <div className="account-dropdown-plan">
                                {userPlan}
                            </div>
                        </div>
                    </div>

                    <div className="account-dropdown-divider" />

                    {/* Section: Workspace */}
                    <div className="account-dropdown-section">
                        <div className="account-dropdown-section-label">Workspace</div>
                        <button
                            type="button"
                            role="menuitem"
                            className="account-dropdown-item"
                            onClick={() => handleNavigate('/app/workspace')}
                        >
                            <Layers size={16} className="account-dropdown-icon" />
                            <span>AI Workspace</span>
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="account-dropdown-item"
                            onClick={() => handleNavigate('/app/settings?tab=workspace')}
                        >
                            <Settings size={16} className="account-dropdown-icon" />
                            <span>Workspace Settings</span>
                        </button>
                    </div>

                    <div className="account-dropdown-divider" />

                    {/* Section: Account */}
                    <div className="account-dropdown-section">
                        <div className="account-dropdown-section-label">Account</div>
                        <button
                            type="button"
                            role="menuitem"
                            className="account-dropdown-item"
                            onClick={() => handleNavigate('/app/settings?tab=profile')}
                        >
                            <User size={16} className="account-dropdown-icon" />
                            <span>Profile</span>
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="account-dropdown-item"
                            onClick={() => handleNavigate('/app/settings?tab=preferences')}
                        >
                            <Sliders size={16} className="account-dropdown-icon" />
                            <span>Preferences</span>
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="account-dropdown-item"
                            onClick={() => handleNavigate('/app/settings?tab=billing')}
                        >
                            <CreditCard size={16} className="account-dropdown-icon" />
                            <span>Billing & Usage</span>
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="account-dropdown-item"
                            onClick={() => handleNavigate('/app/settings?tab=security')}
                        >
                            <Shield size={16} className="account-dropdown-icon" />
                            <span>Security</span>
                        </button>
                    </div>

                    <div className="account-dropdown-divider" />

                    {/* Help & Docs */}
                    <button
                        type="button"
                        role="menuitem"
                        className="account-dropdown-item"
                        onClick={() => handleNavigate('/help')}
                    >
                        <HelpCircle size={16} className="account-dropdown-icon" />
                        <span>Help & Docs</span>
                    </button>

                    <div className="account-dropdown-divider" />

                    {/* Centralized Sign Out */}
                    <button
                        type="button"
                        role="menuitem"
                        className="account-dropdown-item account-dropdown-item--logout"
                        onClick={handleLogout}
                        disabled={isSigningOut}
                    >
                        {isSigningOut ? (
                            <div className="account-dropdown-spinner" />
                        ) : (
                            <LogOut size={16} className="account-dropdown-icon" />
                        )}
                        <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default NavbarAccountMenu;
