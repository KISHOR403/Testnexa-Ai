import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
    Sparkles, ShieldCheck, AlertTriangle, Layers, CheckCircle2, XCircle,
    Edit3, PlusCircle, Search, Filter, RefreshCw, ChevronDown, ChevronUp,
    ArrowRight, Info, AlertCircle, FileText, Check, ShieldAlert
} from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import { recommendationService } from '../../services/recommendationService';
import { DataLoadingState } from '../../components/loading';
import '../../styles/app/SmartRecommendations.css';

const AVAILABLE_CATEGORIES = [
    'Positive', 'Negative', 'Boundary Value', 'Validation',
    'Edge Case', 'Error Handling', 'Security', 'Regression', 'Accessibility'
];

const SmartRecommendationsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Query params
    const queryParams = new URLSearchParams(location.search);
    const initialSuiteId = queryParams.get('suiteId') || '';

    // State
    const [suites, setSuites] = useState([]);
    const [selectedSuiteId, setSelectedSuiteId] = useState(initialSuiteId);
    const [selectedSuite, setSelectedSuite] = useState(null);
    const [selectedRequirementId, setSelectedRequirementId] = useState('all');
    const [focusArea, setFocusArea] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);

    // Data State
    const [isLoadingSuites, setIsLoadingSuites] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [analysisSummary, setAnalysisSummary] = useState(null);
    const [generationError, setGenerationError] = useState(null);
    const [notification, setNotification] = useState(null);

    // Filter & Search State
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCards, setExpandedCards] = useState(new Set());
    const [selectedRecIds, setSelectedRecIds] = useState(new Set());

    // Modals
    const [editingRec, setEditingRec] = useState(null);
    const [editForm, setEditForm] = useState({
        title: '',
        priority: 'Medium',
        preconditions: '',
        steps: '',
        expectedResult: '',
        testData: ''
    });
    const [isConverting, setIsConverting] = useState(false);
    const [showConfirmConvert, setShowConfirmConvert] = useState(false);

    // Fetch user suites on mount
    useEffect(() => {
        let isCurrent = true;
        const fetchSuites = async () => {
            setIsLoadingSuites(true);
            try {
                const res = await sessionService.list({ limit: 50 });
                if (isCurrent && res?.data) {
                    setSuites(res.data);
                    if (!selectedSuiteId && res.data.length > 0) {
                        setSelectedSuiteId(res.data[0].id || res.data[0]._id);
                    }
                }
            } catch (err) {
                console.error('Failed to list test suites:', err);
            } finally {
                if (isCurrent) setIsLoadingSuites(false);
            }
        };
        fetchSuites();
        return () => { isCurrent = false; };
    }, []);

    // Load selected suite details and existing recommendations
    useEffect(() => {
        if (!selectedSuiteId) {
            setSelectedSuite(null);
            setRecommendations([]);
            setAnalysisSummary(null);
            return;
        }

        let isCurrent = true;
        const loadSuiteAndExistingRecs = async () => {
            try {
                const res = await sessionService.get(selectedSuiteId);
                if (isCurrent && res?.data) {
                    setSelectedSuite(res.data);
                }

                // Check for existing recommendations session
                const recRes = await recommendationService.getSuiteRecommendations(selectedSuiteId);
                if (isCurrent && recRes?.data) {
                    setRecommendations(recRes.data.recommendations || []);
                    setAnalysisSummary(recRes.data.analysisSummary || null);
                } else if (isCurrent) {
                    setRecommendations([]);
                    setAnalysisSummary(null);
                }
            } catch (err) {
                console.error('Error loading suite or recommendations:', err);
            }
        };

        loadSuiteAndExistingRecs();
        return () => { isCurrent = false; };
    }, [selectedSuiteId]);

    // Extract requirements from current selected suite
    const suiteRequirements = useMemo(() => {
        if (!selectedSuite) return [];
        const suiteData = selectedSuite.suiteData || selectedSuite.suite_data || selectedSuite.data || {};
        const reqs = [];

        const candidatePaths = [
            suiteData?.understanding?.functional_requirements,
            suiteData?.requirements,
            suiteData?.traceability?.matrix,
            suiteData?.functionalRequirements
        ];

        for (const path of candidatePaths) {
            if (Array.isArray(path) && path.length > 0) {
                path.forEach((r, idx) => {
                    if (!r) return;
                    reqs.push({
                        id: r.id || r.reqId || `REQ_${idx + 1}`,
                        title: r.title || r.name || r.summary || `Requirement ${r.id || idx + 1}`
                    });
                });
                break;
            }
        }

        if (reqs.length === 0 && selectedSuite.title) {
            reqs.push({
                id: 'REQ_001',
                title: selectedSuite.title
            });
        }

        return reqs;
    }, [selectedSuite]);

    // Toggle Category Filter
    const toggleCategory = (cat) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    // Toggle Expand Card Details
    const toggleExpandCard = (id) => {
        setExpandedCards(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Toggle Select Card
    const toggleSelectRec = (id) => {
        setSelectedRecIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Select All Filtered Recommendations
    const handleSelectAll = (filteredList) => {
        if (selectedRecIds.size === filteredList.length) {
            setSelectedRecIds(new Set());
        } else {
            setSelectedRecIds(new Set(filteredList.map(r => r.id)));
        }
    };

    // Generate Recommendations
    const handleGenerate = async () => {
        if (!selectedSuiteId) return;
        setIsGenerating(true);
        setGenerationError(null);
        setNotification(null);

        try {
            const result = await recommendationService.generate({
                suiteId: selectedSuiteId,
                requirementId: selectedRequirementId === 'all' ? null : selectedRequirementId,
                requestedCategories: selectedCategories.length > 0 ? selectedCategories : null,
                focusArea: focusArea.trim() || null,
                limit: 6
            });

            if (result?.data) {
                setRecommendations(result.data.recommendations || []);
                setAnalysisSummary(result.data.summary || null);
                setSelectedRecIds(new Set());
                setNotification({
                    type: 'success',
                    message: `Successfully generated ${result.data.recommendations.length} test scenario recommendations.`
                });
            }
        } catch (err) {
            console.error('Failed to generate recommendations:', err);
            setGenerationError(err.message || 'Failed to generate recommendations. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Update Single Recommendation Status (Accept / Reject)
    const handleUpdateStatus = async (recId, nextStatus) => {
        try {
            const res = await recommendationService.update(recId, { status: nextStatus });
            if (res?.data) {
                setRecommendations(prev =>
                    prev.map(r => r.id === recId ? { ...r, status: nextStatus } : r)
                );
            }
        } catch (err) {
            console.error('Failed to update recommendation status:', err);
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (rec) => {
        setEditingRec(rec);
        setEditForm({
            title: rec.title,
            priority: rec.priority,
            preconditions: rec.preconditions || '',
            steps: Array.isArray(rec.steps) ? rec.steps.join('\n') : String(rec.steps || ''),
            expectedResult: rec.expectedResult || '',
            testData: rec.testData || ''
        });
    };

    // Save Edit Form
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingRec) return;

        const editedFields = {
            title: editForm.title.trim(),
            priority: editForm.priority,
            preconditions: editForm.preconditions.trim(),
            steps: editForm.steps.split('\n').map(s => s.trim()).filter(Boolean),
            expectedResult: editForm.expectedResult.trim(),
            testData: editForm.testData.trim()
        };

        try {
            const res = await recommendationService.update(editingRec.id, {
                status: 'accepted',
                editedFields
            });

            if (res?.data) {
                setRecommendations(prev =>
                    prev.map(r => r.id === editingRec.id ? { ...r, ...editedFields, status: 'accepted' } : r)
                );
                setEditingRec(null);
                setNotification({
                    type: 'success',
                    message: 'Recommendation updated and marked as accepted.'
                });
            }
        } catch (err) {
            console.error('Failed to save edited recommendation:', err);
        }
    };

    // Convert Selected Recommendations to Draft Cases
    const handleConvertDrafts = async () => {
        if (!selectedSuiteId || selectedRecIds.size === 0) return;
        setIsConverting(true);

        try {
            const res = await recommendationService.convertToDrafts({
                suiteId: selectedSuiteId,
                recommendationIds: Array.from(selectedRecIds)
            });

            if (res?.data) {
                const results = res.data.results || [];
                const successfulIds = new Set(results.filter(r => r.success).map(r => r.id));

                setRecommendations(prev =>
                    prev.map(r => {
                        if (successfulIds.has(r.id)) {
                            const resObj = results.find(res => res.id === r.id);
                            return {
                                ...r,
                                status: 'converted',
                                convertedTestCaseId: resObj?.testCaseId
                            };
                        }
                        return r;
                    })
                );

                setSelectedRecIds(new Set());
                setShowConfirmConvert(false);
                setNotification({
                    type: 'success',
                    message: `Added ${res.data.convertedCount} recommendations as DRAFT test cases in "${selectedSuite?.title || 'Suite'}". Ready for review!`
                });
            }
        } catch (err) {
            console.error('Failed to convert recommendations:', err);
            setGenerationError(err.message || 'Failed to convert recommendations to draft test cases.');
        } finally {
            setIsConverting(false);
        }
    };

    // Filtered Recommendations List
    const filteredRecommendations = useMemo(() => {
        return recommendations.filter(rec => {
            if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
            if (categoryFilter !== 'all' && rec.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = rec.title.toLowerCase().includes(q);
                const reqMatch = (rec.relatedRequirementTitle || '').toLowerCase().includes(q);
                const reasonMatch = (rec.recommendationReason || '').toLowerCase().includes(q);
                if (!titleMatch && !reqMatch && !reasonMatch) return false;
            }
            return true;
        });
    }, [recommendations, statusFilter, categoryFilter, searchQuery]);

    const acceptedCount = useMemo(() => {
        return recommendations.filter(r => r.status === 'accepted').length;
    }, [recommendations]);

    if (isLoadingSuites) {
        return (
            <div className="smart-recommendations-page">
                <DataLoadingState
                    message="Initializing Smart Recommendations intelligence..."
                    telemetryTag="RECOMMENDATIONS"
                    skeletonType="metrics-detail"
                />
            </div>
        );
    }

    return (
        <div className="smart-recommendations-page">
            {/* Breadcrumbs */}
            <div className="sr-breadcrumbs">
                <Link to="/app/workspace">Workspace</Link>
                <span>/</span>
                <Link to="/app/test-suites">Test Suites</Link>
                <span>/</span>
                <span>Smart Recommendations</span>
            </div>

            {/* Header */}
            <header className="sr-header">
                <div className="sr-header__title-area">
                    <h1>
                        <Sparkles size={24} />
                        Smart Test Recommendations
                    </h1>
                    <p>
                        Analyze requirements, existing test coverage, and execution history to discover high-value negative, boundary, security, and edge test scenarios.
                    </p>
                </div>
            </header>

            {/* Notification / Toast */}
            {notification && (
                <div className="sr-observations-box" style={{ marginBottom: '1.25rem' }}>
                    <CheckCircle2 size={18} />
                    <div>{notification.message}</div>
                </div>
            )}

            {/* Error Message */}
            {generationError && (
                <div className="sr-observations-box" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', borderLeftColor: '#EF4444', marginBottom: '1.25rem' }}>
                    <AlertTriangle size={18} style={{ color: '#EF4444' }} />
                    <div style={{ color: '#FCA5A5' }}>{generationError}</div>
                </div>
            )}

            {/* Suite & Requirement Context Configuration */}
            <div className="sr-context-card">
                <div className="sr-context-row">
                    <div className="sr-field-group">
                        <label>Target Test Suite</label>
                        <select
                            className="sr-select"
                            value={selectedSuiteId}
                            onChange={(e) => setSelectedSuiteId(e.target.value)}
                        >
                            {suites.map(s => (
                                <option key={s.id || s._id} value={s.id || s._id}>
                                    {s.title || 'Untitled Suite'}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="sr-field-group">
                        <label>Focus Requirement</label>
                        <select
                            className="sr-select"
                            value={selectedRequirementId}
                            onChange={(e) => setSelectedRequirementId(e.target.value)}
                        >
                            <option value="all">All Suite Requirements</option>
                            {suiteRequirements.map(r => (
                                <option key={r.id} value={r.id}>
                                    [{r.id}] {r.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="sr-field-group" style={{ flex: 1.5 }}>
                        <label>QA Focus Area (Optional)</label>
                        <input
                            type="text"
                            className="sr-input"
                            placeholder="e.g., Security, edge boundary cases, error declines"
                            value={focusArea}
                            onChange={(e) => setFocusArea(e.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        className="sr-btn-primary"
                        onClick={handleGenerate}
                        disabled={isGenerating || !selectedSuiteId}
                    >
                        {isGenerating ? (
                            <>
                                <RefreshCw size={15} className="spin-animate" />
                                <span>Analyzing & Recommending...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={15} />
                                <span>Generate Recommendations</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Category Pills */}
                <div className="sr-categories-wrap">
                    <span className="sr-categories-label">Preferred Test Categories (Optional Filter)</span>
                    <div className="sr-pills">
                        {AVAILABLE_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                className={`sr-pill-btn ${selectedCategories.includes(cat) ? 'active' : ''}`}
                                onClick={() => toggleCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Analysis Summary (Shown when recommendations exist) */}
            {analysisSummary && (
                <>
                    <div className="sr-summary-grid">
                        <div className="sr-stat-card">
                            <div className="sr-stat-header">
                                <span>Requirements Analyzed</span>
                                <FileText size={15} />
                            </div>
                            <div className="sr-stat-value">{analysisSummary.requirementsAnalyzed}</div>
                            <div className="sr-stat-desc">Functional specifications reviewed</div>
                        </div>

                        <div className="sr-stat-card">
                            <div className="sr-stat-header">
                                <span>Existing Tests Reviewed</span>
                                <Layers size={15} />
                            </div>
                            <div className="sr-stat-value">{analysisSummary.existingTestCasesReviewed}</div>
                            <div className="sr-stat-desc">Compared for duplication</div>
                        </div>

                        <div className="sr-stat-card">
                            <div className="sr-stat-header">
                                <span>Coverage Gaps Found</span>
                                <AlertCircle size={15} />
                            </div>
                            <div className="sr-stat-value" style={{ color: '#FCD34D' }}>
                                {analysisSummary.potentialCoverageGapsIdentified}
                            </div>
                            <div className="sr-stat-desc">Untested paths or missing negatives</div>
                        </div>

                        <div className="sr-stat-card">
                            <div className="sr-stat-header">
                                <span>Scenarios Generated</span>
                                <Sparkles size={15} />
                            </div>
                            <div className="sr-stat-value" style={{ color: '#8BAF9A' }}>
                                {analysisSummary.recommendationsGenerated}
                            </div>
                            <div className="sr-stat-desc">{acceptedCount} accepted for draft suite</div>
                        </div>
                    </div>

                    {/* AI Observations Callout */}
                    {analysisSummary.keyObservations && (
                        <div className="sr-observations-box">
                            <Info size={17} />
                            <div>
                                <strong style={{ color: '#8BAF9A' }}>QA Architecture Insight: </strong>
                                {analysisSummary.keyObservations}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Recommendations Explorer Toolbar */}
            {recommendations.length > 0 && (
                <div className="sr-toolbar">
                    <div className="sr-toolbar__filters">
                        <div className="sr-search-wrap">
                            <Search size={14} />
                            <input
                                type="text"
                                className="sr-search-input"
                                placeholder="Search recommendations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <select
                            className="sr-filter-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending Review</option>
                            <option value="accepted">Accepted</option>
                            <option value="rejected">Rejected</option>
                            <option value="converted">Converted to Draft</option>
                        </select>

                        <select
                            className="sr-filter-select"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="all">All Categories</option>
                            {AVAILABLE_CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="sr-toolbar__actions">
                        {selectedRecIds.size > 0 && (
                            <span className="sr-bulk-counter">
                                {selectedRecIds.size} selected
                            </span>
                        )}

                        <button
                            type="button"
                            className="sr-btn-secondary"
                            onClick={() => handleSelectAll(filteredRecommendations)}
                        >
                            {selectedRecIds.size === filteredRecommendations.length ? 'Deselect All' : 'Select All'}
                        </button>

                        <button
                            type="button"
                            className="sr-btn-primary"
                            disabled={selectedRecIds.size === 0}
                            onClick={() => setShowConfirmConvert(true)}
                        >
                            <PlusCircle size={15} />
                            <span>Add Selected as Draft Test Cases</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Recommendations Card List */}
            {filteredRecommendations.length > 0 ? (
                <div className="sr-cards-list">
                    {filteredRecommendations.map((rec) => {
                        const isExpanded = expandedCards.has(rec.id);
                        const isSelected = selectedRecIds.has(rec.id);

                        return (
                            <div
                                key={rec.id}
                                className={`sr-card is-${rec.status} ${rec.isDuplicate ? 'is-duplicate' : ''}`}
                            >
                                <div className="sr-card__header">
                                    <div className="sr-card__title-row">
                                        <input
                                            type="checkbox"
                                            className="sr-checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectRec(rec.id)}
                                            aria-label={`Select ${rec.title}`}
                                        />
                                        <div>
                                            <h3>{rec.title}</h3>
                                            <div className="sr-card__meta-tags">
                                                <span className="sr-badge sr-badge--category">
                                                    {rec.category}
                                                </span>
                                                <span className={`sr-badge sr-badge--priority-${(rec.priority || 'medium').toLowerCase()}`}>
                                                    {rec.priority}
                                                </span>
                                                <span className="sr-req-tag">
                                                    {rec.relatedRequirementId}
                                                </span>
                                                <span className={`sr-badge ${rec.isDuplicate ? 'sr-badge--duplicate' : 'sr-badge--gap'}`}>
                                                    {rec.coverageStatus}
                                                </span>
                                                <span className={`sr-badge sr-badge--status sr-badge--status-${rec.status}`}>
                                                    {rec.status.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Rationale & Gap Explanation */}
                                <div className="sr-card__rationale">
                                    <div className="sr-rationale-item">
                                        <strong>Why Recommended</strong>
                                        <p>{rec.recommendationReason}</p>
                                    </div>
                                    <div className="sr-rationale-item">
                                        <strong>Coverage Gap Addressed</strong>
                                        <p>{rec.coverageGapAddressed}</p>
                                    </div>
                                </div>

                                {/* Expandable Execution Details */}
                                {isExpanded && (
                                    <div className="sr-card__details">
                                        <div className="sr-detail-group">
                                            <span className="sr-detail-label">Preconditions</span>
                                            <p style={{ margin: 0, color: '#CBD5E1' }}>{rec.preconditions}</p>
                                        </div>

                                        <div className="sr-detail-group">
                                            <span className="sr-detail-label">Execution Steps</span>
                                            <ol className="sr-steps-list">
                                                {Array.isArray(rec.steps) ? rec.steps.map((st, i) => (
                                                    <li key={i}>{st}</li>
                                                )) : <li>{rec.steps}</li>}
                                            </ol>
                                        </div>

                                        <div className="sr-detail-group">
                                            <span className="sr-detail-label">Expected Result</span>
                                            <p className="sr-expected-box">{rec.expectedResult}</p>
                                        </div>

                                        {rec.testData && (
                                            <div className="sr-detail-group">
                                                <span className="sr-detail-label">Suggested Test Data</span>
                                                <code style={{ background: '#171E25', padding: '0.2rem 0.4rem', borderRadius: '4px', color: '#94A3B8' }}>
                                                    {rec.testData}
                                                </code>
                                            </div>
                                        )}

                                        {rec.assumptions && (
                                            <div className="sr-detail-group">
                                                <span className="sr-detail-label" style={{ color: '#FCD34D' }}>AI Assumptions</span>
                                                <p style={{ margin: 0, color: '#94A3B8', fontStyle: 'italic' }}>{rec.assumptions}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Card Actions */}
                                <div className="sr-card__actions">
                                    <button
                                        type="button"
                                        className="sr-btn-secondary"
                                        onClick={() => toggleExpandCard(rec.id)}
                                    >
                                        {isExpanded ? (
                                            <>
                                                <span>Hide Details</span>
                                                <ChevronUp size={13} />
                                            </>
                                        ) : (
                                            <>
                                                <span>Inspect Details</span>
                                                <ChevronDown size={13} />
                                            </>
                                        )}
                                    </button>

                                    <div className="sr-action-group">
                                        {rec.status === 'converted' ? (
                                            <span style={{ fontSize: '0.78rem', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <CheckCircle2 size={14} />
                                                Draft Case: <code>{rec.convertedTestCaseId}</code>
                                            </span>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className="sr-btn-edit"
                                                    onClick={() => handleOpenEdit(rec)}
                                                    title="Edit recommendation"
                                                >
                                                    <Edit3 size={13} />
                                                    <span>Edit</span>
                                                </button>

                                                {rec.status !== 'rejected' && (
                                                    <button
                                                        type="button"
                                                        className="sr-btn-reject"
                                                        onClick={() => handleUpdateStatus(rec.id, 'rejected')}
                                                        title="Reject recommendation"
                                                    >
                                                        <XCircle size={13} />
                                                        <span>Reject</span>
                                                    </button>
                                                )}

                                                {rec.status !== 'accepted' && (
                                                    <button
                                                        type="button"
                                                        className="sr-btn-accept"
                                                        onClick={() => handleUpdateStatus(rec.id, 'accepted')}
                                                        title="Accept recommendation"
                                                    >
                                                        <Check size={13} />
                                                        <span>Accept</span>
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                !isGenerating && (
                    <div className="sr-empty-state">
                        <div className="sr-empty-icon">
                            <Sparkles size={24} />
                        </div>
                        <h3>No Recommendations Generated Yet</h3>
                        <p>
                            Select a test suite and click <strong>"Generate Recommendations"</strong>. TestNexa AI will cross-examine your requirements and existing tests to surface critical gaps.
                        </p>
                        <button
                            type="button"
                            className="sr-btn-primary"
                            onClick={handleGenerate}
                            disabled={!selectedSuiteId}
                        >
                            <Sparkles size={15} />
                            <span>Analyze and Recommend Scenarios</span>
                        </button>
                    </div>
                )
            )}

            {/* Edit Recommendation Modal */}
            {editingRec && (
                <div className="sr-modal-backdrop" onClick={() => setEditingRec(null)}>
                    <div className="sr-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="sr-modal__header">
                            <h2>Edit Recommendation Scenario</h2>
                            <button
                                type="button"
                                className="sr-modal__close"
                                onClick={() => setEditingRec(null)}
                            >
                                ×
                            </button>
                        </header>
                        <form onSubmit={handleSaveEdit}>
                            <div className="sr-modal__body">
                                <div className="sr-form-group">
                                    <label>Scenario Title</label>
                                    <input
                                        type="text"
                                        className="sr-form-input"
                                        value={editForm.title}
                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="sr-form-group">
                                    <label>Priority</label>
                                    <select
                                        className="sr-select"
                                        value={editForm.priority}
                                        onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                                    >
                                        <option value="Critical">Critical</option>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>

                                <div className="sr-form-group">
                                    <label>Preconditions</label>
                                    <input
                                        type="text"
                                        className="sr-form-input"
                                        value={editForm.preconditions}
                                        onChange={(e) => setEditForm({ ...editForm, preconditions: e.target.value })}
                                    />
                                </div>

                                <div className="sr-form-group">
                                    <label>Execution Steps (1 per line)</label>
                                    <textarea
                                        rows="4"
                                        className="sr-form-textarea"
                                        value={editForm.steps}
                                        onChange={(e) => setEditForm({ ...editForm, steps: e.target.value })}
                                    />
                                </div>

                                <div className="sr-form-group">
                                    <label>Expected Result</label>
                                    <textarea
                                        rows="2"
                                        className="sr-form-textarea"
                                        value={editForm.expectedResult}
                                        onChange={(e) => setEditForm({ ...editForm, expectedResult: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="sr-form-group">
                                    <label>Test Data</label>
                                    <input
                                        type="text"
                                        className="sr-form-input"
                                        value={editForm.testData}
                                        onChange={(e) => setEditForm({ ...editForm, testData: e.target.value })}
                                    />
                                </div>
                            </div>

                            <footer className="sr-modal__footer">
                                <button
                                    type="button"
                                    className="sr-btn-secondary"
                                    onClick={() => setEditingRec(null)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="sr-btn-primary">
                                    Save & Accept
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Convert Confirmation Modal */}
            {showConfirmConvert && (
                <div className="sr-modal-backdrop" onClick={() => setShowConfirmConvert(false)}>
                    <div className="sr-modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                        <header className="sr-modal__header">
                            <h2>Add to Suite as Draft Test Cases</h2>
                            <button
                                type="button"
                                className="sr-modal__close"
                                onClick={() => setShowConfirmConvert(false)}
                            >
                                ×
                            </button>
                        </header>
                        <div className="sr-modal__body">
                            <p style={{ color: '#CBD5E1', fontSize: '0.875rem', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
                                You are about to add <strong>{selectedRecIds.size} recommendation(s)</strong> to test suite:
                            </p>
                            <div style={{ background: '#0B0E11', border: '1px solid #1E293B', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
                                <strong style={{ color: '#F8FAFC', fontSize: '0.9rem' }}>
                                    {selectedSuite?.title || 'Selected Test Suite'}
                                </strong>
                            </div>
                            <div className="sr-observations-box" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)', borderLeftColor: '#38BDF8' }}>
                                <ShieldCheck size={18} style={{ color: '#38BDF8' }} />
                                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                                    <strong>Human Review Safeguard:</strong> The generated scenarios will be saved strictly with <strong>"Draft"</strong> status in the suite so QA engineers can inspect and approve them prior to execution.
                                </div>
                            </div>
                        </div>
                        <footer className="sr-modal__footer">
                            <button
                                type="button"
                                className="sr-btn-secondary"
                                onClick={() => setShowConfirmConvert(false)}
                                disabled={isConverting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="sr-btn-primary"
                                onClick={handleConvertDrafts}
                                disabled={isConverting}
                            >
                                {isConverting ? (
                                    <>
                                        <RefreshCw size={14} className="spin-animate" />
                                        <span>Adding Drafts...</span>
                                    </>
                                ) : (
                                    <span>Confirm & Add as Drafts</span>
                                )}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmartRecommendationsPage;
