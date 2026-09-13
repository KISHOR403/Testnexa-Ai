import React, { useState, useEffect, useRef } from 'react';
import { 
    X, History, LogOut, User, Mail, Shield, Clock, Camera,
    CreditCard, ShieldAlert, Check, Loader2, FileText, Globe, 
    Download, Trash2, Award, AlertTriangle, Key, Smartphone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';

const ProfileModal = ({ isOpen, onClose }) => {
    const { user, logout, isSigningOut } = useAuth();
    const { settings, saveSettingsToServer } = useSettings();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('profile');
    
    // Avatar upload states
    const [localAvatar, setLocalAvatar] = useState(() => localStorage.getItem('testnexa_avatar_url') || null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Settings local buffer states
    const [localSettings, setLocalSettings] = useState(() => ({ ...settings }));
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [showSavedFeedback, setShowSavedFeedback] = useState(false);

    // Account form states
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordStatus, setPasswordStatus] = useState(null); // 'loading', 'success', 'error'
    const [passwordMessage, setPasswordMessage] = useState('');

    // 2FA states
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [show2FASetup, setShow2FASetup] = useState(false);

    // GDPR Export states
    const [exportStatus, setExportStatus] = useState(null); // 'loading', 'success'

    // Reset forms and sync settings when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalSettings({ ...settings });
            setLocalAvatar(localStorage.getItem('testnexa_avatar_url') || null);
            setPasswordStatus(null);
            setPasswordMessage('');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setExportStatus(null);
        }
    }, [isOpen, settings]);

    if (!isOpen || !user) return null;

    const initials = (user?.name || user?.displayName || user?.email || '?').charAt(0);

    const handleHistoryClick = () => {
        navigate('/history');
        onClose();
    };

    const handleLogout = async () => {
        onClose();
        await logout();
    };

    // Avatar image upload handler
    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Convert to base64 for local storage persistence
        const reader = new FileReader();
        reader.onloadstart = () => {
            setIsUploading(true);
        };
        reader.onloadend = () => {
            setTimeout(() => {
                const base64String = reader.result;
                localStorage.setItem('testnexa_avatar_url', base64String);
                setLocalAvatar(base64String);
                setIsUploading(false);
                // Dispatch event to sync other components
                window.dispatchEvent(new Event('avatarUpdated'));
            }, 1200); // Simulate network upload time
        };
        reader.readAsDataURL(file);
    };

    // Settings save/cancel
    const handleSettingChange = (key, value) => {
        setLocalSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleTestMixChange = (type) => {
        setLocalSettings(prev => ({
            ...prev,
            defaultTestMix: {
                ...prev.defaultTestMix,
                [type]: !prev.defaultTestMix[type]
            }
        }));
    };

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        await saveSettingsToServer(localSettings);
        setIsSavingSettings(false);
        setShowSavedFeedback(true);
        setTimeout(() => {
            setShowSavedFeedback(false);
        }, 2000);
    };

    const handleCancelSettings = () => {
        setLocalSettings({ ...settings });
    };

    // Password reset update
    const handlePasswordUpdate = (e) => {
        e.preventDefault();
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordStatus('error');
            setPasswordMessage('All password fields are required.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordStatus('error');
            setPasswordMessage('New password confirmation does not match.');
            return;
        }
        if (newPassword.length < 8) {
            setPasswordStatus('error');
            setPasswordMessage('New password must be at least 8 characters.');
            return;
        }

        setPasswordStatus('loading');
        setTimeout(() => {
            setPasswordStatus('success');
            setPasswordMessage('Password updated successfully.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }, 1000);
    };

    // GDPR Export trigger
    const handleDataExport = () => {
        setExportStatus('loading');
        setTimeout(() => {
            // Mock data structure
            const mockUserData = {
                account: {
                    id: user.id || user._id,
                    name: user.name,
                    email: user.email,
                    registeredAt: user.createdAt || new Date().toISOString(),
                    plan: 'PRO'
                },
                exportTimestamp: new Date().toISOString(),
                preferences: settings,
                usageStatistics: {
                    totalTestsGenerated: user.totalTestsGenerated || 342,
                    loginCount: user.loginCount || 24
                }
            };
            
            // Trigger browser download
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mockUserData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `testnexa_profile_export_${user.email.split('@')[0]}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();

            setExportStatus('success');
            setTimeout(() => setExportStatus(null), 2500);
        }, 1500);
    };

    // 2FA toggler setup
    const handle2FAToggle = () => {
        if (is2FAEnabled) {
            setIs2FAEnabled(false);
            setShow2FASetup(false);
        } else {
            setShow2FASetup(true);
        }
    };

    const confirm2FASetup = () => {
        setIs2FAEnabled(true);
        setShow2FASetup(false);
    };

    return (
        <div className="profile-overlay" onClick={onClose}>
            <div
                className="profile-card animate-spring-up modal-layout-expanded"
                onClick={(e) => e.stopPropagation()}
            >
                <button className="profile-close" onClick={onClose}>
                    <X size={20} />
                </button>

                {/* Sidebar Navigation */}
                <div className="modal-sidebar">
                    <div className="modal-sidebar-title">Account Center</div>
                    <div className="modal-tabs-vertical">
                        <button
                            className={`modal-tab-v ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => setActiveTab('profile')}
                        >
                            <User size={16} />
                            <span>My Profile</span>
                        </button>
                        <button
                            className={`modal-tab-v ${activeTab === 'settings' ? 'active' : ''}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            <Shield size={16} />
                            <span>Preferences</span>
                        </button>
                        <button
                            className={`modal-tab-v ${activeTab === 'billing' ? 'active' : ''}`}
                            onClick={() => setActiveTab('billing')}
                        >
                            <CreditCard size={16} />
                            <span>Billing & Subscription</span>
                        </button>
                        <button
                            className={`modal-tab-v ${activeTab === 'account' ? 'active' : ''}`}
                            onClick={() => setActiveTab('account')}
                        >
                            <ShieldAlert size={16} />
                            <span>Security & Account</span>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="modal-body-content">
                    {activeTab === 'profile' && (
                        <div className="tab-content animate-fade-in">
                            <div className="profile-header-new">
                                <div className="profile-avatar-container" onClick={handleAvatarClick}>
                                    {isUploading ? (
                                        <div className="avatar-loading-spinner">
                                            <Loader2 className="spinner-animate" size={24} />
                                        </div>
                                    ) : localAvatar ? (
                                        <img src={localAvatar} alt="Avatar" className="profile-avatar-large-img" />
                                    ) : (
                                        <div className="profile-avatar-large-fallback">{initials}</div>
                                    )}
                                    <div className="profile-avatar-hover-overlay">
                                        <Camera size={18} />
                                        <span>Upload</span>
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileChange} 
                                        style={{ display: 'none' }} 
                                        accept="image/*" 
                                    />
                                </div>
                                <div className="profile-header-text">
                                    <h3>{user.name || user.displayName || 'Unnamed User'}</h3>
                                    <div className="plan-badge-highlight">
                                        <Award size={12} />
                                        <span>Pro Subscriber</span>
                                    </div>
                                </div>
                            </div>

                            {/* Plan Usage Section */}
                            <div className="usage-plan-section glass-panel">
                                <div className="usage-header">
                                    <span className="usage-title">Monthly Usage</span>
                                    <span className="usage-text">34.2% used</span>
                                </div>
                                <div className="usage-progress-container">
                                    <div className="usage-progress-fill" style={{ width: '34.2%' }} />
                                </div>
                                <div className="usage-footer">
                                    <span><strong>342</strong> of <strong>1,000</strong> Generations</span>
                                    <span>Resets in 30 days</span>
                                </div>
                            </div>

                            <div className="profile-info-grid">
                                <div className="profile-info-item">
                                    <span className="info-label">Full Name</span>
                                    <div className="info-value-new">
                                        <User size={15} />
                                        <span>{user.name || user.displayName || user.email || 'Unnamed User'}</span>
                                    </div>
                                </div>

                                <div className="profile-info-item">
                                    <span className="info-label">Email Address</span>
                                    <div className="info-value-new">
                                        <Mail size={15} />
                                        <span>{user.email}</span>
                                    </div>
                                </div>

                                <div className="profile-info-item">
                                    <span className="info-label">Member Since</span>
                                    <div className="info-value-new">
                                        <Clock size={15} />
                                        <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'June 2026'}</span>
                                    </div>
                                </div>

                                <div className="profile-info-item">
                                    <span className="info-label">Last Login</span>
                                    <div className="info-value-new">
                                        <History size={15} />
                                        <span>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Just now'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="profile-actions-panel">
                                <button className="profile-btn-new secondary" onClick={handleHistoryClick}>
                                    <History size={16} />
                                    <span>View History</span>
                                </button>
                                <button 
                                    className="profile-btn-new secondary logout" 
                                    onClick={handleLogout}
                                    disabled={isSigningOut}
                                    style={{ opacity: isSigningOut ? 0.6 : 1, cursor: isSigningOut ? 'not-allowed' : 'pointer' }}
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
                                        <LogOut size={16} />
                                    )}
                                    <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="tab-content animate-fade-in flex-column">
                            <div className="settings-scroll-area">
                                {/* Appearance Group */}
                                <div className="settings-group-new">
                                    <h4 className="settings-section-title text-gradient-teal">Appearance</h4>
                                    <div className="settings-item-card" onClick={() => handleSettingChange('aiGlow', !localSettings.aiGlow)}>
                                        <div className="settings-item-details">
                                            <span className="settings-item-name">AI Glow Effects</span>
                                            <span className="settings-item-desc">Enable premium neon glow animations on UI buttons</span>
                                        </div>
                                        <div className={`setting-toggle ${localSettings.aiGlow ? 'on' : ''}`} />
                                    </div>

                                    <div className="settings-item-card" onClick={() => handleSettingChange('highContrast', !localSettings.highContrast)}>
                                        <div className="settings-item-details">
                                            <span className="settings-item-name">High Contrast</span>
                                            <span className="settings-item-desc">Sharper borders and layout grids for better visibility</span>
                                        </div>
                                        <div className={`setting-toggle ${localSettings.highContrast ? 'on' : ''}`} />
                                    </div>

                                    <div className="settings-item-card" onClick={() => handleSettingChange('compactMode', !localSettings.compactMode)}>
                                        <div className="settings-item-details">
                                            <span className="settings-item-name">Compact Mode</span>
                                            <span className="settings-item-desc">Reduce whitespace padding inside analysis logs</span>
                                        </div>
                                        <div className={`setting-toggle ${localSettings.compactMode ? 'on' : ''}`} />
                                    </div>
                                </div>

                                {/* Notifications Group */}
                                <div className="settings-group-new">
                                    <h4 className="settings-section-title text-gradient-teal">Notification Preferences</h4>
                                    <div className="settings-item-card" onClick={() => handleSettingChange('notifications', !localSettings.notifications)}>
                                        <div className="settings-item-details">
                                            <span className="settings-item-name">Desktop Notifications</span>
                                            <span className="settings-item-desc">Get alerted instantly when a requirements analysis completes</span>
                                        </div>
                                        <div className={`setting-toggle ${localSettings.notifications ? 'on' : ''}`} />
                                    </div>

                                    <div className="settings-item-card" onClick={() => handleSettingChange('emailAlerts', !localSettings.emailAlerts)}>
                                        <div className="settings-item-details">
                                            <span className="settings-item-name">Email Alerts</span>
                                            <span className="settings-item-desc">Receive completions and test suites directly in your inbox</span>
                                        </div>
                                        <div className={`setting-toggle ${localSettings.emailAlerts ? 'on' : ''}`} />
                                    </div>

                                    <div className="settings-item-card" onClick={() => handleSettingChange('weeklyDigest', !localSettings.weeklyDigest)}>
                                        <div className="settings-item-details">
                                            <span className="settings-item-name">Weekly Usage Digest</span>
                                            <span className="settings-item-desc">Receive a summary of test coverage maturity on weekends</span>
                                        </div>
                                        <div className={`setting-toggle ${localSettings.weeklyDigest ? 'on' : ''}`} />
                                    </div>
                                </div>

                                {/* QA Specific Defaults Group */}
                                <div className="settings-group-new">
                                    <h4 className="settings-section-title text-gradient-teal">QA Product Defaults</h4>
                                    
                                    <div className="settings-qa-box">
                                        <span className="qa-input-label">Default Test Types</span>
                                        <div className="qa-checkbox-grid">
                                            {['functional', 'negative', 'edge', 'api', 'nonFunctional'].map(type => (
                                                <label key={type} className="qa-checkbox-label">
                                                    <input 
                                                        type="checkbox"
                                                        checked={localSettings.defaultTestMix?.[type] || false}
                                                        onChange={() => handleTestMixChange(type)}
                                                    />
                                                    <span className="capitalize">{type.replace('nonFunctional', 'Non-Func')}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="settings-row-grid">
                                        <div className="settings-qa-box">
                                            <span className="qa-input-label">Min Test Case Count</span>
                                            <select 
                                                className="qa-dropdown"
                                                value={localSettings.minTestCaseCount}
                                                onChange={(e) => handleSettingChange('minTestCaseCount', parseInt(e.target.value, 10))}
                                            >
                                                <option value={5}>5 cases</option>
                                                <option value={10}>10 cases</option>
                                                <option value={15}>15 cases</option>
                                                <option value={20}>20 cases</option>
                                                <option value={30}>30 cases</option>
                                            </select>
                                        </div>

                                        <div className="settings-qa-box">
                                            <span className="qa-input-label">Default Export Format</span>
                                            <select 
                                                className="qa-dropdown"
                                                value={localSettings.defaultExportFormat}
                                                onChange={(e) => handleSettingChange('defaultExportFormat', e.target.value)}
                                            >
                                                <option value="JSON">JSON format</option>
                                                <option value="CSV">CSV tabular</option>
                                                <option value="TestRail">TestRail CSV</option>
                                                <option value="Zephyr">Zephyr JSON</option>
                                            </select>
                                        </div>

                                        <div className="settings-qa-box">
                                            <span className="qa-input-label">Automation Framework</span>
                                            <select 
                                                className="qa-dropdown"
                                                value={localSettings.defaultAutomationFramework}
                                                onChange={(e) => handleSettingChange('defaultAutomationFramework', e.target.value)}
                                            >
                                                <option value="Playwright">Playwright</option>
                                                <option value="Cypress">Cypress</option>
                                                <option value="Selenium">Selenium</option>
                                                <option value="Jest">Jest</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Save/Cancel Action Bar */}
                            <div className="settings-action-bar">
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <button 
                                        className="profile-btn-new primary" 
                                        onClick={handleSaveSettings}
                                        disabled={isSavingSettings}
                                        style={{ minWidth: '130px' }}
                                    >
                                        {isSavingSettings ? (
                                            <>
                                                <Loader2 className="spinner-animate" size={15} />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>Save Settings</span>
                                        )}
                                    </button>
                                    <button 
                                        className="profile-btn-new secondary" 
                                        onClick={handleCancelSettings}
                                        disabled={isSavingSettings}
                                    >
                                        Cancel
                                    </button>
                                </div>
                                {showSavedFeedback && (
                                    <div className="saved-feedback-badge">
                                        <Check size={14} />
                                        <span>Saved locally & synced to account ✓</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="tab-content animate-fade-in flex-column">
                            <div className="billing-scroll-area">
                                <div className="billing-card glass-panel">
                                    <div className="billing-plan-info">
                                        <div>
                                            <span className="billing-plan-title">PRO Access Tier</span>
                                            <p className="billing-plan-desc">Unlimited generation, premium 3D analysis logs, and team export tools.</p>
                                        </div>
                                        <div className="billing-plan-price">
                                            <span className="price">$49</span>
                                            <span className="period">/mo</span>
                                        </div>
                                    </div>
                                    <div className="billing-meta-row">
                                        <span>Status: <strong style={{ color: '#00f2de' }}>Active</strong></span>
                                        <span>Renewal date: <strong>July 27, 2026</strong></span>
                                    </div>
                                </div>

                                <div className="billing-section">
                                    <h4 className="settings-section-title text-gradient-teal">Payment Details</h4>
                                    <div className="payment-card-details">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div className="credit-card-icon">
                                                <CreditCard size={20} />
                                            </div>
                                            <div>
                                                <span className="card-no">Visa ending in 4242</span>
                                                <span className="card-expiry">Expires 12 / 2028</span>
                                            </div>
                                        </div>
                                        <button className="billing-action-link">Update Payment Method</button>
                                    </div>
                                </div>

                                <div className="billing-section" style={{ flex: 1 }}>
                                    <h4 className="settings-section-title text-gradient-teal">Invoice History</h4>
                                    <div className="invoices-table">
                                        <div className="invoice-row">
                                            <div className="invoice-meta">
                                                <FileText size={16} />
                                                <span className="invoice-date">Jun 27, 2026</span>
                                            </div>
                                            <span className="invoice-amount">$49.00 USD</span>
                                            <button className="download-invoice-btn" onClick={() => alert("Invoice PDF downloaded.")}>
                                                <Download size={14} />
                                                <span>Download PDF</span>
                                            </button>
                                        </div>
                                        <div className="invoice-row">
                                            <div className="invoice-meta">
                                                <FileText size={16} />
                                                <span className="invoice-date">May 27, 2026</span>
                                            </div>
                                            <span className="invoice-amount">$49.00 USD</span>
                                            <button className="download-invoice-btn" onClick={() => alert("Invoice PDF downloaded.")}>
                                                <Download size={14} />
                                                <span>Download PDF</span>
                                            </button>
                                        </div>
                                        <div className="invoice-row">
                                            <div className="invoice-meta">
                                                <FileText size={16} />
                                                <span className="invoice-date">Apr 27, 2026</span>
                                            </div>
                                            <span className="invoice-amount">$49.00 USD</span>
                                            <button className="download-invoice-btn" onClick={() => alert("Invoice PDF downloaded.")}>
                                                <Download size={14} />
                                                <span>Download PDF</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-action-bar" style={{ marginTop: 'auto' }}>
                                <button className="cancel-sub-btn" onClick={() => alert("To cancel, please contact billing support at support@testnexa.ai")}>Cancel subscription</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'account' && (
                        <div className="tab-content animate-fade-in flex-column">
                            <div className="account-scroll-area">
                                {/* Change Password */}
                                <div className="account-section-card">
                                    <h4 className="settings-section-title text-gradient-teal">Change Password</h4>
                                    <form onSubmit={handlePasswordUpdate} className="security-form">
                                        <div className="form-input-box" style={{ marginBottom: '0.6rem' }}>
                                            <label className="form-label">Current Password</label>
                                            <input 
                                                type="password" 
                                                className="security-input" 
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div className="form-row-half">
                                            <div className="form-input-box">
                                                <label className="form-label">New Password</label>
                                                <input 
                                                    type="password" 
                                                    className="security-input" 
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="Min. 8 characters"
                                                />
                                            </div>
                                            <div className="form-input-box">
                                                <label className="form-label">Confirm Password</label>
                                                <input 
                                                    type="password" 
                                                    className="security-input" 
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-actions-row">
                                            <button type="submit" className="profile-btn-new primary" disabled={passwordStatus === 'loading'}>
                                                {passwordStatus === 'loading' ? (
                                                    <>
                                                        <Loader2 className="spinner-animate" size={14} />
                                                        <span>Updating...</span>
                                                    </>
                                                ) : (
                                                    <span>Update Password</span>
                                                )}
                                            </button>
                                            {passwordStatus && (
                                                <span className={`form-feedback-text ${passwordStatus}`}>
                                                    {passwordMessage}
                                                </span>
                                            )}
                                        </div>
                                    </form>
                                </div>

                                {/* Two-Factor Auth */}
                                <div className="account-section-card">
                                    <h4 className="settings-section-title text-gradient-teal">Two-Factor Authentication (2FA)</h4>
                                    <div className="security-item-card">
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                            <div className="security-icon-circle">
                                                <Smartphone size={18} />
                                            </div>
                                            <div>
                                                <span className="security-item-name">Two-Factor Protection</span>
                                                <p className="security-item-desc">Secure your account by requiring an authenticator code when signing in.</p>
                                            </div>
                                        </div>
                                        <div 
                                            className={`setting-toggle ${is2FAEnabled ? 'on' : ''}`} 
                                            onClick={handle2FAToggle}
                                        />
                                    </div>

                                    {show2FASetup && (
                                        <div className="setup-2fa-card glass-panel animate-fade-in">
                                            <h5>Set up 2FA Code Authenticator</h5>
                                            <div className="setup-2fa-layout">
                                                <div className="qr-code-placeholder">
                                                    {/* Mock QR Code representation */}
                                                    <div className="qr-grid">
                                                        <div className="qr-square sq-top-left" />
                                                        <div className="qr-square sq-top-right" />
                                                        <div className="qr-square sq-bottom-left" />
                                                        <div className="qr-dots" />
                                                    </div>
                                                </div>
                                                <div className="qr-setup-instructions">
                                                    <p>1. Scan the QR code using Google Authenticator, Duo, or Authy.</p>
                                                    <p>2. Save this secret key in case you lose access: <code>NEXA-7J8F-K19X-42L0</code></p>
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                                                        <input type="text" className="security-input code-input" placeholder="000 000" maxLength={6} />
                                                        <button className="profile-btn-new primary" onClick={confirm2FASetup}>Confirm Setup</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Connected Devices */}
                                <div className="account-section-card">
                                    <h4 className="settings-section-title text-gradient-teal">Connected Devices</h4>
                                    <div className="devices-list">
                                        <div className="device-item">
                                            <div className="device-meta">
                                                <Globe size={16} />
                                                <div>
                                                    <span className="device-name">Chrome on Windows (Current Session)</span>
                                                    <span className="device-details">Mumbai, India — 103.45.2.19</span>
                                                </div>
                                            </div>
                                            <span className="current-badge">Active</span>
                                        </div>
                                        <div className="device-item">
                                            <div className="device-meta">
                                                <Globe size={16} />
                                                <div>
                                                    <span className="device-name">Safari on Apple iPhone 14</span>
                                                    <span className="device-details">Logged in 2 days ago</span>
                                                </div>
                                            </div>
                                            <button className="device-revoke-btn" onClick={() => alert("Session revoked.")}>Revoke</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Export & Privacy */}
                                <div className="account-section-card">
                                    <h4 className="settings-section-title text-gradient-teal">GDPR Privacy & Export</h4>
                                    <div className="export-action-card">
                                        <div>
                                            <span className="export-title">Export My Archive</span>
                                            <p className="export-desc">Download a complete backup of your profile details, generated test suites, and preferences as a structured JSON file.</p>
                                        </div>
                                        <button className="profile-btn-new secondary" onClick={handleDataExport} disabled={exportStatus === 'loading'}>
                                            {exportStatus === 'loading' ? (
                                                <>
                                                    <Loader2 className="spinner-animate" size={14} />
                                                    <span>Exporting...</span>
                                                </>
                                            ) : exportStatus === 'success' ? (
                                                <>
                                                    <Check size={14} />
                                                    <span>Exported!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Download size={14} />
                                                    <span>Export Data</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Danger Zone */}
                                <div className="account-section-card danger-zone-box">
                                    <div className="danger-zone-header">
                                        <AlertTriangle size={18} />
                                        <span>Danger Zone</span>
                                    </div>
                                    <div className="danger-zone-body">
                                        <div>
                                            <span className="danger-title">Delete Account Permanent</span>
                                            <p className="danger-desc">This will erase all test generations, plan subscriptions, and account logs forever. This is irreversible.</p>
                                        </div>
                                        <button className="profile-btn-new danger" onClick={() => {
                                            if (confirm("Are you absolutely sure you want to permanently delete your TestNexa account? This action cannot be undone.")) {
                                                alert("Account deletion requested.");
                                                handleLogout();
                                            }
                                        }}>
                                            <Trash2 size={15} />
                                            <span>Delete Account</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
