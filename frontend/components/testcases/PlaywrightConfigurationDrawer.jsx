import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Bot, Code, CheckCircle2, AlertTriangle, Play, ShieldAlert,
    RefreshCw, FileCode, Search, Trash2, ArrowLeft, ArrowRight,
    Check, Globe, Clock, Layers, ShieldCheck
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { workspaceService } from '../../services/workspaceService';
import '../../styles/app/PlaywrightConfiguration.css';

const STEPS = [
    { id: 1, title: 'Project', label: '1. Project' },
    { id: 2, title: 'Discovery', label: '2. Discovery' },
    { id: 3, title: 'Settings', label: '3. Execution' }
];

const PlaywrightConfigurationDrawer = ({
    isOpen = true,
    onClose,
    testCase,
    onSaveMapping,
    onRemoveMapping,
    isSaving = false
}) => {
    // Current wizard step: 1, 2, or 3
    const [currentStep, setCurrentStep] = useState(1);

    // Initial mapping data extraction
    const initialMapping = testCase?.automationMapping || {};

    // Step 1 State: Source & project selection
    const [sources, setSources] = useState([]);
    const [sourcesLoading, setSourcesLoading] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState('proj_e2e_core');

    // Environments
    const [environments, setEnvironments] = useState([]);

    // Step 2 State: Method & Test discovery
    const [configMethod, setConfigMethod] = useState(initialMapping.scriptSource === 'custom' ? 'custom' : 'existing');
    const [selectedFile, setSelectedFile] = useState(initialMapping.scriptRef?.split('#')?.[0] || '');
    const [selectedTestId, setSelectedTestId] = useState(initialMapping.automationTestId || initialMapping.scriptRef?.split('#')?.[1] || '');
    const [testSearch, setTestSearch] = useState('');

    // Custom script (Mode B: custom)
    const [customTestId, setCustomTestId] = useState(initialMapping.automationTestId || (testCase?.id ? testCase.id.toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'custom_test'));
    const [customCode, setCustomCode] = useState(initialMapping.scriptCode || `async function execute(page, expect) {\n    // 1. Navigate to target application route\n    await page.goto('/login');\n    await expect(page.locator('body')).toBeVisible();\n\n    // 2. Perform actions and assertions\n    const heading = page.locator('h1, h2').first();\n    await expect(heading).toBeVisible();\n}`);

    // Step 3 State: Execution settings
    const [browser, setBrowser] = useState(initialMapping.browser || 'chromium');
    const [targetEnvironmentId, setTargetEnvironmentId] = useState(initialMapping.environmentId || '');
    const [timeoutMs, setTimeoutMs] = useState(initialMapping.timeoutMs || 30000);
    const [retries, setRetries] = useState(initialMapping.retries || 0);
    const [headless, setHeadless] = useState(initialMapping.headless !== undefined ? initialMapping.headless : true);
    const [captureScreenshots, setCaptureScreenshots] = useState(initialMapping.captureScreenshots || 'on_failure');
    const [captureVideo, setCaptureVideo] = useState(initialMapping.captureVideo || 'retain_on_failure');
    const [captureTrace, setCaptureTrace] = useState(initialMapping.captureTrace || 'retain_on_failure');

    // Validation state
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [actionError, setActionError] = useState('');

    // Load registered Playwright projects and environments
    const loadPrerequisites = useCallback(async () => {
        setSourcesLoading(true);
        setActionError('');
        try {
            const [srcRes, envRes] = await Promise.all([
                executionService.getAutomationSources().catch(() => ({ success: false })),
                workspaceService.getEnvironments().catch(() => ({ data: [] }))
            ]);

            if (srcRes?.success && Array.isArray(srcRes.data)) {
                setSources(srcRes.data);
                if (srcRes.data.length > 0) {
                    const project = srcRes.data[0];
                    setSelectedProjectId(project.id);
                    if (!selectedFile && project.suites?.length > 0) {
                        const firstSuite = project.suites[0];
                        setSelectedFile(firstSuite.file);
                        if (!selectedTestId && firstSuite.tests?.length > 0) {
                            setSelectedTestId(firstSuite.tests[0].testId);
                        }
                    }
                }
            } else {
                setActionError('No registered Playwright automation projects discovered.');
            }

            if (Array.isArray(envRes?.data)) {
                setEnvironments(envRes.data);
                if (!targetEnvironmentId && envRes.data.length > 0) {
                    setTargetEnvironmentId(envRes.data[0].id);
                }
            }
        } catch (err) {
            setActionError('Failed to load automation sources or environments.');
        } finally {
            setSourcesLoading(false);
        }
    }, [selectedFile, selectedTestId, targetEnvironmentId]);

    useEffect(() => {
        if (isOpen) {
            loadPrerequisites();
        }
    }, [isOpen]);

    // Active project and suites
    const activeProject = useMemo(() => {
        return sources.find(s => s.id === selectedProjectId) || sources[0] || null;
    }, [sources, selectedProjectId]);

    const activeSuites = useMemo(() => {
        return activeProject?.suites || [];
    }, [activeProject]);

    // Currently selected spec file object
    const currentSuiteObj = useMemo(() => {
        return activeSuites.find(s => s.file === selectedFile) || activeSuites[0] || null;
    }, [activeSuites, selectedFile]);

    // Filtered tests under currently selected spec file
    const filteredTests = useMemo(() => {
        const tests = currentSuiteObj?.tests || [];
        if (!testSearch.trim()) return tests;
        const q = testSearch.trim().toLowerCase();
        return tests.filter(t => (t.title || '').toLowerCase().includes(q) || (t.testId || '').toLowerCase().includes(q));
    }, [currentSuiteObj, testSearch]);

    // Currently selected test object
    const currentTestObj = useMemo(() => {
        return (currentSuiteObj?.tests || []).find(t => t.testId === selectedTestId) || filteredTests[0] || null;
    }, [currentSuiteObj, selectedTestId, filteredTests]);

    // Whenever configuration changes, reset validation
    const handleFieldChange = () => {
        if (validationResult) {
            setValidationResult(null);
        }
    };

    // Step Navigation Validation
    const canContinueFromStep1 = Boolean(activeProject && activeProject.isAvailable);
    const canContinueFromStep2 = configMethod === 'existing'
        ? Boolean(selectedFile && (selectedTestId || currentTestObj?.testId))
        : Boolean(customTestId.trim() && customCode.trim());

    // Handle Validate Action (Step 3)
    const handleValidate = async () => {
        setIsValidating(true);
        setActionError('');
        setValidationResult(null);

        const isExisting = configMethod === 'existing';
        const payload = {
            framework: 'playwright',
            scriptSource: configMethod,
            scriptRef: isExisting ? `${selectedFile}#${selectedTestId || currentTestObj?.testId}` : '',
            automationTestId: isExisting ? (selectedTestId || currentTestObj?.testId) : customTestId.trim(),
            scriptCode: isExisting ? (currentTestObj?.code || '') : customCode.trim(),
            executionTimeout: timeoutMs,
            browserName: browser,
            targetEnvironment: environments.find(e => e.id === targetEnvironmentId) || {}
        };

        try {
            const res = await executionService.validateAutomationConfig(payload);
            if (res?.success && res.data) {
                setValidationResult(res.data);
            } else {
                setValidationResult({
                    valid: false,
                    errors: [res?.message || 'Server validation failed.'],
                    warnings: []
                });
            }
        } catch (err) {
            setValidationResult({
                valid: false,
                errors: [err.message || 'Validation request failed.'],
                warnings: []
            });
        } finally {
            setIsValidating(false);
        }
    };

    // Handle Save Action (Step 3 after validation)
    const handleSave = async () => {
        setActionError('');
        const isExisting = configMethod === 'existing';
        const finalTestId = isExisting ? (selectedTestId || currentTestObj?.testId) : customTestId.trim();
        const finalRef = isExisting ? `${selectedFile}#${finalTestId}` : '';
        const finalCode = isExisting ? (currentTestObj?.code || '') : customCode.trim();

        if (!finalTestId) {
            setActionError('Please select or enter an Automation Test ID.');
            return;
        }

        const mappingPayload = {
            framework: 'playwright',
            scriptSource: configMethod,
            scriptRef: finalRef,
            automationTestId: finalTestId,
            scriptCode: finalCode,
            browser,
            environmentId: targetEnvironmentId || null,
            timeoutMs: parseInt(timeoutMs, 10) || 30000,
            retries: parseInt(retries, 10) || 0,
            headless: Boolean(headless),
            captureScreenshots,
            captureVideo,
            captureTrace,
            mappingStatus: 'configured',
            lastValidatedAt: new Date().toISOString(),
            lastConfiguredAt: new Date().toISOString()
        };

        try {
            if (onSaveMapping) {
                await onSaveMapping(mappingPayload);
            }
            onClose();
        } catch (err) {
            setActionError(err.message || 'Failed to persist Playwright mapping.');
        }
    };

    // Handle Remove Action
    const handleRemove = async () => {
        if (!window.confirm(`Are you sure you want to remove the Playwright automation mapping from ${testCase.id}? Historical execution records will be preserved.`)) {
            return;
        }
        setActionError('');
        try {
            if (onRemoveMapping) {
                await onRemoveMapping(testCase);
            }
            onClose();
        } catch (err) {
            setActionError(err.message || 'Failed to remove Playwright mapping.');
        }
    };

    if (!isOpen || !testCase) return null;

    return createPortal(
        <div className="pw-drawer-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !isSaving) onClose(); }}>
            <aside className="pw-drawer" role="dialog" aria-modal="true" aria-labelledby="pw-drawer-title">
                {/* 1. Header (Fixed, Rendered Exactly Once) */}
                <header className="pw-drawer-header">
                    <div>
                        <div className="pw-header-meta">
                            <span>Playwright Automation Configuration</span>
                            <span>•</span>
                            <span style={{ color: '#F2F3F3' }}>{testCase.suiteName || 'Suite'}</span>
                        </div>
                        <h2 className="pw-header-title" id="pw-drawer-title">
                            Configure Playwright: {testCase.id}
                        </h2>
                    </div>
                    <button type="button" className="pw-close-btn" aria-label="Close" onClick={onClose} disabled={isSaving}>
                        <X size={18} />
                    </button>
                </header>

                {/* 2. Context Strip (Fixed, Rendered Exactly Once) */}
                <div className="pw-context-banner">
                    <span className="pw-context-pill">
                        Case ID: <strong>{testCase.id}</strong>
                    </span>
                    <span className="pw-context-pill">
                        Title: <span>{testCase.title}</span>
                    </span>
                    <span className="pw-context-pill">
                        Category: <strong>{testCase.type || 'Functional'}</strong>
                    </span>
                    <span className="pw-context-pill">
                        Priority: <strong>{testCase.priority || 'Medium'}</strong>
                    </span>
                </div>

                {/* 3. Compact 3-Step Wizard Navigation Stepper */}
                <nav className="pw-stepper" aria-label="Configuration progress">
                    {STEPS.map(step => {
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;
                        return (
                            <button
                                key={step.id}
                                type="button"
                                className={`pw-step-tab ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                                onClick={() => {
                                    // Allow jumping to previous steps or next step if valid
                                    if (step.id < currentStep) setCurrentStep(step.id);
                                    else if (step.id === 2 && canContinueFromStep1) setCurrentStep(2);
                                    else if (step.id === 3 && canContinueFromStep1 && canContinueFromStep2) setCurrentStep(3);
                                }}
                            >
                                <span className="pw-step-num">
                                    {isCompleted ? <Check size={12} /> : step.id}
                                </span>
                                <span>{step.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* 4. Independently Scrollable Body with 3 Step Panels */}
                <div className="pw-drawer-body">
                    {actionError && (
                        <div className="pw-validation-box invalid" role="alert">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={15} />
                                <strong>{actionError}</strong>
                            </div>
                        </div>
                    )}

                    {/* ──── STEP 1: Automation Project ──── */}
                    {currentStep === 1 && (
                        <div className="pw-step-content">
                            <div className="pw-step-header">
                                <div>
                                    <h3 className="pw-step-title">Select Registered Automation Project</h3>
                                    <p className="pw-step-desc">Connect the test case to an approved repository workspace.</p>
                                </div>
                                <button
                                    type="button"
                                    className="pw-btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                                    onClick={loadPrerequisites}
                                    disabled={sourcesLoading}
                                    title="Refresh discovery"
                                >
                                    <RefreshCw size={12} className={sourcesLoading ? 'pw-spin' : ''} />
                                    <span>Refresh</span>
                                </button>
                            </div>

                            <div className="pw-card">
                                <div className="pw-field-group">
                                    <label className="pw-label">Registered Project Source</label>
                                    {sourcesLoading ? (
                                        <p style={{ fontSize: '0.78rem', color: '#8BAF9A', margin: '4px 0' }}>Discovering projects...</p>
                                    ) : (
                                        <select
                                            className="pw-select"
                                            value={selectedProjectId}
                                            onChange={e => {
                                                setSelectedProjectId(e.target.value);
                                                handleFieldChange();
                                            }}
                                        >
                                            {sources.map(src => (
                                                <option key={src.id} value={src.id}>
                                                    {src.name} — {src.framework} ({src.testsCount} tests)
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {activeProject ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.76rem', color: '#CBD5E1', background: '#080A09', padding: '12px 14px', borderRadius: '4px', border: '1px solid #1A211D' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span>Project Name: <strong style={{ color: '#FFFFFF' }}>{activeProject.name}</strong></span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#8BAF9A', fontWeight: 600 }}>
                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8BAF9A' }}></span>
                                                Connected
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <span>Framework: <strong style={{ color: '#8BAF9A' }}>{activeProject.framework}</strong></span>
                                            <span>•</span>
                                            <span>Project Root: <code>{activeProject.repository}</code></span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px', color: '#7A8580', fontSize: '0.72rem' }}>
                                            <span>Spec Files: {activeProject.filesCount}</span>
                                            <span>•</span>
                                            <span>Discovered Tests: {activeProject.testsCount}</span>
                                            <span>•</span>
                                            <span>Last Discovery: {activeProject.lastDiscoveryAt ? new Date(activeProject.lastDiscoveryAt).toLocaleTimeString() : 'Just now'}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pw-validation-box invalid">
                                        <ShieldAlert size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                        <span>No active Playwright automation project found in this workspace.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ──── STEP 2: Test Discovery & Mapping ──── */}
                    {currentStep === 2 && (
                        <div className="pw-step-content">
                            <div className="pw-step-header">
                                <div>
                                    <h3 className="pw-step-title">Discover and Map Exact Playwright Test</h3>
                                    <p className="pw-step-desc">Associate this test case with a uniquely identified test function.</p>
                                </div>
                            </div>

                            {/* Method Switcher */}
                            <div className="pw-method-toggle">
                                <button
                                    type="button"
                                    className={`pw-method-btn ${configMethod === 'existing' ? 'active' : ''}`}
                                    onClick={() => {
                                        setConfigMethod('existing');
                                        handleFieldChange();
                                    }}
                                >
                                    <Bot size={14} />
                                    <span>A. Approved Repository Spec</span>
                                </button>
                                <button
                                    type="button"
                                    className={`pw-method-btn ${configMethod === 'custom' ? 'active' : ''}`}
                                    onClick={() => {
                                        setConfigMethod('custom');
                                        handleFieldChange();
                                    }}
                                >
                                    <Code size={14} />
                                    <span>B. Custom Playwright Function</span>
                                </button>
                            </div>

                            {configMethod === 'existing' ? (
                                <div className="pw-card">
                                    <div className="pw-field-group">
                                        <label className="pw-label">
                                            <span>Specification File</span>
                                            <span style={{ fontSize: '0.72rem', color: '#8BAF9A' }}>
                                                {activeSuites.length} specs available
                                            </span>
                                        </label>
                                        <select
                                            className="pw-select"
                                            value={selectedFile}
                                            onChange={e => {
                                                const file = e.target.value;
                                                setSelectedFile(file);
                                                handleFieldChange();
                                                const suite = activeSuites.find(s => s.file === file);
                                                if (suite?.tests?.[0]) {
                                                    setSelectedTestId(suite.tests[0].testId);
                                                }
                                            }}
                                        >
                                            {activeSuites.map(suite => (
                                                <option key={suite.file} value={suite.file}>
                                                    {suite.file} ({suite.testsCount} tests)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="pw-field-group">
                                        <label className="pw-label">
                                            <span>Select Exact Discovered Test Scenario</span>
                                            <span style={{ fontSize: '0.7rem', color: '#7A8580' }}>
                                                {filteredTests.length} tests matching
                                            </span>
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={13} style={{ position: 'absolute', left: '10px', top: '10px', color: '#7A8580' }} />
                                            <input
                                                type="text"
                                                className="pw-input"
                                                style={{ paddingLeft: '28px' }}
                                                placeholder="Search test titles or IDs..."
                                                value={testSearch}
                                                onChange={e => setTestSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="pw-test-list">
                                            {filteredTests.map(t => {
                                                const isSelected = (selectedTestId === t.testId) || (!selectedTestId && currentTestObj?.testId === t.testId);
                                                return (
                                                    <div
                                                        key={t.testId}
                                                        className={`pw-test-item ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => {
                                                            setSelectedTestId(t.testId);
                                                            handleFieldChange();
                                                        }}
                                                    >
                                                        <div className="pw-test-meta">
                                                            <strong>{t.title}</strong>
                                                            <small>Identity: <code>{t.testId}</code> • v{t.version}</small>
                                                        </div>
                                                        {isSelected && <CheckCircle2 size={15} color="#8BAF9A" />}
                                                    </div>
                                                );
                                            })}
                                            {filteredTests.length === 0 && (
                                                <p style={{ padding: '16px', fontSize: '0.78rem', color: '#7A8580', margin: 0, textAlign: 'center' }}>
                                                    No matching tests discovered in {selectedFile}.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {currentTestObj?.code && (
                                        <div className="pw-field-group">
                                            <label className="pw-label">Discovered Test Code Preview</label>
                                            <pre className="pw-code-preview">
                                                <code>{currentTestObj.code}</code>
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="pw-card">
                                    <div className="pw-field-group">
                                        <label className="pw-label">Stable Automation Test Identifier</label>
                                        <input
                                            type="text"
                                            className="pw-input"
                                            value={customTestId}
                                            onChange={e => {
                                                setCustomTestId(e.target.value);
                                                handleFieldChange();
                                            }}
                                            placeholder="e.g. auth_valid_login"
                                        />
                                    </div>
                                    <div className="pw-field-group">
                                        <label className="pw-label">
                                            <span>Playwright Execution Snippet</span>
                                            <span style={{ fontSize: '0.7rem', color: '#8BAF9A' }}>async function(page, expect)</span>
                                        </label>
                                        <textarea
                                            className="pw-textarea"
                                            rows={9}
                                            value={customCode}
                                            onChange={e => {
                                                setCustomCode(e.target.value);
                                                handleFieldChange();
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ──── STEP 3: Execution Settings & Validation ──── */}
                    {currentStep === 3 && (
                        <div className="pw-step-content">
                            <div className="pw-step-header">
                                <div>
                                    <h3 className="pw-step-title">Worker Execution Settings</h3>
                                    <p className="pw-step-desc">Configure worker runtime, timeouts, and artifact retention.</p>
                                </div>
                            </div>

                            <div className="pw-card">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div className="pw-field-group">
                                        <label className="pw-label">Browser Engine</label>
                                        <select
                                            className="pw-select"
                                            value={browser}
                                            onChange={e => {
                                                setBrowser(e.target.value);
                                                handleFieldChange();
                                            }}
                                        >
                                            <option value="chromium">Chromium (Recommended)</option>
                                            <option value="firefox">Firefox</option>
                                            <option value="webkit">WebKit (Safari)</option>
                                        </select>
                                    </div>

                                    <div className="pw-field-group">
                                        <label className="pw-label">Target Environment</label>
                                        <select
                                            className="pw-select"
                                            value={targetEnvironmentId}
                                            onChange={e => {
                                                setTargetEnvironmentId(e.target.value);
                                                handleFieldChange();
                                            }}
                                        >
                                            <option value="">Default Workspace Staging</option>
                                            {environments.map(env => (
                                                <option key={env.id} value={env.id}>
                                                    {env.name} ({env.baseUrl || 'Local'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div className="pw-field-group">
                                        <label className="pw-label">Execution Timeout (ms)</label>
                                        <input
                                            type="number"
                                            min="1000"
                                            max="120000"
                                            step="1000"
                                            className="pw-input"
                                            value={timeoutMs}
                                            onChange={e => {
                                                setTimeoutMs(e.target.value);
                                                handleFieldChange();
                                            }}
                                        />
                                    </div>

                                    <div className="pw-field-group">
                                        <label className="pw-label">Retry Count</label>
                                        <select
                                            className="pw-select"
                                            value={retries}
                                            onChange={e => {
                                                setRetries(parseInt(e.target.value, 10));
                                                handleFieldChange();
                                            }}
                                        >
                                            <option value="0">0 retries (Fast-fail)</option>
                                            <option value="1">1 retry</option>
                                            <option value="2">2 retries</option>
                                            <option value="3">3 retries</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                    <div className="pw-field-group">
                                        <label className="pw-label">Screenshots</label>
                                        <select
                                            className="pw-select"
                                            value={captureScreenshots}
                                            onChange={e => {
                                                setCaptureScreenshots(e.target.value);
                                                handleFieldChange();
                                            }}
                                        >
                                            <option value="on_failure">On Failure</option>
                                            <option value="always">Always</option>
                                            <option value="off">Off</option>
                                        </select>
                                    </div>

                                    <div className="pw-field-group">
                                        <label className="pw-label">Video Capture</label>
                                        <select
                                            className="pw-select"
                                            value={captureVideo}
                                            onChange={e => {
                                                setCaptureVideo(e.target.value);
                                                handleFieldChange();
                                            }}
                                        >
                                            <option value="retain_on_failure">Retain on Fail</option>
                                            <option value="always">Always</option>
                                            <option value="off">Off</option>
                                        </select>
                                    </div>

                                    <div className="pw-field-group">
                                        <label className="pw-label">Trace Viewer</label>
                                        <select
                                            className="pw-select"
                                            value={captureTrace}
                                            onChange={e => {
                                                setCaptureTrace(e.target.value);
                                                handleFieldChange();
                                            }}
                                        >
                                            <option value="retain_on_failure">Retain on Fail</option>
                                            <option value="always">Always</option>
                                            <option value="off">Off</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Verification Box in Step 3 */}
                            <div className="pw-card">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ShieldCheck size={16} color="#8BAF9A" />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F2F3F3' }}>
                                            Server-Side Mapping Verification
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className="pw-btn-secondary"
                                        style={{ padding: '6px 12px' }}
                                        onClick={handleValidate}
                                        disabled={isValidating}
                                    >
                                        <RefreshCw size={12} className={isValidating ? 'pw-spin' : ''} />
                                        <span>{isValidating ? 'Validating…' : 'Validate Mapping'}</span>
                                    </button>
                                </div>

                                {isValidating && (
                                    <div className="pw-validation-box validating">
                                        <RefreshCw size={14} className="pw-spin" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                        <span>Verifying project, file existence, test syntax, and worker runtime bounds…</span>
                                    </div>
                                )}

                                {!isValidating && validationResult && (
                                    <div className={`pw-validation-box ${validationResult.valid ? 'valid' : 'invalid'}`}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {validationResult.valid ? (
                                                <>
                                                    <CheckCircle2 size={16} />
                                                    <strong>Mapping Validated Successfully</strong>
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldAlert size={16} />
                                                    <strong>Validation Errors Found</strong>
                                                </>
                                            )}
                                        </div>
                                        {validationResult.errors?.length > 0 && (
                                            <ul className="pw-validation-errors">
                                                {validationResult.errors.map((err, i) => (
                                                    <li key={i}>{err}</li>
                                                ))}
                                            </ul>
                                        )}
                                        {validationResult.warnings?.length > 0 && (
                                            <div style={{ marginTop: '6px', color: '#E5C07B', fontSize: '0.74rem' }}>
                                                Warnings: {validationResult.warnings.join('; ')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 5. Single Fixed Footer with State-Aware Actions */}
                <footer className="pw-drawer-footer">
                    <div>
                        {initialMapping?.mappingStatus === 'configured' && (
                            <button
                                type="button"
                                className="pw-btn-danger"
                                onClick={handleRemove}
                                disabled={isSaving || isValidating}
                            >
                                <Trash2 size={13} />
                                <span>Remove Mapping</span>
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        {currentStep === 1 && (
                            <>
                                <button
                                    type="button"
                                    className="pw-btn-secondary"
                                    onClick={onClose}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="pw-btn-primary"
                                    onClick={() => setCurrentStep(2)}
                                    disabled={!canContinueFromStep1 || isSaving}
                                >
                                    <span>Continue</span>
                                    <ArrowRight size={13} />
                                </button>
                            </>
                        )}

                        {currentStep === 2 && (
                            <>
                                <button
                                    type="button"
                                    className="pw-btn-secondary"
                                    onClick={() => setCurrentStep(1)}
                                    disabled={isSaving}
                                >
                                    <ArrowLeft size={13} />
                                    <span>Back</span>
                                </button>
                                <button
                                    type="button"
                                    className="pw-btn-primary"
                                    onClick={() => setCurrentStep(3)}
                                    disabled={!canContinueFromStep2 || isSaving}
                                >
                                    <span>Continue</span>
                                    <ArrowRight size={13} />
                                </button>
                            </>
                        )}

                        {currentStep === 3 && (
                            <>
                                <button
                                    type="button"
                                    className="pw-btn-secondary"
                                    onClick={() => setCurrentStep(2)}
                                    disabled={isSaving || isValidating}
                                >
                                    <ArrowLeft size={13} />
                                    <span>Back</span>
                                </button>

                                {validationResult?.valid ? (
                                    <button
                                        type="button"
                                        className="pw-btn-primary"
                                        onClick={handleSave}
                                        disabled={isSaving}
                                    >
                                        <CheckCircle2 size={14} />
                                        <span>{isSaving ? 'Saving…' : 'Save Configuration'}</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="pw-btn-primary"
                                        onClick={handleValidate}
                                        disabled={isValidating || isSaving}
                                    >
                                        <RefreshCw size={13} className={isValidating ? 'pw-spin' : ''} />
                                        <span>{isValidating ? 'Validating…' : 'Validate Mapping'}</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </footer>
            </aside>
        </div>,
        document.body
    );
};

export default PlaywrightConfigurationDrawer;
