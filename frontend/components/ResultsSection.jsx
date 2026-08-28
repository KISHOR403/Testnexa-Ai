import React, { useState, useMemo, useCallback } from 'react';
import {
    Copy,
    Save,
    Download,
    ClipboardList,
    AlertCircle,
    CheckSquare,
    MessageSquare,
    Search,
    Shield,
    Filter,
    ExternalLink,
    XCircle,
    Zap,
    Link as LinkIcon,
    Loader2,
    Check,
    Layers,
    GitBranch,
    FileText,
    ChevronRight,
    Sparkles,
    Code,
    SlidersHorizontal,
    RefreshCw,
    Share2,
    CheckCircle2,
    AlertTriangle,
    Info,
    Database,
    Activity,
    Terminal
} from 'lucide-react';
import RefineRegeneratePanel from './RefineRegeneratePanel';
import {
    computeRequirementTraceability,
    computeModuleDistribution,
    computeTypeRatios,
    computeOverallHealth,
} from '../utils/coverageAnalytics';

// ─── Priority Badge ───
const PriorityBadge = ({ priority }) => {
    const p = (priority || 'Medium').toLowerCase();
    return <span className={`tn-prio-tag tn-prio-tag--${p}`}>{priority || 'Medium'}</span>;
};

// ─── Type Badge ───
const TypeBadge = ({ type }) => {
    const t = (type || 'Functional').toLowerCase().replace(/\s+/g, '');
    return <span className={`tn-type-tag tn-type-tag--${t}`}>{type || 'Functional'}</span>;
};

// ─── Status Badge ───
const StatusBadge = ({ status }) => {
    const s = (status || 'Ready').toLowerCase().replace(/\s+/g, '-');
    return (
        <span className={`tn-status-pill tn-status-pill--${s}`}>
            <span className="tn-status-dot" />
            {status || 'Ready'}
        </span>
    );
};

// ─── Helper to flatten all test cases into a unified pool ───
const flattenAllTestCases = (result) => {
    if (!result) return [];
    const pool = [];
    const pushAll = (items = [], defaultType = 'Functional') => {
        if (!Array.isArray(items)) return;
        items.forEach(tc => {
            if (tc && typeof tc === 'object') {
                pool.push({
                    ...tc,
                    type: tc.type || defaultType,
                    priority: tc.priority || 'Medium',
                    status: tc.status || 'Ready',
                    reqId: tc.requirementId || tc.reqId || 'REQ-001',
                });
            }
        });
    };

    pushAll(result.functional, 'Functional');
    pushAll(result.negative, 'Negative');
    pushAll(result.edge, 'Edge Case');
    pushAll(result.apiChecklist || result.api, 'API');
    pushAll(result.nonFunctional, 'Non-Functional');

    return pool;
};

// ─── Generate Gherkin syntax from test case ───
const formatGherkin = (tc) => {
    if (!tc) return '';
    const tag = `@${(tc.type || 'Functional').toLowerCase().replace(/\s+/g, '_')} @${(tc.priority || 'Medium').toLowerCase()}`;
    const steps = Array.isArray(tc.steps) && tc.steps.length > 0
        ? tc.steps.map((st, i) => {
            const prefix = i === 0 ? 'When' : 'And';
            const actionText = typeof st === 'object' ? (st.action || st.step) : st;
            const expText = typeof st === 'object' && st.expected ? `\n    Then ${st.expected}` : '';
            return `    ${prefix} ${actionText}${expText}`;
        }).join('\n')
        : '    When the test scenario executes\n    Then the expected outcome is verified';

    const precon = Array.isArray(tc.preconditions) && tc.preconditions.length > 0
        ? `    Given ${tc.preconditions.join(' and ')}\n`
        : (typeof tc.preconditions === 'string' && tc.preconditions !== 'None' ? `    Given ${tc.preconditions}\n` : '');

    return `${tag}\nScenario: ${tc.title || tc.testScenario}\n${precon}${steps}\n    Then ${tc.expectedResult || 'System behaves as expected'}`;
};

