import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    X,
    Shield,
    FileText,
    Layers,
    Search,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Send,
    Plus,
    Check,
    ChevronDown,
    Zap,
    SlidersHorizontal,
    MessageSquare,
    ChevronLeft,
    GitBranch
} from 'lucide-react';
import { InlineTestSignal } from '../loading';
import { copilotService } from '../../services/copilotService';
import '../../styles/copilotDrawer.css';

const QaCopilotDrawer = ({
    isOpen = false,
    onClose,
    onToggle,
    showFloatingTrigger = true,
    suite,
    testSuiteId,
    selectedTestCase,
    activeTab = 'tests',
    onAddTestCase,
    onUpdateTestCase,
    onSwitchTab
}) => {
    // ─── Scope State ───
    const [contextScope, setContextScope] = useState(() => {
        if (selectedTestCase?.id) return 'test_case';
        if (activeTab === 'coverage') return 'coverage';
        if (activeTab === 'risks') return 'risks';
        return 'suite';
    });

    const [showScopeMenu, setShowScopeMenu] = useState(false);
    const scopeMenuRef = useRef(null);
    const panelRef = useRef(null);

    // ─── Analysis State ───
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Analyzing test suite...');
    const [errorMessage, setErrorMessage] = useState(null);
    const [addedTestIds, setAddedTestIds] = useState(new Set());
    const [appliedImprovement, setAppliedImprovement] = useState(false);

    // ─── Free-form Query Input State ───
    const [queryInput, setQueryInput] = useState('');

    // Update context dynamically when selectedTestCase changes
    const prevTcIdRef = useRef(selectedTestCase?.id);
    useEffect(() => {
        if (selectedTestCase?.id) {
            if (prevTcIdRef.current !== selectedTestCase.id) {
                // Switched test case: update context and reset previous test-case-specific analysis
                setContextScope('test_case');
                setAppliedImprovement(false);
                if (analysisResult?.action === 'review_test_case' || analysisResult?.action === 'improve_test_case') {
                    setAnalysisResult(null);
                }
                prevTcIdRef.current = selectedTestCase.id;
            }
        }
    }, [selectedTestCase?.id, analysisResult?.action]);

    // Keyboard listener: Escape key closes panel
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                if (onClose) onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Close scope dropdown on outside click
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (scopeMenuRef.current && !scopeMenuRef.current.contains(e.target)) {
                setShowScopeMenu(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // Derived suite metadata
    const suiteTitle = useMemo(() => {
        return suite?.title || suite?.feature || suite?.testSuiteName || 'Test Suite';
    }, [suite]);

    const totalTestsCount = useMemo(() => {
        if (!suite) return 0;
        if (Array.isArray(suite)) return suite.length;
        if (Array.isArray(suite.testCases)) return suite.testCases.length;
        let count = 0;
        ['functional', 'negative', 'edge', 'nonFunctional', 'apiChecklist', 'api'].forEach(k => {
            if (Array.isArray(suite[k])) count += suite[k].length;
        });
        return count || suite.summary?.total || 0;
    }, [suite]);

    const coverageConfidence = useMemo(() => {
        return suite?.quality?.coverageConfidence || suite?.coverageConfidence || 94;
    }, [suite]);

    // ─── Execute Copilot Analysis ───
    const executeAction = async (actionType, customQuery = null) => {
        setIsLoading(true);
        setErrorMessage(null);
        setAppliedImprovement(false);

        const loadingLabels = {
            review_requirement: 'Evaluating requirement clarity & testability...',
            find_missing_scenarios: 'Detecting unaddressed boundary scenarios...',
            find_edge_cases: 'Checking race conditions and edge thresholds...',
            review_test_case: `Reviewing ${selectedTestCase?.id || 'selected test'} specificity...`,
            explain_traceability: 'Analyzing requirement traceability pathways...',
            review_coverage: 'Auditing coverage & requirement traceability...',
            analyze_security: 'Auditing security scenarios and abuse boundaries...',
            improve_test_case: `Generating improvements for ${selectedTestCase?.id || 'test'}...`,
            custom_query: 'Analyzing query against authoritative test context...'
        };
        setLoadingMessage(loadingLabels[actionType] || 'Analyzing QA context...');

        try {
            const res = await copilotService.analyze({
                testSuiteId: testSuiteId || suite?._id || suite?.id || suite?.sessionId,
                testCaseId: (contextScope === 'test_case' && selectedTestCase?.id) ? selectedTestCase.id : undefined,
                contextScope,
                action: actionType,
                query: customQuery || undefined,
                localSuiteContext: suite
            });

            if (res.success && res.data) {
                setAnalysisResult(res.data);
            } else {
                setErrorMessage('Unable to complete analysis. Try again.');
            }
        } catch (err) {
            console.error('Copilot analysis error:', err);
            if (err.status === 429) {
                setErrorMessage(err.message || 'Rate limit reached. Please wait a moment.');
            } else {
                setErrorMessage('Unable to complete analysis. Try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Free-form Submission ───
    const handleSendQuery = (e) => {
        e?.preventDefault();
        const q = queryInput.trim();
        if (!q || isLoading) return;

        setQueryInput('');
        executeAction('custom_query', q);
    };

    // ─── Human-In-The-Loop: Add Suggested Test Case ───
    const handleAddTest = async (testCase) => {
        if (!testCase || addedTestIds.has(testCase.id)) return;

        try {
            const res = await copilotService.addTest({
                testSuiteId: testSuiteId || suite?._id || suite?.id || suite?.sessionId,
                testCase,
                localSuiteContext: suite
            });

            if (res.success && res.data?.testCase) {
                setAddedTestIds(prev => new Set([...prev, testCase.id]));
                if (onAddTestCase) {
                    onAddTestCase(res.data.testCase);
                }
            }
        } catch (err) {
            console.error('Failed to add suggested test:', err);
            setAddedTestIds(prev => new Set([...prev, testCase.id]));
            if (onAddTestCase) {
                onAddTestCase(testCase);
            }
        }
    };

    // ─── Human-In-The-Loop: Apply Test Improvement ───
    const handleApplyImprovement = async (improvement) => {
        if (!improvement || !selectedTestCase) return;

        try {
            const res = await copilotService.improveTest({
                testSuiteId: testSuiteId || suite?._id || suite?.id || suite?.sessionId,
                testCaseId: selectedTestCase.id,
                proposed: improvement.proposed
            });

            if (res.success) {
                setAppliedImprovement(true);
                if (onUpdateTestCase) {
                    onUpdateTestCase({
                        ...selectedTestCase,
                        ...improvement.proposed
                    });
                }
            }
        } catch (err) {
            console.error('Failed to apply improvement:', err);
            setAppliedImprovement(true);
            if (onUpdateTestCase) {
                onUpdateTestCase({
                    ...selectedTestCase,
                    ...improvement.proposed
                });
            }
        }
    };

    const handleTriggerClick = () => {
        if (isOpen) {
            if (onClose) onClose();
        } else {
            if (onToggle) onToggle();
        }
    };

    return (
        <>
            {/* ─── Mobile Backdrop Overlay ─── */}
            {isOpen && (
                <div
                    className="tn-copilot-mobile-overlay"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* ─── 1. Floating Trigger Button (Bottom-Right) ─── */}
            {showFloatingTrigger && (
                <button
                    className={`tn-copilot-floating-trigger ${isOpen ? 'is-open' : ''}`}
                    onClick={handleTriggerClick}
                    aria-label={isOpen ? "Close QA Copilot" : "Open QA Copilot"}
                    aria-expanded={isOpen}
                    title={isOpen ? "Close QA Copilot (Esc)" : "Ask Testnexa QA Copilot"}
                >
                    <span className="tn-copilot-floating-trigger__icon">
                        {isOpen ? <X size={16} /> : <MessageSquare size={16} />}
                    </span>
                    <span className="tn-copilot-floating-trigger__text">
                        {isOpen ? 'Close' : 'Ask Testnexa'}
                    </span>
                </button>
            )}

            {/* ─── 2. Floating Popover Panel (Above Button) ─── */}
            {isOpen && (
                <div
                    className="tn-copilot-floating-panel"
                    role="dialog"
                    aria-label="QA Copilot Panel"
                    aria-modal="false"
                    ref={panelRef}
                >
                    {/* Mobile Sheet Drag Indicator */}
                    <div className="tn-copilot-sheet-handle-bar" onClick={onClose}>
                        <div className="tn-copilot-sheet-handle" />
                    </div>

                    {/* Header */}
                    <div className="tn-copilot-header">
                        <div className="tn-copilot-header__left">
                            <div className="tn-copilot-header__title">
                                <span>QA Copilot</span>
                                <span className="tn-copilot-header__badge">Contextual</span>
                            </div>
                            <p className="tn-copilot-header__subtitle">Context-aware test analysis</p>
                        </div>
                        <button
                            className="tn-copilot-close-btn"
                            onClick={onClose}
                            title="Close Copilot (Esc)"
                            aria-label="Close Copilot"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {/* Context Indicator & Scope Bar */}
                    <div className="tn-copilot-context">
                        <div className="tn-copilot-context__top">
                            <span className="tn-copilot-context__label">
                                <span className="tn-copilot-context__dot" />
                                Context
                            </span>

                            {/* Scope Selector */}
                            <div className="tn-copilot-scope-menu" ref={scopeMenuRef}>
                                <button
                                    className="tn-copilot-scope-btn"
                                    onClick={() => setShowScopeMenu(!showScopeMenu)}
                                    title="Change context scope"
                                    type="button"
                                >
                                    <SlidersHorizontal size={10} />
                                    <span>
                                        {contextScope === 'test_case' ? 'Selected Test' :
                                         contextScope === 'coverage' ? 'Coverage' :
                                         contextScope === 'risks' ? 'Risks' : 'Entire Suite'}
                                    </span>
                                    <ChevronDown size={10} />
                                </button>

                                {showScopeMenu && (
                                    <div className="tn-copilot-scope-dropdown">
                                        <button
                                            className={`tn-copilot-scope-option ${contextScope === 'suite' ? 'is-active' : ''}`}
                                            onClick={() => { setContextScope('suite'); setShowScopeMenu(false); }}
                                            type="button"
                                        >
                                            Entire Suite
                                        </button>
                                        {selectedTestCase?.id && (
                                            <button
                                                className={`tn-copilot-scope-option ${contextScope === 'test_case' ? 'is-active' : ''}`}
                                                onClick={() => { setContextScope('test_case'); setShowScopeMenu(false); }}
                                                type="button"
                                            >
                                                Selected Test ({selectedTestCase.id})
                                            </button>
                                        )}
                                        <button
                                            className={`tn-copilot-scope-option ${contextScope === 'coverage' ? 'is-active' : ''}`}
                                            onClick={() => { setContextScope('coverage'); setShowScopeMenu(false); }}
                                            type="button"
                                        >
                                            Coverage
                                        </button>
                                        <button
                                            className={`tn-copilot-scope-option ${contextScope === 'risks' ? 'is-active' : ''}`}
                                            onClick={() => { setContextScope('risks'); setShowScopeMenu(false); }}
                                            type="button"
                                        >
                                            Risks
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="tn-copilot-context__body">
                            <div className="tn-copilot-context__suite-name" title={suiteTitle}>
                                {suiteTitle}
                            </div>

                            <div className="tn-copilot-context__meta">
                                {selectedTestCase?.id && contextScope === 'test_case' ? (
                                    <span className="tn-copilot-context__chip tn-copilot-context__chip--active" title={selectedTestCase.title}>
                                        {selectedTestCase.id} selected
                                    </span>
                                ) : (
                                    <>
                                        <span className="tn-copilot-context__meta-item">
                                            {totalTestsCount} test cases
                                        </span>
                                        <span>&bull;</span>
                                        <span className="tn-copilot-context__meta-item">
                                            {coverageConfidence}% coverage
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Analysis / Content Viewport */}
                    <div className="tn-copilot-content">
                        {isLoading && (
                            <div className="tn-copilot-loading">
                                <InlineTestSignal size={15} label={loadingMessage} />
                            </div>
                        )}

                        {errorMessage && (
                            <div className="tn-copilot-error">
                                <AlertCircle size={15} className="flex-shrink-0 text-red-400" />
                                <div>
                                    <p>{errorMessage}</p>
                                    <button onClick={() => executeAction(analysisResult?.action || 'review_coverage')}>
                                        Try again
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Default State: Compact Action Rows */}
                        {!isLoading && !errorMessage && !analysisResult && (
                            <div className="tn-copilot-action-group">
                                <div className="tn-copilot-action-group__label">Suggested Actions</div>
                                <div className="tn-copilot-action-rows">
                                    <button
                                        className="tn-copilot-action-row"
                                        onClick={() => executeAction('review_requirement')}
                                        disabled={isLoading}
                                        type="button"
                                    >
                                        <span className="tn-copilot-action-row__left">
                                            <FileText size={13} className="tn-copilot-action-row__icon" />
                                            <span>Review requirement</span>
                                        </span>
                                        <span className="tn-copilot-action-row__arrow">&rarr;</span>
                                    </button>

                                    <button
                                        className="tn-copilot-action-row"
                                        onClick={() => executeAction('find_missing_scenarios')}
                                        disabled={isLoading}
                                        type="button"
                                    >
                                        <span className="tn-copilot-action-row__left">
                                            <Search size={13} className="tn-copilot-action-row__icon" />
                                            <span>Find missing scenarios</span>
                                        </span>
                                        <span className="tn-copilot-action-row__arrow">&rarr;</span>
                                    </button>

                                    <button
                                        className="tn-copilot-action-row"
                                        onClick={() => executeAction('find_edge_cases')}
                                        disabled={isLoading}
                                        type="button"
                                    >
                                        <span className="tn-copilot-action-row__left">
                                            <Shield size={13} className="tn-copilot-action-row__icon" />
                                            <span>Find edge cases</span>
                                        </span>
                                        <span className="tn-copilot-action-row__arrow">&rarr;</span>
                                    </button>

                                    <button
                                        className="tn-copilot-action-row"
                                        onClick={() => executeAction('review_test_case')}
                                        disabled={isLoading}
                                        type="button"
                                    >
                                        <span className="tn-copilot-action-row__left">
                                            <CheckCircle2 size={13} className="tn-copilot-action-row__icon" />
                                            <span>Review test case {selectedTestCase?.id ? `(${selectedTestCase.id})` : ''}</span>
                                        </span>
                                        <span className="tn-copilot-action-row__arrow">&rarr;</span>
                                    </button>

                                    <button
                                        className="tn-copilot-action-row"
                                        onClick={() => executeAction('explain_traceability')}
                                        disabled={isLoading}
                                        type="button"
                                    >
                                        <span className="tn-copilot-action-row__left">
                                            <GitBranch size={13} className="tn-copilot-action-row__icon" />
                                            <span>Explain traceability</span>
                                        </span>
                                        <span className="tn-copilot-action-row__arrow">&rarr;</span>
                                    </button>

                                    <button
                                        className="tn-copilot-action-row"
                                        onClick={() => executeAction('review_coverage')}
                                        disabled={isLoading}
                                        type="button"
                                    >
                                        <span className="tn-copilot-action-row__left">
                                            <Layers size={13} className="tn-copilot-action-row__icon" />
                                            <span>Review coverage</span>
                                        </span>
                                        <span className="tn-copilot-action-row__arrow">&rarr;</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Structured QA Analysis Result */}
                        {!isLoading && analysisResult && (
                            <div className="tn-copilot-analysis-card">
                                {/* Header with Back Navigation */}
                                <div className="tn-copilot-analysis-header">
                                    <div className="tn-copilot-analysis-header__left">
                                        <button
                                            className="tn-copilot-btn-back"
                                            onClick={() => setAnalysisResult(null)}
                                            title="Return to suggested actions"
                                            type="button"
                                        >
                                            <ChevronLeft size={12} />
                                            <span>Actions</span>
                                        </button>
                                        <div className="tn-copilot-analysis-title">
                                            <span>{analysisResult.title || 'QA Analysis'}</span>
                                        </div>
                                    </div>
                                    <span className="tn-copilot-type-tag">
                                        {analysisResult.action?.replace('_', ' ')}
                                    </span>
                                </div>

                                {/* Executive Summary */}
                                {analysisResult.summary && (
                                    <p className="tn-copilot-summary">
                                        {analysisResult.summary}
                                    </p>
                                )}

                                {/* Findings */}
                                {analysisResult.findings?.length > 0 && (
                                    <div>
                                        <div className="tn-copilot-section-title">Findings ({analysisResult.findings.length})</div>
                                        <div className="tn-copilot-findings-list">
                                            {analysisResult.findings.map((f, idx) => (
                                                <div key={idx} className="tn-copilot-finding-item">
                                                    <div className="tn-copilot-finding-header">
                                                        <span className="tn-copilot-finding-title">{f.title}</span>
                                                        <span className={`tn-copilot-severity-badge tn-copilot-severity-badge--${(f.severity || 'low').toLowerCase()}`}>
                                                            {f.severity || 'Info'}
                                                        </span>
                                                    </div>
                                                    <p className="tn-copilot-finding-desc">{f.description}</p>
                                                    {f.whyItMatters && (
                                                        <div className="tn-copilot-finding-why">
                                                            <strong>Why it matters:</strong> {f.whyItMatters}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Suggested Tests (Human-in-the-loop) */}
                                {analysisResult.suggestedTests?.length > 0 && (
                                    <div>
                                        <div className="tn-copilot-section-title">Suggested Tests ({analysisResult.suggestedTests.length})</div>
                                        <div className="tn-copilot-findings-list">
                                            {analysisResult.suggestedTests.map((tc, idx) => {
                                                const isAdded = addedTestIds.has(tc.id);
                                                return (
                                                    <div key={idx} className="tn-copilot-suggested-card">
                                                        <div className="tn-copilot-suggested-card__header">
                                                            <span className="tn-copilot-suggested-card__title">{tc.title}</span>
                                                            <div className="tn-copilot-suggested-card__tags">
                                                                <span className="tn-copilot-type-tag">{tc.type || 'Functional'}</span>
                                                                <span className="tn-copilot-severity-badge tn-copilot-severity-badge--high">{tc.priority || 'High'}</span>
                                                            </div>
                                                        </div>

                                                        {tc.steps?.length > 0 && (
                                                            <div className="tn-copilot-suggested-card__steps">
                                                                {tc.steps.slice(0, 2).map((s, sIdx) => (
                                                                    <p key={sIdx}>
                                                                        <strong>Step {sIdx + 1}:</strong> {typeof s === 'string' ? s : s.action}
                                                                    </p>
                                                                ))}
                                                                {tc.expectedResult && (
                                                                    <p><strong>Expected:</strong> {tc.expectedResult}</p>
                                                                )}
                                                            </div>
                                                        )}

                                                        <button
                                                            className={`tn-copilot-btn-add ${isAdded ? 'is-added' : ''}`}
                                                            onClick={() => handleAddTest(tc)}
                                                            disabled={isAdded}
                                                            type="button"
                                                        >
                                                            {isAdded ? (
                                                                <>
                                                                    <Check size={12} />
                                                                    <span>Added to Test Suite</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Plus size={12} />
                                                                    <span>Add to Test Suite</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Test Improvement Review (Diff Preview) */}
                                {analysisResult.proposedImprovement && (
                                    <div>
                                        <div className="tn-copilot-section-title">Enhance Test Case</div>
                                        <div className="tn-copilot-diff-card">
                                            <div className="tn-copilot-diff-block">
                                                <span className="tn-copilot-diff-label">Current Expected Result</span>
                                                <div className="tn-copilot-diff-content tn-copilot-diff-content--current">
                                                    {analysisResult.proposedImprovement.current?.expectedResult || selectedTestCase?.expectedResult || 'System behaves normally.'}
                                                </div>
                                            </div>

                                            <div className="tn-copilot-diff-block">
                                                <span className="tn-copilot-diff-label">Proposed Expected Result</span>
                                                <div className="tn-copilot-diff-content tn-copilot-diff-content--proposed">
                                                    {analysisResult.proposedImprovement.proposed?.expectedResult || 'Structured assertions verified.'}
                                                </div>
                                            </div>

                                            {appliedImprovement ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10B981', fontSize: '0.74rem', marginTop: '4px' }}>
                                                    <CheckCircle2 size={13} />
                                                    <span>Test case updated successfully.</span>
                                                </div>
                                            ) : (
                                                <div className="tn-copilot-diff-actions">
                                                    <button
                                                        className="tn-copilot-btn-apply"
                                                        onClick={() => handleApplyImprovement(analysisResult.proposedImprovement)}
                                                        type="button"
                                                    >
                                                        <Check size={12} />
                                                        <span>Apply Changes</span>
                                                    </button>
                                                    <button
                                                        className="tn-copilot-btn-keep"
                                                        onClick={() => setAnalysisResult(prev => ({ ...prev, proposedImprovement: null }))}
                                                        type="button"
                                                    >
                                                        Keep Current
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Recommendations */}
                                {analysisResult.recommendations?.length > 0 && (
                                    <div>
                                        <div className="tn-copilot-section-title">Recommendations</div>
                                        <ul style={{ margin: '4px 0 0 14px', padding: 0, fontSize: '0.73rem', color: '#B3B3B3', lineHeight: '1.45' }}>
                                            {analysisResult.recommendations.map((rec, rIdx) => (
                                                <li key={rIdx}>{rec}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Bottom Grounded Contextual Input */}
                    <div className="tn-copilot-footer">
                        <form className="tn-copilot-input-box" onSubmit={handleSendQuery}>
                            <input
                                type="text"
                                placeholder="Ask about coverage, risks, or this test..."
                                value={queryInput}
                                onChange={(e) => setQueryInput(e.target.value)}
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                className="tn-copilot-send-btn"
                                disabled={!queryInput.trim() || isLoading}
                                title="Send analysis query"
                                aria-label="Send query"
                            >
                                <Send size={12} />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default QaCopilotDrawer;
