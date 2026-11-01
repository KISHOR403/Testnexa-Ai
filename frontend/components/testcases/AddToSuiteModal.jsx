import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FilePlus2, Layers } from 'lucide-react';

const AddToSuiteModal = ({
    isOpen,
    onClose,
    testCase,
    suites = [],
    onAdd,
    isSaving = false
}) => {
    const [targetSuiteId, setTargetSuiteId] = useState('');
    const [error, setError] = useState('');

    if (!isOpen || !testCase) return null;

    const availableSuites = suites.filter(s => String(s.id) !== String(testCase.suiteId));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!targetSuiteId) {
            setError('Please select a target test suite.');
            return;
        }

        try {
            await onAdd(targetSuiteId);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to add test case to the target suite.');
        }
    };

    return createPortal(
        <div className="tc-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !isSaving) onClose(); }}>
            <section className="tc-confirm-dialog tc-suite-copy-dialog" role="dialog" aria-modal="true" aria-labelledby="tc-copy-title">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h2 id="tc-copy-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <FilePlus2 size={16} color="var(--tc-jade)" />
                        <span>Add Test Case to Another Suite</span>
                    </h2>
                    <button type="button" onClick={onClose} disabled={isSaving} style={{ background: 'transparent', border: 0, color: 'var(--tc-muted)', cursor: 'pointer' }}>
                        <X size={15} />
                    </button>
                </div>

                <p style={{ margin: '0 0 12px', fontSize: '0.74rem', color: 'var(--tc-muted)' }}>
                    A linked copy of <strong>{testCase.id}</strong> (<em>{testCase.title}</em>) will be added to the chosen suite as a Draft test case. The original record remains in <strong>{testCase.suiteName}</strong>.
                </p>

                <form onSubmit={handleSubmit}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.72rem', color: 'var(--tc-text)' }}>
                        Target Test Suite *
                        <select
                            value={targetSuiteId}
                            onChange={e => setTargetSuiteId(e.target.value)}
                            required
                            style={{ height: '36px', background: '#151A17', border: '1px solid var(--tc-line)', borderRadius: '4px', padding: '0 8px', color: '#FFFFFF', fontSize: '0.75rem' }}
                        >
                            <option value="">Select a target suite...</option>
                            {availableSuites.map(suite => (
                                <option key={suite.id} value={suite.id}>
                                    {suite.name} ({suite.context ? suite.context.toUpperCase() + ' · ' : ''}{suite.caseCount ?? 0} cases)
                                </option>
                            ))}
                        </select>
                    </label>

                    {error && <div className="tc-form-error" role="alert" style={{ marginTop: '8px' }}>{error}</div>}

                    <footer style={{ marginTop: '16px' }}>
                        <button type="button" onClick={onClose} disabled={isSaving}>
                            Cancel
                        </button>
                        <button type="submit" className="tc-primary" disabled={isSaving || !targetSuiteId}>
                            {isSaving ? 'Adding…' : 'Add to Suite'}
                        </button>
                    </footer>
                </form>
            </section>
        </div>,
        document.body
    );
};

export default AddToSuiteModal;

