import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import TestSignalIndicator from './TestSignalIndicator';

/**
 * Meaningful generation workflow stages as defined by TestNexa AI specifications.
 */
const DEFAULT_STAGES = [
    { id: 'req', label: 'Analyzing requirements', tag: '01' },
    { id: 'scenarios', label: 'Identifying test scenarios', tag: '02' },
    { id: 'edge', label: 'Evaluating edge cases', tag: '03' },
    { id: 'coverage', label: 'Mapping requirement coverage', tag: '04' },
    { id: 'suite', label: 'Preparing the test suite', tag: '05' }
];

/**
 * AiGenerationLoader
 * 
 * Experience C: AI Test Generation Loading Experience
 * 
 * Designed specifically for the AI test generation workflow.
 * Features the signature "Test Signal" motif, honest indeterminate status
 * when streaming events are unconfirmed, optional verified stage updates,
 * real specification telemetry, clean cancellation, error states, and retry logic.
 */
export const AiGenerationLoader = ({
    requirement = '',
    title = '',
    settings = {},
    activeStageIndex = null, // null if indeterminate / no backend confirmation
    confirmedStages = [],    // array of stage IDs confirmed completed by backend
    error = null,
    onRetry = null,
    onCancel = null,
    className = ''
}) => {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Track elapsed time for honest user feedback
    useEffect(() => {
        if (error) return;
        const interval = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [error]);

    const displayTitle = title || (requirement ? requirement.slice(0, 48) + (requirement.length > 48 ? '...' : '') : 'Software Requirement');
    const targetType = (settings.type || 'Web').toUpperCase();
    const depthLevel = settings.level || 'Standard';
    const charCount = requirement ? requirement.trim().length : 0;

    // Has backend confirmed stages? If not, we remain strictly honest and indeterminate.
    const hasConfirmedStages = Array.isArray(confirmedStages) && confirmedStages.length > 0;

    // ─── ERROR STATE WITH RETRY ───
    if (error) {
        return (
            <div
                className={`tn-ai-gen-error-card ${className}`.trim()}
                role="alert"
                aria-live="assertive"
            >
                <div className="tn-ai-gen-error-header">
                    <AlertTriangle className="tn-ai-gen-error-icon" />
                    <div className="tn-ai-gen-error-content">
                        <h3 className="tn-ai-gen-error-title">
                            Test Suite Generation Interrupted
                        </h3>
                        <p className="tn-ai-gen-error-msg">
                            {error}
                        </p>
                    </div>
                </div>

                <div className="tn-ai-gen-error-actions">
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="tn-ai-gen-btn-retry"
                        >
                            <RefreshCw size={14} />
                            <span>Retry Generation</span>
                        </button>
                    )}
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="tn-ai-gen-btn-dismiss"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`tn-ai-gen-loader ${className}`.trim()}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            {/* Header: Test Signal Motif + Context */}
            <div className="tn-ai-gen-header">
                <TestSignalIndicator
                    size="md"
                    showWaveform={true}
                    ariaLabel="AI test synthesis engine active"
                />

                <div className="tn-ai-gen-header__content">
                    <div className="tn-ai-gen-badge-row">
                        <span className="tn-ai-gen-pill tn-ai-gen-pill--active">
                            <span className="tn-ai-gen-pill__pulse" />
                            <span>AI SYNTHESIS ACTIVE</span>
                        </span>
                        <span className="tn-ai-gen-pill">
                            <span>VERIFICATION PROTOCOL</span>
                        </span>
                    </div>

                    <h3 className="tn-ai-gen-title">
                        Synthesizing QA Test Suite
                    </h3>

                    <p className="tn-ai-gen-description">
                        Analyzing specification for <strong>{displayTitle}</strong>. Synthesizing functional flows, boundary assertions, negative scenarios, and requirement traceability.
                    </p>
                </div>
            </div>

            {/* Active Context Specifications Bar */}
            <div className="tn-ai-gen-specs">
                <div className="tn-ai-gen-spec-item">
                    <span className="tn-ai-gen-spec-label">Target:</span>
                    <span className="tn-ai-gen-spec-val">{targetType}</span>
                </div>
                <span className="tn-ai-gen-spec-divider">•</span>
                <div className="tn-ai-gen-spec-item">
                    <span className="tn-ai-gen-spec-label">Depth:</span>
                    <span className="tn-ai-gen-spec-val">{depthLevel}</span>
                </div>
                <span className="tn-ai-gen-spec-divider">•</span>
                <div className="tn-ai-gen-spec-item">
                    <span className="tn-ai-gen-spec-label">Specification:</span>
                    <span className="tn-ai-gen-spec-val">{charCount} chars</span>
                </div>
                <span className="tn-ai-gen-spec-divider">•</span>
                <div className="tn-ai-gen-spec-item">
                    <span className="tn-ai-gen-spec-label">Elapsed:</span>
                    <span className="tn-ai-gen-spec-val">{elapsedSeconds}s</span>
                </div>
            </div>

            {/* Real-Time Continuous Signal Sweep */}
            <div className="tn-ai-gen-sweep" aria-hidden="true">
                <div className="tn-ai-gen-sweep-bar" />
            </div>

            {/* Meaningful Verification Stages */}
            <div className="tn-ai-gen-stages">
                <div className="tn-ai-gen-stages-title-row">
                    <span>Verification Sequence</span>
                    <span>
                        {hasConfirmedStages
                            ? `${confirmedStages.length}/${DEFAULT_STAGES.length} Verified`
                            : 'In Progress'}
                    </span>
                </div>

                {DEFAULT_STAGES.map((stage, idx) => {
                    const isConfirmed = confirmedStages.includes(stage.id) || (activeStageIndex !== null && idx < activeStageIndex);
                    const isActive = activeStageIndex === idx || (activeStageIndex === null && !hasConfirmedStages);

                    return (
                        <div
                            key={stage.id}
                            className={`tn-ai-gen-stage-item ${isConfirmed ? 'is-completed' : isActive ? 'is-active' : ''}`}
                        >
                            <span className="tn-ai-gen-stage-indicator">
                                {stage.tag}
                            </span>
                            <span className="tn-ai-gen-stage-name">
                                {stage.label}
                            </span>
                            <span className="tn-ai-gen-stage-status">
                                {isConfirmed
                                    ? 'Verified'
                                    : isActive
                                        ? (activeStageIndex !== null ? 'In Progress' : 'Active')
                                        : 'Pending'}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Footer with Cancellation & Integrity Guarantee */}
            <div className="tn-ai-gen-footer">
                <div className="tn-ai-gen-footer-meta">
                    <span>Gemini QA Reasoning Core</span>
                    <span>•</span>
                    <span>Zero fabricated test metrics</span>
                </div>

                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="tn-ai-gen-btn-cancel"
                    >
                        Cancel Request
                    </button>
                )}
            </div>
        </div>
    );
};

export default AiGenerationLoader;
