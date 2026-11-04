import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
    GitBranch, Play, CheckCircle2, XCircle, AlertCircle, RefreshCw,
    Plus, ExternalLink, Shield, Key, Copy, Check, Clock, Terminal,
    Layers, Cpu, FileCode2, ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cicdService } from '../../services/cicdService';
import '../../styles/app/CiCdIntegrations.css';

const CiCdIntegrationsPage = () => {
    const { currentWorkspace, user } = useAuth();
    const workspaceId = currentWorkspace?.id;

    const [activeTab, setActiveTab] = useState('providers');
    const [isLoading, setIsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Data states
    const [providers, setProviders] = useState([]);
    const [githubConnection, setGithubConnection] = useState(null);
    const [pipelines, setPipelines] = useState([]);
    const [activity, setActivity] = useState([]);
    const [repositories, setRepositories] = useState([]);
    const [suites, setSuites] = useState([]);
    const [setupInstructions, setSetupInstructions] = useState(null);

    // Modals
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [connectToken, setConnectToken] = useState('');
    const [connectError, setConnectError] = useState('');

    const [showCreatePipelineModal, setShowCreatePipelineModal] = useState(false);
    const [newPipeline, setNewPipeline] = useState({
        name: '',
        repository: '',
        branch: 'main',
        suiteId: '',
        triggerEvents: ['push', 'pull_request'],
        browser: 'chromium',
        timeoutMinutes: 15
    });

    const [showTriggerModal, setShowTriggerModal] = useState(null); // holds pipeline to trigger
    const [triggerBranch, setTriggerBranch] = useState('');
    const [triggerCommit, setTriggerCommit] = useState('');

    const [copiedYaml, setCopiedYaml] = useState(false);

    // Initial load
    useEffect(() => {
        loadData();
    }, [workspaceId]);

    const loadData = async () => {
        if (!workspaceId) return;
        setIsLoading(true);
        setErrorMessage('');
        try {
            const [providersRes, connRes, pipeRes, actRes] = await Promise.all([
                cicdService.getProviders().catch(() => ({ data: [] })),
                cicdService.getConnectionStatus('github', workspaceId).catch(() => ({ data: null })),
                cicdService.getPipelines(workspaceId).catch(() => ({ data: [] })),
                cicdService.getActivity(workspaceId).catch(() => ({ data: [] }))
            ]);

            setProviders(providersRes.data || []);
            setGithubConnection(connRes.data || null);
            setPipelines(pipeRes.data || []);
            setActivity(actRes.data || []);

            // If GitHub is connected, fetch repositories
            if (connRes.data?.status === 'active') {
                cicdService.getRepositories('github', workspaceId)
                    .then(r => setRepositories(r.data || []))
                    .catch(() => {});
            }

            // Fetch test suites to populate dropdown
            fetchSuites();

            // Load setup instructions
            cicdService.getSetupInstructions('github', null, workspaceId)
                .then(inst => setSetupInstructions(inst.data))
                .catch(() => {});
        } catch (err) {
            setErrorMessage(err.message || 'Failed to load CI/CD integration data');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSuites = async () => {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
            const res = await fetch(`/api/v1/test-suites?workspaceId=${encodeURIComponent(workspaceId)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSuites(data.data || []);
            }
        } catch (e) {}
    };

    const handleConnectGithub = async (e) => {
        e.preventDefault();
        if (!connectToken.trim()) {
            setConnectError('Personal Access Token is required');
            return;
        }

        setActionLoading(true);
        setConnectError('');
        try {
            await cicdService.connectProvider('github', {
                workspaceId,
                token: connectToken.trim()
            });
            setShowConnectModal(false);
            setConnectToken('');
            setSuccessMessage('GitHub Actions integration connected successfully');
            loadData();
        } catch (err) {
            setConnectError(err.message || 'Failed to verify GitHub token');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDisconnect = async (provider) => {
        if (!window.confirm(`Disconnect ${provider} integration? Existing pipelines will stop triggering.`)) return;
        setActionLoading(true);
        try {
            await cicdService.disconnectProvider(provider, workspaceId);
            setSuccessMessage(`${provider} disconnected`);
            loadData();
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreatePipeline = async (e) => {
        e.preventDefault();
        if (!newPipeline.name || !newPipeline.repository || !newPipeline.suiteId) {
            alert('Please fill in pipeline name, repository, and test suite.');
            return;
        }

        setActionLoading(true);
        try {
            await cicdService.createPipeline({
                workspaceId,
                ...newPipeline
            });
            setShowCreatePipelineModal(false);
            setNewPipeline({
                name: '',
                repository: '',
                branch: 'main',
                suiteId: '',
                triggerEvents: ['push', 'pull_request'],
                browser: 'chromium',
                timeoutMinutes: 15
            });
            setSuccessMessage('Pipeline created successfully');
            loadData();
            setActiveTab('pipelines');
        } catch (err) {
            setErrorMessage(err.message || 'Failed to create pipeline');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeletePipeline = async (id) => {
        if (!window.confirm('Delete this CI/CD pipeline configuration?')) return;
        try {
            await cicdService.deletePipeline(id, workspaceId);
            setSuccessMessage('Pipeline deleted');
            loadData();
        } catch (err) {
            setErrorMessage(err.message);
        }
    };

    const handleManualTrigger = async (e) => {
        e.preventDefault();
        if (!showTriggerModal) return;

        setActionLoading(true);
        try {
            const res = await cicdService.triggerPipeline(showTriggerModal.id, {
                workspaceId,
                branch: triggerBranch || showTriggerModal.branch,
                commitSha: triggerCommit || null
            });
            setShowTriggerModal(null);
            setTriggerBranch('');
            setTriggerCommit('');
            setSuccessMessage(`CI execution dispatched successfully (Run ID: ${res.data?.runId || 'initiated'})`);
            loadData();
            setActiveTab('activity');
        } catch (err) {
            setErrorMessage(err.message || 'Failed to dispatch pipeline execution');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCopyYaml = () => {
        if (setupInstructions?.workflowYaml) {
            navigator.clipboard.writeText(setupInstructions.workflowYaml);
            setCopiedYaml(true);
            setTimeout(() => setCopiedYaml(false), 2500);
        }
    };

    return (
        <div className="cicd-page">
            {/* Header */}
            <div className="cicd-header">
                <div className="cicd-header__title-area">
                    <h1>
                        <GitBranch size={24} color="#8BAF9A" />
                        CI/CD Integrations
                    </h1>
                    <p className="cicd-header__subtitle">
                        Trigger real Playwright test suites from GitHub Actions pull requests and push events with commit status checks.
                    </p>
                </div>
                <div className="cicd-header__actions">
                    <button
                        className="cicd-btn cicd-btn--secondary"
                        onClick={loadData}
                        disabled={isLoading}
                        title="Refresh status"
                    >
                        <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
                        Refresh
                    </button>
                    {githubConnection?.status === 'active' ? (
                        <button
                            className="cicd-btn cicd-btn--primary"
                            onClick={() => setShowCreatePipelineModal(true)}
                        >
                            <Plus size={14} />
                            New Pipeline
                        </button>
                    ) : (
                        <button
                            className="cicd-btn cicd-btn--primary"
                            onClick={() => setShowConnectModal(true)}
                        >
                            <Key size={14} />
                            Connect GitHub
                        </button>
                    )}
                </div>
            </div>

            {/* Notification Banners */}
            {errorMessage && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <AlertCircle size={16} />
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
            <div className="cicd-tabs">
                <button
                    className={`cicd-tab ${activeTab === 'providers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('providers')}
                >
                    <Shield size={16} />
                    Providers
                    {githubConnection?.status === 'active' && (
                        <span className="cicd-badge cicd-badge--active" style={{ marginLeft: '4px' }}>Connected</span>
                    )}
                </button>
                <button
                    className={`cicd-tab ${activeTab === 'pipelines' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pipelines')}
                >
                    <Cpu size={16} />
                    Pipelines ({pipelines.length})
                </button>
                <button
                    className={`cicd-tab ${activeTab === 'activity' ? 'active' : ''}`}
                    onClick={() => setActiveTab('activity')}
                >
                    <Clock size={16} />
                    Pipeline Activity ({activity.length})
                </button>
                <button
                    className={`cicd-tab ${activeTab === 'setup' ? 'active' : ''}`}
                    onClick={() => setActiveTab('setup')}
                >
                    <FileCode2 size={16} />
                    Workflow Setup
                </button>
            </div>

            {/* TAB 1: PROVIDERS */}
            {activeTab === 'providers' && (
                <div>
                    <div className="cicd-providers-grid">
                        {/* GitHub Actions Card */}
                        <div className="cicd-provider-card">
                            <div>
                                <div className="cicd-provider-card__top">
                                    <div className="cicd-provider-card__identity">
                                        <div className="cicd-provider-card__icon">
                                            <GitBranch size={20} />
                                        </div>
                                        <div>
                                            <h3 className="cicd-provider-card__name">GitHub Actions</h3>
                                            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Official Provider</span>
                                        </div>
                                    </div>
                                    <span className={`cicd-badge ${githubConnection?.status === 'active' ? 'cicd-badge--active' : 'cicd-badge--disconnected'}`}>
                                        {githubConnection?.status === 'active' ? 'Connected' : 'Disconnected'}
                                    </span>
                                </div>
                                <p className="cicd-provider-card__desc">
                                    Trigger Playwright automation on pull requests and pushes. Publishes commit status checks with direct execution report links.
                                </p>

                                {githubConnection?.status === 'active' && (
                                    <div className="cicd-provider-card__meta">
                                        <div className="cicd-provider-card__meta-row">
                                            <span>Account:</span>
                                            <strong style={{ color: '#F8FAFC' }}>{githubConnection.accountLogin}</strong>
                                        </div>
                                        <div className="cicd-provider-card__meta-row">
                                            <span>Token:</span>
                                            <code>{githubConnection.tokenMasked}</code>
                                        </div>
                                        <div className="cicd-provider-card__meta-row">
                                            <span>Configured Pipelines:</span>
                                            <span>{pipelines.length}</span>
                                        </div>
                                        <div className="cicd-provider-card__meta-row">
                                            <span>Verified:</span>
                                            <span>{githubConnection.lastVerifiedAt ? new Date(githubConnection.lastVerifiedAt).toLocaleDateString() : 'Active'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                {githubConnection?.status === 'active' ? (
                                    <>
                                        <button
                                            className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                            onClick={() => setShowConnectModal(true)}
                                            style={{ flex: 1 }}
                                        >
                                            Update Token
                                        </button>
                                        <button
                                            className="cicd-btn cicd-btn--danger cicd-btn--sm"
                                            onClick={() => handleDisconnect('github')}
                                        >
                                            Disconnect
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="cicd-btn cicd-btn--primary cicd-btn--sm"
                                        onClick={() => setShowConnectModal(true)}
                                        style={{ width: '100%' }}
                                    >
                                        <Key size={14} />
                                        Connect GitHub
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* GitLab CI/CD Card (Architecture Extension) */}
                        <div className="cicd-provider-card" style={{ opacity: 0.85 }}>
                            <div>
                                <div className="cicd-provider-card__top">
                                    <div className="cicd-provider-card__identity">
                                        <div className="cicd-provider-card__icon">
                                            <Terminal size={20} />
                                        </div>
                                        <div>
                                            <h3 className="cicd-provider-card__name">GitLab CI/CD</h3>
                                            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Pipelines & MRs</span>
                                        </div>
                                    </div>
                                    <span className="cicd-badge cicd-badge--coming-soon">Coming Soon</span>
                                </div>
                                <p className="cicd-provider-card__desc">
                                    Trigger test executions from GitLab pipelines and Merge Request events with GitLab commit pipeline badges.
                                </p>
                            </div>
                            <button className="cicd-btn cicd-btn--secondary cicd-btn--sm" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                Architecture Ready
                            </button>
                        </div>

                        {/* Jenkins CI Card (Architecture Extension) */}
                        <div className="cicd-provider-card" style={{ opacity: 0.85 }}>
                            <div>
                                <div className="cicd-provider-card__top">
                                    <div className="cicd-provider-card__identity">
                                        <div className="cicd-provider-card__icon">
                                            <Cpu size={20} />
                                        </div>
                                        <div>
                                            <h3 className="cicd-provider-card__name">Jenkins</h3>
                                            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Multi-branch Jobs</span>
                                        </div>
                                    </div>
                                    <span className="cicd-badge cicd-badge--coming-soon">Coming Soon</span>
                                </div>
                                <p className="cicd-provider-card__desc">
                                    Webhook triggers and build notification integration for Jenkins on-premise and cloud pipelines.
                                </p>
                            </div>
                            <button className="cicd-btn cicd-btn--secondary cicd-btn--sm" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                Architecture Ready
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: PIPELINES */}
            {activeTab === 'pipelines' && (
                <div className="cicd-table-card">
                    <div className="cicd-table-toolbar">
                        <h3 className="cicd-table-toolbar__title">Configured Trigger Pipelines</h3>
                        <button
                            className="cicd-btn cicd-btn--primary cicd-btn--sm"
                            onClick={() => setShowCreatePipelineModal(true)}
                        >
                            <Plus size={14} />
                            Add Pipeline
                        </button>
                    </div>

                    {pipelines.length === 0 ? (
                        <div className="cicd-empty">
                            <Cpu size={40} className="cicd-empty__icon" />
                            <h4 className="cicd-empty__title">No pipelines configured</h4>
                            <p className="cicd-empty__desc">
                                Connect a repository and branch to a TestNexa test suite to automate regression checks on push and PR events.
                            </p>
                            <button
                                className="cicd-btn cicd-btn--primary cicd-btn--sm"
                                onClick={() => setShowCreatePipelineModal(true)}
                            >
                                <Plus size={14} />
                                Configure First Pipeline
                            </button>
                        </div>
                    ) : (
                        <table className="cicd-table">
                            <thead>
                                <tr>
                                    <th>Pipeline Name</th>
                                    <th>Repository</th>
                                    <th>Branch</th>
                                    <th>Target Suite</th>
                                    <th>Triggers</th>
                                    <th>Browser</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pipelines.map(pipe => (
                                    <tr key={pipe.id}>
                                        <td>
                                            <strong style={{ color: '#F8FAFC' }}>{pipe.name}</strong>
                                            <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{pipe.id}</div>
                                        </td>
                                        <td>
                                            <code>{pipe.repository}</code>
                                        </td>
                                        <td>
                                            <span className="cicd-badge cicd-badge--disconnected">{pipe.branch || 'main'}</span>
                                        </td>
                                        <td>
                                            <NavLink to={`/app/test-suites/${pipe.suiteId}`} style={{ color: '#8BAF9A', textDecoration: 'none' }}>
                                                {pipe.suiteName || pipe.suiteId}
                                            </NavLink>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                {pipe.triggerEvents?.map(ev => (
                                                    <span key={ev} className="cicd-badge cicd-badge--disconnected" style={{ fontSize: '0.7rem' }}>
                                                        {ev}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ textTransform: 'capitalize' }}>{pipe.browser || 'chromium'}</span>
                                        </td>
                                        <td>
                                            <span className={`cicd-badge ${pipe.isActive ? 'cicd-badge--active' : 'cicd-badge--disconnected'}`}>
                                                {pipe.isActive ? 'Active' : 'Paused'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                                <button
                                                    className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                    title="Trigger Execution Now"
                                                    onClick={() => {
                                                        setShowTriggerModal(pipe);
                                                        setTriggerBranch(pipe.branch || 'main');
                                                    }}
                                                >
                                                    <Play size={12} color="#8BAF9A" />
                                                    Run
                                                </button>
                                                <button
                                                    className="cicd-btn cicd-btn--danger cicd-btn--sm"
                                                    title="Delete Pipeline"
                                                    onClick={() => handleDeletePipeline(pipe.id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* TAB 3: ACTIVITY */}
            {activeTab === 'activity' && (
                <div className="cicd-table-card">
                    <div className="cicd-table-toolbar">
                        <h3 className="cicd-table-toolbar__title">CI/CD Execution History</h3>
                    </div>

                    {activity.length === 0 ? (
                        <div className="cicd-empty">
                            <Clock size={40} className="cicd-empty__icon" />
                            <h4 className="cicd-empty__title">No CI executions recorded yet</h4>
                            <p className="cicd-empty__desc">
                                Executions triggered via GitHub webhooks or manual triggers will appear here in real-time.
                            </p>
                        </div>
                    ) : (
                        <table className="cicd-table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Repository & Branch</th>
                                    <th>Commit / PR</th>
                                    <th>Trigger Type</th>
                                    <th>Started At</th>
                                    <th>Duration</th>
                                    <th>Results</th>
                                    <th style={{ textAlign: 'right' }}>Execution Report</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activity.map(act => {
                                    let badgeClass = 'cicd-badge--running';
                                    if (act.status === 'passed') badgeClass = 'cicd-badge--passed';
                                    if (act.status === 'failed') badgeClass = 'cicd-badge--failed';

                                    return (
                                        <tr key={act.id}>
                                            <td>
                                                <span className={`cicd-badge ${badgeClass}`}>
                                                    {act.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div><code>{act.repository}</code></div>
                                                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>branch: {act.branch}</span>
                                            </td>
                                            <td>
                                                {act.commitSha ? (
                                                    <div>
                                                        <code>{act.commitSha.substring(0, 7)}</code>
                                                        {act.commitMessage && (
                                                            <div style={{ fontSize: '0.75rem', color: '#94A3B8', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {act.commitMessage}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#94A3B8' }}>{act.prNumber ? `PR #${act.prNumber}` : 'Manual'}</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className="cicd-badge cicd-badge--disconnected" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                                    {act.triggerType}
                                                </span>
                                            </td>
                                            <td>
                                                {act.startedAt ? new Date(act.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                                            </td>
                                            <td>
                                                {act.durationSeconds ? `${act.durationSeconds}s` : (act.status === 'running' ? 'In progress' : '-')}
                                            </td>
                                            <td>
                                                {act.totalCases ? (
                                                    <span style={{ fontSize: '0.8125rem' }}>
                                                        <strong style={{ color: '#8BAF9A' }}>{act.passedCases || 0} passed</strong>
                                                        {act.failedCases > 0 && <span style={{ color: '#F87171' }}>, {act.failedCases} failed</span>}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {act.runId && (
                                                    <NavLink
                                                        to={`/app/runs/${act.runId}`}
                                                        className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                        style={{ textDecoration: 'none' }}
                                                    >
                                                        View Report
                                                        <ExternalLink size={12} />
                                                    </NavLink>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* TAB 4: SETUP INSTRUCTIONS */}
            {activeTab === 'setup' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
                    <div className="cicd-table-card" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#F8FAFC' }}>
                                GitHub Actions Workflow Template
                            </h3>
                            <button
                                className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                onClick={handleCopyYaml}
                            >
                                {copiedYaml ? <Check size={14} color="#8BAF9A" /> : <Copy size={14} />}
                                {copiedYaml ? 'Copied!' : 'Copy YAML'}
                            </button>
                        </div>
                        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', margin: '0 0 1rem' }}>
                            Add this file to your repository at <code>.github/workflows/testnexa-qa.yml</code> to run Playwright verification automatically on pull requests.
                        </p>

                        <div className="cicd-code-box">
                            <pre style={{ margin: 0 }}>
                                {setupInstructions?.workflowYaml || '# Loading workflow template...'}
                            </pre>
                        </div>
                    </div>

                    <div className="cicd-table-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.125rem', color: '#F8FAFC' }}>
                            Integration Setup Steps
                        </h3>

                        {setupInstructions?.setupSteps?.map(step => (
                            <div key={step.step} className="cicd-instruction-step">
                                <div className="cicd-step-number">{step.step}</div>
                                <div className="cicd-step-body">
                                    <h4>{step.title}</h4>
                                    <p>{step.details}</p>
                                </div>
                            </div>
                        ))}

                        <div style={{ backgroundColor: '#161D23', padding: '1rem', borderRadius: '6px', marginTop: '1.5rem' }}>
                            <h5 style={{ margin: '0 0 0.5rem', color: '#8BAF9A', fontSize: '0.8125rem' }}>Webhook Payload Endpoint</h5>
                            <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: '#E2E8F0' }}>
                                {setupInstructions?.webhookUrl || '/api/v1/integrations/cicd/webhooks/github'}
                            </code>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 1: Connect GitHub */}
            {showConnectModal && (
                <div className="cicd-modal-backdrop" onClick={() => setShowConnectModal(false)}>
                    <div className="cicd-modal" onClick={e => e.stopPropagation()}>
                        <div className="cicd-modal__header">
                            <h3>Connect GitHub Actions</h3>
                            <button className="cicd-modal__close" onClick={() => setShowConnectModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleConnectGithub}>
                            <div className="cicd-modal__body">
                                <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: 0, lineHeight: 1.5 }}>
                                    Provide a GitHub Personal Access Token (PAT) with <code>repo</code> and <code>repo:status</code> permissions. TestNexa AI encrypts your token with AES-256-GCM.
                                </p>

                                {connectError && (
                                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#F87171', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                                        {connectError}
                                    </div>
                                )}

                                <div className="cicd-form-group">
                                    <label>Personal Access Token (classic or fine-grained)</label>
                                    <input
                                        type="password"
                                        className="cicd-input"
                                        placeholder="ghp_••••••••••••••••••••••••••••••••"
                                        value={connectToken}
                                        onChange={e => setConnectToken(e.target.value)}
                                        required
                                    />
                                    <span className="cicd-helper-text">
                                        Tokens are encrypted at rest and never returned in plaintext to the browser.
                                    </span>
                                </div>
                            </div>
                            <div className="cicd-modal__footer">
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--secondary"
                                    onClick={() => setShowConnectModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="cicd-btn cicd-btn--primary"
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Verifying...' : 'Authorize & Connect'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Create Pipeline */}
            {showCreatePipelineModal && (
                <div className="cicd-modal-backdrop" onClick={() => setShowCreatePipelineModal(false)}>
                    <div className="cicd-modal" onClick={e => e.stopPropagation()}>
                        <div className="cicd-modal__header">
                            <h3>Configure CI/CD Pipeline</h3>
                            <button className="cicd-modal__close" onClick={() => setShowCreatePipelineModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreatePipeline}>
                            <div className="cicd-modal__body">
                                <div className="cicd-form-group">
                                    <label>Pipeline Name</label>
                                    <input
                                        type="text"
                                        className="cicd-input"
                                        placeholder="e.g. Main Pull Request Quality Gate"
                                        value={newPipeline.name}
                                        onChange={e => setNewPipeline({ ...newPipeline, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="cicd-form-group">
                                    <label>Repository (owner/repo)</label>
                                    {repositories.length > 0 ? (
                                        <select
                                            className="cicd-select"
                                            value={newPipeline.repository}
                                            onChange={e => setNewPipeline({ ...newPipeline, repository: e.target.value })}
                                            required
                                        >
                                            <option value="">Select a connected repository...</option>
                                            {repositories.map(r => (
                                                <option key={r.id} value={r.fullName}>{r.fullName}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            className="cicd-input"
                                            placeholder="acme/my-web-app"
                                            value={newPipeline.repository}
                                            onChange={e => setNewPipeline({ ...newPipeline, repository: e.target.value })}
                                            required
                                        />
                                    )}
                                </div>

                                <div className="cicd-form-group">
                                    <label>Target Branch (supports wildcard *)</label>
                                    <input
                                        type="text"
                                        className="cicd-input"
                                        placeholder="main, master, release/*"
                                        value={newPipeline.branch}
                                        onChange={e => setNewPipeline({ ...newPipeline, branch: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="cicd-form-group">
                                    <label>Playwright Test Suite to Execute</label>
                                    <select
                                        className="cicd-select"
                                        value={newPipeline.suiteId}
                                        onChange={e => setNewPipeline({ ...newPipeline, suiteId: e.target.value })}
                                        required
                                    >
                                        <option value="">Select an approved test suite...</option>
                                        {suites.map(s => (
                                            <option key={s.id} value={s.id}>{s.name || s.title || s.id}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="cicd-form-group">
                                    <label>Browser Configuration</label>
                                    <select
                                        className="cicd-select"
                                        value={newPipeline.browser}
                                        onChange={e => setNewPipeline({ ...newPipeline, browser: e.target.value })}
                                    >
                                        <option value="chromium">Chromium (Headless)</option>
                                        <option value="firefox">Firefox</option>
                                        <option value="webkit">WebKit (Safari engine)</option>
                                    </select>
                                </div>

                                <div className="cicd-form-group">
                                    <label>Trigger Events</label>
                                    <div className="cicd-checkbox-group">
                                        <label className="cicd-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={newPipeline.triggerEvents.includes('pull_request')}
                                                onChange={e => {
                                                    const exists = newPipeline.triggerEvents.includes('pull_request');
                                                    setNewPipeline({
                                                        ...newPipeline,
                                                        triggerEvents: exists
                                                            ? newPipeline.triggerEvents.filter(x => x !== 'pull_request')
                                                            : [...newPipeline.triggerEvents, 'pull_request']
                                                    });
                                                }}
                                            />
                                            Pull Requests
                                        </label>
                                        <label className="cicd-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={newPipeline.triggerEvents.includes('push')}
                                                onChange={e => {
                                                    const exists = newPipeline.triggerEvents.includes('push');
                                                    setNewPipeline({
                                                        ...newPipeline,
                                                        triggerEvents: exists
                                                            ? newPipeline.triggerEvents.filter(x => x !== 'push')
                                                            : [...newPipeline.triggerEvents, 'push']
                                                    });
                                                }}
                                            />
                                            Branch Pushes
                                        </label>
                                        <label className="cicd-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={newPipeline.triggerEvents.includes('workflow_dispatch')}
                                                onChange={e => {
                                                    const exists = newPipeline.triggerEvents.includes('workflow_dispatch');
                                                    setNewPipeline({
                                                        ...newPipeline,
                                                        triggerEvents: exists
                                                            ? newPipeline.triggerEvents.filter(x => x !== 'workflow_dispatch')
                                                            : [...newPipeline.triggerEvents, 'workflow_dispatch']
                                                    });
                                                }}
                                            />
                                            Manual Dispatch
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="cicd-modal__footer">
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--secondary"
                                    onClick={() => setShowCreatePipelineModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="cicd-btn cicd-btn--primary"
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Saving...' : 'Save Pipeline'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: Manual Execution Trigger */}
            {showTriggerModal && (
                <div className="cicd-modal-backdrop" onClick={() => setShowTriggerModal(null)}>
                    <div className="cicd-modal" onClick={e => e.stopPropagation()}>
                        <div className="cicd-modal__header">
                            <h3>Run Pipeline Now</h3>
                            <button className="cicd-modal__close" onClick={() => setShowTriggerModal(null)}>×</button>
                        </div>
                        <form onSubmit={handleManualTrigger}>
                            <div className="cicd-modal__body">
                                <p style={{ fontSize: '0.8125rem', color: '#94A3B8', marginTop: 0 }}>
                                    Dispatch a real Playwright execution for <strong>{showTriggerModal.name}</strong>.
                                </p>

                                <div className="cicd-form-group">
                                    <label>Branch</label>
                                    <input
                                        type="text"
                                        className="cicd-input"
                                        value={triggerBranch}
                                        onChange={e => setTriggerBranch(e.target.value)}
                                        placeholder="main"
                                        required
                                    />
                                </div>

                                <div className="cicd-form-group">
                                    <label>Commit SHA (Optional)</label>
                                    <input
                                        type="text"
                                        className="cicd-input"
                                        value={triggerCommit}
                                        onChange={e => setTriggerCommit(e.target.value)}
                                        placeholder="e.g. 7c1e3a4"
                                    />
                                    <span className="cicd-helper-text">
                                        If provided, GitHub status check will be reported against this commit.
                                    </span>
                                </div>
                            </div>
                            <div className="cicd-modal__footer">
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--secondary"
                                    onClick={() => setShowTriggerModal(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="cicd-btn cicd-btn--primary"
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Dispatching...' : 'Dispatch Execution'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CiCdIntegrationsPage;
