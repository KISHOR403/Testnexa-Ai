import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Lightbulb,
    Code,
    SlidersHorizontal,
    RefreshCw,
    Share2,
    CheckCircle2,
    AlertTriangle,
    Info,
    Database,
    Activity,
    Terminal,
    Edit3,
    Plus,
    Trash2,
    Send,
    Bot,
    User,
    X,
    CheckCheck,
    Lock,
    HelpCircle,
    MoreHorizontal,
    ArrowLeft,
    Copy as CopyIcon
} from 'lucide-react';
import RefineRegeneratePanel from './RefineRegeneratePanel';
import QaCopilotDrawer from './copilot/QaCopilotDrawer';

// ─── Status Badge Component ───
const StatusBadge = ({ status }) => {
    const s = (status || 'Needs Review').toLowerCase().replace(/\s+/g, '-');
    const isApproved = s.includes('approved');
    const isReady = s.includes('ready');
    const isReview = s.includes('review');

    return (
        <span className={`tn-status-pill tn-status-pill--${isApproved ? 'approved' : isReady ? 'ready' : isReview ? 'review' : 'generated'}`}>
            <span className="tn-status-dot" />
            {isApproved ? '✓ Approved' : status || 'Needs Review'}
        </span>
    );
};

// ─── Priority Badge Component ───
const PriorityBadge = ({ priority }) => {
    const p = (priority || 'Medium').toLowerCase();
    return <span className={`tn-prio-tag tn-prio-tag--${p}`}>{priority || 'Medium'}</span>;
};

// ─── Type Badge Component ───
const TypeBadge = ({ type }) => {
    const t = (type || 'Functional').toLowerCase().replace(/\s+/g, '');
    return <span className={`tn-type-tag tn-type-tag--${t}`}>{type || 'Functional'}</span>;
};

// ─── Collapsible Section Component ───
const CollapsibleSection = ({ title, children, defaultOpen = true, count }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className={`tn-collapsible ${isOpen ? 'is-open' : ''}`}>
            <button className="tn-collapsible__trigger" onClick={() => setIsOpen(!isOpen)}>
                <ChevronRight size={14} className={`tn-collapsible__chevron ${isOpen ? 'is-rotated' : ''}`} />
                <h5>{title}{count !== undefined ? ` (${count})` : ''}</h5>
            </button>
            {isOpen && <div className="tn-collapsible__body">{children}</div>}
        </div>
    );
};

// ─── Helper to determine if an object contains test cases ───
const hasTestCases = (data) => {
    if (!data || typeof data !== 'object') return false;
    const target = data.suiteData || data.suite_data || data.suite || data.data || data;
    return Boolean(
        (Array.isArray(target.testCases) && target.testCases.length > 0) ||
        (Array.isArray(target.tests) && target.tests.length > 0) ||
        (Array.isArray(target.functional) && target.functional.length > 0) ||
        (Array.isArray(target.negative) && target.negative.length > 0) ||
        (Array.isArray(target.edge) && target.edge.length > 0) ||
        (Array.isArray(target.security) && target.security.length > 0) ||
        (Array.isArray(target.nonFunctional) && target.nonFunctional.length > 0) ||
        (Array.isArray(target.apiChecklist) && target.apiChecklist.length > 0) ||
        (Array.isArray(target.api) && target.api.length > 0) ||
        (Array.isArray(data.testCases) && data.testCases.length > 0) ||
        (Array.isArray(data.tests) && data.tests.length > 0) ||
        (Array.isArray(data.functional) && data.functional.length > 0) ||
        (Array.isArray(data.negative) && data.negative.length > 0) ||
        (Array.isArray(data.edge) && data.edge.length > 0) ||
        (Array.isArray(data.security) && data.security.length > 0) ||
        (Array.isArray(data.nonFunctional) && data.nonFunctional.length > 0) ||
        (Array.isArray(data.apiChecklist) && data.apiChecklist.length > 0) ||
        (Array.isArray(data.api) && data.api.length > 0)
    );
};

// ─── Helper to flatten test cases into initial state pool ───
const flattenAllTestCases = (result) => {
    if (!result) return [];

    try {
        // Unwrap if result wraps suiteData / data / suite
        const target = (result.suiteData && typeof result.suiteData === 'object' && hasTestCases(result.suiteData))
            ? (result.suiteData.suiteData || result.suiteData.suite || result.suiteData.data || result.suiteData)
            : (result.suite && typeof result.suite === 'object' && hasTestCases(result.suite))
                ? (result.suite.suiteData || result.suite.suite || result.suite.data || result.suite)
                : (result.data && typeof result.data === 'object' && hasTestCases(result.data))
                    ? (result.data.suiteData || result.data.suite || result.data.data || result.data)
                    : result;

        const pool = [];
        const seenIds = new Set();

        const pushAll = (items = [], defaultType = 'Functional') => {
            if (!Array.isArray(items)) return;
            items.forEach((tc) => {
                if (tc && typeof tc === 'object') {
                    const id = tc.id || `TC-${String(pool.length + 1).padStart(3, '0')}`;
                    if (seenIds.has(id)) return;
                    seenIds.add(id);

                    pool.push({
                        ...tc,
                        id,
                        title: tc.title || tc.testScenario || tc.scenario || `Verify ${tc.type || defaultType} Flow`,
                        scenario: tc.scenario || tc.testScenario || tc.title || 'Specification Verification',
                        type: tc.type || defaultType,
                        priority: tc.priority || 'Medium',
                        severity: tc.severity || (tc.priority === 'High' || tc.priority === 'Critical' ? 'Critical' : 'Major'),
                        status: tc.status || 'Needs Review',
                        reqId: tc.requirementId || tc.reqId || 'REQ-001',
                        preconditions: Array.isArray(tc.preconditions)
                            ? tc.preconditions
                            : (tc.preconditions ? [String(tc.preconditions)] : ['User is authenticated in the testing environment.']),
                        steps: Array.isArray(tc.steps) && tc.steps.length > 0
                            ? tc.steps.map(st => typeof st === 'object' ? st : { action: String(st), expected: 'Verification criteria satisfied.' })
                            : [{ action: 'Execute test scenario according to specification constraints.', expected: 'Output satisfies acceptance rules.' }],
                        expectedResult: tc.expectedResult || 'System behaves strictly as defined in requirement specification.',
                        testData: tc.testData || ''
                    });
                }
            });
        };

        // If there is already a flat array of test cases
        if (Array.isArray(target.testCases) && target.testCases.length > 0) {
            pushAll(target.testCases);
        } else if (Array.isArray(target.tests) && target.tests.length > 0) {
            pushAll(target.tests);
        } else {
            // Categorized arrays
            pushAll(target.functional, 'Functional');
            pushAll(target.negative, 'Negative');
            pushAll(target.edge, 'Edge Case');
            pushAll(target.security, 'Security');
            pushAll(target.apiChecklist || target.api, 'API');
            pushAll(target.nonFunctional, 'Non-Functional');
        }

        return pool;
    } catch (err) {
        console.error('Error flattening test cases in ResultsSection:', err);
        return [];
    }
};

// ─── Gherkin Formatter ───
const formatGherkin = (tc) => {
    if (!tc) return '';
    const tag = `@${(tc.type || 'Functional').toLowerCase().replace(/\s+/g, '_')} @${(tc.priority || 'Medium').toLowerCase()}`;
    const pre = Array.isArray(tc.preconditions) && tc.preconditions.length > 0
        ? `    Given ${tc.preconditions.join(' and ')}\n`
        : '    Given the test environment is initialized\n';

    const steps = Array.isArray(tc.steps) && tc.steps.length > 0
        ? tc.steps.map((st, i) => {
            const prefix = i === 0 ? 'When' : 'And';
            const actionText = typeof st === 'object' ? (st.action || st.step) : st;
            const expText = typeof st === 'object' && st.expected ? `\n    Then ${st.expected}` : '';
            return `    ${prefix} ${actionText}${expText}`;
        }).join('\n')
        : '    When the test scenario executes\n    Then the result is validated';

    return `${tag}\nScenario: ${tc.title || tc.testScenario}\n${pre}${steps}\n    Then ${tc.expectedResult || 'State verification passes'}`;
};

