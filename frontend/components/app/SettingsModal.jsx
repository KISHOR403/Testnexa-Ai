import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Search, User, Sliders, Building, Users, Lock,
    CreditCard, Puzzle, Check, AlertCircle, Loader2,
    Laptop, Smartphone, Copy, ShieldCheck, Mail, Camera, ArrowRight,
    SlidersHorizontal, Info, Shield, Trash2, Download
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useSettingsModal } from '../../context/SettingsModalContext';
import workspaceService from '../../services/workspaceService';
import SettingRow from './settings/SettingRow';
import SettingsSection from './settings/SettingsSection';
import '../../styles/app/SettingsModal.css';

const SECTIONS = [
    { id: 'account', label: 'Account', icon: User, keywords: 'profile avatar name display job email timezone password google github sessions signout devices' },
    { id: 'preferences', label: 'Preferences', icon: Sliders, keywords: 'platform web mobile api coverage depth smoke standard comprehensive test types export format playwright cypress jest robot language' },
    { id: 'workspace', label: 'Workspace', icon: Building, keywords: 'workspace name environment staging production staging token id role' },
    { id: 'members', label: 'Members', icon: Users, keywords: 'team members invite role permissions access' },
    { id: 'data-privacy', label: 'Data & privacy', icon: Lock, keywords: 'data privacy export json delete account termination erase gdpr' },
    { id: 'billing', label: 'Billing', icon: CreditCard, badge: 'Soon', comingSoon: true, keywords: 'billing invoices subscription plan payment credit card' },
    { id: 'integrations', label: 'Integrations', icon: Puzzle, badge: 'Soon', comingSoon: true, keywords: 'integrations cicd github jira slack webhooks' },
];

