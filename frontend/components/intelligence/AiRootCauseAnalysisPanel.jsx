import React, { useState, useEffect, useCallback } from 'react';
import {
    Sparkles, RefreshCw, Copy, Check, ThumbsUp, ThumbsDown,
    AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Code,
    HelpCircle, ShieldAlert, CheckCircle2, History
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import '../../styles/app/AiRootCauseAnalysis.css';

export const AiRootCauseAnalysisPanel = ({
    runId,
    runCaseId,
    testCaseId,
    status = 'failed'
}) => {
    const [analyses, setAnalyses] = useState([]);
    const [selectedAnalysisId, setSelectedAnalysisId] = useState(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    // Feedback state
    const [feedbackRating, setFeedbackRating] = useState(null);
    const [feedbackComment, setFeedbackComment] = useState('');
    const [showCommentBox, setShowCommentBox] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

    // Collapsible evidence & investigation states
    const [showEvidence, setShowEvidence] = useState(true);
    const [showInvestigation, setShowInvestigation] = useState(true);

    // Load historical analyses for this run case
    const loadAnalysesHistory = useCallback(async () => {
        if (!runId || !runCaseId) return;
        setIsLoadingHistory(true);
        setError(null);
        try {
            const res = await executionService.getFailureRootCauseAnalyses(runId, runCaseId);
            if (res?.success && Array.isArray(res.data)) {
                setAnalyses(res.data);
                if (res.data.length > 0 && !selectedAnalysisId) {
                    setSelectedAnalysisId(res.data[0].id);
                    if (res.data[0].feedback) {
                        setFeedbackRating(res.data[0].feedback.rating);
                        setFeedbackComment(res.data[0].feedback.comment || '');
                        setFeedbackSubmitted(true);
                    }
                }
            }
        } catch (err) {
            console.warn('Could not load failure analysis history:', err.message);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [runId, runCaseId, selectedAnalysisId]);

    useEffect(() => {
        loadAnalysesHistory();
    }, [loadAnalysesHistory]);

    // Current active analysis record
    const activeRecord = analyses.find(a => a.id === selectedAnalysisId) || analyses[0] || null;
    const currentAnalysis = activeRecord?.analysis || null;

    // Trigger AI Analysis (fresh or cached)
    const handleTriggerAnalysis = async (forceFresh = false) => {
        setIsAnalyzing(true);
        setError(null);
        try {
            const res = await executionService.analyzeFailureRootCause(runId, runCaseId, { forceFresh });
            if (res?.success && res.data) {
                // Prepend or update active record
                setAnalyses(prev => {
                    const filtered = prev.filter(a => a.id !== res.data.id);
                    return [res.data, ...filtered];
                });
                setSelectedAnalysisId(res.data.id);
                setFeedbackRating(null);
                setFeedbackComment('');
                setFeedbackSubmitted(false);
                setShowCommentBox(false);
            } else {
                throw new Error(res?.message || 'Failed to complete AI root cause analysis');
            }
        } catch (err) {
            setError(err.message || 'Error generating AI root cause analysis');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Copy formatted analysis to clipboard
    const handleCopy = () => {
        if (!currentAnalysis) return;
        const text = [
            `TESTNEXA AI FAILURE ROOT CAUSE ANALYSIS`,
            `Test Case: ${testCaseId}`,
            `Status: ${status}`,
            `Confidence: ${currentAnalysis.confidence || 'Medium'}`,
            ``,
            `[OBSERVED FAILURE]`,
            currentAnalysis.observedFailure,
            ``,
            `[LIKELY ROOT CAUSE]`,
            currentAnalysis.likelyRootCause,
            ``,
            `[SUGGESTED INVESTIGATION]`,
            ...(currentAnalysis.suggestedInvestigation || []).map(s => `• ${s}`),
            ``,
            currentAnalysis.suggestedFix ? `[SUGGESTED FIX]\n${currentAnalysis.suggestedFix.recommendation}\n${currentAnalysis.suggestedFix.technicalDetails || ''}` : ''
        ].filter(Boolean).join('\n');

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Submit user feedback
    const handleFeedback = async (rating) => {
        if (!activeRecord) return;
        setFeedbackRating(rating);
        setShowCommentBox(true);

        try {
            await executionService.submitFailureAnalysisFeedback(activeRecord.id, {
                rating,
                comment: feedbackComment
            });
            setFeedbackSubmitted(true);
        } catch (err) {
            console.warn('Failed to submit feedback:', err.message);
        }
    };

    const handleSaveComment = async () => {
        if (!activeRecord || !feedbackRating) return;
        setIsSubmittingFeedback(true);
        try {
            await executionService.submitFailureAnalysisFeedback(activeRecord.id, {
                rating: feedbackRating,
                comment: feedbackComment
            });
            setFeedbackSubmitted(true);
            setShowCommentBox(false);
        } catch (err) {
            console.warn('Failed to save feedback comment:', err.message);
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    const formatTimestamp = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="rca-card">
            {/* ─── Header & Top Actions ─── */}
            <div className="rca-header">
                <div className="rca-title-group">
                    <h4 className="rca-title">
                        <Sparkles size={16} style={{ color: 'var(--rca-jade)' }} />
                        <span>AI Root Cause Analysis</span>
                    </h4>
                    {activeRecord && (
                        <span className="rca-model-badge">
                            {activeRecord.model || activeRecord.provider || 'AI'}
                        </span>
                    )}
                    {currentAnalysis && (
                        <span className={`rca-confidence-badge ${(currentAnalysis.confidence || 'medium').toLowerCase()}`} title={currentAnalysis.confidenceReasoning || ''}>
                            {currentAnalysis.confidence} Confidence
                        </span>
                    )}
                </div>

                <div className="rca-actions">
                    {/* Analysis History Dropdown */}
                    {analyses.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <History size={13} style={{ color: 'var(--rca-text-subtle)' }} />
                            <select
                                className="rca-history-select"
                                value={selectedAnalysisId || ''}
                                onChange={(e) => setSelectedAnalysisId(e.target.value)}
                                aria-label="Select previous analysis"
                            >
                                {analyses.map((a, i) => (
                                    <option key={a.id} value={a.id}>
                                        {formatTimestamp(a.createdAt)} {i === 0 ? '(Latest)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {currentAnalysis && (
                        <>
                            <button
                                type="button"
                                className="rca-btn"
                                onClick={handleCopy}
                                title="Copy analysis report"
                            >
                                {copied ? <Check size={13} style={{ color: 'var(--rca-pass)' }} /> : <Copy size={13} />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>

                            <button
                                type="button"
                                className="rca-btn"
                                onClick={() => handleTriggerAnalysis(true)}
                                disabled={isAnalyzing}
                                title="Re-evaluate evidence and generate fresh analysis"
                            >
                                <RefreshCw size={13} className={isAnalyzing ? 'animate-spin' : ''} />
                                <span>{isAnalyzing ? 'Analyzing…' : 'Re-analyze'}</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div style={{
                    padding: '0.65rem 0.85rem',
                    background: 'var(--rca-fail-bg)',
                    border: '1px solid var(--rca-fail-border)',
                    borderRadius: '6px',
                    color: 'var(--rca-fail)',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                }}>
                    <AlertCircle size={15} />
                    <span>{error}</span>
                </div>
            )}

            {/* ─── State 1: Loading State ─── */}
            {isAnalyzing && (
                <div className="rca-loading-box">
                    <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--rca-jade)' }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, color: '#FFFFFF' }}>Investigating failure evidence…</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--rca-text-subtle)', marginTop: '0.25rem' }}>
                            Synthesizing stack trace, execution steps, and environment signals
                        </div>
                    </div>
                </div>
            )}

            {/* ─── State 2: Empty / Prompt to Analyze ─── */}
            {!isAnalyzing && !currentAnalysis && (
                <div style={{
                    padding: '1.25rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.65rem',
                    textAlign: 'center'
                }}>
                    <Sparkles size={22} style={{ color: 'var(--rca-jade)', opacity: 0.8 }} />
                    <div style={{ maxWidth: '420px' }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFFFFF' }}>
                            Investigate Failure with AI
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--rca-text-muted)', marginTop: '0.25rem' }}>
                            Extract empirical root cause hypothesis, pinpoint failing step, and get concrete code recommendations based on actual execution records.
                        </div>
                    </div>
                    <button
                        type="button"
                        className="rca-btn rca-btn-primary"
                        onClick={() => handleTriggerAnalysis(false)}
                        disabled={isAnalyzing}
                        style={{ marginTop: '0.35rem' }}
                    >
                        <Sparkles size={13} />
                        <span>Analyze with AI</span>
                    </button>
                </div>
            )}

            {/* ─── State 3: Structured Root Cause Analysis ─── */}
            {!isAnalyzing && currentAnalysis && (
                <div className="rca-content">
                    {/* Hypothesis Advisory Banner */}
                    <div className="rca-hypothesis-banner">
                        <AlertTriangle size={14} />
                        <span><strong>Hypothesis Advisory:</strong> Root cause analysis is derived from execution evidence. Human review is required before modifying application code or infrastructure.</span>
                    </div>

                    {/* Likely Root Cause */}
                    <div className="rca-section">
                        <span className="rca-section-label">Likely Root Cause</span>
                        <div className="rca-root-cause-box">
                            {currentAnalysis.likelyRootCause}
                        </div>
                    </div>

                    {/* Observed Failure */}
                    <div className="rca-section">
                        <span className="rca-section-label">Observed Failure</span>
                        <div className="rca-observed-text">
                            {currentAnalysis.observedFailure}
                        </div>
                    </div>

                    {/* Affected Test Step */}
                    {currentAnalysis.affectedStep && (
                        <div className="rca-section">
                            <span className="rca-section-label">Affected Test Step</span>
                            <div className="rca-step-card">
                                <div className="rca-step-header">
                                    Step #{currentAnalysis.affectedStep.stepNumber || 1}: {currentAnalysis.affectedStep.action || 'Failing step'}
                                </div>
                                {currentAnalysis.affectedStep.expected && (
                                    <div className="rca-step-body">
                                        Expected: {currentAnalysis.affectedStep.expected}
                                    </div>
                                )}
                                {currentAnalysis.affectedStep.actual && (
                                    <div className="rca-step-body" style={{ color: 'var(--rca-fail)' }}>
                                        Actual deviation: {currentAnalysis.affectedStep.actual}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Supporting Evidence (Collapsible) */}
                    {currentAnalysis.supportingEvidence && currentAnalysis.supportingEvidence.length > 0 && (
                        <div className="rca-section">
                            <button
                                type="button"
                                className="rca-section-label"
                                onClick={() => setShowEvidence(!showEvidence)}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                            >
                                <span>Supporting Evidence ({currentAnalysis.supportingEvidence.length})</span>
                                {showEvidence ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                            {showEvidence && (
                                <ul className="rca-evidence-list">
                                    {currentAnalysis.supportingEvidence.map((ev, idx) => (
                                        <li key={idx} className="rca-evidence-item">{ev}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Possible Contributing Factors */}
                    {currentAnalysis.contributingFactors && currentAnalysis.contributingFactors.length > 0 && (
                        <div className="rca-section">
                            <span className="rca-section-label">Possible Contributing Factors</span>
                            <ul className="rca-evidence-list" style={{ color: 'var(--rca-text-muted)' }}>
                                {currentAnalysis.contributingFactors.map((fact, idx) => (
                                    <li key={idx}>{fact}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Suggested Investigation Checklist (Collapsible) */}
                    {currentAnalysis.suggestedInvestigation && currentAnalysis.suggestedInvestigation.length > 0 && (
                        <div className="rca-section">
                            <button
                                type="button"
                                className="rca-section-label"
                                onClick={() => setShowInvestigation(!showInvestigation)}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                            >
                                <span>Suggested Investigation ({currentAnalysis.suggestedInvestigation.length})</span>
                                {showInvestigation ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                            {showInvestigation && (
                                <ol className="rca-investigation-list">
                                    {currentAnalysis.suggestedInvestigation.map((inv, idx) => (
                                        <li key={idx}>{inv}</li>
                                    ))}
                                </ol>
                            )}
                        </div>
                    )}

                    {/* Suggested Technical Fix */}
                    {currentAnalysis.suggestedFix && (
                        <div className="rca-section">
                            <span className="rca-section-label" style={{ color: 'var(--rca-pass)' }}>
                                Suggested Technical Recommendation
                            </span>
                            <div className="rca-fix-box">
                                <div style={{ color: '#FFFFFF', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    {currentAnalysis.suggestedFix.recommendation}
                                </div>
                                {currentAnalysis.suggestedFix.technicalDetails && (
                                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--rca-pass)' }}>
                                        {currentAnalysis.suggestedFix.technicalDetails}
                                    </pre>
                                )}
                                {currentAnalysis.suggestedFix.targetComponent && (
                                    <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', color: 'var(--rca-text-subtle)' }}>
                                        Component: {currentAnalysis.suggestedFix.targetComponent}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Limitations & Missing Evidence */}
                    {currentAnalysis.limitations && currentAnalysis.limitations.length > 0 && (
                        <div className="rca-section">
                            <span className="rca-section-label">Limitations & Missing Signals</span>
                            <ul className="rca-limitations-list">
                                {currentAnalysis.limitations.map((lim, idx) => (
                                    <li key={idx}>{lim}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* ─── User Feedback Controls ─── */}
                    <div className="rca-feedback-bar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span>Was this root cause analysis helpful?</span>
                            <div className="rca-feedback-buttons">
                                <button
                                    type="button"
                                    className={`rca-feedback-btn ${feedbackRating === 'helpful' ? 'active-helpful' : ''}`}
                                    onClick={() => handleFeedback('helpful')}
                                    title="Helpful analysis"
                                >
                                    <ThumbsUp size={13} />
                                    <span>Helpful</span>
                                </button>
                                <button
                                    type="button"
                                    className={`rca-feedback-btn ${feedbackRating === 'unhelpful' ? 'active-unhelpful' : ''}`}
                                    onClick={() => handleFeedback('unhelpful')}
                                    title="Unhelpful or inaccurate"
                                >
                                    <ThumbsDown size={13} />
                                    <span>Unhelpful</span>
                                </button>
                            </div>
                        </div>

                        {feedbackSubmitted && !showCommentBox && (
                            <span style={{ color: 'var(--rca-pass)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle2 size={13} /> Feedback recorded
                            </span>
                        )}
                    </div>

                    {showCommentBox && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <input
                                type="text"
                                className="rca-history-select"
                                style={{ flex: 1, padding: '0.35rem 0.65rem' }}
                                placeholder="Optional feedback: what was accurate or missing?"
                                value={feedbackComment}
                                onChange={(e) => setFeedbackComment(e.target.value)}
                            />
                            <button
                                type="button"
                                className="rca-btn"
                                onClick={handleSaveComment}
                                disabled={isSubmittingFeedback}
                            >
                                Submit
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AiRootCauseAnalysisPanel;

