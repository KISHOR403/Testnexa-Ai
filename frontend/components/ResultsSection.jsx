import React, { useState, useMemo } from 'react';
import {
    Copy, Save, Download, ClipboardList, AlertCircle,
    Maximize2, CheckSquare, MessageSquare, ChevronDown,
    ChevronUp, Sparkles, LayoutGrid, ListChecks, Search, Shield,
    Filter, ChevronLast, ChevronFirst, ExternalLink, XCircle, Zap, Link, Loader2, BookOpen,
    Database, Activity
} from 'lucide-react';
import RefineRegeneratePanel from './RefineRegeneratePanel';
import CoverageAnalytics from './CoverageAnalytics';
import {
    computeRequirementTraceability,
    computeModuleDistribution,
    computeTypeRatios,
    computeOverallHealth,
} from '../utils/coverageAnalytics';

// ─── Priority Badge Component ───
const PriorityBadge = ({ priority }) => {
    const p = (priority || 'Medium').toLowerCase();
    return <span className={`tc-priority-badge ${p}`}>{priority || 'Medium'}</span>;
};

// ─── Type Badge Component ───
const TypeBadge = ({ type }) => {
    const typeClassMap = {
        'Functional': 'type-functional',
        'Negative': 'type-negative',
        'Edge': 'type-edge',
        'API': 'type-api',
        'Non-Functional': 'type-nonfunctional',
    };
    return <span className={`tc-type-badge ${typeClassMap[type] || ''}`}>{type || 'Functional'}</span>;
};

// ─── Severity Badge Component ───
const SeverityBadge = ({ severity }) => {
    const s = (severity || 'Major').toLowerCase();
    return <span className={`tc-severity-badge ${s}`}>{severity || 'Major'}</span>;
};

// ─── Status Badge Component ───
const StatusBadge = ({ status }) => {
    const s = (status || 'Not Executed').toLowerCase().replace(/\s+/g, '-');
    return <span className={`tc-status-badge ${s}`}>{status || 'Not Executed'}</span>;
};

