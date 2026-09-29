import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Trash2, X, Plus, Clock,
    MessageSquare, Award, Menu, HelpCircle,
    Settings, Zap, LogOut, ChevronUp, ArrowRight
} from 'lucide-react';
import { useHistory } from '../hooks/useHistory';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';
import FeedbackModal from './FeedbackModal';
import UpgradeModal from './UpgradeModal';

const HistorySidebar = ({ isOpen, onClose, onOpen, onNewAnalysis }) => {
    const { history, deleteFromHistory } = useHistory();
    const { user, isAuthenticated, logout, isSigningOut } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [hoveredItem, setHoveredItem] = useState(null);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isRailProfileOpen, setIsRailProfileOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
    const navigate = useNavigate();
    const searchInputRef = useRef(null);
    const profileMenuRef = useRef(null);
    const railProfileRef = useRef(null);

    const initials = user?.name ? user.name.charAt(0) : (user?.email ? user.email.charAt(0) : 'U');

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Close profile menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
                setIsProfileMenuOpen(false);
            }
        };
        if (isProfileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isProfileMenuOpen]);

    // Close rail profile menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (railProfileRef.current && !railProfileRef.current.contains(e.target)) {
                setIsRailProfileOpen(false);
            }
        };
        if (isRailProfileOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isRailProfileOpen]);

    // Focus search input when search opens
    useEffect(() => {
        if (isSearchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchOpen]);

    const filteredHistory = history.filter(item =>
        item.feature?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.requirement?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group history by date
    const groupByDate = (items) => {
        const groups = {};
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);

        items.forEach(item => {
            const itemDate = new Date(item.date);
            let group;
            if (itemDate >= today) group = 'Today';
            else if (itemDate >= yesterday) group = 'Yesterday';
            else if (itemDate >= weekAgo) group = 'Previous 7 Days';
            else if (itemDate >= monthAgo) group = 'Previous 30 Days';
            else group = 'Older';

            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
        });
        return groups;
    };

    const groupedHistory = groupByDate(filteredHistory);
    const groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days', 'Older'];

    const handleItemClick = (item) => {
        navigate('/history', { state: { selectedId: item.id } });
    };

    const handleNewAnalysis = () => {
        if (onNewAnalysis) onNewAnalysis();
        navigate('/');
        onClose();
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        deleteFromHistory(id);
    };

    const handleSearchClick = () => {
        setIsSearchOpen(true);
    };

    const handleSearchClose = () => {
        setIsSearchOpen(false);
        setSearchQuery('');
    };

    return (
        <>
            {/* Collapsed rail - visible when sidebar is closed */}
            {!isOpen && (
                <div className="gpt-rail">
                    <div className="gpt-rail-top">
                        <button className="gpt-rail-btn" onClick={onOpen} title="Open sidebar">
                            <Menu size={20} />
                        </button>
                        <button className="gpt-rail-btn" onClick={handleNewAnalysis} title="New analysis">
                            <Plus size={18} />
                        </button>
                        <button className="gpt-rail-btn" onClick={() => { onOpen(); setTimeout(() => setIsSearchOpen(true), 300); }} title="Search history">
                            <Search size={18} />
                        </button>
                    </div>
                    {isAuthenticated && user && (
                        <div className="gpt-rail-bottom" ref={railProfileRef}>
                            <div
                                className="gpt-rail-avatar"
                                onClick={() => setIsRailProfileOpen(!isRailProfileOpen)}
                                style={{ cursor: 'pointer' }}
                            >
                                <span>{initials}</span>
                            </div>
                            {isRailProfileOpen && (
                                <div className="gpt-rail-profile-popup">
                                    <div className="gpt-profile-popup-glow" />
                                    <button className="gpt-profile-popup-item gpt-upgrade-item" onClick={() => { setIsUpgradeOpen(true); setIsRailProfileOpen(false); }}>
                                        <div className="gpt-popup-icon-wrap gpt-upgrade-icon">
                                            <Award size={14} />
                                        </div>
                                        <span>Upgrade plan</span>
                                        <ArrowRight size={14} className="gpt-popup-arrow" />
                                    </button>
                                    <button className="gpt-profile-popup-item" onClick={() => { setIsProfileModalOpen(true); setIsRailProfileOpen(false); }}>
                                        <div className="gpt-popup-icon-wrap">
                                            <Zap size={14} />
                                        </div>
                                        <span>Personalization</span>
                                    </button>
                                    <button className="gpt-profile-popup-item" onClick={() => { setIsProfileModalOpen(true); setIsRailProfileOpen(false); }}>
                                        <div className="gpt-popup-icon-wrap">
                                            <Settings size={14} />
                                        </div>
                                        <span>Settings</span>
                                    </button>
                                    <div className="gpt-profile-popup-divider" />
                                    <button className="gpt-profile-popup-item" onClick={() => { navigate('/help'); setIsRailProfileOpen(false); }}>
                                        <div className="gpt-popup-icon-wrap">
                                            <HelpCircle size={14} />
                                        </div>
                                        <span>Help</span>
                                    </button>
                                    <button className="gpt-profile-popup-item" onClick={() => { setIsFeedbackOpen(true); setIsRailProfileOpen(false); }}>
                                        <div className="gpt-popup-icon-wrap">
                                            <MessageSquare size={14} />
                                        </div>
                                        <span>Send Feedback</span>
                                    </button>
                                    <div className="gpt-profile-popup-divider" />
                                    <button 
                                        className="gpt-profile-popup-item gpt-logout-item" 
                                        disabled={isSigningOut}
                                        onClick={async () => {
                                            setIsRailProfileOpen(false);
                                            await logout();
                                        }}
                                        style={{ opacity: isSigningOut ? 0.6 : 1, cursor: isSigningOut ? 'not-allowed' : 'pointer' }}
                                    >
                                        <div className="gpt-popup-icon-wrap gpt-logout-icon">
                                            {isSigningOut ? (
                                                <div style={{
                                                    width: '12px',
                                                    height: '12px',
                                                    border: '2px solid rgba(239, 68, 68, 0.2)',
                                                    borderTopColor: '#EF4444',
                                                    borderRadius: '50%',
                                                    animation: 'spin 0.8s linear infinite'
                                                }} />
                                            ) : (
                                                <LogOut size={14} />
                                            )}
                                        </div>
                                        <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            {/* Mobile backdrop to close sidebar when clicking outside */}
            {isOpen && (
                <div 
                    className="mobile-sidebar-backdrop" 
                    onClick={onClose} 
                />
            )}
            
            {/* Full sidebar - visible when open */}
            <aside className={`gpt-sidebar ${isOpen ? 'gpt-sidebar-open' : ''}`}>
                {/* Top section: Logo + collapse button */}
                <div className="gpt-sidebar-top">
                    <div className="gpt-sidebar-logo">
                        <img src="/testnexa-logo.png" alt="TestNexa AI" width="24" height="24" style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} />
                    </div>
                    <button className="gpt-sidebar-collapse" onClick={onClose} title="Close sidebar">
                        <Menu size={20} />
                    </button>
                </div>

                {/* Menu items */}
                <div className="gpt-sidebar-menu">
                    <button className="gpt-menu-item" onClick={handleNewAnalysis}>
                        <Plus size={17} />
                        <span>New analysis</span>
                    </button>

                    {isSearchOpen ? (
                        <div className="gpt-search-active">
                            <Search size={17} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="gpt-search-input"
                            />
                            <button className="gpt-search-close" onClick={handleSearchClose}>
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <button className="gpt-menu-item" onClick={handleSearchClick}>
                            <Search size={17} />
                            <span>Search history</span>
                        </button>
                    )}

                </div>

                {/* Divider */}
                <div className="gpt-sidebar-divider" />

                {/* History list */}
                <div className="gpt-sidebar-history">
                    {filteredHistory.length > 0 ? (
                        <>
                            <div className="gpt-section-label">Your generations</div>
                            {groupOrder.map(group => {
                                if (!groupedHistory[group] || groupedHistory[group].length === 0) return null;
                                return (
                                    <div key={group} className="gpt-history-group">
                                        {groupOrder.filter(g => groupedHistory[g]?.length > 0).length > 1 && (
                                            <div className="gpt-group-label">{group}</div>
                                        )}
                                        {groupedHistory[group].map(item => (
                                            <div
                                                key={item.id}
                                                className={`gpt-history-item ${hoveredItem === item.id ? 'gpt-item-hover' : ''}`}
                                                onClick={() => handleItemClick(item)}
                                                onMouseEnter={() => setHoveredItem(item.id)}
                                                onMouseLeave={() => setHoveredItem(null)}
                                            >
                                                <span className="gpt-item-text">
                                                    {item.feature || 'Untitled'}
                                                </span>
                                                {hoveredItem === item.id && (
                                                    <button
                                                        className="gpt-item-delete"
                                                        onClick={(e) => handleDelete(e, item.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </>
                    ) : (
                        <div className="gpt-empty">
                            {searchQuery ? 'No results found' : ''}
                        </div>
                    )}
                </div>

                {/* User profile at bottom */}
                {isAuthenticated && user && (
                    <div className="gpt-sidebar-user-wrap" ref={profileMenuRef}>
                        {/* Profile Popup Menu */}
                        {isProfileMenuOpen && (
                            <div className="gpt-profile-popup">
                                <div className="gpt-profile-popup-glow" />
                                <button className="gpt-profile-popup-item gpt-upgrade-item" onClick={() => { setIsUpgradeOpen(true); setIsProfileMenuOpen(false); }}>
                                    <div className="gpt-popup-icon-wrap gpt-upgrade-icon">
                                        <Award size={14} />
                                    </div>
                                    <span>Upgrade plan</span>
                                    <ArrowRight size={14} className="gpt-popup-arrow" />
                                </button>
                                <button className="gpt-profile-popup-item" onClick={() => { setIsProfileModalOpen(true); setIsProfileMenuOpen(false); }}>
                                    <div className="gpt-popup-icon-wrap">
                                        <Zap size={14} />
                                    </div>
                                    <span>Personalization</span>
                                </button>
                                <button className="gpt-profile-popup-item" onClick={() => { setIsProfileModalOpen(true); setIsProfileMenuOpen(false); }}>
                                    <div className="gpt-popup-icon-wrap">
                                        <Settings size={14} />
                                    </div>
                                    <span>Settings</span>
                                </button>
                                <div className="gpt-profile-popup-divider" />
                                <button className="gpt-profile-popup-item" onClick={() => { navigate('/help'); onClose(); setIsProfileMenuOpen(false); }}>
                                    <div className="gpt-popup-icon-wrap">
                                        <HelpCircle size={14} />
                                    </div>
                                    <span>Help</span>
                                </button>
                                <button className="gpt-profile-popup-item" onClick={() => { setIsFeedbackOpen(true); setIsProfileMenuOpen(false); }}>
                                    <div className="gpt-popup-icon-wrap">
                                        <MessageSquare size={14} />
                                    </div>
                                    <span>Send Feedback</span>
                                </button>
                                <div className="gpt-profile-popup-divider" />
                                <button 
                                    className="gpt-profile-popup-item gpt-logout-item" 
                                    disabled={isSigningOut}
                                    onClick={async () => {
                                        setIsProfileMenuOpen(false);
                                        await logout();
                                    }}
                                    style={{ opacity: isSigningOut ? 0.6 : 1, cursor: isSigningOut ? 'not-allowed' : 'pointer' }}
                                >
                                    <div className="gpt-popup-icon-wrap gpt-logout-icon">
                                        {isSigningOut ? (
                                            <div style={{
                                                width: '12px',
                                                height: '12px',
                                                border: '2px solid rgba(239, 68, 68, 0.2)',
                                                borderTopColor: '#EF4444',
                                                borderRadius: '50%',
                                                animation: 'spin 0.8s linear infinite'
                                            }} />
                                        ) : (
                                            <LogOut size={14} />
                                        )}
                                    </div>
                                    <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
                                </button>
                            </div>
                        )}
                        <div
                            className={`gpt-sidebar-user ${isProfileMenuOpen ? 'gpt-sidebar-user-active' : ''}`}
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        >
                            <div className="gpt-user-avatar">
                                <span>{initials}</span>
                            </div>
                            <div className="gpt-user-info">
                                <span className="gpt-user-name">{user?.name || 'User'}</span>
                            </div>
                            <ChevronUp size={16} className={`gpt-user-chevron ${isProfileMenuOpen ? 'gpt-chevron-active' : ''}`} />
                        </div>
                    </div>
                )}
            </aside>

            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />

            <FeedbackModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
            />

            <UpgradeModal
                isOpen={isUpgradeOpen}
                onClose={() => setIsUpgradeOpen(false)}
            />
        </>
    );
};

export default HistorySidebar;
