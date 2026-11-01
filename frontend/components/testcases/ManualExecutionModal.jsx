import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, XCircle, AlertTriangle, MinusCircle, Clock, Upload, Camera, ExternalLink } from 'lucide-react';

const ManualExecutionModal = ({
    isOpen = true,
    onClose,
    testCase,
    onRecord,
    onSave,
    isRecording = false
}) => {
    const recordHandler = onRecord || onSave;
    const [status, setStatus] = useState('passed');
    const [actualResult, setActualResult] = useState('');
    const [notes, setNotes] = useState('');
    const [durationMs, setDurationMs] = useState(1200);
    const [screenshotData, setScreenshotData] = useState(null);
    const [screenshotName, setScreenshotName] = useState('');
    const [error, setError] = useState('');
    const [startTime] = useState(Date.now());

    useEffect(() => {
        if (!isOpen) return;
        setStatus('passed');
        setActualResult('');
        setNotes('');
        setScreenshotData(null);
        setScreenshotName('');
        setError('');
    }, [isOpen]);

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

        if ((status === 'failed' || status === 'blocked') && !actualResult.trim()) {
            setError(`Please provide an actual result or observation explaining why the test ${status === 'failed' ? 'failed' : 'was blocked'}.`);
            return;
        }

        const elapsed = Math.max(100, Date.now() - startTime);

        try {
            if (recordHandler) {
                await recordHandler({
                    status,
                    outcome: status,
                    actualResult: actualResult.trim() || 'Observed expected behavior across all verified test steps.',
                    notes: notes.trim(),
                    durationMs: elapsed,
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

    const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
    const preconditions = Array.isArray(testCase.preconditions)
        ? testCase.preconditions.join(', ')
        : String(testCase.preconditions || '');

    return createPortal(
        <div className="tc-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <section className="tc-form-dialog" role="dialog" aria-modal="true" aria-labelledby="tc-exec-title" style={{ maxWidth: '680px' }}>
                <header>
                    <div>
                        <span>Manual Execution Station · {testCase.suiteName || 'Test Suite'}</span>
                        <h2 id="tc-exec-title">Execute: {testCase.id}</h2>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} disabled={isRecording}>
                        <X size={16} />
                    </button>
                </header>

                <form onSubmit={handleSubmit}>
                    <div style={{ background: 'var(--tc-surface)', padding: '12px 14px', borderRadius: '5px', border: '1px solid var(--tc-line)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                            <strong style={{ color: '#FFFFFF', fontSize: '0.85rem' }}>{testCase.title}</strong>
                            <span className="tc-id">{testCase.id}</span>
                        </div>
                        {preconditions && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--tc-muted)', marginTop: '4px' }}>
                                <strong>Preconditions:</strong> {preconditions}
                            </div>
                        )}
                    </div>

                    {/* Steps Checklist */}
                    {steps.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--tc-text)' }}>
                                Verification Steps ({steps.length})
                            </span>
                            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                                {steps.map((st, idx) => (
                                    <div key={idx} style={{ background: '#131815', padding: '8px 10px', borderRadius: '4px', border: '1px solid #1E2521', fontSize: '0.72rem' }}>
                                        <div style={{ color: '#FFFFFF', fontWeight: 500 }}>
                                            Step {idx + 1}: {typeof st === 'object' ? (st.action || st.description || '') : String(st)}
                                        </div>
                                        {st.expected && (
                                            <div style={{ color: 'var(--tc-jade)', marginTop: '3px' }}>
                                                ↳ Expected: {typeof st === 'object' ? (st.expected || st.expectedResult || '') : ''}
                                            </div>
                                        )}
                                        {st.testData && (
                                            <div style={{ color: 'var(--tc-muted)', fontFamily: 'ui-monospace, monospace', fontSize: '0.68rem', marginTop: '2px' }}>
                                                Data: {st.testData}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Outcome Button Group */}
                    <div className="tc-form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        <button
                            type="button"
                            className={`tc-outcome-btn pass ${status === 'passed' ? 'selected' : ''}`}
                            onClick={() => setStatus('passed')}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 6px',
                                background: status === 'passed' ? 'rgba(139, 175, 154, 0.18)' : '#151A17',
                                border: `1px solid ${status === 'passed' ? 'var(--tc-jade)' : 'var(--tc-line)'}`,
                                color: status === 'passed' ? 'var(--tc-jade)' : 'var(--tc-muted)',
                                borderRadius: '4px', cursor: 'pointer'
                            }}
                        >
                            <CheckCircle2 size={16} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Pass</span>
                        </button>

                        <button
                            type="button"
                            className={`tc-outcome-btn fail ${status === 'failed' ? 'selected' : ''}`}
                            onClick={() => setStatus('failed')}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 6px',
                                background: status === 'failed' ? 'rgba(224, 108, 117, 0.18)' : '#151A17',
                                border: `1px solid ${status === 'failed' ? 'var(--tc-fail)' : 'var(--tc-line)'}`,
                                color: status === 'failed' ? 'var(--tc-fail)' : 'var(--tc-muted)',
                                borderRadius: '4px', cursor: 'pointer'
                            }}
                        >
                            <XCircle size={16} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Fail</span>
                        </button>

                        <button
                            type="button"
                            className={`tc-outcome-btn blocked ${status === 'blocked' ? 'selected' : ''}`}
                            onClick={() => setStatus('blocked')}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 6px',
                                background: status === 'blocked' ? 'rgba(229, 192, 123, 0.18)' : '#151A17',
                                border: `1px solid ${status === 'blocked' ? 'var(--tc-warn)' : 'var(--tc-line)'}`,
                                color: status === 'blocked' ? 'var(--tc-warn)' : 'var(--tc-muted)',
                                borderRadius: '4px', cursor: 'pointer'
                            }}
                        >
                            <AlertTriangle size={16} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Blocked</span>
                        </button>

                        <button
                            type="button"
                            className={`tc-outcome-btn skipped ${status === 'skipped' ? 'selected' : ''}`}
                            onClick={() => setStatus('skipped')}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 6px',
                                background: status === 'skipped' ? 'rgba(198, 120, 221, 0.18)' : '#151A17',
                                border: `1px solid ${status === 'skipped' ? 'var(--tc-purple)' : 'var(--tc-line)'}`,
                                color: status === 'skipped' ? 'var(--tc-purple)' : 'var(--tc-muted)',
                                borderRadius: '4px', cursor: 'pointer'
                            }}
                        >
                            <MinusCircle size={16} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Skipped</span>
                        </button>
                    </div>

                    <div className="tc-form-grid">
                        <label className="wide">
                            Actual Result & Observed Behavior {status === 'failed' || status === 'blocked' ? '*' : ''}
                            <textarea
                                value={actualResult}
                                onChange={e => setActualResult(e.target.value)}
                                rows={2}
                                placeholder={status === 'passed' ? 'e.g. All acceptance criteria verified successfully.' : 'Describe actual behavior or assertion difference...'}
                                required={status === 'failed' || status === 'blocked'}
                            />
                        </label>

                        <label className="wide">
                            Execution Observations & Tester Notes
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Optional context or environment notes..."
                            />
                        </label>

                        <div className="wide" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid var(--tc-line)', padding: '6px 10px', borderRadius: '4px', background: '#151A17', fontSize: '0.72rem' }}>
                                <Camera size={13} color="var(--tc-jade)" />
                                <span>{screenshotName ? `Attached: ${screenshotName}` : 'Attach Evidence Screenshot'}</span>
                                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                            </label>
                            {screenshotName && (
                                <button
                                    type="button"
                                    onClick={() => { setScreenshotData(null); setScreenshotName(''); }}
                                    style={{ background: 'transparent', border: 0, color: 'var(--tc-muted)', fontSize: '0.68rem', cursor: 'pointer' }}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>

                    {error && <div className="tc-form-error" role="alert">{error}</div>}

                    <footer>
                        <button type="button" onClick={onClose} disabled={isRecording}>
                            Cancel
                        </button>
                        <button type="submit" className="tc-primary" disabled={isRecording}>
                            <CheckCircle2 size={14} />
                            {isRecording ? 'Recording…' : 'Record Execution Outcome'}
                        </button>
                    </footer>
                </form>
            </section>
        </div>,
        document.body
    );
};

export default ManualExecutionModal;

