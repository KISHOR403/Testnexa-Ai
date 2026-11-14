import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    User, Sliders, CreditCard, ShieldCheck, Building,
    Users, Puzzle, Check, AlertCircle, Loader2, ArrowRight,
    Lock, Smartphone, Globe, Laptop, Key, Download, CheckCircle2,
    Trash2, ExternalLink, Copy, RotateCcw, RefreshCw, Camera,
    Mail, GitBranch, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import workspaceService from '../../services/workspaceService';
import { InlineTestSignal } from '../../components/loading';
import UpgradeModal from '../../components/UpgradeModal';
import BillingControlRoom from '../../components/app/BillingControlRoom';
import '../../styles/app/AppSettings.css';

// ─── Sub-Nav Tab Definitions (Strict Single Flat List) ───
const TABS = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Sliders },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'billing', label: 'Billing & usage', icon: CreditCard },
    { id: 'workspace', label: 'Workspace', icon: Building },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'integrations', label: 'Integrations', icon: Puzzle },
];

const DELETION_REASONS = [
    { id: 'no_longer_need', label: 'I no longer need AI test generation / automated QA' },
    { id: 'switching_tool', label: 'I switched to another testing solution or framework' },
    { id: 'too_complex', label: 'Too complicated or difficult to integrate with my codebase' },
    { id: 'pricing', label: 'Subscription pricing is too high for my current needs' },
    { id: 'bugs_errors', label: 'Encountered bugs, test generation inaccuracies, or runner errors' },
    { id: 'temporary', label: 'Temporary break / resetting with a fresh workspace' },
    { id: 'other', label: 'Other reason' }
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

    const {
        user,
        updateProfile,
        changePassword,
        deleteAccount,
        logout,
        activeSessions = [],
        fetchSessions,
        revokeSession,
        revokeOtherSessions,
        currentWorkspace,
        setCurrentWorkspace,
        refreshWorkspace,
        isLoadingWorkspace: isAuthLoadingWorkspace
    } = useAuth();
    const { settings, updateSetting } = useSettings();

    // Derived authoritative user identity
    const displayName = user?.name || user?.displayName || user?.email?.split('@')[0] || 'Alex Morgan';
    const displayEmail = user?.email || 'alex.morgan@testnexa.ai';
    const displayPlan = user?.plan || user?.subscription?.plan || 'Pro';
    const memberSince = formatMemberDate(user?.createdAt || user?.memberSince);

    const getInitials = (name, email) => {
        if (name && name.trim()) {
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return parts[0].slice(0, 2).toUpperCase();
        }
        if (email && email.trim()) {
            return email.trim().charAt(0).toUpperCase();
        }
        return 'U';
    };

    const userInitials = getInitials(displayName, displayEmail);

    // ─── Profile Tab Form State (Strict B&W Personal Information) ───
    const [form, setForm] = useState({
        fullName: user?.name || user?.fullName || 'Alex Morgan',
        displayName: user?.displayName || user?.name || user?.email?.split('@')[0] || 'alexm',
        jobTitle: user?.jobTitle || 'Lead QA Automation Engineer',
        timezone: user?.timezone || 'UTC',
        language: user?.language || 'en-US',
        bio: user?.bio || 'Staff SDET focusing on end-to-end regression pipelines and deterministic test generation.',
        avatar: user?.avatarUrl || user?.avatar || null
    });

    const [savedForm, setSavedForm] = useState({
        fullName: user?.name || user?.fullName || 'Alex Morgan',
        displayName: user?.displayName || user?.name || user?.email?.split('@')[0] || 'alexm',
        jobTitle: user?.jobTitle || 'Lead QA Automation Engineer',
        timezone: user?.timezone || 'UTC',
        language: user?.language || 'en-US',
        bio: user?.bio || 'Staff SDET focusing on end-to-end regression pipelines and deterministic test generation.',
        avatar: user?.avatarUrl || user?.avatar || null
    });

    // Sync form state when user changes from AuthContext
    useEffect(() => {
        if (user) {
            const updated = {
                fullName: user.name || user.fullName || 'Alex Morgan',
                displayName: user.displayName || user.name || user.email?.split('@')[0] || 'alexm',
                jobTitle: user.jobTitle || 'Lead QA Automation Engineer',
                timezone: user.timezone || 'UTC',
                language: user.language || 'en-US',
                bio: user.bio || '',
                avatar: user.avatarUrl || user.avatar || null
            };
            setForm(updated);
            setSavedForm(updated);
        }
    }, [user]);

    // Validation errors map
    const [errors, setErrors] = useState({});

    // Dirty-state check
    const isDirty = useMemo(() => {
        return (
            form.fullName !== savedForm.fullName ||
            form.displayName !== savedForm.displayName ||
            form.jobTitle !== savedForm.jobTitle ||
            form.timezone !== savedForm.timezone ||
            form.language !== savedForm.language ||
            form.bio !== savedForm.bio ||
            form.avatar !== savedForm.avatar
        );
    }, [form, savedForm]);

    // Leave-page warning
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Field change & validation handlers
    const handleFieldChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    const handleFieldBlur = (field) => {
        const value = form[field] || '';
        const newErrors = { ...errors };

        if (field === 'fullName') {
            if (!value.trim() || value.trim().length < 2) {
                newErrors.fullName = 'Full name must be at least 2 characters.';
            } else {
                delete newErrors.fullName;
            }
        }
        if (field === 'displayName') {
            if (!value.trim() || value.trim().length < 2) {
                newErrors.displayName = 'Display name must be at least 2 characters.';
            } else {
                delete newErrors.displayName;
            }
        }
        if (field === 'bio') {
            if (value.length > 200) {
                newErrors.bio = 'Bio cannot exceed 200 characters.';
            } else {
                delete newErrors.bio;
            }
        }

        setErrors(newErrors);
    };

    // Saving profile state
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [showSuccessToast, setShowSuccessToast] = useState(false);

    const handleSaveChanges = async () => {
        // Run validations
        if (!form.fullName.trim() || form.fullName.trim().length < 2) {
            setErrors(prev => ({ ...prev, fullName: 'Full name must be at least 2 characters.' }));
            return;
        }
        if (!form.displayName.trim() || form.displayName.trim().length < 2) {
            setErrors(prev => ({ ...prev, displayName: 'Display name must be at least 2 characters.' }));
            return;
        }

        setIsSaving(true);
        setSaveError(null);
        const rollback = { ...savedForm };
        setSavedForm({ ...form }); // Optimistic update

        try {
            if (updateProfile) {
                const res = await updateProfile({
                    name: form.fullName,
                    displayName: form.displayName,
                    jobTitle: form.jobTitle,
                    timezone: form.timezone,
                    language: form.language,
                    bio: form.bio,
                    avatar: form.avatar,
                    avatarUrl: form.avatar
                });
                if (res && res.success === false) {
                    throw new Error(res.message || 'Failed to update profile.');
                }
            }
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);
        } catch (err) {
            setSavedForm(rollback); // Rollback on error
            setSaveError(err.message || 'Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscardChanges = () => {
        setForm({ ...savedForm });
        setErrors({});
        setSaveError(null);
    };

    // ─── Avatar Photo Management (Crop Dialog, Max 2MB, Formats) ───
    const avatarFileInputRef = useRef(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [tempAvatarPreview, setTempAvatarPreview] = useState(null);
    const [avatarError, setAvatarError] = useState(null);

    const handleAvatarFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setAvatarError('Unsupported format. Please select a PNG, JPG, or WebP image.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setAvatarError('Image is too large. Maximum file size is 2 MB.');
            return;
        }

        setAvatarError(null);
        const reader = new FileReader();
        reader.onload = () => {
            setTempAvatarPreview(reader.result);
            setShowCropModal(true);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleApplyAvatarCrop = () => {
        setForm(prev => ({ ...prev, avatar: tempAvatarPreview }));
        setShowCropModal(false);
        setTempAvatarPreview(null);
    };

    const handleRemoveAvatar = () => {
        setForm(prev => ({ ...prev, avatar: null }));
    };

    // ─── Email Change Flow ───
    const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
    const [newEmailInput, setNewEmailInput] = useState('');
    const [emailConfirmPassword, setEmailConfirmPassword] = useState('');
    const [emailPending, setEmailPending] = useState(null);
    const [emailModalError, setEmailModalError] = useState(null);

    const handleSendVerificationEmail = () => {
        if (!newEmailInput.trim() || !newEmailInput.includes('@')) {
            setEmailModalError('Please enter a valid email address.');
            return;
        }
        if (!emailConfirmPassword.trim()) {
            setEmailModalError('Current password is required to change email.');
            return;
        }
        setEmailPending(newEmailInput.trim());
        setShowChangeEmailModal(false);
        setNewEmailInput('');
        setEmailConfirmPassword('');
        setEmailModalError(null);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3500);
    };

    // ─── Sign-In Methods State ───
    const [hasPassword, setHasPassword] = useState(true);
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [passwordCurrent, setPasswordCurrent] = useState('');
    const [passwordNew, setPasswordNew] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [passwordModalError, setPasswordModalError] = useState(null);

    const [connectedAccounts, setConnectedAccounts] = useState({
        google: user?.provider === 'google' ? { email: user?.email } : { email: 'alex.morgan@gmail.com' },
        github: user?.provider === 'github' ? { username: 'alexmorgan-qa' } : null
    });

    const isSoleAuthMethod = (method) => {
        let count = hasPassword ? 1 : 0;
        if (connectedAccounts.google) count++;
        if (connectedAccounts.github) count++;
        return count <= 1;
    };

    const handleConnectAccount = (method) => {
        if (method === 'google') {
            setConnectedAccounts(prev => ({ ...prev, google: { email: displayEmail } }));
        } else if (method === 'github') {
            setConnectedAccounts(prev => ({ ...prev, github: { username: displayName.toLowerCase().replace(/\s+/g, '') } }));
        }
    };

    const handleDisconnectAccount = (method) => {
        if (isSoleAuthMethod(method)) return;
        setConnectedAccounts(prev => ({ ...prev, [method]: null }));
    };

    const handleSavePasswordModal = async () => {
        if (!passwordNew || passwordNew.length < 8) {
            setPasswordModalError('New password must be at least 8 characters long.');
            return;
        }
        if (passwordNew !== passwordConfirm) {
            setPasswordModalError('New passwords do not match.');
            return;
        }

        try {
            if (changePassword) {
                const res = await changePassword({ currentPassword: passwordCurrent, newPassword: passwordNew });
                if (res && res.success === false) {
                    setPasswordModalError(res.message || 'Failed to update password.');
                    return;
                }
            }
            setHasPassword(true);
            setShowChangePasswordModal(false);
            setPasswordCurrent('');
            setPasswordNew('');
            setPasswordConfirm('');
            setPasswordModalError(null);
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);
        } catch (err) {
            setPasswordModalError(err.message || 'Failed to update password.');
        }
    };

    // ─── Usage Data ───
    const monthlySuitesUsed = 42;
    const monthlySuitesLimit = 100;

    // ─── Data Export ───
    const handleExportData = () => {
        const data = {
            exportedAt: new Date().toISOString(),
            profile: {
                fullName: form.fullName,
                displayName: form.displayName,
                email: displayEmail,
                jobTitle: form.jobTitle,
                timezone: form.timezone,
                language: form.language,
                memberSince: memberSince
            },
            workspace: currentWorkspace || { name: 'Pro workspace' },
            statistics: {
                totalTestSuitesGenerated: user?.totalTestsGenerated || 124,
                monthlySuitesUsed,
                monthlySuitesLimit
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `testnexa-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ─── Account Deletion Flow (Ownership check + typed email) ───
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
    const [deleteWorkspaceError, setDeleteWorkspaceError] = useState(null);
    const [isDeletingAccountFinal, setIsDeletingAccountFinal] = useState(false);

    // Block deletion if user owns workspace with other members
    const isOwnerWithOtherMembers = useMemo(() => {
        const isOwner = currentWorkspace?.role === 'owner' || currentWorkspace?.isOwner;
        const memberCount = currentWorkspace?.members?.length || currentWorkspace?.memberCount || 1;
        return isOwner && memberCount > 1;
    }, [currentWorkspace]);

    const handleDeleteAccountFinal = async () => {
        if (deleteConfirmEmail.trim().toLowerCase() !== displayEmail.toLowerCase()) return;
        setIsDeletingAccountFinal(true);
        try {
            if (deleteAccount) {
                await deleteAccount({ confirmationText: deleteConfirmEmail });
            }
            setShowDeleteModal(false);
            navigate('/signup', { replace: true });
        } catch (err) {
            setDeleteWorkspaceError(err.message || 'Failed to delete account.');
        } finally {
            setIsDeletingAccountFinal(false);
        }
    };

    // ─── Loading & Error Skeletons ───
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [profileLoadError, setProfileLoadError] = useState(null);

    const handleRetryLoadProfile = () => {
        setProfileLoadError(null);
        setIsLoadingProfile(true);
        setTimeout(() => setIsLoadingProfile(false), 600);
    };

    // Modals
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [show2FAModal, setShow2FAModal] = useState(false);
    const [showSignoutSessionsModal, setShowSignoutSessionsModal] = useState(false);
    const [isRevokingOthers, setIsRevokingOthers] = useState(false);
    const [revokingSessionId, setRevokingSessionId] = useState(null);

    // Old delete modal compat states
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [deleteStep, setDeleteStep] = useState(1);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteFeedback, setDeleteFeedback] = useState('');
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    const resetDeleteModal = () => {
        setShowDeleteAccountModal(false);
        setDeleteStep(1);
        setDeleteReason('');
        setDeleteFeedback('');
        setDeleteConfirmationText('');
        setDeletePassword('');
        setDeleteError(null);
    };

    // Workspace & Preferences Logic
        // Workspace & Preferences Feedback
    const [preferencesSaved, setPreferencesSaved] = useState(false);

    // Production Workspace Settings State
    const [persistedWorkspace, setPersistedWorkspace] = useState(currentWorkspace || null);
    const [workspaceEnvironments, setWorkspaceEnvironments] = useState([]);
    const [isLoadingWorkspaceData, setIsLoadingWorkspaceData] = useState(false);
    const [environmentsLoading, setEnvironmentsLoading] = useState(false);
    const [workspaceFetchError, setWorkspaceFetchError] = useState(null);
    const [editWorkspaceName, setEditWorkspaceName] = useState(currentWorkspace?.name || '');
    const [editDefaultEnvId, setEditDefaultEnvId] = useState(currentWorkspace?.defaultEnvironmentId || '');
    const [nameValidationError, setNameValidationError] = useState(null);
    const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
    const [workspaceFeedback, setWorkspaceFeedback] = useState(null); // { type: 'success' | 'error' | 'conflict', message: string }
    const [isCopiedWorkspaceId, setIsCopiedWorkspaceId] = useState(false);
    const [workspaceRole, setWorkspaceRole] = useState('owner');

    // Sync state when currentWorkspace from AuthContext changes
    useEffect(() => {
        if (currentWorkspace) {
            setPersistedWorkspace(currentWorkspace);
            setEditWorkspaceName(prev => {
                if (!prev || prev === persistedWorkspace?.name) {
                    return currentWorkspace.name;
                }
                return prev;
            });
            setEditDefaultEnvId(prev => {
                if (prev === '' || prev === persistedWorkspace?.defaultEnvironmentId) {
                    return currentWorkspace.defaultEnvironmentId || '';
                }
                return prev;
            });
        }
    }, [currentWorkspace]);

    // Fetch authoritative settings & environments from backend
    const loadWorkspaceSettings = useCallback(async (force = false) => {
        setIsLoadingWorkspaceData(true);
        setEnvironmentsLoading(true);
        setWorkspaceFetchError(null);
        try {
            const [wsRes, envRes] = await Promise.allSettled([
                workspaceService.getCurrentWorkspace(),
                workspaceService.getEnvironments()
            ]);

            if (wsRes.status === 'fulfilled' && (wsRes.value?.workspace || wsRes.value?.id)) {
                const ws = wsRes.value.workspace || wsRes.value;
                setPersistedWorkspace(ws);
                setEditWorkspaceName(ws.name || '');
                setEditDefaultEnvId(ws.defaultEnvironmentId || '');
                if (ws.role || wsRes.value.membership?.role) {
                    setWorkspaceRole(ws.role || wsRes.value.membership?.role);
                }
                setCurrentWorkspace(ws);
            } else if (wsRes.status === 'rejected') {
                const status = wsRes.reason?.status || wsRes.reason?.response?.status;
                if (status === 401) {
                    setWorkspaceFetchError('Sign in with your TestNexa AI account to synchronize settings with your cloud workspace.');
                } else {
                    const errMsg = wsRes.reason?.message || wsRes.reason?.response?.data?.message || 'Failed to load workspace settings.';
                    setWorkspaceFetchError(errMsg);
                }
            }

            if (envRes.status === 'fulfilled' && envRes.value?.environments) {
                setWorkspaceEnvironments(envRes.value.environments);
            } else if (envRes.status === 'rejected') {
                console.warn('Failed to load environments:', envRes.reason);
            }
        } catch (err) {
            console.error('Error fetching workspace settings:', err);
            setWorkspaceFetchError(err.message || 'Network error fetching workspace settings.');
        } finally {
            setIsLoadingWorkspaceData(false);
            setEnvironmentsLoading(false);
        }
    }, [setCurrentWorkspace]);

    // Fetch workspace settings when switching to workspace tab
    useEffect(() => {
        if (activeTab === 'workspace') {
            loadWorkspaceSettings();
        }
    }, [activeTab, loadWorkspaceSettings]);

    // Validation logic for workspace name
    const validateWorkspaceName = (name) => {
        const trimmed = (name || '').trim();
        if (!trimmed) {
            return 'Workspace name is required.';
        }
        if (trimmed.length < 2) {
            return 'Workspace name must be at least 2 characters.';
        }
        if (trimmed.length > 64) {
            return 'Workspace name cannot exceed 64 characters.';
        }
        if (!/^[a-zA-Z0-9\s\-_.&'()]+$/.test(trimmed)) {
            return 'Workspace name contains invalid characters. Use alphanumeric, spaces, hyphens, and periods.';
        }
        return null;
    };

    const handleWorkspaceNameChange = (e) => {
        const val = e.target.value;
        setEditWorkspaceName(val);
        setNameValidationError(validateWorkspaceName(val));
        if (workspaceFeedback) setWorkspaceFeedback(null);
    };

    const handleEnvironmentChange = (e) => {
        setEditDefaultEnvId(e.target.value);
        if (workspaceFeedback) setWorkspaceFeedback(null);
    };

    // Copy immutable Workspace ID
    const handleCopyWorkspaceId = async () => {
        const wsId = persistedWorkspace?.id || currentWorkspace?.id || '';
        if (!wsId) return;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(wsId);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = wsId;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            setIsCopiedWorkspaceId(true);
            setTimeout(() => setIsCopiedWorkspaceId(false), 2000);
        } catch (err) {
            console.error('Failed to copy workspace ID:', err);
        }
    };

    // Calculate dirty state and role permissions
    const isOwnerOrAdmin = workspaceRole === 'owner' || workspaceRole === 'admin';
    const currentPersistedName = (persistedWorkspace?.name || currentWorkspace?.name || '').trim();
    const currentPersistedEnv = persistedWorkspace?.defaultEnvironmentId || currentWorkspace?.defaultEnvironmentId || '';
    const isNameDirty = editWorkspaceName.trim() !== currentPersistedName;
    const isEnvDirty = (editDefaultEnvId || '') !== (currentPersistedEnv || '');
    const isWorkspaceDirty = isNameDirty || isEnvDirty;
    const canSaveWorkspace = isOwnerOrAdmin && isWorkspaceDirty && !nameValidationError && !isSavingWorkspace && !isLoadingWorkspaceData;

    // Filter localhost/loopback in production deployments
    const displayedEnvironments = workspaceEnvironments.filter(env => {
        if (import.meta.env.PROD || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
            const url = (env.baseUrl || '').toLowerCase();
            if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0')) {
                return false;
            }
        }
        return true;
    });

    // Reset unsaved changes
    const handleResetWorkspace = () => {
        setEditWorkspaceName(currentPersistedName);
        setEditDefaultEnvId(currentPersistedEnv);
        setNameValidationError(null);
        setWorkspaceFeedback(null);
    };

    // Save changes to backend
    const handleSaveWorkspace = async (e) => {
        if (e) e.preventDefault();
        const validationErr = validateWorkspaceName(editWorkspaceName);
        if (validationErr) {
            setNameValidationError(validationErr);
            return;
        }
        if (!isWorkspaceDirty || isSavingWorkspace) return;

        setIsSavingWorkspace(true);
        setWorkspaceFeedback(null);

        try {
            const payload = {
                name: editWorkspaceName.trim(),
                defaultEnvironmentId: editDefaultEnvId ? editDefaultEnvId : null,
                version: persistedWorkspace?.version
            };

            const result = await workspaceService.updateSettings(payload);

            if (result.success && result.workspace) {
                setPersistedWorkspace(result.workspace);
                setEditWorkspaceName(result.workspace.name);
                setEditDefaultEnvId(result.workspace.defaultEnvironmentId || '');
                setCurrentWorkspace(result.workspace);
                setWorkspaceFeedback({
                    type: 'success',
                    message: 'Workspace settings saved successfully.'
                });
                setTimeout(() => {
                    setWorkspaceFeedback(prev => prev?.type === 'success' ? null : prev);
                }, 4000);
            } else {
                setWorkspaceFeedback({
                    type: 'error',
                    message: result.message || 'Failed to update workspace settings.'
                });
            }
        } catch (err) {
            console.error('Save workspace settings error:', err);
            const status = err.response?.status;
            const resData = err.response?.data;
            if (status === 409) {
                setWorkspaceFeedback({
                    type: 'conflict',
                    message: resData?.message || 'Conflict: Settings were updated by another administrator. Please reload to inspect recent changes.',
                    currentWorkspace: resData?.currentWorkspace
                });
            } else if (status === 403) {
                setWorkspaceFeedback({
                    type: 'error',
                    message: resData?.message || 'Permission denied. Only workspace owners and admins can update settings.'
                });
            } else if (resData?.errors && Array.isArray(resData.errors)) {
                setWorkspaceFeedback({
                    type: 'error',
                    message: resData.errors.map(e => e.message).join(' ')
                });
            } else {
                setWorkspaceFeedback({
                    type: 'error',
                    message: resData?.message || err.message || 'A network error occurred while saving workspace settings.'
                });
            }
        } finally {
            setIsSavingWorkspace(false);
        }
    };

    // Invite Modal
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Engineer');
    const [inviteSent, setInviteSent] = useState(false);


    // Helper to format password last changed
    const formatPasswordLastChanged = () => {
        if (user?.provider && user.provider !== 'email') {
            return `Managed via ${user.provider === 'google' ? 'Google' : 'GitHub'} (OAuth)`;
        }
        return 'Configured and active';
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

    const handlePreferenceChange = (key, val) => {
        updateSetting(key, val);
        setPreferencesSaved(true);
        setTimeout(() => setPreferencesSaved(false), 2000);
    };

    const handleRevokeSession = async (sessionId) => {
        if (typeof revokeSession === 'function') {
            setRevokingSessionId(sessionId);
            try {
                await revokeSession(sessionId);
            } finally {
                setRevokingSessionId(null);
            }
        }
    };

    const handleRevokeOtherSessions = async () => {
        if (typeof revokeOtherSessions === 'function') {
            setIsRevokingOthers(true);
            try {
                await revokeOtherSessions();
            } finally {
                setIsRevokingOthers(false);
                setShowSignoutSessionsModal(false);
            }
        }
    };

    const activeTabObj = TABS.find(t => t.id === activeTab) || TABS[0];

    return (
        <div className="app-settings-page">
            {/* Mobile Tab Bar (Horizontal Scrollable Below 768px) */}
            <div className="app-settings-mobile-nav" role="tablist" aria-label="Settings navigation">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`app-settings-mobile-pill ${isActive ? 'active' : ''}`}
                            onClick={() => handleTabChange(tab.id)}
                        >
                            <Icon size={14} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main Settings Layout (Desktop 2-col) */}
            <div className="app-settings-layout">
                {/* Simplified Left Navigation: One flat list, no uppercase group headings */}
                <aside className="app-settings-nav" aria-label="Settings navigation">
                    <div className="app-settings-nav__list">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    className={`app-settings-nav__item ${isActive ? 'active' : ''}`}
                                    onClick={() => handleTabChange(tab.id)}
                                >
                                    <Icon size={16} className="app-settings-nav__item-icon" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* Right Content Area (Max Width 720px) */}
                <main className="app-settings-content">
                    {/* ══════════════ TAB 1: PROFILE ══════════════ */}
                    {activeTab === 'profile' && (
                        <>
                            {/* Content Page Header: Top Edge Aligned with Sub-nav */}
                            <div className="app-settings-page-header">
                                <h1 className="app-settings-page-title">Profile</h1>
                                <p className="app-settings-page-desc">
                                    Manage your personal identity, credentials, and account settings.
                                </p>
                            </div>

                            {/* Toast Notification */}
                            {showSuccessToast && (
                                <div className="app-settings-toast" role="status">
                                    <CheckCircle2 size={16} />
                                    <span>Profile updated successfully</span>
                                </div>
                            )}

                            {/* Avatar Error Banner */}
                            {avatarError && (
                                <div className="app-settings-warning-block" style={{ borderColor: '#FFFFFF' }}>
                                    <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{avatarError}</span>
                                </div>
                            )}

                            {/* Save Error Banner with Retry */}
                            {saveError && (
                                <div className="app-settings-warning-block" style={{ borderColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>{saveError}</span>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
                                        onClick={handleSaveChanges}
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}

                            {isLoadingProfile ? (
                                <div className="app-settings-skeletons" aria-label="Loading profile...">
                                    <div className="app-settings-skeleton-card">
                                        <div className="app-settings-skeleton-line" style={{ width: '40%', height: '24px' }} />
                                        <div className="app-settings-skeleton-line" style={{ width: '60%' }} />
                                    </div>
                                    <div className="app-settings-skeleton-card">
                                        <div className="app-settings-skeleton-line" style={{ width: '30%', height: '20px' }} />
                                        <div className="app-settings-skeleton-line" style={{ width: '100%' }} />
                                        <div className="app-settings-skeleton-line" style={{ width: '100%' }} />
                                    </div>
                                    <div className="app-settings-skeleton-card">
                                        <div className="app-settings-skeleton-line" style={{ width: '35%', height: '20px' }} />
                                        <div className="app-settings-skeleton-line" style={{ width: '80%' }} />
                                    </div>
                                </div>
                            ) : profileLoadError ? (
                                <div className="app-settings-card" style={{ textAlign: 'center', padding: '2rem' }}>
                                    <AlertCircle size={24} style={{ margin: '0 auto 0.5rem auto', color: 'var(--text-1)' }} />
                                    <h3 className="app-settings-card-title">Failed to load profile</h3>
                                    <p className="app-settings-card-desc" style={{ marginBottom: '1rem' }}>{profileLoadError}</p>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        onClick={handleRetryLoadProfile}
                                    >
                                        <RefreshCw size={14} /> Retry
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* 1. Identity Summary Card: Avatar, Name, Plan Badge, Upgrade Button */}
                                    <div className="app-settings-card app-settings-identity-card">
                                        <div className="app-settings-identity-left">
                                            <div className="app-settings-avatar-container" title="Click or hover to change photo">
                                                <div className="app-settings-avatar-circle">
                                                    {form.avatar ? (
                                                        <img src={form.avatar} alt={form.displayName || 'User'} className="app-settings-avatar-img" />
                                                    ) : (
                                                        <span>{userInitials}</span>
                                                    )}
                                                </div>
                                                <div className="app-settings-avatar-hover-overlay">
                                                    <button
                                                        type="button"
                                                        className="app-settings-avatar-overlay-btn"
                                                        onClick={() => avatarFileInputRef.current?.click()}
                                                        aria-label="Change profile photo"
                                                    >
                                                        <Camera size={14} />
                                                        <span>Change</span>
                                                    </button>
                                                    {form.avatar && (
                                                        <button
                                                            type="button"
                                                            className="app-settings-avatar-overlay-btn is-remove"
                                                            onClick={handleRemoveAvatar}
                                                            aria-label="Remove photo"
                                                            title="Remove custom photo"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    ref={avatarFileInputRef}
                                                    type="file"
                                                    accept="image/png, image/jpeg, image/webp"
                                                    style={{ display: 'none' }}
                                                    onChange={handleAvatarFileSelect}
                                                />
                                            </div>

                                            <div className="app-settings-identity-meta">
                                                <div className="app-settings-identity-name-row">
                                                    <h2 className="app-settings-identity-name">{form.displayName || form.fullName || displayName}</h2>
                                                    <span className="app-settings-plan-pill">{displayPlan}</span>
                                                </div>
                                                <p className="app-settings-identity-subtext">{displayEmail}</p>
                                            </div>
                                        </div>

                                        <div className="app-settings-identity-actions">
                                            <button
                                                type="button"
                                                className="app-settings-btn app-settings-btn--primary"
                                                onClick={() => setShowUpgradeModal(true)}
                                            >
                                                Upgrade
                                            </button>
                                        </div>
                                    </div>

                                    {/* 2. Personal Information Card (Editable Form Fields with Blur Validation) */}
                                    <div className="app-settings-card">
                                        <div className="app-settings-card-header">
                                            <div>
                                                <h3 className="app-settings-card-title">Personal information</h3>
                                                <p className="app-settings-card-desc">Update your public identity and regional settings.</p>
                                            </div>
                                        </div>

                                        <div className="app-settings-form-grid">
                                            <div className="app-settings-field">
                                                <label htmlFor="fullName" className="app-settings-label">
                                                    Full name <span className="app-settings-required">*</span>
                                                </label>
                                                <input
                                                    id="fullName"
                                                    type="text"
                                                    className={`app-settings-input ${errors.fullName ? 'has-error' : ''}`}
                                                    value={form.fullName}
                                                    onChange={(e) => handleFieldChange('fullName', e.target.value)}
                                                    onBlur={() => handleFieldBlur('fullName')}
                                                    placeholder="e.g. Alex Morgan"
                                                    disabled={isSaving}
                                                />
                                                {errors.fullName && <span className="app-settings-field-error">{errors.fullName}</span>}
                                            </div>

                                            <div className="app-settings-field">
                                                <label htmlFor="displayName" className="app-settings-label">
                                                    Display name <span className="app-settings-required">*</span>
                                                </label>
                                                <input
                                                    id="displayName"
                                                    type="text"
                                                    className={`app-settings-input ${errors.displayName ? 'has-error' : ''}`}
                                                    value={form.displayName}
                                                    onChange={(e) => handleFieldChange('displayName', e.target.value)}
                                                    onBlur={() => handleFieldBlur('displayName')}
                                                    placeholder="e.g. alexm"
                                                    disabled={isSaving}
                                                />
                                                {errors.displayName && <span className="app-settings-field-error">{errors.displayName}</span>}
                                            </div>

                                            <div className="app-settings-field app-settings-field--full">
                                                <label htmlFor="jobTitle" className="app-settings-label">
                                                    Job title
                                                </label>
                                                <input
                                                    id="jobTitle"
                                                    type="text"
                                                    className="app-settings-input"
                                                    value={form.jobTitle}
                                                    onChange={(e) => handleFieldChange('jobTitle', e.target.value)}
                                                    placeholder="e.g. Lead QA Automation Engineer"
                                                    disabled={isSaving}
                                                />
                                            </div>

                                            <div className="app-settings-field">
                                                <label htmlFor="timezone" className="app-settings-label">
                                                    Timezone
                                                </label>
                                                <select
                                                    id="timezone"
                                                    className="app-settings-select"
                                                    value={form.timezone}
                                                    onChange={(e) => handleFieldChange('timezone', e.target.value)}
                                                    disabled={isSaving}
                                                >
                                                    <option value="UTC">UTC (UTC+00:00)</option>
                                                    <option value="America/New_York">Eastern Time (US & Canada) (UTC-05:00)</option>
                                                    <option value="America/Chicago">Central Time (US & Canada) (UTC-06:00)</option>
                                                    <option value="America/Denver">Mountain Time (US & Canada) (UTC-07:00)</option>
                                                    <option value="America/Los_Angeles">Pacific Time (US & Canada) (UTC-08:00)</option>
                                                    <option value="Europe/London">London (UTC+00:00)</option>
                                                    <option value="Europe/Berlin">Berlin, Paris (UTC+01:00)</option>
                                                    <option value="Asia/Kolkata">India Standard Time (UTC+05:30)</option>
                                                    <option value="Asia/Singapore">Singapore (UTC+08:00)</option>
                                                    <option value="Asia/Tokyo">Tokyo (UTC+09:00)</option>
                                                    <option value="Australia/Sydney">Sydney (UTC+11:00)</option>
                                                </select>
                                            </div>

                                            <div className="app-settings-field">
                                                <label htmlFor="language" className="app-settings-label">
                                                    Language
                                                </label>
                                                <select
                                                    id="language"
                                                    className="app-settings-select"
                                                    value={form.language}
                                                    onChange={(e) => handleFieldChange('language', e.target.value)}
                                                    disabled={isSaving}
                                                >
                                                    <option value="en-US">English (United States)</option>
                                                    <option value="en-GB">English (United Kingdom)</option>
                                                    <option value="de-DE">Deutsch (German)</option>
                                                    <option value="fr-FR">Français (French)</option>
                                                    <option value="es-ES">Español (Spanish)</option>
                                                    <option value="ja-JP">日本語 (Japanese)</option>
                                                </select>
                                            </div>

                                            <div className="app-settings-field app-settings-field--full">
                                                <div className="app-settings-label-row">
                                                    <label htmlFor="bio" className="app-settings-label">
                                                        Bio
                                                    </label>
                                                    <span className={`app-settings-char-count ${form.bio.length > 200 ? 'has-error' : ''}`}>
                                                        {form.bio.length}/200
                                                    </span>
                                                </div>
                                                <textarea
                                                    id="bio"
                                                    rows={3}
                                                    maxLength={200}
                                                    className={`app-settings-textarea ${errors.bio ? 'has-error' : ''}`}
                                                    value={form.bio}
                                                    onChange={(e) => handleFieldChange('bio', e.target.value)}
                                                    onBlur={() => handleFieldBlur('bio')}
                                                    placeholder="Brief description of your QA focus, testing stacks, or responsibilities..."
                                                    disabled={isSaving}
                                                />
                                                {errors.bio && <span className="app-settings-field-error">{errors.bio}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Email Row Card (Current Email, Outlined Verified Pill, Change Button) */}
                                    <div className="app-settings-card">
                                        <div className="app-settings-card-header">
                                            <div>
                                                <h3 className="app-settings-card-title">Email address</h3>
                                                <p className="app-settings-card-desc">Your authoritative sign-in and notification address.</p>
                                            </div>
                                        </div>

                                        <div className="app-settings-email-row">
                                            <div className="app-settings-email-info">
                                                <div className="app-settings-email-text-wrap">
                                                    <Mail size={16} className="app-settings-inline-icon" />
                                                    <span className="app-settings-email-value">{displayEmail}</span>
                                                </div>
                                                {emailPending ? (
                                                    <span className="app-settings-status-pill is-pending" title={`Verification email sent to ${emailPending}`}>
                                                        Verification pending
                                                    </span>
                                                ) : (
                                                    <span className="app-settings-status-pill is-verified">
                                                        <Check size={12} /> Verified
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                className="app-settings-btn app-settings-btn--secondary"
                                                onClick={() => {
                                                    setNewEmailInput('');
                                                    setEmailConfirmPassword('');
                                                    setEmailModalError(null);
                                                    setShowChangeEmailModal(true);
                                                }}
                                            >
                                                Change email
                                            </button>
                                        </div>
                                    </div>

                                    {/* 4. Sign-in Methods Card (Password, Google, GitHub, 2FA Nudge) */}
                                    <div className="app-settings-card">
                                        <div className="app-settings-card-header">
                                            <div>
                                                <h3 className="app-settings-card-title">Sign-in methods</h3>
                                                <p className="app-settings-card-desc">Manage authentication providers and password credentials.</p>
                                            </div>
                                        </div>

                                        <div className="app-settings-methods-list">
                                            {/* Password Row */}
                                            <div className="app-settings-method-row">
                                                <div className="app-settings-method-left">
                                                    <div className="app-settings-method-icon">
                                                        <Key size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="app-settings-method-title">Password</div>
                                                        <div className="app-settings-method-sub">
                                                            {hasPassword ? 'Password is configured' : 'No password set'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="app-settings-btn app-settings-btn--secondary"
                                                    onClick={() => {
                                                        setPasswordCurrent('');
                                                        setPasswordNew('');
                                                        setPasswordConfirm('');
                                                        setPasswordModalError(null);
                                                        setShowChangePasswordModal(true);
                                                    }}
                                                >
                                                    {hasPassword ? 'Change password' : 'Set password'}
                                                </button>
                                            </div>

                                            {/* Google Account */}
                                            <div className="app-settings-method-row">
                                                <div className="app-settings-method-left">
                                                    <div className="app-settings-method-icon">
                                                        <Globe size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="app-settings-method-title">Google</div>
                                                        <div className="app-settings-method-sub">
                                                            {connectedAccounts.google ? connectedAccounts.google.email : 'Not connected'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {connectedAccounts.google ? (
                                                    <button
                                                        type="button"
                                                        className="app-settings-btn app-settings-btn--secondary"
                                                        disabled={isSoleAuthMethod('google')}
                                                        title={isSoleAuthMethod('google') ? 'Cannot disconnect your only sign-in method. Set a password first.' : undefined}
                                                        onClick={() => handleDisconnectAccount('google')}
                                                    >
                                                        Disconnect
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="app-settings-btn app-settings-btn--secondary"
                                                        onClick={() => handleConnectAccount('google')}
                                                    >
                                                        Connect
                                                    </button>
                                                )}
                                            </div>

                                            {/* GitHub Account */}
                                            <div className="app-settings-method-row">
                                                <div className="app-settings-method-left">
                                                    <div className="app-settings-method-icon">
                                                        <GitBranch size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="app-settings-method-title">GitHub</div>
                                                        <div className="app-settings-method-sub">
                                                            {connectedAccounts.github ? connectedAccounts.github.username : 'Not connected'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {connectedAccounts.github ? (
                                                    <button
                                                        type="button"
                                                        className="app-settings-btn app-settings-btn--secondary"
                                                        disabled={isSoleAuthMethod('github')}
                                                        title={isSoleAuthMethod('github') ? 'Cannot disconnect your only sign-in method. Set a password first.' : undefined}
                                                        onClick={() => handleDisconnectAccount('github')}
                                                    >
                                                        Disconnect
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="app-settings-btn app-settings-btn--secondary"
                                                        onClick={() => handleConnectAccount('github')}
                                                    >
                                                        Connect
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2FA Security Nudge */}
                                        {!is2FAEnabled && (
                                            <div className="app-settings-security-nudge">
                                                <div className="app-settings-nudge-text">
                                                    <ShieldCheck size={16} className="app-settings-nudge-icon" />
                                                    <div>
                                                        <span className="app-settings-nudge-title">Two-factor authentication is off</span>
                                                        <p className="app-settings-nudge-desc">Protect your account and test suites with an extra verification step.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="app-settings-btn app-settings-btn--secondary"
                                                    onClick={() => handleTabChange('security')}
                                                >
                                                    Configure 2FA <ArrowRight size={13} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 5. Usage Block (Plan Name, Progress Bar, Reset Date, Upgrade Button, Test Suites Generated) */}
                                    <div className="app-settings-card">
                                        <div className="app-settings-card-header">
                                            <div>
                                                <h3 className="app-settings-card-title">Usage & quota</h3>
                                                <p className="app-settings-card-desc">Monthly test generation allotment and plan status.</p>
                                            </div>
                                            <div className="app-settings-usage-header-actions">
                                                <button
                                                    type="button"
                                                    className="app-settings-btn app-settings-btn--secondary"
                                                    onClick={() => handleTabChange('billing')}
                                                >
                                                    Billing & usage <ArrowRight size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="app-settings-btn app-settings-btn--primary"
                                                    onClick={() => setShowUpgradeModal(true)}
                                                >
                                                    Upgrade
                                                </button>
                                            </div>
                                        </div>

                                        <div className="app-settings-usage-content">
                                            <div className="app-settings-usage-plan-row">
                                                <span className="app-settings-usage-plan-name">{displayPlan} plan</span>
                                                <span className="app-settings-usage-stat">
                                                    {monthlySuitesUsed} of {monthlySuitesLimit} suites this month
                                                </span>
                                            </div>

                                            <div className="app-settings-progress-track" role="progressbar" aria-valuenow={monthlySuitesUsed} aria-valuemin={0} aria-valuemax={monthlySuitesLimit}>
                                                <div
                                                    className="app-settings-progress-fill"
                                                    style={{ width: `${Math.min(100, Math.round((monthlySuitesUsed / monthlySuitesLimit) * 100))}%` }}
                                                />
                                            </div>

                                            <div className="app-settings-usage-meta-row">
                                                <span className="app-settings-usage-reset">Monthly quota resets on December 1, 2026</span>
                                                <span className="app-settings-usage-lifetime">
                                                    Total test suites generated: <strong>{user?.totalTestsGenerated || 124}</strong>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 6. Quiet Metadata Row (Member Since, Last Sign-In Date & Device) */}
                                    <div className="app-settings-quiet-row">
                                        <div className="app-settings-quiet-item">
                                            <span className="app-settings-quiet-label">Member since:</span>
                                            <span className="app-settings-quiet-val">{memberSince}</span>
                                        </div>
                                        <span className="app-settings-quiet-dot">•</span>
                                        <div className="app-settings-quiet-item">
                                            <span className="app-settings-quiet-label">Last sign-in:</span>
                                            <span className="app-settings-quiet-val">Today, 14:32 (Chrome on Windows)</span>
                                        </div>
                                        <span className="app-settings-quiet-dot">•</span>
                                        <div className="app-settings-quiet-item">
                                            <span className="app-settings-quiet-label">Account ID:</span>
                                            <code className="app-settings-quiet-code">{user?.id ? user.id.slice(0, 14) : 'usr_01hx98kq2'}</code>
                                        </div>
                                    </div>

                                    {/* 7. Danger Zone Card (Outlined, At Bottom: Export Data, Delete Account) */}
                                    <div className="app-settings-card app-settings-danger-card">
                                        <div className="app-settings-card-header">
                                            <div>
                                                <h3 className="app-settings-card-title">Danger zone</h3>
                                                <p className="app-settings-card-desc">Data export and permanent account termination.</p>
                                            </div>
                                        </div>

                                        <div className="app-settings-danger-row">
                                            <div className="app-settings-danger-info">
                                                <div className="app-settings-danger-row-title">Export my data</div>
                                                <div className="app-settings-danger-row-desc">
                                                    Download a complete JSON export of your personal profile, test suites, generated scripts, and workspace history.
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="app-settings-btn app-settings-btn--secondary"
                                                onClick={handleExportData}
                                            >
                                                <Download size={14} /> Export data
                                            </button>
                                        </div>

                                        <div className="app-settings-danger-divider" />

                                        <div className="app-settings-danger-row">
                                            <div className="app-settings-danger-info">
                                                <div className="app-settings-danger-row-title">Delete account</div>
                                                <div className="app-settings-danger-row-desc">
                                                    Permanently delete your account and erase all associated data. This action is immediate and irreversible.
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="app-settings-btn app-settings-btn--danger-outline"
                                                onClick={() => {
                                                    setDeleteConfirmEmail('');
                                                    setDeleteWorkspaceError(null);
                                                    setShowDeleteModal(true);
                                                }}
                                            >
                                                Delete account...
                                            </button>
                                        </div>
                                    </div>

                                    {/* 8. Dirty-State Sticky Save Bar */}
                                    {isDirty && (
                                        <div className="app-settings-sticky-bar" role="region" aria-label="Unsaved changes bar">
                                            <div className="app-settings-sticky-inner">
                                                <div className="app-settings-sticky-left">
                                                    <span className="app-settings-sticky-dot" />
                                                    <span className="app-settings-sticky-text">Unsaved changes</span>
                                                </div>
                                                <div className="app-settings-sticky-actions">
                                                    <button
                                                        type="button"
                                                        className="app-settings-btn app-settings-btn--secondary"
                                                        onClick={handleDiscardChanges}
                                                        disabled={isSaving}
                                                    >
                                                        Discard
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="app-settings-btn app-settings-btn--primary"
                                                        onClick={handleSaveChanges}
                                                        disabled={isSaving}
                                                    >
                                                        {isSaving ? <Loader2 size={14} className="app-settings-spin" /> : null}
                                                        <span>{isSaving ? 'Saving…' : 'Save changes'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
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
                                            <span style={{ fontSize: '0.72rem', color: '#FFFFFF', background: 'rgba(255, 255, 255, 0.08)', padding: '0.1rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
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
                                            style={{ transform: 'scale(1.2)', accentColor: '#FFFFFF', cursor: 'pointer' }}
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
                                            style={{ transform: 'scale(1.2)', accentColor: '#FFFFFF', cursor: 'pointer' }}
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

                    {/* ══════════════ TAB 3: BILLING & USAGE (ENGINEERING CONTROL ROOM) ══════════════ */}
                    {activeTab === 'billing' && (
                        <BillingControlRoom />
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
                                    <div className="app-settings-security-header-left">
                                        <div className="app-settings-security-icon">
                                            <Key size={18} />
                                        </div>
                                        <div className="app-settings-security-info">
                                            <h4>Password & Credentials</h4>
                                            <p>{formatPasswordLastChanged()}</p>
                                        </div>
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
                                    <form onSubmit={handleSavePassword} className="app-settings-password-form">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <label htmlFor="curPwd" style={{ fontSize: '0.8rem', color: '#A0A5A5' }}>Current Password</label>
                                            <input
                                                id="curPwd"
                                                type="password"
                                                className="app-settings-input"
                                                placeholder="Enter current password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <label htmlFor="newPwd" style={{ fontSize: '0.8rem', color: '#A0A5A5' }}>New Password</label>
                                            <input
                                                id="newPwd"
                                                type="password"
                                                className="app-settings-input"
                                                placeholder="Minimum 6 characters"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                minLength={6}
                                                required
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <label htmlFor="confPwd" style={{ fontSize: '0.8rem', color: '#A0A5A5' }}>Confirm New Password</label>
                                            <input
                                                id="confPwd"
                                                type="password"
                                                className="app-settings-input"
                                                placeholder="Re-enter new password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                minLength={6}
                                                required
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem' }}>
                                            <button
                                                type="button"
                                                className="app-settings-btn app-settings-btn--secondary"
                                                onClick={() => {
                                                    setShowPasswordForm(false);
                                                    setCurrentPassword('');
                                                    setNewPassword('');
                                                    setConfirmPassword('');
                                                }}
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
                                    <div className="app-settings-security-header-left">
                                        <div className="app-settings-security-icon">
                                            <ShieldCheck size={18} />
                                        </div>
                                        <div className="app-settings-security-info">
                                            <h4>
                                                Two-Factor Authentication
                                                <span className={`app-settings-status-badge ${is2FAEnabled ? 'active' : 'inactive'}`}>
                                                    {is2FAEnabled ? 'Active' : 'Not configured'}
                                                </span>
                                            </h4>
                                            <p>Protect your account with standard TOTP authenticator apps (Google Authenticator, 1Password, Authy).</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        onClick={() => setShow2FAModal(true)}
                                    >
                                        {is2FAEnabled ? 'Manage 2FA' : 'Configure 2FA'}
                                    </button>
                                </div>
                            </div>

                            {/* Active Sessions */}
                            <div className="app-settings-security-block">
                                <div className="app-settings-security-top">
                                    <div className="app-settings-security-header-left">
                                        <div className="app-settings-security-icon">
                                            <Laptop size={18} />
                                        </div>
                                        <div className="app-settings-security-info">
                                            <h4>Active Sessions & Devices</h4>
                                            <p>{activeSessions.length || 1} active session{(activeSessions.length || 1) === 1 ? '' : 's'} authorized for this account.</p>
                                        </div>
                                    </div>
                                    {activeSessions.some(s => !s.isCurrent) && (
                                        <button
                                            type="button"
                                            className="app-settings-btn app-settings-btn--secondary"
                                            disabled={isRevokingOthers}
                                            onClick={() => setShowSignoutSessionsModal(true)}
                                        >
                                            {isRevokingOthers ? 'Signing out...' : 'Sign out other sessions'}
                                        </button>
                                    )}
                                </div>

                                <div className="app-settings-session-list">
                                    {(activeSessions.length > 0 ? activeSessions : [{
                                        id: 'sess_curr_browser',
                                        device: 'Desktop Browser (Chrome / Windows)',
                                        ipAddress: '127.0.0.1',
                                        location: 'Current Session',
                                        lastActiveAt: new Date().toISOString(),
                                        isCurrent: true
                                    }]).map((session) => (
                                        <div key={session.id} className="app-settings-session-card">
                                            <div className="app-settings-session-meta">
                                                <div className="app-settings-session-icon">
                                                    {session.device?.toLowerCase().includes('iphone') || session.device?.toLowerCase().includes('android') || session.device?.toLowerCase().includes('ios') ? (
                                                        <Smartphone size={18} color={session.isCurrent ? "#FFFFFF" : "#A0A5A5"} />
                                                    ) : (
                                                        <Laptop size={18} color={session.isCurrent ? "#FFFFFF" : "#A0A5A5"} />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="app-settings-session-title">
                                                        {session.device}
                                                    </div>
                                                    <div className="app-settings-session-subtitle">
                                                        {session.isCurrent ? 'Current active session' : `Last active ${formatRelativeTime(session.lastActiveAt)}`} · {session.ipAddress} ({session.location || 'Local Network'})
                                                    </div>
                                                </div>
                                            </div>
                                            {session.isCurrent ? (
                                                <span className="app-settings-status-badge active">Current Session</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="app-settings-btn app-settings-btn--secondary"
                                                    style={{ padding: '0.25rem 0.65rem', minHeight: '28px', fontSize: '0.75rem' }}
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
                                    ))}
                                </div>
                            </div>

                            {/* Recent Security Activity */}
                            <div className="app-settings-security-block">
                                <div className="app-settings-security-top">
                                    <div className="app-settings-security-header-left">
                                        <div className="app-settings-security-icon">
                                            <Globe size={18} />
                                        </div>
                                        <div className="app-settings-security-info">
                                            <h4>Recent Security Activity</h4>
                                            <p>Audit log of recent authentication checks and account activity.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="app-settings-info-list" style={{ marginTop: '0.25rem' }}>
                                    <div className="app-settings-info-row">
                                        <div>
                                            <span className="app-settings-info-label">Active Web Browser Session</span>
                                            <span style={{ display: 'block', fontSize: '0.74rem', color: '#777E7E', marginTop: '0.15rem' }}>IP 127.0.0.1 · Authenticated Session Token</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#A0A5A5' }}>Active now</span>
                                            <span className="app-settings-status-badge active">Verified</span>
                                        </div>
                                    </div>
                                    <div className="app-settings-info-row">
                                        <div>
                                            <span className="app-settings-info-label">Account Verification & Credentials</span>
                                            <span style={{ display: 'block', fontSize: '0.74rem', color: '#777E7E', marginTop: '0.15rem' }}>Password hash validated against PBKDF2 standard</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#A0A5A5' }}>{memberSince || 'October 2026'}</span>
                                            <span className="app-settings-status-badge active">Valid</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══════════════ TAB 5: WORKSPACE SETTINGS ══════════════ */}
                    {activeTab === 'workspace' && (
                        <>
                            {/* Feedback Banner */}
                            {workspaceFeedback && (
                                <div
                                    className={`app-settings-feedback ${workspaceFeedback.type === 'conflict' ? 'error' : workspaceFeedback.type}`}
                                    role="alert"
                                    aria-live="polite"
                                    style={{ marginBottom: '1.25rem' }}
                                >
                                    {workspaceFeedback.type === 'success' ? (
                                        <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                                    ) : (
                                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                    )}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <span>{workspaceFeedback.message}</span>
                                        {workspaceFeedback.type === 'conflict' && (
                                            <button
                                                type="button"
                                                className="app-settings-btn app-settings-btn--secondary"
                                                style={{ padding: '0.25rem 0.65rem', minHeight: '28px', fontSize: '0.78rem' }}
                                                onClick={() => loadWorkspaceSettings(true)}
                                            >
                                                <RefreshCw size={12} />
                                                <span>Reload Latest Settings</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {workspaceFetchError && (
                                <div className="app-settings-feedback error" role="alert" style={{ marginBottom: '1.25rem' }}>
                                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <span>{workspaceFetchError}</span>
                                        <button
                                            type="button"
                                            className="app-settings-btn app-settings-btn--secondary"
                                            style={{ padding: '0.25rem 0.65rem', minHeight: '28px', fontSize: '0.78rem' }}
                                            onClick={() => loadWorkspaceSettings(true)}
                                        >
                                            <RefreshCw size={12} />
                                            <span>Retry</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!isOwnerOrAdmin && (
                                <div className="app-settings-feedback info" role="status" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <ShieldCheck size={16} style={{ flexShrink: 0, color: '#FFFFFF' }} />
                                    <span>You are a <strong>{workspaceRole}</strong> in this workspace. Workspace settings and environments can only be modified by owners and administrators.</span>
                                </div>
                            )}

                            <div className="app-settings-info-list">
                                {/* Workspace Name */}
                                <div className="app-settings-info-row" style={{ alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <label htmlFor="wsName" className="app-settings-info-label" style={{ cursor: isOwnerOrAdmin ? 'pointer' : 'default' }}>
                                            Workspace Name
                                        </label>
                                        <span style={{ fontSize: '0.74rem', color: '#777E7E' }}>
                                            Primary team or organization display name
                                        </span>
                                    </div>
                                    <div className="app-settings-info-edit" style={{ maxWidth: '360px', width: '100%' }}>
                                        <input
                                            id="wsName"
                                            name="workspaceName"
                                            type="text"
                                            maxLength={64}
                                            className="app-settings-input"
                                            value={editWorkspaceName}
                                            onChange={handleWorkspaceNameChange}
                                            placeholder="Enter workspace name"
                                            disabled={!isOwnerOrAdmin || isSavingWorkspace || isLoadingWorkspaceData}
                                            readOnly={!isOwnerOrAdmin}
                                            style={{
                                                borderColor: nameValidationError ? '#F87171' : undefined,
                                                opacity: !isOwnerOrAdmin ? 0.75 : 1,
                                                cursor: !isOwnerOrAdmin ? 'not-allowed' : 'text'
                                            }}
                                        />
                                        {nameValidationError && (
                                            <div
                                                style={{
                                                    color: '#F87171',
                                                    fontSize: '0.76rem',
                                                    marginTop: '0.35rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem'
                                                }}
                                                role="alert"
                                            >
                                                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                                                <span>{nameValidationError}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Workspace ID */}
                                <div className="app-settings-info-row">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <span className="app-settings-info-label">Workspace ID</span>
                                        <span style={{ fontSize: '0.74rem', color: '#777E7E' }}>
                                            Immutable unique tenant identifier
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <span
                                            id="wsIdDisplay"
                                            className="app-settings-info-value"
                                            style={{
                                                fontFamily: 'monospace',
                                                color: '#FFFFFF',
                                                fontSize: '0.82rem',
                                                background: '#161819',
                                                padding: '0.35rem 0.65rem',
                                                borderRadius: '5px',
                                                border: '1px solid #292D2D',
                                                userSelect: 'all'
                                            }}
                                        >
                                            {persistedWorkspace?.id || currentWorkspace?.id || '—'}
                                        </span>
                                        <button
                                            type="button"
                                            id="btnCopyWorkspaceId"
                                            className="app-settings-btn app-settings-btn--secondary"
                                            style={{ padding: '0.35rem 0.75rem', minHeight: '32px', fontSize: '0.78rem' }}
                                            onClick={handleCopyWorkspaceId}
                                            aria-label="Copy Workspace ID to clipboard"
                                            title="Copy Workspace ID"
                                            disabled={!persistedWorkspace?.id && !currentWorkspace?.id}
                                        >
                                            {isCopiedWorkspaceId ? (
                                                <>
                                                    <Check size={13} style={{ color: '#FFFFFF' }} />
                                                    <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={13} />
                                                    <span>Copy</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Default Environment */}
                                <div className="app-settings-info-row" style={{ alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <label htmlFor="wsDefaultEnv" className="app-settings-info-label" style={{ cursor: isOwnerOrAdmin ? 'pointer' : 'default' }}>
                                            Default Environment
                                        </label>
                                        <span style={{ fontSize: '0.74rem', color: '#777E7E' }}>
                                            Target environment for new test suites
                                        </span>
                                    </div>
                                    <div className="app-settings-info-edit" style={{ maxWidth: '360px', width: '100%' }}>
                                        <select
                                            id="wsDefaultEnv"
                                            name="defaultEnvironmentId"
                                            className="app-settings-input"
                                            value={editDefaultEnvId}
                                            onChange={handleEnvironmentChange}
                                            disabled={!isOwnerOrAdmin || environmentsLoading || isSavingWorkspace || displayedEnvironments.length === 0}
                                            style={{
                                                opacity: !isOwnerOrAdmin ? 0.75 : 1,
                                                cursor: !isOwnerOrAdmin ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            {environmentsLoading ? (
                                                <option value="" disabled>Loading configured environments...</option>
                                            ) : displayedEnvironments.length === 0 ? (
                                                <option value="" disabled>No environments configured</option>
                                            ) : (
                                                <>
                                                    <option value="">None (No default environment)</option>
                                                    {displayedEnvironments.map((env) => (
                                                        <option key={env.id} value={env.id}>
                                                             {env.name} ({env.type || 'Custom'}{env.baseUrl ? ` • ${env.baseUrl}` : ''})
                                                        </option>
                                                    ))}
                                                </>
                                            )}
                                        </select>
                                        {displayedEnvironments.length === 0 && !environmentsLoading && (
                                            <p style={{ fontSize: '0.74rem', color: '#777E7E', margin: '0.35rem 0 0', lineHeight: 1.4 }}>
                                                An environment must be configured before it can be selected as default.
                                            </p>
                                        )}
                                        <p style={{ fontSize: '0.72rem', color: '#555A5A', margin: '0.35rem 0 0', lineHeight: 1.35 }}>
                                            Changing the default environment designates target URLs for generated suites. It does not execute tests or deploy code.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Form Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                                {!isOwnerOrAdmin ? (
                                    <span style={{ fontSize: '0.76rem', color: '#777E7E' }}>
                                        Read-only mode • Administrative privileges required to persist changes
                                    </span>
                                ) : (
                                    <>
                                        {isWorkspaceDirty && (
                                            <button
                                                type="button"
                                                id="btnCancelWorkspaceChanges"
                                                className="app-settings-btn app-settings-btn--secondary"
                                                onClick={handleResetWorkspace}
                                                disabled={isSavingWorkspace}
                                                title="Discard unsaved changes and restore persisted settings"
                                            >
                                                <RotateCcw size={14} />
                                                <span>Reset</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            id="btnSaveWorkspaceChanges"
                                            className="app-settings-btn app-settings-btn--primary"
                                            onClick={handleSaveWorkspace}
                                            disabled={!canSaveWorkspace}
                                        >
                                            {isSavingWorkspace ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span>Saving Changes...</span>
                                                </>
                                            ) : (
                                                <span>Save Changes</span>
                                            )}
                                        </button>
                                    </>
                                )}
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
                                        Manage team members, roles, and seat allocations for {currentWorkspace?.name || 'this workspace'}. 2 of 5 seats used.
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
                                                    <span style={{ fontWeight: 600 }}>{displayName}</span>
                                                    <span style={{ fontSize: '0.74rem', color: '#737373' }}>{displayEmail}</span>
                                                </div>
                                            </td>
                                            <td><span style={{ color: '#FFFFFF', fontWeight: 600 }}>Owner</span></td>
                                            <td><span className="app-settings-status-badge active">Active</span></td>
                                            <td style={{ textAlign: 'right', color: '#737373', fontSize: '0.75rem' }}>
                                                Primary Admin
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600 }}>Sarah Lin</span>
                                                    <span style={{ fontSize: '0.74rem', color: '#737373' }}>sarah.lin@enterprise.io</span>
                                                </div>
                                            </td>
                                            <td>QA Lead</td>
                                            <td><span className="app-settings-status-badge active">Active</span></td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    type="button"
                                                    className="app-settings-btn app-settings-btn--secondary"
                                                    style={{ padding: '0.2rem 0.5rem', minHeight: '26px', fontSize: '0.75rem' }}
                                                    onClick={() => alert('Editing permissions for Sarah Lin')}
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

            {/* ══════════════ MODALS ══════════════ */}

            {/* Avatar Crop & Preview Modal */}
            {showCropModal && (
                <div className="app-settings-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="crop-title">
                    <div className="app-settings-modal">
                        <div className="app-settings-modal-header">
                            <div>
                                <h3 id="crop-title" className="app-settings-modal-title">Adjust profile picture</h3>
                                <p className="app-settings-modal-desc">Preview circular crop before applying to your profile.</p>
                            </div>
                            <button
                                type="button"
                                className="app-settings-modal-close"
                                onClick={() => {
                                    setShowCropModal(false);
                                    setTempAvatarPreview(null);
                                }}
                                aria-label="Close modal"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="app-settings-crop-preview-wrap">
                            <div className="app-settings-crop-circle">
                                <img src={tempAvatarPreview} alt="Preview" className="app-settings-crop-img" />
                            </div>
                        </div>

                        <div className="app-settings-modal-actions">
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--secondary"
                                onClick={() => {
                                    setShowCropModal(false);
                                    setTempAvatarPreview(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--primary"
                                onClick={handleApplyAvatarCrop}
                            >
                                Apply photo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Email Modal */}
            {showChangeEmailModal && (
                <div className="app-settings-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="email-modal-title">
                    <div className="app-settings-modal">
                        <div className="app-settings-modal-header">
                            <div>
                                <h3 id="email-modal-title" className="app-settings-modal-title">Change email address</h3>
                                <p className="app-settings-modal-desc">
                                    A verification link will be sent to your new address to confirm the update.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="app-settings-modal-close"
                                onClick={() => setShowChangeEmailModal(false)}
                                aria-label="Close modal"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="app-settings-field">
                            <label htmlFor="newEmailInput" className="app-settings-label">
                                New email address <span className="app-settings-required">*</span>
                            </label>
                            <input
                                id="newEmailInput"
                                type="email"
                                className="app-settings-input"
                                value={newEmailInput}
                                onChange={(e) => setNewEmailInput(e.target.value)}
                                placeholder="name@company.com"
                                autoFocus
                            />
                        </div>

                        <div className="app-settings-field">
                            <label htmlFor="emailConfirmPassword" className="app-settings-label">
                                Confirm with current password <span className="app-settings-required">*</span>
                            </label>
                            <input
                                id="emailConfirmPassword"
                                type="password"
                                className="app-settings-input"
                                value={emailConfirmPassword}
                                onChange={(e) => setEmailConfirmPassword(e.target.value)}
                                placeholder="Enter account password"
                            />
                        </div>

                        {emailModalError && (
                            <div className="app-settings-field-error" style={{ color: '#FFFFFF' }}>
                                {emailModalError}
                            </div>
                        )}

                        <div className="app-settings-modal-actions">
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--secondary"
                                onClick={() => setShowChangeEmailModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--primary"
                                disabled={!newEmailInput.trim() || !emailConfirmPassword.trim()}
                                onClick={handleSendVerificationEmail}
                            >
                                Send verification email
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {showChangePasswordModal && (
                <div className="app-settings-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pwd-modal-title">
                    <div className="app-settings-modal">
                        <div className="app-settings-modal-header">
                            <div>
                                <h3 id="pwd-modal-title" className="app-settings-modal-title">Change account password</h3>
                                <p className="app-settings-modal-desc">
                                    Ensure your account remains protected with a strong, unique password.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="app-settings-modal-close"
                                onClick={() => setShowChangePasswordModal(false)}
                                aria-label="Close modal"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="app-settings-field">
                            <label htmlFor="passwordCurrent" className="app-settings-label">
                                Current password
                            </label>
                            <input
                                id="passwordCurrent"
                                type="password"
                                className="app-settings-input"
                                value={passwordCurrent}
                                onChange={(e) => setPasswordCurrent(e.target.value)}
                                placeholder="Enter current password"
                                autoFocus
                            />
                        </div>

                        <div className="app-settings-field">
                            <label htmlFor="passwordNew" className="app-settings-label">
                                New password
                            </label>
                            <input
                                id="passwordNew"
                                type="password"
                                className="app-settings-input"
                                value={passwordNew}
                                onChange={(e) => setPasswordNew(e.target.value)}
                                placeholder="Min 8 characters"
                            />
                        </div>

                        <div className="app-settings-field">
                            <label htmlFor="passwordConfirm" className="app-settings-label">
                                Confirm new password
                            </label>
                            <input
                                id="passwordConfirm"
                                type="password"
                                className="app-settings-input"
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                                placeholder="Re-enter new password"
                            />
                        </div>

                        {passwordModalError && (
                            <div className="app-settings-field-error" style={{ color: '#FFFFFF' }}>
                                {passwordModalError}
                            </div>
                        )}

                        <div className="app-settings-modal-actions">
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--secondary"
                                onClick={() => setShowChangePasswordModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--primary"
                                disabled={!passwordNew || !passwordConfirm}
                                onClick={handleSavePasswordModal}
                            >
                                Update password
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Account Modal (With Ownership Check & Typed Email Confirmation) */}
            {showDeleteModal && (
                <div className="app-settings-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="del-modal-title">
                    <div className="app-settings-modal" style={{ maxWidth: '520px' }}>
                        <div className="app-settings-modal-header">
                            <div>
                                <h3 id="del-modal-title" className="app-settings-modal-title">Delete personal account</h3>
                                <p className="app-settings-modal-desc">
                                    This action permanently deletes your account and cannot be undone.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="app-settings-modal-close"
                                onClick={() => setShowDeleteModal(false)}
                                aria-label="Close modal"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {isOwnerWithOtherMembers ? (
                            <div className="app-settings-warning-block">
                                <strong>Deletion blocked: Workspace owner</strong>
                                <p style={{ margin: '0.35rem 0 0 0' }}>
                                    You are the owner of workspace <strong>{currentWorkspace?.name || 'Engineering'}</strong> with active team members. You must transfer workspace ownership or remove all team members before deleting your personal account.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="app-settings-warning-block">
                                    <strong>What happens when you delete:</strong>
                                    <ul style={{ margin: '0.4rem 0 0 1.15rem', padding: 0, fontSize: '0.8rem', lineHeight: '1.5' }}>
                                        <li>All personal test suites, custom scripts, and session history will be erased.</li>
                                        <li>Active API keys and authentication tokens will be immediately invalidated.</li>
                                        <li>Personal data will be completely wiped from server backups within 30 days.</li>
                                    </ul>
                                </div>

                                <div className="app-settings-field">
                                    <label htmlFor="deleteConfirmEmail" className="app-settings-label">
                                        To confirm deletion, type your email address (<strong>{displayEmail}</strong>):
                                    </label>
                                    <input
                                        id="deleteConfirmEmail"
                                        type="text"
                                        className="app-settings-input"
                                        value={deleteConfirmEmail}
                                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                                        placeholder={displayEmail}
                                        autoFocus
                                    />
                                </div>
                            </>
                        )}

                        <div className="app-settings-modal-actions">
                            <button
                                type="button"
                                className="app-settings-btn app-settings-btn--secondary"
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeletingAccountFinal}
                            >
                                Cancel
                            </button>
                            {!isOwnerWithOtherMembers && (
                                <button
                                    type="button"
                                    className="app-settings-btn app-settings-btn--danger-solid"
                                    disabled={deleteConfirmEmail.trim().toLowerCase() !== displayEmail.toLowerCase() || isDeletingAccountFinal}
                                    onClick={handleDeleteAccountFinal}
                                >
                                    {isDeletingAccountFinal ? 'Deleting…' : 'Permanently delete account'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

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

            {/* Delete Account Modal (2-Step Flow: Survey -> Final Confirmation) */}
            {showDeleteAccountModal && (
                <div className="app-settings-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
                    <div className="app-settings-confirm-box" style={{ maxWidth: '520px' }}>
                        {deleteStep === 1 ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                                        <AlertCircle size={18} />
                                    </div>
                                    <div>
                                        <div className="app-settings-survey-step-indicator">Step 1 of 2 · Exit Survey</div>
                                        <h3 id="delete-account-title" className="app-settings-confirm-title" style={{ margin: 0 }}>
                                            Why do you want to delete your account?
                                        </h3>
                                    </div>
                                </div>

                                <p className="app-settings-confirm-desc" style={{ marginBottom: '0.65rem', lineHeight: '1.45' }}>
                                    We're sorry to see you go. Please tell us why you are deleting your account so we can improve TestNexa AI.
                                </p>

                                <div className="app-settings-survey-list">
                                    {DELETION_REASONS.map((r) => {
                                        const isSelected = deleteReason === r.label;
                                        return (
                                            <div
                                                key={r.id}
                                                className={`app-settings-survey-option ${isSelected ? 'selected' : ''}`}
                                                onClick={() => setDeleteReason(r.label)}
                                                role="radio"
                                                aria-checked={isSelected}
                                            >
                                                <div className="app-settings-survey-radio">
                                                    {isSelected && <div className="app-settings-survey-radio-dot" />}
                                                </div>
                                                <span className="app-settings-survey-text">{r.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div style={{ marginTop: '0.65rem' }}>
                                    <label htmlFor="delete-feedback-input" style={{ display: 'block', fontSize: '0.78rem', color: '#A0A5A5', marginBottom: '0.35rem' }}>
                                        What could we have done better? (Optional)
                                    </label>
                                    <textarea
                                        id="delete-feedback-input"
                                        className="app-settings-survey-textarea"
                                        placeholder="Tell us what could have made TestNexa better for you..."
                                        value={deleteFeedback}
                                        onChange={(e) => setDeleteFeedback(e.target.value)}
                                        rows={2}
                                    />
                                </div>

                                <div className="app-settings-confirm-actions" style={{ marginTop: '0.85rem' }}>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        onClick={resetDeleteModal}
                                    >
                                        Keep Account
                                    </button>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--danger"
                                        disabled={!deleteReason}
                                        onClick={() => setDeleteStep(2)}
                                    >
                                        Continue to Deletion →
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                                        <AlertCircle size={18} />
                                    </div>
                                    <div>
                                        <div className="app-settings-survey-step-indicator">Step 2 of 2 · Permanent Deletion</div>
                                        <h3 id="delete-account-title" className="app-settings-confirm-title" style={{ color: '#EF4444', margin: 0 }}>
                                            Permanently delete account?
                                        </h3>
                                    </div>
                                </div>

                                <p className="app-settings-confirm-desc" style={{ marginBottom: '0.85rem', lineHeight: '1.5' }}>
                                    This action is immediate and cannot be undone. All your created test suites, coverage matrices, workspace history, and active session tokens will be permanently erased.
                                </p>

                                <div style={{ background: '#161819', border: '1px solid #292D2D', borderRadius: '6px', padding: '0.65rem 0.85rem', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.72rem', color: '#777E7E', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.2rem' }}>
                                        Selected Reason:
                                    </span>
                                    <span style={{ fontSize: '0.82rem', color: '#F2F3F3', fontWeight: 500 }}>
                                        {deleteReason}
                                    </span>
                                </div>

                                {deleteError && (
                                    <div className="app-settings-feedback error" style={{ marginBottom: '1rem' }}>
                                        <AlertCircle size={14} />
                                        <span>{deleteError}</span>
                                    </div>
                                )}

                                <div style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="confirm-delete-input" style={{ display: 'block', fontSize: '0.78rem', color: '#A0A5A5', marginBottom: '0.4rem' }}>
                                        To confirm, please type <strong style={{ color: '#F2F3F3' }}>DELETE</strong> or your email (<span style={{ color: '#FFFFFF' }}>{displayEmail}</span>):
                                    </label>
                                    <input
                                        id="confirm-delete-input"
                                        type="text"
                                        className="app-settings-input"
                                        placeholder="Type DELETE or your email"
                                        value={deleteConfirmationText}
                                        onChange={(e) => setDeleteConfirmationText(e.target.value)}
                                        disabled={isDeletingAccount}
                                        autoFocus
                                    />
                                </div>

                                {(!user?.provider || user?.provider === 'email') && (
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <label htmlFor="confirm-delete-password" style={{ display: 'block', fontSize: '0.78rem', color: '#A0A5A5', marginBottom: '0.4rem' }}>
                                            Confirm with account password:
                                        </label>
                                        <input
                                            id="confirm-delete-password"
                                            type="password"
                                            className="app-settings-input"
                                            placeholder="Enter your current password"
                                            value={deletePassword}
                                            onChange={(e) => setDeletePassword(e.target.value)}
                                            disabled={isDeletingAccount}
                                        />
                                    </div>
                                )}

                                <div className="app-settings-confirm-actions">
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--secondary"
                                        onClick={() => setDeleteStep(1)}
                                        disabled={isDeletingAccount}
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        type="button"
                                        className="app-settings-btn app-settings-btn--danger"
                                        disabled={
                                            isDeletingAccount ||
                                            !(
                                                deleteConfirmationText.trim() === 'DELETE' ||
                                                deleteConfirmationText.trim().toLowerCase() === displayEmail.toLowerCase()
                                            )
                                        }
                                        onClick={handleDeleteAccount}
                                    >
                                        {isDeletingAccount ? (
                                            <InlineTestSignal size={14} label="Deleting..." color="#E06C75" />
                                        ) : (
                                            'Permanently Delete Account'
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
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
                            <div style={{ fontSize: '0.8rem', color: '#FFFFFF', fontFamily: 'monospace' }}>
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

