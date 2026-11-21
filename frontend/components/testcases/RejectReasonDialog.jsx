import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle } from 'lucide-react';

export const RejectReasonDialog = ({ isOpen, onClose, onConfirm, testCase }) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setReason('');
            setError('');
            setIsSubmitting(false);
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !testCase) return null;

    const handleSubmit = async (e) => {
        e?.preventDefault();
        const trimmed = reason.trim();
        if (trimmed.length < 5) {
            setError('Please provide a specific rejection reason (at least 5 characters).');
            return;
        }
        if (trimmed.length > 500) {
            setError('Reason must not exceed 500 characters.');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            await onConfirm(trimmed);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to reject test case.');
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
                className="tn-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reject-dialog-title"
            >
                <div className="tn-dialog__header">
                    <div>
                        <div className="tn-eyebrow">Review Decision</div>
                        <h3 id="reject-dialog-title">Reject Test Case</h3>
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

                <form onSubmit={handleSubmit}>
                    <div className="tn-dialog__body">
                        <p className="tn-dialog-desc">
                            You are rejecting <strong>{testCase.id}</strong> ({testCase.title}).
                            Rejected cases are excluded from production exports and CI pipelines.
                        </p>

                        <div className="tn-form-group">
                            <label htmlFor="reject-reason-input">
                                <span>Rejection Reason <span className="tn-required">*</span></span>
                                <span className="tn-char-counter">{reason.length}/500</span>
                            </label>
                            <textarea
                                id="reject-reason-input"
                                ref={textareaRef}
                                rows={4}
                                required
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value);
                                    if (error) setError('');
                                }}
                                placeholder="Explain what is missing, inaccurate, or why this scenario should not run..."
                                maxLength={500}
                                disabled={isSubmitting}
                            />
                        </div>

                        {error && (
                            <div className="tn-form-alert" role="alert">
                                <AlertCircle size={14} />
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
                            type="submit"
                            className="tn-app-btn tn-app-btn--primary"
                            disabled={isSubmitting || reason.trim().length < 5}
                        >
                            {isSubmitting ? 'Rejecting…' : 'Reject Case'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default RejectReasonDialog;
