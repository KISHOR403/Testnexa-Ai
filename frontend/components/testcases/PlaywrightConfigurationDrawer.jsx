import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Bot, Code, CheckCircle2, AlertTriangle, Play, ShieldAlert, RefreshCw, FileCode, Search, Trash2 } from 'lucide-react';
import { executionService } from '../../services/executionService';
import { workspaceService } from '../../services/workspaceService';
import '../../styles/app/PlaywrightConfiguration.css';

const PlaywrightConfigurationDrawer = ({
    isOpen = true,
    onClose,
    testCase,
    onSaveMapping,
    onRemoveMapping,
    isSaving = false
}) => {
    // Initial mapping data extraction
    const initialMapping = testCase?.automationMapping || {};

    // Source & project selection
    const [sources, setSources] = useState([]);
    const [sourcesLoading, setSourcesLoading] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState('proj_e2e_core');

    // Environments
    const [environments, setEnvironments] = useState([]);

    // Configuration method: 'existing' | 'custom'
    const [configMethod, setConfigMethod] = useState(initialMapping.scriptSource === 'custom' ? 'custom' : 'existing');

    // Test selection (Mode A: existing)
    const [selectedFile, setSelectedFile] = useState(initialMapping.scriptRef?.split('#')?.[0] || '');
    const [selectedTestId, setSelectedTestId] = useState(initialMapping.automationTestId || initialMapping.scriptRef?.split('#')?.[1] || '');
    const [testSearch, setTestSearch] = useState('');

    // Custom script (Mode B: custom)
    const [customTestId, setCustomTestId] = useState(initialMapping.automationTestId || (testCase?.id ? testCase.id.toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'custom_test'));
    const [customCode, setCustomCode] = useState(initialMapping.scriptCode || `async function execute(page, expect) {\n    // 1. Navigate to target application route\n    await page.goto('/login');\n    await expect(page.locator('body')).toBeVisible();\n\n    // 2. Perform actions and assertions\n    const heading = page.locator('h1, h2').first();\n    await expect(heading).toBeVisible();\n}`);

    // Execution settings
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
    useEffect(() => {
        let mounted = true;

        const loadPrerequisites = async () => {
            setSourcesLoading(true);
            try {
                const [srcRes, envRes] = await Promise.all([
                    executionService.getAutomationSources().catch(() => ({ success: false })),
                    workspaceService.getEnvironments().catch(() => ({ data: [] }))
                ]);

                if (!mounted) return;

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
                }

                if (Array.isArray(envRes?.data)) {
                    setEnvironments(envRes.data);
                    if (!targetEnvironmentId && envRes.data.length > 0) {
                        setTargetEnvironmentId(envRes.data[0].id);
                    }
                }
            } catch (err) {
                if (mounted) setActionError('Failed to load automation sources or environments.');
            } finally {
                if (mounted) setSourcesLoading(false);
            }
        };

        if (isOpen) {
            loadPrerequisites();
        }

        return () => { mounted = false; };
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

    // Handle Validate Action
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

    // Handle Save Action
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
            lastValidatedAt: validationResult?.valid ? new Date().toISOString() : (initialMapping.lastValidatedAt || new Date().toISOString()),
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
                {/* Header */}
                <header className="pw-drawer-header">
                    <div>
                        <div className="pw-header-meta">
                            <span>Playwright Automation Workspace</span>
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

                {/* Test Case Context Banner */}
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

                {/* Body Content */}
                <div className="pw-drawer-body">
                    {/* Error Banner */}
                    {actionError && (
                        <div className="pw-validation-box invalid" role="alert">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={15} />
                                <strong>{actionError}</strong>
                            </div>
                        </div>
                    )}

                    {/* Section 1: Automation Project Selection */}
                    <section className="pw-section">
                        <h3 className="pw-section-title">
                            <span className="step-badge">1</span>
                            <span>Automation Project Selection</span>
                        </h3>
                        <div className="pw-field-group">
                            <label className="pw-label">Registered Playwright Project</label>
                            {sourcesLoading ? (
                                <p style={{ fontSize: '0.78rem', color: '#8BAF9A' }}>Discovering registered automation projects...</p>
                            ) : (
                                <select
                                    className="pw-select"
                                    value={selectedProjectId}
                                    onChange={e => setSelectedProjectId(e.target.value)}
                                >
                                    {sources.map(src => (
                                        <option key={src.id} value={src.id}>
                                            {src.name} ({src.framework}) — {src.repository} ({src.testsCount} tests)
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        {activeProject && (
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.74rem', color: '#CBD5E1', background: '#080A09', padding: '8px 12px', borderRadius: '4px', border: '1px solid #1A211D' }}>
                                <span>Framework: <strong style={{ color: '#8BAF9A' }}>{activeProject.framework}</strong></span>
                                <span>•</span>
                                <span>Root: <code>{activeProject.repository}</code></span>
                                <span>•</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8BAF9A' }}></span>
                                    Status: Connected
                                </span>
                            </div>
                        )}
                    </section>

                    {/* Section 2: Test Discovery & Selection */}
                    <section className="pw-section">
                        <h3 className="pw-section-title">
                            <span className="step-badge">2</span>
                            <span>Playwright Test Discovery & Mapping</span>
                        </h3>

                        {/* Method Toggle */}
                        <div className="pw-method-toggle">
                            <button
                                type="button"
                                className={`pw-method-btn ${configMethod === 'existing' ? 'active' : ''}`}
                                onClick={() => setConfigMethod('existing')}
                            >
                                <Bot size={14} />
                                <span>A. Approved Playwright Spec File</span>
                            </button>
                            <button
                                type="button"
                                className={`pw-method-btn ${configMethod === 'custom' ? 'active' : ''}`}
                                onClick={() => setConfigMethod('custom')}
                            >
                                <Code size={14} />
                                <span>B. Custom Playwright Script</span>
                            </button>
                        </div>

                        {configMethod === 'existing' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="pw-field-group">
                                    <label className="pw-label">Discovered Spec File</label>
                                    <select
                                        className="pw-select"
                                        value={selectedFile}
                                        onChange={e => {
                                            const file = e.target.value;
                                            setSelectedFile(file);
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
                                        <span style={{ fontSize: '0.7rem', color: '#8BAF9A' }}>
                                            {filteredTests.length} tests available
                                        </span>
                                    </label>
                                    <div style={{ position: 'relative', marginBottom: '6px' }}>
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
                                                    onClick={() => setSelectedTestId(t.testId)}
                                                >
                                                    <div className="pw-test-meta">
                                                        <strong>{t.title}</strong>
                                                        <small>ID: {t.testId} • v{t.version}</small>
                                                    </div>
                                                    {isSelected && <CheckCircle2 size={14} color="#8BAF9A" />}
                                                </div>
                                            );
                                        })}
                                        {filteredTests.length === 0 && (
                                            <p style={{ padding: '12px', fontSize: '0.78rem', color: '#7A8580', margin: 0, textAlign: 'center' }}>
                                                No matching tests found.
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="pw-field-group">
                                    <label className="pw-label">Automation Test Identifier</label>
                                    <input
                                        type="text"
                                        className="pw-input"
                                        value={customTestId}
                                        onChange={e => setCustomTestId(e.target.value)}
                                        placeholder="e.g. auth_valid_login"
                                    />
                                </div>
                                <div className="pw-field-group">
                                    <label className="pw-label">
                                        <span>Custom Playwright Function (JavaScript)</span>
                                        <span style={{ fontSize: '0.7rem', color: '#8BAF9A' }}>async function(page, expect)</span>
                                    </label>
                                    <textarea
                                        className="pw-textarea"
                                        rows={8}
                                        value={customCode}
                                        onChange={e => setCustomCode(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Section 3: Execution Settings */}
                    <section className="pw-section">
                        <h3 className="pw-section-title">
                            <span className="step-badge">3</span>
                            <span>Worker Execution Settings</span>
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div className="pw-field-group">
                                <label className="pw-label">Browser Engine</label>
                                <select className="pw-select" value={browser} onChange={e => setBrowser(e.target.value)}>
                                    <option value="chromium">Chromium (Recommended)</option>
                                    <option value="firefox">Firefox</option>
                                    <option value="webkit">WebKit (Safari)</option>
                                </select>
                            </div>
                            <div className="pw-field-group">
                                <label className="pw-label">Target Environment</label>
                                <select className="pw-select" value={targetEnvironmentId} onChange={e => setTargetEnvironmentId(e.target.value)}>
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
                                <label className="pw-label">Timeout (ms)</label>
                                <input
                                    type="number"
                                    min="1000"
                                    max="120000"
                                    step="1000"
                                    className="pw-input"
                                    value={timeoutMs}
                                    onChange={e => setTimeoutMs(e.target.value)}
                                />
                            </div>
                            <div className="pw-field-group">
                                <label className="pw-label">Worker Retries</label>
                                <select className="pw-select" value={retries} onChange={e => setRetries(parseInt(e.target.value, 10))}>
                                    <option value="0">0 retries (Fast fail)</option>
                                    <option value="1">1 retry</option>
                                    <option value="2">2 retries</option>
                                    <option value="3">3 retries</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            <div className="pw-field-group">
                                <label className="pw-label">Screenshots</label>
                                <select className="pw-select" value={captureScreenshots} onChange={e => setCaptureScreenshots(e.target.value)}>
                                    <option value="on_failure">On Failure</option>
                                    <option value="always">Always</option>
                                    <option value="off">Off</option>
                                </select>
                            </div>
                            <div className="pw-field-group">
                                <label className="pw-label">Video Capture</label>
                                <select className="pw-select" value={captureVideo} onChange={e => setCaptureVideo(e.target.value)}>
                                    <option value="retain_on_failure">Retain on Fail</option>
                                    <option value="always">Always</option>
                                    <option value="off">Off</option>
                                </select>
                            </div>
                            <div className="pw-field-group">
                                <label className="pw-label">Trace Viewer</label>
                                <select className="pw-select" value={captureTrace} onChange={e => setCaptureTrace(e.target.value)}>
                                    <option value="retain_on_failure">Retain on Fail</option>
                                    <option value="always">Always</option>
                                    <option value="off">Off</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Section 4: Validation Engine */}
                    <section className="pw-section">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 className="pw-section-title">
                                <span className="step-badge">4</span>
                                <span>Mapping Verification</span>
                            </h3>
                            <button
                                type="button"
                                className="pw-btn-secondary"
                                onClick={handleValidate}
                                disabled={isValidating || sourcesLoading}
                            >
                                <RefreshCw size={13} className={isValidating ? 'spin' : ''} />
                                <span>{isValidating ? 'Validating…' : 'Validate Mapping'}</span>
                            </button>
                        </div>

                        {validationResult && (
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
                    </section>
                </div>

                {/* Footer Actions */}
                <footer className="pw-drawer-footer">
                    <div>
                        {initialMapping?.mappingStatus === 'configured' && (
                            <button
                                type="button"
                                className="pw-btn-danger"
                                onClick={handleRemove}
                                disabled={isSaving}
                            >
                                <Trash2 size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                Remove Mapping
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
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
                            onClick={handleSave}
                            disabled={isSaving || isValidating}
                        >
                            <CheckCircle2 size={14} />
                            <span>{isSaving ? 'Saving…' : 'Save Configuration'}</span>
                        </button>
                    </div>
                </footer>
            </aside>
        </div>,
        document.body
    );
};

export default PlaywrightConfigurationDrawer;
