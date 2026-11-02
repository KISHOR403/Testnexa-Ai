import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, XCircle, AlertTriangle, MinusCircle, Clock, Camera, User, Globe, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { workspaceService } from '../../services/workspaceService';

const ManualExecutionModal = ({
    isOpen = true,
    onClose,
    testCase,
    onRecord,
    onSave,
    isRecording = false
}) => {
    const recordHandler = onRecord || onSave;
    const { user } = useAuth();

    const [status, setStatus] = useState('not_run');
    const [actualResult, setActualResult] = useState('');
    const [notes, setNotes] = useState('');
    const [screenshotData, setScreenshotData] = useState(null);
    const [screenshotName, setScreenshotName] = useState('');
    const [error, setError] = useState('');
    const [startTime] = useState(Date.now());
    const [stepOutcomes, setStepOutcomes] = useState({});
    const [environments, setEnvironments] = useState([]);
    const [selectedEnvId, setSelectedEnvId] = useState('');

    const steps = Array.isArray(testCase?.steps) ? testCase.steps : [];

    // Load available workspace environments
    useEffect(() => {
        let mounted = true;
        const loadEnvs = async () => {
            try {
                const res = await workspaceService.getEnvironments();
                if (mounted && Array.isArray(res?.data) && res.data.length > 0) {
                    setEnvironments(res.data);
                    setSelectedEnvId(res.data[0].id);
                }
            } catch {}
        };
        if (isOpen) {
            loadEnvs();
        }
        return () => { mounted = false; };
    }, [isOpen]);

    // Reset state on modal open
    useEffect(() => {
        if (!isOpen) return;
        setActualResult('');
        setNotes('');
        setScreenshotData(null);
        setScreenshotName('');
        setError('');

        // Default all steps to 'not_run' to prevent accidental premature Passed saves
        const initial = {};
        steps.forEach((_, idx) => {
            initial[idx] = 'not_run';
        });
        setStepOutcomes(initial);

        if (steps.length === 0) {
            setStatus('passed');
        } else {
            setStatus('not_run');
        }
    }, [isOpen, testCase]);

    // Update individual step outcome and auto-evaluate overall outcome
    const handleStepOutcomeChange = (idx, outcome) => {
        const next = { ...stepOutcomes, [idx]: outcome };
        setStepOutcomes(next);

        const values = Object.values(next);
        if (values.includes('failed')) {
            setStatus('failed');
        } else if (values.includes('blocked')) {
            setStatus('blocked');
        } else if (values.every(v => v === 'passed')) {
            setStatus('passed');
        } else if (values.every(v => v === 'skipped')) {
            setStatus('skipped');
        } else {
            // Some steps are not_run or mixed
            setStatus('in_progress');
        }
    };

    if (!isOpen || !testCase) return null;

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file (PNG, JPG, WebP).');
            return;
        }
        setScreenshotName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            setScreenshotData(event.target?.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const stepValues = Object.values(stepOutcomes);
        const hasUnexecutedSteps = steps.length > 0 && stepValues.some(v => v === 'not_run');

        if (status === 'passed' && hasUnexecutedSteps) {
            setError('Cannot mark test as Passed while verification steps are still "Not Run". Please execute all steps or mark remaining steps as Skipped/Blocked.');
            return;
        }

        if (status === 'not_run' || status === 'in_progress') {
            setError('Please complete step verification and select a conclusive outcome (Pass, Fail, Blocked, or Skipped).');
            return;
        }

        if ((status === 'failed' || status === 'blocked') && !actualResult.trim()) {
            setError(`Please provide an actual result or observation explaining why the test ${status === 'failed' ? 'failed' : 'was blocked'}.`);
            return;
        }

        const elapsed = Math.max(100, Date.now() - startTime);
        const selectedEnv = environments.find(env => env.id === selectedEnvId);

        try {
            if (recordHandler) {
                await recordHandler({
                    status,
                    outcome: status,
                    actualResult: actualResult.trim() || 'Observed expected behavior across all verified test steps.',
                    notes: notes.trim(),
                    durationMs: elapsed,
                    stepOutcomes,
                    environment: selectedEnv || { name: 'Workspace Default' },
                    executedBy: user?.displayName || user?.name || user?.email || 'Tester',
                    screenshotData,
                    screenshotName,
                    artifact: screenshotData ? {
                        name: screenshotName || `${testCase.id}-manual-evidence.png`,
                        data: screenshotData,
                        mimeType: 'image/png',
                        artifactType: 'screenshot'
                    } : null
                });
            }
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to record execution outcome.');
        }
    };

    const preconditions = Array.isArray(testCase?.preconditions)
        ? testCase.preconditions.join(', ')
        : String(testCase?.preconditions || '');

    return createPortal(
        <div className="tc-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !isRecording) onClose(); }}>
            <section className="tc-form-dialog" role="dialog" aria-modal="true" aria-labelledby="tc-exec-title" style={{ maxWidth: '720px' }}>
                <header>
                    <div>
                        <span style={{ color: 'var(--tc-jade)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Manual Execution Workspace • {testCase.suiteName || 'Suite'}
                        </span>
                        <h2 id="tc-exec-title" style={{ margin: '4px 0 0 0', fontSize: '1.2rem', color: '#FFFFFF' }}>
                            Execute: {testCase.id}
                        </h2>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} disabled={isRecording}>
                        <X size={18} />
                    </button>
                </header>

                <form onSubmit={handleSubmit}>
                    {/* Test Case Context Header */}
                    <div style={{ background: '#101512', padding: '12px 14px', borderRadius: '5px', border: '1px solid #1B231E', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <strong style={{ color: '#FFFFFF', fontSize: '0.9rem' }}>{testCase.title}</strong>
                            <span className="tc-id" style={{ background: 'rgba(139, 175, 154, 0.15)', color: '#8BAF9A', border: '1px solid rgba(139, 175, 154, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                {testCase.id}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.74rem', color: '#A0A5A5' }}>
                            <span>Suite: <strong style={{ color: '#F2F3F3' }}>{testCase.suiteName || 'Default Suite'}</strong></span>
                            <span>Category: <strong style={{ color: '#F2F3F3' }}>{testCase.type || 'Functional'}</strong></span>
                            <span>Priority: <strong style={{ color: '#F2F3F3' }}>{testCase.priority || 'Medium'}</strong></span>
                            {testCase.requirementId && (
                                <span>Requirement: <strong style={{ color: '#8BAF9A' }}>{testCase.requirementId}</strong></span>
                            )}
                        </div>
                        {preconditions && (
                            <div style={{ fontSize: '0.73rem', color: '#A0A5A5', background: '#080A09', padding: '6px 10px', borderRadius: '4px', border: '1px solid #1A211D' }}>
                                <strong style={{ color: '#CBD5E1' }}>Preconditions:</strong> {preconditions}
                            </div>
                        )}
                        {testCase.expectedResult && (
                            <div style={{ fontSize: '0.73rem', color: '#8BAF9A', background: 'rgba(139, 175, 154, 0.08)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(139, 175, 154, 0.2)' }}>
                                <strong>Expected Overall Result:</strong> {testCase.expectedResult}
                            </div>
                        )}
                    </div>

                    {/* Execution Meta Bar (Environment & Tester) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 600, color: '#A0A5A5', marginBottom: '4px' }}>
                                <Globe size={13} color="#8BAF9A" />
                                <span>Execution Environment</span>
                            </label>
                            <select
                                className="tc-input"
                                style={{ width: '100%', height: '34px', fontSize: '0.8rem' }}
                                value={selectedEnvId}
                                onChange={e => setSelectedEnvId(e.target.value)}
                            >
                                <option value="">Default Staging Environment</option>
                                {environments.map(env => (
                                    <option key={env.id} value={env.id}>
                                        {env.name} ({env.baseUrl || 'Local'})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 600, color: '#A0A5A5', marginBottom: '4px' }}>
                                <User size={13} color="#8BAF9A" />
                                <span>Executed By</span>
                            </label>
                            <input
                                type="text"
                                className="tc-input"
                                style={{ width: '100%', height: '34px', fontSize: '0.8rem', background: '#080A09' }}
                                value={user?.displayName || user?.name || user?.email || 'Lead QA Engineer'}
                                readOnly
                            />
                        </div>
                    </div>

                    {/* Steps Checklist with 4 outcomes: Pass, Fail, Blocked, Not Run */}
                    {steps.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F2F3F3' }}>
                                    Verification Steps ({steps.length})
                                </span>
                                <span style={{ fontSize: '0.7rem', color: '#8BAF9A' }}>
                                    Each step requires recorded outcome
                                </span>
                            </div>
                            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                                {steps.map((st, idx) => {
                                    const currentStepOutcome = stepOutcomes[idx] || 'not_run';
                                    return (
                                        <div key={idx} style={{ background: '#111613', padding: '10px 12px', borderRadius: '4px', border: '1px solid #1E2521', fontSize: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ color: '#FFFFFF', fontWeight: 600 }}>
                                                        Step {idx + 1}: {typeof st === 'object' ? (st.action || st.description || '') : String(st)}
                                                    </div>
                                                    {st.expected && (
                                                        <div style={{ color: '#8BAF9A', marginTop: '4px', fontSize: '0.72rem' }}>
                                                            ↳ Expected: {typeof st === 'object' ? (st.expected || st.expectedResult || '') : ''}
                                                        </div>
                                                    )}
                                                    {st.testData && (
                                                        <div style={{ color: '#7A8580', fontFamily: 'ui-monospace, monospace', fontSize: '0.68rem', marginTop: '2px' }}>
                                                            Data: {st.testData}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Step-Level 4-Option Toggle */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                                    <button
                                                        type="button"
                                                        title="Pass step"
                                                        onClick={() => handleStepOutcomeChange(idx, 'passed')}
                                                        style={{
                                                            padding: '3px 7px', borderRadius: '3px', border: '1px solid',
                                                            borderColor: currentStepOutcome === 'passed' ? '#8BAF9A' : '#28332B',
                                                            background: currentStepOutcome === 'passed' ? 'rgba(139, 175, 154, 0.25)' : 'transparent',
                                                            color: currentStepOutcome === 'passed' ? '#8BAF9A' : '#7A8580',
                                                            cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600
                                                        }}
                                                    >
                                                        ✓ Pass
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Fail step"
                                                        onClick={() => handleStepOutcomeChange(idx, 'failed')}
                                                        style={{
                                                            padding: '3px 7px', borderRadius: '3px', border: '1px solid',
                                                            borderColor: currentStepOutcome === 'failed' ? '#E06C75' : '#28332B',
                                                            background: currentStepOutcome === 'failed' ? 'rgba(224, 108, 117, 0.25)' : 'transparent',
                                                            color: currentStepOutcome === 'failed' ? '#E06C75' : '#7A8580',
                                                            cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600
                                                        }}
                                                    >
                                                        ✕ Fail
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Block step"
                                                        onClick={() => handleStepOutcomeChange(idx, 'blocked')}
                                                        style={{
                                                            padding: '3px 7px', borderRadius: '3px', border: '1px solid',
                                                            borderColor: currentStepOutcome === 'blocked' ? '#E5C07B' : '#28332B',
                                                            background: currentStepOutcome === 'blocked' ? 'rgba(229, 192, 123, 0.25)' : 'transparent',
                                                            color: currentStepOutcome === 'blocked' ? '#E5C07B' : '#7A8580',
                                                            cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600
                                                        }}
                                                    >
                                                        ⚠ Block
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Not run yet"
                                                        onClick={() => handleStepOutcomeChange(idx, 'not_run')}
                                                        style={{
                                                            padding: '3px 7px', borderRadius: '3px', border: '1px solid',
                                                            borderColor: currentStepOutcome === 'not_run' ? '#6C7A71' : '#28332B',
                                                            background: currentStepOutcome === 'not_run' ? 'rgba(108, 122, 113, 0.2)' : 'transparent',
                                                            color: currentStepOutcome === 'not_run' ? '#CBD5E1' : '#556059',
                                                            cursor: 'pointer', fontSize: '0.68rem'
                                                        }}
                                                    >
                                                        ○ Not Run
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Overall Outcome Selector */}
                    <div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#A0A5A5', marginBottom: '6px' }}>
                            Computed Overall Outcome:
                        </div>
                        <div className="tc-form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            <button
                                type="button"
                                className={`tc-outcome-btn pass ${status === 'passed' ? 'selected' : ''}`}
                                onClick={() => setStatus('passed')}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 6px',
                                    background: status === 'passed' ? 'rgba(139, 175, 154, 0.22)' : '#101512',
                                    border: `1px solid ${status === 'passed' ? '#8BAF9A' : '#1E2521'}`,
                                    color: status === 'passed' ? '#8BAF9A' : '#7A8580',
                                    borderRadius: '4px', cursor: 'pointer'
                                }}
                            >
                                <CheckCircle2 size={16} />
                                <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>Pass</span>
                            </button>

                            <button
                                type="button"
                                className={`tc-outcome-btn fail ${status === 'failed' ? 'selected' : ''}`}
                                onClick={() => setStatus('failed')}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 6px',
                                    background: status === 'failed' ? 'rgba(224, 108, 117, 0.22)' : '#101512',
                                    border: `1px solid ${status === 'failed' ? '#E06C75' : '#1E2521'}`,
                                    color: status === 'failed' ? '#E06C75' : '#7A8580',
                                    borderRadius: '4px', cursor: 'pointer'
                                }}
                            >
                                <XCircle size={16} />
                                <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>Fail</span>
                            </button>

                            <button
                                type="button"
                                className={`tc-outcome-btn blocked ${status === 'blocked' ? 'selected' : ''}`}
                                onClick={() => setStatus('blocked')}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 6px',
                                    background: status === 'blocked' ? 'rgba(229, 192, 123, 0.22)' : '#101512',
                                    border: `1px solid ${status === 'blocked' ? '#E5C07B' : '#1E2521'}`,
                                    color: status === 'blocked' ? '#E5C07B' : '#7A8580',
                                    borderRadius: '4px', cursor: 'pointer'
                                }}
                            >
                                <AlertTriangle size={16} />
                                <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>Blocked</span>
                            </button>

                            <button
                                type="button"
                                className={`tc-outcome-btn skipped ${status === 'skipped' ? 'selected' : ''}`}
                                onClick={() => setStatus('skipped')}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 6px',
                                    background: status === 'skipped' ? 'rgba(198, 120, 221, 0.22)' : '#101512',
                                    border: `1px solid ${status === 'skipped' ? '#C678DD' : '#1E2521'}`,
                                    color: status === 'skipped' ? '#C678DD' : '#7A8580',
                                    borderRadius: '4px', cursor: 'pointer'
                                }}
                            >
                                <MinusCircle size={16} />
                                <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>Skipped</span>
                            </button>
                        </div>
                    </div>

                    {/* Actual Result & Notes */}
                    <div className="tc-form-grid">
                        <label className="wide">
                            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#A0A5A5', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <span>Actual Result & Observation</span>
                                {(status === 'failed' || status === 'blocked') && (
                                    <span style={{ color: '#E06C75' }}>* (Required on Fail/Block)</span>
                                )}
                            </span>
                            <textarea
                                value={actualResult}
                                onChange={e => setActualResult(e.target.value)}
                                rows={2}
                                className="tc-textarea"
                                placeholder={status === 'passed' ? 'e.g. All acceptance criteria and steps verified successfully.' : 'Describe actual observed behavior or deviation...'}
                                required={status === 'failed' || status === 'blocked'}
                            />
                        </label>

                        <label className="wide">
                            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#A0A5A5', display: 'block', marginBottom: '4px' }}>
                                Tester Notes & Execution Context
                            </span>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                className="tc-textarea"
                                placeholder="Optional context or environment notes..."
                            />
                        </label>

                        {/* Evidence Upload */}
                        <div className="wide" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #1E2521', padding: '6px 10px', borderRadius: '4px', background: '#111613', fontSize: '0.74rem', color: '#CBD5E1' }}>
                                <Camera size={14} color="#8BAF9A" />
                                <span>{screenshotName ? `Attached: ${screenshotName}` : 'Attach Evidence Screenshot'}</span>
                                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                            </label>
                            {screenshotName && (
                                <button
                                    type="button"
                                    onClick={() => { setScreenshotData(null); setScreenshotName(''); }}
                                    style={{ background: 'transparent', border: 0, color: '#E06C75', fontSize: '0.7rem', cursor: 'pointer' }}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div style={{ background: 'rgba(224, 108, 117, 0.12)', border: '1px solid rgba(224, 108, 117, 0.35)', color: '#E06C75', padding: '8px 12px', borderRadius: '4px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }} role="alert">
                            <AlertCircle size={15} />
                            <span>{error}</span>
                        </div>
                    )}

                    <footer>
                        <button type="button" className="tc-secondary" onClick={onClose} disabled={isRecording}>
                            Cancel
                        </button>
                        <button type="submit" className="tc-primary" disabled={isRecording}>
                            <CheckCircle2 size={14} />
                            <span>{isRecording ? 'Recording Execution…' : 'Record Execution Outcome'}</span>
                        </button>
                    </footer>
                </form>
            </section>
        </div>,
        document.body
    );
};

export default ManualExecutionModal;
