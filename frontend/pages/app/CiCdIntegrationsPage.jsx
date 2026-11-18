import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    GitBranch, RefreshCw, Plus, ExternalLink, Shield, Key, Copy, Check,
    Clock, Terminal, Cpu, FileCode2, ArrowRight, AlertCircle, CheckCircle2,
    X, Trash2, Pause, Play, Download, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cicdService } from '../../services/cicdService';
import { useFeature } from '../../config/features';
import '../../styles/app/CiCdIntegrations.css';

const TAB_KEYS = ['providers', 'pipelines', 'setup', 'activity'];

const CiCdIntegrationsPage = () => {
    const { currentWorkspace } = useAuth();
    const workspaceId = currentWorkspace?.id;
    const { enabled: testRunsEnabled } = useFeature('testRuns');

    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const activeTab = TAB_KEYS.includes(tabParam) ? tabParam : 'providers';

    const pipelineParam = searchParams.get('pipeline_id');

    // Notification banners from URL params or operations
    const [banner, setBanner] = useState(() => {
        if (searchParams.get('integration_connected') === 'true') {
            return { type: 'success', message: 'GitHub integration connected successfully. Repositories are now accessible.' };
        }
        if (searchParams.get('error')) {
            return { type: 'error', message: searchParams.get('error') };
        }
        return null;
    });

    const [isLoading, setIsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [operationError, setOperationError] = useState('');
    const [operationSuccess, setOperationSuccess] = useState('');

    // Integration & Pipeline Data
    const [integrations, setIntegrations] = useState([]);
    const [githubIntegration, setGithubIntegration] = useState(null);
    const [repositories, setRepositories] = useState([]);
    const [pipelines, setPipelines] = useState([]);
    const [suites, setSuites] = useState([]);
    const [activity, setActivity] = useState([]);

    // Workflow setup selection & instructions
    const [selectedPipelineId, setSelectedPipelineId] = useState(pipelineParam || '');
    const [setupInstructions, setSetupInstructions] = useState(null);
    const [isLoadingSetup, setIsLoadingSetup] = useState(false);
    const [connectionTestStatus, setConnectionTestStatus] = useState(null); // { loading, verified, message }
    const [hasCopiedYaml, setHasCopiedYaml] = useState(false);

    // Modals
    const [showCreateWizard, setShowCreateWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1); // 1: Repo, 2: Suite, 3: Triggers, 4: Token reveal
    const [wizardRepo, setWizardRepo] = useState('');
    const [wizardSuiteId, setWizardSuiteId] = useState('');
    const [wizardBranch, setWizardBranch] = useState('main');
    const [wizardTriggers, setWizardTriggers] = useState(['push', 'pull_request']);
    const [revealedToken, setRevealedToken] = useState(null);
    const [hasCopiedRevealedToken, setHasCopiedRevealedToken] = useState(false);
    const [hasAcknowledgedTokenSaved, setHasAcknowledgedTokenSaved] = useState(false);

    // Token Rotation Modal
    const [rotatingPipeline, setRotatingPipeline] = useState(null);
    const [rotatedTokenInfo, setRotatedTokenInfo] = useState(null);
    const [hasCopiedRotatedToken, setHasCopiedRotatedToken] = useState(false);

    // Disconnect Modal
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);

    // Delete Pipeline Modal
    const [pipelineToDelete, setPipelineToDelete] = useState(null);

    // Live announcement for screen readers
    const [liveAnnouncement, setLiveAnnouncement] = useState('');

    const tabListRef = useRef(null);

    const announce = (msg) => {
        setLiveAnnouncement(msg);
        setTimeout(() => setLiveAnnouncement(''), 3000);
    };

    // Tab switching with URL synchronization
    const handleTabChange = useCallback((newTab) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', newTab);
        setSearchParams(nextParams, { replace: true });
    }, [searchParams, setSearchParams]);

    // Keyboard navigation for WAI-ARIA tablist pattern
    const handleTabKeyDown = (e, index) => {
        let targetIndex = null;
        if (e.key === 'ArrowRight') {
            targetIndex = (index + 1) % TAB_KEYS.length;
        } else if (e.key === 'ArrowLeft') {
            targetIndex = (index - 1 + TAB_KEYS.length) % TAB_KEYS.length;
        } else if (e.key === 'Home') {
            targetIndex = 0;
        } else if (e.key === 'End') {
            targetIndex = TAB_KEYS.length - 1;
        }

        if (targetIndex !== null) {
            e.preventDefault();
            const nextTab = TAB_KEYS[targetIndex];
            handleTabChange(nextTab);
            const buttons = tabListRef.current?.querySelectorAll('[role="tab"]');
            if (buttons && buttons[targetIndex]) {
                buttons[targetIndex].focus();
            }
        }
    };

    // Load initial data
    const loadAllData = useCallback(async () => {
        setIsLoading(true);
        setOperationError('');
        try {
            const [integrationsRes, pipelinesRes, suitesRes] = await Promise.all([
                cicdService.getIntegrations(workspaceId).catch(() => []),
                cicdService.getPipelines(workspaceId).catch(() => []),
                cicdService.getTestSuites(workspaceId).catch(() => [])
            ]);

            const gh = (integrationsRes || []).find(i => i.provider === 'github') || null;
            setIntegrations(integrationsRes || []);
            setGithubIntegration(gh);
            setPipelines(pipelinesRes || []);
            setSuites(suitesRes || []);

            if (gh && gh.status === 'active') {
                cicdService.getRepositories(gh.id, workspaceId)
                    .then(repos => setRepositories(repos || []))
                    .catch(() => setRepositories([]));
            } else {
                setRepositories([]);
            }

            if (testRunsEnabled) {
                cicdService.getActivity(workspaceId)
                    .then(act => setActivity(act || []))
                    .catch(() => setActivity([]));
            }
        } catch (err) {
            setOperationError(err.message || 'Failed to load CI/CD integration data');
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, testRunsEnabled]);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    // When pipelines update, make sure selectedPipelineId is valid
    useEffect(() => {
        if (pipelines.length > 0) {
            if (!selectedPipelineId || !pipelines.some(p => p.id === selectedPipelineId)) {
                setSelectedPipelineId(pipelines[0].id);
            }
        } else {
            setSelectedPipelineId('');
        }
    }, [pipelines, selectedPipelineId]);

    // Fetch setup instructions whenever selectedPipelineId changes
    useEffect(() => {
        if (!selectedPipelineId) {
            setSetupInstructions(null);
            return;
        }
        setIsLoadingSetup(true);
        cicdService.getPipelineSetup(selectedPipelineId, workspaceId)
            .then(data => setSetupInstructions(data))
            .catch(err => setOperationError(err.message || 'Failed to load workflow setup'))
            .finally(() => setIsLoadingSetup(false));
    }, [selectedPipelineId, workspaceId]);

    // GitHub App Connect Handler
    const handleConnectGitHub = async () => {
        setActionLoading(true);
        setOperationError('');
        try {
            const { installUrl } = await cicdService.getInstallUrl('/app/cicd?integration_connected=true', workspaceId);
            if (installUrl) {
                window.location.href = installUrl;
            } else {
                throw new Error('Install URL could not be generated.');
            }
        } catch (err) {
            setOperationError(err.message || 'Failed to initiate GitHub connection');
            setActionLoading(false);
        }
    };

    // Sync Repositories Handler
    const handleSyncRepositories = async () => {
        if (!githubIntegration) return;
        setActionLoading(true);
        try {
            const repos = await cicdService.syncRepositories(githubIntegration.id, workspaceId);
            setRepositories(repos || []);
            announce('Repositories synchronized with GitHub');
            setOperationSuccess('Repositories synchronized successfully.');
            setTimeout(() => setOperationSuccess(''), 4000);
        } catch (err) {
            setOperationError(err.message || 'Failed to sync repositories');
        } finally {
            setActionLoading(false);
        }
    };

    // Disconnect Integration Handler
    const handleConfirmDisconnect = async () => {
        if (!githubIntegration) return;
        setActionLoading(true);
        try {
            await cicdService.disconnectIntegration(githubIntegration.id, workspaceId);
            setShowDisconnectModal(false);
            setGithubIntegration(null);
            setRepositories([]);
            announce('GitHub integration disconnected');
            setOperationSuccess('GitHub integration disconnected. Associated pipelines have been paused.');
            setTimeout(() => setOperationSuccess(''), 5000);
            await loadAllData();
        } catch (err) {
            setOperationError(err.message || 'Failed to disconnect integration');
        } finally {
            setActionLoading(false);
        }
    };

    // Pipeline Pause/Resume Toggle
    const handleTogglePipelineStatus = async (pipeline) => {
        const nextStatus = pipeline.status === 'active' ? 'paused' : 'active';
        try {
            await cicdService.updatePipeline(pipeline.id, { status: nextStatus }, workspaceId);
            setPipelines(prev => prev.map(p => p.id === pipeline.id ? { ...p, status: nextStatus } : p));
            announce(`Pipeline ${pipeline.name || pipeline.repository} ${nextStatus}`);
        } catch (err) {
            setOperationError(err.message || `Failed to ${nextStatus} pipeline`);
        }
    };

    // Rotate Token Handler
    const handleRotateToken = async (pipeline) => {
        setActionLoading(true);
        try {
            const result = await cicdService.rotateToken(pipeline.id, workspaceId);
            setRotatedTokenInfo(result);
            setHasCopiedRotatedToken(false);
            announce('Token rotated successfully. Save the new token.');
        } catch (err) {
            setOperationError(err.message || 'Failed to rotate token');
            setRotatingPipeline(null);
        } finally {
            setActionLoading(false);
        }
    };

    // Delete Pipeline Handler
    const handleConfirmDeletePipeline = async () => {
        if (!pipelineToDelete) return;
        setActionLoading(true);
        try {
            await cicdService.deletePipeline(pipelineToDelete.id, workspaceId);
            setPipelines(prev => prev.filter(p => p.id !== pipelineToDelete.id));
            setPipelineToDelete(null);
            announce('Pipeline deleted');
            setOperationSuccess('Pipeline and associated credentials deleted successfully.');
            setTimeout(() => setOperationSuccess(''), 4000);
        } catch (err) {
            setOperationError(err.message || 'Failed to delete pipeline');
        } finally {
            setActionLoading(false);
        }
    };

    // Download Playwright Export
    const handleDownloadSpec = async (pipeline) => {
        try {
            const specCode = await cicdService.getPlaywrightSuiteExport(pipeline.id);
            const blob = new Blob([specCode], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `testnexa-${pipeline.testSuite?.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'suite'}.spec.js`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            announce('Playwright test spec downloaded');
        } catch (err) {
            setOperationError(err.message || 'Failed to download test spec');
        }
    };

    // Create Pipeline Submission
    const handleCreatePipelineSubmit = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        setOperationError('');
        try {
            const result = await cicdService.createPipeline({
                repository: wizardRepo,
                suiteId: wizardSuiteId,
                branch: wizardBranch,
                triggerEvents: wizardTriggers,
                workspaceId
            });

            // result contains { pipeline, token, tokenPrefix }
            setRevealedToken(result.token);
            setWizardStep(4);
            announce('Pipeline created. Please copy the single-use token.');
            await loadAllData();
        } catch (err) {
            setOperationError(err.message || 'Failed to create pipeline');
        } finally {
            setActionLoading(false);
        }
    };

    // Test Connection Handler in Setup Tab
    const handleTestConnection = async () => {
        setConnectionTestStatus({ loading: true, verified: null, message: 'Validating endpoint and credentials...' });
        try {
            const token = localStorage.getItem('testnexa_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
            const res = await fetch('/api/v1/ci/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ pipelineId: selectedPipelineId })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setConnectionTestStatus({ loading: false, verified: true, message: 'Connection verified. Ingestion endpoint is ready.' });
                announce('CI connection verified');
            } else {
                setConnectionTestStatus({
                    loading: false,
                    verified: false,
                    message: data.message || 'Endpoint returned an error. Ensure TESTNEXA_CI_TOKEN is correctly set in GitHub Secrets.'
                });
            }
        } catch {
            setConnectionTestStatus({
                loading: false,
                verified: false,
                message: 'Unable to reach the ingestion endpoint. Check your network or base URL setting.'
            });
        }
    };

    const copyToClipboard = async (text, onCopied) => {
        try {
            await navigator.clipboard.writeText(text);
            onCopied();
            announce('Copied to clipboard');
        } catch {
            // fallback
        }
    };

    const downloadYaml = (filename, content) => {
        const blob = new Blob([content], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        announce('Workflow YAML downloaded');
    };

    const selectedPipeline = useMemo(() => {
        return pipelines.find(p => p.id === selectedPipelineId) || pipelines[0] || null;
    }, [pipelines, selectedPipelineId]);

    return (
        <div className="cicd-container">
            {/* Screen reader live region */}
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {liveAnnouncement}
            </div>

            <main className="cicd-page">
                {/* ─── Top Bar Header ─── */}
                <header className="cicd-header">
                    <div className="cicd-header__title-area">
                        <h1>
                            <GitBranch size={24} aria-hidden="true" />
                            CI/CD
                        </h1>
                        <p className="cicd-header__subtitle">
                            Run your exported Playwright tests in GitHub Actions and see the results in Testnexa.
                        </p>
                    </div>

                    <div className="cicd-header__actions">
                        <button
                            type="button"
                            className="cicd-btn cicd-btn--secondary"
                            onClick={loadAllData}
                            disabled={isLoading}
                            title="Refresh status"
                            aria-label="Refresh CI/CD data"
                        >
                            <RefreshCw size={14} className={isLoading ? 'spin' : ''} aria-hidden="true" />
                            Refresh
                        </button>
                    </div>
                </header>

                {/* ─── URL Banners / Alerts ─── */}
                {banner && (
                    <aside
                        className={`cicd-banner ${banner.type === 'error' ? 'cicd-banner--error' : ''}`}
                        role="alert"
                    >
                        <div className="cicd-banner__content">
                            {banner.type === 'error' ? (
                                <AlertTriangle size={18} aria-hidden="true" />
                            ) : (
                                <CheckCircle2 size={18} aria-hidden="true" />
                            )}
                            <span>{banner.message}</span>
                        </div>
                        <button
                            type="button"
                            className="cicd-banner__dismiss"
                            onClick={() => setBanner(null)}
                            aria-label="Dismiss banner"
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                    </aside>
                )}

                {operationError && (
                    <div className="cicd-banner cicd-banner--error" role="alert">
                        <div className="cicd-banner__content">
                            <AlertCircle size={18} aria-hidden="true" />
                            <span>{operationError}</span>
                        </div>
                        <button
                            type="button"
                            className="cicd-banner__dismiss"
                            onClick={() => setOperationError('')}
                            aria-label="Dismiss error"
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                    </div>
                )}

                {operationSuccess && (
                    <div className="cicd-banner" role="status">
                        <div className="cicd-banner__content">
                            <CheckCircle2 size={18} aria-hidden="true" />
                            <span>{operationSuccess}</span>
                        </div>
                        <button
                            type="button"
                            className="cicd-banner__dismiss"
                            onClick={() => setOperationSuccess('')}
                            aria-label="Dismiss notification"
                        >
                            <X size={16} aria-hidden="true" />
                        </button>
                    </div>
                )}

                {/* ─── WAI-ARIA Navigation Tabs ─── */}
                <div
                    ref={tabListRef}
                    role="tablist"
                    aria-label="CI/CD Integrations navigation tabs"
                    className="cicd-tabs"
                >
                    <button
                        role="tab"
                        id="tab-providers"
                        aria-selected={activeTab === 'providers'}
                        aria-controls="panel-providers"
                        tabIndex={activeTab === 'providers' ? 0 : -1}
                        className={`cicd-tab ${activeTab === 'providers' ? 'active' : ''}`}
                        onClick={() => handleTabChange('providers')}
                        onKeyDown={(e) => handleTabKeyDown(e, 0)}
                    >
                        <Shield size={15} aria-hidden="true" />
                        Providers
                        {githubIntegration?.status === 'active' && (
                            <span className="cicd-badge cicd-badge--connected">Connected</span>
                        )}
                    </button>

                    <button
                        role="tab"
                        id="tab-pipelines"
                        aria-selected={activeTab === 'pipelines'}
                        aria-controls="panel-pipelines"
                        tabIndex={activeTab === 'pipelines' ? 0 : -1}
                        className={`cicd-tab ${activeTab === 'pipelines' ? 'active' : ''}`}
                        onClick={() => handleTabChange('pipelines')}
                        onKeyDown={(e) => handleTabKeyDown(e, 1)}
                    >
                        <Cpu size={15} aria-hidden="true" />
                        Pipelines
                        {pipelines.length > 0 && (
                            <span className="cicd-tab-count">{pipelines.length}</span>
                        )}
                    </button>

                    <button
                        role="tab"
                        id="tab-setup"
                        aria-selected={activeTab === 'setup'}
                        aria-controls="panel-setup"
                        tabIndex={activeTab === 'setup' ? 0 : -1}
                        className={`cicd-tab ${activeTab === 'setup' ? 'active' : ''}`}
                        onClick={() => handleTabChange('setup')}
                        onKeyDown={(e) => handleTabKeyDown(e, 2)}
                    >
                        <FileCode2 size={15} aria-hidden="true" />
                        Workflow setup
                    </button>

                    <button
                        role="tab"
                        id="tab-activity"
                        aria-selected={activeTab === 'activity'}
                        aria-controls="panel-activity"
                        tabIndex={activeTab === 'activity' ? 0 : -1}
                        className={`cicd-tab ${activeTab === 'activity' ? 'active' : ''}`}
                        onClick={() => handleTabChange('activity')}
                        onKeyDown={(e) => handleTabKeyDown(e, 3)}
                    >
                        <Clock size={15} aria-hidden="true" />
                        Activity
                        {testRunsEnabled && activity.length > 0 && (
                            <span className="cicd-tab-count">{activity.length}</span>
                        )}
                    </button>
                </div>

                {/* ─── TAB 1: PROVIDERS ─── */}
                {activeTab === 'providers' && (
                    <section
                        role="tabpanel"
                        id="panel-providers"
                        aria-labelledby="tab-providers"
                        className="cicd-providers-grid"
                    >
                        {/* GitHub Actions Card */}
                        <article className="cicd-card" aria-label="GitHub Actions Integration">
                            <div>
                                <div className="cicd-card__header">
                                    <div className="cicd-card__identity">
                                        <div className="cicd-card__icon-box" aria-hidden="true">
                                            <GitBranch size={20} />
                                        </div>
                                        <div>
                                            <h2 className="cicd-card__title">GitHub Actions</h2>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--cicd-text-3)' }}>Native Provider</span>
                                        </div>
                                    </div>

                                    {githubIntegration?.status === 'active' ? (
                                        <span className="cicd-badge cicd-badge--connected">
                                            <Check size={11} aria-hidden="true" />
                                            Connected
                                        </span>
                                    ) : githubIntegration?.status === 'suspended' ? (
                                        <span className="cicd-badge cicd-badge--suspended">
                                            <AlertTriangle size={11} aria-hidden="true" />
                                            Suspended
                                        </span>
                                    ) : (
                                        <span className="cicd-badge cicd-badge--not-connected">
                                            ○ Not connected
                                        </span>
                                    )}
                                </div>

                                <div className="cicd-card__body">
                                    <p className="cicd-card__desc">
                                        Trigger automated Playwright tests in GitHub Actions workflows on pull request or commit, and stream execution results back to Testnexa.
                                    </p>

                                    {githubIntegration?.status === 'active' ? (
                                        <div className="cicd-card__meta-list">
                                            <div className="cicd-card__meta-row">
                                                <span className="cicd-card__meta-label">Account:</span>
                                                <span className="cicd-card__meta-val">@{githubIntegration.external_account}</span>
                                            </div>
                                            <div className="cicd-card__meta-row">
                                                <span className="cicd-card__meta-label">Repositories:</span>
                                                <span className="cicd-card__meta-val">{repositories.length} accessible</span>
                                            </div>
                                            <div className="cicd-card__meta-row">
                                                <span className="cicd-card__meta-label">Connected:</span>
                                                <span className="cicd-card__meta-val">
                                                    {githubIntegration.connected_at ? new Date(githubIntegration.connected_at).toLocaleDateString() : 'Active'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="cicd-permission-list">
                                            <div className="cicd-permission-list__title">What you'll allow</div>
                                            <ul>
                                                <li>
                                                    <Check size={12} aria-hidden="true" />
                                                    Read repository metadata and contents
                                                </li>
                                                <li>
                                                    <Check size={12} aria-hidden="true" />
                                                    Read pull requests and commit hashes
                                                </li>
                                                <li>
                                                    <Check size={12} aria-hidden="true" />
                                                    Write commit checks and status reports
                                                </li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <footer className="cicd-card__actions">
                                {githubIntegration?.status === 'active' ? (
                                    <>
                                        <button
                                            type="button"
                                            className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                            onClick={handleSyncRepositories}
                                            disabled={actionLoading}
                                        >
                                            <RefreshCw size={13} className={actionLoading ? 'spin' : ''} aria-hidden="true" />
                                            Sync Repositories
                                        </button>

                                        {githubIntegration.installation_id && (
                                            <a
                                                href={`https://github.com/settings/installations/${githubIntegration.installation_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                            >
                                                Configure on GitHub
                                                <ExternalLink size={12} aria-hidden="true" />
                                            </a>
                                        )}

                                        <button
                                            type="button"
                                            className="cicd-btn cicd-btn--danger cicd-btn--sm"
                                            onClick={() => setShowDisconnectModal(true)}
                                            disabled={actionLoading}
                                        >
                                            Disconnect
                                        </button>
                                    </>
                                ) : githubIntegration?.status === 'suspended' ? (
                                    <button
                                        type="button"
                                        className="cicd-btn cicd-btn--primary"
                                        onClick={handleConnectGitHub}
                                        disabled={actionLoading}
                                    >
                                        Reconnect GitHub
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="cicd-btn cicd-btn--primary"
                                        onClick={handleConnectGitHub}
                                        disabled={actionLoading}
                                    >
                                        <Key size={14} aria-hidden="true" />
                                        Connect GitHub
                                    </button>
                                )}
                            </footer>
                        </article>

                        {/* GitLab CI/CD Card */}
                        <article className="cicd-card" aria-label="GitLab CI/CD Integration">
                            <div>
                                <div className="cicd-card__header">
                                    <div className="cicd-card__identity">
                                        <div className="cicd-card__icon-box" aria-hidden="true">
                                            <Terminal size={20} />
                                        </div>
                                        <div>
                                            <h2 className="cicd-card__title">GitLab CI/CD</h2>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--cicd-text-3)' }}>Provider</span>
                                        </div>
                                    </div>
                                    <span className="cicd-badge cicd-badge--planned">Planned</span>
                                </div>

                                <div className="cicd-card__body">
                                    <p className="cicd-card__desc">
                                        Execute Playwright tests on GitLab CI runners and ingest test results into Testnexa verification matrices via scheduled pipelines.
                                    </p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--cicd-text-3)', margin: 0 }}>
                                        Reuses the ingestion endpoint in Phase 3.
                                    </p>
                                </div>
                            </div>

                            <footer className="cicd-card__actions">
                                <button type="button" className="cicd-btn cicd-btn--secondary cicd-btn--sm" disabled>
                                    Coming in Phase 3
                                </button>
                            </footer>
                        </article>

                        {/* Jenkins Card */}
                        <article className="cicd-card" aria-label="Jenkins Integration">
                            <div>
                                <div className="cicd-card__header">
                                    <div className="cicd-card__identity">
                                        <div className="cicd-card__icon-box" aria-hidden="true">
                                            <Cpu size={20} />
                                        </div>
                                        <div>
                                            <h2 className="cicd-card__title">Jenkins</h2>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--cicd-text-3)' }}>Provider</span>
                                        </div>
                                    </div>
                                    <span className="cicd-badge cicd-badge--planned">Planned</span>
                                </div>

                                <div className="cicd-card__body">
                                    <p className="cicd-card__desc">
                                        Stream test execution records from Jenkins multibranch pipelines directly to Testnexa using the ingestion webhook.
                                    </p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--cicd-text-3)', margin: 0 }}>
                                        Reuses the ingestion endpoint in Phase 3.
                                    </p>
                                </div>
                            </div>

                            <footer className="cicd-card__actions">
                                <button type="button" className="cicd-btn cicd-btn--secondary cicd-btn--sm" disabled>
                                    Coming in Phase 3
                                </button>
                            </footer>
                        </article>
                    </section>
                )}

                {/* ─── TAB 2: PIPELINES ─── */}
                {activeTab === 'pipelines' && (
                    <section role="tabpanel" id="panel-pipelines" aria-labelledby="tab-pipelines">
                        <div className="cicd-table-toolbar">
                            <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>Configured Pipelines</h2>
                            <button
                                type="button"
                                className="cicd-btn cicd-btn--primary"
                                onClick={() => {
                                    setWizardStep(1);
                                    setShowCreateWizard(true);
                                }}
                            >
                                <Plus size={14} aria-hidden="true" />
                                New pipeline
                            </button>
                        </div>

                        {pipelines.length === 0 ? (
                            <div className="cicd-empty-state">
                                <div className="cicd-empty-state__icon" aria-hidden="true">
                                    <Cpu size={24} />
                                </div>
                                <h3>No pipelines yet</h3>
                                <p>
                                    Link a repository to a test suite to generate the GitHub Actions workflow and authentication credentials.
                                </p>
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--primary"
                                    onClick={() => {
                                        setWizardStep(1);
                                        setShowCreateWizard(true);
                                    }}
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    New pipeline
                                </button>
                            </div>
                        ) : (
                            <div className="cicd-table-wrapper">
                                <table className="cicd-table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Repository</th>
                                            <th scope="col">Test Suite</th>
                                            <th scope="col">Branch</th>
                                            <th scope="col">Triggers</th>
                                            <th scope="col">Token Prefix</th>
                                            <th scope="col">Status</th>
                                            {testRunsEnabled && <th scope="col">Last Run</th>}
                                            <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pipelines.map(pipeline => (
                                            <tr key={pipeline.id}>
                                                <td className="cicd-table__primary-cell">
                                                    {pipeline.repository}
                                                </td>
                                                <td>
                                                    {pipeline.testSuite?.title || pipeline.suiteId || 'Suite'}
                                                </td>
                                                <td>
                                                    <span className="cicd-code-token">{pipeline.branch || 'main'}</span>
                                                </td>
                                                <td>
                                                    {Array.isArray(pipeline.triggerEvents)
                                                        ? pipeline.triggerEvents.join(', ')
                                                        : pipeline.triggerEvents || 'push, PR'}
                                                </td>
                                                <td>
                                                    <span className="cicd-code-token">
                                                        {pipeline.tokenPrefix ? `${pipeline.tokenPrefix}...` : 'tnx_ci_...'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {pipeline.status === 'active' ? (
                                                        <span className="cicd-badge cicd-badge--active">Active</span>
                                                    ) : (
                                                        <span className="cicd-badge cicd-badge--paused">Paused</span>
                                                    )}
                                                </td>
                                                {testRunsEnabled && (
                                                    <td>
                                                        {pipeline.lastRunAt ? new Date(pipeline.lastRunAt).toLocaleDateString() : 'No runs'}
                                                    </td>
                                                )}
                                                <td>
                                                    <div className="cicd-actions-cell">
                                                        <button
                                                            type="button"
                                                            className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                            onClick={() => {
                                                                setSelectedPipelineId(pipeline.id);
                                                                handleTabChange('setup');
                                                            }}
                                                            title="View workflow setup instructions"
                                                        >
                                                            Setup
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                            onClick={() => handleTogglePipelineStatus(pipeline)}
                                                            title={pipeline.status === 'active' ? 'Pause pipeline' : 'Resume pipeline'}
                                                        >
                                                            {pipeline.status === 'active' ? (
                                                                <Pause size={12} aria-hidden="true" />
                                                            ) : (
                                                                <Play size={12} aria-hidden="true" />
                                                            )}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                            onClick={() => {
                                                                setRotatingPipeline(pipeline);
                                                                setRotatedTokenInfo(null);
                                                            }}
                                                            title="Rotate CI authentication token"
                                                        >
                                                            <Key size={12} aria-hidden="true" />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                            onClick={() => handleDownloadSpec(pipeline)}
                                                            title="Download Playwright spec file"
                                                        >
                                                            <Download size={12} aria-hidden="true" />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="cicd-btn cicd-btn--danger cicd-btn--sm"
                                                            onClick={() => setPipelineToDelete(pipeline)}
                                                            title="Delete pipeline"
                                                        >
                                                            <Trash2 size={12} aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {/* ─── TAB 3: WORKFLOW SETUP ─── */}
                {activeTab === 'setup' && (
                    <section role="tabpanel" id="panel-setup" aria-labelledby="tab-setup">
                        {pipelines.length === 0 ? (
                            <div className="cicd-empty-state">
                                <div className="cicd-empty-state__icon" aria-hidden="true">
                                    <FileCode2 size={24} />
                                </div>
                                <h3>Create a pipeline first</h3>
                                <p>
                                    To generate your GitHub Actions workflow YAML and test suite export, create a pipeline linking a repository to a suite.
                                </p>
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--primary"
                                    onClick={() => {
                                        setWizardStep(1);
                                        setShowCreateWizard(true);
                                    }}
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    New pipeline
                                </button>
                            </div>
                        ) : (
                            <div className="cicd-setup-container">
                                {/* Left column: Pipeline Selector & 5-Step Checklist */}
                                <div className="cicd-setup-checklist">
                                    <div className="cicd-setup-pipeline-select">
                                        <label htmlFor="pipeline-picker">Select pipeline</label>
                                        <select
                                            id="pipeline-picker"
                                            className="cicd-select"
                                            value={selectedPipelineId}
                                            onChange={(e) => setSelectedPipelineId(e.target.value)}
                                        >
                                            {pipelines.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.repository} — {p.testSuite?.title || p.suiteId}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="cicd-setup-steps">
                                        <div className="cicd-setup-step">
                                            <div className="cicd-step-number">1</div>
                                            <div className="cicd-step-content">
                                                <div className="cicd-step-title">Add secret TESTNEXA_CI_TOKEN</div>
                                                <div className="cicd-step-desc">
                                                    In your GitHub repository, open <strong>Settings &gt; Secrets and variables &gt; Actions</strong> and create secret <code>TESTNEXA_CI_TOKEN</code> with the token from pipeline creation.
                                                </div>
                                            </div>
                                        </div>

                                        <div className="cicd-setup-step">
                                            <div className="cicd-step-number">2</div>
                                            <div className="cicd-step-content">
                                                <div className="cicd-step-title">Add TESTNEXA_BASE_URL (Optional)</div>
                                                <div className="cicd-step-desc">
                                                    Defaults to <code>https://app.testnexa.ai</code>. If using an on-premises deployment, add <code>TESTNEXA_BASE_URL</code>.
                                                </div>
                                            </div>
                                        </div>

                                        <div className="cicd-setup-step">
                                            <div className="cicd-step-number">3</div>
                                            <div className="cicd-step-content">
                                                <div className="cicd-step-title">Export Playwright test suite</div>
                                                <div className="cicd-step-desc">
                                                    Download the canonical test spec file and commit it into your repo's <code>tests/</code> directory.
                                                </div>
                                                {selectedPipeline && (
                                                    <button
                                                        type="button"
                                                        className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                        onClick={() => handleDownloadSpec(selectedPipeline)}
                                                    >
                                                        <Download size={13} aria-hidden="true" />
                                                        Download .spec.js
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="cicd-setup-step">
                                            <div className="cicd-step-number">4</div>
                                            <div className="cicd-step-content">
                                                <div className="cicd-step-title">Commit workflow YAML</div>
                                                <div className="cicd-step-desc">
                                                    Save the configuration on the right to <code>.github/workflows/testnexa-ci.yml</code>.
                                                </div>
                                            </div>
                                        </div>

                                        <div className="cicd-setup-step">
                                            <div className="cicd-step-number">5</div>
                                            <div className="cicd-step-content">
                                                <div className="cicd-step-title">Verify connection</div>
                                                <div className="cicd-step-desc">
                                                    Test that the ingestion endpoint can receive test reports from your runner.
                                                </div>
                                                <button
                                                    type="button"
                                                    className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                    onClick={handleTestConnection}
                                                    disabled={connectionTestStatus?.loading}
                                                >
                                                    {connectionTestStatus?.loading ? 'Testing...' : 'Test connection'}
                                                </button>

                                                {connectionTestStatus && (
                                                    <div style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>
                                                        {connectionTestStatus.verified ? (
                                                            <span style={{ color: 'var(--cicd-text-1)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                <CheckCircle2 size={13} aria-hidden="true" />
                                                                {connectionTestStatus.message}
                                                            </span>
                                                        ) : connectionTestStatus.verified === false ? (
                                                            <span style={{ color: 'var(--cicd-text-2)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                <AlertCircle size={13} aria-hidden="true" />
                                                                {connectionTestStatus.message}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right column: Monochrome YAML Code Box */}
                                <div className="cicd-code-box">
                                    <div className="cicd-code-box__header">
                                        <div className="cicd-code-box__title">
                                            <FileCode2 size={15} aria-hidden="true" />
                                            .github/workflows/testnexa-ci.yml
                                        </div>
                                        <div className="cicd-code-box__actions">
                                            {setupInstructions?.workflowYaml && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                        onClick={() => copyToClipboard(setupInstructions.workflowYaml, () => {
                                                            setHasCopiedYaml(true);
                                                            setTimeout(() => setHasCopiedYaml(false), 3000);
                                                        })}
                                                    >
                                                        {hasCopiedYaml ? (
                                                            <>
                                                                <Check size={13} aria-hidden="true" />
                                                                Copied
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy size={13} aria-hidden="true" />
                                                                Copy YAML
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                                        onClick={() => downloadYaml('testnexa-ci.yml', setupInstructions.workflowYaml)}
                                                    >
                                                        <Download size={13} aria-hidden="true" />
                                                        Download
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {isLoadingSetup ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--cicd-text-3)' }}>
                                            Generating workflow configuration...
                                        </div>
                                    ) : (
                                        <pre tabIndex={0} aria-label="GitHub Actions workflow YAML">
                                            <code>
                                                {setupInstructions?.workflowYaml || '# Select a pipeline on the left to view the generated workflow'}
                                            </code>
                                        </pre>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* ─── TAB 4: ACTIVITY (PHASE 2 GATED) ─── */}
                {activeTab === 'activity' && (
                    <section role="tabpanel" id="panel-activity" aria-labelledby="tab-activity">
                        {!testRunsEnabled ? (
                            <div className="cicd-cs-panel" data-testid="cicd-cs-panel">
                                <div className="cicd-cs-icon" aria-hidden="true">
                                    <Clock size={28} />
                                </div>
                                <h2 className="cicd-cs-title">Pipeline activity is coming soon</h2>
                                <p className="cicd-cs-desc">
                                    Pipeline activity will appear here once results ingestion ships in Phase 2. Your workflow will already be sending reports to Testnexa.
                                </p>

                                <div className="cicd-cs-planned">
                                    <div className="cicd-cs-planned-title">Planned capabilities</div>
                                    <ul className="cicd-cs-planned-list">
                                        <li className="cicd-cs-planned-item">
                                            <span className="cicd-cs-bullet" aria-hidden="true" />
                                            <span>Ingested Playwright test run reports from GitHub Actions</span>
                                        </li>
                                        <li className="cicd-cs-planned-item">
                                            <span className="cicd-cs-bullet" aria-hidden="true" />
                                            <span>Per-commit verification status mapping back to requirements</span>
                                        </li>
                                        <li className="cicd-cs-planned-item">
                                            <span className="cicd-cs-bullet" aria-hidden="true" />
                                            <span>Automatic commit status checks on GitHub pull requests</span>
                                        </li>
                                        <li className="cicd-cs-planned-item">
                                            <span className="cicd-cs-bullet" aria-hidden="true" />
                                            <span>Flakiness detection, test duration analytics, and error traces</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h2 style={{ fontSize: '1.05rem', margin: '0 0 1rem', fontWeight: 600 }}>Recent Pipeline Runs</h2>
                                {activity.length === 0 ? (
                                    <div className="cicd-empty-state">
                                        <div className="cicd-empty-state__icon" aria-hidden="true">
                                            <Clock size={24} />
                                        </div>
                                        <h3>No activity recorded yet</h3>
                                        <p>
                                            Trigger your GitHub Actions workflow to run Playwright tests. Test reports will automatically stream into this feed.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="cicd-table-wrapper">
                                        <table className="cicd-table">
                                            <thead>
                                                <tr>
                                                    <th scope="col">Commit / Branch</th>
                                                    <th scope="col">Suite</th>
                                                    <th scope="col">Results</th>
                                                    <th scope="col">Duration</th>
                                                    <th scope="col">Triggered</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activity.map(item => (
                                                    <tr key={item.id}>
                                                        <td>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                <span className="cicd-table__primary-cell">
                                                                    {item.commit_sha ? item.commit_sha.substring(0, 7) : 'Manual'}
                                                                </span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--cicd-text-3)' }}>
                                                                    {item.branch || 'main'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>{item.suite_title || 'Suite'}</td>
                                                        <td>
                                                            {item.passed_count ?? 0} passed / {item.failed_count ?? 0} failed
                                                        </td>
                                                        <td>{item.duration_ms ? `${(item.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                                                        <td>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* ─── MODAL 1: NEW PIPELINE WIZARD ─── */}
            {showCreateWizard && (
                <div
                    className="cicd-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="wizard-modal-title"
                >
                    <div className="cicd-modal">
                        <div className="cicd-modal__header">
                            <h2 id="wizard-modal-title">
                                {wizardStep === 4 ? 'Pipeline Created — Save Token' : 'New Pipeline Wizard'}
                            </h2>
                            {wizardStep !== 4 && (
                                <button
                                    type="button"
                                    className="cicd-modal__close"
                                    onClick={() => setShowCreateWizard(false)}
                                    aria-label="Close wizard"
                                >
                                    <X size={18} aria-hidden="true" />
                                </button>
                            )}
                        </div>

                        {wizardStep === 4 ? (
                            /* Step 4: Token Reveal */
                            <div className="cicd-modal__body">
                                <div className="cicd-token-alert">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                                        <AlertTriangle size={18} aria-hidden="true" />
                                        Save your CI token now
                                    </div>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--cicd-text-2)', margin: 0, lineHeight: 1.5 }}>
                                        This token is displayed <strong>ONLY ONCE</strong>. It will not be visible again. Store it immediately in your GitHub repository secrets as <code>TESTNEXA_CI_TOKEN</code>.
                                    </p>
                                    <div className="cicd-token-display">
                                        <span style={{ flex: 1, userSelect: 'all' }}>{revealedToken}</span>
                                        <button
                                            type="button"
                                            className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                            onClick={() => copyToClipboard(revealedToken, () => setHasCopiedRevealedToken(true))}
                                        >
                                            {hasCopiedRevealedToken ? (
                                                <>
                                                    <Check size={13} aria-hidden="true" />
                                                    Copied
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={13} aria-hidden="true" />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={hasAcknowledgedTokenSaved}
                                        onChange={(e) => setHasAcknowledgedTokenSaved(e.target.checked)}
                                    />
                                    <span>I have saved this token in repository secrets</span>
                                </label>
                            </div>
                        ) : (
                            /* Steps 1-3 Form */
                            <form onSubmit={handleCreatePipelineSubmit}>
                                <div className="cicd-modal__body">
                                    {/* Step 1: Repository */}
                                    <div className="cicd-form-group">
                                        <label className="cicd-form-label" htmlFor="wizard-repo">
                                            1. Connected repository
                                        </label>
                                        {repositories.length > 0 ? (
                                            <select
                                                id="wizard-repo"
                                                className="cicd-select"
                                                value={wizardRepo}
                                                onChange={(e) => setWizardRepo(e.target.value)}
                                                required
                                            >
                                                <option value="">Select a repository...</option>
                                                {repositories.map(repo => (
                                                    <option key={repo.full_name || repo.name} value={repo.full_name || repo.name}>
                                                        {repo.full_name || repo.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                id="wizard-repo"
                                                className="cicd-input"
                                                type="text"
                                                placeholder="e.g. org/my-app"
                                                value={wizardRepo}
                                                onChange={(e) => setWizardRepo(e.target.value)}
                                                required
                                            />
                                        )}
                                    </div>

                                    {/* Step 2: Test Suite */}
                                    <div className="cicd-form-group">
                                        <label className="cicd-form-label" htmlFor="wizard-suite">
                                            2. Test suite to execute
                                        </label>
                                        <select
                                            id="wizard-suite"
                                            className="cicd-select"
                                            value={wizardSuiteId}
                                            onChange={(e) => setWizardSuiteId(e.target.value)}
                                            required
                                        >
                                            <option value="">Select a test suite...</option>
                                            {suites.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.title} ({s.caseCount || s.testCount || 0} cases)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Step 3: Branch & Triggers */}
                                    <div className="cicd-form-group">
                                        <label className="cicd-form-label" htmlFor="wizard-branch">
                                            3. Target branch
                                        </label>
                                        <input
                                            id="wizard-branch"
                                            className="cicd-input"
                                            type="text"
                                            value={wizardBranch}
                                            onChange={(e) => setWizardBranch(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="cicd-form-group">
                                        <span className="cicd-form-label">Workflow triggers</span>
                                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={wizardTriggers.includes('push')}
                                                    onChange={(e) => {
                                                        setWizardTriggers(prev =>
                                                            e.target.checked ? [...prev, 'push'] : prev.filter(t => t !== 'push')
                                                        );
                                                    }}
                                                />
                                                <span>push</span>
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={wizardTriggers.includes('pull_request')}
                                                    onChange={(e) => {
                                                        setWizardTriggers(prev =>
                                                            e.target.checked ? [...prev, 'pull_request'] : prev.filter(t => t !== 'pull_request')
                                                        );
                                                    }}
                                                />
                                                <span>pull_request</span>
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={wizardTriggers.includes('workflow_dispatch')}
                                                    onChange={(e) => {
                                                        setWizardTriggers(prev =>
                                                            e.target.checked ? [...prev, 'workflow_dispatch'] : prev.filter(t => t !== 'workflow_dispatch')
                                                        );
                                                    }}
                                                />
                                                <span>manual dispatch</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="cicd-modal__footer">
                                    <button
                                        type="button"
                                        className="cicd-btn cicd-btn--secondary"
                                        onClick={() => setShowCreateWizard(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="cicd-btn cicd-btn--primary"
                                        disabled={actionLoading || !wizardRepo || !wizardSuiteId}
                                    >
                                        {actionLoading ? 'Creating...' : 'Create Pipeline'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {wizardStep === 4 && (
                            <div className="cicd-modal__footer">
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--primary"
                                    disabled={!hasAcknowledgedTokenSaved && !hasCopiedRevealedToken}
                                    onClick={() => {
                                        setShowCreateWizard(false);
                                        setRevealedToken(null);
                                        setHasAcknowledgedTokenSaved(false);
                                        setHasCopiedRevealedToken(false);
                                        handleTabChange('setup');
                                    }}
                                >
                                    Done &amp; View Setup
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── MODAL 2: ROTATE TOKEN ─── */}
            {rotatingPipeline && (
                <div
                    className="cicd-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="rotate-token-title"
                >
                    <div className="cicd-modal">
                        <div className="cicd-modal__header">
                            <h2 id="rotate-token-title">Rotate CI Token</h2>
                            <button
                                type="button"
                                className="cicd-modal__close"
                                onClick={() => {
                                    setRotatingPipeline(null);
                                    setRotatedTokenInfo(null);
                                }}
                                aria-label="Close modal"
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="cicd-modal__body">
                            {!rotatedTokenInfo ? (
                                <>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--cicd-text-2)', lineHeight: 1.5, margin: 0 }}>
                                        Rotating the token for <strong>{rotatingPipeline.repository}</strong> will immediately revoke the existing token. Any running workflows using the previous token will fail until updated.
                                    </p>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--cicd-text-2)', lineHeight: 1.5, margin: 0 }}>
                                        Are you sure you want to proceed?
                                    </p>
                                </>
                            ) : (
                                <div className="cicd-token-alert">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                                        <AlertTriangle size={18} aria-hidden="true" />
                                        Save your new token
                                    </div>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--cicd-text-2)', margin: 0 }}>
                                        Update secret <code>TESTNEXA_CI_TOKEN</code> in your GitHub repository settings.
                                    </p>
                                    <div className="cicd-token-display">
                                        <span style={{ flex: 1, userSelect: 'all' }}>{rotatedTokenInfo.token}</span>
                                        <button
                                            type="button"
                                            className="cicd-btn cicd-btn--secondary cicd-btn--sm"
                                            onClick={() => copyToClipboard(rotatedTokenInfo.token, () => setHasCopiedRotatedToken(true))}
                                        >
                                            {hasCopiedRotatedToken ? (
                                                <>
                                                    <Check size={13} aria-hidden="true" />
                                                    Copied
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={13} aria-hidden="true" />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="cicd-modal__footer">
                            {!rotatedTokenInfo ? (
                                <>
                                    <button
                                        type="button"
                                        className="cicd-btn cicd-btn--secondary"
                                        onClick={() => setRotatingPipeline(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="cicd-btn cicd-btn--primary"
                                        onClick={() => handleRotateToken(rotatingPipeline)}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? 'Rotating...' : 'Rotate Token'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="cicd-btn cicd-btn--primary"
                                    onClick={() => {
                                        setRotatingPipeline(null);
                                        setRotatedTokenInfo(null);
                                    }}
                                >
                                    Done
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL 3: DISCONNECT GITHUB CONFIRMATION ─── */}
            {showDisconnectModal && (
                <div
                    className="cicd-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="disconnect-title"
                >
                    <div className="cicd-modal">
                        <div className="cicd-modal__header">
                            <h2 id="disconnect-title">Disconnect GitHub Integration</h2>
                            <button
                                type="button"
                                className="cicd-modal__close"
                                onClick={() => setShowDisconnectModal(false)}
                                aria-label="Close modal"
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="cicd-modal__body">
                            <p style={{ fontSize: '0.875rem', color: 'var(--cicd-text-2)', lineHeight: 1.5, margin: 0 }}>
                                Are you sure you want to disconnect GitHub?
                            </p>
                            <p style={{ fontSize: '0.875rem', color: 'var(--cicd-text-2)', lineHeight: 1.5, margin: 0 }}>
                                <strong>{pipelines.length} configured pipeline{pipelines.length === 1 ? '' : 's'}</strong> will be paused until reconnected, and existing tokens will be revoked.
                            </p>
                        </div>

                        <div className="cicd-modal__footer">
                            <button
                                type="button"
                                className="cicd-btn cicd-btn--secondary"
                                onClick={() => setShowDisconnectModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="cicd-btn cicd-btn--danger"
                                onClick={handleConfirmDisconnect}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Disconnecting...' : 'Yes, Disconnect'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL 4: DELETE PIPELINE CONFIRMATION ─── */}
            {pipelineToDelete && (
                <div
                    className="cicd-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-pipeline-title"
                >
                    <div className="cicd-modal">
                        <div className="cicd-modal__header">
                            <h2 id="delete-pipeline-title">Delete Pipeline</h2>
                            <button
                                type="button"
                                className="cicd-modal__close"
                                onClick={() => setPipelineToDelete(null)}
                                aria-label="Close modal"
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="cicd-modal__body">
                            <p style={{ fontSize: '0.875rem', color: 'var(--cicd-text-2)', lineHeight: 1.5, margin: 0 }}>
                                Are you sure you want to delete the pipeline for <strong>{pipelineToDelete.repository}</strong>?
                            </p>
                            <p style={{ fontSize: '0.875rem', color: 'var(--cicd-text-2)', lineHeight: 1.5, margin: 0 }}>
                                Its workflow authentication token will be permanently revoked and CI ingestion will cease.
                            </p>
                        </div>

                        <div className="cicd-modal__footer">
                            <button
                                type="button"
                                className="cicd-btn cicd-btn--secondary"
                                onClick={() => setPipelineToDelete(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="cicd-btn cicd-btn--danger"
                                onClick={handleConfirmDeletePipeline}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Deleting...' : 'Delete Pipeline'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CiCdIntegrationsPage;