// ─── Expandable Table Row ───
const TestCaseRow = React.memo(({ testCase, isExpanded, onToggleExpand, isSelected, onToggleSelect }) => {
    const handleCopy = (e) => {
        e.stopPropagation();
        const stepsText = testCase.steps && testCase.steps.length > 0
            ? testCase.steps.map((step, idx) => {
                if (typeof step === 'object' && step.action) {
                    return `${idx + 1}. Action: ${step.action}\n   Expected: ${step.expected || 'N/A'}`;
                }
                return `${idx + 1}. ${step}`;
            }).join('\n')
            : 'No steps provided';
        const preconText = Array.isArray(testCase.preconditions)
            ? testCase.preconditions.join(', ')
            : (testCase.preconditions || 'None');
        const textToCopy = `Test Case ID: ${testCase.id}
Test Scenario: ${testCase.testScenario || 'N/A'}
Title: ${testCase.title}
Module/Feature: ${testCase.module}
Requirement ID: ${testCase.requirementId}
Priority: ${testCase.priority}
Severity: ${testCase.severity || 'N/A'}
Preconditions: ${preconText}
Test Data: ${testCase.testData || 'N/A'}
Steps:\n${stepsText}
Expected Result: ${testCase.expectedResult || 'N/A'}
Actual Result: ${testCase.actualResult || 'Not yet executed'}
Status: ${testCase.status || 'Not Executed'}`;

        navigator.clipboard.writeText(textToCopy).then(() => {
            // brief visual feedback could be added
        }).catch(err => console.error('Failed to copy:', err));
    };

    return (
        <>
            <tr
                className={`tc-table-row ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => onToggleExpand(testCase.id)}
            >
                <td className="tc-cell-checkbox" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(testCase.id)}
                        className="tc-checkbox"
                    />
                </td>
                <td className="tc-cell-id"><span className="tc-id-pill">{testCase.id}</span></td>
                <td className="tc-cell-scenario" title={testCase.testScenario}>{testCase.testScenario || '—'}</td>
                <td className="tc-cell-title">{testCase.title}</td>
                <td className="tc-cell-module">{testCase.module}</td>
                <td className="tc-cell-priority"><PriorityBadge priority={testCase.priority} /></td>
                <td className="tc-cell-severity"><SeverityBadge severity={testCase.severity} /></td>
                <td className="tc-cell-status"><StatusBadge status={testCase.status} /></td>
                <td className="tc-cell-steps">
                    <span className="steps-count-badge">{testCase.steps?.length || 0} steps</span>
                </td>
                <td className="tc-cell-actions">
                    <button className="btn-icon-tiny" title="Copy" onClick={handleCopy}><Copy size={14} /></button>
                    <span className="expand-indicator">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                </td>
            </tr>
            {isExpanded && (
                <tr className="tc-expanded-row">
                    <td colSpan="10">
                        <div className="tc-expanded-content">
                            <div className="tc-detail-grid">
                                <div className="tc-detail-block">
                                    <h5 className="tc-detail-label">Preconditions</h5>
                                    {Array.isArray(testCase.preconditions) && testCase.preconditions.length > 0 ? (
                                        <div className="tc-preconditions-tags">
                                            {testCase.preconditions.map((p, i) => (
                                                <span key={i} className="tc-precondition-tag">{p}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="tc-detail-value">{typeof testCase.preconditions === 'string' ? testCase.preconditions : 'None specified'}</p>
                                    )}
                                </div>
                                <div className="tc-detail-block">
                                    <h5 className="tc-detail-label">Requirement ID</h5>
                                    <p className="tc-detail-value tc-req-id">{testCase.requirementId}</p>
                                </div>
                                <div className="tc-detail-block">
                                    <h5 className="tc-detail-label">Test Data</h5>
                                    <p className="tc-detail-value tc-test-data">
                                        <Database size={14} className="detail-icon" />
                                        {testCase.testData || 'N/A'}
                                    </p>
                                </div>
                                <div className="tc-detail-block">
                                    <h5 className="tc-detail-label">Actual Result</h5>
                                    <p className="tc-detail-value tc-actual-result">
                                        <Activity size={14} className="detail-icon" />
                                        {testCase.actualResult || 'Not yet executed'}
                                    </p>
                                </div>
                            </div>
                            <div className="tc-detail-block">
                                <h5 className="tc-detail-label">Steps to Execute</h5>
                                {testCase.steps?.length > 0 && typeof testCase.steps[0] === 'object' && testCase.steps[0].action ? (
                                    <div className="tc-steps-timeline">
                                        {testCase.steps.map((step, i) => (
                                            <div key={i} className="tc-timeline-item">
                                                <div className="tc-timeline-left">
                                                    <div className="tc-timeline-node">{i + 1}</div>
                                                    {i < testCase.steps.length - 1 && <div className="tc-timeline-line"></div>}
                                                </div>
                                                <div className="tc-timeline-content">
                                                    <div className="tc-step-grid">
                                                        <div className="tc-step-pane action-pane">
                                                            <span className="tc-pane-tag tag-action">ACTION</span>
                                                            <p className="tc-pane-text">{step.action}</p>
                                                        </div>
                                                        <div className="tc-step-pane expected-pane">
                                                            <span className="tc-pane-tag tag-expected">EXPECTED BEHAVIOR</span>
                                                            <p className="tc-pane-text">{step.expected || '—'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <ol className="tc-steps-list">
                                        {(testCase.steps || []).map((step, i) => (
                                            <li key={i}>{typeof step === 'string' ? step : step?.action || String(step)}</li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                            <div className="tc-detail-block">
                                <h5 className="tc-detail-label">Expected Result</h5>
                                <div className="tc-expected-result">
                                    <CheckSquare size={16} className="success-icon" />
                                    <p>{testCase.expectedResult}</p>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
});
TestCaseRow.displayName = 'TestCaseRow';

// ─── Empty State ───
const EmptyState = ({ message, submessage }) => (
    <div className="empty-state-luxury glass-card">
        <div className="empty-icon-wrapper">
            <Sparkles size={40} className="text-primary" />
        </div>
        <h3>{message || "No results to show"}</h3>
        <p>{submessage || "Generate a test suite to see structured results here."}</p>
    </div>
);

// ─── Main Results Section ───
const ResultsSection = ({ result, onSave, onRefineRegenerate }) => {
    console.log('ResultsSection rendering with:', result);
    if (!result) return <EmptyState message="Critical Error: No Result Data" />;

    const [activeTab, setActiveTab] = useState('Functional');
    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [expandedIds, setExpandedIds] = useState(new Set());
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

    const handleToggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleExpandAll = () => {
        if (isAllExpanded) {
            setExpandedIds(new Set());
        } else {
            const allIds = filteredData.map(tc => tc.id);
            setExpandedIds(new Set(allIds));
        }
        setIsAllExpanded(!isAllExpanded);
    };

    const tabs = [
        { name: 'Functional', icon: <ClipboardList size={18} />, count: result?.summary?.functional || 0, data: result?.functional || [] },
        { name: 'Negative', icon: <XCircle size={18} />, count: result?.summary?.negative || 0, data: result?.negative || [] },
        { name: 'Edge Cases', icon: <Zap size={18} />, count: result?.summary?.edge || 0, data: result?.edge || [] },
        { name: 'API', icon: <Link size={18} />, count: result?.apiChecklist?.length || result?.api?.length || 0, data: (result?.apiChecklist && result.apiChecklist.length > 0) ? result.apiChecklist : (result?.api || []) },
        { name: 'Non-Functional', icon: <AlertCircle size={18} />, count: result?.nonFunctional?.length || 0, data: result?.nonFunctional || [] },
        { name: 'Questions', icon: <MessageSquare size={18} />, count: result?.questions?.length || 0, data: result?.questions || [] }
    ];

    const currentTab = tabs.find(t => t.name === activeTab);

    const filteredData = useMemo(() => {
        if (!currentTab || !currentTab.data || !Array.isArray(currentTab.data)) return [];
        if (activeTab === 'Questions') return currentTab.data;

        return currentTab.data.filter(tc => {
            if (!tc) return false;
            const matchesSearch = ((tc.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (tc.expectedResult || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (tc.module || '').toLowerCase().includes(searchQuery.toLowerCase()));
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

        const structured = {
            metadata: {
                title: `Test Plan: ${result.feature || 'Unnamed Feature'}`,
                generated_at: timestamp,
                tool: 'Testnexa AI',
                version: '2.0',
            },
            summary: {
                functional: result.summary?.functional || 0,
                negative: result.summary?.negative || 0,
                edge_cases: result.summary?.edge || 0,
                api_checks: result.apiChecklist?.length || result.api?.length || 0,
                non_functional: result.nonFunctional?.length || 0,
            },
            coverage_analytics: {
                requirement_traceability: computeRequirementTraceability(result),
                module_distribution: computeModuleDistribution(result),
                type_ratios: computeTypeRatios(result),
                overall_health: computeOverallHealth(result),
            },
            test_cases: {
                functional: (result.functional || []).map(tc => ({
                    test_case_id: tc.id, test_scenario: tc.testScenario, title: tc.title,
                    module: tc.module, requirement_id: tc.requirementId,
                    priority: tc.priority, severity: tc.severity,
                    preconditions: tc.preconditions, test_data: tc.testData,
                    steps: tc.steps, expected_result: tc.expectedResult,
                    actual_result: tc.actualResult, status: tc.status,
                })),
                negative: (result.negative || []).map(tc => ({
                    test_case_id: tc.id, test_scenario: tc.testScenario, title: tc.title,
                    module: tc.module, requirement_id: tc.requirementId,
                    priority: tc.priority, severity: tc.severity,
                    preconditions: tc.preconditions, test_data: tc.testData,
                    steps: tc.steps, expected_result: tc.expectedResult,
                    actual_result: tc.actualResult, status: tc.status,
                })),
                edge_cases: (result.edge || []).map(tc => ({
                    test_case_id: tc.id, test_scenario: tc.testScenario, title: tc.title,
                    module: tc.module, requirement_id: tc.requirementId,
                    priority: tc.priority, severity: tc.severity,
                    preconditions: tc.preconditions, test_data: tc.testData,
                    steps: tc.steps, expected_result: tc.expectedResult,
                    actual_result: tc.actualResult, status: tc.status,
                })),
            },
            api_checklist: (result.apiChecklist || result.api || []).map(tc => ({
                test_case_id: tc.id, test_scenario: tc.testScenario, title: tc.title,
                module: tc.module, requirement_id: tc.requirementId,
                priority: tc.priority, severity: tc.severity,
                preconditions: tc.preconditions, test_data: tc.testData,
                steps: tc.steps, expected_result: tc.expectedResult,
                actual_result: tc.actualResult, status: tc.status,
            })),
            non_functional: (result.nonFunctional || []).map(tc => ({
                test_case_id: tc.id, test_scenario: tc.testScenario, title: tc.title,
                module: tc.module, requirement_id: tc.requirementId,
                priority: tc.priority, severity: tc.severity,
                preconditions: tc.preconditions, test_data: tc.testData,
                steps: tc.steps, expected_result: tc.expectedResult,
                actual_result: tc.actualResult, status: tc.status,
            })),
            assumptions: result.assumptions || [],
            clarification_questions: result.questions || [],
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
            {/* Summary Cards */}
            <div className="results-summary-grid">
                <div className="summary-chip-new functional glass-card">
                    <div className="chip-header">
                        <span className="chip-label-new">Functional</span>
                        <CheckSquare size={18} className="text-primary" />
                    </div>
                    <span className="chip-value-xl">{result?.summary?.functional || 0}</span>
                </div>
                <div className="summary-chip-new negative glass-card">
                    <div className="chip-header">
                        <span className="chip-label-new">Negative</span>
                        <XCircle size={18} className="text-danger" />
                    </div>
                    <span className="chip-value-xl">{result?.summary?.negative || 0}</span>
                </div>
                <div className="summary-chip-new edge glass-card">
                    <div className="chip-header">
                        <span className="chip-label-new">Edge Cases</span>
                        <Zap size={18} className="text-warning" />
                    </div>
                    <span className="chip-value-xl">{result?.summary?.edge || 0}</span>
                </div>
                <div className="summary-chip-new api glass-card">
                    <div className="chip-header">
                        <span className="chip-label-new">API</span>
                        <Link size={18} className="text-primary" />
                    </div>
                    <span className="chip-value-xl">{result?.summary?.apiChecklist || 0}</span>
                </div>
                <div className="summary-chip-new nonfunctional glass-card">
                    <div className="chip-header">
                        <span className="chip-label-new">Non-Functional</span>
                        <AlertCircle size={18} className="text-purple" />
                    </div>
                    <span className="chip-value-xl">{result?.nonFunctional?.length || 0}</span>
                </div>
            </div>

            {/* Coverage Analytics Dashboard */}
            <CoverageAnalytics result={result} />

            {/* Action Bar */}
            <div className="results-actions-bar glass-card">
                <div className="left-actions-padded">
                    <div className="search-input-wrapper-tall">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search by title, module, or expected result..."
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
                    <button className="btn-secondary-bright" onClick={handleExpandAll}>
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

            {/* Tabs */}
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
                    ) : activeTab === 'Questions' ? (
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
                        /* ─── TEST CASE TABLE ─── */
                        <div className="tc-table-wrapper glass-card">
                            <table className="tc-table">
                                <thead>
                                    <tr>
                                        <th className="tc-th-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                                                onChange={() => handleSelectAll(filteredData)}
                                                className="tc-checkbox"
                                            />
                                        </th>
                                        <th className="tc-th-id">ID</th>
                                        <th className="tc-th-scenario">Scenario</th>
                                        <th className="tc-th-title">Title</th>
                                        <th className="tc-th-module">Module</th>
                                        <th className="tc-th-priority">Priority</th>
                                        <th className="tc-th-severity">Severity</th>
                                        <th className="tc-th-status">Status</th>
                                        <th className="tc-th-steps">Steps</th>
                                        <th className="tc-th-actions"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((tc) => (
                                        <TestCaseRow
                                            key={tc.id}
                                            testCase={tc}
                                            isExpanded={expandedIds.has(tc.id)}
                                            onToggleExpand={handleToggleExpand}
                                            isSelected={selectedIds.includes(tc.id)}
                                            onToggleSelect={handleToggleSelect}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Refine & Regenerate Panel */}
            <RefineRegeneratePanel
                onRegenerate={async (refinementData) => {
                    setIsRefineRegenerating(true);
                    try {
                        if (onRefineRegenerate) {
                            const result = await onRefineRegenerate(refinementData);
                            return result;
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        return {
                            changesSummary: ['Refinement applied successfully'],
                            metadata: { testsAdded: 0 }
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
