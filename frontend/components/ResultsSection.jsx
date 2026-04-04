import React, { useState, useMemo } from 'react';
import {
    Copy, Save, Download, ClipboardList, AlertCircle,
    Maximize2, CheckSquare, MessageSquare, ChevronDown,
    ChevronUp, Sparkles, LayoutGrid, ListChecks, Search, Shield,
    Filter, ChevronLast, ChevronFirst, ExternalLink, XCircle, Zap, Link, Loader2, BookOpen
} from 'lucide-react';
import RefineRegeneratePanel from './RefineRegeneratePanel';

// Memoized TestCaseCard for better scroll performance
const TestCaseCard = React.memo(({ testCase, isInitiallyExpanded = false, isSelected, onToggleSelect }) => {
    const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSynced, setIsSynced] = useState(false);
    const [showWhy, setShowWhy] = useState(false);

    React.useEffect(() => {
        setIsExpanded(isInitiallyExpanded);
    }, [isInitiallyExpanded]);

    const getPriorityClass = (priority = 'Medium') => {
        const p = (priority || 'Medium').toLowerCase();
        switch (p) {
            case 'high': return 'priority-badge high';
            case 'medium': return 'priority-badge medium';
            case 'low': return 'priority-badge low';
            default: return 'priority-badge';
        }
    };

    const handleJiraSync = async (e) => {
        e.stopPropagation();
        if (isSynced || isSyncing) return;

        setIsSyncing(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsSyncing(false);
        setIsSynced(true);
    };

    const getIconForType = () => {
        const id = testCase.id || '';
        if (id.startsWith('TC_FUNC')) return <CheckSquare size={14} className="text-primary" />;
        if (id.startsWith('TC_NEG')) return <XCircle size={14} className="text-danger" />;
        return <Zap size={14} className="text-warning" />;
    };

    const getExecutionTag = () => {
        const priority = String(testCase.priority || 'Medium').toLowerCase();
        const testId = String(testCase.id || '');

        if (priority === 'high' && testId.includes('FUNC')) {
            return { label: 'Ready to Execute', class: 'tag-ready' };
        }
        if (testId.includes('API') || testCase.category === 'apiChecklist') {
            return { label: 'Automation Candidate', class: 'tag-automation' };
        }
        if (testCase.hasAmbiguity) { // Inferred or passed from backend
            return { label: 'Needs Clarification', class: 'tag-clarify' };
        }
        return null;
    };

    const execTag = getExecutionTag();

    return (
        <div className={`test-case-card-luxury glass-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}>
            <div className="card-header-luxury" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="card-selection-area" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(testCase.id)}
                        className="tc-checkbox"
                    />
                </div>
                <div className="card-header-main">
                    <div className="header-meta-row">
                        <span className="tc-id-pill">{testCase.id}</span>
                        <span className={getPriorityClass(testCase.priority)}>{testCase.priority}</span>
                        <span className="type-badge-mini">{getIconForType()} {(testCase.id || '').includes('FUNC') ? 'Functional' : (testCase.id || '').includes('NEG') ? 'Negative' : 'Edge'}</span>
                        {execTag && <span className={`execution-tag ${execTag.class}`}>{execTag.label}</span>}
                    </div>
                    <div className="title-row-scannable">
                        <h4 className="card-title-strong">{testCase.title}</h4>
                        {testCase.priority === 'High' && testCase.priorityExplanation && (
                            <p className="priority-impact-desc">
                                <Zap size={12} fill="currentColor" /> {testCase.priorityExplanation}
                            </p>
                        )}
                        <p className="card-mini-summary">{(testCase.expected || '').substring(0, 80)}...</p>
                    </div>
                </div>
                <div className="card-header-quick-actions">
                    <button className="btn-icon-tiny" title="Copy Card" onClick={(e) => { e.stopPropagation(); alert("Copied!"); }}><Copy size={16} /></button>
                    <div className="card-expand-icon">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="card-body-luxury">
                    <div className="body-section-luxury">
                        <div className="section-header-row">
                            <h5 className="section-label-bright">Steps to execute:</h5>
                            <button className="btn-why-link" onClick={(e) => { e.stopPropagation(); setShowWhy(!showWhy); }}>
                                <Search size={14} />
                                <span>Why this test?</span>
                            </button>
                        </div>

                        {showWhy && (
                            <div className="why-box glass-card animate-fade-in">
                                <p>{testCase.reason || "Generated based on inferred rule from requirement."}</p>
                            </div>
                        )}

                        <ol className="steps-list-luxury">
                            {testCase.steps.map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ol>
                    </div>
                    <div className="body-section-luxury">
                        <h5 className="section-label-bright">Expected Behavior:</h5>
                        <div className="expected-result-highlight">
                            <CheckSquare size={16} className="success-icon" />
                            <p>{testCase.expected}</p>
                        </div>
                    </div>
                    <div className="card-footer-luxury">
                        <button className="btn-action-ghost" onClick={(e) => { e.stopPropagation(); alert("Copied!"); }}>
                            <Copy size={16} />
                            <span>Copy</span>
                        </button>
                        <button
                            className={`btn-action-ghost ${isSynced ? 'success-pulse' : ''}`}
                            onClick={handleJiraSync}
                            disabled={isSyncing || isSynced}
                        >
                            {isSyncing ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : isSynced ? (
                                <CheckSquare size={16} className="text-success" />
                            ) : (
                                <ExternalLink size={16} />
                            )}
                            <span>{isSyncing ? 'Syncing...' : isSynced ? 'Synced to Jira' : 'Jira Sync'}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

// Add display name for debugging
TestCaseCard.displayName = 'TestCaseCard';

const EmptyState = ({ message, submessage }) => (
    <div className="empty-state-luxury glass-card">
        <div className="empty-icon-wrapper">
            <Sparkles size={40} className="text-primary" />
        </div>
        <h3>{message || "No results to show"}</h3>
        <p>{submessage || "Generate a test suite to see structured results here."}</p>
    </div>
);

const ResultsSection = ({ result, onSave, onRefineRegenerate }) => {
    console.log('ResultsSection rendering with:', result);
    if (!result) return <EmptyState message="Critical Error: No Result Data" />;

    const [activeTab, setActiveTab] = useState('Functional (Happy paths covered)');
    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [isAllExpanded, setIsAllExpanded] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isRefineRegenerating, setIsRefineRegenerating] = useState(false);

    const handleToggleSelect = (id) => {
        if (!id) return;
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (data = []) => {
        if (!data || !Array.isArray(data)) return;
        const allIds = data.map(tc => tc.id).filter(Boolean);
        if (selectedIds.length === allIds.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(allIds);
        }
    };

    const tabs = [
        { name: 'Functional (Happy paths covered)', icon: <ClipboardList size={18} />, count: result?.summary?.functional || 0, data: result?.functional || [] },
        { name: 'Negative (Failure scenarios)', icon: <XCircle size={18} />, count: result?.summary?.negative || 0, data: result?.negative || [] },
        { name: 'Edge Cases (Boundary conditions)', icon: <Zap size={18} />, count: result?.summary?.edge || 0, data: result?.edge || [] },
        { name: 'API Checklist (Backend validation)', icon: <Link size={18} />, count: result?.apiChecklist?.length || result?.api?.length || 0, data: (result?.apiChecklist && result.apiChecklist.length > 0) ? result.apiChecklist : (result?.api || []) },
        { name: 'Non-Functional (Performance & Security)', icon: <AlertCircle size={18} />, count: result?.nonFunctional?.length || 0, data: result?.nonFunctional || [] },
        { name: 'Questions (Logic Gaps Found)', icon: <MessageSquare size={18} />, count: result?.questions?.length || 0, data: result?.questions || [] }
    ];

    const currentTab = tabs.find(t => t.name === activeTab);

    // Memoize filtered data for better performance
    const filteredData = useMemo(() => {
        if (!currentTab || !currentTab.data || !Array.isArray(currentTab.data)) return [];
        if (activeTab.includes('API Checklist') || activeTab.includes('Questions')) return currentTab.data;

        return currentTab.data.filter(tc => {
            if (!tc) return false;
            const matchesSearch = ((tc.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (tc.expected || '').toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesPriority = priorityFilter === 'All' || tc.priority === priorityFilter;
            return matchesSearch && matchesPriority;
        });
    }, [currentTab, searchQuery, priorityFilter, activeTab]);

    const handleRegenerate = () => {
        setIsRegenerating(true);
        setTimeout(() => {
            setIsRegenerating(false);
            alert("Suite updated with your answers!");
        }, 2000);
    };

    const handleDownload = () => {
        const timestamp = new Date().toISOString();
        const safeFeature = (result.feature || 'TestPlan').replace(/[^a-z0-9_\-]/gi, '_');

        // Build a clean, structured JSON export
        const structured = {
            metadata: {
                title: `Test Plan: ${result.feature || 'Unnamed Feature'}`,
                generated_at: timestamp,
                tool: 'Testnexa AI',
                version: '1.0',
                requirement: result.requirement || '',
                app_context: result.appContext || '',
                coverage_depth: result.coverageDepth || '',
            },
            summary: {
                functional: result.summary?.functional || 0,
                negative: result.summary?.negative || 0,
                edge_cases: result.summary?.edge || 0,
                api_checks: result.apiChecklist?.length || result.api?.length || 0,
                non_functional: result.nonFunctional?.length || 0,
                total_test_cases:
                    (result.summary?.functional || 0) +
                    (result.summary?.negative || 0) +
                    (result.summary?.edge || 0),
                quality_score: result.quality?.coverageConfidence || null,
                ambiguity_score: result.quality?.ambiguityScore || null,
            },
            test_cases: {
                functional: (result.functional || []).map(tc => ({
                    id: tc.id,
                    title: tc.title,
                    priority: tc.priority,
                    intent_group: tc.intentGroup || 'General',
                    steps: tc.steps,
                    expected_result: tc.expected,
                    reason: tc.reason || '',
                    priority_explanation: tc.priorityExplanation || '',
                })),
                negative: (result.negative || []).map(tc => ({
                    id: tc.id,
                    title: tc.title,
                    priority: tc.priority,
                    intent_group: tc.intentGroup || 'General',
                    steps: tc.steps,
                    expected_result: tc.expected,
                    reason: tc.reason || '',
                })),
                edge_cases: (result.edge || []).map(tc => ({
                    id: tc.id,
                    title: tc.title,
                    priority: tc.priority,
                    intent_group: tc.intentGroup || 'General',
                    steps: tc.steps,
                    expected_result: tc.expected,
                    reason: tc.reason || '',
                })),
            },
            api_checklist: (result.apiChecklist || result.api || []).map(item => ({
                endpoint: item.endpoint || item.title || '',
                method: item.method || 'POST',
                checks: item.checks || item.steps || [],
            })),
            non_functional: (result.nonFunctional || []).map(tc => ({
                id: tc.id,
                title: tc.title,
                category: tc.category || '',
                steps: tc.steps,
                expected_result: tc.expected,
            })),
            assumptions: result.assumptions || [],
            clarification_questions: result.questions || [],
            confidence_warnings: result.quality?.confidenceWarnings || [],
        };

        const dataStr =
            'data:text/json;charset=utf-8,' +
            encodeURIComponent(JSON.stringify(structured, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute('href', dataStr);
        anchor.setAttribute('download', `TestPlan_${safeFeature}_${Date.now()}.json`);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };

    return (
        <div className="results-container-luxury">
            {/* 4 Multi-Count Summary Cards with Icons */}
            <div className="results-summary-grid">
                <div className="summary-chip-new functional glass-card">
                    <div className="chip-header">
                        <span className="chip-label-new">Functional (Happy Path)</span>
                        <CheckSquare size={18} className="text-primary" />
                    </div>
                    <span className="chip-value-xl">{result?.summary?.functional || 0}</span>
                </div>
                <div className="summary-chip-new negative glass-card">
                    <div className="chip-header">
                        <span className="chip-label-new">Negative (Failures)</span>
                        <XCircle size={18} className="text-danger" />
                    </div>
                    <span className="chip-value-xl">{result?.summary?.negative || 0}</span>
                </div>
                <div className="summary-chip-new edge glass-card">
                    <div className="chip-header">
                        <span className="chip-label-new">Edge (Boundary)</span>
                        <Zap size={18} className="text-warning" />
                    </div>
                    <span className="chip-value-xl">{result?.summary?.edge || 0}</span>
                </div>
                <div className="summary-chip-new api glass-card">
                    <div className="chip-header">
                        <span className="chip-label-new">API (Backend)</span>
                        <Link size={18} className="text-primary" />
                    </div>
                    <span className="chip-value-xl">{tabs[3]?.count || 0}</span>
                </div>
                <div className="summary-chip-new glass-card score-chip">
                    <div className="chip-header">
                        <span className="chip-label-new">Quality Score</span>
                        <Shield size={18} className="text-primary" />
                    </div>
                    <div className="score-display">
                        <span className="chip-value-xl">{result.quality?.coverageConfidence || 85}%</span>
                        <span className="score-status">{result.quality?.ambiguityScore === 'High' ? 'Needs Work' : 'Excellent'}</span>
                    </div>
                    {result.quality?.confidenceWarnings?.length > 0 && (
                        <div className="confidence-warning-mini">
                            <AlertCircle size={10} />
                            <span>{result.quality.confidenceWarnings[0]}</span>
                        </div>
                    )}
                </div>
            </div>


            <div className="results-actions-bar glass-card">
                <div className="left-actions-padded">
                    <div className="search-input-wrapper-tall">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search cases (e.g. lock, password, email)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="filter-select-wrapper-tall">
                        <Filter size={18} />
                        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                            <option value="All">All Priorities</option>
                            <option value="High">High Only</option>
                            <option value="Medium">Medium Only</option>
                            <option value="Low">Low Only</option>
                        </select>
                    </div>
                    {(searchQuery || priorityFilter !== 'All') && (
                        <button className="btn-clear-filters" onClick={() => { setSearchQuery(''); setPriorityFilter('All'); }}>
                            <XCircle size={14} />
                            <span>Clear</span>
                        </button>
                    )}
                </div>

                <div className="right-actions-compact">
                    <button className="btn-secondary-bright" onClick={() => setIsAllExpanded(!isAllExpanded)}>
                        {isAllExpanded ? <ChevronFirst size={18} /> : <ChevronLast size={18} />}
                        <span>{isAllExpanded ? 'Collapse' : 'Expand All'}</span>
                    </button>
                    <button className="btn-secondary-bright" onClick={onSave} title="Save to History">
                        <Save size={18} />
                        <span>Save</span>
                    </button>
                    <div className="export-btn-group">
                        <button className="btn-primary-bright" onClick={handleDownload}>
                            <Download size={18} />
                            <span>Download JSON</span>
                        </button>
                        <span className="export-micro-tip">Includes priorities & reasons</span>
                    </div>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="bulk-actions-floating animate-slide-up">
                    <span className="selected-count">{selectedIds.length} items selected</span>
                    <div className="bulk-btn-group">
                        <button className="btn-bulk-action" onClick={() => { alert(`Copied ${selectedIds.length} items!`); setSelectedIds([]); }}>
                            <Copy size={16} />
                            <span>Copy Selected</span>
                        </button>
                        <button className="btn-bulk-action" onClick={() => alert("Exporting selected...")}>
                            <Download size={16} />
                            <span>Export CSV</span>
                        </button>
                        <button className="btn-bulk-close" onClick={() => setSelectedIds([])}>
                            <XCircle size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Advanced Tabs with Clear Count Badges */}
            <div className="tabs-system-luxury">
                <div className="tabs-nav-professional glass-card">
                    {tabs.map((tab) => (
                        <button
                            key={tab.name}
                            className={`tab-item-pro ${activeTab === tab.name ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.name)}
                        >
                            <div className="tab-label-pro">
                                {tab.icon}
                                <span>{tab.name}</span>
                                <span className="tab-count-badge">{tab.count}</span>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="tab-content-luxury">
                    {filteredData.length === 0 ? (
                        <EmptyState
                            message={`No ${activeTab.toLowerCase()} results match.`}
                            submessage="Try adjusting your filters or requirement description."
                        />
                    ) : activeTab.includes('API Checklist') ? (
                        <div className="api-view-luxury glass-card">
                            {((result?.apiChecklist && result.apiChecklist.length > 0) ? result.apiChecklist : (result?.api || [])).map((item, i) => (
                                <div key={i} className="endpoint-block">
                                    <div className="endpoint-title-row">
                                        <span className="method-tag">{item.method || 'POST'}</span>
                                        <span className="path-text">{item.endpoint || item.title}</span>
                                    </div>
                                    <div className="checklist-grid">
                                        {(item.checks || item.steps || []).map((check, j) => (
                                            <div key={j} className="check-item-card glass-card">
                                                <CheckSquare size={16} />
                                                <span>{check}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : activeTab.includes('Questions') ? (
                        <div className="questions-view-luxury glass-card">
                            <div className="questions-header-luxury">
                                <MessageSquare size={24} className="accent-icon" />
                                <div className="header-text-group">
                                    <h3 className="strong-heading">Clarification Questions</h3>
                                    <p className="panel-subtitle-bright">Answering these will significantly improve Negative and Edge Case accuracy.</p>
                                </div>
                            </div>
                            <div className="questions-list-luxury">
                                {result.questions.map((q, i) => (
                                    <div key={i} className="question-row-interactive">
                                        <p className="question-text-strong">{q}</p>
                                        <div className="answer-input-box">
                                            <input type="text" placeholder="Type your answer here..." />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="questions-footer-luxury">
                                <button
                                    className={`btn-generate-dominant ${isRegenerating ? 'loading' : ''}`}
                                    onClick={handleRegenerate}
                                    disabled={isRegenerating}
                                >
                                    {isRegenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={18} fill="currentColor" />}
                                    <span>{isRegenerating ? 'Updating Suite...' : 'Regenerate with Answers'}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="test-cases-list-luxury">
                            {/* Grouping by Intent */}
                            {Object.entries(
                                filteredData.reduce((acc, tc) => {
                                    const group = tc.intentGroup || 'General Coverage';
                                    if (!acc[group]) acc[group] = [];
                                    acc[group].push(tc);
                                    return acc;
                                }, {})
                            ).map(([groupName, groupTests]) => (
                                <div key={groupName} className="intent-group-wrapper">
                                    <div className="intent-group-header">
                                        <div className="intent-line" />
                                        <h4 className="intent-title">{groupName}</h4>
                                        <span className="intent-badge">{groupTests.length} cases</span>
                                    </div>
                                    <div className="intent-group-content">
                                        {groupTests.map((tc) => (
                                            <TestCaseCard
                                                key={tc.id}
                                                testCase={tc}
                                                isInitiallyExpanded={isAllExpanded}
                                                isSelected={selectedIds.includes(tc.id)}
                                                onToggleSelect={handleToggleSelect}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Refine & Regenerate Panel — shown after test output */}
            <RefineRegeneratePanel
                onRegenerate={async (refinementData) => {
                    setIsRefineRegenerating(true);
                    try {
                        // Call parent's refine regenerate function if provided
                        if (onRefineRegenerate) {
                            const result = await onRefineRegenerate(refinementData);
                            return result;
                        }
                        // Fallback: simulate regeneration with test type awareness
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        const testType = refinementData.testType || 'mixed';
                        const changesSummary = [];

                        if (testType === 'non_functional') {
                            changesSummary.push(
                                'Added 8 performance and load test cases',
                                'Expanded security and compliance coverage',
                                'Included 5 reliability and recovery scenarios',
                                'Added 3 usability test cases'
                            );
                        } else if (testType === 'functional') {
                            changesSummary.push(
                                'Added 12 edge case scenarios',
                                'Expanded negative path coverage',
                                'Included boundary condition tests',
                                'Enhanced error handling validation'
                            );
                        } else if (testType === 'api') {
                            changesSummary.push(
                                'Added 10 API contract validation tests',
                                'Expanded error code coverage',
                                'Included integration scenarios',
                                'Enhanced backend validation tests'
                            );
                        } else {
                            changesSummary.push(
                                'Added 8 additional security test cases',
                                'Expanded negative scenarios for payment failures',
                                'Updated CVV validation assumptions to 4 digits',
                                'Increased edge case coverage by 35%'
                            );
                        }

                        return {
                            changesSummary,
                            metadata: {
                                testsAdded: testType === 'non_functional' ? 16 :
                                    testType === 'functional' ? 12 :
                                        testType === 'api' ? 10 : 15
                            }
                        };
                    } finally {
                        setIsRefineRegenerating(false);
                    }
                }}
                isRegenerating={isRefineRegenerating}
                testSuiteMetadata={{
                    totalTests: (result?.summary?.functional || 0) + (result?.summary?.negative || 0) + (result?.summary?.edge || 0),
                    hasQuestions: (result?.questions?.length || 0) > 0,
                    assumptions: result?.assumptions || []
                }}
            />

            {/* Next Actions Panel */}
            <div className="next-actions-luxury glass-card">
                <div className="next-header">
                    <Zap size={20} className="text-primary" />
                    <h3 className="next-title">Recommended Next Actions</h3>
                </div>
                <div className="next-grid">
                    {result.questions?.length > 0 && (
                        <div className="next-card glass-card warning">
                            <MessageSquare size={18} />
                            <div className="next-info">
                                <h4>Resolve Clarifications</h4>
                                <p>Answering logic gaps improves test accuracy by up to 40%.</p>
                            </div>
                        </div>
                    )}
                    <div className="next-card glass-card success">
                        <Shield size={18} />
                        <div className="next-info">
                            <h4>Review High Priority</h4>
                            <p>Focus on {result?.summary?.functional || 0} functional paths for immediate coverage.</p>
                        </div>
                    </div>
                    <div className="next-card glass-card info">
                        <ExternalLink size={18} />
                        <div className="next-info">
                            <h4>Sync to Management</h4>
                            <p>Export results to Jira or Excel for team review.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultsSection;
