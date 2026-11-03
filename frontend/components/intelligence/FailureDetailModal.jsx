import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, ExternalLink, AlertTriangle, Layers, Calendar, Monitor, Globe } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const FailureDetailModal = ({
    isOpen,
    signature,
    onClose
}) => {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !signature) return null;

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatDate = (d) => {
        if (!d) return 'N/A';
        return new Date(d).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getClassificationBadge = (cls) => {
        switch (cls) {
            case 'new_failure':
                return <span className="fta-class-badge fta-class-new">New Failure</span>;
            case 'recurring':
                return <span className="fta-class-badge fta-class-recurring">Recurring Failure</span>;
            case 'resolved':
                return <span className="fta-class-badge fta-class-resolved">Resolved Failure</span>;
            case 'still_failing':
                return <span className="fta-class-badge fta-class-still-failing">Still Failing</span>;
            default:
                return <span className="fta-class-badge fta-class-insufficient">Insufficient History</span>;
        }
    };

    return createPortal(
        <div
            className="fta-modal-backdrop"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="fta-modal" role="dialog" aria-modal="true" aria-labelledby="fta-modal-title">
                {/* Header */}
                <div className="fta-modal-header">
                    <div>
                        <div className="fta-modal-title-row">
                            <span className={`fta-type-pill fta-type-${signature.errorType}`}>
                                {signature.errorType}
                            </span>
                            {getClassificationBadge(signature.classification)}
                            <span style={{ fontSize: '0.75rem', color: 'var(--fta-text-subtle)' }}>
                                {signature.signatureId}
                            </span>
                        </div>
                        <h2 className="fta-modal-title" id="fta-modal-title">
                            {signature.normalizedMessage}
                        </h2>
                    </div>

                    <button
                        type="button"
                        className="fta-modal-close-btn"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="fta-modal-body">
                    {/* Classification Rationale */}
                    {signature.classificationReason && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            background: 'var(--fta-surface-raised)',
                            border: '1px solid var(--fta-border)',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'var(--fta-text-muted)'
                        }}>
                            <AlertTriangle size={15} color="var(--fta-jade)" />
                            <span><strong>Classification Diagnostic:</strong> {signature.classificationReason}</span>
                        </div>
                    )}

                    {/* Raw Error Message */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <div className="fta-section-title">Full Error Message</div>
                            <button
                                type="button"
                                className="fta-btn"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                onClick={() => handleCopy(signature.sampleRawMessage)}
                            >
                                {copied ? <Check size={12} color="var(--fta-pass)" /> : <Copy size={12} />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                        </div>
                        <div className="fta-code-box">
                            {signature.sampleRawMessage}
                        </div>
                    </div>

                    {/* Stack Trace */}
                    {signature.sampleStackTrace && (
                        <div>
                            <div className="fta-section-title">Relevant Stack Trace</div>
                            <div className="fta-code-box" style={{ color: '#E57373', maxHeight: '160px' }}>
                                {signature.sampleStackTrace}
                            </div>
                        </div>
                    )}

                    {/* Affected Test Cases */}
                    <div>
                        <div className="fta-section-title">
                            Affected Test Cases ({signature.affectedCases?.length || 0})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {(signature.affectedCases || []).map((tc, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        background: 'var(--fta-surface)',
                                        border: '1px solid var(--fta-border)',
                                        borderRadius: '5px',
                                        padding: '0.5rem 0.75rem',
                                        fontSize: '0.78rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <strong style={{ color: 'var(--fta-jade)' }}>{tc.testCaseId}</strong>
                                    <span style={{ color: 'var(--fta-text-muted)' }}>{tc.title}</span>
                                    <span style={{
                                        background: 'var(--fta-fail-bg)',
                                        color: 'var(--fta-fail)',
                                        padding: '0.1rem 0.35rem',
                                        borderRadius: '3px',
                                        fontSize: '0.7rem',
                                        fontWeight: 600
                                    }}>
                                        {tc.failureCount}x
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Historical Occurrences Timeline */}
                    <div>
                        <div className="fta-section-title">
                            Historical Occurrences ({signature.occurrencesCount})
                        </div>
                        <div className="fta-timeline">
                            {(signature.recentOccurrences || []).map((occ, idx) => (
                                <div key={idx} className="fta-timeline-item">
                                    <div className="fta-timeline-left">
                                        <span className={`fta-status-dot ${occ.status}`} />
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--fta-text)', fontSize: '0.8rem' }}>
                                                {occ.runName || `Run #${occ.runId?.slice(-6)}`}
                                            </div>
                                            <div className="fta-timeline-meta">
                                                {formatDate(occ.executedAt)} · {occ.durationMs || 0}ms · {occ.browser} · {occ.environment}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--fta-text-subtle)' }}>
                                            Case: <strong style={{ color: 'var(--fta-text-muted)' }}>{occ.testCaseId}</strong>
                                        </span>
                                        <NavLink
                                            to={`/app/runs/${occ.runId}?tab=report`}
                                            className="fta-link"
                                            title="View detailed execution report"
                                        >
                                            <span>Run Report</span>
                                            <ExternalLink size={12} />
                                        </NavLink>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
export default FailureDetailModal;
