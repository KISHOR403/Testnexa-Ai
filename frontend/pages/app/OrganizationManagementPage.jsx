import React, { useState, useEffect, useRef } from 'react';
import {
    Users, Plus, Building2, Shield, Settings, Mail, Check,
    Clock, Trash2, ArrowRight, UserPlus, RefreshCw, AlertTriangle,
    Layers, ChevronDown, CheckCircle2, XCircle, LogOut, Key
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { organizationService } from '../../services/organizationService';
import { AuditLogView } from '../../components/organization/AuditLogView';
import '../../styles/app/OrganizationManagement.css';

const ROLES_LIST = [
    { id: 'owner', name: 'Owner', desc: 'Full organization authority and settings.' },
    { id: 'admin', name: 'Admin', desc: 'Manage members, workspaces, and integrations.' },
    { id: 'qa_manager', name: 'QA Manager', desc: 'Manage test suites, cases, and workflows.' },
    { id: 'qa_engineer', name: 'QA Engineer', desc: 'Author test cases and run automated tests.' },
    { id: 'viewer', name: 'Viewer', desc: 'Read-only access to suites and execution reports.' }
];

const OrganizationManagementPage = () => {
    const { user, currentWorkspace } = useAuth();
    const userId = user?.id || user?._id;

    const [activeTab, setActiveTab] = useState('workspaces');
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Organizations & selection
    const [organizations, setOrganizations] = useState([]);
    const [activeOrg, setActiveOrg] = useState(null);
    const [showOrgDropdown, setShowOrgDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // Tab data
    const [workspaces, setWorkspaces] = useState([]);
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [activity, setActivity] = useState([]);

    // Modals
    const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgDesc, setNewOrgDesc] = useState('');

    const [showCreateWsModal, setShowCreateWsModal] = useState(false);
    const [newWsName, setNewWsName] = useState('');
    const [newWsDesc, setNewWsDesc] = useState('');

    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('qa_engineer');
    const [inviteMessage, setInviteMessage] = useState('');
    const [generatedInviteLink, setGeneratedInviteLink] = useState('');

    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferTargetId, setTransferTargetId] = useState('');

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowOrgDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initial load
    useEffect(() => {
        loadOrganizations();
    }, [userId]);

    const loadOrganizations = async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const res = await organizationService.getUserOrganizations();
            const orgs = res.data || [];
            setOrganizations(orgs);

            if (orgs.length > 0) {
                // Select currently saved or first org
                const savedOrgId = localStorage.getItem('testnexa_active_org_id');
                const matched = orgs.find(o => o.id === savedOrgId) || orgs[0];
                setActiveOrg(matched);
                loadOrgData(matched.id);
            } else {
                setIsLoading(false);
            }
        } catch (err) {
            setErrorMessage(err.message || 'Failed to load organizations');
            setIsLoading(false);
        }
    };

    const loadOrgData = async (orgId) => {
        if (!orgId) return;
        setIsLoading(true);
        try {
            const [wsRes, memRes, invRes, actRes] = await Promise.all([
                organizationService.getWorkspaces(orgId, true).catch(() => ({ data: [] })),
                organizationService.getMembers(orgId).catch(() => ({ data: [] })),
                organizationService.getInvitations(orgId).catch(() => ({ data: [] })),
                organizationService.getActivity(orgId).catch(() => ({ data: [] }))
            ]);

            setWorkspaces(wsRes.data || []);
            setMembers(memRes.data || []);
            setInvitations(invRes.data || []);
            setActivity(actRes.data || []);
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwitchOrg = (org) => {
        setActiveOrg(org);
        localStorage.setItem('testnexa_active_org_id', org.id);
        setShowOrgDropdown(false);
        loadOrgData(org.id);
    };

    const handleCreateOrg = async (e) => {
        e.preventDefault();
        if (!newOrgName.trim()) return;
        setActionLoading(true);
        try {
            const res = await organizationService.createOrganization({
                name: newOrgName.trim(),
                description: newOrgDesc.trim()
            });
            setShowCreateOrgModal(false);
            setNewOrgName('');
            setNewOrgDesc('');
            setSuccessMessage(`Organization "${res.data.name}" created!`);
            loadOrganizations();
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateWorkspace = async (e) => {
        e.preventDefault();
        if (!newWsName.trim() || !activeOrg) return;
        setActionLoading(true);
        try {
            await organizationService.createWorkspace(activeOrg.id, {
                name: newWsName.trim(),
                description: newWsDesc.trim(),
                visibility: 'organization'
            });
            setShowCreateWsModal(false);
            setNewWsName('');
            setNewWsDesc('');
            setSuccessMessage('Workspace created successfully!');
            loadOrgData(activeOrg.id);
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleArchiveWorkspace = async (wsId, currentArchived) => {
        if (!activeOrg) return;
        try {
            await organizationService.archiveWorkspace(activeOrg.id, wsId, !currentArchived);
            loadOrgData(activeOrg.id);
            setSuccessMessage(!currentArchived ? 'Workspace archived' : 'Workspace restored');
        } catch (err) {
            setErrorMessage(err.message);
        }
    };

    const handleInviteMember = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !activeOrg) return;
        setActionLoading(true);
        try {
            const res = await organizationService.createInvitation(activeOrg.id, {
                email: inviteEmail.trim(),
                role: inviteRole,
                message: inviteMessage.trim()
            });
            setGeneratedInviteLink(window.location.origin + res.data.invitationLink);
            setSuccessMessage(`Invitation created for ${inviteEmail}!`);
            loadOrgData(activeOrg.id);
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelInvitation = async (invId) => {
        if (!activeOrg) return;
        try {
            await organizationService.cancelInvitation(activeOrg.id, invId);
            loadOrgData(activeOrg.id);
            setSuccessMessage('Invitation cancelled');
        } catch (err) {
            setErrorMessage(err.message);
        }
    };

    const handleResendInvitation = async (invId) => {
        if (!activeOrg) return;
        try {
            await organizationService.resendInvitation(activeOrg.id, invId);
            loadOrgData(activeOrg.id);
            setSuccessMessage('Invitation refreshed and resent');
        } catch (err) {
            setErrorMessage(err.message);
        }
    };

    const handleUpdateRole = async (targetUserId, newRole) => {
        if (!activeOrg) return;
        try {
            await organizationService.updateMemberRole(activeOrg.id, targetUserId, newRole);
            loadOrgData(activeOrg.id);
            setSuccessMessage('Member role updated');
        } catch (err) {
            setErrorMessage(err.message);
        }
    };

    const handleRemoveMember = async (targetUserId, targetName) => {
        if (!activeOrg) return;
        if (!window.confirm(`Are you sure you want to remove ${targetName || 'this member'} from the organization?`)) return;
        try {
            await organizationService.removeMember(activeOrg.id, targetUserId);
            loadOrgData(activeOrg.id);
            setSuccessMessage('Member removed');
        } catch (err) {
            setErrorMessage(err.message);
        }
    };

    const handleTransferOwnership = async (e) => {
        e.preventDefault();
        if (!activeOrg || !transferTargetId) return;
        if (!window.confirm('Transfer ownership? You will be demoted to Admin and cannot reverse this action.')) return;
        setActionLoading(true);
        try {
            await organizationService.transferOwnership(activeOrg.id, transferTargetId);
            setShowTransferModal(false);
            setSuccessMessage('Ownership transferred successfully');
            loadOrganizations();
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteOrg = async () => {
        if (!activeOrg) return;
        const confirmName = window.prompt(`Type "${activeOrg.name}" to permanently delete this organization:`);
        if (confirmName !== activeOrg.name) {
            alert('Organization name did not match. Deletion cancelled.');
            return;
        }
        try {
            await organizationService.deleteOrganization(activeOrg.id);
            alert('Organization deleted');
            loadOrganizations();
        } catch (err) {
            setErrorMessage(err.message);
        }
    };

    const isOwner = activeOrg?.userRole === 'owner';
    const isAdminOrOwner = isOwner || activeOrg?.userRole === 'admin';

    return (
        <div className="org-page">
            {/* Header */}
            <div className="org-header">
                <div className="org-header__title-area">
                    <h1>
                        <Building2 size={24} color="#8BAF9A" />
                        Team & Organization Management
                    </h1>
                    <div style={{ position: 'relative' }} ref={dropdownRef}>
                        <button
                            type="button"
                            className="org-header__switcher"
                            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                        >
                            <span>Org: <strong>{activeOrg?.name || 'Loading...'}</strong></span>
                            <span className={`org-role-badge org-role-badge--${activeOrg?.userRole || 'viewer'}`}>
                                {activeOrg?.userRole || 'viewer'}
                            </span>
                            <ChevronDown size={14} />
                        </button>

                        {showOrgDropdown && (
                            <div className="org-dropdown-menu">
                                <div style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                                    Your Organizations
                                </div>
                                {organizations.map(o => (
                                    <div
                                        key={o.id}
                                        className={`org-dropdown-item ${o.id === activeOrg?.id ? 'active' : ''}`}
                                        onClick={() => handleSwitchOrg(o)}
                                    >
                                        <span>{o.name}</span>
                                        <span className={`org-role-badge org-role-badge--${o.userRole}`}>
                                            {o.userRole}
                                        </span>
                                    </div>
                                ))}
                                <div className="org-dropdown-divider" />
                                <div
                                    className="org-dropdown-item"
                                    style={{ color: '#8BAF9A', fontWeight: 500 }}
                                    onClick={() => {
                                        setShowOrgDropdown(false);
                                        setShowCreateOrgModal(true);
                                    }}
                                >
                                    <Plus size={14} />
                                    <span>Create Organization</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="org-header__actions">
                    <button
                        className="cicd-btn cicd-btn--secondary"
                        onClick={() => activeOrg && loadOrgData(activeOrg.id)}
                        disabled={isLoading}
                        title="Refresh organization data"
                    >
                        <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
                        Refresh
                    </button>
                    {isAdminOrOwner && (
                        <button
                            className="cicd-btn cicd-btn--primary"
                            onClick={() => {
                                setGeneratedInviteLink('');
                                setShowInviteModal(true);
                            }}
                        >
                            <UserPlus size={14} />
                            Invite Member
                        </button>
                    )}
                </div>
            </div>

            {/* Notification Banners */}
            {errorMessage && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <AlertTriangle size={16} />
                    <span>{errorMessage}</span>
                </div>
            )}
            {successMessage && (
                <div style={{ backgroundColor: 'rgba(139, 175, 154, 0.15)', border: '1px solid rgba(139, 175, 154, 0.3)', color: '#8BAF9A', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <CheckCircle2 size={16} />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="org-tabs">
                <button
                    className={`org-tab ${activeTab === 'workspaces' ? 'active' : ''}`}
                    onClick={() => setActiveTab('workspaces')}
                >
                    <Layers size={16} />
                    Workspaces ({workspaces.length})
                </button>
                <button
                    className={`org-tab ${activeTab === 'members' ? 'active' : ''}`}
                    onClick={() => setActiveTab('members')}
                >
                    <Users size={16} />
                    Team Members ({members.length})
                </button>
                <button
                    className={`org-tab ${activeTab === 'invitations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('invitations')}
                >
                    <Mail size={16} />
                    Invitations ({invitations.length})
                </button>
                <button
                    className={`org-tab ${activeTab === 'activity' ? 'active' : ''}`}
                    onClick={() => setActiveTab('activity')}
                >
                    <Clock size={16} />
                    Audit Logs
                </button>
                <button
                    className={`org-tab ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    <Settings size={16} />
                    Organization Profile
                </button>
            </div>

            {/* TAB 1: WORKSPACES */}
            {activeTab === 'workspaces' && (
                <div className="org-card">
                    <div className="org-card__header">
                        <div>
                            <h3 className="org-card__title">Organization Workspaces</h3>
                            <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                                Workspaces provide isolated environments for specific test suites, runs, and Playwright mappings.
                            </span>
                        </div>
                        {isAdminOrOwner && (
                            <button
                                className="cicd-btn cicd-btn--primary cicd-btn--sm"
                                onClick={() => setShowCreateWsModal(true)}
                            >
                                <Plus size={14} />
                                New Workspace
                            </button>
                        )}
                    </div>

                    <table className="org-table">
                        <thead>
                            <tr>
                                <th>Workspace Name</th>
                                <th>Description</th>
                                <th>Visibility</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workspaces.map(ws => {
                                const isCurrent = ws.id === currentWorkspace?.id;
                                return (
                                    <tr key={ws.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <strong style={{ color: '#F8FAFC' }}>{ws.name}</strong>
                                                {isCurrent && (
                                                    <span className="cicd-badge cicd-badge--active" style={{ fontSize: '0.7rem' }}>Current Active</span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{ws.id}</span>
                                        </td>
                                        <td>{ws.description || <span style={{ color: '#64748B' }}>None</span>}</td>
                                        <td>
                                            <span className="cicd-badge cicd-badge--disconnected" style={{ textTransform: 'capitalize' }}>
                                                {ws.visibility || 'organization'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`cicd-badge ${ws.isArchived ? 'cicd-badge--disconnected' : 'cicd-badge--active'}`}>
                                                {ws.isArchived ? 'Archived' : 'Active'}
                                            </span>
                                        </td>
                                        <td>{new Date(ws.createdAt).toLocaleDateString()}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {isAdminOrOwner && (
                                                <button
                                                    className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                    onClick={() => handleArchiveWorkspace(ws.id, ws.isArchived)}
                                                >
                                                    {ws.isArchived ? 'Unarchive' : 'Archive'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB 2: TEAM MEMBERS */}
            {activeTab === 'members' && (
                <div className="org-card">
                    <div className="org-card__header">
                        <div>
                            <h3 className="org-card__title">Team Members & Role-Based Access</h3>
                            <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                                Manage roles across Owner, Admin, QA Manager, QA Engineer, and Viewer.
                            </span>
                        </div>
                        {isAdminOrOwner && (
                            <button
                                className="cicd-btn cicd-btn--primary cicd-btn--sm"
                                onClick={() => {
                                    setGeneratedInviteLink('');
                                    setShowInviteModal(true);
                                }}
                            >
                                <UserPlus size={14} />
                                Invite Member
                            </button>
                        )}
                    </div>

                    <table className="org-table">
                        <thead>
                            <tr>
                                <th>Member</th>
                                <th>Role</th>
                                <th>Permissions Summary</th>
                                <th>Joined</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(m => {
                                const isSelf = m.userId === userId;
                                return (
                                    <tr key={m.userId}>
                                        <td>
                                            <strong style={{ color: '#F8FAFC' }}>{m.name || m.email || m.userId}</strong>
                                            {m.email && <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{m.email}</div>}
                                            {isSelf && <span style={{ fontSize: '0.7rem', color: '#8BAF9A' }}>(You)</span>}
                                        </td>
                                        <td>
                                            {isAdminOrOwner && !isSelf && m.role !== 'owner' ? (
                                                <select
                                                    className="org-select"
                                                    style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                    value={m.role}
                                                    onChange={e => handleUpdateRole(m.userId, e.target.value)}
                                                >
                                                    {ROLES_LIST.map(r => (
                                                        <option key={r.id} value={r.id}>{r.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className={`org-role-badge org-role-badge--${m.role}`}>
                                                    {m.role}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ color: '#94A3B8', fontSize: '0.75rem' }}>
                                            {m.role === 'owner' && 'Full organization authority & billing'}
                                            {m.role === 'admin' && 'Manage team members, workspaces, & integrations'}
                                            {m.role === 'qa_manager' && 'Manage test suites, cases, & workflow approval'}
                                            {m.role === 'qa_engineer' && 'Author test cases & trigger automated runs'}
                                            {m.role === 'viewer' && 'Read-only access to suites and execution reports'}
                                        </td>
                                        <td>{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'Active'}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {isAdminOrOwner && !isSelf && m.role !== 'owner' && (
                                                <button
                                                    className="cicd-btn cicd-btn--danger cicd-btn--sm"
                                                    onClick={() => handleRemoveMember(m.userId, m.name || m.email)}
                                                    title="Remove Member"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB 3: INVITATIONS */}
            {activeTab === 'invitations' && (
                <div className="org-card">
                    <div className="org-card__header">
                        <div>
                            <h3 className="org-card__title">Pending Organization Invitations</h3>
                            <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                                Invited colleagues can join this organization and its workspaces using secure one-time invite tokens.
                            </span>
                        </div>
                        {isAdminOrOwner && (
                            <button
                                className="cicd-btn cicd-btn--primary cicd-btn--sm"
                                onClick={() => {
                                    setGeneratedInviteLink('');
                                    setShowInviteModal(true);
                                }}
                            >
                                <UserPlus size={14} />
                                Send New Invite
                            </button>
                        )}
                    </div>

                    {invitations.length === 0 ? (
                        <div className="cicd-empty">
                            <Mail size={40} className="cicd-empty__icon" />
                            <h4 className="cicd-empty__title">No pending invitations</h4>
                            <p className="cicd-empty__desc">
                                All sent invitations have been accepted or expired.
                            </p>
                        </div>
                    ) : (
                        <table className="org-table">
                            <thead>
                                <tr>
                                    <th>Recipient Email</th>
                                    <th>Assigned Role</th>
                                    <th>Status</th>
                                    <th>Expires At</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invitations.map(inv => (
                                    <tr key={inv.id}>
                                        <td>
                                            <strong style={{ color: '#F8FAFC' }}>{inv.email}</strong>
                                        </td>
                                        <td>
                                            <span className={`org-role-badge org-role-badge--${inv.role}`}>
                                                {inv.role}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`cicd-badge ${inv.status === 'pending' ? 'cicd-badge--active' : 'cicd-badge--disconnected'}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td>
                                            {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : '-'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {isAdminOrOwner && (
                                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                                    <button
                                                        className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                        onClick={() => handleResendInvitation(inv.id)}
                                                    >
                                                        Resend
                                                    </button>
                                                    <button
                                                        className="cicd-btn cicd-btn--danger cicd-btn--sm"
                                                        onClick={() => handleCancelInvitation(inv.id)}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* TAB 4: AUDIT LOGS */}
            {activeTab === 'activity' && (
                <AuditLogView
                    activeOrg={activeOrg}
                    workspaces={workspaces}
                />
            )}

            {/* TAB 5: PROFILE & SETTINGS */}
            {activeTab === 'settings' && (
                <div>
                    <div className="org-card">
                        <h3 className="org-card__title" style={{ marginBottom: '1.25rem' }}>
                            Organization Profile
                        </h3>

                        <div className="org-summary-grid">
                            <div className="org-stat-box">
                                <div className="org-stat-box__label">Organization ID</div>
                                <div className="org-stat-box__value" style={{ fontSize: '1rem', fontFamily: 'monospace' }}>
                                    {activeOrg?.id}
                                </div>
                            </div>
                            <div className="org-stat-box">
                                <div className="org-stat-box__label">Total Members</div>
                                <div className="org-stat-box__value">{members.length}</div>
                            </div>
                            <div className="org-stat-box">
                                <div className="org-stat-box__label">Active Workspaces</div>
                                <div className="org-stat-box__value">{workspaces.filter(w => !w.isArchived).length}</div>
                            </div>
                            <div className="org-stat-box">
                                <div className="org-stat-box__label">Created At</div>
                                <div className="org-stat-box__value" style={{ fontSize: '1rem' }}>
                                    {activeOrg?.createdAt ? new Date(activeOrg.createdAt).toLocaleDateString() : '-'}
                                </div>
                            </div>
                        </div>

                        <div className="org-form-group">
                            <label>Organization Name</label>
                            <input
                                type="text"
                                className="org-input"
                                value={activeOrg?.name || ''}
                                disabled={!isAdminOrOwner}
                                readOnly
                            />
                        </div>

                        <div className="org-form-group">
                            <label>Organization Slug</label>
                            <input
                                type="text"
                                className="org-input"
                                value={activeOrg?.slug || ''}
                                disabled
                            />
                        </div>

                        <div className="org-form-group">
                            <label>Description</label>
                            <textarea
                                className="org-textarea"
                                value={activeOrg?.description || 'No description provided'}
                                disabled
                            />
                        </div>
                    </div>

                    {/* DANGER ZONE (OWNER ONLY) */}
                    {isOwner && (
                        <div className="org-danger-zone">
                            <h4>
                                <AlertTriangle size={18} />
                                Danger Zone
                            </h4>
                            <div className="org-danger-item">
                                <div className="org-danger-item__text">
                                    <h5>Transfer Ownership</h5>
                                    <p>Transfer organization ownership to another active member. You will become an Administrator.</p>
                                </div>
                                <button
                                    className="cicd-btn cicd-btn--secondary"
                                    onClick={() => setShowTransferModal(true)}
                                >
                                    Transfer Ownership
                                </button>
                            </div>

                            <div className="org-danger-item">
                                <div className="org-danger-item__text">
                                    <h5>Delete Organization</h5>
                                    <p>Permanently remove this organization and its team memberships. Workspaces and tests will be safely unlinked.</p>
                                </div>
                                <button
                                    className="cicd-btn cicd-btn--danger"
                                    onClick={handleDeleteOrg}
                                >
                                    Delete Organization
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL: Create Organization */}
            {showCreateOrgModal && (
                <div className="org-modal-backdrop" onClick={() => setShowCreateOrgModal(false)}>
                    <div className="org-modal" onClick={e => e.stopPropagation()}>
                        <div className="org-modal__header">
                            <h3>Create New Organization</h3>
                            <button className="org-modal__close" onClick={() => setShowCreateOrgModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateOrg}>
                            <div className="org-modal__body">
                                <div className="org-form-group">
                                    <label>Organization Name</label>
                                    <input
                                        type="text"
                                        className="org-input"
                                        placeholder="e.g. Acme Enterprise QA"
                                        value={newOrgName}
                                        onChange={e => setNewOrgName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="org-form-group">
                                    <label>Description (Optional)</label>
                                    <textarea
                                        className="org-textarea"
                                        placeholder="Team mission or scope"
                                        value={newOrgDesc}
                                        onChange={e => setNewOrgDesc(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="org-modal__footer">
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--secondary"
                                    onClick={() => setShowCreateOrgModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="cicd-btn cicd-btn--primary"
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Creating...' : 'Create Organization'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Create Workspace */}
            {showCreateWsModal && (
                <div className="org-modal-backdrop" onClick={() => setShowCreateWsModal(false)}>
                    <div className="org-modal" onClick={e => e.stopPropagation()}>
                        <div className="org-modal__header">
                            <h3>Create Workspace in {activeOrg?.name}</h3>
                            <button className="org-modal__close" onClick={() => setShowCreateWsModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateWorkspace}>
                            <div className="org-modal__body">
                                <div className="org-form-group">
                                    <label>Workspace Name</label>
                                    <input
                                        type="text"
                                        className="org-input"
                                        placeholder="e.g. Mobile App Automated Tests"
                                        value={newWsName}
                                        onChange={e => setNewWsName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="org-form-group">
                                    <label>Description (Optional)</label>
                                    <textarea
                                        className="org-textarea"
                                        placeholder="Scope of tests in this workspace"
                                        value={newWsDesc}
                                        onChange={e => setNewWsDesc(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="org-modal__footer">
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--secondary"
                                    onClick={() => setShowCreateWsModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="cicd-btn cicd-btn--primary"
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Creating...' : 'Create Workspace'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Invite Member */}
            {showInviteModal && (
                <div className="org-modal-backdrop" onClick={() => setShowInviteModal(false)}>
                    <div className="org-modal" onClick={e => e.stopPropagation()}>
                        <div className="org-modal__header">
                            <h3>Invite Team Member</h3>
                            <button className="org-modal__close" onClick={() => setShowInviteModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleInviteMember}>
                            <div className="org-modal__body">
                                <div className="org-form-group">
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        className="org-input"
                                        placeholder="colleague@company.com"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="org-form-group">
                                    <label>Role</label>
                                    <select
                                        className="org-select"
                                        value={inviteRole}
                                        onChange={e => setInviteRole(e.target.value)}
                                    >
                                        {ROLES_LIST.filter(r => r.id !== 'owner').map(r => (
                                            <option key={r.id} value={r.id}>{r.name} — {r.desc}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="org-form-group">
                                    <label>Invitation Message (Optional)</label>
                                    <textarea
                                        className="org-textarea"
                                        placeholder="Note for the invitee"
                                        value={inviteMessage}
                                        onChange={e => setInviteMessage(e.target.value)}
                                    />
                                </div>

                                {generatedInviteLink && (
                                    <div style={{ backgroundColor: '#161D23', padding: '0.75rem', borderRadius: '6px', marginTop: '1rem' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#8BAF9A', fontWeight: 600, marginBottom: '0.25rem' }}>
                                            Invitation Link Generated:
                                        </div>
                                        <code style={{ fontSize: '0.75rem', color: '#F8FAFC', wordBreak: 'break-all' }}>
                                            {generatedInviteLink}
                                        </code>
                                    </div>
                                )}
                            </div>
                            <div className="org-modal__footer">
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--secondary"
                                    onClick={() => setShowInviteModal(false)}
                                >
                                    Close
                                </button>
                                <button
                                    type="submit"
                                    className="cicd-btn cicd-btn--primary"
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Generating...' : 'Generate Invitation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Transfer Ownership */}
            {showTransferModal && (
                <div className="org-modal-backdrop" onClick={() => setShowTransferModal(false)}>
                    <div className="org-modal" onClick={e => e.stopPropagation()}>
                        <div className="org-modal__header">
                            <h3>Transfer Organization Ownership</h3>
                            <button className="org-modal__close" onClick={() => setShowTransferModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleTransferOwnership}>
                            <div className="org-modal__body">
                                <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: 0 }}>
                                    Select an active member of <strong>{activeOrg?.name}</strong> to transfer ownership to.
                                </p>

                                <div className="org-form-group">
                                    <label>Select New Owner</label>
                                    <select
                                        className="org-select"
                                        value={transferTargetId}
                                        onChange={e => setTransferTargetId(e.target.value)}
                                        required
                                    >
                                        <option value="">Select a member...</option>
                                        {members.filter(m => m.userId !== userId).map(m => (
                                            <option key={m.userId} value={m.userId}>
                                                {m.name || m.email || m.userId} ({m.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="org-modal__footer">
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--secondary"
                                    onClick={() => setShowTransferModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="cicd-btn cicd-btn--danger"
                                    disabled={actionLoading || !transferTargetId}
                                >
                                    {actionLoading ? 'Transferring...' : 'Confirm Ownership Transfer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrganizationManagementPage;