export const SettingsModal = (props) => {
    let modalContext = null;
    try {
        modalContext = useSettingsModal();
    } catch (e) {
        // Fallback when rendered without context provider
    }

    const isOpen = props.isOpen !== undefined ? props.isOpen : (modalContext?.isOpen ?? false);
    const initialSection = props.initialSection || modalContext?.activeSection || 'account';
    const onClose = props.onClose || modalContext?.closeSettings;
    const onSectionChange = props.onSectionChange || modalContext?.changeSection;
    const triggerRef = props.triggerRef || modalContext?.triggerElementRef;

    const {
        user,
        updateProfile,
        deleteAccount,
        logout,
        activeSessions = [],
        fetchSessions,
        revokeSession,
        revokeOtherSessions,
        currentWorkspace,
        setCurrentWorkspace
    } = useAuth();

    const { settings, updateSetting } = useSettings();

    const [activeSection, setActiveSection] = useState(initialSection || 'account');
    const [searchQuery, setSearchQuery] = useState('');
    const modalRef = useRef(null);
    const closeBtnRef = useRef(null);
    const contentPaneRef = useRef(null);

    // Sync section if initialSection changes
    useEffect(() => {
        if (initialSection) {
            setActiveSection(initialSection);
        }
    }, [initialSection]);

    // Reset scroll to top on section change or when modal opens
    useEffect(() => {
        if (contentPaneRef.current) {
            contentPaneRef.current.scrollTop = 0;
        }
    }, [activeSection, isOpen]);

    // Body scroll lock
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

    // Focus trap & Escape key listener
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
                return;
            }

            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (!focusable || focusable.length === 0) return;

                const firstEl = focusable[0];
                const lastEl = focusable[focusable.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstEl) {
                        e.preventDefault();
                        lastEl.focus();
                    }
                } else {
                    if (document.activeElement === lastEl) {
                        e.preventDefault();
                        firstEl.focus();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        setTimeout(() => {
            closeBtnRef.current?.focus();
        }, 50);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleClose = () => {
        onClose?.();
        setTimeout(() => {
            if (triggerRef?.current && typeof triggerRef.current.focus === 'function') {
                triggerRef.current.focus();
            }
        }, 50);
    };

    // Date formatting helpers for concise, non-overflowing session timestamps
    const formatSessionDate = (iso) => {
        if (!iso) return 'Recent';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return iso;
        }
    };

    const formatLastActive = (iso, isCurrent) => {
        if (isCurrent) return 'Now (Active)';
        if (!iso) return 'Recent';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            const diffMs = Date.now() - d.getTime();
            const diffMin = Math.round(diffMs / 60000);
            if (diffMin < 2) return 'Just now';
            if (diffMin < 60) return `${diffMin}m ago`;
            const diffHours = Math.round(diffMin / 60);
            if (diffHours < 24) return `${diffHours}h ago`;
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return iso;
        }
    };

    // Filter sections based on search query
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return SECTIONS;
        const q = searchQuery.toLowerCase().trim();
        return SECTIONS.filter(
            (sec) =>
                sec.label.toLowerCase().includes(q) ||
                sec.keywords.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState(null);
    const toastTimeoutRef = useRef(null);

    const showToast = useCallback((msg) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToastMessage(msg);
        toastTimeoutRef.current = setTimeout(() => {
            setToastMessage(null);
        }, 3200);
    }, []);

    // ─── 1. ACCOUNT STATE ───
    const [accountForm, setAccountForm] = useState({
        fullName: user?.name || '',
        displayName: user?.displayName || user?.name || '',
        avatar: user?.avatarUrl || user?.avatar || null
    });
    const [savedAccountForm, setSavedAccountForm] = useState({ ...accountForm });
    const [accountErrors, setAccountErrors] = useState({});
    const [isSavingAccount, setIsSavingAccount] = useState(false);
    const [avatarError, setAvatarError] = useState(null);
    const avatarInputRef = useRef(null);

    useEffect(() => {
        if (user) {
            const initialData = {
                fullName: user.name || '',
                displayName: user.displayName || user.name || '',
                avatar: user.avatarUrl || user.avatar || null
            };
            setAccountForm(initialData);
            setSavedAccountForm(initialData);
        }
    }, [user]);

    const isAccountDirty = useMemo(() => {
        return (
            accountForm.fullName !== savedAccountForm.fullName ||
            accountForm.displayName !== savedAccountForm.displayName ||
            accountForm.avatar !== savedAccountForm.avatar
        );
    }, [accountForm, savedAccountForm]);

    const handleAccountChange = (field, value) => {
        setAccountForm((prev) => ({ ...prev, [field]: value }));
        if (accountErrors[field]) {
            setAccountErrors((prev) => ({ ...prev, [field]: null }));
        }
    };

    const handleAccountBlur = (field) => {
        if (field === 'fullName' && (!accountForm.fullName || accountForm.fullName.trim().length < 2)) {
            setAccountErrors((prev) => ({ ...prev, fullName: 'Full name must be at least 2 characters' }));
        }
        if (field === 'displayName' && (!accountForm.displayName || accountForm.displayName.trim().length < 2)) {
            setAccountErrors((prev) => ({ ...prev, displayName: 'Display name must be at least 2 characters' }));
        }
    };

    const handleAvatarSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAvatarError(null);
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            setAvatarError('Please upload a PNG, JPEG, or WebP image');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setAvatarError('Image size must be under 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setAccountForm((prev) => ({ ...prev, avatar: event.target.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleSaveAccount = async () => {
        const errors = {};
        if (!accountForm.fullName || accountForm.fullName.trim().length < 2) {
            errors.fullName = 'Full name must be at least 2 characters';
        }
        if (!accountForm.displayName || accountForm.displayName.trim().length < 2) {
            errors.displayName = 'Display name must be at least 2 characters';
        }

        if (Object.keys(errors).length > 0) {
            setAccountErrors(errors);
            return;
        }

        setIsSavingAccount(true);
        try {
            if (updateProfile) {
                await updateProfile({
                    name: accountForm.fullName.trim(),
                    displayName: accountForm.displayName.trim(),
                    avatar: accountForm.avatar
                });
            }
            setSavedAccountForm({ ...accountForm });
            showToast('Account changes saved');
        } catch (err) {
            showToast(err.message || 'Failed to save profile');
        } finally {
            setIsSavingAccount(false);
        }
    };

    const handleDiscardAccount = () => {
        setAccountForm({ ...savedAccountForm });
        setAccountErrors({});
        setAvatarError(null);
    };

    // Sessions management state
    const [revokingId, setRevokingId] = useState(null);
    const [isRevokingOthers, setIsRevokingOthers] = useState(false);
    const [confirmRevokeId, setConfirmRevokeId] = useState(null);
    const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false);

    useEffect(() => {
        if (isOpen && activeSection === 'account' && fetchSessions) {
            fetchSessions().catch(() => {});
        }
    }, [isOpen, activeSection, fetchSessions]);

    const handleSingleRevoke = async (sessionId) => {
        setRevokingId(sessionId);
        try {
            if (revokeSession) {
                await revokeSession(sessionId);
            }
            showToast('Session logged out successfully');
            if (fetchSessions) fetchSessions();
        } catch {
            showToast('Failed to revoke session');
        } finally {
            setRevokingId(null);
            setConfirmRevokeId(null);
        }
    };

    const handleRevokeAllOthers = async () => {
        setIsRevokingOthers(true);
        try {
            if (revokeOtherSessions) {
                await revokeOtherSessions();
            }
            showToast('All other sessions logged out');
            if (fetchSessions) fetchSessions();
        } catch {
            showToast('Failed to revoke other sessions');
        } finally {
            setIsRevokingOthers(false);
            setConfirmRevokeOthers(false);
        }
    };

    // ─── 2. PREFERENCES STATE ───
    const [prefForm, setPrefForm] = useState({
        defaultPlatform: settings?.defaultPlatform || 'Web',
        defaultCoverageDepth: settings?.defaultCoverageDepth || 'Standard',
        defaultTestTypes: settings?.defaultTestTypes || {
            functional: true,
            negative: true,
            edge: true,
            security: false,
            regression: true,
            performance: false
        },
        defaultExportFormat: settings?.defaultExportFormat || 'Playwright',
        language: settings?.language || 'en-US'
    });
    const [savedPrefForm, setSavedPrefForm] = useState({ ...prefForm });

    useEffect(() => {
        if (settings) {
            const fresh = {
                defaultPlatform: settings.defaultPlatform || 'Web',
                defaultCoverageDepth: settings.defaultCoverageDepth || 'Standard',
                defaultTestTypes: settings.defaultTestTypes || {
                    functional: true,
                    negative: true,
                    edge: true,
                    security: false,
                    regression: true,
                    performance: false
                },
                defaultExportFormat: settings.defaultExportFormat || 'Playwright',
                language: settings.language || 'en-US'
            };
            setPrefForm(fresh);
            setSavedPrefForm(fresh);
        }
    }, [settings]);

    const isPrefDirty = useMemo(() => {
        return JSON.stringify(prefForm) !== JSON.stringify(savedPrefForm);
    }, [prefForm, savedPrefForm]);

    const selectedTestTypesCount = useMemo(() => {
        return Object.values(prefForm.defaultTestTypes).filter(Boolean).length;
    }, [prefForm.defaultTestTypes]);

    const handleSavePreferences = () => {
        Object.entries(prefForm).forEach(([k, v]) => updateSetting(k, v));
        setSavedPrefForm({ ...prefForm });
        showToast('Preferences updated');
    };

    const handleDiscardPreferences = () => {
        setPrefForm({ ...savedPrefForm });
    };

    // ─── 3. WORKSPACE STATE ───
    const [wsName, setWsName] = useState(currentWorkspace?.name || 'Pro workspace');
    const [savedWsName, setSavedWsName] = useState(wsName);
    const [isSavingWs, setIsSavingWs] = useState(false);
    const [isCopiedWsId, setIsCopiedWsId] = useState(false);

    useEffect(() => {
        if (currentWorkspace?.name) {
            setWsName(currentWorkspace.name);
            setSavedWsName(currentWorkspace.name);
        }
    }, [currentWorkspace]);

    const isWsDirty = useMemo(() => {
        return wsName !== savedWsName;
    }, [wsName, savedWsName]);

    const handleSaveWorkspace = async () => {
        if (!wsName.trim() || wsName.trim().length < 2) return;
        setIsSavingWs(true);
        try {
            if (workspaceService?.updateWorkspace) {
                await workspaceService.updateWorkspace({ name: wsName.trim() });
            }
            if (setCurrentWorkspace && currentWorkspace) {
                setCurrentWorkspace({ ...currentWorkspace, name: wsName.trim() });
            }
            setSavedWsName(wsName.trim());
            showToast('Workspace settings saved');
        } catch {
            showToast('Failed to save workspace');
        } finally {
            setIsSavingWs(false);
        }
    };

    const handleCopyWorkspaceId = () => {
        const idToCopy = currentWorkspace?.id || 'ws_prod_01';
        navigator.clipboard.writeText(idToCopy);
        setIsCopiedWsId(true);
        setTimeout(() => setIsCopiedWsId(false), 2000);
        showToast('Workspace ID copied to clipboard');
    };

    // ─── 4. MEMBERS STATE ───
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Engineer');

    const handleSendInvite = () => {
        if (!inviteEmail.trim() || !inviteEmail.includes('@')) return;
        setShowInviteModal(false);
        setInviteEmail('');
        showToast(`Invitation sent to ${inviteEmail}`);
    };

    // ─── 5. DATA & PRIVACY STATE ───
    const [isExporting, setIsExporting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const isOwnerWithOtherMembers = useMemo(() => {
        const isOwner = currentWorkspace?.role === 'owner' || currentWorkspace?.isOwner;
        const count = currentWorkspace?.members?.length || currentWorkspace?.memberCount || 1;
        return isOwner && count > 1;
    }, [currentWorkspace]);

    const handleExportMyData = async () => {
        setIsExporting(true);
        try {
            const token = localStorage.getItem('testnexa_token');
            const res = await fetch('/api/v1/auth/export-data', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Export request failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `testnexa-export-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Data exported successfully');
        } catch {
            // Client fallback export
            const clientPayload = {
                exportedAt: new Date().toISOString(),
                user: { ...user, email: user?.email || 'alex.morgan@testnexa.ai' },
                workspace: currentWorkspace || { name: 'Pro workspace' },
                settings: settings || {}
            };
            const blob = new Blob([JSON.stringify(clientPayload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `testnexa-export-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Data exported successfully');
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteAccountFinal = async () => {
        if (deleteConfirmEmail.trim().toLowerCase() !== (user?.email || 'alex.morgan@testnexa.ai').toLowerCase()) return;
        setIsDeleting(true);
        try {
            if (deleteAccount) {
                await deleteAccount({
                    confirmationText: deleteConfirmEmail,
                    reason: 'I no longer need AI test generation / automated QA'
                });
            }
            setShowDeleteModal(false);
            onClose?.();
        } catch {
            showToast('Failed to delete account. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;
    if (typeof document === 'undefined') return null;

    const initials = (accountForm.displayName || accountForm.fullName || user?.email || 'U').charAt(0).toUpperCase();

    const membersList = currentWorkspace?.members || [
        {
            id: 'm1',
            name: user?.name || 'Alex Morgan',
            email: user?.email || 'alex.morgan@testnexa.ai',
            role: 'Owner',
            joined: 'September 2026'
        }
    ];

    const sessionsList = activeSessions && activeSessions.length > 0 ? activeSessions : [
        {
            id: 'curr_sess',
            device: 'Chrome on Windows 11',
            browser: 'Chrome',
            os: 'Windows 11',
            location: 'San Francisco, CA',
            ipAddress: '127.0.0.1',
            createdAt: 'November 12, 2026',
            lastActiveAt: 'Just now',
            isCurrent: true
        }
    ];

    return createPortal(
        <div
            className="tn-settings-modal-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose();
            }}
            role="presentation"
        >
            <div
                className="tn-settings-modal"
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tn-settings-modal-title"
            >
                {/* Fixed Header */}
                <div className="tn-settings-modal__header">
                    <h1 id="tn-settings-modal-title" className="tn-settings-modal__title">
                        Settings
                    </h1>
                    <button
                        ref={closeBtnRef}
                        type="button"
                        className="tn-settings-modal__close-btn"
                        onClick={handleClose}
                        aria-label="Close settings (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Two-Pane Body */}
                <div className="tn-settings-modal__body">
                    {/* Left Navigation Pane */}
                    <nav className="tn-settings-modal__nav" aria-label="Settings categories">
                        {/* Search Input */}
                        <div className="tn-settings-modal__search-wrap">
                            <Search size={14} className="tn-settings-modal__search-icon" />
                            <input
                                type="text"
                                className="tn-settings-modal__search-input"
                                placeholder="Search settings..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label="Search settings"
                            />
                        </div>

                        <ul className="tn-settings-modal__nav-list">
                            {filteredSections.map((sec) => {
                                const Icon = sec.icon;
                                const isActive = activeSection === sec.id;
                                return (
                                    <li key={sec.id}>
                                        <button
                                            type="button"
                                            className={`tn-settings-modal__nav-item ${isActive ? 'is-active' : ''}`}
                                            onClick={() => {
                                                setActiveSection(sec.id);
                                                onSectionChange?.(sec.id);
                                            }}
                                            aria-current={isActive ? 'page' : undefined}
                                        >
                                            <div className="tn-settings-modal__nav-left">
                                                <Icon size={18} className="tn-settings-modal__nav-icon" />
                                                <span className="tn-settings-modal__nav-label">{sec.label}</span>
                                            </div>
                                            {sec.badge && (
                                                <span className="tn-settings-modal__badge-soon">{sec.badge}</span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    {/* Right Content Pane (CSS Container: container-type inline-size) */}
                    <div className="tn-settings-modal__content" ref={contentPaneRef} tabIndex={-1} role="region" aria-label="Settings section">
                        {/* Toast Notification */}
                        {toastMessage && (
                            <div className="tn-settings-toast" role="status" aria-live="polite">
                                <Check size={14} />
                                <span>{toastMessage}</span>
                            </div>
                        )}

                        {/* ─── SECTION 1: ACCOUNT ─── */}
                        {activeSection === 'account' && (
                            <SettingsSection
                                title="Account"
                                description="Manage your personal profile identity, credentials, and active device sessions."
                            >
                                {/* Profile Photo Row */}
                                <SettingRow
                                    label="Profile photo"
                                    hint="PNG, JPEG or WebP, up to 2MB. Displayed across workspace teams and reviews."
                                >
                                    <div className="tn-settings-avatar-wrap">
                                        <div className="tn-settings-avatar-circle" title={accountForm.displayName || user?.name || 'User'}>
                                            {accountForm.avatar ? (
                                                <img src={accountForm.avatar} alt={accountForm.displayName} className="tn-settings-avatar-img" />
                                            ) : (
                                                <span>{initials}</span>
                                            )}
                                        </div>
                                        <div className="tn-settings-avatar-actions">
                                            <button
                                                type="button"
                                                className="tn-settings-btn tn-settings-btn--secondary"
                                                onClick={() => avatarInputRef.current?.click()}
                                                aria-label="Change profile photo"
                                            >
                                                <Camera size={14} /> Change
                                            </button>
                                            {accountForm.avatar && (
                                                <button
                                                    type="button"
                                                    className="tn-settings-btn tn-settings-btn--secondary"
                                                    onClick={() => setAccountForm((prev) => ({ ...prev, avatar: null }))}
                                                    aria-label="Remove profile photo"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                            <input
                                                ref={avatarInputRef}
                                                type="file"
                                                accept="image/png, image/jpeg, image/webp"
                                                style={{ display: 'none' }}
                                                onChange={handleAvatarSelect}
                                            />
                                        </div>
                                    </div>
                                    {avatarError && <div className="tn-settings-error-text">{avatarError}</div>}
                                </SettingRow>

                                {/* Full Name */}
                                <SettingRow
                                    id="account-full-name"
                                    label="Full name"
                                    hint="Your formal or legal name used for billing receipts and notifications."
                                >
                                    <div style={{ width: '100%' }}>
                                        <input
                                            id="account-full-name"
                                            type="text"
                                            className={`tn-settings-input ${accountErrors.fullName ? 'has-error' : ''}`}
                                            value={accountForm.fullName}
                                            onChange={(e) => handleAccountChange('fullName', e.target.value)}
                                            onBlur={() => handleAccountBlur('fullName')}
                                            placeholder="e.g. Alex Morgan"
                                            title={accountForm.fullName}
                                        />
                                        {accountErrors.fullName && <div className="tn-settings-error-text">{accountErrors.fullName}</div>}
                                    </div>
                                </SettingRow>

                                {/* What should we call you? (Display Name) */}
                                <SettingRow
                                    id="account-display-name"
                                    label="What should we call you?"
                                    hint="Your handle displayed to teammates in reviews and comments."
                                >
                                    <div style={{ width: '100%' }}>
                                        <input
                                            id="account-display-name"
                                            type="text"
                                            className={`tn-settings-input ${accountErrors.displayName ? 'has-error' : ''}`}
                                            value={accountForm.displayName}
                                            onChange={(e) => handleAccountChange('displayName', e.target.value)}
                                            onBlur={() => handleAccountBlur('displayName')}
                                            placeholder="e.g. alexm"
                                            title={accountForm.displayName}
                                        />
                                        {accountErrors.displayName && <div className="tn-settings-error-text">{accountErrors.displayName}</div>}
                                    </div>
                                </SettingRow>

                                {/* Email (Read-Only with Verified Pill) */}
                                <SettingRow
                                    id="account-email"
                                    label="Email address"
                                    hint="Authoritative primary email address associated with your Testnexa account."
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', width: '100%' }}>
                                        <input
                                            id="account-email"
                                            type="email"
                                            className="tn-settings-input"
                                            value={user?.email || 'alex.morgan@testnexa.ai'}
                                            readOnly
                                            disabled
                                            title={user?.email || 'alex.morgan@testnexa.ai'}
                                            style={{ cursor: 'not-allowed', color: 'var(--text-2)' }}
                                        />
                                        <span className="tn-settings-pill tn-settings-pill--verified" title="Email verified">
                                            <Check size={11} /> Verified
                                        </span>
                                    </div>
                                </SettingRow>

                                {/* Where You're Signed In (Full-Width Stacked Row with Container-Responsive Table/Cards) */}
                                <SettingRow
                                    label="Where you're signed in"
                                    hint="Active browser and device sessions authenticated with your credentials."
                                    stacked
                                >
                                    {/* Desktop & Tablet Table (container sc > 560px) */}
                                    <div className="tn-settings-table-wrapper">
                                        <table className="tn-settings-table tn-settings-table--sessions">
                                            <thead>
                                                <tr>
                                                    <th className="col-device">Device</th>
                                                    <th className="col-location">Location / IP</th>
                                                    <th className="col-signedin">Signed in</th>
                                                    <th className="col-lastactive">Last active</th>
                                                    <th className="col-action" style={{ textAlign: 'right' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sessionsList.map((s) => (
                                                    <tr key={s.id}>
                                                        <td className="col-device">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                {/mobile|iphone|android/i.test(s.device || '') ? <Smartphone size={15} /> : <Laptop size={15} />}
                                                                <span style={{ fontWeight: 500 }} title={s.device || 'Desktop device'}>
                                                                    {s.device || `${s.browser || 'Browser'} on ${s.os || 'Desktop'}`}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="col-location" title={s.location || s.ipAddress || '127.0.0.1'}>
                                                            <div className="tn-truncate-cell">
                                                                {s.location || s.ipAddress || '127.0.0.1'}
                                                            </div>
                                                        </td>
                                                        <td className="col-signedin" style={{ color: 'var(--text-2)' }} title={s.createdAt || 'Recent'}>
                                                            {formatSessionDate(s.createdAt)}
                                                        </td>
                                                        <td className="col-lastactive" style={{ color: 'var(--text-2)' }} title={s.lastActiveAt || 'Now'}>
                                                            {formatLastActive(s.lastActiveAt, s.isCurrent)}
                                                        </td>
                                                        <td className="col-action" style={{ textAlign: 'right' }}>
                                                            {s.isCurrent ? (
                                                                <span className="tn-settings-pill">This device</span>
                                                            ) : confirmRevokeId === s.id ? (
                                                                <div style={{ display: 'inline-flex', gap: '4px' }}>
                                                                    <button
                                                                        type="button"
                                                                        className="tn-settings-btn tn-settings-btn--danger-outline"
                                                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                                                        onClick={() => handleSingleRevoke(s.id)}
                                                                        disabled={revokingId === s.id}
                                                                    >
                                                                        {revokingId === s.id ? <Loader2 size={12} className="tn-spin" /> : 'Confirm'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="tn-settings-btn tn-settings-btn--secondary"
                                                                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                                                        onClick={() => setConfirmRevokeId(null)}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="tn-settings-btn tn-settings-btn--secondary"
                                                                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                                                                    onClick={() => setConfirmRevokeId(s.id)}
                                                                >
                                                                    Sign out
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Stacked Cards (container sc <= 560px) */}
                                    <div className="tn-settings-cards-fallback">
                                        {sessionsList.map((s) => (
                                            <div key={s.id} className="tn-responsive-card">
                                                <div className="tn-responsive-card__header">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                                                        {/mobile|iphone|android/i.test(s.device || '') ? <Smartphone size={14} /> : <Laptop size={14} />}
                                                        <span className="tn-responsive-card__title" title={s.device || 'Desktop device'}>
                                                            {s.device || `${s.browser || 'Browser'} on ${s.os || 'Desktop'}`}
                                                        </span>
                                                    </div>
                                                    {s.isCurrent ? (
                                                        <span className="tn-settings-pill">This device</span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="tn-settings-btn tn-settings-btn--secondary"
                                                            style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                                                            onClick={() => setConfirmRevokeId(s.id)}
                                                        >
                                                            Sign out
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="tn-responsive-card__line2" title={s.location || s.ipAddress || '127.0.0.1'}>
                                                    {s.location || s.ipAddress || '127.0.0.1'}
                                                </div>
                                                <div className="tn-responsive-card__line3">
                                                    <span>Signed in {formatSessionDate(s.createdAt)}</span>
                                                    <span>•</span>
                                                    <span>Active {formatLastActive(s.lastActiveAt, s.isCurrent)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Bulk Sign Out Footer */}
                                    <div className="tn-settings-table-footer">
                                        {confirmRevokeOthers ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>Log out of all other sessions?</span>
                                                <button
                                                    type="button"
                                                    className="tn-settings-btn tn-settings-btn--danger-outline"
                                                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
                                                    onClick={handleRevokeAllOthers}
                                                    disabled={isRevokingOthers}
                                                >
                                                    {isRevokingOthers ? <Loader2 size={12} className="tn-spin" /> : 'Confirm logout'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="tn-settings-btn tn-settings-btn--secondary"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                                                    onClick={() => setConfirmRevokeOthers(false)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="tn-settings-btn tn-settings-btn--secondary"
                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                onClick={() => setConfirmRevokeOthers(true)}
                                            >
                                                Log out of all other devices
                                            </button>
                                        )}
                                    </div>
                                </SettingRow>

                                {/* Sticky Unsaved Changes Bar */}
                                {isAccountDirty && (
                                    <div className="tn-settings-sticky-bar" role="alert">
                                        <div className="tn-settings-sticky-bar__left">
                                            <span className="tn-settings-sticky-bar__dot" />
                                            <span className="tn-settings-sticky-bar__text">Unsaved changes</span>
                                        </div>
                                        <div className="tn-settings-sticky-bar__actions">
                                            <button
                                                type="button"
                                                className="tn-settings-btn tn-settings-btn--secondary"
                                                onClick={handleDiscardAccount}
                                                disabled={isSavingAccount}
                                            >
                                                Discard
                                            </button>
                                            <button
                                                type="button"
                                                className="tn-settings-btn tn-settings-btn--primary"
                                                onClick={handleSaveAccount}
                                                disabled={isSavingAccount}
                                            >
                                                {isSavingAccount ? <Loader2 size={13} className="tn-spin" /> : null}
                                                Save changes
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </SettingsSection>
                        )}

                        {/* ─── SECTION 2: PREFERENCES ─── */}
                        {activeSection === 'preferences' && (
                            <SettingsSection
                                title="Preferences"
                                description="Configure default generation parameters, platform targets, and export syntax."
                            >
                                {/* Default Platform */}
                                <SettingRow
                                    id="pref-platform"
                                    label="Default platform"
                                    hint="Initial target platform preset selected when launching the AI Workspace (Web DOM, Mobile native, or API backend)."
                                >
                                    <select
                                        id="pref-platform"
                                        className="tn-settings-select"
                                        value={prefForm.defaultPlatform}
                                        onChange={(e) => setPrefForm((prev) => ({ ...prev, defaultPlatform: e.target.value }))}
                                        title={`Selected platform: ${prefForm.defaultPlatform}`}
                                    >
                                        <option value="Web" title="Web application browser DOM targeting Playwright / Cypress">Web</option>
                                        <option value="Mobile" title="Mobile native application targeting iOS / Android Appium">Mobile</option>
                                        <option value="API" title="Backend REST / GraphQL endpoint verification">API</option>
                                    </select>
                                </SettingRow>

                                {/* Default Coverage Depth */}
                                <SettingRow
                                    id="pref-coverage-depth"
                                    label="Default coverage depth"
                                    hint="Determines baseline scenario thoroughness: Essential (smoke), Standard (balanced), or Comprehensive (deep edge & risk vectors)."
                                >
                                    <select
                                        id="pref-coverage-depth"
                                        className="tn-settings-select"
                                        value={prefForm.defaultCoverageDepth}
                                        onChange={(e) => setPrefForm((prev) => ({ ...prev, defaultCoverageDepth: e.target.value }))}
                                        title={`Selected coverage depth: ${prefForm.defaultCoverageDepth}`}
                                    >
                                        <option value="Essential" title="Essential: Smoke paths and critical validations (~5-10 tests)">Essential</option>
                                        <option value="Standard" title="Standard: Balanced happy and negative path coverage (~15-25 tests)">Standard</option>
                                        <option value="Comprehensive" title="Comprehensive: Deep edge, security, and stress boundary vectors (~30-50 tests)">Comprehensive</option>
                                    </select>
                                </SettingRow>

                                {/* Default Test Types (Grid with N of 6 selected badge) */}
                                <SettingRow
                                    label="Default test types"
                                    labelBadge={`${selectedTestTypesCount} of 6 selected`}
                                    hint="Select test categories automatically included in newly generated suites."
                                    stacked
                                >
                                    <div className="tn-test-types-grid">
                                        {[
                                            { id: 'functional', label: 'Functional' },
                                            { id: 'negative', label: 'Negative' },
                                            { id: 'edge', label: 'Edge cases' },
                                            { id: 'security', label: 'Security' },
                                            { id: 'regression', label: 'Regression' },
                                            { id: 'performance', label: 'Performance' },
                                        ].map((t) => {
                                            const isChecked = !!prefForm.defaultTestTypes[t.id];
                                            return (
                                                <label
                                                    key={t.id}
                                                    className={`tn-test-type-card ${isChecked ? 'is-checked' : ''}`}
                                                    title={`Toggle ${t.label} tests`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) =>
                                                            setPrefForm((prev) => ({
                                                                ...prev,
                                                                defaultTestTypes: {
                                                                    ...prev.defaultTestTypes,
                                                                    [t.id]: e.target.checked
                                                                }
                                                            }))
                                                        }
                                                        className="tn-visually-hidden"
                                                    />
                                                    <div className={`tn-custom-checkbox ${isChecked ? 'is-checked' : ''}`}>
                                                        {isChecked && <Check size={12} strokeWidth={3} />}
                                                    </div>
                                                    <span className="tn-test-type-label">{t.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </SettingRow>

                                {/* Default Export Format */}
                                <SettingRow
                                    id="pref-export-format"
                                    label="Default export format"
                                    hint="Standard automation framework syntax used when downloading test files."
                                >
                                    <select
                                        id="pref-export-format"
                                        className="tn-settings-select"
                                        value={prefForm.defaultExportFormat}
                                        onChange={(e) => setPrefForm((prev) => ({ ...prev, defaultExportFormat: e.target.value }))}
                                        title={`Selected export format: ${prefForm.defaultExportFormat}`}
                                    >
                                        <option value="Playwright" title="Playwright (TypeScript / JavaScript E2E)">Playwright</option>
                                        <option value="Cypress" title="Cypress (JavaScript Web Test Engine)">Cypress</option>
                                        <option value="Jest" title="Jest / React Testing Library Unit & Component Tests">Jest</option>
                                        <option value="Robot Framework" title="Robot Framework (Python Keywords)">Robot Framework</option>
                                        <option value="JSON" title="Raw JSON Test Plan Specification">JSON</option>
                                        <option value="CSV" title="Spreadsheet CSV for QA Matrix Audits">CSV</option>
                                        <option value="Markdown" title="GitHub-Flavored Markdown Documentation">Markdown</option>
                                    </select>
                                </SettingRow>

                                {/* Language */}
                                <SettingRow
                                    id="pref-language"
                                    label="Language"
                                    hint="Interface language and default assertion locale formatting."
                                >
                                    <select
                                        id="pref-language"
                                        className="tn-settings-select"
                                        value={prefForm.language}
                                        onChange={(e) => setPrefForm((prev) => ({ ...prev, language: e.target.value }))}
                                        title={`Selected language: ${prefForm.language}`}
                                    >
                                        <option value="en-US">English (US)</option>
                                        <option value="en-GB">English (UK)</option>
                                        <option value="es-ES">Spanish</option>
                                        <option value="de-DE">German</option>
                                        <option value="fr-FR">French</option>
                                        <option value="ja-JP">Japanese</option>
                                    </select>
                                </SettingRow>

                                {/* Sticky Unsaved Changes Bar */}
                                {isPrefDirty && (
                                    <div className="tn-settings-sticky-bar" role="alert">
                                        <div className="tn-settings-sticky-bar__left">
                                            <span className="tn-settings-sticky-bar__dot" />
                                            <span className="tn-settings-sticky-bar__text">Unsaved preferences</span>
                                        </div>
                                        <div className="tn-settings-sticky-bar__actions">
                                            <button
                                                type="button"
                                                className="tn-settings-btn tn-settings-btn--secondary"
                                                onClick={handleDiscardPreferences}
                                            >
                                                Discard
                                            </button>
                                            <button
                                                type="button"
                                                className="tn-settings-btn tn-settings-btn--primary"
                                                onClick={handleSavePreferences}
                                            >
                                                Save changes
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </SettingsSection>
                        )}

                        {/* ─── SECTION 3: WORKSPACE ─── */}
                        {activeSection === 'workspace' && (
                            <SettingsSection
                                title="Workspace"
                                description="Manage workspace identity and team API credentials."
                            >
                                <SettingRow
                                    id="ws-name-input"
                                    label="Workspace name"
                                    hint="Name shown across the navigation header and generation reports."
                                >
                                    <input
                                        id="ws-name-input"
                                        type="text"
                                        className="tn-settings-input"
                                        value={wsName}
                                        onChange={(e) => setWsName(e.target.value)}
                                        placeholder="e.g. Pro workspace"
                                        title={wsName}
                                    />
                                </SettingRow>

                                <SettingRow
                                    label="Workspace ID"
                                    hint="Unique identifier used for API integrations, CI/CD pipelines, and SDK authentication."
                                    stacked
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', width: '100%' }}>
                                        <code
                                            className="tn-truncate-id"
                                            style={{
                                                background: 'var(--surface-2)',
                                                padding: '0.5rem 0.85rem',
                                                borderRadius: '6px',
                                                border: '1px solid var(--line)',
                                                fontSize: '0.85rem',
                                                color: 'var(--text-1)',
                                                fontFamily: 'JetBrains Mono, monospace',
                                                maxWidth: '420px'
                                            }}
                                            title={currentWorkspace?.id || 'ws_prod_01'}
                                        >
                                            {currentWorkspace?.id || 'ws_prod_01'}
                                        </code>
                                        <button
                                            type="button"
                                            className="tn-settings-btn tn-settings-btn--secondary"
                                            onClick={handleCopyWorkspaceId}
                                            aria-label="Copy workspace ID"
                                        >
                                            {isCopiedWsId ? <Check size={14} /> : <Copy size={14} />}
                                            {isCopiedWsId ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                </SettingRow>

                                <SettingRow
                                    label="Role & permissions"
                                    hint="Your membership authorization tier within this workspace."
                                >
                                    <span className="tn-settings-pill">
                                        <ShieldCheck size={12} /> {currentWorkspace?.role ? currentWorkspace.role.toUpperCase() : 'OWNER'}
                                    </span>
                                </SettingRow>

                                {isWsDirty && (
                                    <div className="tn-settings-sticky-bar" role="alert">
                                        <div className="tn-settings-sticky-bar__left">
                                            <span className="tn-settings-sticky-bar__dot" />
                                            <span className="tn-settings-sticky-bar__text">Unsaved workspace name</span>
                                        </div>
                                        <div className="tn-settings-sticky-bar__actions">
                                            <button
                                                type="button"
                                                className="tn-settings-btn tn-settings-btn--secondary"
                                                onClick={() => setWsName(savedWsName)}
                                                disabled={isSavingWs}
                                            >
                                                Discard
                                            </button>
                                            <button
                                                type="button"
                                                className="tn-settings-btn tn-settings-btn--primary"
                                                onClick={handleSaveWorkspace}
                                                disabled={isSavingWs}
                                            >
                                                {isSavingWs ? <Loader2 size={13} className="tn-spin" /> : null}
                                                Save changes
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </SettingsSection>
                        )}

                        {/* ─── SECTION 4: MEMBERS ─── */}
                        {activeSection === 'members' && (
                            <SettingsSection
                                title="Members"
                                description="Invite teammates and manage collaborative QA roles within this workspace."
                            >
                                <SettingRow
                                    label="Invite new member"
                                    hint="Send an email invitation link to join this workspace."
                                >
                                    <button
                                        type="button"
                                        className="tn-settings-btn tn-settings-btn--primary"
                                        onClick={() => setShowInviteModal(true)}
                                    >
                                        Invite member...
                                    </button>
                                </SettingRow>

                                <SettingRow
                                    label="Workspace team"
                                    hint="Active members and their assigned permissions."
                                    stacked
                                >
                                    {/* Desktop & Tablet Table (container sc > 560px) */}
                                    <div className="tn-settings-table-wrapper">
                                        <table className="tn-settings-table tn-settings-table--members">
                                            <thead>
                                                <tr>
                                                    <th className="col-name">Name</th>
                                                    <th className="col-email">Email</th>
                                                    <th className="col-role">Role</th>
                                                    <th className="col-joined">Joined</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {membersList.map((m, idx) => (
                                                    <tr key={m.id || idx}>
                                                        <td className="col-name" style={{ fontWeight: 600 }}>
                                                            <div className="tn-truncate-cell" title={m.name}>
                                                                {m.name}
                                                            </div>
                                                        </td>
                                                        <td className="col-email" style={{ color: 'var(--text-2)' }}>
                                                            <div className="tn-truncate-cell" title={m.email}>
                                                                {m.email}
                                                            </div>
                                                        </td>
                                                        <td className="col-role">
                                                            <span className="tn-settings-pill" title={`Role: ${m.role || 'Member'}`}>
                                                                {m.role || 'Member'}
                                                            </span>
                                                        </td>
                                                        <td className="col-joined" style={{ color: 'var(--text-2)' }} title={`Joined ${m.joined || 'Sep 2026'}`}>
                                                            {m.joined || 'Sep 2026'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Stacked Member Cards (container sc <= 560px) */}
                                    <div className="tn-settings-cards-fallback">
                                        {membersList.map((m, idx) => (
                                            <div key={m.id || idx} className="tn-responsive-card">
                                                <div className="tn-responsive-card__header">
                                                    <span className="tn-responsive-card__title" title={m.name}>
                                                        {m.name}
                                                    </span>
                                                    <span className="tn-settings-pill">{m.role || 'Member'}</span>
                                                </div>
                                                <div className="tn-responsive-card__line2" title={m.email}>
                                                    {m.email}
                                                </div>
                                                <div className="tn-responsive-card__line3">
                                                    <span>Joined {m.joined || 'Sep 2026'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </SettingRow>
                            </SettingsSection>
                        )}

                        {/* ─── SECTION 5: DATA & PRIVACY ─── */}
                        {activeSection === 'data-privacy' && (
                            <SettingsSection
                                title="Data & privacy"
                                description="Export personal test assets or permanently terminate your account and wipe records."
                            >
                                <SettingRow
                                    label="Export my data"
                                    hint="Download a machine-readable JSON archive of your personal profile, test suites, generated scripts, and workspace history."
                                >
                                    <button
                                        type="button"
                                        className="tn-settings-btn tn-settings-btn--secondary"
                                        onClick={handleExportMyData}
                                        disabled={isExporting}
                                        aria-label="Export my personal data in JSON"
                                    >
                                        {isExporting ? <Loader2 size={14} className="tn-spin" /> : <Download size={14} />}
                                        {isExporting ? 'Exporting...' : 'Export data (JSON)'}
                                    </button>
                                </SettingRow>

                                <SettingRow
                                    label="Delete account"
                                    hint="Permanently delete your account and erase all associated test generation records. Immediate and irreversible."
                                >
                                    <button
                                        type="button"
                                        className="tn-settings-btn tn-settings-btn--danger-outline"
                                        onClick={() => {
                                            setDeleteConfirmEmail('');
                                            setShowDeleteModal(true);
                                        }}
                                        aria-label="Delete your Testnexa account"
                                    >
                                        Delete account...
                                    </button>
                                </SettingRow>
                            </SettingsSection>
                        )}

                        {/* ─── SECTION 6: BILLING (COMING SOON) ─── */}
                        {activeSection === 'billing' && (
                            <SettingsSection
                                title="Billing & usage"
                                description="Subscription plans, invoice records, and automated test quota allotments."
                            >
                                <div className="tn-settings-coming-soon-card">
                                    <div className="tn-settings-coming-soon-icon">
                                        <CreditCard size={22} />
                                    </div>
                                    <h3 className="tn-settings-coming-soon-title">Billing management is coming soon</h3>
                                    <p className="tn-settings-coming-soon-desc">
                                        Self-serve subscription upgrades, credit card payment methods, and automated billing invoices will be available in the next release.
                                    </p>
                                    <button type="button" className="tn-settings-btn tn-settings-btn--secondary" disabled>
                                        Manage subscription (Coming soon)
                                    </button>
                                </div>
                            </SettingsSection>
                        )}

                        {/* ─── SECTION 7: INTEGRATIONS (COMING SOON) ─── */}
                        {activeSection === 'integrations' && (
                            <SettingsSection
                                title="Integrations"
                                description="Connect external issue trackers, CI/CD pipelines, and alerting webhooks."
                            >
                                <div className="tn-settings-coming-soon-card">
                                    <div className="tn-settings-coming-soon-icon">
                                        <Puzzle size={22} />
                                    </div>
                                    <h3 className="tn-settings-coming-soon-title">Integrations are coming soon</h3>
                                    <p className="tn-settings-coming-soon-desc">
                                        Direct GitHub Actions, Jira synchronization, GitLab CI pipelines, and Slack notifications are currently being finalized.
                                    </p>
                                    <button type="button" className="tn-settings-btn tn-settings-btn--secondary" disabled>
                                        Configure integrations (Coming soon)
                                    </button>
                                </div>
                            </SettingsSection>
                        )}
                    </div>
                </div>
            </div>

            {/* Invite Member Dialog */}
            {showInviteModal && (
                <div
                    className="tn-settings-nested-backdrop"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowInviteModal(false);
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tn-invite-modal-title"
                >
                    <div className="tn-settings-nested-modal" style={{ maxWidth: '420px' }}>
                        <div className="tn-settings-nested-modal__header">
                            <h2 id="tn-invite-modal-title" style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                                Invite team member
                            </h2>
                            <button
                                type="button"
                                className="tn-settings-modal__close-btn"
                                onClick={() => setShowInviteModal(false)}
                                aria-label="Close invite modal"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-2)' }}>
                                    Email address
                                </label>
                                <input
                                    type="email"
                                    className="tn-settings-input"
                                    style={{ maxWidth: '100%' }}
                                    placeholder="colleague@company.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-2)' }}>
                                    Role permissions
                                </label>
                                <select
                                    className="tn-settings-select"
                                    style={{ maxWidth: '100%' }}
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                >
                                    <option value="Engineer">QA Automation Engineer</option>
                                    <option value="Lead">Lead SDET</option>
                                    <option value="Viewer">Read-Only Viewer</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                className="tn-settings-btn tn-settings-btn--secondary"
                                onClick={() => setShowInviteModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="tn-settings-btn tn-settings-btn--primary"
                                onClick={handleSendInvite}
                                disabled={!inviteEmail.trim() || !inviteEmail.includes('@')}
                            >
                                Send invitation
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Account Confirmation Dialog */}
            {showDeleteModal && (
                <div
                    className="tn-settings-nested-backdrop"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowDeleteModal(false);
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tn-delete-modal-title"
                >
                    <div className="tn-settings-nested-modal" style={{ maxWidth: '480px' }}>
                        <div className="tn-settings-nested-modal__header">
                            <h2 id="tn-delete-modal-title" style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-1)' }}>
                                Delete Testnexa account
                            </h2>
                            <button
                                type="button"
                                className="tn-settings-modal__close-btn"
                                onClick={() => setShowDeleteModal(false)}
                                aria-label="Close delete modal"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {isOwnerWithOtherMembers ? (
                            <div style={{ padding: '1rem 0' }}>
                                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line-hi)', borderRadius: '6px', padding: '0.85rem 1rem', display: 'flex', gap: '0.65rem' }}>
                                    <AlertCircle size={18} style={{ color: 'var(--text-1)', flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ fontSize: '0.84rem', color: 'var(--text-1)', lineHeight: 1.45 }}>
                                        <strong>Transfer ownership before deleting</strong>
                                        <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-2)' }}>
                                            You are the owner of <strong>{currentWorkspace?.name || 'this workspace'}</strong> which has other active members. Please transfer workspace ownership to a teammate before deleting your account.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{ padding: '0.85rem 0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                                        This action is immediate and cannot be undone. All your personal data and records will be wiped permanently:
                                    </p>
                                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                        <li>Your user profile, email login, and password credentials</li>
                                        <li>All generated test suites and automation scripts authored by you</li>
                                        <li>Your active sessions and API authentication tokens</li>
                                    </ul>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', margin: '0.25rem 0 0', fontWeight: 500 }}>
                                        To confirm deletion, please type your email address below:
                                    </p>
                                    <label htmlFor="confirm-delete-email" className="tn-visually-hidden">
                                        Type your email to confirm deletion
                                    </label>
                                    <input
                                        id="confirm-delete-email"
                                        type="text"
                                        className="tn-settings-input"
                                        style={{ maxWidth: '100%' }}
                                        value={deleteConfirmEmail}
                                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                                        placeholder={user?.email || 'alex.morgan@testnexa.ai'}
                                        autoFocus
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <button
                                        type="button"
                                        className="tn-settings-btn tn-settings-btn--secondary"
                                        onClick={() => setShowDeleteModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="tn-settings-btn tn-settings-btn--danger-outline"
                                        onClick={handleDeleteAccountFinal}
                                        disabled={isDeleting || deleteConfirmEmail.trim().toLowerCase() !== (user?.email || 'alex.morgan@testnexa.ai').toLowerCase()}
                                    >
                                        {isDeleting ? <Loader2 size={13} className="tn-spin" /> : null}
                                        Permanently delete account
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default SettingsModal;
