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
    Loader2,
    Plus,
    Check,
    ChevronDown,
    Zap,
    SlidersHorizontal,
    GitBranch,
    RefreshCw
} from 'lucide-react';
import { copilotService } from '../../services/copilotService';
import '../../styles/copilotDrawer.css';

const QaCopilotDrawer = ({
    isOpen,
    onClose,
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

    // ─── Analysis State ───
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Analyzing test suite...');
    const [errorMessage, setErrorMessage] = useState(null);
    const [addedTestIds, setAddedTestIds] = useState(new Set());
    const [appliedImprovement, setAppliedImprovement] = useState(false);

    // ─── Free-form Query Input State ───
    const [queryInput, setQueryInput] = useState('');

    // Update scope dynamically if selectedTestCase or activeTab changes externally
    useEffect(() => {
        if (selectedTestCase?.id && contextScope === 'suite') {
            setContextScope('test_case');
        }
    }, [selectedTestCase?.id]);

    // Keyboard listener: Escape key closes panel
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
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

        // Action-specific loading state
        const loadingLabels = {
            review_coverage: 'Auditing coverage & requirement traceability...',
            find_missing_scenarios: 'Detecting unaddressed boundary scenarios...',
            review_test_case: `Reviewing ${selectedTestCase?.id || 'selected test'} specificity...`,
            find_edge_cases: 'Checking race conditions and edge thresholds...',
            analyze_security: 'Auditing security scenarios and abuse boundaries...',
            improve_test_case: `Generating improvements for ${selectedTestCase?.id || 'test'}...`,
            custom_query: 'Analyzing query against test context...'
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
                setErrorMessage('Unable to complete analysis. Please try again.');
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
            // Even if offline/local, still invoke parent callback for seamless UI updates
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

    if (!isOpen) return null;

    return (
        <aside className="tn-copilot-drawer" aria-label="QA Copilot Panel">
            {/* ─── 1. Header ─── */}
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

            {/* ─── 2. Context Indicator & Scope Bar ─── */}
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
                        >
                            <SlidersHorizontal size={11} />
                            <span>
                                {contextScope === 'test_case' ? 'Selected Test' :
                                 contextScope === 'coverage' ? 'Coverage' :
                                 contextScope === 'risks' ? 'Risks' : 'Entire Suite'}
                            </span>
                            <ChevronDown size={11} />
                        </button>

                        {showScopeMenu && (
                            <div className="tn-copilot-scope-dropdown">
                                <button
                                    className={`tn-copilot-scope-option ${contextScope === 'suite' ? 'is-active' : ''}`}
                                    onClick={() => { setContextScope('suite'); setShowScopeMenu(false); }}
                                >
                                    Entire Suite
                                </button>
                                {selectedTestCase?.id && (
                                    <button
                                        className={`tn-copilot-scope-option ${contextScope === 'test_case' ? 'is-active' : ''}`}
                                        onClick={() => { setContextScope('test_case'); setShowScopeMenu(false); }}
                                    >
                                        Selected Test ({selectedTestCase.id})
                                    </button>
                                )}
                                <button
                                    className={`tn-copilot-scope-option ${contextScope === 'coverage' ? 'is-active' : ''}`}
                                    onClick={() => { setContextScope('coverage'); setShowScopeMenu(false); }}
                                >
                                    Coverage
                                </button>
                                <button
                                    className={`tn-copilot-scope-option ${contextScope === 'risks' ? 'is-active' : ''}`}
                                    onClick={() => { setContextScope('risks'); setShowScopeMenu(false); }}
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
                        <span className="tn-copilot-context__meta-item">
                            {totalTestsCount} test cases
                        </span>
                        <span>&bull;</span>
                        <span className="tn-copilot-context__meta-item">
                            {coverageConfidence}% coverage
                        </span>

                        {selectedTestCase?.id && contextScope === 'test_case' && (
                            <span className="tn-copilot-context__chip tn-copilot-context__chip--active" title={selectedTestCase.title}>
                                Selected: <strong>{selectedTestCase.id}</strong> ({selectedTestCase.title?.slice(0, 20)}...)
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── 3. Quick Action Bar (3–5 Contextual Actions) ─── */}
            <div className="tn-copilot-actions-bar">
                <div className="tn-copilot-actions-bar__label">Suggested Actions</div>
                <div className="tn-copilot-action-chips">
                    <button
                        className={`tn-copilot-action-chip ${analysisResult?.action === 'review_coverage' ? 'is-active' : ''}`}
                        onClick={() => executeAction('review_coverage')}
                        disabled={isLoading}
                    >
                        <Layers size={12} />
                        <span>Review coverage</span>
                    </button>

                    <button
                        className={`tn-copilot-action-chip ${analysisResult?.action === 'find_missing_scenarios' ? 'is-active' : ''}`}
                        onClick={() => executeAction('find_missing_scenarios')}
                        disabled={isLoading}
                    >
                        <Search size={12} />
                        <span>Find missing scenarios</span>
                    </button>

                    {selectedTestCase?.id && (
                        <button
                            className={`tn-copilot-action-chip ${analysisResult?.action === 'review_test_case' ? 'is-active' : ''}`}
                            onClick={() => executeAction('review_test_case')}
                            disabled={isLoading}
                        >
                            <FileText size={12} />
                            <span>Review selected test</span>
                        </button>
                    )}

                    <button
                        className={`tn-copilot-action-chip ${analysisResult?.action === 'analyze_security' ? 'is-active' : ''}`}
                        onClick={() => executeAction('analyze_security')}
                        disabled={isLoading}
                    >
                        <Shield size={12} />
                        <span>Analyze security risks</span>
                    </button>

                    {selectedTestCase?.id && (
                        <button
                            className={`tn-copilot-action-chip ${analysisResult?.action === 'improve_test_case' ? 'is-active' : ''}`}
                            onClick={() => executeAction('improve_test_case')}
                            disabled={isLoading}
                        >
                            <Zap size={12} />
                            <span>Improve selected test</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ─── 4. Scrollable Analysis / Content Viewport ─── */}
            <div className="tn-copilot-content">
                {isLoading && (
                    <div className="tn-copilot-loading">
                        <Loader2 size={16} className="tn-copilot-loading__spinner" />
                        <span>{loadingMessage}</span>
                    </div>
                )}

                {errorMessage && (
                    <div className="tn-copilot-error">
                        <AlertCircle size={16} className="flex-shrink-0 text-red-400" />
                        <div>
                            <p>{errorMessage}</p>
                            <button onClick={() => executeAction(analysisResult?.action || 'review_coverage')}>
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                {/* Default State: When opened without an active analysis */}
                {!isLoading && !errorMessage && !analysisResult && (
                    <div className="tn-copilot-default-state">
                        <div className="tn-copilot-default-state__icon">
                            <SlidersHorizontal size={20} />
                        </div>
                        <h4>Context-Aware QA Analysis</h4>
                        <p>
                            Review this test suite, evaluate selected test cases, uncover coverage gaps, or audit security scenarios.
                        </p>

                        <div className="tn-copilot-default-state__suggestions">
                            <button
                                className="tn-copilot-default-action-row"
                                onClick={() => executeAction('review_coverage')}
                            >
                                <span><Layers size={14} className="text-teal-400" /> Review requirement coverage</span>
                                <ArrowRight size={13} className="text-neutral-500" />
                            </button>
                            <button
                                className="tn-copilot-default-action-row"
                                onClick={() => executeAction('find_missing_scenarios')}
                            >
                                <span><Search size={14} className="text-teal-400" /> Find missing boundary tests</span>
                                <ArrowRight size={13} className="text-neutral-500" />
                            </button>
                            {selectedTestCase?.id && (
                                <button
                                    className="tn-copilot-default-action-row"
                                    onClick={() => executeAction('review_test_case')}
                                >
                                    <span><FileText size={14} className="text-teal-400" /> Inspect {selectedTestCase.id}</span>
                                    <ArrowRight size={13} className="text-neutral-500" />
                                </button>
                            )}
                            <button
                                className="tn-copilot-default-action-row"
                                onClick={() => executeAction('analyze_security')}
                            >
                                <span><Shield size={14} className="text-teal-400" /> Analyze abuse & rate limits</span>
                                <ArrowRight size={13} className="text-neutral-500" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Structured QA Analysis Result */}
                {!isLoading && analysisResult && (
                    <div className="tn-copilot-analysis-card">
                        {/* Header */}
                        <div className="tn-copilot-analysis-header">
                            <div className="tn-copilot-analysis-title">
                                <span>{analysisResult.title || 'QA Analysis'}</span>
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
                                                >
                                                    {isAdded ? (
                                                        <>
                                                            <Check size={13} />
                                                            <span>Added to Test Suite</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus size={13} />
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontSize: '0.78rem', marginTop: '6px' }}>
                                            <CheckCircle2 size={14} />
                                            <span>Test case updated successfully.</span>
                                        </div>
                                    ) : (
                                        <div className="tn-copilot-diff-actions">
                                            <button
                                                className="tn-copilot-btn-apply"
                                                onClick={() => handleApplyImprovement(analysisResult.proposedImprovement)}
                                            >
                                                <Check size={12} />
                                                <span>Apply Changes</span>
                                            </button>
                                            <button
                                                className="tn-copilot-btn-keep"
                                                onClick={() => setAnalysisResult(prev => ({ ...prev, proposedImprovement: null }))}
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
                                <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '0.76rem', color: '#B3B3B3', lineHeight: '1.5' }}>
                                    {analysisResult.recommendations.map((rec, rIdx) => (
                                        <li key={rIdx}>{rec}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── 5. Bottom Grounded Contextual Input ─── */}
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
                    >
                        <Send size={13} />
                    </button>
                </form>
            </div>
        </aside>
    );
};

export default QaCopilotDrawer;
