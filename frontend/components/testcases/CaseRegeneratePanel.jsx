import React, { useState, useRef, useEffect } from 'react';
import {
    X, Sparkles, RefreshCw, AlertTriangle, AlertCircle, Check,
    Clock, ShieldAlert, ArrowRight
} from 'lucide-react';
import { caseReviewService } from '../../services/caseReviewService';

const EXAMPLE_INSTRUCTIONS = [
    'Add a negative variant',
    'Shorten steps',
    'More specific expected results',
    'Add boundary limit checks'
];

export const CaseRegeneratePanel = ({
    testCase,
    onApplySuccess,
    onClose
}) => {
    const [instruction, setInstruction] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null); // in-memory only
    const [error, setError] = useState(null); // { type, message, retryAfter }
    const [isApplying, setIsApplying] = useState(false);
    const abortControllerRef = useRef(null);

    // Unapplied preview confirmation on close
    const handleSafeClose = () => {
        if (previewData) {
            if (!window.confirm('You have an unapplied regeneration preview in memory. Discard it?')) {
                return;
            }
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        onClose();
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleSafeClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [previewData]);

    const handleGeneratePreview = async (instOverride = null) => {
        const targetInstruction = instOverride !== null ? instOverride : instruction;
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setError(null);

        try {
            const res = await caseReviewService.previewRegenerate(
                testCase.id,
                { instruction: targetInstruction.slice(0, 200) },
                controller.signal
            );
            setPreviewData(res.data || res);
        } catch (err) {
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                setError({ type: 'aborted', message: 'Regeneration was cancelled.' });
            } else if (err.status === 429) {
                const retryAfter = err.data?.retryAfter || err.headers?.get('retry-after') || 60;
                setError({
                    type: 'rate_limit',
                    message: `Rate limit reached. Please wait ${retryAfter}s before regenerating again.`,
                    retryAfter
                });
            } else if (err.status === 408 || err.message?.includes('timeout')) {
                setError({
                    type: 'timeout',
                    message: 'AI request timed out after 30 seconds. Please retry with a shorter instruction.'
                });
            } else {
                setError({
                    type: 'general',
                    message: err.message || 'Failed to generate preview proposal.'
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsLoading(false);
    };

    const handleApplyProposal = async () => {
        if (!previewData?.proposal) return;
        setIsApplying(true);
        setError(null);

        try {
            const idempotencyKey = `apply_${testCase.id}_v${testCase.version}_${Date.now()}`;
            const res = await caseReviewService.applyRegenerate(
                testCase.id,
                {
                    version: testCase.version,
                    proposal: previewData.proposal
                },
                idempotencyKey
            );
            if (onApplySuccess) {
                onApplySuccess(res.data || res);
            }
            onClose();
        } catch (err) {
            if (err.status === 409 || err.code === 'CASE_CHANGED') {
                setError({
                    type: 'conflict',
                    message: 'This test case changed version while previewing. Review latest version before regenerating.'
                });
            } else {
                setError({
                    type: 'apply_failed',
                    message: err.message || 'Failed to apply proposed test case.'
                });
            }
        } finally {
            setIsApplying(false);
        }
    };

    const isApproved = String(testCase.approval_status || testCase.status || '').toLowerCase() === 'approved';

    return (
        <div className="tn-regenerate-panel">
            {/* Header */}
            <div className="tn-regenerate-panel__header">
                <div className="tn-regenerate-panel__title-block">
                    <div className="tn-eyebrow">AI Case Regeneration</div>
                    <h3>Regenerate & Enhance — {testCase.id}</h3>
                </div>
                <button
                    type="button"
                    className="tn-btn-icon"
                    onClick={handleSafeClose}
                    aria-label="Close"
                    title="Close"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="tn-regenerate-panel__body">
                {/* 1. Instruction Input & Examples */}
                {!previewData && (
                    <div className="tn-regenerate-form">
                        <p className="tn-panel-intro">
                            Grounded regeneration synthesizes improved steps and assertions while strictly preserving
                            case key <code>{testCase.id}</code> and linked requirements.
                        </p>

                        <div className="tn-form-group">
                            <div className="tn-form-label-row">
                                <label htmlFor="regen-instruction-input">Optional Focus Instruction</label>
                                <span className="tn-char-counter">{instruction.length}/200</span>
                            </div>
                            <input
                                id="regen-instruction-input"
                                type="text"
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value.slice(0, 200))}
                                placeholder="e.g. Add validation for expired token error message"
                                maxLength={200}
                                disabled={isLoading}
                            />
                        </div>

                        <div className="tn-example-chips-group">
                            <span className="tn-sublabel">Quick suggestions:</span>
                            <div className="tn-example-chips">
                                {EXAMPLE_INSTRUCTIONS.map((ex) => (
                                    <button
                                        key={ex}
                                        type="button"
                                        className="tn-example-chip"
                                        onClick={() => {
                                            setInstruction(ex);
                                            handleGeneratePreview(ex);
                                        }}
                                        disabled={isLoading}
                                    >
                                        <span>{ex}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Error state */}
                        {error && (
                            <div className="tn-form-alert" role="alert">
                                <AlertCircle size={15} />
                                <div>
                                    <strong>{error.type === 'rate_limit' ? 'Rate Limit Exceeded' : error.type === 'timeout' ? 'Request Timeout' : 'Error'}</strong>
                                    <p>{error.message}</p>
                                </div>
                            </div>
                        )}

                        <div className="tn-regenerate-actions">
                            {isLoading ? (
                                <button
                                    type="button"
                                    className="tn-app-btn tn-app-btn--secondary"
                                    onClick={handleCancelGeneration}
                                >
                                    Cancel AI Generation
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="tn-app-btn tn-app-btn--primary"
                                    onClick={() => handleGeneratePreview()}
                                >
                                    <Sparkles size={14} />
                                    <span>Generate Preview</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. Side-by-Side Diff Preview (In-Memory Only) */}
                {previewData && (
                    <div className="tn-preview-diff-container">
                        {/* Similarity Warning (if similarTo >= 0.8) */}
                        {previewData.similarTo && (
                            <div className="tn-similarity-warning" role="alert">
                                <ShieldAlert size={16} />
                                <div>
                                    <strong>High Scenario Similarity Flag:</strong>
                                    <span> The proposed title closely resembles sibling test case <code>{previewData.similarTo}</code> (Jaccard score &ge; 0.8).</span>
                                </div>
                            </div>
                        )}

                        {isApproved && (
                            <div className="tn-approval-reset-warning" style={{ margin: '8px 0 16px' }}>
                                <AlertCircle size={14} />
                                <span>Replacing this case will advance to version {Number(testCase.version || 1) + 1} and reset approval to <strong>Pending</strong>.</span>
                            </div>
                        )}

                        <div className="tn-diff-head">
                            <span className="tn-eyebrow">Diff Inspection</span>
                            <h4>Current Version vs AI Proposal</h4>
                        </div>

                        <div className="tn-side-diff-grid">
                            {/* Title Diff */}
                            <div className="tn-diff-row">
                                <div className="tn-diff-label">Title</div>
                                <div className="tn-diff-columns">
                                    <div className="tn-diff-box tn-diff-box--current">
                                        <span className="tn-diff-tag">[Current]</span>
                                        <p>{testCase.title}</p>
                                    </div>
                                    <div className="tn-diff-box tn-diff-box--proposed">
                                        <span className="tn-diff-tag">[Proposed]</span>
                                        <p className="tn-text-added">
                                            <span className="tn-diff-semantic-label">[Added] </span>
                                            {previewData.proposal?.title}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Type & Priority Diff */}
                            <div className="tn-diff-row">
                                <div className="tn-diff-label">Type & Priority</div>
                                <div className="tn-diff-columns">
                                    <div className="tn-diff-box tn-diff-box--current">
                                        <span className="tn-diff-tag">[Current]</span>
                                        <p>{testCase.type} · {testCase.priority}</p>
                                    </div>
                                    <div className="tn-diff-box tn-diff-box--proposed">
                                        <span className="tn-diff-tag">[Proposed]</span>
                                        <p className="tn-text-added">
                                            <span className="tn-diff-semantic-label">[Added] </span>
                                            {previewData.proposal?.type} · {previewData.proposal?.priority}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Steps Diff */}
                            <div className="tn-diff-row">
                                <div className="tn-diff-label">Test Steps</div>
                                <div className="tn-diff-columns">
                                    <div className="tn-diff-box tn-diff-box--current">
                                        <span className="tn-diff-tag">[Current Steps ({testCase.steps?.length || 0})]</span>
                                        <ol className="tn-steps-preview-list">
                                            {(testCase.steps || []).map((s, i) => (
                                                <li key={i}>
                                                    <span>{typeof s === 'object' ? s.action : s}</span>
                                                    {s.expected && <small> &rarr; {s.expected}</small>}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                    <div className="tn-diff-box tn-diff-box--proposed">
                                        <span className="tn-diff-tag">[Proposed Steps ({previewData.proposal?.steps?.length || 0})]</span>
                                        <ol className="tn-steps-preview-list">
                                            {(previewData.proposal?.steps || []).map((s, i) => (
                                                <li key={i} className="tn-text-added">
                                                    <span>{s.action}</span>
                                                    {s.expected && <small> &rarr; {s.expected}</small>}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            {/* Expected Result Diff */}
                            <div className="tn-diff-row">
                                <div className="tn-diff-label">Expected Result</div>
                                <div className="tn-diff-columns">
                                    <div className="tn-diff-box tn-diff-box--current">
                                        <span className="tn-diff-tag">[Current]</span>
                                        <p>{testCase.expectedResult || 'System behaves strictly as defined in specification.'}</p>
                                    </div>
                                    <div className="tn-diff-box tn-diff-box--proposed">
                                        <span className="tn-diff-tag">[Proposed]</span>
                                        <p className="tn-text-added">
                                            <span className="tn-diff-semantic-label">[Added] </span>
                                            {previewData.proposal?.expectedResult}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="tn-form-alert" role="alert" style={{ marginTop: 14 }}>
                                <AlertCircle size={15} />
                                <span>{error.message}</span>
                            </div>
                        )}

                        {/* Proposal Decision Buttons */}
                        <div className="tn-diff-decision-bar">
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--secondary"
                                onClick={() => setPreviewData(null)}
                                disabled={isApplying}
                            >
                                Discard Proposal
                            </button>
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--primary"
                                onClick={handleApplyProposal}
                                disabled={isApplying}
                            >
                                <Check size={14} />
                                <span>{isApplying ? 'Applying…' : 'Replace current version'}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CaseRegeneratePanel;
