import React from 'react';
import { X, History, LogOut, User, Mail, Shield, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';

const ProfileModal = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const { settings, toggleSetting } = useSettings();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = React.useState('profile');

    if (!isOpen || !user) return null;

    const initials = (user?.name || user?.displayName || user?.email || '?').charAt(0);

    const handleHistoryClick = () => {
        navigate('/history');
        onClose();
    };

    const handleLogout = () => {
        logout();
        onClose();
        navigate('/');
    };

    return (
        <div className="profile-overlay" onClick={onClose}>
            <div
                className="profile-card animate-spring-up"
                onClick={(e) => e.stopPropagation()}
                style={{ minHeight: '520px' }}
            >
                <button className="profile-close" onClick={onClose}>
                    <X size={20} />
                </button>

                {/* Tab Navigation */}
                <div className="modal-tabs">
                    <button
                        className={`modal-tab ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <User size={16} />
                        <span>Profile</span>
                    </button>
                    <button
                        className={`modal-tab ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        <Shield size={16} />
                        <span>Settings</span>
                    </button>
                </div>

                {activeTab === 'profile' ? (
                    <div className="tab-content animate-fade-in">
                        <div className="profile-header">
                            <div className="profile-avatar-large">
                                {initials}
                            </div>
                            <div className="provider-badge">
                                <Shield size={14} />
                                <span>{user.provider || 'Email'} Auth</span>
                            </div>
                        </div>

                        <div className="profile-info">
                            <div className="info-row">
                                <span className="info-label">Full Name</span>
                                <div className="info-value">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <User size={16} color="#718096" />
                                        <span>{user.name || user.displayName || user.email || 'Unnamed User'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="info-row">
                                <span className="info-label">Email Address</span>
                                <div className="info-value">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Mail size={16} color="#718096" />
                                        <span>{user.email}</span>
                                    </div>
                                </div>
                            </div>

                            {user.createdAt && (
                                <div className="info-row">
                                    <span className="info-label">Member Since</span>
                                    <div className="info-value">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <Clock size={16} color="#718096" />
                                            <span>{new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {user.lastLogin && (
                                <div className="info-row">
                                    <span className="info-label">Last Login</span>
                                    <div className="info-value">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <History size={16} color="#718096" />
                                            <span>{new Date(user.lastLogin).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="profile-stats-grid">
                            <div className="stat-card">
                                <span className="stat-value">{user.totalTestsGenerated || 0}</span>
                                <span className="stat-label">Tests Generated</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{user.loginCount || 1}</span>
                                <span className="stat-label">Total Logins</span>
                            </div>
                        </div>

                        <div className="profile-actions">
                            <button className="profile-btn secondary" onClick={handleHistoryClick}>
                                <History size={18} />
                                <span>History</span>
                            </button>
                            <button className="profile-btn secondary logout" onClick={handleLogout}>
                                <LogOut size={18} />
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="tab-content animate-fade-in">
                        <div className="settings-list">
                            <div className="settings-group">
                                <h4 className="settings-group-title">Appearance</h4>
                                <div className="setting-item" onClick={() => toggleSetting('aiGlow')}>
                                    <div className="setting-info">
                                        <span className="setting-name">AI Glow Effects</span>
                                        <span className="setting-desc">Enable premium neon glow animations</span>
                                    </div>
                                    <div className={`setting-toggle ${settings.aiGlow ? 'on' : ''}`} />
                                </div>
                                <div className="setting-item" onClick={() => toggleSetting('highContrast')}>
                                    <div className="setting-info">
                                        <span className="setting-name">High Contrast</span>
                                        <span className="setting-desc">Sharper borders for better visibility</span>
                                    </div>
                                    <div className={`setting-toggle ${settings.highContrast ? 'on' : ''}`} />
                                </div>
                            </div>

                            <div className="settings-group">
                                <h4 className="settings-group-title">Preferences</h4>
                                <div className="setting-item" onClick={() => toggleSetting('notifications')}>
                                    <div className="setting-info">
                                        <span className="setting-name">Desktop Notifications</span>
                                        <span className="setting-desc">Get alerted when analysis completes</span>
                                    </div>
                                    <div className={`setting-toggle ${settings.notifications ? 'on' : ''}`} />
                                </div>
                                <div className="setting-item" onClick={() => toggleSetting('compactMode')}>
                                    <div className="setting-info">
                                        <span className="setting-name">Compact Mode</span>
                                        <span className="setting-desc">Reduce whitespace in requirements panel</span>
                                    </div>
                                    <div className={`setting-toggle ${settings.compactMode ? 'on' : ''}`} />
                                </div>
                            </div>
                        </div>

                        <div className="profile-actions" style={{ marginTop: 'auto' }}>
                            <p className="settings-disclaimer">Settings are saved locally to this browser.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileModal;
