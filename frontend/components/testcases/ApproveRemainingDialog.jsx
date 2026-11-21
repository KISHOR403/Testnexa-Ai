import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, AlertTriangle, AlertCircle } from 'lucide-react';

export const ApproveRemainingDialog = ({
    isOpen,
    onClose,
    onConfirm,
    pendingCases = [],
    rejectedCount = 0,
    totalCount = 0
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [conflictState, setConflictState] = useState(null); // { newCount }
    const [error, setError] = useState('');

    const count = conflictState ? conflictState.newCount : pendingCases.length;
    const previewCases = pendingCases.slice(0, 5);

    useEffect(() => {
        if (isOpen) {
            setIsSubmitting(false);
            setConflictState(null);
            setError('');
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape' && !isSubmitting) {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen) return null;

    const handleExecute = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const expectedCount = conflictState ? conflictState.newCount : pendingCases.length;
            const caseIds = pendingCases.map(c => c.id || c.testCaseId);
            await onConfirm({ caseIds, expectedCount });
            onClose();
        } catch (err) {
            if (err.status === 409 || err.code === 'PENDING_COUNT_MISMATCH') {
                const currentPendingCount = err.data?.currentPendingCount ?? err.data?.pendingCount;
                setConflictState({
                    newCount: typeof currentPendingCount === 'number' ? currentPendingCount : count
                });
                setError(`The pending count changed while you were reviewing. Please confirm approving ${currentPendingCount ?? 'the latest'} cases.`);
            } else {
                setError(err.message || 'Failed to approve remaining test cases.');
            }
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div
            className="tn-dialog-backdrop"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !isSubmitting) onClose();
            }}
        >
            <div
                className="tn-dialog tn-dialog--approve-remaining"
                role="dialog"
                aria-modal="true"
                aria-labelledby="approve-remaining-title"
            >
                <div className="tn-dialog__header">
                    <div>
                        <div className="tn-eyebrow">Batch Review Verification</div>
                        <h3 id="approve-remaining-title">Approve Remaining Test Cases</h3>
                    </div>
                    <button
                        type="button"
                        className="tn-btn-icon"
                        onClick={onClose}
                        disabled={isSubmitting}
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="tn-dialog__body">
                    <p className="tn-dialog-desc">
                        You are certifying that an authorized reviewer has inspected and verified all remaining{' '}
                        <strong>{count} pending {count === 1 ? 'case' : 'cases'}</strong> in this suite.
                    </p>

                    {rejectedCount > 0 && (
                        <div className="tn-notice-callout">
                            <AlertCircle size={14} />
                            <span>
                                <strong>{rejectedCount} rejected {rejectedCount === 1 ? 'case is' : 'cases are'} excluded</strong> and will remain unchanged.
                            </span>
                        </div>
                    )}

                    {previewCases.length > 0 && !conflictState && (
                        <div className="tn-pending-preview-list">
                            <div className="tn-pending-preview-head">
                                <span>First {Math.min(5, count)} cases to be approved:</span>
                            </div>
                            <ul>
                                {previewCases.map((tc) => (
                                    <li key={tc.id || tc.testCaseId}>
                                        <code>{tc.id || tc.testCaseId}</code>
                                        <span className="tn-pending-title-text">{tc.title}</span>
                                    </li>
                                ))}
                            </ul>
                            {count > 5 && (
                                <div className="tn-pending-more-indicator">
                                    + {count - 5} more pending test {count - 5 === 1 ? 'case' : 'cases'}
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className={`tn-form-alert ${conflictState ? 'tn-form-alert--conflict' : ''}`} role="alert">
                            {conflictState ? <AlertTriangle size={15} /> : <AlertCircle size={15} />}
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="tn-dialog__footer">
                    <button
                        type="button"
                        className="tn-app-btn tn-app-btn--secondary"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="tn-app-btn tn-app-btn--primary"
                        onClick={handleExecute}
                        disabled={isSubmitting || count <= 0}
                    >
                        <Check size={14} />
                        <span>
                            {isSubmitting
                                ? 'Approving…'
                                : conflictState
                                ? `Confirm approving ${count} cases`
                                : `Approve ${count} ${count === 1 ? 'case' : 'cases'}`}
                        </span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ApproveRemainingDialog;