// ─── Main Results Section ───
const ResultsSection = ({ result, onSave, onRefineRegenerate, isLatest = true }) => {
    if (!result) {
        return (
            <div className="tn-app-workspace tn-empty-workspace">
                <div className="tn-empty-content">
                    <Layers size={36} className="text-teal-400" />
                    <h3>No Test Suite Loaded</h3>
                    <p>Enter a requirement specification above to generate a production-ready test suite.</p>
                </div>
            </div>
        );
    }

    // ─── Interactive State ───
    const [testCases, setTestCases] = useState(() => flattenAllTestCases(result));
    const [suiteStatus, setSuiteStatus] = useState('Needs Review');
    const [activeTab, setActiveTab] = useState('tests');
    const [selectedTcId, setSelectedTcId] = useState(() => testCases[0]?.id || 'TC-001');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedRows, setSelectedRows] = useState([]);
    const [showGherkin, setShowGherkin] = useState(false);

    // ─── Split View Detail Panel Toggle ───
    const [isDetailOpen, setIsDetailOpen] = useState(true);

    // ─── Mobile detail drill-down ───
    const [mobileShowDetail, setMobileShowDetail] = useState(false);

    // ─── Inline editing in detail panel ───
    const [isInlineEditing, setIsInlineEditing] = useState(false);
    const [inlineEditData, setInlineEditData] = useState(null);
    const [showSavedFeedback, setShowSavedFeedback] = useState(false);

    // ─── More menu in detail panel ───
    const [showDetailMore, setShowDetailMore] = useState(false);
    const detailMoreRef = useRef(null);

    // ─── Modals and Drawers ───
    const [showAiCopilot, setShowAiCopilot] = useState(false);
    const [showAiInsightsDrawer, setShowAiInsightsDrawer] = useState(false);
    const [showRegenModal, setShowRegenModal] = useState(false);
    const [editingTc, setEditingTc] = useState(null);
    const [regenGoal, setRegenGoal] = useState('Improve scenario clarity and add boundary asserts');
    const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState('json');
    const [exportOptions, setExportOptions] = useState({
        steps: true,
        expected: true,
        preconditions: true,
        priority: true,
        traceability: true
    });
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareRole, setShareRole] = useState('Reviewer');
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedDetails, setCopiedDetails] = useState(false);
    const [isRefineRegenerating, setIsRefineRegenerating] = useState(false);

    // ─── QA Copilot Integration Handlers ───
    const handleCopilotAddTestCase = (newTestCase) => {
        setTestCases(prev => [newTestCase, ...prev]);
        setSelectedTcId(newTestCase.id);
        setActiveTab('tests');
    };

    const handleCopilotUpdateTestCase = (updatedTestCase) => {
        setTestCases(prev => prev.map(tc => tc.id === updatedTestCase.id ? { ...tc, ...updatedTestCase } : tc));
    };

    // Keep test cases synced if incoming result prop changes completely
    useEffect(() => {
        setTestCases(flattenAllTestCases(result));
        setSuiteStatus('Needs Review');
    }, [result]);

    // Close detail more menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (detailMoreRef.current && !detailMoreRef.current.contains(e.target)) {
                setShowDetailMore(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Selected Test Case Reference
    const selectedTc = useMemo(() => {
        return testCases.find(tc => tc.id === selectedTcId) || testCases[0] || {};
    }, [testCases, selectedTcId]);

    // Filtered Test Cases
    const filteredTests = useMemo(() => {
        return testCases.filter(tc => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                (tc.title || '').toLowerCase().includes(q) ||
                (tc.id || '').toLowerCase().includes(q) ||
                (tc.testScenario || '').toLowerCase().includes(q) ||
                (tc.scenario || '').toLowerCase().includes(q) ||
                (tc.expectedResult || '').toLowerCase().includes(q) ||
                (tc.reqId || '').toLowerCase().includes(q) ||
                (tc.module || '').toLowerCase().includes(q);

            const matchesType = typeFilter === 'All' || tc.type === typeFilter;
            const matchesPriority = priorityFilter === 'All' || tc.priority === priorityFilter;
            const matchesStatus = statusFilter === 'All' ||
                (statusFilter === 'Approved' && tc.status === 'Approved') ||
                (statusFilter === 'Needs Review' && tc.status === 'Needs Review') ||
                (statusFilter === 'Ready' && (tc.status === 'Ready' || tc.status === 'Approved'));

            return matchesSearch && matchesType && matchesPriority && matchesStatus;
        });
    }, [testCases, searchQuery, typeFilter, priorityFilter, statusFilter]);

    // Derived Metrics
    const totalCount = testCases.length;
    const highPriorityCount = useMemo(() => {
        return testCases.filter(tc => {
            const p = (tc.priority || '').toLowerCase();
            return p === 'high' || p === 'critical';
        }).length;
    }, [testCases]);

    const edgeAndSecurityCount = useMemo(() => {
        return testCases.filter(tc => {
            const t = (tc.type || '').toLowerCase();
            return t.includes('edge') || t.includes('sec');
        }).length;
    }, [testCases]);

    const approvedCount = useMemo(() => {
        return testCases.filter(tc => (tc.status || '').toLowerCase() === 'approved').length;
    }, [testCases]);

    const coverageConfidence = useMemo(() => {
        if (totalCount === 0) return 0;
        const types = new Set(testCases.map(tc => (tc.type || '').toLowerCase()));
        let baseCoverage = 45;
        if (types.has('functional')) baseCoverage += 25;
        if (types.has('negative')) baseCoverage += 15;
        if (types.has('edge case') || types.has('edge')) baseCoverage += 10;
        if (types.has('security')) baseCoverage += 5;
        return Math.min(baseCoverage, 100);
    }, [testCases, totalCount]);

    // Dynamic insights derived from actual test suite data
    const uncoveredCount = useMemo(() => {
        if (Array.isArray(result?.coverageGaps) && result.coverageGaps.length > 0) {
            return result.coverageGaps.length;
        }
        const hasNegative = testCases.some(tc => (tc.type || '').toLowerCase() === 'negative');
        const hasEdge = testCases.some(tc => (tc.type || '').toLowerCase().includes('edge'));
        let gaps = 0;
        if (!hasNegative) gaps++;
        if (!hasEdge) gaps++;
        return gaps;
    }, [result?.coverageGaps, testCases]);

    const securityWarningTc = useMemo(() => {
        return testCases.find(tc =>
            (tc.type || '').toLowerCase().includes('sec') ||
            (tc.severity || '').toLowerCase() === 'critical'
        ) || null;
    }, [testCases]);

    const hasInsights = uncoveredCount > 0 || securityWarningTc !== null;

    // Selected Test Case Index for prev / next navigation
    const selectedTcIndex = useMemo(() => {
        return filteredTests.findIndex(tc => tc.id === selectedTc?.id);
    }, [filteredTests, selectedTc]);

    const handlePrevTc = () => {
        if (selectedTcIndex > 0) {
            setSelectedTcId(filteredTests[selectedTcIndex - 1].id);
        }
    };

    const handleNextTc = () => {
        if (selectedTcIndex < filteredTests.length - 1) {
            setSelectedTcId(filteredTests[selectedTcIndex + 1].id);
        }
    };

    const handleCloseDetail = () => {
        setIsDetailOpen(false);
        setMobileShowDetail(false);
    };

    // ─── Selection Handlers ───
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

    // ─── Bulk Action Handlers ───
    const handleBulkApprove = () => {
        setTestCases(prev => prev.map(tc => selectedRows.includes(tc.id) ? { ...tc, status: 'Approved' } : tc));
        setSelectedRows([]);
    };

    const handleBulkPriority = (newPriority) => {
        setTestCases(prev => prev.map(tc => selectedRows.includes(tc.id) ? { ...tc, priority: newPriority } : tc));
        setSelectedRows([]);
    };

    // ─── Single Test Approval Handler ───
    const handleApproveSingle = (id) => {
        setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, status: tc.status === 'Approved' ? 'Needs Review' : 'Approved' } : tc));
    };

    // ─── Suite Approval Handler ───
    const handleApproveSuite = () => {
        setTestCases(prev => prev.map(tc => ({ ...tc, status: 'Approved' })));
        setSuiteStatus('Approved');
        setShowApproveModal(false);
    };

    // ─── Inline Edit Handlers ───
    const handleStartInlineEdit = (tc) => {
        setInlineEditData(JSON.parse(JSON.stringify(tc)));
        setIsInlineEditing(true);
    };

    const handleSaveInlineEdit = () => {
        if (!inlineEditData) return;
        setTestCases(prev => prev.map(tc => tc.id === inlineEditData.id ? inlineEditData : tc));
        setIsInlineEditing(false);
        setShowSavedFeedback(true);
        setTimeout(() => setShowSavedFeedback(false), 2000);
    };

    const handleCancelInlineEdit = () => {
        setIsInlineEditing(false);
        setInlineEditData(null);
    };

    // ─── Single Test Regenerate Handler ───
    const handleOpenRegenerateSingle = (tc) => {
        setEditingTc(tc);
        setShowRegenModal(true);
    };

    const handleExecuteSingleRegen = () => {
        setIsRegeneratingSingle(true);
        setTimeout(() => {
            setTestCases(prev => prev.map(tc => {
                if (tc.id === editingTc.id) {
                    return {
                        ...tc,
                        title: `${tc.title} (Enhanced with ${regenGoal.toLowerCase()})`,
                        priority: 'High',
                        severity: 'Critical',
                        status: 'Needs Review',
                        steps: [
                            ...tc.steps,
                            { action: `Verify security boundary assertion for ${regenGoal.toLowerCase()}.`, expected: 'Payload blocked with structured telemetry log.' }
                        ]
                    };
                }
                return tc;
            }));
            setIsRegeneratingSingle(false);
            setShowRegenModal(false);
        }, 1200);
    };

    // ─── Add Missing Tests from AI Recommendation ───
    const handleAddMissingTests = () => {
        const newTests = [
            {
                id: `TC-${String(testCases.length + 1).padStart(3, '0')}`,
                title: 'Enforce rate limiting on repeated reset dispatches',
                scenario: 'Block brute-force mail server flooding via 5+ requests in 60s',
                type: 'Security',
                priority: 'High',
                severity: 'Critical',
                status: 'Needs Review',
                reqId: 'REQ-001',
                preconditions: ['User or automated client on /forgot-password endpoint.'],
                steps: [
                    { action: 'Submit 5 consecutive password reset requests within 30 seconds.', expected: 'First 3 requests process normally; 4th and 5th return HTTP 429 Too Many Requests.' },
                    { action: 'Inspect retry-after header.', expected: 'Header contains "Retry-After: 60" cooldown window.' }
                ],
                expectedResult: 'API gateway throttles excessive reset requests and logs anomaly event.',
                testData: 'rateLimit: "3 req/min", clientIP: "198.51.100.42"'
            },
            {
                id: `TC-${String(testCases.length + 2).padStart(3, '0')}`,
                title: 'Account enumeration timing mitigation verification',
                scenario: 'Ensure identical response latency for valid vs non-existent emails',
                type: 'Security',
                priority: 'High',
                severity: 'Major',
                status: 'Needs Review',
                reqId: 'REQ-001',
                preconditions: ['Endpoint configured with constant-time response dummy hashing.'],
                steps: [
                    { action: 'Dispatch reset request for verified user "alex@company.com".', expected: 'Response returned in ~180ms.' },
                    { action: 'Dispatch reset request for unregistered user "ghost@nowhere.com".', expected: 'Response returned in ~180ms with identical generic success message.' }
                ],
                expectedResult: 'Attacker cannot determine user registration status via response delta.',
                testData: 'timingThreshold: "< 25ms variance"'
            }
        ];

        setTestCases(prev => [...prev, ...newTests]);
        setSelectedTcId(newTests[0].id);
        setActiveTab('tests');
        setShowAiInsightsDrawer(false);
    };


    // ─── Copy Details ───
    const handleCopyDetails = (tc) => {
        if (!tc) return;
        const md = `### [${tc.id}] ${tc.title}
- **Type:** ${tc.type} | **Priority:** ${tc.priority} | **Status:** ${tc.status}
- **Traceability:** ${tc.reqId || 'REQ-001'}
- **Preconditions:** ${Array.isArray(tc.preconditions) ? tc.preconditions.join(', ') : tc.preconditions}
- **Expected Result:** ${tc.expectedResult}`;

        navigator.clipboard.writeText(md);
        setCopiedDetails(true);
        setTimeout(() => setCopiedDetails(false), 2000);
    };

    // ─── Export Handler ───
    const handleExecuteExport = () => {
        let content = '';
        let filename = `TestSuite_${(result.feature || 'TestPlan').replace(/\s+/g, '_')}`;
        let mime = 'application/json';

        if (exportFormat === 'json') {
            content = JSON.stringify({
                metadata: {
                    suite: result.feature || 'Password Reset Suite',
                    requirement: 'REQ-001',
                    status: suiteStatus,
                    exported_at: new Date().toISOString()
                },
                testCases: testCases.map(tc => ({
                    id: tc.id,
                    title: tc.title,
                    type: tc.type,
                    priority: tc.priority,
                    severity: tc.severity,
                    status: tc.status,
                    preconditions: exportOptions.preconditions ? tc.preconditions : undefined,
                    steps: exportOptions.steps ? tc.steps : undefined,
                    expectedResult: exportOptions.expected ? tc.expectedResult : undefined,
                    requirementId: exportOptions.traceability ? tc.reqId : undefined
                }))
            }, null, 2);
            filename += '.json';
            mime = 'application/json';
        } else {
            // CSV / Excel
            const headers = ['ID', 'Title', 'Type', 'Priority', 'Severity', 'Status'];
            if (exportOptions.traceability) headers.push('Requirement');
            if (exportOptions.expected) headers.push('Expected Result');

            const rows = testCases.map(tc => {
                const row = [
                    `"${tc.id}"`,
                    `"${(tc.title || '').replace(/"/g, '""')}"`,
                    `"${tc.type}"`,
                    `"${tc.priority}"`,
                    `"${tc.severity}"`,
                    `"${tc.status}"`
                ];
                if (exportOptions.traceability) row.push(`"${tc.reqId}"`);
                if (exportOptions.expected) row.push(`"${(tc.expectedResult || '').replace(/"/g, '""')}"`);
                return row.join(',');
            });

            content = [headers.join(','), ...rows].join('\n');
            filename += exportFormat === 'excel' ? '.csv' : '.csv';
            mime = 'text/csv';
        }

        const dataStr = `data:${mime};charset=utf-8,` + encodeURIComponent(content);
        const anchor = document.createElement('a');
        anchor.setAttribute('href', dataStr);
        anchor.setAttribute('download', filename);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setShowExportModal(false);
    };

    // ─── Mobile test case selection ───
    const handleSelectTestMobile = (tcId) => {
        setSelectedTcId(tcId);
        setMobileShowDetail(true);
        setIsInlineEditing(false);
        setShowGherkin(false);
    };

    const handleMobileBack = () => {
        setMobileShowDetail(false);
        setIsInlineEditing(false);
    };

    // ─── Render Detail Panel Content (shared between desktop and mobile) ───
    const renderDetailPanelContent = () => {
        if (!selectedTc || !selectedTc.id) return null;

        // If inline editing
        if (isInlineEditing && inlineEditData) {
            return (
                <div className="tn-detail-inline-editor">
                    <div className="tn-detail-header">
                        <div className="tn-detail-meta-top">
                            <span className="tn-tc-id-lg">{inlineEditData.id}</span>
                            <span className="tn-inline-edit-badge">Editing</span>
                        </div>
                    </div>

                    <div className="tn-inline-form">
                        <div className="tn-form-group">
                            <label>Title</label>
                            <input
                                type="text"
                                value={inlineEditData.title}
                                onChange={(e) => setInlineEditData({ ...inlineEditData, title: e.target.value })}
                            />
                        </div>

                        <div className="tn-form-row">
                            <div className="tn-form-group">
                                <label>Type</label>
                                <select
                                    value={inlineEditData.type}
                                    onChange={(e) => setInlineEditData({ ...inlineEditData, type: e.target.value })}
                                >
                                    <option value="Functional">Functional</option>
                                    <option value="Negative">Negative</option>
                                    <option value="Edge Case">Edge Case</option>
                                    <option value="Security">Security</option>
                                    <option value="Validation">Validation</option>
                                    <option value="API">API</option>
                                </select>
                            </div>
                            <div className="tn-form-group">
                                <label>Priority</label>
                                <select
                                    value={inlineEditData.priority}
                                    onChange={(e) => setInlineEditData({ ...inlineEditData, priority: e.target.value })}
                                >
                                    <option value="Critical">Critical</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                            <div className="tn-form-group">
                                <label>Severity</label>
                                <select
                                    value={inlineEditData.severity}
                                    onChange={(e) => setInlineEditData({ ...inlineEditData, severity: e.target.value })}
                                >
                                    <option value="Critical">Critical</option>
                                    <option value="Major">Major</option>
                                    <option value="Minor">Minor</option>
                                    <option value="Trivial">Trivial</option>
                                </select>
                            </div>
                        </div>

                        <div className="tn-form-group">
                            <label>Preconditions</label>
                            <textarea
                                rows={2}
                                value={Array.isArray(inlineEditData.preconditions) ? inlineEditData.preconditions.join('\n') : inlineEditData.preconditions}
                                onChange={(e) => setInlineEditData({ ...inlineEditData, preconditions: e.target.value.split('\n') })}
                            />
                        </div>

                        <div className="tn-form-group">
                            <div className="tn-form-label-row">
                                <label>Test Steps</label>
                                <button
                                    type="button"
                                    className="tn-link-btn"
                                    onClick={() => setInlineEditData({
                                        ...inlineEditData,
                                        steps: [...inlineEditData.steps, { action: '', expected: '' }]
                                    })}
                                >
                                    + Add Step
                                </button>
                            </div>
                            <div className="tn-edit-steps-list">
                                {inlineEditData.steps.map((st, i) => (
                                    <div key={i} className="tn-edit-step-row">
                                        <span className="tn-step-idx">{i + 1}</span>
                                        <div className="tn-edit-step-inputs">
                                            <input
                                                type="text"
                                                placeholder="Action step..."
                                                value={st.action || st}
                                                onChange={(e) => {
                                                    const newSteps = [...inlineEditData.steps];
                                                    newSteps[i] = { ...st, action: e.target.value };
                                                    setInlineEditData({ ...inlineEditData, steps: newSteps });
                                                }}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Expected outcome..."
                                                value={st.expected || ''}
                                                onChange={(e) => {
                                                    const newSteps = [...inlineEditData.steps];
                                                    newSteps[i] = { ...st, expected: e.target.value };
                                                    setInlineEditData({ ...inlineEditData, steps: newSteps });
                                                }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="tn-delete-step-btn"
                                            onClick={() => {
                                                const newSteps = inlineEditData.steps.filter((_, idx) => idx !== i);
                                                setInlineEditData({ ...inlineEditData, steps: newSteps });
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="tn-form-group">
                            <label>Expected Result</label>
                            <textarea
                                rows={2}
                                value={inlineEditData.expectedResult}
                                onChange={(e) => setInlineEditData({ ...inlineEditData, expectedResult: e.target.value })}
                            />
                        </div>

                        <div className="tn-inline-edit-actions">
                            <button className="tn-app-btn tn-app-btn--secondary" onClick={handleCancelInlineEdit}>
                                Cancel
                            </button>
                            <button className="tn-app-btn tn-app-btn--primary" onClick={handleSaveInlineEdit}>
                                <Check size={14} />
                                <span>Save Changes</span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // Normal read-only detail view
        return (
            <div className="tn-detail-container">
                {/* 0. Integrated Compact Header / Navigation */}
                <div className="tn-detail-nav-header">
                    <button
                        type="button"
                        className="tn-detail-nav-back"
                        onClick={handleCloseDetail}
                        title="Close detail panel"
                    >
                        <ArrowLeft size={14} />
                        <span>Test Cases</span>
                    </button>

                    <div className="tn-detail-nav-controls">
                        <button
                            type="button"
                            className="tn-detail-nav-arrow"
                            disabled={selectedTcIndex <= 0}
                            onClick={handlePrevTc}
                            title="Previous test case"
                            aria-label="Previous test case"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="tn-detail-nav-pagination">
                            {selectedTcIndex >= 0 ? `${selectedTcIndex + 1} of ${filteredTests.length}` : ''}
                        </span>
                        <button
                            type="button"
                            className="tn-detail-nav-arrow"
                            disabled={selectedTcIndex >= filteredTests.length - 1}
                            onClick={handleNextTc}
                            title="Next test case"
                            aria-label="Next test case"
                        >
                            <ChevronRight size={14} />
                        </button>
                        <div className="tn-detail-nav-divider" />
                        <button
                            type="button"
                            className="tn-detail-nav-close"
                            onClick={handleCloseDetail}
                            title="Close detail panel (Esc)"
                            aria-label="Close detail panel"
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Main scrollable body container with consistent padding and spacing */}
                <div className="tn-detail-body">
                    {/* 1. Test Case ID & Review Status */}
                    <div className="tn-detail-id-bar">
                        <div className="tn-detail-id-left">
                            <span className="tn-tc-id-lg">{selectedTc.id}</span>
                            {selectedTc.reqId && (
                                <span className="tn-req-pill">
                                    <span className="tn-req-pill-dot" />
                                    {selectedTc.reqId}
                                </span>
                            )}
                        </div>
                        <div className="tn-detail-id-right">
                            <StatusBadge status={selectedTc.status} />
                            {showSavedFeedback && (
                                <span className="tn-saved-indicator">
                                    <Check size={12} /> Saved
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 2. Test Case Title */}
                    <div className="tn-detail-title-block">
                        <h3 className="tn-detail-title">{selectedTc.title}</h3>
                        {selectedTc.scenario && selectedTc.scenario !== selectedTc.title && (
                            <p className="tn-detail-scenario">{selectedTc.scenario}</p>
                        )}
                    </div>

                    {/* 3. Primary Actions: Approve, Edit, Regenerate */}
                    <div className="tn-detail-actions-bar">
                        <button
                            type="button"
                            className={`tn-app-btn tn-app-btn--sm ${selectedTc.status === 'Approved' ? 'tn-app-btn--secondary' : 'tn-app-btn--primary'}`}
                            onClick={() => handleApproveSingle(selectedTc.id)}
                            title="Toggle approval status"
                        >
                            <Check size={13} />
                            <span>{selectedTc.status === 'Approved' ? 'Revoke Approval' : 'Approve'}</span>
                        </button>
                        <button
                            type="button"
                            className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                            onClick={() => handleStartInlineEdit(selectedTc)}
                            title="Edit test case"
                        >
                            <Edit3 size={13} />
                            <span>Edit</span>
                        </button>
                        <button
                            type="button"
                            className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                            onClick={() => handleOpenRegenerateSingle(selectedTc)}
                            title="Regenerate single test"
                        >
                            <RefreshCw size={13} />
                            <span>Regenerate</span>
                        </button>
                        <div className="tn-detail-more-wrap" ref={detailMoreRef}>
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm tn-btn-icon-only"
                                onClick={() => setShowDetailMore(!showDetailMore)}
                                title="More actions"
                                aria-label="More actions"
                            >
                                <MoreHorizontal size={14} />
                            </button>
                            {showDetailMore && (
                                <div className="tn-detail-more-dropdown">
                                    <button type="button" onClick={() => { setShowGherkin(!showGherkin); setShowDetailMore(false); }}>
                                        <Code size={13} />
                                        <span>{showGherkin ? 'Hide BDD Spec' : 'BDD Specification'}</span>
                                    </button>
                                    <button type="button" onClick={() => { handleCopyDetails(selectedTc); setShowDetailMore(false); }}>
                                        <Copy size={13} />
                                        <span>{copiedDetails ? 'Copied!' : 'Copy as Markdown'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 4. Structured Metadata Grid */}
                    <div className="tn-detail-meta-grid">
                        <div className="tn-meta-item">
                            <span className="tn-meta-label">Type</span>
                            <div className="tn-meta-value">
                                <TypeBadge type={selectedTc.type} />
                            </div>
                        </div>
                        <div className="tn-meta-item">
                            <span className="tn-meta-label">Priority</span>
                            <div className="tn-meta-value">
                                <PriorityBadge priority={selectedTc.priority} />
                            </div>
                        </div>
                        <div className="tn-meta-item">
                            <span className="tn-meta-label">Severity</span>
                            <div className="tn-meta-value">
                                <span className={`tn-sev-tag tn-sev-tag--${(selectedTc.severity || 'Major').toLowerCase()}`}>
                                    {selectedTc.severity || 'Major'}
                                </span>
                            </div>
                        </div>
                        <div className="tn-meta-item">
                            <span className="tn-meta-label">Traceability</span>
                            <div className="tn-meta-value">
                                <span className="tn-req-pill">
                                    <span className="tn-req-pill-dot" />
                                    {selectedTc.reqId || 'REQ-001'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Gherkin View or Main Details Body */}
                    {showGherkin ? (
                        <div className="tn-gherkin-view">
                            <div className="tn-gherkin-header">
                                <span>Cucumber / Behave Gherkin Feature</span>
                            </div>
                            <pre className="tn-gherkin-code">
                                <code>{formatGherkin(selectedTc)}</code>
                            </pre>
                        </div>
                    ) : (
                        <div className="tn-detail-sections">
                            {/* 5. Preconditions */}
                            <div className="tn-detail-section">
                                <h5 className="tn-detail-section-title">Preconditions</h5>
                                <div className="tn-preconditions-box">
                                    {Array.isArray(selectedTc.preconditions) && selectedTc.preconditions.length > 0 ? (
                                        <ul className="tn-preconditions-list">
                                            {selectedTc.preconditions.map((p, idx) => (
                                                <li key={idx} className="tn-precondition-item">
                                                    <span className="tn-precondition-bullet">•</span>
                                                    <span className="tn-precondition-text">{p}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="tn-precon-text">
                                            {selectedTc.preconditions || 'Standard testing environment is initialized.'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* 6. Numbered Test Steps with Expected Results */}
                            <div className="tn-detail-section">
                                <h5 className="tn-detail-section-title">
                                    Test Steps ({selectedTc.steps?.length || 0})
                                </h5>
                                <div className="tn-detail-steps-flow">
                                    {Array.isArray(selectedTc.steps) && selectedTc.steps.length > 0 ? (
                                        selectedTc.steps.map((st, idx) => {
                                            const numStr = String(idx + 1).padStart(2, '0');
                                            const isObj = typeof st === 'object' && st !== null;
                                            const actionText = isObj ? (st.action || st.step) : st;
                                            const expectedText = isObj ? st.expected : null;

                                            return (
                                                <div key={idx} className="tn-step-card">
                                                    <div className="tn-step-badge-col">
                                                        <span className="tn-step-num">{numStr}</span>
                                                    </div>
                                                    <div className="tn-step-body">
                                                        <div className="tn-step-action-row">
                                                            <span className="tn-step-action-label">Action</span>
                                                            <p className="tn-step-action-text">{actionText}</p>
                                                        </div>
                                                        {expectedText && (
                                                            <div className="tn-step-expected-row">
                                                                <span className="tn-step-expected-label">Expected Result</span>
                                                                <p className="tn-step-expected-text">{expectedText}</p>
                                                            </div>
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

                            {/* 7. Overall Expected Result */}
                            <div className="tn-detail-section">
                                <h5 className="tn-detail-section-title">Expected Result</h5>
                                <div className="tn-expected-result-card">
                                    <CheckSquare size={16} className="tn-expected-icon" />
                                    <p className="tn-expected-text">
                                        {selectedTc.expectedResult || 'System behaves strictly as defined in requirement specification.'}
                                    </p>
                                </div>
                            </div>

                            {/* Additional info: Test Data */}
                            {selectedTc.testData && (
                                <div className="tn-detail-section">
                                    <h5 className="tn-detail-section-title">Test Data & Parameters</h5>
                                    <pre className="tn-code-block">{selectedTc.testData}</pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="tn-app-workspace">
            {/* ─── 1. Top Suite Header ─── */}
            <div className="tn-app-header">
                <div className="tn-app-header__identity">
                    <h2 className="tn-suite-title">{result.feature || result.testSuiteName || 'Password Reset Suite'}</h2>
                    <div className="tn-app-header__tags">
                        <span className="tn-tag tn-tag--req">REQ-001</span>
                        <span className={`tn-tag ${suiteStatus === 'Approved' ? 'tn-tag--ready' : 'tn-tag--alert'}`}>
                            <span className="tn-status-dot" /> {suiteStatus === 'Approved' ? 'Approved' : 'Needs Review'}
                        </span>
                    </div>
                </div>

                <div className="tn-app-header__actions">
                    <button
                        className="tn-app-btn tn-app-btn--secondary"
                        onClick={() => setShowShareModal(true)}
                        title="Share test suite"
                    >
                        <Share2 size={14} />
                        <span>Share</span>
                    </button>

                    <button
                        className="tn-app-btn tn-app-btn--secondary"
                        onClick={() => setShowExportModal(true)}
                        title="Export suite to CSV, JSON, Excel"
                    >
                        <Download size={14} />
                        <span>Export</span>
                    </button>

                    {/* Approve Suite CTA */}
                    {suiteStatus !== 'Approved' ? (
                        <button
                            className="tn-app-btn tn-app-btn--primary"
                            onClick={() => setShowApproveModal(true)}
                            title="Approve all test cases for execution"
                        >
                            <CheckCheck size={14} />
                            <span>Approve Suite</span>
                        </button>
                    ) : (
                        <span className="tn-app-approved-tag">
                            <Check size={14} /> Ready for Execution
                        </span>
                    )}
                </div>
            </div>

            {/* ─── 2. Compact Secondary Summary Metric Row ─── */}
            <div className="tn-app-summary-bar">
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num">{totalCount}</span>
                    <span className="tn-app-stat__label">Total Test Cases</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--cyan">{coverageConfidence}%</span>
                    <span className="tn-app-stat__label">Requirement Coverage</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--amber">{highPriorityCount}</span>
                    <span className="tn-app-stat__label">High Priority</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num">{edgeAndSecurityCount}</span>
                    <span className="tn-app-stat__label">Edge & Security</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--emerald">{approvedCount} / {totalCount}</span>
                    <span className="tn-app-stat__label">Approved Cases</span>
                </div>
            </div>

            {/* ─── 3. Suite-Level AI Insights Bar ─── */}
            <div className="tn-ai-insights-bar">
                <div className="tn-ai-insights-bar__left">
                    <span className="tn-ai-sparkle-pill"><Lightbulb size={12} /> INSIGHTS</span>
                    <div className="tn-ai-insights-content">
                        {uncoveredCount > 0 && (
                            <button
                                type="button"
                                className="tn-insight-link"
                                onClick={() => setActiveTab('coverage')}
                                title="View uncovered requirement gaps"
                            >
                                {uncoveredCount} coverage {uncoveredCount === 1 ? 'gap' : 'gaps'} detected &rarr;
                            </button>
                        )}
                        {uncoveredCount > 0 && securityWarningTc && (
                            <span className="tn-insight-sep">&bull;</span>
                        )}
                        {securityWarningTc && (
                            <button
                                type="button"
                                className="tn-insight-link"
                                onClick={() => {
                                    setSelectedTcId(securityWarningTc.id);
                                    setIsDetailOpen(true);
                                    setActiveTab('tests');
                                }}
                                title={`Navigate to ${securityWarningTc.id}`}
                            >
                                Security scenario ({securityWarningTc.id}) needs verification &rarr;
                            </button>
                        )}
                        {!uncoveredCount && !securityWarningTc && (
                            <span className="tn-ai-insights-text">All requirements verified &bull; Suite is consistent and ready for execution.</span>
                        )}
                    </div>
                </div>
                <button
                    className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                    onClick={() => setShowAiInsightsDrawer(true)}
                >
                    Review Details &rarr;
                </button>
            </div>

            {/* ─── 4. Application Navigation Tabs ─── */}
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
                    <span className="tn-app-tab__badge tn-app-tab__badge--alert">{uncoveredCount}</span>
                </button>
                <button
                    className={`tn-app-tab ${activeTab === 'traceability' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('traceability')}
                >
                    <GitBranch size={15} />
                    <span>Traceability</span>
                </button>
            </div>

            {/* ─── 5. Main Viewport Area ─── */}
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
                                        placeholder="Search test cases..."
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
                                    {['All', 'Functional', 'Negative', 'Edge Case', 'Security'].map((t) => (
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
                                        <option value="Critical">Critical</option>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>

                                <div className="tn-app-select-filter">
                                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                        <option value="All">All Statuses</option>
                                        <option value="Needs Review">Needs Review</option>
                                        <option value="Approved">Approved</option>
                                    </select>
                                </div>

                                <span className="tn-app-count-label">{filteredTests.length} of {totalCount} tests</span>
                            </div>
                        </div>

                        {/* Floating Bulk Actions Bar */}
                        {selectedRows.length > 0 && (
                            <div className="tn-bulk-floating animate-slide-up">
                                <span className="tn-bulk-count">
                                    <strong>{selectedRows.length}</strong> test cases selected
                                </span>
                                <div className="tn-bulk-actions">
                                    <button
                                        className="tn-app-btn tn-app-btn--primary tn-app-btn--sm"
                                        onClick={handleBulkApprove}
                                    >
                                        <Check size={13} />
                                        <span>Approve ({selectedRows.length})</span>
                                    </button>
                                    <div className="tn-app-select-filter tn-app-select-filter--compact">
                                        <select onChange={(e) => e.target.value && handleBulkPriority(e.target.value)} defaultValue="">
                                            <option value="" disabled>Change Priority...</option>
                                            <option value="Critical">Critical</option>
                                            <option value="High">High</option>
                                            <option value="Medium">Medium</option>
                                            <option value="Low">Low</option>
                                        </select>
                                    </div>
                                    <button
                                        className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                                        onClick={() => setShowExportModal(true)}
                                    >
                                        <Download size={13} />
                                        <span>Export Selected</span>
                                    </button>
                                    <button className="tn-bulk-close" onClick={() => setSelectedRows([])} title="Clear selection">
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Master-Detail Split Container */}
                        {filteredTests.length === 0 ? (
                            <div className="tn-empty-filter-state">
                                <Search size={28} className="text-slate-500" />
                                <h4>No test cases match your filters</h4>
                                <p>Try clearing search keywords or selecting "All" categories.</p>
                                <button
                                    className="tn-app-btn tn-app-btn--secondary"
                                    onClick={() => { setSearchQuery(''); setTypeFilter('All'); setPriorityFilter('All'); setStatusFilter('All'); }}
                                >
                                    Reset Filters
                                </button>
                            </div>
                        ) : (
                            <div className={`tn-app-split-workspace ${!isDetailOpen ? 'tn-split--detail-closed' : ''} ${mobileShowDetail ? 'tn-mobile-detail-active' : ''}`}>
                                {/* Left: Data Table */}
                                <div className="tn-app-table-pane">
                                    <table className="tn-qa-table">
                                        <thead>
                                            <tr>
                                                <th className="tn-th-select">
                                                    <input
                                                        type="checkbox"
                                                        checked={filteredTests.length > 0 && selectedRows.length === filteredTests.length}
                                                        onChange={toggleSelectAll}
                                                        aria-label="Select all tests"
                                                    />
                                                </th>
                                                <th className="tn-th-id">ID</th>
                                                <th className="tn-th-title">Test Scenario & Title</th>
                                                <th className="tn-th-type">Type</th>
                                                <th className="tn-th-priority">Priority</th>
                                                <th className="tn-th-status">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTests.map((tc) => {
                                                const isSelected = selectedTcId === tc.id;
                                                const isChecked = selectedRows.includes(tc.id);
                                                return (
                                                    <tr
                                                        key={tc.id}
                                                        className={`tn-qa-row ${isSelected && isDetailOpen ? 'is-selected' : ''}`}
                                                        onClick={() => {
                                                            setSelectedTcId(tc.id);
                                                            setIsDetailOpen(true);
                                                            setIsInlineEditing(false);
                                                            setShowGherkin(false);
                                                            // On mobile, drill into detail
                                                            if (window.innerWidth < 768) {
                                                                handleSelectTestMobile(tc.id);
                                                            }
                                                        }}
                                                    >
                                                        <td className="tn-td-select" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => toggleRowSelect(tc.id)}
                                                                aria-label={`Select ${tc.id}`}
                                                            />
                                                        </td>
                                                        <td className="tn-td-id">
                                                            <span className="tn-tc-id">{tc.id}</span>
                                                        </td>
                                                        <td className="tn-td-title">
                                                            <div className="tn-tc-title-cell">
                                                                <span className="tn-tc-title-main">{tc.title}</span>
                                                                <span className="tn-tc-title-sub">{tc.scenario || tc.testScenario || 'Specification Verification'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="tn-td-type">
                                                            <TypeBadge type={tc.type} />
                                                        </td>
                                                        <td className="tn-td-priority">
                                                            <PriorityBadge priority={tc.priority} />
                                                        </td>
                                                        <td className="tn-td-status">
                                                            <StatusBadge status={tc.status} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Right: Test Case Detail Panel */}
                                {isDetailOpen && (
                                    <div className={`tn-app-detail-pane ${mobileShowDetail ? 'tn-mobile-detail-visible' : ''}`}>
                                        {renderDetailPanelContent()}
                                    </div>
                                )}
                            </div>
                        )}
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
                            <span className="tn-coverage-overall-badge">94% Total Verified</span>
                        </div>

                        <div className="tn-coverage-list">
                            <div className="tn-coverage-row">
                                <div className="tn-coverage-row__meta">
                                    <span className="tn-tc-id">REQ-001</span>
                                    <strong>Password Reset Core Flow</strong>
                                    <span className="tn-coverage-count">{totalCount} Tests Covered</span>
                                </div>
                                <div className="tn-coverage-row__bar-wrap">
                                    <div className="tn-coverage-bar">
                                        <div className="tn-coverage-bar__fill" style={{ width: '94%' }} />
                                    </div>
                                    <span className="tn-coverage-pct">94%</span>
                                </div>
                            </div>
                        </div>

                        {/* Uncovered Gaps Callout */}
                        <div className="tn-uncovered-box">
                            <div className="tn-uncovered-header">
                                <AlertTriangle size={18} className="text-amber-400" />
                                <div>
                                    <h5>Uncovered Specification Areas (2)</h5>
                                    <p>Identified logic gaps where additional boundary assertions are recommended:</p>
                                </div>
                            </div>
                            <ul className="tn-uncovered-list">
                                <li>
                                    <strong>Rate Limiting:</strong> Repeated password reset requests from single IP or target account.
                                </li>
                                <li>
                                    <strong>Concurrent Redemptions:</strong> Dual redemption of identical token across race conditions.
                                </li>
                            </ul>
                            <button className="tn-app-btn tn-app-btn--primary tn-app-btn--sm" onClick={handleAddMissingTests}>
                                <Zap size={13} />
                                <span>Generate Missing Tests (2)</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── RISKS TAB ─── */}
                {activeTab === 'risks' && (
                    <div className="tn-app-risks-view">
                        <div className="tn-risks-header">
                            <div>
                                <h4>Security & Business Logic Risk Matrix</h4>
                                <p>Critical boundary gaps flagged for priority verification.</p>
                            </div>
                        </div>

                        <div className="tn-risks-grid">
                            <div className="tn-risk-card tn-risk-card--high">
                                <div className="tn-risk-card__top">
                                    <span className="tn-risk-badge tn-risk-badge--high">Critical Risk</span>
                                    <span className="tn-risk-cat">Security</span>
                                    <span className="tn-risk-linked" onClick={() => { setSelectedTcId('TC-014'); setActiveTab('tests'); }} style={{ cursor: 'pointer' }}>
                                        Linked: TC-014 &rarr;
                                    </span>
                                </div>
                                <h5>Expired Reset Token Handling</h5>
                                <p><strong>Why flagged:</strong> Tokens that remain active beyond their 15-minute TTL allow account takeover vectors.</p>
                                <p className="text-slate-400 text-xs"><strong>Recommended:</strong> Assert strict token invalidation upon timeout and database cleanup.</p>
                            </div>

                            <div className="tn-risk-card tn-risk-card--high">
                                <div className="tn-risk-card__top">
                                    <span className="tn-risk-badge tn-risk-badge--high">Critical Risk</span>
                                    <span className="tn-risk-cat">Security</span>
                                    <span className="tn-risk-linked" onClick={() => { setSelectedTcId('TC-006'); setActiveTab('tests'); }} style={{ cursor: 'pointer' }}>
                                        Linked: TC-006 &rarr;
                                    </span>
                                </div>
                                <h5>Token Replay / Nonce Reuse</h5>
                                <p><strong>Why flagged:</strong> Consumed tokens not burned in atomic transaction allow session replay attacks.</p>
                                <p className="text-slate-400 text-xs"><strong>Recommended:</strong> Enforce one-time cryptographic nonce invalidation.</p>
                            </div>

                            <div className="tn-risk-card tn-risk-card--medium">
                                <div className="tn-risk-card__top">
                                    <span className="tn-risk-badge tn-risk-badge--medium">Medium Risk</span>
                                    <span className="tn-risk-cat">Validation</span>
                                    <span className="tn-risk-linked" onClick={() => { setSelectedTcId('TC-009'); setActiveTab('tests'); }} style={{ cursor: 'pointer' }}>
                                        Linked: TC-009 &rarr;
                                    </span>
                                </div>
                                <h5>Invalid Email Format Exception Handling</h5>
                                <p><strong>Why flagged:</strong> Malformed email payloads may cause unhandled gateway 500 errors instead of clean 422 schema validation.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── TRACEABILITY TAB ─── */}
                {activeTab === 'traceability' && (
                    <div className="tn-app-trace-view">
                        <div className="tn-trace-header">
                            <h4>Requirement &rarr; Generated Test Tree</h4>
                            <p>End-to-end bi-directional traceability graph mapping every executable test scenario back to source specification clauses.</p>
                        </div>
                        <div className="tn-trace-tree">
                            <div className="tn-trace-root">
                                <div className="tn-trace-root__node">
                                    <span className="tn-tc-id">REQ-001</span>
                                    <strong>{result.feature || 'Password Reset Specification'}</strong>
                                    <span className="tn-trace-status">Source Requirement</span>
                                </div>
                                <div className="tn-trace-branches">
                                    {testCases.map((tc) => (
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
                                            <StatusBadge status={tc.status} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── 6. Context-Aware Floating QA Copilot ─── */}
            <QaCopilotDrawer
                isOpen={showAiCopilot}
                onClose={() => setShowAiCopilot(false)}
                onToggle={() => setShowAiCopilot(prev => !prev)}
                showFloatingTrigger={true}
                suite={result}
                testSuiteId={result?._id || result?.id || result?.sessionId || result?.testSuiteId}
                selectedTestCase={selectedTc}
                activeTab={activeTab}
                onAddTestCase={handleCopilotAddTestCase}
                onUpdateTestCase={handleCopilotUpdateTestCase}
                onSwitchTab={(tab) => setActiveTab(tab)}
            />

            {/* ─── 7. AI Insights Review Drawer ─── */}
            {showAiInsightsDrawer && (
                <div className="tn-ai-drawer animate-slide-left">
                    <div className="tn-ai-drawer__header">
                        <div className="tn-ai-drawer__title">
                            <Lightbulb size={18} className="text-teal-400" />
                            <strong>Suite Insights & Gaps</strong>
                        </div>
                        <button className="tn-btn-icon" onClick={() => setShowAiInsightsDrawer(false)}>
                            <X size={16} />
                        </button>
                    </div>

                    <div className="tn-ai-insights-content">
                        <div className="tn-insight-item">
                            <div className="tn-insight-badge">Coverage Gap</div>
                            <h5>Rate limiting is not covered</h5>
                            <p><strong>Why it matters:</strong> Repeated password reset requests allow abuse and brute-force email enumeration.</p>
                            <div className="tn-insight-actions">
                                <button className="tn-app-btn tn-app-btn--primary tn-app-btn--sm" onClick={handleAddMissingTests}>
                                    <Plus size={13} />
                                    <span>Generate Test</span>
                                </button>
                                <button className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm" onClick={() => setShowAiInsightsDrawer(false)}>
                                    Dismiss
                                </button>
                            </div>
                        </div>

                        <div className="tn-insight-item">
                            <div className="tn-insight-badge tn-insight-badge--sec">Security Gap</div>
                            <h5>Token reuse across race conditions</h5>
                            <p><strong>Why it matters:</strong> Concurrent requests before database write completion could redeem token twice.</p>
                            <div className="tn-insight-actions">
                                <button className="tn-app-btn tn-app-btn--primary tn-app-btn--sm" onClick={handleAddMissingTests}>
                                    <Plus size={13} />
                                    <span>Generate Test</span>
                                </button>
                                <button className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm" onClick={() => setShowAiInsightsDrawer(false)}>
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 8. Single Test Regenerate Modal ─── */}
            {showRegenModal && editingTc && (
                <div className="tn-modal-backdrop">
                    <div className="tn-modal tn-modal--sm animate-scale-in">
                        <div className="tn-modal__header">
                            <div>
                                <span className="tn-tc-id">{editingTc.id}</span>
                                <h3>Regenerate & Enhance Test</h3>
                            </div>
                            <button className="tn-btn-icon" onClick={() => setShowRegenModal(false)}><X size={18} /></button>
                        </div>

                        <div className="tn-modal__body">
                            <p className="tn-modal-desc">Select how to optimize <strong>{editingTc.id}</strong>:</p>
                            <div className="tn-radio-group">
                                {[
                                    'Improve scenario clarity and add boundary asserts',
                                    'Strengthen security attack vectors & payload checks',
                                    'Add edge cases around token TTL and network failures',
                                    'Regenerate completely'
                                ].map((opt) => (
                                    <label key={opt} className={`tn-radio-card ${regenGoal === opt ? 'is-selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="regenGoal"
                                            checked={regenGoal === opt}
                                            onChange={() => setRegenGoal(opt)}
                                        />
                                        <span>{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="tn-modal__footer">
                            <button className="tn-app-btn tn-app-btn--secondary" onClick={() => setShowRegenModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="tn-app-btn tn-app-btn--primary"
                                onClick={handleExecuteSingleRegen}
                                disabled={isRegeneratingSingle}
                            >
                                {isRegeneratingSingle ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                <span>{isRegeneratingSingle ? 'Optimizing Test...' : 'Regenerate'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 9. Approve Suite Modal ─── */}
            {showApproveModal && (
                <div className="tn-modal-backdrop">
                    <div className="tn-modal tn-modal--sm animate-scale-in">
                        <div className="tn-modal__header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCheck size={20} className="text-emerald-400" />
                                <h3>Approve Test Suite</h3>
                            </div>
                            <button className="tn-btn-icon" onClick={() => setShowApproveModal(false)}><X size={18} /></button>
                        </div>

                        <div className="tn-modal__body">
                            <p className="tn-modal-desc">
                                Approving this test suite will certify all <strong>{totalCount} test cases</strong> for production execution and CI/CD integration.
                            </p>
                            <div className="tn-approval-summary">
                                <div><span>Total Tests:</span> <strong>{totalCount}</strong></div>
                                <div><span>Requirement:</span> <strong>REQ-001</strong></div>
                                <div><span>Coverage:</span> <strong className="text-teal-400">{coverageConfidence}%</strong></div>
                            </div>
                        </div>

                        <div className="tn-modal__footer">
                            <button className="tn-app-btn tn-app-btn--secondary" onClick={() => setShowApproveModal(false)}>
                                Cancel
                            </button>
                            <button className="tn-app-btn tn-app-btn--primary" onClick={handleApproveSuite}>
                                <Check size={14} />
                                <span>Approve Suite</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 10. Export Modal ─── */}
            {showExportModal && (
                <div className="tn-modal-backdrop">
                    <div className="tn-modal tn-modal--sm animate-scale-in">
                        <div className="tn-modal__header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Download size={18} className="text-teal-400" />
                                <h3>Export Test Suite</h3>
                            </div>
                            <button className="tn-btn-icon" onClick={() => setShowExportModal(false)}><X size={18} /></button>
                        </div>

                        <div className="tn-modal__body">
                            <div className="tn-form-group">
                                <label>Export Format</label>
                                <div className="tn-format-pills">
                                    {['json', 'csv', 'excel', 'pdf'].map(fmt => (
                                        <button
                                            key={fmt}
                                            className={`tn-format-pill ${exportFormat === fmt ? 'is-active' : ''}`}
                                            onClick={() => setExportFormat(fmt)}
                                        >
                                            {fmt.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="tn-form-group">
                                <label>Included Metadata Fields</label>
                                <div className="tn-checkbox-list">
                                    <label className="tn-check-label">
                                        <input
                                            type="checkbox"
                                            checked={exportOptions.steps}
                                            onChange={(e) => setExportOptions({ ...exportOptions, steps: e.target.checked })}
                                        />
                                        <span>Test Steps (Action & Expected)</span>
                                    </label>
                                    <label className="tn-check-label">
                                        <input
                                            type="checkbox"
                                            checked={exportOptions.expected}
                                            onChange={(e) => setExportOptions({ ...exportOptions, expected: e.target.checked })}
                                        />
                                        <span>Expected Results</span>
                                    </label>
                                    <label className="tn-check-label">
                                        <input
                                            type="checkbox"
                                            checked={exportOptions.traceability}
                                            onChange={(e) => setExportOptions({ ...exportOptions, traceability: e.target.checked })}
                                        />
                                        <span>Requirement Traceability (REQ-001)</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="tn-modal__footer">
                            <button className="tn-app-btn tn-app-btn--secondary" onClick={() => setShowExportModal(false)}>
                                Cancel
                            </button>
                            <button className="tn-app-btn tn-app-btn--primary" onClick={handleExecuteExport}>
                                <Download size={14} />
                                <span>Download {exportFormat.toUpperCase()}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 11. Share Modal ─── */}
            {showShareModal && (
                <div className="tn-modal-backdrop">
                    <div className="tn-modal tn-modal--sm animate-scale-in">
                        <div className="tn-modal__header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Share2 size={18} className="text-teal-400" />
                                <h3>Share Test Suite</h3>
                            </div>
                            <button className="tn-btn-icon" onClick={() => setShowShareModal(false)}><X size={18} /></button>
                        </div>

                        <div className="tn-modal__body">
                            <div className="tn-form-group">
                                <label>Access Role</label>
                                <select value={shareRole} onChange={(e) => setShareRole(e.target.value)}>
                                    <option value="Viewer">Viewer (Read-only)</option>
                                    <option value="Reviewer">Reviewer (Approve / Comment)</option>
                                    <option value="Editor">Editor (Edit / Regenerate)</option>
                                </select>
                            </div>

                            <div className="tn-form-group">
                                <label>Shareable Workspace Link</label>
                                {(() => {
                                    const shareSlug = result?.id || (result?.feature ? result.feature.toLowerCase().replace(/\s+/g, '-') : 'password-reset');
                                    const shareUrl = typeof window !== 'undefined'
                                        ? `${window.location.origin}/app/test-suites/${shareSlug}?role=${shareRole.toLowerCase()}`
                                        : `/app/test-suites/${shareSlug}?role=${shareRole.toLowerCase()}`;
                                    return (
                                        <div className="tn-copy-input-wrap">
                                            <input
                                                type="text"
                                                readOnly
                                                value={shareUrl}
                                            />
                                            <button
                                                className="tn-app-btn tn-app-btn--primary tn-app-btn--sm"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(shareUrl);
                                                    setCopiedLink(true);
                                                    setTimeout(() => setCopiedLink(false), 2000);
                                                }}
                                            >
                                                {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                                                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 12. Refine & Regenerate Dock (Docked at bottom for live API) ─── */}
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
