import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Check, Layers, Code, Shield } from 'lucide-react';

const CATEGORIES = ['Functional', 'Negative', 'Edge', 'Security', 'API', 'Non-functional'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

const getSuiteData = (session) => {
    const suite = session?.suiteData || session?.suite_data || session?.data || session?.suite || null;
    return suite?.suiteData || suite?.suite_data || suite?.data || suite;
};

const getRequirementId = (req) => req && typeof req === 'object'
    ? req.id || req.reqId || req.requirementId || ''
    : '';

const getRequirementTitle = (req) => typeof req === 'string'
    ? req
    : req?.description || req?.requirement || req?.text || req?.title || '';

const extractRequirementsFromSuite = (suite) => {
    const source = [suite?.understanding?.functional_requirements, suite?.requirements, suite?.traceability?.matrix]
        .find(val => Array.isArray(val) ? val.length : val && typeof val === 'object' && Object.keys(val).length) || [];
    const entries = Array.isArray(source) ? source : Object.entries(source).map(([id, val]) =>
        typeof val === 'object' && val !== null ? { ...val, id: val.id || val.reqId || id } : { id, description: String(val || '') }
    );
    return entries
        .map(req => ({ id: String(getRequirementId(req) || ''), title: getRequirementTitle(req) }))
        .filter(req => req.id);
};

const DEFAULT_PLAYWRIGHT_TEMPLATE = `async (page, expect) => {
  // 1. Navigate to target view
  await page.goto('/');
  // 2. Perform step actions
  await expect(page.locator('body')).toBeVisible();
  // 3. Validate expected result
  const title = await page.title();
  expect(title).toBeTruthy();
}`;

const TestCaseEditorModal = ({
    isOpen,
    onClose,
    mode = 'create',
    initialCase = null,
    suites = [],
    selectedSuiteId = '',
    onSave,
    isSaving = false
}) => {
    const isEdit = mode === 'edit' && Boolean(initialCase);

    const [suiteId, setSuiteId] = useState(initialCase?.suiteId || selectedSuiteId || suites[0]?.id || '');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [preconditions, setPreconditions] = useState('');
    const [type, setType] = useState('Functional');
    const [priority, setPriority] = useState('Medium');
    const [method, setMethod] = useState('manual');
    const [status, setStatus] = useState('Draft');
    const [requirementId, setRequirementId] = useState('');
    const [expectedResult, setExpectedResult] = useState('');
    const [steps, setSteps] = useState([{ action: '', expected: '', testData: '' }]);
    const [framework, setFramework] = useState('playwright');
    const [scriptRef, setScriptRef] = useState('');
    const [scriptCode, setScriptCode] = useState('');
    const [formError, setFormError] = useState('');

    // Selected suite session object
    const activeSuite = useMemo(() => {
        return suites.find(s => String(s.id) === String(suiteId)) || suites[0] || null;
    }, [suites, suiteId]);

    // Available requirements from chosen suite
    const availableRequirements = useMemo(() => {
        if (!activeSuite?.session) return [];
        return extractRequirementsFromSuite(getSuiteData(activeSuite.session));
    }, [activeSuite]);

    // Initialize or reset form state
    useEffect(() => {
        if (!isOpen) return;
        setFormError('');
        if (isEdit && initialCase) {
            setSuiteId(initialCase.suiteId || selectedSuiteId);
            setTitle(initialCase.title || '');
            setDescription(initialCase.description || '');
            const pre = Array.isArray(initialCase.preconditions)
                ? initialCase.preconditions.join('\n')
                : String(initialCase.preconditions || '');
            setPreconditions(pre);
            setType(initialCase.type || 'Functional');
            setPriority(initialCase.priority || 'Medium');
            setMethod(initialCase.method || 'manual');
            setStatus(initialCase.lifecycle === 'ready' ? 'Ready' : initialCase.lifecycle === 'draft' ? 'Draft' : 'Needs Review');
            setRequirementId(initialCase.requirementId || '');
            setExpectedResult(initialCase.expectedResult || '');
            if (Array.isArray(initialCase.steps) && initialCase.steps.length > 0) {
                setSteps(initialCase.steps.map(s => ({
                    action: typeof s === 'object' ? s.action || s.description || s.step || '' : String(s),
                    expected: typeof s === 'object' ? s.expected || s.expectedResult || '' : '',
                    testData: typeof s === 'object' ? s.testData || s.data || '' : ''
                })));
            } else {
                setSteps([{ action: '', expected: '', testData: '' }]);
            }
            const mapping = initialCase.automationMapping || {};
            setFramework(mapping.framework || 'playwright');
            setScriptRef(mapping.scriptRef || mapping.automationTestId || '');
            setScriptCode(mapping.scriptCode || mapping.code || '');
        } else {
            setSuiteId(selectedSuiteId || suites[0]?.id || '');
            setTitle('');
            setDescription('');
            setPreconditions('');
            setType('Functional');
            setPriority('Medium');
            setMethod('manual');
            setStatus('Draft');
            setRequirementId('');
            setExpectedResult('');
            setSteps([{ action: '', expected: '', testData: '' }]);
            setFramework('playwright');
            setScriptRef('');
            setScriptCode(DEFAULT_PLAYWRIGHT_TEMPLATE);
        }
    }, [isOpen, isEdit, initialCase, selectedSuiteId, suites]);

    if (!isOpen) return null;

    // Step handlers
    const handleAddStep = () => {
        setSteps(prev => [...prev, { action: '', expected: '', testData: '' }]);
    };

    const handleRemoveStep = (index) => {
        setSteps(prev => {
            if (prev.length <= 1) return [{ action: '', expected: '', testData: '' }];
            return prev.filter((_, idx) => idx !== index);
        });
    };

    const handleStepChange = (index, field, value) => {
        setSteps(prev => prev.map((step, idx) => idx === index ? { ...step, [field]: value } : step));
    };

    const handleMoveStep = (index, direction) => {
        setSteps(prev => {
            const target = direction === 'up' ? index - 1 : index + 1;
            if (target < 0 || target >= prev.length) return prev;
            const updated = [...prev];
            const temp = updated[index];
            updated[index] = updated[target];
            updated[target] = temp;
            return updated;
        });
    };

    // Form submit validation & dispatcher
    const handleSubmit = async (desiredStatus = status) => {
        setFormError('');
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setFormError('Please enter a test case title.');
            return;
        }

        if (!suiteId) {
            setFormError('Please select a target test suite.');
            return;
        }

        const cleanSteps = steps
            .map(s => ({
                action: s.action.trim(),
                expected: s.expected.trim(),
                ...(s.testData && s.testData.trim() ? { testData: s.testData.trim() } : {})
            }))
            .filter(s => s.action || s.expected);

        if (desiredStatus === 'Ready') {
            if (cleanSteps.length === 0) {
                setFormError('At least one test step is required before marking this test case Ready.');
                return;
            }
            const missingRequired = cleanSteps.some(s => !s.action || !s.expected);
            if (missingRequired) {
                setFormError('Every step must include both an Action and an Expected Result to be marked Ready.');
                return;
            }
            if (method === 'automated' && !scriptRef.trim() && !scriptCode.trim()) {
                setFormError('Automated test cases require a Playwright script reference or executable script before being marked Ready.');
                return;
            }
        }

        const preList = preconditions
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        const isAutomated = method === 'automated';
        const existingMapping = initialCase?.automationMapping || {};
        const mappingChanged = scriptCode !== (existingMapping.scriptCode || existingMapping.code || '')
            || scriptRef.trim() !== (existingMapping.scriptRef || '');

        const automationMapping = isAutomated ? {
            ...existingMapping,
            framework: framework || 'playwright',
            scriptRef: scriptRef.trim(),
            scriptCode: scriptCode,
            mappingStatus: mappingChanged ? 'configured' : existingMapping.mappingStatus || 'configured',
            validationStatus: scriptCode.trim() ? 'valid' : existingMapping.validationStatus || 'unvalidated',
            updatedAt: new Date().toISOString()
        } : null;

        const nextCase = {
            ...(initialCase?.raw || {}),
            id: initialCase?.id || '', // Handled by generator if blank
            title: trimmedTitle,
            description: description.trim(),
            preconditions: preList,
            steps: cleanSteps.length > 0 ? cleanSteps : [{ action: trimmedTitle, expected: expectedResult.trim() || 'Verified successfully' }],
            expectedResult: expectedResult.trim(),
            priority,
            type,
            executionType: method,
            status: desiredStatus,
            requirementId: requirementId || '',
            automationMapping,
            updatedAt: new Date().toISOString(),
            ...(initialCase ? {} : { createdAt: new Date().toISOString() })
        };

        try {
            await onSave(suiteId, initialCase, nextCase, desiredStatus);
            onClose();
        } catch (err) {
            setFormError(err.message || 'Failed to save test case. Please verify the input and try again.');
        }
    };

    return createPortal(
        <div className="tc-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <section className="tc-form-dialog" role="dialog" aria-modal="true" aria-labelledby="tc-form-title">
                <header>
                    <div>
                        <span>{activeSuite?.name ? `${activeSuite.name} (${activeSuite.context || 'web'})` : 'Test Suite'}</span>
                        <h2 id="tc-form-title">{isEdit ? `Edit Test Case: ${initialCase.id}` : 'Create New Test Case'}</h2>
                    </div>
                    <button type="button" aria-label="Close form" onClick={onClose} disabled={isSaving}>
                        <X size={16} />
                    </button>
                </header>

                <form onSubmit={e => { e.preventDefault(); handleSubmit(status); }}>
                    <div className="tc-form-grid">
                        <label className="wide">
                            Title *
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Verify user cannot sign in with expired password"
                                maxLength={200}
                                required
                            />
                        </label>

                        <label>
                            Target Suite *
                            <select
                                value={suiteId}
                                onChange={e => { setSuiteId(e.target.value); setRequirementId(''); }}
                                disabled={isEdit}
                            >
                                {suites.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.context ? s.context.toUpperCase() + ' · ' : ''}{s.caseCount ?? 0} cases)
                                    </option>
                                ))}
                            </select>
                            {isEdit && <small>Test case is anchored to this suite. Use "Add to another suite" to copy.</small>}
                        </label>

                        <label>
                            Requirement Link
                            <select
                                value={requirementId}
                                onChange={e => setRequirementId(e.target.value)}
                            >
                                <option value="">No requirement linked</option>
                                {availableRequirements.map(req => (
                                    <option key={req.id} value={req.id}>
                                        {req.id} — {req.title.length > 40 ? req.title.slice(0, 38) + '…' : req.title}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Test Category
                            <select value={type} onChange={e => setType(e.target.value)}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>

                        <label>
                            Execution Method
                            <select value={method} onChange={e => setMethod(e.target.value)}>
                                <option value="manual">Manual Execution</option>
                                <option value="automated">Playwright Automated</option>
                            </select>
                        </label>

                        <label>
                            Priority
                            <select value={priority} onChange={e => setPriority(e.target.value)}>
                                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </label>

                        <label>
                            Status
                            <select value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="Draft">Draft</option>
                                <option value="Needs Review">Needs Review</option>
                                <option value="Ready">Ready</option>
                            </select>
                        </label>

                        <label className="wide">
                            Description & Context
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={2}
                                placeholder="Detail the business context or scenario intent..."
                            />
                        </label>

                        <label className="wide">
                            Preconditions
                            <textarea
                                value={preconditions}
                                onChange={e => setPreconditions(e.target.value)}
                                rows={2}
                                placeholder="One precondition per line (e.g. User account exists in database, User is unauthenticated)"
                            />
                        </label>

                        <label className="wide">
                            Target Expected Result
                            <textarea
                                value={expectedResult}
                                onChange={e => setExpectedResult(e.target.value)}
                                rows={2}
                                placeholder="Acceptance criteria verifying successful completion of this test scenario..."
                            />
                        </label>
                    </div>

                    {/* Step-by-Step Execution Procedure */}
                    <div className="tc-steps-editor">
                        <div>
                            <h3>Test Steps ({steps.length})</h3>
                            <button type="button" className="tc-text-link" onClick={handleAddStep}>
                                <Plus size={13} /> Add Step
                            </button>
                        </div>

                        {steps.map((step, idx) => (
                            <div className="tc-step-editor" key={`step-${idx}`}>
                                <span className="tc-step-number">{idx + 1}</span>
                                <label>
                                    Action *
                                    <textarea
                                        value={step.action}
                                        onChange={e => handleStepChange(idx, 'action', e.target.value)}
                                        rows={2}
                                        placeholder={`Step ${idx + 1} user action or API call...`}
                                        required
                                    />
                                </label>
                                <label>
                                    Expected Result *
                                    <textarea
                                        value={step.expected}
                                        onChange={e => handleStepChange(idx, 'expected', e.target.value)}
                                        rows={2}
                                        placeholder="Observable outcome or assertion..."
                                        required
                                    />
                                </label>
                                <label>
                                    Test Data (Optional)
                                    <input
                                        value={step.testData || ''}
                                        onChange={e => handleStepChange(idx, 'testData', e.target.value)}
                                        placeholder="e.g. { role: 'admin' }"
                                    />
                                </label>
                                <div className="tc-step-actions">
                                    <button
                                        type="button"
                                        aria-label="Move step up"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveStep(idx, 'up')}
                                        title="Move step up"
                                    >
                                        <ArrowUp size={13} />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Move step down"
                                        disabled={idx === steps.length - 1}
                                        onClick={() => handleMoveStep(idx, 'down')}
                                        title="Move step down"
                                    >
                                        <ArrowDown size={13} />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Remove step"
                                        disabled={steps.length <= 1}
                                        onClick={() => handleRemoveStep(idx)}
                                        title="Delete step"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Automation Integration Section */}
                    {method === 'automated' && (
                        <div className="tc-form-grid" style={{ marginTop: '0.5rem', borderTop: '1px solid var(--tc-line)', paddingTop: '0.85rem' }}>
                            <div className="wide" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--tc-jade)' }}>
                                <Code size={14} />
                                <strong style={{ fontSize: '0.78rem' }}>Playwright Automation Configuration</strong>
                            </div>
                            <label>
                                Framework
                                <input value={framework} onChange={e => setFramework(e.target.value)} />
                            </label>
                            <label>
                                Script Reference
                                <input
                                    value={scriptRef}
                                    onChange={e => setScriptRef(e.target.value)}
                                    placeholder="tests/e2e/auth.spec.js#user-login"
                                />
                            </label>
                            <label className="wide">
                                Playwright Script Function (Page & Expect)
                                <textarea
                                    value={scriptCode}
                                    onChange={e => setScriptCode(e.target.value)}
                                    rows={6}
                                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.75rem' }}
                                />
                            </label>
                            <div className="tc-mapping-help wide">
                                Automated scripts execute in an isolated headless browser worker. You can execute this script directly or in the Test Run Workspace.
                            </div>
                        </div>
                    )}

                    {formError && (
                        <div className="tc-form-error" role="alert" style={{ marginTop: '0.75rem' }}>
                            {formError}
                        </div>
                    )}

                    <footer>
                        <button type="button" onClick={onClose} disabled={isSaving}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSubmit('Draft')}
                        >
                            {isSaving ? 'Saving…' : 'Save as Draft'}
                        </button>
                        <button
                            type="submit"
                            className="tc-primary"
                            disabled={isSaving}
                        >
                            <Check size={14} />
                            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Test Case'}
                        </button>
                        <button
                            type="button"
                            className="tc-ready"
                            disabled={isSaving}
                            onClick={() => handleSubmit('Ready')}
                        >
                            Mark Ready
                        </button>
                    </footer>
                </form>
            </section>
        </div>,
        document.body
    );
};

export default TestCaseEditorModal;

