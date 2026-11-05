import React, { useState, useEffect } from 'react';
import {
    Shield, Key, Lock, Smartphone, Globe, AlertTriangle, CheckCircle2,
    RefreshCw, Trash2, Plus, Copy, Check, Eye, EyeOff, Laptop, Clock,
    Sliders, FileText, Download, ShieldAlert, ShieldCheck
} from 'lucide-react';
import { organizationService } from '../../services/organizationService';

export const SecuritySettingsView = ({ activeOrg }) => {
    const orgId = activeOrg?.id;

    // Sub-tab selection
    const [securitySubTab, setSecuritySubTab] = useState('auth'); // 'auth', 'sessions', 'apikeys', 'policies', 'ipallowlist', 'events'
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

    // SSO State
    const [ssoConfig, setSsoConfig] = useState(null);
    const [ssoProvider, setSsoProvider] = useState('saml2');
    const [ssoEntityId, setSsoEntityId] = useState('');
    const [ssoSignInUrl, setSsoSignInUrl] = useState('');
    const [ssoCertificate, setSsoCertificate] = useState('');
    const [ssoIssuerUrl, setSsoIssuerUrl] = useState('');
    const [ssoClientId, setSsoClientId] = useState('');
    const [ssoClientSecret, setSsoClientSecret] = useState('');
    const [ssoDomains, setSsoDomains] = useState('');
    const [isSsoEnforced, setIsSsoEnforced] = useState(false);
    const [showSsoSecret, setShowSsoSecret] = useState(false);

    // MFA State
    const [mfaStatus, setMfaStatus] = useState(null);
    const [mfaSetupData, setMfaSetupData] = useState(null);
    const [mfaCode, setMfaCode] = useState('');
    const [mfaDisablePassword, setMfaDisablePassword] = useState('');
    const [showDisableMfaModal, setShowDisableMfaModal] = useState(false);

    // Sessions State
    const [sessions, setSessions] = useState([]);

    // API Keys State
    const [apiKeys, setApiKeys] = useState([]);
    const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyScopes, setNewKeyScopes] = useState(['testcases:read', 'executions:read']);
    const [newKeyExpiry, setNewKeyExpiry] = useState(90);
    const [createdKeySecret, setCreatedKeySecret] = useState(null);
    const [copiedKey, setCopiedKey] = useState(false);

    // Security Policies State
    const [policy, setPolicy] = useState({
        requireMfa: false,
        mfaEnforcedRoles: ['owner', 'admin'],
        passwordMinLength: 10,
        passwordRequireSpecial: true,
        passwordRequireNumber: true,
        sessionMaxDurationHours: 720,
        idleTimeoutMinutes: 60,
        enforceIpAllowlist: false,
        approvedEmailDomains: [],
        artifactRetentionDays: 90,
        auditRetentionDays: 365
    });
    const [newDomainInput, setNewDomainInput] = useState('');

    // IP Allowlist State
    const [ipEntries, setIpEntries] = useState([]);
    const [newIpCidr, setNewIpCidr] = useState('');
    const [newIpDescription, setNewIpDescription] = useState('');
    const [myIp, setMyIp] = useState('');

    // Security Events Stream
    const [securityEvents, setSecurityEvents] = useState([]);

    useEffect(() => {
        if (orgId) {
            loadAllSecurityData();
        }
    }, [orgId]);

    const loadAllSecurityData = async () => {
        setIsLoading(true);
        setStatusMessage({ type: '', text: '' });
        try {
            await Promise.allSettled([
                loadSso(),
                loadMfa(),
                loadSessions(),
                loadApiKeys(),
                loadPolicy(),
                loadIpAllowlist(),
                loadSecurityEvents()
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSso = async () => {
        try {
            const res = await organizationService.getSsoConfig(orgId);
            if (res?.data) {
                setSsoConfig(res.data);
                setSsoProvider(res.data.provider || 'saml2');
                setSsoEntityId(res.data.entityId || '');
                setSsoSignInUrl(res.data.signInUrl || '');
                setSsoCertificate(res.data.certificate || '');
                setSsoIssuerUrl(res.data.issuerUrl || '');
                setSsoClientId(res.data.clientId || '');
                setSsoDomains((res.data.domains || []).join(', '));
                setIsSsoEnforced(Boolean(res.data.isEnforced));
            } else {
                setSsoConfig(null);
            }
        } catch (e) {
            console.warn('Failed loading SSO config:', e.message);
        }
    };

    const loadMfa = async () => {
        try {
            const res = await organizationService.getMfaStatus();
            if (res?.data) {
                setMfaStatus(res.data);
            }
        } catch (e) {
            console.warn('Failed loading MFA status:', e.message);
        }
    };

    const loadSessions = async () => {
        try {
            const res = await organizationService.listSessions();
            if (res?.data) {
                setSessions(res.data);
            }
        } catch (e) {
            console.warn('Failed loading sessions:', e.message);
        }
    };

    const loadApiKeys = async () => {
        try {
            const res = await organizationService.listApiKeys(orgId);
            if (res?.data) {
                setApiKeys(res.data);
            }
        } catch (e) {
            console.warn('Failed loading API keys:', e.message);
        }
    };

    const loadPolicy = async () => {
        try {
            const res = await organizationService.getSecurityPolicy(orgId);
            if (res?.data) {
                setPolicy(res.data);
            }
        } catch (e) {
            console.warn('Failed loading security policy:', e.message);
        }
    };

    const loadIpAllowlist = async () => {
        try {
            const [allowlistRes, myIpRes] = await Promise.all([
                organizationService.listIpAllowlist(orgId),
                organizationService.getMyIp().catch(() => ({ data: { ip: '' } }))
            ]);
            if (allowlistRes?.data) setIpEntries(allowlistRes.data);
            if (myIpRes?.data?.ip) setMyIp(myIpRes.data.ip);
        } catch (e) {
            console.warn('Failed loading IP allowlist:', e.message);
        }
    };

    const loadSecurityEvents = async () => {
        try {
            const res = await organizationService.listSecurityEvents(orgId, 50);
            if (res?.data) setSecurityEvents(res.data);
        } catch (e) {
            console.warn('Failed loading security events:', e.message);
        }
    };

    // Actions: SSO
    const handleSaveSso = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        setStatusMessage({ type: '', text: '' });
        try {
            const domainsArr = ssoDomains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
            const payload = {
                provider: ssoProvider,
                domains: domainsArr,
                entityId: ssoEntityId.trim(),
                signInUrl: ssoSignInUrl.trim(),
                certificate: ssoCertificate.trim(),
                issuerUrl: ssoIssuerUrl.trim(),
                clientId: ssoClientId.trim(),
                clientSecret: ssoClientSecret.trim()
            };
            const res = await organizationService.configureSso(orgId, payload);
            setSsoConfig(res.data);
            setStatusMessage({ type: 'success', text: 'SSO configuration saved successfully.' });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleTestSso = async () => {
        setActionLoading(true);
        setStatusMessage({ type: '', text: '' });
        try {
            const res = await organizationService.testSsoConfig(orgId);
            setStatusMessage({ type: 'success', text: `SSO Test Passed! Connection verified with ${res.data.provider.toUpperCase()} (${res.data.domains.join(', ')}).` });
        } catch (err) {
            setStatusMessage({ type: 'error', text: `SSO Test Failed: ${err.message}` });
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleSsoEnforcement = async () => {
        setActionLoading(true);
        try {
            const nextState = !isSsoEnforced;
            await organizationService.toggleSsoEnforcement(orgId, nextState);
            setIsSsoEnforced(nextState);
            setStatusMessage({ type: 'success', text: `SSO authentication is now ${nextState ? 'ENFORCED' : 'OPTIONAL'}.` });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    // Actions: MFA
    const handleStartMfaSetup = async () => {
        setActionLoading(true);
        try {
            const res = await organizationService.setupMfa();
            setMfaSetupData(res.data);
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleConfirmMfa = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await organizationService.verifyMfa(mfaCode.trim());
            setMfaStatus({ enabled: true, verifiedAt: new Date().toISOString() });
            setMfaSetupData({ ...mfaSetupData, recoveryCodes: res.data.recoveryCodes, verified: true });
            setStatusMessage({ type: 'success', text: 'MFA enabled! Please download and save your single-use recovery codes.' });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDisableMfa = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            await organizationService.disableMfa(mfaDisablePassword, mfaCode);
            setMfaStatus({ enabled: false });
            setShowDisableMfaModal(false);
            setMfaSetupData(null);
            setMfaCode('');
            setMfaDisablePassword('');
            setStatusMessage({ type: 'success', text: 'Two-factor authentication has been disabled.' });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    // Actions: Sessions
    const handleRevokeSession = async (sessionId) => {
        try {
            await organizationService.revokeSession(sessionId);
            setSessions(sessions.filter(s => s.id !== sessionId));
            setStatusMessage({ type: 'success', text: 'Session revoked successfully.' });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        }
    };

    const handleRevokeAllOtherSessions = async () => {
        if (!window.confirm('Revoke all other active sessions across devices?')) return;
        setActionLoading(true);
        try {
            await organizationService.revokeAllOtherSessions();
            await loadSessions();
            setStatusMessage({ type: 'success', text: 'All other active sessions have been terminated.' });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    // Actions: API Keys
    const handleCreateApiKey = async (e) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;
        setActionLoading(true);
        try {
            const res = await organizationService.createApiKey(orgId, {
                name: newKeyName.trim(),
                scopes: newKeyScopes,
                expiryDays: parseInt(newKeyExpiry, 10) || 90
            });
            setCreatedKeySecret(res.data.key);
            setApiKeys([res.data, ...apiKeys]);
            setNewKeyName('');
            setStatusMessage({ type: 'success', text: 'API Key generated! Copy your token now — it will not be displayed again.' });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRotateApiKey = async (keyId) => {
        if (!window.confirm('Rotate this API key? The old key will expire and a new secret will be created.')) return;
        setActionLoading(true);
        try {
            const res = await organizationService.rotateApiKey(orgId, keyId);
            setCreatedKeySecret(res.data.key);
            setShowCreateKeyModal(true);
            await loadApiKeys();
            setStatusMessage({ type: 'success', text: 'API Key rotated successfully.' });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevokeApiKey = async (keyId) => {
        if (!window.confirm('Permanently revoke this API key? Applications using it will immediately be rejected.')) return;
        try {
            await organizationService.revokeApiKey(orgId, keyId);
            setApiKeys(apiKeys.map(k => k.id === keyId ? { ...k, status: 'revoked' } : k));
            setStatusMessage({ type: 'success', text: 'API key revoked.' });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        }
    };

    // Actions: Policy
    const handleUpdatePolicy = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await organizationService.updateSecurityPolicy(orgId, policy);
            setPolicy(res.data);
            setStatusMessage({ type: 'success', text: 'Organization security policy updated successfully.' });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddApprovedDomain = () => {
        if (!newDomainInput.trim()) return;
        const clean = newDomainInput.trim().toLowerCase().replace(/^@/, '');
        if (!policy.approvedEmailDomains.includes(clean)) {
            setPolicy({
                ...policy,
                approvedEmailDomains: [...(policy.approvedEmailDomains || []), clean]
            });
        }
        setNewDomainInput('');
    };

    const handleRemoveApprovedDomain = (domain) => {
        setPolicy({
            ...policy,
            approvedEmailDomains: (policy.approvedEmailDomains || []).filter(d => d !== domain)
        });
    };

    // Actions: IP Allowlist
    const handleAddIpEntry = async (e) => {
        e.preventDefault();
        if (!newIpCidr.trim()) return;
        setActionLoading(true);
        try {
            const res = await organizationService.addIpAllowlistEntry(orgId, {
                cidrOrIp: newIpCidr.trim(),
                description: newIpDescription.trim()
            });
            setIpEntries([...ipEntries, res.data]);
            setNewIpCidr('');
            setNewIpDescription('');
            setStatusMessage({ type: 'success', text: `IP rule ${res.data.cidrOrIp} added.` });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveIpEntry = async (entryId) => {
        try {
            await organizationService.removeIpAllowlistEntry(orgId, entryId);
            setIpEntries(ipEntries.filter(e => e.id !== entryId));
            setStatusMessage({ type: 'success', text: 'IP rule removed.' });
            loadSecurityEvents();
        } catch (err) {
            setStatusMessage({ type: 'error', text: err.message });
        }
    };

    if (isLoading) {
        return (
            <div className="org-card" style={{ padding: '3rem', textAlign: 'center' }}>
                <RefreshCw size={24} className="spin" style={{ color: '#8BAF9A', margin: '0 auto 1rem auto' }} />
                <p style={{ color: '#94A3B8' }}>Loading enterprise security controls...</p>
            </div>
        );
    }

    return (
        <div className="security-settings-view">
            {/* Status alerts */}
            {statusMessage.text && (
                <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontSize: '0.875rem',
                    backgroundColor: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 175, 154, 0.15)',
                    border: statusMessage.type === 'error' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(139, 175, 154, 0.3)',
                    color: statusMessage.type === 'error' ? '#F87171' : '#8BAF9A'
                }}>
                    {statusMessage.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    <span>{statusMessage.text}</span>
                </div>
            )}

            {/* Sub navigation pills */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', borderBottom: '1px solid #1E293B', paddingBottom: '0.75rem' }}>
                <button
                    className={`org-tab ${securitySubTab === 'auth' ? 'active' : ''}`}
                    onClick={() => setSecuritySubTab('auth')}
                    style={{ fontSize: '0.8125rem', padding: '0.4rem 0.8rem' }}
                >
                    <Lock size={14} /> Authentication & SSO
                </button>
                <button
                    className={`org-tab ${securitySubTab === 'sessions' ? 'active' : ''}`}
                    onClick={() => setSecuritySubTab('sessions')}
                    style={{ fontSize: '0.8125rem', padding: '0.4rem 0.8rem' }}
                >
                    <Laptop size={14} /> Sessions ({sessions.length})
                </button>
                <button
                    className={`org-tab ${securitySubTab === 'apikeys' ? 'active' : ''}`}
                    onClick={() => setSecuritySubTab('apikeys')}
                    style={{ fontSize: '0.8125rem', padding: '0.4rem 0.8rem' }}
                >
                    <Key size={14} /> API Keys ({apiKeys.length})
                </button>
                <button
                    className={`org-tab ${securitySubTab === 'policies' ? 'active' : ''}`}
                    onClick={() => setSecuritySubTab('policies')}
                    style={{ fontSize: '0.8125rem', padding: '0.4rem 0.8rem' }}
                >
                    <Sliders size={14} /> Policies & Compliance
                </button>
                <button
                    className={`org-tab ${securitySubTab === 'ipallowlist' ? 'active' : ''}`}
                    onClick={() => setSecuritySubTab('ipallowlist')}
                    style={{ fontSize: '0.8125rem', padding: '0.4rem 0.8rem' }}
                >
                    <Globe size={14} /> IP Allowlist ({ipEntries.length})
                </button>
                <button
                    className={`org-tab ${securitySubTab === 'events' ? 'active' : ''}`}
                    onClick={() => setSecuritySubTab('events')}
                    style={{ fontSize: '0.8125rem', padding: '0.4rem 0.8rem' }}
                >
                    <Clock size={14} /> Security Stream
                </button>
            </div>

            {/* SUB-TAB 1: AUTHENTICATION (SSO & MFA) */}
            {securitySubTab === 'auth' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* SSO Section */}
                    <div className="org-card">
                        <div className="org-card__header">
                            <div>
                                <h3 className="org-card__title">Enterprise Single Sign-On (SSO)</h3>
                                <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                                    Integrate with SAML 2.0 or OpenID Connect (OIDC) identity providers (Okta, Azure AD, Google Workspace).
                                </p>
                            </div>
                            {ssoConfig && (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        className="org-btn org-btn--secondary"
                                        onClick={handleTestSso}
                                        disabled={actionLoading}
                                    >
                                        <ShieldCheck size={14} /> Test Connection
                                    </button>
                                    <button
                                        type="button"
                                        className={`org-btn ${isSsoEnforced ? 'org-btn--danger' : 'org-btn--primary'}`}
                                        onClick={handleToggleSsoEnforcement}
                                        disabled={actionLoading}
                                    >
                                        {isSsoEnforced ? 'Disable SSO Enforcement' : 'Enforce SSO Only'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleSaveSso} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label className="org-form-label">Identity Provider Protocol</label>
                                <select
                                    className="org-input"
                                    value={ssoProvider}
                                    onChange={(e) => setSsoProvider(e.target.value)}
                                >
                                    <option value="saml2">SAML 2.0 (Okta, Azure AD, Ping)</option>
                                    <option value="oidc">OpenID Connect / OIDC (Google, Auth0)</option>
                                </select>
                            </div>

                            <div>
                                <label className="org-form-label">Authorized Corporate Domains (comma-separated)</label>
                                <input
                                    type="text"
                                    className="org-input"
                                    placeholder="e.g. acme.com, testnexa.ai"
                                    value={ssoDomains}
                                    onChange={(e) => setSsoDomains(e.target.value)}
                                    required
                                />
                            </div>

                            {ssoProvider === 'saml2' ? (
                                <>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label className="org-form-label">IdP Entity ID / Issuer URI</label>
                                        <input
                                            type="text"
                                            className="org-input"
                                            placeholder="https://identity.company.com/entityid"
                                            value={ssoEntityId}
                                            onChange={(e) => setSsoEntityId(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label className="org-form-label">Single Sign-On (SSO) Service URL</label>
                                        <input
                                            type="url"
                                            className="org-input"
                                            placeholder="https://identity.company.com/app/sso/saml"
                                            value={ssoSignInUrl}
                                            onChange={(e) => setSsoSignInUrl(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label className="org-form-label">X.509 Signing Certificate (PEM)</label>
                                        <textarea
                                            className="org-input"
                                            rows={4}
                                            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                                            value={ssoCertificate}
                                            onChange={(e) => setSsoCertificate(e.target.value)}
                                            style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                                            required
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label className="org-form-label">OIDC Discovery / Issuer URL</label>
                                        <input
                                            type="url"
                                            className="org-input"
                                            placeholder="https://accounts.google.com or https://company.okta.com/oauth2/default"
                                            value={ssoIssuerUrl}
                                            onChange={(e) => setSsoIssuerUrl(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="org-form-label">Client ID</label>
                                        <input
                                            type="text"
                                            className="org-input"
                                            placeholder="0oa83..."
                                            value={ssoClientId}
                                            onChange={(e) => setSsoClientId(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="org-form-label">Client Secret (Encrypted at rest with AES-256-GCM)</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showSsoSecret ? 'text' : 'password'}
                                                className="org-input"
                                                placeholder={ssoConfig?.hasSecret ? '••••••••••••••••' : 'Client secret from IdP'}
                                                value={ssoClientSecret}
                                                onChange={(e) => setSsoClientSecret(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSsoSecret(!showSsoSecret)}
                                                style={{ position: 'absolute', right: '10px', top: '10px', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                                            >
                                                {showSsoSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button type="submit" className="org-btn org-btn--primary" disabled={actionLoading}>
                                    <Lock size={14} /> Save SSO Configuration
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* TOTP MFA Section */}
                    <div className="org-card">
                        <div className="org-card__header">
                            <div>
                                <h3 className="org-card__title">Multi-Factor Authentication (TOTP MFA)</h3>
                                <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                                    Standard RFC 6238 time-based one-time password security compatible with Google Authenticator, Authy, and 1Password.
                                </p>
                            </div>
                            <div>
                                {mfaStatus?.enabled ? (
                                    <span style={{ backgroundColor: 'rgba(139, 175, 154, 0.15)', color: '#8BAF9A', border: '1px solid rgba(139, 175, 154, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                        MFA ACTIVE
                                    </span>
                                ) : (
                                    <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                        MFA NOT CONFIGURED
                                    </span>
                                )}
                            </div>
                        </div>

                        {!mfaStatus?.enabled && !mfaSetupData && (
                            <div style={{ padding: '1rem', border: '1px dashed #334155', borderRadius: '6px', textAlign: 'center' }}>
                                <Smartphone size={32} style={{ color: '#8BAF9A', margin: '0 auto 0.5rem auto' }} />
                                <h4 style={{ color: '#F1F5F9', marginBottom: '0.25rem' }}>Protect your account with an Authenticator App</h4>
                                <p style={{ color: '#94A3B8', fontSize: '0.8125rem', maxWidth: '450px', margin: '0 auto 1rem auto' }}>
                                    Require an authorization code generated by your mobile device whenever you log in or perform high-risk actions.
                                </p>
                                <button className="org-btn org-btn--primary" onClick={handleStartMfaSetup} disabled={actionLoading}>
                                    <Plus size={14} /> Set Up Authenticator
                                </button>
                            </div>
                        )}

                        {mfaSetupData && !mfaSetupData.verified && (
                            <div style={{ backgroundColor: '#13191E', border: '1px solid #232D36', borderRadius: '8px', padding: '1.25rem' }}>
                                <h4 style={{ color: '#F1F5F9', marginBottom: '0.5rem' }}>1. Scan QR Code or Enter Secret Key</h4>
                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                                    <div style={{ backgroundColor: '#FFFFFF', padding: '0.75rem', borderRadius: '6px' }}>
                                        <img src={mfaSetupData.qrCode} alt="TOTP QR Code" style={{ width: '160px', height: '160px', display: 'block' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '220px' }}>
                                        <p style={{ color: '#94A3B8', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                                            Can't scan? Enter this Base32 secret manually into your authenticator app:
                                        </p>
                                        <code style={{ display: 'block', backgroundColor: '#0B0F12', border: '1px solid #334155', color: '#8BAF9A', padding: '0.5rem 0.75rem', borderRadius: '4px', letterSpacing: '1px', wordBreak: 'break-all', fontSize: '0.875rem' }}>
                                            {mfaSetupData.secret}
                                        </code>
                                    </div>
                                </div>

                                <h4 style={{ color: '#F1F5F9', marginBottom: '0.5rem' }}>2. Enter 6-digit Code from Authenticator</h4>
                                <form onSubmit={handleConfirmMfa} style={{ display: 'flex', gap: '0.75rem', maxWidth: '350px' }}>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="000000"
                                        className="org-input"
                                        value={mfaCode}
                                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                        style={{ fontSize: '1.125rem', textAlign: 'center', letterSpacing: '3px' }}
                                        required
                                    />
                                    <button type="submit" className="org-btn org-btn--primary" disabled={actionLoading || mfaCode.length < 6}>
                                        Verify & Enable
                                    </button>
                                </form>
                            </div>
                        )}

                        {mfaSetupData?.recoveryCodes && (
                            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '1.25rem', marginTop: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <ShieldAlert size={18} style={{ color: '#F59E0B' }} />
                                    <strong style={{ color: '#F59E0B' }}>Save your emergency recovery codes</strong>
                                </div>
                                <p style={{ color: '#CBD5E1', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                                    If you lose access to your device, each single-use recovery code can unlock your account once. Store them in a secure password manager.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', backgroundColor: '#0B0F12', padding: '0.75rem', borderRadius: '6px' }}>
                                    {mfaSetupData.recoveryCodes.map((code, idx) => (
                                        <code key={idx} style={{ color: '#E2E8F0', fontSize: '0.8125rem', fontFamily: 'monospace' }}>{code}</code>
                                    ))}
                                </div>
                            </div>
                        )}

                        {mfaStatus?.enabled && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem' }}>
                                <span style={{ color: '#94A3B8', fontSize: '0.8125rem' }}>
                                    Configured with standard TOTP. Reauthentication required for modifications.
                                </span>
                                <button className="org-btn org-btn--danger" onClick={() => setShowDisableMfaModal(true)}>
                                    Disable 2FA
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SUB-TAB 2: SESSIONS & DEVICES */}
            {securitySubTab === 'sessions' && (
                <div className="org-card">
                    <div className="org-card__header">
                        <div>
                            <h3 className="org-card__title">Active Authentication Sessions</h3>
                            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                                Server-enforced sessions for your account. You can instantly terminate unrecognized or old devices.
                            </p>
                        </div>
                        {sessions.length > 1 && (
                            <button className="org-btn org-btn--danger" onClick={handleRevokeAllOtherSessions} disabled={actionLoading}>
                                Revoke All Other Sessions
                            </button>
                        )}
                    </div>

                    <table className="org-table">
                        <thead>
                            <tr>
                                <th>Device & Browser</th>
                                <th>IP Address</th>
                                <th>Location</th>
                                <th>Last Active</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((sess) => (
                                <tr key={sess.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Laptop size={16} style={{ color: '#8BAF9A' }} />
                                            <div>
                                                <strong>{sess.deviceDisplay || 'Desktop Device'}</strong>
                                                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{sess.browser} on {sess.os}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td><code style={{ fontSize: '0.8125rem' }}>{sess.ipAddress || '127.0.0.1'}</code></td>
                                    <td style={{ color: '#94A3B8', fontSize: '0.8125rem' }}>{sess.location || 'Local network'}</td>
                                    <td style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                                        {new Date(sess.lastActiveAt).toLocaleString()}
                                    </td>
                                    <td>
                                        {sess.isCurrent ? (
                                            <span style={{ backgroundColor: 'rgba(139, 175, 154, 0.15)', color: '#8BAF9A', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                CURRENT
                                            </span>
                                        ) : (
                                            <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Active</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {!sess.isCurrent && (
                                            <button
                                                className="org-btn org-btn--sm org-btn--secondary"
                                                onClick={() => handleRevokeSession(sess.id)}
                                                style={{ color: '#F87171' }}
                                            >
                                                Revoke
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* SUB-TAB 3: API KEYS */}
            {securitySubTab === 'apikeys' && (
                <div className="org-card">
                    <div className="org-card__header">
                        <div>
                            <h3 className="org-card__title">Organization API Keys</h3>
                            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                                High-entropy API tokens (`tnx_live_...`) for authenticating CI/CD runners, CLI scripts, and programmatic reporting.
                            </p>
                        </div>
                        <button className="org-btn org-btn--primary" onClick={() => setShowCreateKeyModal(true)}>
                            <Plus size={14} /> Generate API Key
                        </button>
                    </div>

                    {apiKeys.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94A3B8' }}>
                            <Key size={32} style={{ color: '#475569', margin: '0 auto 0.5rem auto' }} />
                            <p>No active API keys found for this organization.</p>
                        </div>
                    ) : (
                        <table className="org-table">
                            <thead>
                                <tr>
                                    <th>Key Name</th>
                                    <th>Token Prefix</th>
                                    <th>Scopes</th>
                                    <th>Created</th>
                                    <th>Last Used</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {apiKeys.map((key) => (
                                    <tr key={key.id}>
                                        <td><strong>{key.name}</strong></td>
                                        <td><code>{key.prefix || 'tnx_live_••••'}</code></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                {(key.scopes || []).map(sc => (
                                                    <span key={sc} style={{ backgroundColor: '#1E293B', color: '#CBD5E1', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>
                                                        {sc}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>{new Date(key.createdAt).toLocaleDateString()}</td>
                                        <td style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                                            {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td>
                                            <span className={`org-role-badge org-role-badge--${key.status === 'active' ? 'owner' : 'viewer'}`}>
                                                {key.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {key.status === 'active' && (
                                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                    <button className="org-btn org-btn--sm org-btn--secondary" onClick={() => handleRotateApiKey(key.id)} title="Rotate Key">
                                                        <RefreshCw size={12} />
                                                    </button>
                                                    <button className="org-btn org-btn--sm org-btn--secondary" onClick={() => handleRevokeApiKey(key.id)} style={{ color: '#F87171' }} title="Revoke Key">
                                                        <Trash2 size={12} />
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

            {/* SUB-TAB 4: POLICIES & COMPLIANCE */}
            {securitySubTab === 'policies' && (
                <div className="org-card">
                    <div className="org-card__header">
                        <div>
                            <h3 className="org-card__title">Organization Security Policies</h3>
                            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                                Configure password complexity, domain restrictions, session timeouts, and data retention standards.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleUpdatePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Domain Allowlist */}
                        <div>
                            <label className="org-form-label">Approved Corporate Email Domains</label>
                            <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.5rem' }}>
                                When configured, member invitations are restricted exclusively to approved domains.
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <input
                                    type="text"
                                    className="org-input"
                                    placeholder="e.g. acme.com"
                                    value={newDomainInput}
                                    onChange={(e) => setNewDomainInput(e.target.value)}
                                    style={{ maxWidth: '300px' }}
                                />
                                <button type="button" className="org-btn org-btn--secondary" onClick={handleAddApprovedDomain}>
                                    <Plus size={14} /> Add Domain
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {(policy.approvedEmailDomains || []).map(dom => (
                                    <span key={dom} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#1E293B', color: '#E2E8F0', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.8125rem' }}>
                                        @{dom}
                                        <button type="button" onClick={() => handleRemoveApprovedDomain(dom)} style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', padding: 0 }}>
                                            &times;
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Password rules */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', borderTop: '1px solid #1E293B', paddingTop: '1rem' }}>
                            <div>
                                <label className="org-form-label">Minimum Password Length</label>
                                <input
                                    type="number"
                                    min={8}
                                    max={64}
                                    className="org-input"
                                    value={policy.passwordMinLength}
                                    onChange={(e) => setPolicy({ ...policy, passwordMinLength: parseInt(e.target.value, 10) || 8 })}
                                />
                            </div>
                            <div>
                                <label className="org-form-label">Session Idle Timeout (Minutes)</label>
                                <input
                                    type="number"
                                    min={15}
                                    max={1440}
                                    className="org-input"
                                    value={policy.idleTimeoutMinutes}
                                    onChange={(e) => setPolicy({ ...policy, idleTimeoutMinutes: parseInt(e.target.value, 10) || 60 })}
                                />
                            </div>
                            <div>
                                <label className="org-form-label">Max Session Duration (Hours)</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={2160}
                                    className="org-input"
                                    value={policy.sessionMaxDurationHours}
                                    onChange={(e) => setPolicy({ ...policy, sessionMaxDurationHours: parseInt(e.target.value, 10) || 720 })}
                                />
                            </div>
                        </div>

                        {/* Toggles */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid #1E293B', paddingTop: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#F1F5F9', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={policy.passwordRequireNumber}
                                    onChange={(e) => setPolicy({ ...policy, passwordRequireNumber: e.target.checked })}
                                />
                                Require at least one number in user passwords
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#F1F5F9', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={policy.passwordRequireSpecial}
                                    onChange={(e) => setPolicy({ ...policy, passwordRequireSpecial: e.target.checked })}
                                />
                                Require at least one special character (!@#$%^&*)
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#F1F5F9', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={policy.requireMfa}
                                    onChange={(e) => setPolicy({ ...policy, requireMfa: e.target.checked })}
                                />
                                Enforce Multi-Factor Authentication across all organization members
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#F1F5F9', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={policy.enforceIpAllowlist}
                                    onChange={(e) => setPolicy({ ...policy, enforceIpAllowlist: e.target.checked })}
                                />
                                Enforce IP Address CIDR allowlist for all dashboard and API access
                            </label>
                        </div>

                        {/* Data Retention */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid #1E293B', paddingTop: '1rem' }}>
                            <div>
                                <label className="org-form-label">Test Artifact Storage Retention (Days)</label>
                                <input
                                    type="number"
                                    min={7}
                                    max={365}
                                    className="org-input"
                                    value={policy.artifactRetentionDays}
                                    onChange={(e) => setPolicy({ ...policy, artifactRetentionDays: parseInt(e.target.value, 10) || 90 })}
                                />
                            </div>
                            <div>
                                <label className="org-form-label">Audit Log History Retention (Days)</label>
                                <input
                                    type="number"
                                    min={30}
                                    max={1825}
                                    className="org-input"
                                    value={policy.auditRetentionDays}
                                    onChange={(e) => setPolicy({ ...policy, auditRetentionDays: parseInt(e.target.value, 10) || 365 })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <button type="submit" className="org-btn org-btn--primary" disabled={actionLoading}>
                                Save Security Policy
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* SUB-TAB 5: IP ALLOWLIST */}
            {securitySubTab === 'ipallowlist' && (
                <div className="org-card">
                    <div className="org-card__header">
                        <div>
                            <h3 className="org-card__title">Corporate IP Allowlist & CIDR Subnets</h3>
                            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                                Restrict TestNexa AI access to designated office VPNs and corporate CIDR blocks.
                            </p>
                        </div>
                        {myIp && (
                            <div style={{ fontSize: '0.8125rem', color: '#8BAF9A', backgroundColor: 'rgba(139, 175, 154, 0.1)', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                                Your Current IP: <strong>{myIp}</strong>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleAddIpEntry} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="CIDR or exact IP (e.g. 192.168.1.0/24 or 203.0.113.5)"
                            className="org-input"
                            style={{ flex: 1, minWidth: '240px' }}
                            value={newIpCidr}
                            onChange={(e) => setNewIpCidr(e.target.value)}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Description (e.g. Headquarters VPN)"
                            className="org-input"
                            style={{ flex: 1, minWidth: '200px' }}
                            value={newIpDescription}
                            onChange={(e) => setNewIpDescription(e.target.value)}
                        />
                        <button type="submit" className="org-btn org-btn--primary" disabled={actionLoading}>
                            <Plus size={14} /> Add IP Rule
                        </button>
                    </form>

                    {ipEntries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                            <Globe size={32} style={{ color: '#475569', margin: '0 auto 0.5rem auto' }} />
                            <p>No IP restrictions defined. All network origins currently permitted.</p>
                        </div>
                    ) : (
                        <table className="org-table">
                            <thead>
                                <tr>
                                    <th>IP / CIDR Block</th>
                                    <th>Description</th>
                                    <th>Created By</th>
                                    <th>Added At</th>
                                    <th style={{ textAlign: 'right' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ipEntries.map(entry => (
                                    <tr key={entry.id}>
                                        <td><code>{entry.cidrOrIp}</code></td>
                                        <td>{entry.description || '—'}</td>
                                        <td style={{ color: '#94A3B8', fontSize: '0.8125rem' }}>{entry.createdBy || 'Admin'}</td>
                                        <td style={{ color: '#94A3B8', fontSize: '0.8125rem' }}>{new Date(entry.createdAt).toLocaleDateString()}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="org-btn org-btn--sm org-btn--secondary" onClick={() => handleRemoveIpEntry(entry.id)} style={{ color: '#F87171' }}>
                                                <Trash2 size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* SUB-TAB 6: SECURITY EVENT STREAM */}
            {securitySubTab === 'events' && (
                <div className="org-card">
                    <div className="org-card__header">
                        <div>
                            <h3 className="org-card__title">Authoritative Security Event Stream</h3>
                            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                                Real-time audit records for SSO changes, MFA toggles, session revocations, and IP allowlist modifications.
                            </p>
                        </div>
                        <button className="org-btn org-btn--secondary" onClick={loadSecurityEvents}>
                            <RefreshCw size={14} /> Refresh Stream
                        </button>
                    </div>

                    {securityEvents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                            <Clock size={32} style={{ color: '#475569', margin: '0 auto 0.5rem auto' }} />
                            <p>No security events recorded yet.</p>
                        </div>
                    ) : (
                        <table className="org-table">
                            <thead>
                                <tr>
                                    <th>Timestamp (UTC)</th>
                                    <th>Action</th>
                                    <th>Actor</th>
                                    <th>IP Address</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {securityEvents.map((evt, idx) => (
                                    <tr key={evt.id || idx}>
                                        <td style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                                            {new Date(evt.timestamp || evt.createdAt).toLocaleString()}
                                        </td>
                                        <td>
                                            <code>{evt.action || evt.eventType}</code>
                                        </td>
                                        <td>{evt.actorEmail || evt.userId || 'System'}</td>
                                        <td><code>{evt.ipAddress || '—'}</code></td>
                                        <td>
                                            <span style={{
                                                backgroundColor: evt.status === 'success' || !evt.status ? 'rgba(139, 175, 154, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: evt.status === 'success' || !evt.status ? '#8BAF9A' : '#F87171',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '3px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600
                                            }}>
                                                {(evt.status || 'SUCCESS').toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* MODAL: GENERATE API KEY */}
            {showCreateKeyModal && (
                <div className="org-modal-overlay">
                    <div className="org-modal" style={{ maxWidth: '500px' }}>
                        <div className="org-modal__header">
                            <h3>Generate New Organization API Key</h3>
                            <button className="org-modal__close" onClick={() => { setShowCreateKeyModal(false); setCreatedKeySecret(null); }}>&times;</button>
                        </div>
                        {createdKeySecret ? (
                            <div style={{ padding: '1rem 0' }}>
                                <div style={{ backgroundColor: 'rgba(139, 175, 154, 0.15)', border: '1px solid #8BAF9A', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
                                    <p style={{ color: '#8BAF9A', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                        Copy this API key now. It will NEVER be shown again!
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <code style={{ flex: 1, backgroundColor: '#0B0F12', color: '#F1F5F9', padding: '0.5rem', borderRadius: '4px', wordBreak: 'break-all', fontSize: '0.8125rem' }}>
                                            {createdKeySecret}
                                        </code>
                                        <button
                                            type="button"
                                            className="org-btn org-btn--primary"
                                            onClick={() => {
                                                navigator.clipboard.writeText(createdKeySecret);
                                                setCopiedKey(true);
                                                setTimeout(() => setCopiedKey(false), 2000);
                                            }}
                                        >
                                            {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <button className="org-btn org-btn--secondary" style={{ width: '100%' }} onClick={() => { setShowCreateKeyModal(false); setCreatedKeySecret(null); }}>
                                    Done
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleCreateApiKey}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="org-form-label">Key Name</label>
                                    <input
                                        type="text"
                                        className="org-input"
                                        placeholder="e.g. GitHub Actions CI Runner"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="org-form-label">Key Expiration</label>
                                    <select className="org-input" value={newKeyExpiry} onChange={(e) => setNewKeyExpiry(e.target.value)}>
                                        <option value={30}>30 Days</option>
                                        <option value={90}>90 Days (Recommended)</option>
                                        <option value={180}>180 Days</option>
                                        <option value={365}>1 Year</option>
                                    </select>
                                </div>
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label className="org-form-label">Scopes & Permissions</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        {['projects:read', 'testcases:read', 'testcases:write', 'executions:trigger', 'executions:read', 'reports:read', 'integrations:manage'].map(sc => (
                                            <label key={sc} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: '#CBD5E1', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={newKeyScopes.includes(sc)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setNewKeyScopes([...newKeyScopes, sc]);
                                                        else setNewKeyScopes(newKeyScopes.filter(s => s !== sc));
                                                    }}
                                                />
                                                {sc}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button type="button" className="org-btn org-btn--secondary" onClick={() => setShowCreateKeyModal(false)}>Cancel</button>
                                    <button type="submit" className="org-btn org-btn--primary" disabled={actionLoading}>Generate Token</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL: DISABLE MFA REAUTHENTICATION */}
            {showDisableMfaModal && (
                <div className="org-modal-overlay">
                    <div className="org-modal" style={{ maxWidth: '400px' }}>
                        <div className="org-modal__header">
                            <h3>Disable Two-Factor Authentication</h3>
                            <button className="org-modal__close" onClick={() => setShowDisableMfaModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleDisableMfa} style={{ marginTop: '1rem' }}>
                            <p style={{ color: '#94A3B8', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                                Please reauthenticate by entering your current account password and a TOTP verification code.
                            </p>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="org-form-label">Account Password</label>
                                <input
                                    type="password"
                                    className="org-input"
                                    value={mfaDisablePassword}
                                    onChange={(e) => setMfaDisablePassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label className="org-form-label">Current 6-Digit TOTP Code</label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    className="org-input"
                                    placeholder="000000"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button type="button" className="org-btn org-btn--secondary" onClick={() => setShowDisableMfaModal(false)}>Cancel</button>
                                <button type="submit" className="org-btn org-btn--danger" disabled={actionLoading}>Confirm & Disable</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

