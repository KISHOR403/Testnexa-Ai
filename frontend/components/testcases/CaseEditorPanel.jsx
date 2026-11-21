import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    X, Plus, Trash2, ArrowUp, ArrowDown, AlertTriangle, AlertCircle,
    Check, Lock, ShieldAlert, KeyRound, Search
} from 'lucide-react';

const CREDENTIAL_PATTERNS = [
    /(?:password|passwd|pwd|secret|api[_-]?key|bearer|token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-.~+/$%]{8,}['"]?/i,
    /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, // JWT
    /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}/, // GitHub tokens
    /sk-[a-zA-Z0-9]{32,}/, // OpenAI keys
    /[a-f0-9]{32,64}/i, // Long hex hashes/keys
    /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/ // AWS access key IDs
];

const checkCredentialWarning = (text) => {
    if (!text || typeof text !== 'string') return false;
    return CREDENTIAL_PATTERNS.some(regex => regex.test(text));
};

export const CaseEditorPanel = ({
    testCase,
    suiteRequirements = [],
    onSave,
    onCancel,
    isSaving = false
}) => {
    // Current server baseline
    const initialSnapshot = useMemo(() => {
        const rawSteps = Array.isArray(testCase?.steps) && testCase.steps.length > 0
            ? testCase.steps.map(s => typeof s === 'object' && s !== null
                ? { action: String(s.action || s.step || ''), expected: String(s.expected || ''), data: String(s.data || s.testData || '') }
                : { action: String(s), expected: '', data: '' })
            : [{ action: '', expected: '', data: '' }];

        const rawPreconditions = Array.isArray(testCase?.preconditions)
            ? testCase.preconditions.map(String)
            : (testCase?.preconditions ? [String(testCase.preconditions)] : []);

        const rawReqIds = Array.isArray(testCase?.requirement_ids) && testCase.requirement_ids.length > 0
            ? testCase.requirement_ids.map(String)
            : (testCase?.requirementId ? [String(testCase.requirementId)] : (testCase?.reqId ? [String(testCase.reqId)] : []));

        const rawTags = Array.isArray(testCase?.tags) ? testCase.tags.map(String) : [];

        return {
            title: String(testCase?.title || ''),
            type: String(testCase?.type || 'Functional'),
            priority: String(testCase?.priority || 'Medium'),
            severity: String(testCase?.severity || 'Major'),
            preconditions: rawPreconditions,
            steps: rawSteps,
            expectedResult: String(testCase?.expectedResult || testCase?.expected || ''),
            tags: rawTags,
            requirement_ids: rawReqIds,
            version: testCase?.version || 1
        };
    }, [testCase]);

    const [formData, setFormData] = useState(initialSnapshot);
    const [touched, setTouched] = useState({});
    const [errors, setErrors] = useState({});
    const [newTagInput, setNewTagInput] = useState('');
    const [reqSearch, setReqSearch] = useState('');
    const [reqDropdownOpen, setReqDropdownOpen] = useState(false);
    const [confirmUnlinkModal, setConfirmUnlinkModal] = useState(false);
    const [pendingUnlinkReqId, setPendingUnlinkReqId] = useState(null);
    const [conflictState, setConflictState] = useState(null); // { latestCase, myProposal }
    const dropdownRef = useRef(null);

    // Synchronize if incoming testCase changed while not dirty
    useEffect(() => {
        setFormData(initialSnapshot);
        setTouched({});
        setErrors({});
        setConflictState(null);
    }, [initialSnapshot]);

    // Track dirty changes
    const isDirty = useMemo(() => {
        return JSON.stringify(formData) !== JSON.stringify(initialSnapshot);
    }, [formData, initialSnapshot]);

    // Credential scanner across all text fields
    const hasCredentialLeak = useMemo(() => {
        if (checkCredentialWarning(formData.title)) return true;
        if (checkCredentialWarning(formData.expectedResult)) return true;
        if (formData.preconditions.some(checkCredentialWarning)) return true;
        if (formData.steps.some(st => checkCredentialWarning(st.action) || checkCredentialWarning(st.expected) || checkCredentialWarning(st.data))) return true;
        return false;
    }, [formData]);

    // Validation rules
    const validateField = useCallback((field, value) => {
        switch (field) {
            case 'title': {
                const t = String(value || '').trim();
                if (!t) return 'Title is required.';
                if (t.length < 5) return 'Title must be at least 5 characters.';
                if (t.length > 140) return 'Title must not exceed 140 characters.';
                if (/<[^>]*>/.test(t)) return 'HTML tags are not allowed.';
                return null;
            }
            case 'expectedResult': {
                const e = String(value || '').trim();
                if (e.length > 600) return 'Expected result must not exceed 600 characters.';
                if (/<[^>]*>/.test(e)) return 'HTML tags are not allowed.';
                return null;
            }
            case 'steps': {
                if (!Array.isArray(value) || value.length === 0) return 'At least one test step is required.';
                if (value.length > 30) return 'Maximum 30 steps allowed.';
                for (let i = 0; i < value.length; i++) {
                    const st = value[i];
                    const act = String(st.action || '').trim();
                    const exp = String(st.expected || '').trim();
                    if (!act) return `Step ${i + 1} action cannot be empty.`;
                    if (act.length < 1 || act.length > 400) return `Step ${i + 1} action must be 1..400 chars.`;
                    if (exp && exp.length > 400) return `Step ${i + 1} expected must be <= 400 chars.`;
                }
                return null;
            }
            default:
                return null;
        }
    }, []);

    const handleBlur = (field) => {
        setTouched(prev => ({ ...prev, [field]: true }));
        const err = validateField(field, formData[field]);
        setErrors(prev => ({ ...prev, [field]: err }));
    };

    // Close requirement dropdown on outside click
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setReqDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // Unsaved changes guard on Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (reqDropdownOpen) {
                    setReqDropdownOpen(false);
                    return;
                }
                if (isDirty) {
                    if (window.confirm('You have unsaved changes. Discard them?')) {
                        onCancel();
                    }
                } else {
                    onCancel();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDirty, reqDropdownOpen, onCancel]);

    // Preconditions handlers
    const addPrecondition = () => {
        if (formData.preconditions.length >= 10) return;
        setFormData(prev => ({
            ...prev,
            preconditions: [...prev.preconditions, '']
        }));
    };

    const updatePrecondition = (idx, text) => {
        const updated = [...formData.preconditions];
        updated[idx] = text.slice(0, 300);
        setFormData(prev => ({ ...prev, preconditions: updated }));
    };

    const removePrecondition = (idx) => {
        setFormData(prev => ({
            ...prev,
            preconditions: prev.preconditions.filter((_, i) => i !== idx)
        }));
    };

    // Step handlers
    const addStep = () => {
        if (formData.steps.length >= 30) return;
        setFormData(prev => ({
            ...prev,
            steps: [...prev.steps, { action: '', expected: '', data: '' }]
        }));
    };

    const updateStep = (idx, key, val) => {
        const updated = [...formData.steps];
        updated[idx] = { ...updated[idx], [key]: val.slice(0, 400) };
        setFormData(prev => ({ ...prev, steps: updated }));
    };

    const moveStep = (idx, direction) => {
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= formData.steps.length) return;
        const updated = [...formData.steps];
        const [moved] = updated.splice(idx, 1);
        updated.splice(targetIdx, 0, moved);
        setFormData(prev => ({ ...prev, steps: updated }));
    };

    const removeStep = (idx) => {
        if (formData.steps.length <= 1) return;
        setFormData(prev => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== idx)
        }));
    };

    // Tag handlers
    const addTag = (tag) => {
        const clean = tag.trim().replace(/^#/, '').slice(0, 30);
        if (!clean || formData.tags.includes(clean) || formData.tags.length >= 10) return;
        setFormData(prev => ({ ...prev, tags: [...prev.tags, clean] }));
        setNewTagInput('');
    };

    const removeTag = (tag) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t !== tag)
        }));
    };

    // Requirement linking handlers (checks LAST_LINK rule)
    const handleAddRequirement = (reqId) => {
        if (formData.requirement_ids.includes(reqId) || formData.requirement_ids.length >= 10) return;
        setFormData(prev => ({
            ...prev,
            requirement_ids: [...prev.requirement_ids, reqId]
        }));
        setReqDropdownOpen(false);
    };

    const handleRequestRemoveRequirement = (reqId) => {
        // If this is the last link on the case, require confirmation
        if (formData.requirement_ids.length === 1 && formData.requirement_ids[0] === reqId) {
            setPendingUnlinkReqId(reqId);
            setConfirmUnlinkModal(true);
            return;
        }
        setFormData(prev => ({
            ...prev,
            requirement_ids: prev.requirement_ids.filter(id => id !== reqId)
        }));
    };

    const handleConfirmLastUnlink = () => {
        if (pendingUnlinkReqId) {
            setFormData(prev => ({
                ...prev,
                requirement_ids: prev.requirement_ids.filter(id => id !== pendingUnlinkReqId),
                confirmUnlinked: true
            }));
        }
        setConfirmUnlinkModal(false);
        setPendingUnlinkReqId(null);
    };

    // Submit handler
    const handleSubmit = async (e) => {
        e?.preventDefault();

        // Run validation across all fields
        const titleErr = validateField('title', formData.title);
        const stepsErr = validateField('steps', formData.steps);
        const expErr = validateField('expectedResult', formData.expectedResult);

        if (titleErr || stepsErr || expErr) {
            setErrors({
                title: titleErr,
                steps: stepsErr,
                expectedResult: expErr
            });
            setTouched({ title: true, steps: true, expectedResult: true });
            return;
        }

        try {
            await onSave({
                ...formData,
                version: testCase?.version || 1
            });
        } catch (err) {
            if (err.status === 409 || err.code === 'CASE_CHANGED') {
                const latestCase = err.data?.currentCase || err.data?.latestCase;
                setConflictState({
                    latestCase: latestCase || { version: (testCase?.version || 1) + 1 },
                    myEdits: { ...formData }
                });
            } else {
                setErrors(prev => ({ ...prev, submit: err.message || 'Failed to save test case.' }));
            }
        }
    };

    const isApprovedBaseline = String(testCase?.approval_status || testCase?.status || '').toLowerCase() === 'approved';

    return (
        <div className="tn-case-editor">
            {/* Header */}
            <div className="tn-case-editor__header">
                <div className="tn-case-editor__meta">
                    <span className="tn-tc-id-lg">{testCase.id}</span>
                    <span className="tn-version-badge">v{testCase.version || 1}</span>
                    <span className="tn-editor-mode-tag">Editing</span>
                </div>
                <button
                    type="button"
                    className="tn-btn-icon"
                    onClick={() => {
                        if (isDirty) {
                            if (window.confirm('Discard unsaved changes?')) onCancel();
                        } else {
                            onCancel();
                        }
                    }}
                    aria-label="Close editor"
                    title="Close (Esc)"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Credential Warning Banner (Non-blocking) */}
            {hasCredentialLeak && (
                <div className="tn-credential-warning-banner" role="alert">
                    <KeyRound size={15} />
                    <div>
                        <strong>Possible Credential Pattern Detected:</strong>
                        <span> Use placeholders such as <code>&lt;valid_password&gt;</code> or <code>&lt;test_token&gt;</code> instead of real secrets.</span>
                    </div>
                </div>
            )}

            {/* Conflict Alert (409) */}
            {conflictState && (
                <div className="tn-conflict-alert" role="alert">
                    <AlertTriangle size={18} />
                    <div className="tn-conflict-alert__body">
                        <strong>Conflict: This test case was updated to version {conflictState.latestCase?.version}.</strong>
                        <p>Another user or action modified this case while you were editing.</p>
                        <div className="tn-conflict-alert__actions">
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--primary tn-app-btn--sm"
                                onClick={() => {
                                    if (conflictState.latestCase) {
                                        setFormData({
                                            title: conflictState.latestCase.title || formData.title,
                                            type: conflictState.latestCase.type || formData.type,
                                            priority: conflictState.latestCase.priority || formData.priority,
                                            severity: conflictState.latestCase.severity || formData.severity,
                                            preconditions: conflictState.latestCase.preconditions || formData.preconditions,
                                            steps: conflictState.latestCase.steps || formData.steps,
                                            expectedResult: conflictState.latestCase.expectedResult || formData.expectedResult,
                                            tags: conflictState.latestCase.tags || formData.tags,
                                            requirement_ids: conflictState.latestCase.requirement_ids || formData.requirement_ids,
                                            version: conflictState.latestCase.version
                                        });
                                    }
                                    setConflictState(null);
                                }}
                            >
                                Reload Latest Version
                            </button>
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                                onClick={() => {
                                    // Override: send with latest version number
                                    onSave({
                                        ...formData,
                                        version: conflictState.latestCase?.version || formData.version + 1
                                    });
                                }}
                            >
                                Overwrite With My Edits
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="tn-case-editor__body">
                {/* Title */}
                <div className="tn-form-group">
                    <div className="tn-form-label-row">
                        <label htmlFor="case-edit-title">
                            Title <span className="tn-required">*</span>
                        </label>
                        <span className="tn-char-counter">{formData.title.length}/140</span>
                    </div>
                    <input
                        id="case-edit-title"
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        onBlur={() => handleBlur('title')}
                        placeholder="e.g. Verify user login with valid credentials"
                        maxLength={140}
                        className={touched.title && errors.title ? 'is-invalid' : ''}
                    />
                    {touched.title && errors.title && (
                        <span className="tn-field-error">{errors.title}</span>
                    )}
                </div>

                {/* Classification Controls Grid */}
                <div className="tn-form-grid-3">
                    <div className="tn-form-group">
                        <label htmlFor="case-edit-type">Type</label>
                        <select
                            id="case-edit-type"
                            value={formData.type}
                            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                        >
                            <option value="Functional">Functional</option>
                            <option value="Negative">Negative</option>
                            <option value="Edge Case">Edge Case</option>
                            <option value="Security">Security</option>
                            <option value="API">API</option>
                        </select>
                    </div>

                    <div className="tn-form-group">
                        <label htmlFor="case-edit-priority">Priority</label>
                        <select
                            id="case-edit-priority"
                            value={formData.priority}
                            onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                        >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>

                    <div className="tn-form-group">
                        <label htmlFor="case-edit-severity">Severity</label>
                        <select
                            id="case-edit-severity"
                            value={formData.severity}
                            onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
                        >
                            <option value="Critical">Critical</option>
                            <option value="Major">Major</option>
                            <option value="Minor">Minor</option>
                            <option value="Trivial">Trivial</option>
                        </select>
                    </div>
                </div>

                {/* Preconditions */}
                <div className="tn-form-group">
                    <div className="tn-form-label-row">
                        <label>Preconditions ({formData.preconditions.length}/10)</label>
                        {formData.preconditions.length < 10 && (
                            <button
                                type="button"
                                className="tn-link-btn"
                                onClick={addPrecondition}
                            >
                                <Plus size={12} /> Add Precondition
                            </button>
                        )}
                    </div>
                    {formData.preconditions.length > 0 ? (
                        <div className="tn-editor-preconditions-list">
                            {formData.preconditions.map((item, idx) => (
                                <div key={idx} className="tn-precondition-edit-row">
                                    <span className="tn-step-bullet">•</span>
                                    <input
                                        type="text"
                                        value={item}
                                        placeholder="e.g. User account is active in staging database"
                                        maxLength={300}
                                        onChange={(e) => updatePrecondition(idx, e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="tn-btn-icon"
                                        onClick={() => removePrecondition(idx)}
                                        aria-label="Remove precondition"
                                        title="Remove"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="tn-empty-hint">No preconditions defined. Click "+ Add Precondition" to specify setup requirements.</p>
                    )}
                </div>

                {/* Test Steps */}
                <div className="tn-form-group">
                    <div className="tn-form-label-row">
                        <label>
                            Test Steps <span className="tn-required">*</span> ({formData.steps.length}/30)
                        </label>
                        {formData.steps.length < 30 && (
                            <button
                                type="button"
                                className="tn-link-btn"
                                onClick={addStep}
                            >
                                <Plus size={12} /> Add Step
                            </button>
                        )}
                    </div>
                    {touched.steps && errors.steps && (
                        <span className="tn-field-error" style={{ marginBottom: 8, display: 'block' }}>{errors.steps}</span>
                    )}

                    <div className="tn-editor-steps-flow">
                        {formData.steps.map((st, idx) => (
                            <div key={idx} className="tn-editor-step-card">
                                <div className="tn-step-card__top">
                                    <div className="tn-step-card__num">
                                        <span>{String(idx + 1).padStart(2, '0')}</span>
                                    </div>
                                    <div className="tn-step-card__controls">
                                        <button
                                            type="button"
                                            className="tn-btn-icon"
                                            disabled={idx === 0}
                                            onClick={() => moveStep(idx, -1)}
                                            title="Move step up"
                                            aria-label="Move up"
                                        >
                                            <ArrowUp size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            className="tn-btn-icon"
                                            disabled={idx === formData.steps.length - 1}
                                            onClick={() => moveStep(idx, 1)}
                                            title="Move step down"
                                            aria-label="Move down"
                                        >
                                            <ArrowDown size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            className="tn-btn-icon tn-btn-icon--danger"
                                            disabled={formData.steps.length <= 1}
                                            onClick={() => removeStep(idx)}
                                            title="Remove step"
                                            aria-label="Remove step"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                <div className="tn-step-card__inputs">
                                    <div className="tn-input-field">
                                        <span className="tn-sublabel">Action <span className="tn-required">*</span></span>
                                        <input
                                            type="text"
                                            required
                                            value={st.action}
                                            placeholder="User action to execute..."
                                            maxLength={400}
                                            onChange={(e) => updateStep(idx, 'action', e.target.value)}
                                            onBlur={() => handleBlur('steps')}
                                        />
                                    </div>
                                    <div className="tn-input-field">
                                        <span className="tn-sublabel">Expected Outcome</span>
                                        <input
                                            type="text"
                                            value={st.expected}
                                            placeholder="Expected UI or system state..."
                                            maxLength={400}
                                            onChange={(e) => updateStep(idx, 'expected', e.target.value)}
                                        />
                                    </div>
                                    <div className="tn-input-field">
                                        <span className="tn-sublabel">Test Data (Optional)</span>
                                        <input
                                            type="text"
                                            value={st.data}
                                            placeholder="e.g. username=test@example.com"
                                            maxLength={400}
                                            onChange={(e) => updateStep(idx, 'data', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Overall Expected Result */}
                <div className="tn-form-group">
                    <div className="tn-form-label-row">
                        <label htmlFor="case-edit-expected">Expected Result</label>
                        <span className="tn-char-counter">{formData.expectedResult.length}/600</span>
                    </div>
                    <textarea
                        id="case-edit-expected"
                        rows={3}
                        value={formData.expectedResult}
                        onChange={(e) => setFormData(prev => ({ ...prev, expectedResult: e.target.value }))}
                        onBlur={() => handleBlur('expectedResult')}
                        placeholder="System behaves strictly as defined in requirement specification."
                        maxLength={600}
                        className={touched.expectedResult && errors.expectedResult ? 'is-invalid' : ''}
                    />
                    {touched.expectedResult && errors.expectedResult && (
                        <span className="tn-field-error">{errors.expectedResult}</span>
                    )}
                </div>

                {/* Requirement Links (Searchable multi-select) */}
                <div className="tn-form-group" ref={dropdownRef}>
                    <div className="tn-form-label-row">
                        <label>Linked Requirements ({formData.requirement_ids.length}/10)</label>
                    </div>

                    <div className="tn-req-chips-wrap">
                        {formData.requirement_ids.map(reqId => (
                            <span key={reqId} className="tn-req-pill-editable">
                                <code>{reqId}</code>
                                <button
                                    type="button"
                                    onClick={() => handleRequestRemoveRequirement(reqId)}
                                    title={`Unlink ${reqId}`}
                                    aria-label={`Unlink ${reqId}`}
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        ))}

                        {formData.requirement_ids.length < 10 && (
                            <div className="tn-req-picker-anchor">
                                <button
                                    type="button"
                                    className="tn-req-picker-btn"
                                    onClick={() => setReqDropdownOpen(prev => !prev)}
                                >
                                    <Plus size={11} /> Link Requirement
                                </button>

                                {reqDropdownOpen && (
                                    <div className="tn-req-picker-dropdown">
                                        <div className="tn-req-search-box">
                                            <Search size={13} />
                                            <input
                                                type="text"
                                                placeholder="Search requirement key or title..."
                                                value={reqSearch}
                                                onChange={(e) => setReqSearch(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="tn-req-picker-list">
                                            {suiteRequirements
                                                .filter(r => {
                                                    const key = r.key || r.id;
                                                    if (formData.requirement_ids.includes(key)) return false;
                                                    const term = reqSearch.toLowerCase();
                                                    return !term || `${key} ${r.title || ''}`.toLowerCase().includes(term);
                                                })
                                                .map(r => {
                                                    const key = r.key || r.id;
                                                    return (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            className="tn-req-picker-item"
                                                            onClick={() => handleAddRequirement(key)}
                                                        >
                                                            <code>{key}</code>
                                                            <span>{r.title}</span>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tags */}
                <div className="tn-form-group">
                    <label>Tags ({formData.tags.length}/10)</label>
                    <div className="tn-tag-input-row">
                        <div className="tn-tag-list">
                            {formData.tags.map(tag => (
                                <span key={tag} className="tn-tag-editable">
                                    <span>#{tag}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeTag(tag)}
                                        aria-label={`Remove tag ${tag}`}
                                    >
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        {formData.tags.length < 10 && (
                            <input
                                type="text"
                                placeholder="Add tag and press Enter..."
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTag(newTagInput);
                                    }
                                }}
                                maxLength={30}
                                className="tn-tag-inline-input"
                            />
                        )}
                    </div>
                </div>

                {/* Sticky Footer */}
                <div className="tn-case-editor__footer">
                    {isApprovedBaseline && (
                        <div className="tn-approval-reset-warning">
                            <AlertCircle size={13} />
                            <span>Saving will reset approval to <strong>Pending</strong>.</span>
                        </div>
                    )}

                    {errors.submit && (
                        <div className="tn-form-alert" role="alert">
                            <AlertCircle size={13} />
                            <span>{errors.submit}</span>
                        </div>
                    )}

                    <div className="tn-case-editor__footer-actions">
                        <button
                            type="button"
                            className="tn-app-btn tn-app-btn--secondary"
                            onClick={() => {
                                if (isDirty) {
                                    if (window.confirm('Discard unsaved changes?')) onCancel();
                                } else {
                                    onCancel();
                                }
                            }}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="tn-app-btn tn-app-btn--primary"
                            disabled={isSaving || !isDirty}
                        >
                            <Check size={14} />
                            <span>{isSaving ? 'Saving…' : 'Save changes'}</span>
                        </button>
                    </div>
                </div>
            </form>

            {/* Last Link Removal Confirmation Modal */}
            {confirmUnlinkModal && (
                <div className="tn-dialog-backdrop" role="presentation">
                    <div className="tn-dialog tn-dialog--sm" role="dialog" aria-modal="true">
                        <div className="tn-dialog__header">
                            <div>
                                <div className="tn-eyebrow">Requirement Linking</div>
                                <h3>Remove Last Link?</h3>
                            </div>
                            <button
                                type="button"
                                className="tn-btn-icon"
                                onClick={() => setConfirmUnlinkModal(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="tn-dialog__body">
                            <p>
                                Removing <code>{pendingUnlinkReqId}</code> leaves this test case without any linked requirements.
                                It will be marked as unlinked. Do you want to proceed?
                            </p>
                        </div>
                        <div className="tn-dialog__footer">
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--secondary"
                                onClick={() => setConfirmUnlinkModal(false)}
                            >
                                Keep Linked
                            </button>
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--primary"
                                onClick={handleConfirmLastUnlink}
                            >
                                Confirm Unlink
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CaseEditorPanel;