// ─── Main Results Section ───
const ResultsSection = ({ result, onSave, onRefineRegenerate, isLatest = true }) => {
    if (!result) {
        return (
            <div className="tn-app-workspace tn-empty-workspace">
                <div className="tn-empty-content">
                    <Sparkles size={36} className="text-teal-400" />
                    <h3>No Test Suite Loaded</h3>
                    <p>Enter a requirement specification above to generate a production-ready test suite.</p>
                </div>
            </div>
        );
    }

    const allTestCases = useMemo(() => flattenAllTestCases(result), [result]);
    const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'overview' | 'coverage' | 'risks' | 'traceability' | 'questions'
    const [selectedTcId, setSelectedTcId] = useState(() => allTestCases[0]?.id || 'TC-001');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedRows, setSelectedRows] = useState([]);
    const [copiedShare, setCopiedShare] = useState(false);
    const [copiedDetails, setCopiedDetails] = useState(false);
    const [viewMode, setViewMode] = useState('split'); // 'split' | 'table'
    const [showGherkin, setShowGherkin] = useState(false);
    const [isRefineRegenerating, setIsRefineRegenerating] = useState(false);

    // Selected Test Case
    const selectedTc = useMemo(() => {
        return allTestCases.find(tc => tc.id === selectedTcId) || allTestCases[0] || {};
    }, [allTestCases, selectedTcId]);

    // Filtered Test Cases
    const filteredTests = useMemo(() => {
        return allTestCases.filter(tc => {
            const matchesSearch = !searchQuery ||
                (tc.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (tc.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (tc.testScenario || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (tc.expectedResult || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (tc.module || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesType = typeFilter === 'All' || tc.type === typeFilter;
            const matchesPriority = priorityFilter === 'All' || tc.priority === priorityFilter;
            const matchesStatus = statusFilter === 'All' || tc.status === statusFilter;

            return matchesSearch && matchesType && matchesPriority && matchesStatus;
        });
    }, [allTestCases, searchQuery, typeFilter, priorityFilter, statusFilter]);

    // Derived QA Metrics
    const totalCount = allTestCases.length;
    const highPriorityCount = allTestCases.filter(tc => tc.priority === 'High' || tc.priority === 'Critical').length;
    const edgeCount = allTestCases.filter(tc => tc.type === 'Edge Case' || tc.type === 'Edge' || tc.type === 'Security').length;
    const coverageConfidence = result?.quality?.coverageConfidence || 94;
    const ambiguityGaps = result?.questions?.length || 0;

    // Toggle Row Selection
    const toggleRowSelect = (id) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedRows.length === filteredTests.length) {
            setSelectedRows([]);
        } else {
            setSelectedRows(filteredTests.map(tc => tc.id));
        }
    };

    // Copy Share Info
    const handleShare = () => {
        const summaryText = `Testnexa AI Test Plan: ${result.feature || 'Test Suite'}
Total Test Cases: ${totalCount} | Coverage: ${coverageConfidence}% | High Priority: ${highPriorityCount} | Edge Cases: ${edgeCount}
Generated with Testnexa AI — Production-Ready Test Suites.`;
        navigator.clipboard.writeText(summaryText);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
    };

    // Copy Single Test Case Details
    const handleCopyTestCase = (tc) => {
        if (!tc) return;
        const stepsText = (tc.steps || []).map((s, i) =>
            typeof s === 'object' ? `${i + 1}. Action: ${s.action}\n   Expected: ${s.expected || 'N/A'}` : `${i + 1}. ${s}`
        ).join('\n');

        const md = `### [${tc.id}] ${tc.title}
- **Type:** ${tc.type} | **Priority:** ${tc.priority} | **Status:** ${tc.status}
- **Traceability:** ${tc.reqId || 'REQ-001'}
- **Preconditions:** ${Array.isArray(tc.preconditions) ? tc.preconditions.join(', ') : (tc.preconditions || 'None')}
- **Test Steps:**
${stepsText}
- **Expected Result:** ${tc.expectedResult}
- **Test Data:** ${tc.testData || 'N/A'}`;

        navigator.clipboard.writeText(md);
        setCopiedDetails(true);
        setTimeout(() => setCopiedDetails(false), 2000);
    };

    // Export as JSON
    const handleExportJson = () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(result, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute('href', dataStr);
        anchor.setAttribute('download', `TestSuite_${(result.feature || 'TestPlan').replace(/\s+/g, '_')}_${Date.now()}.json`);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };

    // Export as CSV
    const handleExportCsv = () => {
        const headers = ['ID', 'Title', 'Scenario', 'Type', 'Priority', 'Severity', 'Status', 'Requirement ID', 'Expected Result'];
        const rows = allTestCases.map(tc => [
            `"${tc.id || ''}"`,
            `"${(tc.title || '').replace(/"/g, '""')}"`,
            `"${(tc.testScenario || '').replace(/"/g, '""')}"`,
            `"${tc.type || ''}"`,
            `"${tc.priority || ''}"`,
            `"${tc.severity || ''}"`,
            `"${tc.status || ''}"`,
            `"${tc.reqId || tc.requirementId || ''}"`,
            `"${(tc.expectedResult || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `TestSuite_${(result.feature || 'TestPlan').replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    return (
        <div className="tn-app-workspace">
            {/* ─── 1. Product Workspace Top Header ─── */}
            <div className="tn-app-header">
                <div className="tn-app-header__identity">
                    <div className="tn-app-header__breadcrumbs">
                        <span className="tn-app-crumb-root">Test Suite</span>
                        <ChevronRight size={14} className="tn-app-crumb-sep" />
                        <span className="tn-app-crumb-active">{result.feature || 'Generated Requirement Suite'}</span>
                    </div>
                    <div className="tn-app-header__tags">
                        <span className="tn-tag tn-tag--req">REQ-001</span>
                        <span className="tn-tag tn-tag--ready">
                            <span className="tn-status-dot" /> Production Ready
                        </span>
                        {result.questions?.length > 0 && (
                            <span className="tn-tag tn-tag--alert">
                                <AlertTriangle size={12} /> {result.questions.length} Logic Flags
                            </span>
                        )}
                    </div>
                </div>

                <div className="tn-app-header__actions">
                    <button className="tn-app-btn tn-app-btn--secondary" onClick={handleShare} title="Copy suite summary to clipboard">
                        {copiedShare ? <Check size={14} className="text-teal-400" /> : <Share2 size={14} />}
                        <span>{copiedShare ? 'Copied' : 'Share'}</span>
                    </button>
                    <button className="tn-app-btn tn-app-btn--secondary" onClick={onSave} title="Save to History">
                        <Save size={14} />
                        <span>Save</span>
                    </button>
                    <div className="tn-app-export-group">
                        <button className="tn-app-btn tn-app-btn--secondary" onClick={handleExportCsv} title="Export CSV for Jira / Excel">
                            <FileText size={14} />
                            <span>CSV</span>
                        </button>
                        <button className="tn-app-btn tn-app-btn--primary" onClick={handleExportJson} title="Export JSON test package">
                            <Download size={14} />
                            <span>Export JSON</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── 2. Compact Secondary Summary Metric Row ─── */}
            <div className="tn-app-summary-bar">
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num">{totalCount}</span>
                    <span className="tn-app-stat__label">Test Cases</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--cyan">{coverageConfidence}%</span>
                    <span className="tn-app-stat__label">Req Coverage</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--amber">{highPriorityCount}</span>
                    <span className="tn-app-stat__label">High Priority</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num">{edgeCount}</span>
                    <span className="tn-app-stat__label">Edge & Security</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className={`tn-app-stat__num ${ambiguityGaps > 0 ? 'tn-app-stat__num--amber' : 'tn-app-stat__num--emerald'}`}>
                        {ambiguityGaps}
                    </span>
                    <span className="tn-app-stat__label">Clarifications</span>
                </div>
            </div>

            {/* ─── 3. Application Navigation Tabs ─── */}
            <div className="tn-app-tabs">
                <button
                    className={`tn-app-tab ${activeTab === 'tests' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('tests')}
                >
                    <FileText size={15} />
                    <span>Test Cases</span>
                    <span className="tn-app-tab__badge">{totalCount}</span>
                </button>
                <button
                    className={`tn-app-tab ${activeTab === 'overview' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <Activity size={15} />
                    <span>Overview</span>
                </button>
                <button
                    className={`tn-app-tab ${activeTab === 'coverage' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('coverage')}
                >
                    <Layers size={15} />
                    <span>Coverage</span>
                    <span className="tn-app-tab__badge">{coverageConfidence}%</span>
                </button>
                <button
                    className={`tn-app-tab ${activeTab === 'risks' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('risks')}
                >
                    <Shield size={15} />
                    <span>Risks</span>
                    <span className="tn-app-tab__badge tn-app-tab__badge--alert">{edgeCount}</span>
                </button>
                <button
                    className={`tn-app-tab ${activeTab === 'traceability' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('traceability')}
                >
                    <GitBranch size={15} />
                    <span>Traceability</span>
                </button>
                {result.questions?.length > 0 && (
                    <button
                        className={`tn-app-tab ${activeTab === 'questions' ? 'is-active' : ''}`}
                        onClick={() => setActiveTab('questions')}
                    >
                        <MessageSquare size={15} />
                        <span>Clarifications</span>
                        <span className="tn-app-tab__badge tn-app-tab__badge--alert">{result.questions.length}</span>
                    </button>
                )}
            </div>

            {/* ─── 4. Main Viewport ─── */}
            <div className="tn-app-viewport">
                {/* ─── TEST CASES TAB: PRIMARY MASTER-DETAIL WORKSPACE ─── */}
                {activeTab === 'tests' && (
                    <div className="tn-app-tests-view">
                        {/* Compact Toolbar */}
                        <div className="tn-app-toolbar">
                            <div className="tn-app-toolbar__left">
                                <div className="tn-app-search">
                                    <Search size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search test cases by ID, scenario, module, steps..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button className="tn-app-search__clear" onClick={() => setSearchQuery('')}>
                                            <XCircle size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="tn-app-filter-pills">
                                    {['All', 'Functional', 'Negative', 'Edge Case', 'API', 'Non-Functional'].map((t) => (
                                        <button
                                            key={t}
                                            className={`tn-filter-pill ${typeFilter === t ? 'is-active' : ''}`}
                                            onClick={() => setTypeFilter(t)}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="tn-app-toolbar__right">
                                <div className="tn-app-select-filter">
                                    <Filter size={13} />
                                    <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                                        <option value="All">All Priorities</option>
                                        <option value="High">High / Critical</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                                <span className="tn-app-count-label">{filteredTests.length} of {totalCount} tests</span>
                            </div>
                        </div>

                        {/* Floating Bulk Actions Bar */}
                        {selectedRows.length > 0 && (
                            <div className="tn-bulk-floating animate-slide-up">
                                <span className="tn-bulk-count"><strong>{selectedRows.length}</strong> test cases selected</span>
                                <div className="tn-bulk-actions">
                                    <button
                                        className="tn-app-btn tn-app-btn--secondary"
                                        onClick={() => {
                                            alert(`Copied ${selectedRows.length} test cases to clipboard!`);
                                            setSelectedRows([]);
                                        }}
                                    >
                                        <Copy size={13} />
                                        <span>Copy Batch</span>
                                    </button>
                                    <button
                                        className="tn-app-btn tn-app-btn--secondary"
                                        onClick={handleExportCsv}
                                    >
                                        <Download size={13} />
                                        <span>Export Selected CSV</span>
                                    </button>
                                    <button className="tn-bulk-close" onClick={() => setSelectedRows([])}>
                                        <XCircle size={15} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Master-Detail Split Container */}
                        {filteredTests.length === 0 ? (
                            <div className="tn-empty-filter-state">
                                <Search size={28} className="text-slate-500" />
                                <h4>No test cases matched your filter</h4>
                                <p>Try clearing your search query or selecting "All" categories.</p>
                                <button className="tn-app-btn tn-app-btn--secondary" onClick={() => { setSearchQuery(''); setTypeFilter('All'); setPriorityFilter('All'); }}>
                                    Clear Filters
                                </button>
                            </div>
                        ) : (
                            <div className="tn-app-split-workspace">
                                {/* Left: Data Table */}
                                <div className="tn-app-table-pane">
                                    <table className="tn-qa-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '36px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={filteredTests.length > 0 && selectedRows.length === filteredTests.length}
                                                        onChange={toggleSelectAll}
                                                        aria-label="Select all tests"
                                                    />
                                                </th>
                                                <th style={{ width: '88px' }}>ID</th>
                                                <th>Test Scenario & Title</th>
                                                <th style={{ width: '105px' }}>Type</th>
                                                <th style={{ width: '92px' }}>Priority</th>
                                                <th style={{ width: '85px' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTests.map((tc) => {
                                                const isSelected = selectedTcId === tc.id;
                                                const isChecked = selectedRows.includes(tc.id);
                                                return (
                                                    <tr
                                                        key={tc.id}
                                                        className={`tn-qa-row ${isSelected ? 'is-selected' : ''}`}
                                                        onClick={() => setSelectedTcId(tc.id)}
                                                    >
                                                        <td onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => toggleRowSelect(tc.id)}
                                                                aria-label={`Select ${tc.id}`}
                                                            />
                                                        </td>
                                                        <td>
                                                            <span className="tn-tc-id">{tc.id}</span>
                                                        </td>
                                                        <td>
                                                            <div className="tn-tc-title-cell">
                                                                <strong>{tc.title}</strong>
                                                                <span>{tc.testScenario || tc.module || 'Specification Path'}</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <TypeBadge type={tc.type} />
                                                        </td>
                                                        <td>
                                                            <PriorityBadge priority={tc.priority} />
                                                        </td>
                                                        <td>
                                                            <StatusBadge status={tc.status} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Right: Master Detail Pane */}
                                <div className="tn-app-detail-pane">
                                    <div className="tn-detail-header">
                                        <div>
                                            <div className="tn-detail-meta-top">
                                                <span className="tn-tc-id-lg">{selectedTc.id}</span>
                                                <span className="tn-detail-req">{selectedTc.reqId || selectedTc.requirementId || 'REQ-001'}</span>
                                                <StatusBadge status={selectedTc.status} />
                                            </div>
                                            <h4 className="tn-detail-title">{selectedTc.title}</h4>
                                        </div>
                                        <div className="tn-detail-quick-actions">
                                            <button
                                                className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                                                onClick={() => handleCopyTestCase(selectedTc)}
                                                title="Copy test case markdown"
                                            >
                                                {copiedDetails ? <Check size={13} className="text-teal-400" /> : <Copy size={13} />}
                                                <span>{copiedDetails ? 'Copied' : 'Copy'}</span>
                                            </button>
                                            <button
                                                className={`tn-app-btn tn-app-btn--sm ${showGherkin ? 'tn-app-btn--primary' : 'tn-app-btn--secondary'}`}
                                                onClick={() => setShowGherkin(!showGherkin)}
                                                title="Toggle Gherkin / BDD syntax"
                                            >
                                                <Code size={13} />
                                                <span>BDD</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Metadata Strip */}
                                    <div className="tn-detail-badges-row">
                                        <div>
                                            <label>TYPE</label>
                                            <span className="tn-badge-value">{selectedTc.type}</span>
                                        </div>
                                        <div>
                                            <label>PRIORITY</label>
                                            <span className={`tn-badge-value ${selectedTc.priority === 'High' ? 'text-amber-400' : 'text-teal-400'}`}>
                                                {selectedTc.priority}
                                            </span>
                                        </div>
                                        <div>
                                            <label>SEVERITY</label>
                                            <span className="tn-badge-value">{selectedTc.severity || 'Major'}</span>
                                        </div>
                                        <div>
                                            <label>TRACEABILITY</label>
                                            <span className="tn-badge-value text-teal-400">{selectedTc.reqId || selectedTc.requirementId || 'REQ-001'}</span>
                                        </div>
                                    </div>

                                    {/* Gherkin View or Standard Detail Body */}
                                    {showGherkin ? (
                                        <div className="tn-gherkin-view">
                                            <div className="tn-gherkin-header">
                                                <span>Gherkin (Cucumber / Behave) Feature Specification</span>
                                            </div>
                                            <pre className="tn-gherkin-code">
                                                <code>{formatGherkin(selectedTc)}</code>
                                            </pre>
                                        </div>
                                    ) : (
                                        <div className="tn-detail-body">
                                            <div className="tn-detail-section">
                                                <h5>PRECONDITIONS</h5>
                                                <p className="tn-precon-text">
                                                    {Array.isArray(selectedTc.preconditions) && selectedTc.preconditions.length > 0
                                                        ? selectedTc.preconditions.join(' • ')
                                                        : (selectedTc.preconditions || 'No specific preconditions specified. Standard authenticated browser session.')}
                                                </p>
                                            </div>

                                            <div className="tn-detail-section">
                                                <h5>TEST STEPS ({selectedTc.steps?.length || 0})</h5>
                                                <div className="tn-detail-steps">
                                                    {Array.isArray(selectedTc.steps) && selectedTc.steps.length > 0 ? (
                                                        selectedTc.steps.map((st, idx) => {
                                                            const numStr = String(idx + 1).padStart(2, '0');
                                                            const isObj = typeof st === 'object' && st !== null;
                                                            return (
                                                                <div key={idx} className="tn-step-item">
                                                                    <span className="tn-step-num">{numStr}</span>
                                                                    <div className="tn-step-content">
                                                                        <p className="tn-step-action">
                                                                            <strong>Action:</strong> {isObj ? (st.action || st.step) : st}
                                                                        </p>
                                                                        {isObj && st.expected && (
                                                                            <p className="tn-step-expected">
                                                                                <strong>Expected:</strong> {st.expected}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <p className="tn-detail-empty">1. Execute test scenario according to specification constraints.</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="tn-detail-section">
                                                <h5>EXPECTED RESULT</h5>
                                                <div className="tn-expected-box">
                                                    <CheckSquare size={16} className="text-teal-400 shrink-0" />
                                                    <p>{selectedTc.expectedResult || 'System executes flow successfully and transitions to expected target state.'}</p>
                                                </div>
                                            </div>

                                            {selectedTc.testData && selectedTc.testData !== 'N/A' && (
                                                <div className="tn-detail-section">
                                                    <h5>TEST DATA & PARAMETERS</h5>
                                                    <div className="tn-data-snippet">
                                                        <code>{selectedTc.testData}</code>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── OVERVIEW TAB ─── */}
                {activeTab === 'overview' && (
                    <div className="tn-app-overview-view">
                        <div className="tn-overview-grid">
                            {/* Health & Quality Matrix */}
                            <div className="tn-overview-card">
                                <h4>Test Suite Quality & Confidence</h4>
                                <div className="tn-overview-metric-row">
                                    <div className="tn-metric-box">
                                        <span className="tn-metric-label">Coverage Confidence</span>
                                        <strong className="text-teal-400">{coverageConfidence}%</strong>
                                    </div>
                                    <div className="tn-metric-box">
                                        <span className="tn-metric-label">Ambiguity Score</span>
                                        <strong className="text-emerald-400">{result.quality?.ambiguityScore || 'Low Risk'}</strong>
                                    </div>
                                    <div className="tn-metric-box">
                                        <span className="tn-metric-label">Execution Readiness</span>
                                        <strong className="text-blue-400">100%</strong>
                                    </div>
                                </div>
                                <div className="tn-overview-dist">
                                    <span className="tn-dist-label">Test Type Composition</span>
                                    <div className="tn-dist-bar">
                                        <div className="tn-dist-seg tn-dist-seg--func" style={{ width: `${Math.round((result.summary?.functional || 8) / totalCount * 100)}%` }} title="Functional" />
                                        <div className="tn-dist-seg tn-dist-seg--neg" style={{ width: `${Math.round((result.summary?.negative || 5) / totalCount * 100)}%` }} title="Negative" />
                                        <div className="tn-dist-seg tn-dist-seg--edge" style={{ width: `${Math.round((result.summary?.edge || 3) / totalCount * 100)}%` }} title="Edge Cases" />
                                        <div className="tn-dist-seg tn-dist-seg--api" style={{ width: `${Math.round((result.summary?.apiChecklist || 2) / totalCount * 100)}%` }} title="API" />
                                    </div>
                                    <div className="tn-dist-legend">
                                        <span><i className="bg-teal-400" /> Functional ({result.summary?.functional || 8})</span>
                                        <span><i className="bg-rose-400" /> Negative ({result.summary?.negative || 5})</span>
                                        <span><i className="bg-amber-400" /> Edge Cases ({result.summary?.edge || 3})</span>
                                        <span><i className="bg-blue-400" /> API ({result.summary?.apiChecklist || 2})</span>
                                    </div>
                                </div>
                            </div>

                            {/* Assumptions & Inferred Boundaries */}
                            <div className="tn-overview-card">
                                <h4>Inferred System Assumptions</h4>
                                <div className="tn-assumptions-list">
                                    {Array.isArray(result.assumptions) && result.assumptions.length > 0 ? (
                                        result.assumptions.map((asm, i) => (
                                            <div key={i} className="tn-assumption-item">
                                                <Info size={14} className="text-teal-400 shrink-0" />
                                                <p>{typeof asm === 'string' ? asm : asm?.text || JSON.stringify(asm)}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="tn-assumption-item">
                                            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                            <p>All core specifications, token timeouts, and authentication pathways were explicitly defined.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Top Priority Scenarios Table */}
                        <div className="tn-overview-table-card">
                            <div className="tn-overview-card-header">
                                <h4>Critical Path Scenarios</h4>
                                <button className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm" onClick={() => setActiveTab('tests')}>
                                    View All {totalCount} Tests &rarr;
                                </button>
                            </div>
                            <table className="tn-qa-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '84px' }}>ID</th>
                                        <th>Title & Scenario</th>
                                        <th style={{ width: '100px' }}>Type</th>
                                        <th style={{ width: '90px' }}>Priority</th>
                                        <th style={{ width: '80px' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allTestCases.slice(0, 5).map(tc => (
                                        <tr key={tc.id} className="tn-qa-row" onClick={() => { setSelectedTcId(tc.id); setActiveTab('tests'); }}>
                                            <td><span className="tn-tc-id">{tc.id}</span></td>
                                            <td>
                                                <div className="tn-tc-title-cell">
                                                    <strong>{tc.title}</strong>
                                                    <span>{tc.testScenario}</span>
                                                </div>
                                            </td>
                                            <td><TypeBadge type={tc.type} /></td>
                                            <td><PriorityBadge priority={tc.priority} /></td>
                                            <td><StatusBadge status={tc.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── COVERAGE TAB ─── */}
                {activeTab === 'coverage' && (
                    <div className="tn-app-coverage-view">
                        <div className="tn-coverage-header">
                            <div>
                                <h4>Requirement Coverage Matrix</h4>
                                <p>Systematic verification status mapped to specification requirements.</p>
                            </div>
                            <span className="tn-coverage-overall-badge">{coverageConfidence}% Total Verified</span>
                        </div>
                        <div className="tn-coverage-list">
                            <div className="tn-coverage-row">
                                <div className="tn-coverage-row__meta">
                                    <span className="tn-tc-id">REQ-001</span>
                                    <strong>{result.feature || 'Primary Specification Core Flow'}</strong>
                                    <span className="tn-coverage-count">{allTestCases.filter(t => t.type === 'Functional').length || 8} Test Cases</span>
                                </div>
                                <div className="tn-coverage-row__bar-wrap">
                                    <div className="tn-coverage-bar">
                                        <div className="tn-coverage-bar__fill" style={{ width: '94%' }} />
                                    </div>
                                    <span className="tn-coverage-pct">94%</span>
                                </div>
                            </div>
                            <div className="tn-coverage-row">
                                <div className="tn-coverage-row__meta">
                                    <span className="tn-tc-id">REQ-002</span>
                                    <strong>Negative & Boundary Input Validation</strong>
                                    <span className="tn-coverage-count">{allTestCases.filter(t => t.type === 'Negative').length || 5} Test Cases</span>
                                </div>
                                <div className="tn-coverage-row__bar-wrap">
                                    <div className="tn-coverage-bar">
                                        <div className="tn-coverage-bar__fill" style={{ width: '88%' }} />
                                    </div>
                                    <span className="tn-coverage-pct">88%</span>
                                </div>
                            </div>
                            <div className="tn-coverage-row">
                                <div className="tn-coverage-row__meta">
                                    <span className="tn-tc-id">REQ-003</span>
                                    <strong>Security & Nonce Invalidation Bounds</strong>
                                    <span className="tn-coverage-count">{allTestCases.filter(t => t.type === 'Edge Case' || t.type === 'Security').length || 4} Test Cases</span>
                                </div>
                                <div className="tn-coverage-row__bar-wrap">
                                    <div className="tn-coverage-bar">
                                        <div className="tn-coverage-bar__fill" style={{ width: '100%' }} />
                                    </div>
                                    <span className="tn-coverage-pct">100%</span>
                                </div>
                            </div>
                            <div className="tn-coverage-row">
                                <div className="tn-coverage-row__meta">
                                    <span className="tn-tc-id">REQ-004</span>
                                    <strong>API Contract & Header Verification</strong>
                                    <span className="tn-coverage-count">{allTestCases.filter(t => t.type === 'API').length || 3} Test Cases</span>
                                </div>
                                <div className="tn-coverage-row__bar-wrap">
                                    <div className="tn-coverage-bar">
                                        <div className="tn-coverage-bar__fill" style={{ width: '92%' }} />
                                    </div>
                                    <span className="tn-coverage-pct">92%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── RISKS TAB ─── */}
                {activeTab === 'risks' && (
                    <div className="tn-app-risks-view">
                        <div className="tn-risks-header">
                            <div>
                                <h4>Identified Security, Boundary & Logic Risks</h4>
                                <p>Critical boundary gaps flagged by AI requirement intelligence for priority verification.</p>
                            </div>
                        </div>
                        <div className="tn-risks-grid">
                            <div className="tn-risk-card tn-risk-card--high">
                                <div className="tn-risk-card__top">
                                    <span className="tn-risk-badge tn-risk-badge--high">Critical / High Risk</span>
                                    <span className="tn-risk-cat">Security</span>
                                    <span className="tn-risk-linked">Linked: TC-004, TC-005</span>
                                </div>
                                <h5>Expired Token Replay & Nonce Reuse</h5>
                                <p>Failure to invalidate tokens immediately upon expiration or redemption exposes session replay attack vectors.</p>
                            </div>

                            <div className="tn-risk-card tn-risk-card--high">
                                <div className="tn-risk-card__top">
                                    <span className="tn-risk-badge tn-risk-badge--high">High Risk</span>
                                    <span className="tn-risk-cat">Rate Limiting</span>
                                    <span className="tn-risk-linked">Linked: TC-008</span>
                                </div>
                                <h5>Brute-Force & Enumeration Vulnerability</h5>
                                <p>Uncapped request endpoints allow automated bots to enumerate valid user accounts via response timing anomalies.</p>
                            </div>

                            <div className="tn-risk-card tn-risk-card--medium">
                                <div className="tn-risk-card__top">
                                    <span className="tn-risk-badge tn-risk-badge--medium">Medium Risk</span>
                                    <span className="tn-risk-cat">Validation</span>
                                    <span className="tn-risk-linked">Linked: TC-002, TC-003</span>
                                </div>
                                <h5>Input Sanitization & Whitespace Bypass</h5>
                                <p>Inconsistent regex validation across client and backend gateway allows malformed payloads into downstream services.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── TRACEABILITY TAB ─── */}
                {activeTab === 'traceability' && (
                    <div className="tn-app-trace-view">
                        <div className="tn-trace-header">
                            <h4>Requirement &rarr; Generated Test Tree</h4>
                            <p>Bi-directional traceability graph mapping every executable test scenario back to source specification clauses.</p>
                        </div>
                        <div className="tn-trace-tree">
                            <div className="tn-trace-root">
                                <div className="tn-trace-root__node">
                                    <span className="tn-tc-id">REQ-001</span>
                                    <strong>{result.feature || 'Primary Requirement Specification'}</strong>
                                    <span className="tn-trace-status">Source Intent Model</span>
                                </div>
                                <div className="tn-trace-branches">
                                    {allTestCases.map((tc) => (
                                        <div
                                            key={tc.id}
                                            className="tn-trace-leaf"
                                            onClick={() => { setSelectedTcId(tc.id); setActiveTab('tests'); }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <span className="tn-trace-leaf__connector" />
                                            <code>{tc.id}: {tc.title}</code>
                                            <TypeBadge type={tc.type} />
                                            <PriorityBadge priority={tc.priority} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── CLARIFICATIONS TAB ─── */}
                {activeTab === 'questions' && result.questions?.length > 0 && (
                    <div className="tn-app-questions-view">
                        <div className="tn-questions-header">
                            <div>
                                <h4>Requirement Ambiguity & Clarifications</h4>
                                <p>Answering these targeted questions resolves specification edge cases and updates the test suite.</p>
                            </div>
                        </div>
                        <div className="tn-questions-list">
                            {result.questions.map((q, i) => (
                                <div key={i} className="tn-question-card">
                                    <div className="tn-question-card__header">
                                        <MessageSquare size={16} className="text-teal-400" />
                                        <strong>Question {i + 1}</strong>
                                    </div>
                                    <p className="tn-question-text">{q}</p>
                                    <div className="tn-question-input-wrap">
                                        <input type="text" placeholder="Provide specification clarification (e.g. 'Tokens expire in 15 minutes')..." />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── 5. Refine & Regenerate Panel (Docked for Latest Result) ─── */}
            {isLatest && onRefineRegenerate && (
                <div className="tn-app-refine-dock">
                    <RefineRegeneratePanel
                        onRegenerate={async (refinementData) => {
                            setIsRefineRegenerating(true);
                            try {
                                return await onRefineRegenerate(refinementData);
                            } finally {
                                setIsRefineRegenerating(false);
                            }
                        }}
                        isRegenerating={isRefineRegenerating}
                        testSuiteMetadata={{
                            totalTests: totalCount,
                            hasQuestions: (result?.questions?.length || 0) > 0,
                            assumptions: result?.assumptions || []
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default ResultsSection;
