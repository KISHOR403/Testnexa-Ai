import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
    Sparkles, ShieldCheck, AlertTriangle, Layers, CheckCircle2, XCircle,
    Edit3, PlusCircle, Search, Filter, RefreshCw, ChevronDown, ChevronUp,
    ArrowRight, Info, AlertCircle, FileText, Check, ShieldAlert, X,
    ExternalLink, RotateCcw, HelpCircle, ArrowUpRight
} from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import { recommendationService } from '../../services/recommendationService';
import '../../styles/app/SmartRecommendations.css';

const SHARED_CATEGORIES = [
    'Functional', 'Negative', 'Edge', 'Non-functional', 'Security', 'API'
];

const PRIORITY_ORDER = {
    'Critical': 4,
    'High': 3,
    'Medium': 2,
    'Low': 1
};

export default function SmartRecommendationsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Query parameters
    const querySuiteId = searchParams.get('suite') || searchParams.get('suiteId') || '';
    const queryRequirement = searchParams.get('requirement') || searchParams.get('reqId') || '';
    const queryCategories = searchParams.get('categories') || searchParams.get('category') || '';
    const queryGap = searchParams.get('gap') || searchParams.get('fromGap') || '';

    // Suite Selection State
    const [suites, setSuites] = useState([]);
    const [isLoadingSuites, setIsLoadingSuites] = useState(true);
    const [selectedSuiteId, setSelectedSuiteId] = useState(querySuiteId);
    const [suiteSearch, setSuiteSearch] = useState('');
    const [isSuiteComboboxOpen, setIsSuiteComboboxOpen] = useState(false);
    const suiteComboboxRef = useRef(null);

    // Context & Form Configuration State
    const [contextLoading, setContextLoading] = useState(false);
    const [suiteContext, setSuiteContext] = useState(null);
    const [selectedRequirementId, setSelectedRequirementId] = useState(queryRequirement || 'all');
    const [focusArea, setFocusArea] = useState('');
    const [selectedCategories, setSelectedCategories] = useState(() => {
        if (!queryCategories) return [];
        return queryCategories.split(',').map(c => c.trim()).filter(Boolean);
    });

    // Deep link gap indicator
    const [gapOriginNote, setGapOriginNote] = useState(() => {
        if (queryGap) return queryGap;
        if (queryRequirement) return `From gap: Focus on requirement ${queryRequirement}`;
        return '';
    });

    // In-memory Generation State (NEVER persisted to DB until Add is clicked)
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState(null);
    const [rateLimitCountdown, setRateLimitCountdown] = useState(null);
    const [noGapsFound, setNoGapsFound] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [analysisSummary, setAnalysisSummary] = useState(null);
    const abortControllerRef = useRef(null);

    // Filter State
    const [activeStatusTab, setActiveStatusTab] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterRequirement, setFilterRequirement] = useState('all');

    // Result Card & Selection State
    const [selectedRecIds, setSelectedRecIds] = useState(new Set());
    const [addedRecIds, setAddedRecIds] = useState(new Set());
    const [expandedCards, setExpandedCards] = useState(new Set());
    const [expandedScenarios, setExpandedScenarios] = useState(new Set());
    const [sortOption, setSortOption] = useState('priority-desc');

    // Inline Edit Drawer / Sheet State
    const [editingRec, setEditingRec] = useState(null);
    const [editForm, setEditForm] = useState({
        title: '',
        priority: 'Medium',
        steps: '',
        expectedResult: '',
        recommendationReason: ''
    });

    // Accept & Undo Toast State
    const [isAdding, setIsAdding] = useState(false);
    const [toast, setToast] = useState(null);
    const [skippedDuplicates, setSkippedDuplicates] = useState([]);
    const [liveAnnouncement, setLiveAnnouncement] = useState('');

    // Leave Protection State
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [pendingNavigationHref, setPendingNavigationHref] = useState(null);

    // Selected suite object
    const selectedSuite = useMemo(() => {
        return suites.find(s => (s.id || s._id) === selectedSuiteId) || null;
    }, [suites, selectedSuiteId]);

    // Unadded recommendations count for leave protection
    const unaddedCount = useMemo(() => {
        return recommendations.filter(r => !addedRecIds.has(r.id) && (r.status || '').toUpperCase() === 'SUGGESTED').length;
    }, [recommendations, addedRecIds]);

    // Fetch user test suites on mount
    useEffect(() => {
        let isMounted = true;
        const fetchSuites = async () => {
            setIsLoadingSuites(true);
            try {
                const res = await sessionService.list({ limit: 50 });
                if (isMounted && res?.data) {
                    setSuites(res.data);
                    if (!selectedSuiteId && res.data.length > 0) {
                        const firstId = res.data[0].id || res.data[0]._id;
                        setSelectedSuiteId(firstId);
                    }
                }
            } catch (err) {
                console.error('Failed to load test suites:', err);
            } finally {
                if (isMounted) setIsLoadingSuites(false);
            }
        };
        fetchSuites();
        return () => { isMounted = false; };
    }, []);

    // Load suite context and persisted recommendations when selectedSuiteId changes
    useEffect(() => {
        if (!selectedSuiteId) {
            setSuiteContext(null);
            setRecommendations([]);
            return;
        }

        let isMounted = true;
        const loadContextAndRecs = async () => {
            setContextLoading(true);
            try {
                const [ctxRes, recsRes] = await Promise.allSettled([
                    recommendationService.getContext(selectedSuiteId),
                    recommendationService.getSuiteRecommendations(selectedSuiteId)
                ]);

                if (isMounted && ctxRes.status === 'fulfilled' && ctxRes.value?.data) {
                    setSuiteContext(ctxRes.value.data);
                    if (queryRequirement) {
                        const exists = ctxRes.value.data.requirements?.some(r => r.id === queryRequirement);
                        setSelectedRequirementId(exists ? queryRequirement : 'all');
                    }
                }

                if (isMounted && recsRes.status === 'fulfilled' && recsRes.value?.data) {
                    const loaded = recsRes.value.data.recommendations || [];
                    if (loaded.length > 0) {
                        setRecommendations(loaded);
                        const added = new Set(
                            loaded.filter(r => (r.status || '').toUpperCase() === 'ADDED' || (r.status || '').toLowerCase() === 'converted')
                                .map(r => r.id)
                        );
                        setAddedRecIds(added);
                        if (recsRes.value.data.analysisSummary) {
                            setAnalysisSummary(recsRes.value.data.analysisSummary);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load suite data:', err);
            } finally {
                if (isMounted) setContextLoading(false);
            }
        };

        loadContextAndRecs();
        return () => { isMounted = false; };
    }, [selectedSuiteId, queryRequirement]);

    // Update URL query param when suite changes
    const handleSelectSuite = useCallback((id) => {
        setSelectedSuiteId(id);
        setIsSuiteComboboxOpen(false);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (id) next.set('suite', id);
            else next.delete('suite');
            next.delete('suiteId');
            return next;
        }, { replace: true });
        setRecommendations([]);
        setAddedRecIds(new Set());
        setSelectedRecIds(new Set());
        setAnalysisSummary(null);
        setGenerationError(null);
        setNoGapsFound(false);
    }, [setSearchParams]);

    // Close combobox when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (suiteComboboxRef.current && !suiteComboboxRef.current.contains(e.target)) {
                setIsSuiteComboboxOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filtered suites for combobox search
    const filteredSuites = useMemo(() => {
        if (!suiteSearch.trim()) return suites;
        const q = suiteSearch.toLowerCase();
        return suites.filter(s => {
            const title = (s.title || s.suiteData?.testSuiteName || '').toLowerCase();
            const platform = (s.platform || s.suiteData?.platform || '').toLowerCase();
            return title.includes(q) || platform.includes(q);
        });
    }, [suites, suiteSearch]);

    // Toggle Category Chip
    const handleToggleCategory = (category) => {
        setSelectedCategories(prev => {
            if (prev.includes(category)) {
                return prev.filter(c => c !== category);
            } else {
                return [...prev, category];
            }
        });
    };

    // Clear form filters
    const handleClearForm = () => {
        setSelectedRequirementId('all');
        setFocusArea('');
        setSelectedCategories([]);
        setGapOriginNote('');
    };

    // Apply Gap Hint shortcut
    const handleApplyGapShortcut = (shortcut) => {
        if (shortcut.requirementId && shortcut.requirementId !== 'all') {
            setSelectedRequirementId(shortcut.requirementId);
        } else {
            setSelectedRequirementId('all');
        }
        if (Array.isArray(shortcut.categories)) {
            setSelectedCategories(shortcut.categories);
        }
        setGapOriginNote(`Applied gap shortcut: ${shortcut.label}`);
    };

    // Generate Recommendations (in-memory only, cancelable)
    const handleGenerate = async () => {
        if (!selectedSuiteId || isGenerating) return;

        setIsGenerating(true);
        setGenerationError(null);
        setRateLimitCountdown(null);
        setNoGapsFound(false);
        setSkippedDuplicates([]);
        setLiveAnnouncement('Generating recommendations for this suite...');

        // Set up AbortController
        abortControllerRef.current = new AbortController();

        try {
            const res = await recommendationService.generate({
                suiteId: selectedSuiteId,
                requirementId: selectedRequirementId === 'all' ? null : selectedRequirementId,
                requestedCategories: selectedCategories.length > 0 ? selectedCategories : null,
                focusArea: focusArea.trim() || null,
                limit: 6,
                signal: abortControllerRef.current.signal
            });

            if (res?.data) {
                const recs = res.data.recommendations || [];
                if (recs.length === 0) {
                    setNoGapsFound(true);
                    setRecommendations([]);
                    setLiveAnnouncement('No coverage gaps found for the selected requirements.');
                } else {
                    setRecommendations(recs);
                    setAnalysisSummary(res.data.summary || null);
                    setSelectedRecIds(new Set());
                    setLiveAnnouncement(`Generated ${recs.length} smart test scenario recommendations.`);
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                setLiveAnnouncement('Recommendation generation cancelled.');
                return;
            }
            console.error('Generation error:', err);
            if (err.status === 429) {
                setRateLimitCountdown(60);
                setGenerationError('AI recommendation rate limit reached. Please wait a moment before retrying.');
            } else if (err.message && err.message.toLowerCase().includes('timeout')) {
                setGenerationError('Request timed out while analyzing test suite requirements. Please retry.');
            } else {
                setGenerationError(err.message || 'Failed to generate recommendations. Please try again.');
            }
            setLiveAnnouncement('Error generating recommendations.');
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    // Cancel in-flight generation
    const handleCancelGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsGenerating(false);
        }
    };

    // Card expand / collapse steps
    const handleToggleSteps = (id) => {
        setExpandedCards(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Card expand / collapse scenario description
    const handleToggleScenario = (id) => {
        setExpandedScenarios(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Card selection toggle
    const handleToggleSelectCard = (id) => {
        setSelectedRecIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Select all / Deselect all
    const handleSelectAll = () => {
        const selectable = recommendations.filter(r => !addedRecIds.has(r.id));
        if (selectedRecIds.size === selectable.length) {
            setSelectedRecIds(new Set());
        } else {
            setSelectedRecIds(new Set(selectable.map(r => r.id)));
        }
    };

    // Dismiss single recommendation (syncs to backend if persisted)
    const handleDismissSingle = async (id) => {
        try {
            await recommendationService.update(id, { status: 'DISMISSED' });
        } catch (_) {}
        setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status: 'DISMISSED' } : r));
        setSelectedRecIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        setLiveAnnouncement('Recommendation dismissed.');
    };

    // Dismiss selected recommendations
    const handleDismissSelected = async () => {
        const idsToDismiss = Array.from(selectedRecIds);
        if (idsToDismiss.length === 0) return;
        try {
            await recommendationService.bulkDismiss({ recommendationIds: idsToDismiss });
        } catch (_) {}
        setRecommendations(prev => prev.map(r => idsToDismiss.includes(r.id) ? { ...r, status: 'DISMISSED' } : r));
        setSelectedRecIds(new Set());
        setLiveAnnouncement(`Dismissed ${idsToDismiss.length} recommendations.`);
    };

    // Export selected suggestions as JSON or CSV
    const handleExportSelected = (format = 'json') => {
        const targetRecs = recommendations.filter(r => selectedRecIds.has(r.id));
        if (targetRecs.length === 0) return;

        if (format === 'json') {
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(targetRecs, null, 2));
            const dl = document.createElement('a');
            dl.setAttribute('href', dataStr);
            dl.setAttribute('download', `smart_recommendations_${selectedSuiteId || 'export'}.json`);
            dl.click();
        } else if (format === 'csv') {
            const headers = ['ID', 'Title', 'Category', 'Priority', 'Requirement', 'Status', 'Why This Test', 'Expected Result'];
            const rows = targetRecs.map(r => [
                r.id,
                `"${(r.title || '').replace(/"/g, '""')}"`,
                r.category || 'Functional',
                r.priority || 'Medium',
                r.requirementId || r.relatedRequirementId || '',
                r.status || 'SUGGESTED',
                `"${(r.whyThisTest || r.recommendationReason || '').replace(/"/g, '""')}"`,
                `"${(r.expectedResult || '').replace(/"/g, '""')}"`
            ]);
            const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
            const dl = document.createElement('a');
            dl.setAttribute('href', encodeURI(csvContent));
            dl.setAttribute('download', `smart_recommendations_${selectedSuiteId || 'export'}.csv`);
            dl.click();
        }
        setLiveAnnouncement(`Exported ${targetRecs.length} recommendations as ${format.toUpperCase()}.`);
    };

    // Open Edit Drawer
    const handleOpenEdit = (rec) => {
        setEditingRec(rec);
        setEditForm({
            title: rec.title || '',
            priority: rec.priority || 'Medium',
            steps: Array.isArray(rec.steps) ? rec.steps.join('\n') : String(rec.steps || ''),
            expectedResult: rec.expectedResult || '',
            recommendationReason: rec.whyThisTest || rec.recommendationReason || ''
        });
    };

    // Save Edit Form (syncs with backend)
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingRec) return;

        const updatedSteps = editForm.steps
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean);

        const editedFields = {
            title: editForm.title.trim() || editingRec.title,
            priority: editForm.priority,
            steps: updatedSteps.length > 0 ? updatedSteps : editingRec.steps,
            expectedResult: editForm.expectedResult.trim() || editingRec.expectedResult,
            reason: editForm.recommendationReason.trim() || editingRec.reason || ''
        };

        try {
            await recommendationService.update(editingRec.id, { editedFields });
        } catch (_) {}

        setRecommendations(prev => prev.map(r => {
            if (r.id === editingRec.id) {
                return {
                    ...r,
                    ...editedFields,
                    whyThisTest: editedFields.reason,
                    recommendationReason: editedFields.reason
                };
            }
            return r;
        }));

        setEditingRec(null);
        setLiveAnnouncement('Recommendation updated.');
    };

    // Close Edit Drawer on Esc key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && editingRec) {
                setEditingRec(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingRec]);

    // Accept / Add to suite (Single or Selected) with Idempotency
    const handleAcceptRecommendations = async (recsToAdd) => {
        if (!selectedSuiteId || recsToAdd.length === 0 || isAdding) return;

        setIsAdding(true);
        setSkippedDuplicates([]);
        const idempotencyKey = crypto.randomUUID();

        try {
            const res = await recommendationService.accept({
                suiteId: selectedSuiteId,
                recommendations: recsToAdd,
                idempotencyKey
            });

            if (res?.data) {
                const addedIds = (res.data.addedCases || []).map(c => c._recommendationId || c.id);
                // Also mark the recommendation IDs as added
                recsToAdd.forEach(r => addedIds.push(r.id));

                setAddedRecIds(prev => {
                    const next = new Set(prev);
                    addedIds.forEach(id => next.add(id));
                    return next;
                });

                // Clear from selected
                setSelectedRecIds(prev => {
                    const next = new Set(prev);
                    recsToAdd.forEach(r => next.delete(r.id));
                    return next;
                });

                if (res.data.skipped && res.data.skipped.length > 0) {
                    setSkippedDuplicates(res.data.skipped);
                }

                const count = res.data.convertedCount || recsToAdd.length;
                const undoToken = res.data.undoToken;
                const testCaseIds = (res.data.addedCases || []).map(c => c.id);
                const suiteTitle = selectedSuite?.title || 'suite';

                setToast({
                    message: `Added ${count} case${count > 1 ? 's' : ''} to ${suiteTitle}.`,
                    undoToken,
                    testCaseIds,
                    suiteId: selectedSuiteId,
                    addedCount: count,
                    recIds: recsToAdd.map(r => r.id)
                });

                setLiveAnnouncement(`Added ${count} test cases to suite.`);
            }
        } catch (err) {
            console.error('Error adding recommendations to suite:', err);
            setToast({
                message: err.message || 'Failed to add test cases to suite.',
                isError: true
            });
        } finally {
            setIsAdding(false);
        }
    };

    // Undo action
    const handleUndo = async () => {
        if (!toast || !toast.undoToken) return;

        try {
            const res = await recommendationService.undo({
                suiteId: toast.suiteId,
                undoToken: toast.undoToken,
                testCaseIds: toast.testCaseIds
            });

            if (res?.data) {
                // Unmark added IDs
                if (toast.recIds) {
                    setAddedRecIds(prev => {
                        const next = new Set(prev);
                        toast.recIds.forEach(id => next.delete(id));
                        return next;
                    });
                }
                setLiveAnnouncement(`Undone addition of ${res.data.removedCount} test cases.`);
                setToast({
                    message: `Undone addition of ${res.data.removedCount} test cases.`,
                    isInfo: true
                });
            }
        } catch (err) {
            console.error('Undo error:', err);
            setToast({
                message: err.message || 'Failed to undo test case addition.',
                isError: true
            });
        }
    };

    // Leave Protection: window beforeunload for page refresh/close
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (unaddedCount > 0) {
                e.preventDefault();
                e.returnValue = 'These recommendations are not saved.';
                return 'These recommendations are not saved.';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [unaddedCount]);

    // Leave Protection: in-app navigation interceptor
    useEffect(() => {
        if (unaddedCount === 0) return;

        const handleAnchorClick = (e) => {
            const link = e.target.closest('a');
            if (!link || !link.href) return;
            const targetUrl = new URL(link.href, window.location.origin);
            if (targetUrl.pathname !== location.pathname) {
                e.preventDefault();
                e.stopPropagation();
                setPendingNavigationHref(targetUrl.pathname + targetUrl.search + targetUrl.hash);
                setShowLeaveModal(true);
            }
        };

        document.addEventListener('click', handleAnchorClick, true);
        return () => document.removeEventListener('click', handleAnchorClick, true);
    }, [unaddedCount, location.pathname]);

    // Sorted recommendations
    const sortedRecommendations = useMemo(() => {
        const list = [...recommendations];
        if (sortOption === 'priority-desc') {
            list.sort((a, b) => (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0));
        } else if (sortOption === 'priority-asc') {
            list.sort((a, b) => (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0));
        } else if (sortOption === 'requirement') {
            list.sort((a, b) => String(a.relatedRequirementId || '').localeCompare(String(b.relatedRequirementId || '')));
        } else if (sortOption === 'title') {
            list.sort((a, b) => a.title.localeCompare(b.title));
        }
        return list;
    }, [recommendations, sortOption]);

    // Filtered recommendations by status tab, priority, category, requirement
    const filteredRecommendations = useMemo(() => {
        return sortedRecommendations.filter(rec => {
            // Status tab filter
            if (activeStatusTab !== 'all') {
                const normStatus = (rec.status || 'SUGGESTED').toUpperCase();
                const target = activeStatusTab.toUpperCase();
                if (target === 'SUGGESTED' && (normStatus === 'SUGGESTED' || normStatus === 'PENDING')) {
                    // match
                } else if (target === 'ADDED' && (normStatus === 'ADDED' || normStatus === 'CONVERTED' || addedRecIds.has(rec.id))) {
                    // match
                } else if (target === 'DISMISSED' && (normStatus === 'DISMISSED' || normStatus === 'REJECTED')) {
                    // match
                } else if (target === 'DUPLICATE' && (normStatus === 'DUPLICATE' || rec.isDuplicate)) {
                    // match
                } else if (normStatus !== target) {
                    return false;
                }
            }

            // Priority filter
            if (filterPriority !== 'all' && String(rec.priority).toLowerCase() !== filterPriority.toLowerCase()) {
                return false;
            }

            // Category filter
            if (filterCategory !== 'all' && String(rec.category).toLowerCase() !== filterCategory.toLowerCase()) {
                return false;
            }

            // Requirement filter
            if (filterRequirement !== 'all') {
                const rId = String(rec.requirementId || rec.relatedRequirementId || '').toLowerCase();
                if (rId !== filterRequirement.toLowerCase()) {
                    return false;
                }
            }

            return true;
        });
    }, [sortedRecommendations, activeStatusTab, filterPriority, filterCategory, filterRequirement, addedRecIds]);

    const hasStaleRecommendations = useMemo(() => {
        return recommendations.some(r => (r.status || '').toUpperCase() === 'EXPIRED');
    }, [recommendations]);

    return (
        <div className="sr-page-container">
            {/* Live Region for Screen Readers */}
            <div className="sr-sr-only" aria-live="polite" role="status">
                {liveAnnouncement}
            </div>

            {/* Header Section */}
            <header className="sr-header">
                <div className="sr-header__titles">
                    <h1 className="sr-title">Smart recommendations</h1>
                    <p className="sr-subtitle">
                        Find missing test scenarios based on your requirements and existing tests.
                    </p>
                    <p className="sr-saved-notice">
                        Recommendations are not saved until you add them to your suite.
                    </p>
                </div>
            </header>

            {/* Deep Link Gap Context Note */}
            {gapOriginNote && (
                <div className="sr-gap-origin-banner">
                    <div className="sr-gap-origin-content">
                        <AlertCircle size={15} className="sr-gap-origin-icon" />
                        <span>{gapOriginNote}</span>
                    </div>
                    <button
                        type="button"
                        className="sr-gap-origin-dismiss"
                        onClick={() => setGapOriginNote('')}
                        aria-label="Dismiss gap note"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Gap Hints Shortcuts (up to 3) */}
            {suiteContext?.gapShortcuts && suiteContext.gapShortcuts.length > 0 && (
                <div className="sr-gap-shortcuts-section">
                    <div className="sr-gap-shortcuts-label">Detected coverage gaps:</div>
                    <div className="sr-gap-shortcuts-list">
                        {suiteContext.gapShortcuts.map((shortcut) => (
                            <div key={shortcut.id} className="sr-gap-shortcut-card">
                                <span className="sr-gap-shortcut-text">{shortcut.label}</span>
                                <button
                                    type="button"
                                    className="sr-gap-shortcut-btn"
                                    onClick={() => handleApplyGapShortcut(shortcut)}
                                >
                                    Use
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Configuration Form Card */}
            <section className="sr-form-card" aria-label="Recommendation generation configuration">
                <div className="sr-form-grid">
                    {/* Suite Selector Combobox */}
                    <div className="sr-field-group" ref={suiteComboboxRef}>
                        <label className="sr-field-label" id="sr-suite-label">
                            Target test suite
                        </label>
                        <div className="sr-combobox-wrap">
                            <button
                                type="button"
                                className="sr-combobox-trigger"
                                onClick={() => setIsSuiteComboboxOpen(prev => !prev)}
                                aria-expanded={isSuiteComboboxOpen}
                                aria-labelledby="sr-suite-label"
                            >
                                <div className="sr-combobox-selection">
                                    <span className="sr-combobox-title">
                                        {selectedSuite?.title || (isLoadingSuites ? 'Loading suites...' : 'Select a test suite')}
                                    </span>
                                    {selectedSuite && (
                                        <div className="sr-combobox-meta">
                                            {selectedSuite.platform && (
                                                <span className="sr-meta-tag">{selectedSuite.platform}</span>
                                            )}
                                            <span className="sr-meta-count">
                                                {selectedSuite.summary?.total || selectedSuite.suiteData?.testCases?.length || 0} cases
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <ChevronDown size={16} className={`sr-combobox-arrow ${isSuiteComboboxOpen ? 'open' : ''}`} />
                            </button>

                            {isSuiteComboboxOpen && (
                                <div className="sr-combobox-dropdown" role="listbox">
                                    <div className="sr-combobox-search-box">
                                        <Search size={14} />
                                        <input
                                            type="text"
                                            className="sr-combobox-search-input"
                                            placeholder="Search suites..."
                                            value={suiteSearch}
                                            onChange={(e) => setSuiteSearch(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="sr-combobox-options">
                                        {filteredSuites.length > 0 ? (
                                            filteredSuites.map((s) => {
                                                const id = s.id || s._id;
                                                const isSelected = id === selectedSuiteId;
                                                const count = s.summary?.total || s.suiteData?.testCases?.length || 0;
                                                return (
                                                    <div
                                                        key={id}
                                                        role="option"
                                                        aria-selected={isSelected}
                                                        className={`sr-combobox-option ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => handleSelectSuite(id)}
                                                    >
                                                        <div className="sr-option-info">
                                                            <div className="sr-option-title">{s.title || 'Untitled Suite'}</div>
                                                            <div className="sr-option-meta">
                                                                {s.platform && <span className="sr-meta-tag">{s.platform}</span>}
                                                                <span className="sr-meta-count">{count} cases</span>
                                                            </div>
                                                        </div>
                                                        {isSelected && <Check size={16} className="sr-option-check" />}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="sr-combobox-empty">No matching test suites</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Focus Requirement Select */}
                    <div className="sr-field-group">
                        <label className="sr-field-label" htmlFor="sr-req-select">
                            Focus requirement
                        </label>
                        <select
                            id="sr-req-select"
                            className="sr-select"
                            value={selectedRequirementId}
                            onChange={(e) => setSelectedRequirementId(e.target.value)}
                            disabled={contextLoading || !selectedSuiteId}
                        >
                            <option value="all">All requirements</option>
                            {suiteContext?.requirements?.map((req) => (
                                <option key={req.id} value={req.id}>
                                    {req.id} - {req.title.length > 40 ? req.title.slice(0, 37) + '...' : req.title} ({req.linkedTestsCount} test{req.linkedTestsCount !== 1 ? 's' : ''})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Focus Area Input with 200 Max Counter */}
                    <div className="sr-field-group sr-field-group--wide">
                        <div className="sr-field-label-row">
                            <label className="sr-field-label" htmlFor="sr-focus-area">
                                Focus area
                            </label>
                            <span className="sr-char-counter" aria-live="polite">
                                {focusArea.length}/200
                            </span>
                        </div>
                        <input
                            id="sr-focus-area"
                            type="text"
                            maxLength={200}
                            className="sr-input"
                            placeholder="e.g. Rate limiting, session timeouts, payment card boundary validation..."
                            value={focusArea}
                            onChange={(e) => setFocusArea(e.target.value)}
                        />
                        <span className="sr-field-helper">Sent to the AI to guide suggestions</span>
                    </div>
                </div>

                {/* Category Chips & Action Row */}
                <div className="sr-category-action-row">
                    <div className="sr-categories-group">
                        <span className="sr-categories-label">Categories:</span>
                        <div className="sr-category-chips-list" role="group" aria-label="Recommendation test categories">
                            {SHARED_CATEGORIES.map((cat) => {
                                const isSelected = selectedCategories.includes(cat);
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        aria-pressed={isSelected}
                                        className={`sr-category-chip ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleToggleCategory(cat)}
                                    >
                                        {isSelected && <Check size={13} className="sr-chip-check" />}
                                        <span>{cat}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {(selectedRequirementId !== 'all' || focusArea || selectedCategories.length > 0) && (
                            <button
                                type="button"
                                className="sr-clear-btn"
                                onClick={handleClearForm}
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Single Primary Action Button */}
                    <div className="sr-submit-group">
                        <button
                            type="button"
                            className="sr-primary-btn"
                            onClick={handleGenerate}
                            disabled={!selectedSuiteId || isGenerating}
                            title={!selectedSuiteId ? 'Select a test suite first' : 'Generate recommendations'}
                        >
                            {isGenerating ? (
                                <>
                                    <RefreshCw size={15} className="sr-spin" />
                                    <span>Analyzing suite...</span>
                                </>
                            ) : (
                                <>
                                    <span>Generate recommendations</span>
                                    <ArrowRight size={15} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </section>

            {/* Loading State with Progress Line and Skeleton Cards */}
            {isGenerating && (
                <section className="sr-loading-state" aria-live="polite">
                    <div className="sr-progress-line-wrap">
                        <div className="sr-progress-line-bar" />
                    </div>
                    <div className="sr-loading-header">
                        <span className="sr-loading-title">Generating recommendations</span>
                        <button
                            type="button"
                            className="sr-cancel-btn"
                            onClick={handleCancelGeneration}
                        >
                            Cancel
                        </button>
                    </div>
                    <div className="sr-skeleton-list">
                        {[1, 2, 3].map((n) => (
                            <div key={n} className="sr-skeleton-card">
                                <div className="sr-skeleton-line sr-skeleton-line--title" />
                                <div className="sr-skeleton-line sr-skeleton-line--text" />
                                <div className="sr-skeleton-line sr-skeleton-line--short" />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Rate Limit / Timeout / Generic Error State */}
            {generationError && !isGenerating && (
                <div className="sr-error-state" role="alert">
                    <AlertTriangle size={20} className="sr-error-icon" />
                    <div className="sr-error-body">
                        <h3 className="sr-error-title">Recommendation generation failed</h3>
                        <p className="sr-error-desc">{generationError}</p>
                        {rateLimitCountdown !== null && (
                            <p className="sr-error-countdown">
                                Retry available in {rateLimitCountdown} seconds.
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        className="sr-retry-btn"
                        onClick={handleGenerate}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* No Gaps Found State */}
            {noGapsFound && !isGenerating && (
                <div className="sr-no-gaps-state">
                    <CheckCircle2 size={24} className="sr-no-gaps-icon" />
                    <div className="sr-no-gaps-body">
                        <h3 className="sr-no-gaps-title">No coverage gaps detected</h3>
                        <p className="sr-no-gaps-desc">
                            All reviewed requirements in this suite satisfy negative validation, boundary conditions, and security controls. 5 QA coverage rules checked.
                        </p>
                    </div>
                </div>
            )}

            {/* Skipped Duplicates Banner */}
            {skippedDuplicates.length > 0 && (
                <div className="sr-skipped-banner">
                    <Info size={16} />
                    <div className="sr-skipped-text">
                        <strong>Skipped {skippedDuplicates.length} duplicate scenario{skippedDuplicates.length > 1 ? 's' : ''}:</strong>{' '}
                        {skippedDuplicates.map(s => `${s.title} (${s.reason})`).join(', ')}
                    </div>
                </div>
            )}

            {/* Active Toast with 10-Minute Undo & Links */}
            {toast && (
                <div className={`sr-toast ${toast.isError ? 'error' : toast.isInfo ? 'info' : 'success'}`} role="status">
                    <div className="sr-toast-content">
                        <span>{toast.message}</span>
                        {toast.undoToken && (
                            <button
                                type="button"
                                className="sr-toast-undo-btn"
                                onClick={handleUndo}
                            >
                                <RotateCcw size={13} />
                                <span>Undo</span>
                            </button>
                        )}
                        {toast.suiteId && (
                            <div className="sr-toast-links">
                                <Link
                                    to={`/app/test-suites/${encodeURIComponent(toast.suiteId)}?tab=cases`}
                                    className="sr-toast-link"
                                >
                                    View in test cases
                                    <ArrowUpRight size={12} />
                                </Link>
                                <Link
                                    to={`/app/test-suites/${encodeURIComponent(toast.suiteId)}?status=Draft`}
                                    className="sr-toast-link"
                                >
                                    Review cases
                                    <ArrowUpRight size={12} />
                                </Link>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className="sr-toast-close"
                        onClick={() => setToast(null)}
                        aria-label="Dismiss toast"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Empty State before Generating */}
            {recommendations.length === 0 && !isGenerating && !generationError && !noGapsFound && (
                <section className="sr-empty-state">
                    <div className="sr-empty-icon-wrap">
                        <Sparkles size={20} />
                    </div>
                    <p className="sr-empty-text">
                        Select a test suite and generate smart test recommendations.
                    </p>
                    <div className="sr-example-card">
                        <div className="sr-example-header">
                            <span className="sr-example-tag">Negative</span>
                            <span className="sr-example-priority">High</span>
                            <span className="sr-example-req">REQ_001</span>
                        </div>
                        <div className="sr-example-title">Verify session invalidation on password reset token expiration</div>
                        <div className="sr-example-reason">Why this test: Catches token reuse vulnerabilities when a reset link is clicked after expiration window.</div>
                    </div>
                </section>
            )}

            {/* Results Section */}
            {recommendations.length > 0 && !isGenerating && (
                <section className="sr-results-section" aria-label="Generated test recommendations">
                    {/* Stale Specification Warning Banner */}
                    {hasStaleRecommendations && (
                        <div className="sr-stale-banner" role="alert">
                            <div>
                                <strong>Specification updated:</strong> One or more recommendations were generated for an earlier suite version and have been marked Expired.
                            </div>
                            <button
                                type="button"
                                className="sr-retry-btn"
                                onClick={handleGenerate}
                            >
                                Reanalyze
                            </button>
                        </div>
                    )}

                    {/* Status Tabs Filter */}
                    <nav className="sr-status-tabs" aria-label="Filter recommendations by status">
                        {[
                            { key: 'all', label: 'All', count: recommendations.length },
                            { key: 'SUGGESTED', label: 'Suggested', count: recommendations.filter(r => (r.status || 'SUGGESTED').toUpperCase() === 'SUGGESTED' || (r.status || '').toLowerCase() === 'pending').length },
                            { key: 'ADDED', label: 'Added', count: recommendations.filter(r => (r.status || '').toUpperCase() === 'ADDED' || (r.status || '').toLowerCase() === 'converted' || addedRecIds.has(r.id)).length },
                            { key: 'DISMISSED', label: 'Dismissed', count: recommendations.filter(r => (r.status || '').toUpperCase() === 'DISMISSED' || (r.status || '').toLowerCase() === 'rejected').length },
                            { key: 'DUPLICATE', label: 'Duplicate', count: recommendations.filter(r => (r.status || '').toUpperCase() === 'DUPLICATE' || r.isDuplicate).length },
                            { key: 'EXPIRED', label: 'Expired', count: recommendations.filter(r => (r.status || '').toUpperCase() === 'EXPIRED').length }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                type="button"
                                className={`sr-status-tab ${activeStatusTab === tab.key ? 'active' : ''}`}
                                onClick={() => setActiveStatusTab(tab.key)}
                            >
                                <span>{tab.label}</span>
                                {tab.count > 0 && <span className="sr-tab-badge">{tab.count}</span>}
                            </button>
                        ))}
                    </nav>

                    {/* Secondary Filters Bar */}
                    <div className="sr-filter-bar">
                        <div className="sr-filter-item">
                            <label htmlFor="sr-filter-priority">Priority:</label>
                            <select
                                id="sr-filter-priority"
                                className="sr-filter-select"
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                            >
                                <option value="all">All priorities</option>
                                <option value="Critical">Critical</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>
                        <div className="sr-filter-item">
                            <label htmlFor="sr-filter-cat">Category:</label>
                            <select
                                id="sr-filter-cat"
                                className="sr-filter-select"
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                            >
                                <option value="all">All categories</option>
                                {SHARED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="sr-filter-item">
                            <label htmlFor="sr-filter-req">Requirement:</label>
                            <select
                                id="sr-filter-req"
                                className="sr-filter-select"
                                value={filterRequirement}
                                onChange={(e) => setFilterRequirement(e.target.value)}
                            >
                                <option value="all">All requirements</option>
                                {suiteContext?.requirements?.map(r => (
                                    <option key={r.id} value={r.id}>{r.id} - {r.title.length > 30 ? r.title.slice(0, 27) + '...' : r.title}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Results Toolbar */}
                    <div className="sr-results-toolbar">
                        <div className="sr-toolbar-left">
                            <label className="sr-select-all-label">
                                <input
                                    type="checkbox"
                                    className="sr-checkbox"
                                    checked={
                                        filteredRecommendations.filter(r => !addedRecIds.has(r.id)).length > 0 &&
                                        selectedRecIds.size === filteredRecommendations.filter(r => !addedRecIds.has(r.id)).length
                                    }
                                    onChange={handleSelectAll}
                                />
                                <span className="sr-results-count">
                                    {filteredRecommendations.length} recommendation{filteredRecommendations.length !== 1 ? 's' : ''}
                                </span>
                            </label>
                        </div>

                        <div className="sr-toolbar-right">
                            <label htmlFor="sr-sort-select" className="sr-sort-label">Sort by:</label>
                            <select
                                id="sr-sort-select"
                                className="sr-sort-select"
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value)}
                            >
                                <option value="priority-desc">Priority (High to Low)</option>
                                <option value="priority-asc">Priority (Low to High)</option>
                                <option value="requirement">Requirement ID</option>
                                <option value="title">Title (A-Z)</option>
                            </select>
                        </div>
                    </div>

                    {/* Sticky Bulk Action Bar */}
                    {selectedRecIds.size > 0 && (
                        <div className="sr-bulk-bar">
                            <span className="sr-bulk-count">
                                {selectedRecIds.size} selected
                            </span>
                            <div className="sr-bulk-actions">
                                <button
                                    type="button"
                                    className="sr-bulk-btn sr-bulk-btn--add"
                                    onClick={() => handleAcceptRecommendations(recommendations.filter(r => selectedRecIds.has(r.id)))}
                                    disabled={isAdding}
                                >
                                    Add selected ({selectedRecIds.size})
                                </button>
                                <button
                                    type="button"
                                    className="sr-bulk-btn sr-bulk-btn--dismiss"
                                    onClick={handleDismissSelected}
                                    disabled={isAdding}
                                >
                                    Dismiss selected
                                </button>
                                <button
                                    type="button"
                                    className="sr-bulk-btn sr-bulk-btn--export"
                                    onClick={() => handleExportSelected('json')}
                                    disabled={isAdding}
                                >
                                    Export JSON
                                </button>
                                <button
                                    type="button"
                                    className="sr-bulk-btn sr-bulk-btn--export"
                                    onClick={() => handleExportSelected('csv')}
                                    disabled={isAdding}
                                >
                                    Export CSV
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Recommendation Cards List */}
                    <div className="sr-cards-list">
                        {filteredRecommendations.map((rec) => {
                            const isAdded = addedRecIds.has(rec.id) || (rec.status || '').toUpperCase() === 'ADDED' || (rec.status || '').toLowerCase() === 'converted';
                            const isDismissed = (rec.status || '').toUpperCase() === 'DISMISSED' || (rec.status || '').toLowerCase() === 'rejected';
                            const isSelected = selectedRecIds.has(rec.id);
                            const isStepsExpanded = expandedCards.has(rec.id);
                            const isScenarioExpanded = expandedScenarios.has(rec.id);

                            return (
                                <article
                                    key={rec.id}
                                    className={`sr-card ${isAdded ? 'added' : ''} ${isSelected ? 'selected' : ''}`}
                                >
                                    <div className="sr-card-top-row">
                                        <div className="sr-card-check-title">
                                            {!isAdded ? (
                                                <input
                                                    type="checkbox"
                                                    className="sr-checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelectCard(rec.id)}
                                                    aria-label={`Select recommendation: ${rec.title}`}
                                                />
                                            ) : (
                                                <div className="sr-checkbox-placeholder" />
                                            )}
                                            <h3 className="sr-card-title">{rec.title}</h3>
                                        </div>

                                        <div className="sr-card-tags">
                                            <span className="sr-pill-tag sr-pill-tag--type">{rec.category || 'Functional'}</span>
                                            <span className="sr-pill-tag sr-pill-tag--priority">{rec.priority || 'Medium'}</span>
                                            {(rec.requirementId || rec.relatedRequirementId) && (
                                                <span className="sr-pill-tag sr-pill-tag--req">{rec.requirementId || rec.relatedRequirementId}</span>
                                            )}
                                            {rec.similarityStatus && rec.similarityStatus !== 'distinct' && (
                                                <span className={`sr-similarity-badge sr-similarity-badge--${rec.similarityStatus}`}>
                                                    {rec.similarityStatus === 'duplicate' ? 'Duplicate Warning' : 'Similar Scenario'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Scenario Description (2-line clamped) */}
                                    {(rec.description || rec.coverageGapAddressed) && (
                                        <div className="sr-card-scenario-wrap">
                                            <p className={`sr-card-scenario ${isScenarioExpanded ? 'expanded' : ''}`}>
                                                {rec.description || rec.coverageGapAddressed}
                                            </p>
                                            {(rec.description || rec.coverageGapAddressed || '').length > 120 && (
                                                <button
                                                    type="button"
                                                    className="sr-expand-text-btn"
                                                    onClick={() => handleToggleScenario(rec.id)}
                                                >
                                                    {isScenarioExpanded ? 'Show less' : 'Show more'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Why this test rationale */}
                                    {(rec.whyThisTest || rec.reason || rec.recommendationReason) && (
                                        <div className="sr-card-rationale">
                                            <span className="sr-rationale-label">Why this test:</span>
                                            <span className="sr-rationale-text">{rec.whyThisTest || rec.reason || rec.recommendationReason}</span>
                                        </div>
                                    )}

                                    {/* Source references */}
                                    {Array.isArray(rec.sourceReferences) && rec.sourceReferences.length > 0 && (
                                        <div className="sr-card-rationale">
                                            <span className="sr-rationale-label">Sources:</span>
                                            <span className="sr-rationale-text">{rec.sourceReferences.join(', ')}</span>
                                        </div>
                                    )}

                                    {/* Overlap note if similarTo / mostSimilarCaseId is present */}
                                    {(rec.isDuplicate || rec.mostSimilarCaseId || rec.similarityStatus === 'duplicate' || rec.similarityStatus === 'similar') && (
                                        <div className="sr-overlap-note">
                                            <AlertCircle size={13} />
                                            <span>
                                                {rec.overlapExplanation || `Similar to existing test case ${rec.mostSimilarCaseId || 'in suite'}, review before adding.`}
                                            </span>
                                        </div>
                                    )}

                                    {/* Collapsible Steps Outline */}
                                    <div className="sr-steps-section">
                                        <button
                                            type="button"
                                            className="sr-toggle-steps-btn"
                                            onClick={() => handleToggleSteps(rec.id)}
                                            aria-expanded={isStepsExpanded}
                                        >
                                            {isStepsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            <span>
                                                {isStepsExpanded
                                                    ? 'Hide steps'
                                                    : `Show steps (${Array.isArray(rec.steps) ? rec.steps.length : 1})`}
                                            </span>
                                        </button>

                                        {isStepsExpanded && (
                                            <div className="sr-steps-content">
                                                {rec.preconditions && (
                                                    <div className="sr-step-preconditions">
                                                        <strong>Preconditions:</strong> {rec.preconditions}
                                                    </div>
                                                )}
                                                <ol className="sr-steps-list">
                                                    {(Array.isArray(rec.steps) ? rec.steps : [rec.steps]).map((step, sIdx) => (
                                                        <li key={sIdx} className="sr-step-item">
                                                            <span className="sr-step-index">{sIdx + 1}.</span>
                                                            <span className="sr-step-instruction">{step}</span>
                                                        </li>
                                                    ))}
                                                </ol>
                                                {rec.expectedResult && (
                                                    <div className="sr-step-expected">
                                                        <strong>Expected:</strong> {rec.expectedResult}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Card Controls Bottom Row */}
                                    <div className="sr-card-actions">
                                        {isAdded ? (
                                            <span className="sr-added-pill">
                                                <Check size={14} />
                                                <span>Added to Suite</span>
                                            </span>
                                        ) : isDismissed ? (
                                            <button
                                                type="button"
                                                className="sr-card-btn"
                                                onClick={() => {
                                                    recommendationService.update(rec.id, { status: 'SUGGESTED' });
                                                    setRecommendations(prev => prev.map(r => r.id === rec.id ? { ...r, status: 'SUGGESTED' } : r));
                                                }}
                                            >
                                                Restore
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className="sr-card-btn sr-card-btn--add"
                                                    onClick={() => handleAcceptRecommendations([rec])}
                                                    disabled={isAdding}
                                                >
                                                    Add to suite
                                                </button>
                                                <button
                                                    type="button"
                                                    className="sr-card-btn"
                                                    onClick={() => handleOpenEdit(rec)}
                                                    disabled={isAdding}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="sr-card-btn sr-card-btn--dismiss"
                                                    onClick={() => handleDismissSingle(rec.id)}
                                                    disabled={isAdding}
                                                >
                                                    Dismiss
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Inline Edit Drawer / Full-Screen Sheet */}
            {editingRec && (
                <div className="sr-edit-overlay" onClick={() => setEditingRec(null)}>
                    <div
                        className="sr-edit-drawer"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-labelledby="sr-edit-drawer-title"
                    >
                        <div className="sr-drawer-header">
                            <h2 id="sr-edit-drawer-title" className="sr-drawer-title">Edit recommendation</h2>
                            <button
                                type="button"
                                className="sr-drawer-close"
                                onClick={() => setEditingRec(null)}
                                aria-label="Close edit drawer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="sr-edit-form">
                            <div className="sr-drawer-field">
                                <label className="sr-drawer-label" htmlFor="sr-edit-title">
                                    Title
                                </label>
                                <input
                                    id="sr-edit-title"
                                    type="text"
                                    className="sr-drawer-input"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="sr-drawer-field">
                                <label className="sr-drawer-label" htmlFor="sr-edit-priority">
                                    Priority
                                </label>
                                <select
                                    id="sr-edit-priority"
                                    className="sr-drawer-select"
                                    value={editForm.priority}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                                >
                                    <option value="Critical">Critical</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>

                            <div className="sr-drawer-field">
                                <label className="sr-drawer-label" htmlFor="sr-edit-steps">
                                    Test steps (one per line)
                                </label>
                                <textarea
                                    id="sr-edit-steps"
                                    rows={5}
                                    className="sr-drawer-textarea"
                                    value={editForm.steps}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, steps: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="sr-drawer-field">
                                <label className="sr-drawer-label" htmlFor="sr-edit-expected">
                                    Expected result
                                </label>
                                <input
                                    id="sr-edit-expected"
                                    type="text"
                                    className="sr-drawer-input"
                                    value={editForm.expectedResult}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, expectedResult: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="sr-drawer-actions">
                                <button
                                    type="button"
                                    className="sr-drawer-cancel-btn"
                                    onClick={() => setEditingRec(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="sr-drawer-save-btn"
                                >
                                    Save changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Leave Protection Confirmation Dialog */}
            {showLeaveModal && (
                <div className="sr-leave-overlay" role="alertdialog" aria-labelledby="sr-leave-title">
                    <div className="sr-leave-modal">
                        <h3 id="sr-leave-title" className="sr-leave-title">
                            These recommendations are not saved.
                        </h3>
                        <p className="sr-leave-desc">
                            You have {unaddedCount} generated recommendation{unaddedCount > 1 ? 's' : ''} in memory. If you leave this page, they will be discarded.
                        </p>
                        <div className="sr-leave-actions">
                            <button
                                type="button"
                                className="sr-leave-stay-btn"
                                onClick={() => {
                                    setShowLeaveModal(false);
                                    setPendingNavigationHref(null);
                                }}
                            >
                                Stay
                            </button>
                            <button
                                type="button"
                                className="sr-leave-proceed-btn"
                                onClick={() => {
                                    setShowLeaveModal(false);
                                    if (pendingNavigationHref) {
                                        navigate(pendingNavigationHref);
                                    }
                                }}
                            >
                                Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
