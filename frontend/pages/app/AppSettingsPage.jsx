import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    User, Sliders, CreditCard, ShieldCheck, Building,
    Users, Puzzle, Check, AlertCircle, Loader2, ArrowRight,
    Lock, Smartphone, Globe, Laptop, Key, Download, CheckCircle2,
    Trash2, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import UpgradeModal from '../../components/UpgradeModal';
import '../../styles/app/AppSettings.css';

const TABS = [
    { id: 'profile', label: 'Profile', icon: User, group: 'Account' },
    { id: 'preferences', label: 'Preferences', icon: Sliders, group: 'Account' },
    { id: 'billing', label: 'Billing & Usage', icon: CreditCard, group: 'Subscription' },
    { id: 'security', label: 'Security', icon: ShieldCheck, group: 'Security' },
    { id: 'workspace', label: 'Workspace Settings', icon: Building, group: 'Workspace' },
    { id: 'members', label: 'Members', icon: Users, group: 'Workspace' },
    { id: 'integrations', label: 'Integrations', icon: Puzzle, group: 'Workspace' },
];

const formatMemberDate = (dateString) => {
    if (!dateString) return 'September 2026';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return 'September 2026';
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
        return 'September 2026';
    }
};

const AppSettingsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'profile';
    const navigate = useNavigate();

    const { user, updateProfile, changePassword, logout, activeSessions = [], fetchSessions, revokeSession, revokeOtherSessions } = useAuth();
    const { settings, updateSetting } = useSettings();

    // Profile Edit State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileName, setProfileName] = useState(user?.name || user?.displayName || 'Kishor Gogoi');
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileFeedback, setProfileFeedback] = useState(null);

    // Password State
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordFeedback, setPasswordFeedback] = useState(null);

    // 2FA State
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [show2FAModal, setShow2FAModal] = useState(false);

    // Confirmation Modals & Session Revoke State
    const [showSignoutSessionsModal, setShowSignoutSessionsModal] = useState(false);
    const [isRevokingOthers, setIsRevokingOthers] = useState(false);
    const [revokingSessionId, setRevokingSessionId] = useState(null);
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Workspace & Preferences Feedback
    const [preferencesSaved, setPreferencesSaved] = useState(false);
    const [workspaceName, setWorkspaceName] = useState('Enterprise QA Core');
    const [workspaceSaved, setWorkspaceSaved] = useState(false);

    // Invite Modal
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Engineer');
    const [inviteSent, setInviteSent] = useState(false);

    useEffect(() => {
        if (user?.name || user?.displayName) {
            setProfileName(user.name || user.displayName);
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'security' && typeof fetchSessions === 'function') {
            fetchSessions();
        }
    }, [activeTab, fetchSessions]);

    const formatPasswordLastChanged = () => {
        if (user?.provider && user.provider !== 'email') {
            return `Managed via ${user.provider === 'google' ? 'Google' : 'GitHub'} (OAuth)`;
        }
        if (user?.passwordChangedAt) {
            const diffMs = Date.now() - new Date(user.passwordChangedAt).getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return 'Last changed: Today';
            if (diffDays === 1) return 'Last changed: Yesterday';
            return `Last changed: ${diffDays} days ago`;
        }
        if (user?.createdAt) {
            return `Set on account creation (${new Date(user.createdAt).toLocaleDateString()})`;
        }
        return 'Password configured';
    };

    const formatRelativeTime = (dateStr) => {
        if (!dateStr) return 'just now';
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    const handleTabChange = (tabId) => {
        setSearchParams({ tab: tabId });
    };

    // Save Profile
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setProfileSaving(true);
        setProfileFeedback(null);
        try {
            if (updateProfile) {
                const res = await updateProfile({ name: profileName });
                if (res.success) {
                    setProfileFeedback({ type: 'success', text: 'Profile changes saved successfully' });
                    setIsEditingProfile(false);
                } else {
                    setProfileFeedback({ type: 'error', text: res.message || 'Unable to save profile.' });
                }
            } else {
                setProfileFeedback({ type: 'success', text: 'Profile changes saved' });
                setIsEditingProfile(false);
            }
        } catch {
            setProfileFeedback({ type: 'error', text: 'Changes could not be saved. Try again.' });
        } finally {
            setProfileSaving(false);
            setTimeout(() => setProfileFeedback(null), 4000);
        }
    };

    // Save Password
    const handleSavePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordFeedback({ type: 'error', text: 'New passwords do not match' });
            return;
        }
        if (newPassword.length < 6) {
            setPasswordFeedback({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setPasswordSaving(true);
        setPasswordFeedback(null);
        try {
            if (changePassword) {
                const res = await changePassword({ currentPassword, newPassword });
                if (res.success) {
                    setPasswordFeedback({ type: 'success', text: 'Password updated successfully' });
                    setShowPasswordForm(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                } else {
                    setPasswordFeedback({ type: 'error', text: res.message || 'Failed to update password' });
                }
            } else {
                setPasswordFeedback({ type: 'success', text: 'Password updated successfully' });
                setShowPasswordForm(false);
            }
        } catch {
            setPasswordFeedback({ type: 'error', text: 'Unable to update password. Try again.' });
        } finally {
            setPasswordSaving(false);
            setTimeout(() => setPasswordFeedback(null), 4000);
        }
    };

    const handlePreferenceChange = (key, val) => {
        updateSetting(key, val);
        setPreferencesSaved(true);
        setTimeout(() => setPreferencesSaved(false), 2000);
    };

    const initials = (user?.name || user?.displayName || user?.email || 'K').charAt(0).toUpperCase();
    const memberSince = formatMemberDate(user?.createdAt);

    return (
        <div className="app-settings-page">
            {/* Header */}
            <div className="app-settings-header">
                <h1 className="app-settings-header__title">Settings</h1>
                <p className="app-settings-header__desc">
                    Manage your personal account, subscription, security, and workspace preferences.
                </p>
            </div>

            {/* Mobile Nav Pills */}
            <div className="app-settings-mobile-nav">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className={`app-settings-mobile-pill ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => handleTabChange(tab.id)}
                        >
                            <Icon size={14} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main 2-Column Layout */}
            <div className="app-settings-layout">
                {/* Left Navigation */}
                <aside className="app-settings-nav" aria-label="Settings navigation">
                    {/* Account Group */}
                    <div className="app-settings-nav__group">
                        <span className="app-settings-nav__group-label">Account</span>
                        <button
                            type="button"
                            className={`app-settings-nav__item ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => handleTabChange('profile')}
                        >
                            <User size={15} className="app-settings-nav__item-icon" />
                            <span>Profile</span>
                        </button>
                        <button
                            type="button"
                            className={`app-settings-nav__item ${activeTab === 'preferences' ? 'active' : ''}`}
                            onClick={() => handleTabChange('preferences')}
                        >
                            <Sliders size={15} className="app-settings-nav__item-icon" />
                            <span>Preferences</span>
                        </button>
                    </div>

                    {/* Subscription Group */}
                    <div className="app-settings-nav__group">
                        <span className="app-settings-nav__group-label">Subscription</span>
                        <button
                            type="button"
                            className={`app-settings-nav__item ${activeTab === 'billing' ? 'active' : ''}`}
                            onClick={() => handleTabChange('billing')}
                        >
                            <CreditCard size={15} className="app-settings-nav__item-icon" />
                            <span>Billing & Usage</span>
                        </button>
                    </div>

                    {/* Security Group */}
                    <div className="app-settings-nav__group">
                        <span className="app-settings-nav__group-label">Security</span>
                        <button
                            type="button"
                            className={`app-settings-nav__item ${activeTab === 'security' ? 'active' : ''}`}
                            onClick={() => handleTabChange('security')}
                        >
                            <ShieldCheck size={15} className="app-settings-nav__item-icon" />
                            <span>Security</span>
                        </button>
                    </div>

                    {/* Workspace Group */}
                    <div className="app-settings-nav__group">
                        <span className="app-settings-nav__group-label">Workspace</span>
                        <button
                            type="button"
                            className={`app-settings-nav__item ${activeTab === 'workspace' ? 'active' : ''}`}
                            onClick={() => handleTabChange('workspace')}
                        >
                            <Building size={15} className="app-settings-nav__item-icon" />
                            <span>Workspace Settings</span>
                        </button>
                        <button
                            type="button"
                            className={`app-settings-nav__item ${activeTab === 'members' ? 'active' : ''}`}
                            onClick={() => handleTabChange('members')}
                        >
                            <Users size={15} className="app-settings-nav__item-icon" />
                            <span>Members</span>
                        </button>
                        <button
                            type="button"
                            className={`app-settings-nav__item ${activeTab === 'integrations' ? 'active' : ''}`}
                            onClick={() => handleTabChange('integrations')}
                        >
                            <Puzzle size={15} className="app-settings-nav__item-icon" />
                            <span>Integrations</span>
                        </button>
                    </div>
                </aside>

                {/* Right Content Area */}
                <main className="app-settings-content">
                    {/* ══════════════ TAB 1: PROFILE ══════════════ */}
                    {activeTab === 'profile' && (
                        <>
                            <div className="app-settings-section-header">
                                <div>
                                    <h2 className="app-settings-section-title">Profile</h2>
                                    <p className="app-settings-section-desc">
                                        Manage your personal account information.
                                    </p>
                                </div>
                                {!isEditingProfile && (
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        onClick={() => setIsEditingProfile(true)}
                                    >
                                        Edit Profile
                                    </button>
                                )}
                            </div>

                            {profileFeedback && (
                                <div className={`app-settings-feedback ${profileFeedback.type}`}>
                                    {profileFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    <span>{profileFeedback.text}</span>
                                </div>
                            )}

                            {/* Identity Card */}
                            <div className="app-settings-identity-card">
                                <div className="app-settings-identity-left">
                                    <div className="app-settings-avatar-large">
                                        {initials}
                                    </div>
                                    <div className="app-settings-identity-meta">
                                        <div className="app-settings-identity-name">
                                            {user?.name || user?.displayName || 'Kishor Gogoi'}
                                        </div>
                                        <div className="app-settings-identity-badge">
                                            Pro Plan
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Information List (Read-only vs Edit Mode) */}
                            {!isEditingProfile ? (
                                <div className="app-settings-info-list">
                                    <div className="app-settings-info-row">
                                        <span className="app-settings-info-label">Full name</span>
                                        <span className="app-settings-info-value">
                                            {user?.name || user?.displayName || 'Kishor Gogoi'}
                                        </span>
                                    </div>
                                    <div className="app-settings-info-row">
                                        <span className="app-settings-info-label">Email address</span>
                                        <span className="app-settings-info-value">
                                            {user?.email || 'user@example.com'}
                                        </span>
                                    </div>
                                    <div className="app-settings-info-row">
                                        <span className="app-settings-info-label">Member since</span>
                                        <span className="app-settings-info-value">
                                            {memberSince}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSaveProfile} className="app-settings-info-list">
                                    <div className="app-settings-info-row">
                                        <label htmlFor="profileName" className="app-settings-info-label">Full name</label>
                                        <div className="app-settings-info-edit">
                                            <input
                                                id="profileName"
                                                type="text"
                                                className="app-settings-input"
                                                value={profileName}
                                                onChange={(e) => setProfileName(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="app-settings-info-row">
                                        <label htmlFor="profileEmail" className="app-settings-info-label">Email address</label>
                                        <div className="app-settings-info-edit">
                                            <input
                                                id="profileEmail"
                                                type="email"
                                                className="app-settings-input"
                                                value={user?.email || 'user@example.com'}
                                                disabled
                                            />
                                        </div>
                                    </div>
                                    <div className="app-settings-info-row">
                                        <span className="app-settings-info-label">Member since</span>
                                        <span className="app-settings-info-value">{memberSince}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                                        <button
                                            type="button"
                                            className="app-settings-btn app-settings-btn--secondary"
                                            onClick={() => {
                                                setIsEditingProfile(false);
                                                setProfileName(user?.name || user?.displayName || 'Kishor Gogoi');
                                            }}
                                            disabled={profileSaving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="app-settings-btn app-settings-btn--primary"
                                            disabled={profileSaving}
                                        >
                                            {profileSaving ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span>Saving...</span>
                                                </>
                                            ) : (
                                                'Save Changes'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Danger Zone */}
                            <div className="app-settings-danger-zone">
                                <div className="app-settings-danger-info">
                                    <h4>Delete Account</h4>
                                    <p>Permanently delete your Testnexa account and all associated test suites and data.</p>
                                </div>
                                <button
                                    type="button"
                                    className="app-settings-btn app-settings-btn--danger"
                                    onClick={() => setShowDeleteAccountModal(true)}
                                >
                                    Delete Account
                                </button>
                            </div>
                        </>
                    )}

                    {/* ══════════════ TAB 2: PREFERENCES ══════════════ */}
                    {activeTab === 'preferences' && (
                        <>
                            <div className="app-settings-section-header">
                                <div>
                                    <h2 className="app-settings-section-title">Preferences</h2>
                                    <p className="app-settings-section-desc">
                                        Customize your workspace and default QA generation parameters.
                                    </p>
                                </div>
                                {preferencesSaved && (
                                    <div className="app-settings-feedback success" style={{ padding: '0.35rem 0.75rem' }}>
                                        <CheckCircle2 size={14} />
                                        <span>Saved</span>
                                    </div>
                                )}
                            </div>

                            {/* Appearance */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F5F5F5', margin: 0 }}>Appearance</h3>
                                <div className="app-settings-info-list">
                                    <div className="app-settings-info-row">
                                        <span className="app-settings-info-label">Theme</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#F5F5F5', fontWeight: 600 }}>True Black</span>
                                            <span style={{ fontSize: '0.72rem', color: '#8BAF9A', background: 'rgba(139, 175, 154, 0.1)', padding: '0.1rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(139, 175, 154, 0.25)' }}>
                                                Active
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notifications */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F5F5F5', margin: 0 }}>Notifications</h3>
                                <div className="app-settings-info-list">
                                    <div className="app-settings-info-row">
                                        <div>
                                            <div className="app-settings-info-label" style={{ color: '#F5F5F5' }}>Email notifications</div>
                                            <span style={{ fontSize: '0.76rem', color: '#737373' }}>Receive QA synthesis summaries and security notices</span>
                                        </div>
                                        <div />
                                        <input
                                            type="checkbox"
                                            checked={settings.emailAlerts !== false}
                                            onChange={(e) => handlePreferenceChange('emailAlerts', e.target.checked)}
                                            style={{ transform: 'scale(1.2)', accentColor: '#8BAF9A', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div className="app-settings-info-row">
                                        <div>
                                            <div className="app-settings-info-label" style={{ color: '#F5F5F5' }}>Desktop notifications</div>
                                            <span style={{ fontSize: '0.76rem', color: '#737373' }}>Notify when AI test generation finishes in background</span>
                                        </div>
                                        <div />
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications !== false}
                                            onChange={(e) => handlePreferenceChange('notifications', e.target.checked)}
                                            style={{ transform: 'scale(1.2)', accentColor: '#8BAF9A', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Generation Preferences */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F5F5F5', margin: 0 }}>Generation Defaults</h3>
                                <div className="app-settings-info-list">
                                    <div className="app-settings-info-row">
                                        <label htmlFor="prefTarget" className="app-settings-info-label">Default target</label>
                                        <div className="app-settings-info-edit">
                                            <select
                                                id="prefTarget"
                                                className="app-settings-input"
                                                value={settings.defaultTarget || 'Web'}
                                                onChange={(e) => handlePreferenceChange('defaultTarget', e.target.value)}
                                            >
                                                <option value="Web">Web Application (Browsers)</option>
                                                <option value="Mobile">Mobile Application (iOS / Android)</option>
                                                <option value="API">REST / GraphQL API</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="app-settings-info-row">
                                        <label htmlFor="prefDepth" className="app-settings-info-label">Default coverage depth</label>
                                        <div className="app-settings-info-edit">
                                            <select
                                                id="prefDepth"
                                                className="app-settings-input"
                                                value={settings.depth || 'Standard'}
                                                onChange={(e) => handlePreferenceChange('depth', e.target.value)}
                                            >
                                                <option value="Essential">Essential (Fast baseline)</option>
                                                <option value="Standard">Standard (Balanced enterprise QA)</option>
                                                <option value="Comprehensive">Comprehensive (Deep security & edge)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="app-settings-info-row">
                                        <label htmlFor="prefFramework" className="app-settings-info-label">Default test framework</label>
                                        <div className="app-settings-info-edit">
                                            <select
                                                id="prefFramework"
                                                className="app-settings-input"
                                                value={settings.framework || 'playwright'}
                                                onChange={(e) => handlePreferenceChange('framework', e.target.value)}
                                            >
                                                <option value="playwright">Playwright (TypeScript / Python)</option>
                                                <option value="cypress">Cypress (JavaScript)</option>
                                                <option value="jest">Jest / Vitest</option>
                                                <option value="gherkin">Gherkin / Cucumber BDD</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══════════════ TAB 3: BILLING & USAGE ══════════════ */}
                    {activeTab === 'billing' && (
                        <>
                            <div className="app-settings-section-header">
                                <div>
                                    <h2 className="app-settings-section-title">Billing & Usage</h2>
                                    <p className="app-settings-section-desc">
                                        Monitor your monthly generation limits, subscription plan, and invoices.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="app-settings-btn app-settings-btn--primary"
                                    onClick={() => setShowUpgradeModal(true)}
                                >
                                    Manage Plan
                                </button>
                            </div>

                            {/* Current Plan & Usage Box */}
                            <div className="app-settings-usage-box">
                                <div className="app-settings-usage-top">
                                    <span className="app-settings-usage-label">Monthly Usage</span>
                                    <span className="app-settings-usage-metric">
                                        <strong>{user?.totalTestsGenerated || 342}</strong> / 1,000 generations
                                    </span>
                                </div>

                                <div className="app-settings-progress-track">
                                    <div
                                        className="app-settings-progress-bar"
                                        style={{ width: `${Math.min(100, Math.round(((user?.totalTestsGenerated || 342) / 1000) * 100))}%` }}
                                    />
                                </div>

                                <div className="app-settings-usage-meta">
                                    <span>{Math.round(((user?.totalTestsGenerated || 342) / 1000) * 100)}% used this cycle</span>
                                    <span>Resets in 30 days</span>
                                </div>
                            </div>

                            {/* Subscription Details */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F5F5F5', margin: 0 }}>Subscription</h3>
                                <div className="app-settings-info-list">
                                    <div className="app-settings-info-row">
                                        <span className="app-settings-info-label">Current Plan</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#F5F5F5' }}>Pro Plan</span>
                                            <span className="app-settings-status-badge active">Active</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="app-settings-btn app-settings-btn--secondary"
                                            onClick={() => setShowUpgradeModal(true)}
                                        >
                                            Change Plan
                                        </button>
                                    </div>
                                    <div className="app-settings-info-row">
                                        <span className="app-settings-info-label">Billing cycle</span>
                                        <span className="app-settings-info-value">$29.00 / month (Renews Oct 12, 2026)</span>
                                    </div>
                                    <div className="app-settings-info-row">
                                        <span className="app-settings-info-label">Payment method</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <CreditCard size={16} color="#A3A3A3" />
                                            <span className="app-settings-info-value">Visa ending in 4242 · Expires 12/28</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Billing History */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F5F5F5', margin: 0 }}>Billing History</h3>
                                <div className="app-settings-table-wrap">
                                    <table className="app-settings-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Description</th>
                                                <th>Amount</th>
                                                <th>Status</th>
                                                <th style={{ textAlign: 'right' }}>Invoice</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>Sep 01, 2026</td>
                                                <td>Pro Plan — Monthly Subscription</td>
                                                <td>$29.00</td>
                                                <td><span className="app-settings-status-badge paid">Paid</span></td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        className="app-settings-btn app-settings-btn--secondary"
                                                        style={{ padding: '0.25rem 0.55rem', minHeight: '28px', fontSize: '0.75rem' }}
                                                        onClick={() => alert('Downloading Invoice #INV-2026-09...')}
                                                    >
                                                        <Download size={13} />
                                                        <span>PDF</span>
                                                    </button>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Aug 01, 2026</td>
                                                <td>Pro Plan — Monthly Subscription</td>
                                                <td>$29.00</td>
                                                <td><span className="app-settings-status-badge paid">Paid</span></td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        className="app-settings-btn app-settings-btn--secondary"
                                                        style={{ padding: '0.25rem 0.55rem', minHeight: '28px', fontSize: '0.75rem' }}
                                                        onClick={() => alert('Downloading Invoice #INV-2026-08...')}
                                                    >
                                                        <Download size={13} />
                                                        <span>PDF</span>
                                                    </button>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Jul 01, 2026</td>
                                                <td>Pro Plan — Monthly Subscription</td>
                                                <td>$29.00</td>
                                                <td><span className="app-settings-status-badge paid">Paid</span></td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        className="app-settings-btn app-settings-btn--secondary"
                                                        style={{ padding: '0.25rem 0.55rem', minHeight: '28px', fontSize: '0.75rem' }}
                                                        onClick={() => alert('Downloading Invoice #INV-2026-07...')}
                                                    >
                                                        <Download size={13} />
                                                        <span>PDF</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══════════════ TAB 4: SECURITY ══════════════ */}
                    {activeTab === 'security' && (
                        <>
                            <div className="app-settings-section-header">
                                <div>
                                    <h2 className="app-settings-section-title">Security</h2>
                                    <p className="app-settings-section-desc">
                                        Protect your Testnexa account, manage credentials, and audit active sessions.
                                    </p>
                                </div>
                            </div>

                            {passwordFeedback && (
                                <div className={`app-settings-feedback ${passwordFeedback.type}`}>
                                    {passwordFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    <span>{passwordFeedback.text}</span>
                                </div>
                            )}

                            {/* Password Section */}
                            <div className="app-settings-security-block">
                                <div className="app-settings-security-top">
                                    <div className="app-settings-security-info">
                                        <h4>Password</h4>
                                        <p>{formatPasswordLastChanged()}</p>
                                    </div>
                                    {!showPasswordForm && (!user?.provider || user?.provider === 'email') && (
                                        <button
                                            type="button"
                                            className="app-settings-btn app-settings-btn--secondary"
                                            onClick={() => setShowPasswordForm(true)}
                                        >
                                            Change Password
                                        </button>
                                    )}
                                </div>

                                {showPasswordForm && (
                                    <form onSubmit={handleSavePassword} style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <label htmlFor="curPwd" style={{ fontSize: '0.8rem', color: '#A3A3A3' }}>Current Password</label>
                                            <input
                                                id="curPwd"
                                                type="password"
                                                className="app-settings-input"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <label htmlFor="newPwd" style={{ fontSize: '0.8rem', color: '#A3A3A3' }}>New Password</label>
                                            <input
                                                id="newPwd"
                                                type="password"
                                                className="app-settings-input"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                minLength={6}
                                                required
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <label htmlFor="confPwd" style={{ fontSize: '0.8rem', color: '#A3A3A3' }}>Confirm New Password</label>
                                            <input
                                                id="confPwd"
                                                type="password"
                                                className="app-settings-input"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                minLength={6}
                                                required
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                            <button
                                                type="button"
                                                className="app-settings-btn app-settings-btn--secondary"
                                                onClick={() => setShowPasswordForm(false)}
                                                disabled={passwordSaving}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="app-settings-btn app-settings-btn--primary"
                                                disabled={passwordSaving}
                                            >
                                                {passwordSaving ? 'Updating...' : 'Update Password'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>

                            {/* Two-Factor Authentication */}
                            <div className="app-settings-security-block">
                                <div className="app-settings-security-top">
                                    <div className="app-settings-security-info">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <h4>Two-Factor Authentication</h4>
                                            <span className="app-settings-status-badge inactive">Coming Soon</span>
                                        </div>
                                        <p>Hardware security keys and TOTP authenticator app support are scheduled for enterprise release.</p>
                                        <p style={{ marginTop: '0.35rem', color: '#737373', fontSize: '0.78rem' }}>
                                            Status: <strong>Not enabled</strong>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        disabled
                                        style={{ opacity: 0.5, cursor: 'not-allowed' }}
                                        title="2FA will be available in an upcoming enterprise release"
                                    >
                                        Coming Soon
                                    </button>
                                </div>
                            </div>

                            {/* Active Sessions */}
                            <div className="app-settings-security-block">
                                <div className="app-settings-security-top">
                                    <div className="app-settings-security-info">
                                        <h4>Active Sessions</h4>
                                        <p>{activeSessions.length} active session{activeSessions.length === 1 ? '' : 's'}</p>
                                    </div>
                                    {activeSessions.some(s => !s.isCurrent) && (
                                        <button
                                            type="button"
                                            className="app-settings-btn app-settings-btn--secondary"
                                            disabled={isRevokingOthers}
                                            onClick={() => setShowSignoutSessionsModal(true)}
                                        >
                                            {isRevokingOthers ? 'Signing out...' : 'Sign out all other sessions'}
                                        </button>
                                    )}
                                </div>

                                {activeSessions.length === 0 ? (
                                    <div style={{ padding: '0.75rem 0', color: '#737373', fontSize: '0.85rem' }}>
                                        Loading active sessions…
                                    </div>
                                ) : (
                                    activeSessions.map((session) => (
                                        <div key={session.id} className="app-settings-session-card">
                                            <div className="app-settings-session-meta">
                                                {session.device?.toLowerCase().includes('iphone') || session.device?.toLowerCase().includes('android') || session.device?.toLowerCase().includes('ios') ? (
                                                    <Smartphone size={18} color={session.isCurrent ? "#8BAF9A" : "#A3A3A3"} />
                                                ) : (
                                                    <Laptop size={18} color={session.isCurrent ? "#8BAF9A" : "#A3A3A3"} />
                                                )}
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F5F5F5' }}>
                                                        {session.device}
                                                    </div>
                                                    <div style={{ fontSize: '0.74rem', color: '#737373' }}>
                                                        {session.isCurrent ? 'Current session' : `Last active ${formatRelativeTime(session.lastActiveAt)}`} · {session.ipAddress} ({session.location || 'Local Network'})
                                                    </div>
                                                </div>
                                            </div>
                                            {session.isCurrent ? (
                                                <span className="app-settings-status-badge active">Current</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="app-settings-btn app-settings-btn--secondary"
                                                    style={{ padding: '0.25rem 0.6rem', minHeight: '28px', fontSize: '0.75rem' }}
                                                    disabled={revokingSessionId === session.id}
                                                    onClick={async () => {
                                                        setRevokingSessionId(session.id);
                                                        await revokeSession(session.id);
                                                        setRevokingSessionId(null);
                                                    }}
                                                >
                                                    {revokingSessionId === session.id ? 'Signing out...' : 'Sign out'}
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Login Activity */}
                            <div className="app-settings-security-block" style={{ borderBottom: 'none' }}>
                                <div className="app-settings-security-info">
                                    <h4>Recent Login Activity</h4>
                                    <p>Active authenticated sessions verified on this account.</p>
                                </div>

                                <div className="app-settings-info-list" style={{ marginTop: '0.5rem' }}>
                                    {activeSessions.map((session) => (
                                        <div key={session.id} className="app-settings-info-row">
                                            <span className="app-settings-info-label">{session.device}</span>
                                            <span className="app-settings-info-value">
                                                {session.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : 'Active now'}
                                            </span>
                                            <span style={{ fontSize: '0.74rem', color: '#737373' }}>IP {session.ipAddress}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══════════════ TAB 5: WORKSPACE SETTINGS ══════════════ */}
                    {activeTab === 'workspace' && (
                        <>
                            <div className="app-settings-section-header">
                                <div>
                                    <h2 className="app-settings-section-title">Workspace Settings</h2>
                                    <p className="app-settings-section-desc">
                                        Configure team workspace identity and environment routing.
                                    </p>
                                </div>
                                {workspaceSaved && (
                                    <div className="app-settings-feedback success" style={{ padding: '0.35rem 0.75rem' }}>
                                        <CheckCircle2 size={14} />
                                        <span>Saved</span>
                                    </div>
                                )}
                            </div>

                            <div className="app-settings-info-list">
                                <div className="app-settings-info-row">
                                    <label htmlFor="wsName" className="app-settings-info-label">Workspace Name</label>
                                    <div className="app-settings-info-edit">
                                        <input
                                            id="wsName"
                                            type="text"
                                            className="app-settings-input"
                                            value={workspaceName}
                                            onChange={(e) => setWorkspaceName(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="app-settings-info-row">
                                    <span className="app-settings-info-label">Workspace ID</span>
                                    <span className="app-settings-info-value" style={{ fontFamily: 'monospace', color: '#8BAF9A' }}>
                                        ws_8892fbc9_qa
                                    </span>
                                </div>
                                <div className="app-settings-info-row">
                                    <span className="app-settings-info-label">Default Environment</span>
                                    <div className="app-settings-info-edit">
                                        <select className="app-settings-input" defaultValue="staging">
                                            <option value="staging">Staging (staging.app.domain)</option>
                                            <option value="production">Production (app.domain)</option>
                                            <option value="local">Local Development (localhost)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    className="app-settings-btn app-settings-btn--primary"
                                    onClick={() => {
                                        setWorkspaceSaved(true);
                                        setTimeout(() => setWorkspaceSaved(false), 2000);
                                    }}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </>
                    )}

                    {/* ══════════════ TAB 6: MEMBERS ══════════════ */}
                    {activeTab === 'members' && (
                        <>
                            <div className="app-settings-section-header">
                                <div>
                                    <h2 className="app-settings-section-title">Members</h2>
                                    <p className="app-settings-section-desc">
                                        Manage team members, roles, and seat allocations. 2 of 5 seats used.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="app-settings-btn app-settings-btn--primary"
                                    onClick={() => setShowInviteModal(true)}
                                >
                                    Invite Member
                                </button>
                            </div>

                            <div className="app-settings-table-wrap">
                                <table className="app-settings-table">
                                    <thead>
                                        <tr>
                                            <th>Member</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600 }}>{user?.name || user?.displayName || 'Kishor Gogoi'}</span>
                                                    <span style={{ fontSize: '0.74rem', color: '#737373' }}>{user?.email || 'user@example.com'}</span>
                                                </div>
                                            </td>
                                            <td><span style={{ color: '#8BAF9A', fontWeight: 600 }}>Owner</span></td>
                                            <td><span className="app-settings-status-badge active">Active</span></td>
                                            <td style={{ textAlign: 'right', color: '#737373', fontSize: '0.75rem' }}>
                                                Primary Admin
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600 }}>Alex Chen</span>
                                                    <span style={{ fontSize: '0.74rem', color: '#737373' }}>alex.chen@enterprise.io</span>
                                                </div>
                                            </td>
                                            <td>QA Lead</td>
                                            <td><span className="app-settings-status-badge active">Active</span></td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    type="button"
                                                    className="app-settings-btn app-settings-btn--secondary"
                                                    style={{ padding: '0.2rem 0.5rem', minHeight: '26px', fontSize: '0.75rem' }}
                                                    onClick={() => alert('Editing permissions for Alex Chen')}
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* ══════════════ TAB 7: INTEGRATIONS ══════════════ */}
                    {activeTab === 'integrations' && (
                        <>
                            <div className="app-settings-section-header">
                                <div>
                                    <h2 className="app-settings-section-title">Integrations</h2>
                                    <p className="app-settings-section-desc">
                                        Connect Testnexa directly with your code repository and CI/CD pipelines.
                                    </p>
                                </div>
                            </div>

                            <div className="app-settings-info-list">
                                <div className="app-settings-info-row">
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#F5F5F5' }}>GitHub Actions</div>
                                        <span style={{ fontSize: '0.76rem', color: '#737373' }}>Trigger test suite generation and validations on Pull Requests</span>
                                    </div>
                                    <div>
                                        <span className="app-settings-status-badge active">Connected</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        onClick={() => alert('GitHub integration configured for repository: KISHOR403/Testnexa-Ai')}
                                    >
                                        Configure
                                    </button>
                                </div>

                                <div className="app-settings-info-row">
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#F5F5F5' }}>GitLab CI</div>
                                        <span style={{ fontSize: '0.76rem', color: '#737373' }}>Sync requirements and export test specs into GitLab pipelines</span>
                                    </div>
                                    <div>
                                        <span className="app-settings-status-badge inactive">Available</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        onClick={() => alert('GitLab connector requires an access token.')}
                                    >
                                        Connect
                                    </button>
                                </div>

                                <div className="app-settings-info-row">
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#F5F5F5' }}>Jira Software</div>
                                        <span style={{ fontSize: '0.76rem', color: '#737373' }}>Import user stories and epics directly into AI Workspace</span>
                                    </div>
                                    <div>
                                        <span className="app-settings-status-badge inactive">Available</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        onClick={() => alert('Connecting to Atlassian Jira...')}
                                    >
                                        Connect
                                    </button>
                                </div>

                                <div className="app-settings-info-row">
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#F5F5F5' }}>Playwright CLI Webhooks</div>
                                        <span style={{ fontSize: '0.76rem', color: '#737373' }}>Execute generated Playwright tests automatically via runner webhook</span>
                                    </div>
                                    <div>
                                        <span className="app-settings-status-badge active">Active</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        onClick={() => alert('Webhook Key: tn_wh_live_9942a98ff')}
                                    >
                                        Manage Keys
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* ══════════════ CONFIRMATION MODALS ══════════════ */}

            {/* Sign Out Sessions Modal */}
            {showSignoutSessionsModal && (
                <div className="app-settings-confirm-overlay" role="dialog" aria-modal="true">
                    <div className="app-settings-confirm-box">
                        <h3 className="app-settings-confirm-title">Sign out of other sessions?</h3>
                        <p className="app-settings-confirm-desc">
                            You will be signed out of Testnexa on all other devices and browser sessions. Your current session will remain active.
                        </p>
                        <div className="app-settings-confirm-actions">
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--secondary"
                                onClick={() => setShowSignoutSessionsModal(false)}
                                disabled={isRevokingOthers}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--danger"
                                disabled={isRevokingOthers}
                                onClick={async () => {
                                    setIsRevokingOthers(true);
                                    await revokeOtherSessions();
                                    setIsRevokingOthers(false);
                                    setShowSignoutSessionsModal(false);
                                }}
                            >
                                {isRevokingOthers ? 'Signing out...' : 'Sign out'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Account Modal */}
            {showDeleteAccountModal && (
                <div className="app-settings-confirm-overlay" role="dialog" aria-modal="true">
                    <div className="app-settings-confirm-box">
                        <h3 className="app-settings-confirm-title" style={{ color: '#EF4444' }}>Delete your account?</h3>
                        <p className="app-settings-confirm-desc">
                            This action is permanent and cannot be undone. All your test suites, coverage matrices, and workspace data will be immediately deleted.
                        </p>
                        <div className="app-settings-confirm-actions">
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--secondary"
                                onClick={() => setShowDeleteAccountModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--danger"
                                onClick={() => {
                                    setShowDeleteAccountModal(false);
                                    logout();
                                }}
                            >
                                Permanently Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2FA Setup Modal */}
            {show2FAModal && (
                <div className="app-settings-confirm-overlay" role="dialog" aria-modal="true">
                    <div className="app-settings-confirm-box">
                        <h3 className="app-settings-confirm-title">Enable Two-Factor Authentication</h3>
                        <p className="app-settings-confirm-desc">
                            Scan the QR code with your authenticator app (e.g. Google Authenticator, 1Password) to link your account.
                        </p>
                        <div style={{ background: '#111111', padding: '1rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #222222' }}>
                            <div style={{ fontSize: '0.8rem', color: '#8BAF9A', fontFamily: 'monospace' }}>
                                TNXA-8839-4421-9920
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#737373', marginTop: '0.35rem', display: 'block' }}>
                                Secret Key for Manual Entry
                            </span>
                        </div>
                        <div className="app-settings-confirm-actions">
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--secondary"
                                onClick={() => setShow2FAModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--primary"
                                onClick={() => {
                                    setIs2FAEnabled(true);
                                    setShow2FAModal(false);
                                }}
                            >
                                Verify & Activate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Member Modal */}
            {showInviteModal && (
                <div className="app-settings-confirm-overlay" role="dialog" aria-modal="true">
                    <div className="app-settings-confirm-box">
                        <h3 className="app-settings-confirm-title">Invite Team Member</h3>
                        <p className="app-settings-confirm-desc">
                            Enter the email address of the team member you want to add to this workspace.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#A3A3A3' }}>Email address</label>
                                <input
                                    type="email"
                                    className="app-settings-input"
                                    placeholder="colleague@company.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.8rem', color: '#A3A3A3' }}>Role</label>
                                <select
                                    className="app-settings-input"
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                >
                                    <option value="Engineer">QA Engineer (Can create and edit test suites)</option>
                                    <option value="Admin">Admin (Can manage workspace & billing)</option>
                                    <option value="Viewer">Viewer (Read-only access)</option>
                                </select>
                            </div>
                        </div>
                        <div className="app-settings-confirm-actions">
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--secondary"
                                onClick={() => setShowInviteModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--primary"
                                onClick={() => {
                                    setShowInviteModal(false);
                                    setInviteEmail('');
                                    alert(`Invitation sent to ${inviteEmail || 'colleague'}`);
                                }}
                            >
                                Send Invitation
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upgrade Modal */}
            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
            />
        </div>
    );
};

export default AppSettingsPage;
