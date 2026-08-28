import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
    HelpCircle
} from 'lucide-react';
import RefineRegeneratePanel from './RefineRegeneratePanel';

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

// ─── Helper to flatten test cases into initial state pool ───
const flattenAllTestCases = (result) => {
    if (!result) return [];
    const pool = [];
    const pushAll = (items = [], defaultType = 'Functional') => {
        if (!Array.isArray(items)) return;
        items.forEach((tc, idx) => {
            if (tc && typeof tc === 'object') {
                pool.push({
                    ...tc,
                    id: tc.id || `TC-${String(pool.length + 1).padStart(3, '0')}`,
                    type: tc.type || defaultType,
                    priority: tc.priority || 'Medium',
                    severity: tc.severity || (tc.priority === 'High' ? 'Critical' : 'Major'),
                    status: tc.status || 'Needs Review',
                    reqId: tc.requirementId || tc.reqId || 'REQ-001',
                    preconditions: Array.isArray(tc.preconditions) ? tc.preconditions : (tc.preconditions ? [String(tc.preconditions)] : ['User is authenticated in the testing environment.']),
                    steps: Array.isArray(tc.steps) && tc.steps.length > 0
                        ? tc.steps.map(st => typeof st === 'object' ? st : { action: String(st), expected: 'Verification criteria satisfied.' })
                        : [{ action: 'Execute test scenario according to specification constraints.', expected: 'Output satisfies acceptance rules.' }],
                    expectedResult: tc.expectedResult || 'System behaves strictly as defined in requirement specification.',
                    testData: tc.testData || 'method: "POST /api/v1/auth", payload: { standard: true }'
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
                    <Sparkles size={36} className="text-teal-400" />
                    <h3>No Test Suite Loaded</h3>
                    <p>Enter a requirement specification above to generate a production-ready test suite.</p>
                </div>
            </div>
        );
    }

    // ─── Interactive State ───
    const [testCases, setTestCases] = useState(() => flattenAllTestCases(result));
    const [suiteStatus, setSuiteStatus] = useState('Needs Review'); // 'Needs Review' | 'Approved' | 'Ready for Execution'
    const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'overview' | 'coverage' | 'risks' | 'traceability' | 'questions'
    const [selectedTcId, setSelectedTcId] = useState(() => testCases[0]?.id || 'TC-001');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedRows, setSelectedRows] = useState([]);
    const [showGherkin, setShowGherkin] = useState(false);

    // ─── Modals and Drawers ───
    const [showAiCopilot, setShowAiCopilot] = useState(false);
    const [showAiInsightsDrawer, setShowAiInsightsDrawer] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTc, setEditingTc] = useState(null);
    const [showRegenModal, setShowRegenModal] = useState(false);
    const [regenGoal, setRegenGoal] = useState('Add security attack vectors & payload checks');
    const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState('json'); // 'json' | 'csv' | 'excel' | 'pdf'
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

    // ─── AI Copilot Chat State ───
    const [chatInput, setChatInput] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [chatMessages, setChatMessages] = useState([
        {
            sender: 'assistant',
            text: `I'm Testnexa Copilot. I've analyzed **${result.feature || 'this test suite'}** (REQ-001). I can detect coverage gaps, suggest security boundary tests, inspect selected test cases, or generate Gherkin scenarios.`,
            suggestions: [
                'Are we missing any security scenarios?',
                'Is the selected test sufficient?',
                'Explain requirement coverage gaps',
                'Generate rate limiting tests'
            ]
        }
    ]);

    // Keep test cases synced if incoming result prop changes completely
    useEffect(() => {
        setTestCases(flattenAllTestCases(result));
        setSuiteStatus('Needs Review');
    }, [result]);

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
    const highPriorityCount = testCases.filter(tc => tc.priority === 'High' || tc.priority === 'Critical').length;
    const edgeCount = testCases.filter(tc => tc.type === 'Edge Case' || tc.type === 'Edge' || tc.type === 'Security').length;
    const approvedCount = testCases.filter(tc => tc.status === 'Approved').length;
    const coverageConfidence = result?.quality?.coverageConfidence || 94;

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

    // ─── Single Test Edit Handler ───
    const handleOpenEdit = (tc) => {
        setEditingTc(JSON.parse(JSON.stringify(tc)));
        setShowEditModal(true);
    };

    const handleSaveEdit = () => {
        if (!editingTc) return;
        setTestCases(prev => prev.map(tc => tc.id === editingTc.id ? editingTc : tc));
        setShowEditModal(false);
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

    // ─── AI Copilot Message Submission ───
    const handleSendChatMessage = (textToSend) => {
        const text = textToSend || chatInput;
        if (!text.trim()) return;

        const userMsg = { sender: 'user', text };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setIsAiThinking(true);

        setTimeout(() => {
            let replyText = '';
            let action = null;

            const lower = text.toLowerCase();
            if (lower.includes('security') || lower.includes('missing')) {
                replyText = `I analyzed the suite against OWASP ASVS v4.0. Currently, **TC-004** and **TC-005** cover token expiration and reuse, but **Rate Limiting (HTTP 429)** and **Timing-Attack Anti-Enumeration** are not covered.`;
                action = { label: 'Generate 2 Security Tests', type: 'add_missing' };
            } else if (lower.includes('sufficient') || lower.includes('tc-004') || lower.includes('selected')) {
                replyText = `**${selectedTc.id}: ${selectedTc.title}** covers the expiration TTL window correctly. However, I recommend adding an explicit check for concurrent redemption while token expiration evaluates.`;
                action = { label: 'Enhance Selected Test', type: 'enhance_selected' };
            } else if (lower.includes('coverage') || lower.includes('gap')) {
                replyText = `Requirement **REQ-001** has 94% coverage. 18 test cases are mapped. The remaining 6% gap is in distributed cache token invalidation and edge-network retries.`;
                action = { label: 'Generate Missing Edge Cases', type: 'add_missing' };
            } else {
                replyText = `I've audited the suite context for **${result.feature || 'REQ-001'}**. All ${testCases.length} test cases are structured with explicit preconditions and two-tier action/expected assertions.`;
            }

            setChatMessages(prev => [...prev, {
                sender: 'assistant',
                text: replyText,
                action
            }]);
            setIsAiThinking(false);
        }, 800);
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
                if (exportOptions.traceability) row.push(`"${tc.reqId || 'REQ-001'}"`);
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

    return (
        <div className="tn-app-workspace">
            {/* ─── 1. Top Suite Header ─── */}
            <div className="tn-app-header">
                <div className="tn-app-header__identity">
                    <div className="tn-app-header__breadcrumbs">
                        <span className="tn-app-crumb-root">Test Suite</span>
                        <ChevronRight size={14} className="tn-app-crumb-sep" />
                        <span className="tn-app-crumb-active">{result.feature || 'Password Reset Suite'}</span>
                    </div>
                    <div className="tn-app-header__tags">
                        <span className="tn-tag tn-tag--req">REQ-001</span>
                        <span className={`tn-tag ${suiteStatus === 'Approved' ? 'tn-tag--ready' : 'tn-tag--alert'}`}>
                            <span className="tn-status-dot" /> {suiteStatus === 'Approved' ? '✓ Approved' : 'Needs Review'}
                        </span>
                    </div>
                </div>

                <div className="tn-app-header__actions">
                    {/* Subtle Ask Testnexa AI Copilot Button */}
                    <button
                        className={`tn-app-btn ${showAiCopilot ? 'tn-app-btn--primary' : 'tn-app-btn--secondary'}`}
                        onClick={() => setShowAiCopilot(!showAiCopilot)}
                        title="Open context-aware AI QA copilot"
                    >
                        <Sparkles size={14} />
                        <span>Ask Testnexa</span>
                    </button>

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
                    <span className="tn-app-stat__num tn-app-stat__num--emerald">{approvedCount} / {totalCount}</span>
                    <span className="tn-app-stat__label">Approved</span>
                </div>
            </div>

            {/* ─── 3. Suite-Level AI Insights Bar ─── */}
            <div className="tn-ai-insights-bar">
                <div className="tn-ai-insights-bar__left">
                    <span className="tn-ai-sparkle-pill"><Sparkles size={12} /> AI INSIGHTS</span>
                    <p className="tn-ai-insights-text">
                        <strong>2 coverage gaps detected</strong> &bull; 1 security scenario (Rate Limiting) needs verification.
                    </p>
                </div>
                <button
                    className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                    onClick={() => setShowAiInsightsDrawer(true)}
                >
                    Review Insights &rarr;
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
                    <span className="tn-app-tab__badge tn-app-tab__badge--alert">2</span>
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
                                        placeholder="Search by ID, scenario, title, steps, requirement..."
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
                                    {['All', 'Functional', 'Negative', 'Validation', 'Edge Case', 'Security'].map((t) => (
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
                                                <th style={{ width: '110px' }}>Status</th>
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
                                                                <span>{tc.scenario || tc.testScenario || 'Specification Verification'}</span>
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

                                {/* Right: Test Case Detail Panel */}
                                <div className="tn-app-detail-pane">
                                    <div className="tn-detail-header">
                                        <div>
                                            <div className="tn-detail-meta-top">
                                                <span className="tn-tc-id-lg">{selectedTc.id}</span>
                                                <span className="tn-detail-req">{selectedTc.reqId || 'REQ-001'}</span>
                                                <StatusBadge status={selectedTc.status} />
                                            </div>
                                            <h4 className="tn-detail-title">{selectedTc.title}</h4>
                                        </div>
                                        <div className="tn-detail-quick-actions">
                                            <button
                                                className={`tn-app-btn tn-app-btn--sm ${selectedTc.status === 'Approved' ? 'tn-app-btn--secondary' : 'tn-app-btn--primary'}`}
                                                onClick={() => handleApproveSingle(selectedTc.id)}
                                                title="Toggle approval status"
                                            >
                                                <Check size={13} />
                                                <span>{selectedTc.status === 'Approved' ? 'Revoke' : 'Approve'}</span>
                                            </button>
                                            <button
                                                className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                                                onClick={() => handleOpenEdit(selectedTc)}
                                                title="Edit test case"
                                            >
                                                <Edit3 size={13} />
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                                                onClick={() => handleOpenRegenerateSingle(selectedTc)}
                                                title="Regenerate / enhance single test"
                                            >
                                                <RefreshCw size={13} />
                                                <span>Regenerate</span>
                                            </button>
                                            <button
                                                className={`tn-app-btn tn-app-btn--sm ${showGherkin ? 'tn-app-btn--primary' : 'tn-app-btn--secondary'}`}
                                                onClick={() => setShowGherkin(!showGherkin)}
                                                title="Toggle Gherkin / BDD specification"
                                            >
                                                <Code size={13} />
                                                <span>BDD</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Metadata Grid */}
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
                                            <span className="tn-badge-value">{selectedTc.severity || 'Critical'}</span>
                                        </div>
                                        <div>
                                            <label>TRACEABILITY</label>
                                            <span className="tn-badge-value text-teal-400">{selectedTc.reqId || 'REQ-001'}</span>
                                        </div>
                                    </div>

                                    {/* Gherkin View or Standard Detail Body */}
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
                                        <div className="tn-detail-body">
                                            <div className="tn-detail-section">
                                                <h5>PRECONDITIONS</h5>
                                                <p className="tn-precon-text">
                                                    {Array.isArray(selectedTc.preconditions) && selectedTc.preconditions.length > 0
                                                        ? selectedTc.preconditions.join(' • ')
                                                        : (selectedTc.preconditions || 'A previously generated reset token exists and has exceeded the 15-minute TTL window.')}
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
                                                    <p>{selectedTc.expectedResult || 'System rejects the expired token, keeps credentials secure and allows the user to request a new token.'}</p>
                                                </div>
                                            </div>

                                            {selectedTc.testData && (
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
                            <div className="tn-overview-card">
                                <h4>Test Suite Quality & Confidence</h4>
                                <div className="tn-overview-metric-row">
                                    <div className="tn-metric-box">
                                        <span className="tn-metric-label">Coverage Confidence</span>
                                        <strong className="text-teal-400">{coverageConfidence}%</strong>
                                    </div>
                                    <div className="tn-metric-box">
                                        <span className="tn-metric-label">Review Status</span>
                                        <strong className={suiteStatus === 'Approved' ? 'text-emerald-400' : 'text-amber-400'}>
                                            {suiteStatus}
                                        </strong>
                                    </div>
                                    <div className="tn-metric-box">
                                        <span className="tn-metric-label">Execution Readiness</span>
                                        <strong className="text-blue-400">100%</strong>
                                    </div>
                                </div>
                                <div className="tn-overview-dist">
                                    <span className="tn-dist-label">Test Type Breakdown</span>
                                    <div className="tn-dist-bar">
                                        <div className="tn-dist-seg tn-dist-seg--func" style={{ width: '45%' }} title="Functional" />
                                        <div className="tn-dist-seg tn-dist-seg--neg" style={{ width: '28%' }} title="Negative" />
                                        <div className="tn-dist-seg tn-dist-seg--edge" style={{ width: '17%' }} title="Edge Cases" />
                                        <div className="tn-dist-seg tn-dist-seg--api" style={{ width: '10%' }} title="Security" />
                                    </div>
                                    <div className="tn-dist-legend">
                                        <span><i className="bg-teal-400" /> Functional (8)</span>
                                        <span><i className="bg-rose-400" /> Negative (5)</span>
                                        <span><i className="bg-amber-400" /> Edge Cases (3)</span>
                                        <span><i className="bg-blue-400" /> Security (2)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="tn-overview-card">
                                <h4>Inferred System Assumptions</h4>
                                <div className="tn-assumptions-list">
                                    <div className="tn-assumption-item">
                                        <Info size={14} className="text-teal-400 shrink-0" />
                                        <p>Reset tokens are cryptographically single-use with a default 15-minute TTL window.</p>
                                    </div>
                                    <div className="tn-assumption-item">
                                        <Info size={14} className="text-teal-400 shrink-0" />
                                        <p>API responses for non-existent emails return generic 200 OK to prevent user enumeration.</p>
                                    </div>
                                    <div className="tn-assumption-item">
                                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                        <p>All core specifications and authentication pathways mapped cleanly.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Critical Path Scenarios Table */}
                        <div className="tn-overview-table-card">
                            <div className="tn-overview-card-header">
                                <h4>High-Priority Critical Path Tests</h4>
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
                                        <th style={{ width: '100px' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {testCases.slice(0, 5).map(tc => (
                                        <tr key={tc.id} className="tn-qa-row" onClick={() => { setSelectedTcId(tc.id); setActiveTab('tests'); }}>
                                            <td><span className="tn-tc-id">{tc.id}</span></td>
                                            <td>
                                                <div className="tn-tc-title-cell">
                                                    <strong>{tc.title}</strong>
                                                    <span>{tc.scenario || tc.testScenario}</span>
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
                            <span className="tn-coverage-overall-badge">94% Total Verified</span>
                        </div>

                        <div className="tn-coverage-list">
                            <div className="tn-coverage-row">
                                <div className="tn-coverage-row__meta">
                                    <span className="tn-tc-id">REQ-001</span>
                                    <strong>Password Reset Core Flow</strong>
                                    <span className="tn-coverage-count">18 Tests Covered</span>
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
                                <Sparkles size={13} />
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
                                <p>Critical boundary gaps flagged by AI requirement intelligence for priority verification.</p>
                            </div>
                        </div>

                        <div className="tn-risks-grid">
                            <div className="tn-risk-card tn-risk-card--high">
                                <div className="tn-risk-card__top">
                                    <span className="tn-risk-badge tn-risk-badge--high">Critical Risk</span>
                                    <span className="tn-risk-cat">Security</span>
                                    <span className="tn-risk-linked" onClick={() => { setSelectedTcId('TC-004'); setActiveTab('tests'); }} style={{ cursor: 'pointer' }}>
                                        Linked: TC-004 &rarr;
                                    </span>
                                </div>
                                <h5>Expired Reset Token Handling</h5>
                                <p><strong>Why AI flagged this:</strong> Tokens that remain active beyond their 15-minute TTL allow account takeover vectors.</p>
                                <p className="text-slate-400 text-xs"><strong>Recommended:</strong> Assert strict token invalidation upon timeout and database cleanup.</p>
                            </div>

                            <div className="tn-risk-card tn-risk-card--high">
                                <div className="tn-risk-card__top">
                                    <span className="tn-risk-badge tn-risk-badge--high">Critical Risk</span>
                                    <span className="tn-risk-cat">Security</span>
                                    <span className="tn-risk-linked" onClick={() => { setSelectedTcId('TC-005'); setActiveTab('tests'); }} style={{ cursor: 'pointer' }}>
                                        Linked: TC-005 &rarr;
                                    </span>
                                </div>
                                <h5>Token Replay / Nonce Reuse</h5>
                                <p><strong>Why AI flagged this:</strong> Consumed tokens not burned in atomic transaction allow session replay attacks.</p>
                                <p className="text-slate-400 text-xs"><strong>Recommended:</strong> Enforce one-time cryptographic nonce invalidation.</p>
                            </div>

                            <div className="tn-risk-card tn-risk-card--medium">
                                <div className="tn-risk-card__top">
                                    <span className="tn-risk-badge tn-risk-badge--medium">Medium Risk</span>
                                    <span className="tn-risk-cat">Validation</span>
                                    <span className="tn-risk-linked" onClick={() => { setSelectedTcId('TC-002'); setActiveTab('tests'); }} style={{ cursor: 'pointer' }}>
                                        Linked: TC-002 &rarr;
                                    </span>
                                </div>
                                <h5>Invalid Email Format Exception Handling</h5>
                                <p><strong>Why AI flagged this:</strong> Malformed email payloads may cause unhandled gateway 500 errors instead of clean 422 schema validation.</p>
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

            {/* ─── 6. Context-Aware "Ask Testnexa" Right-Side Drawer ─── */}
            {showAiCopilot && (
                <div className="tn-ai-drawer animate-slide-left">
                    <div className="tn-ai-drawer__header">
                        <div className="tn-ai-drawer__title">
                            <Bot size={18} className="text-teal-400" />
                            <strong>Ask Testnexa Copilot</strong>
                        </div>
                        <button className="tn-btn-icon" onClick={() => setShowAiCopilot(false)} title="Close Copilot">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="tn-ai-drawer__context-pill">
                        <span className="tn-context-dot" />
                        <span>Context: <strong>{selectedTc.id || 'REQ-001'}</strong> ({selectedTc.title?.slice(0, 32)}...)</span>
                    </div>

                    <div className="tn-ai-drawer__messages">
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`tn-chat-msg tn-chat-msg--${msg.sender}`}>
                                <div className="tn-chat-avatar">
                                    {msg.sender === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                                </div>
                                <div className="tn-chat-bubble">
                                    <p>{msg.text}</p>
                                    {msg.suggestions && (
                                        <div className="tn-chat-suggestions">
                                            {msg.suggestions.map((sug, idx) => (
                                                <button
                                                    key={idx}
                                                    className="tn-suggestion-chip"
                                                    onClick={() => handleSendChatMessage(sug)}
                                                >
                                                    {sug} &rarr;
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {msg.action && (
                                        <div className="tn-chat-action-wrap">
                                            <button
                                                className="tn-app-btn tn-app-btn--primary tn-app-btn--sm"
                                                onClick={handleAddMissingTests}
                                            >
                                                <Sparkles size={13} />
                                                <span>{msg.action.label}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isAiThinking && (
                            <div className="tn-chat-msg tn-chat-msg--assistant">
                                <div className="tn-chat-avatar"><Bot size={14} /></div>
                                <div className="tn-chat-bubble tn-chat-thinking">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Analyzing test suite context...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="tn-ai-drawer__input-wrap">
                        <input
                            type="text"
                            placeholder="Ask about coverage, security gaps, or selected test..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                        />
                        <button
                            className="tn-chat-send-btn"
                            onClick={() => handleSendChatMessage()}
                            disabled={!chatInput.trim()}
                        >
                            <Send size={15} />
                        </button>
                    </div>
                </div>
            )}

            {/* ─── 7. AI Insights Review Drawer ─── */}
            {showAiInsightsDrawer && (
                <div className="tn-ai-drawer animate-slide-left">
                    <div className="tn-ai-drawer__header">
                        <div className="tn-ai-drawer__title">
                            <Sparkles size={18} className="text-teal-400" />
                            <strong>AI Suite Insights & Gaps</strong>
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

            {/* ─── 8. Edit Test Case Modal ─── */}
            {showEditModal && editingTc && (
                <div className="tn-modal-backdrop">
                    <div className="tn-modal tn-modal--edit animate-scale-in">
                        <div className="tn-modal__header">
                            <div>
                                <span className="tn-tc-id">{editingTc.id}</span>
                                <h3>Edit Test Case</h3>
                            </div>
                            <button className="tn-btn-icon" onClick={() => setShowEditModal(false)}><X size={18} /></button>
                        </div>

                        <div className="tn-modal__body">
                            <div className="tn-form-group">
                                <label>Title / Scenario</label>
                                <input
                                    type="text"
                                    value={editingTc.title}
                                    onChange={(e) => setEditingTc({ ...editingTc, title: e.target.value })}
                                />
                            </div>

                            <div className="tn-form-row">
                                <div className="tn-form-group">
                                    <label>Type</label>
                                    <select
                                        value={editingTc.type}
                                        onChange={(e) => setEditingTc({ ...editingTc, type: e.target.value })}
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
                                        value={editingTc.priority}
                                        onChange={(e) => setEditingTc({ ...editingTc, priority: e.target.value })}
                                    >
                                        <option value="Critical">Critical</option>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                                <div className="tn-form-group">
                                    <label>Status</label>
                                    <select
                                        value={editingTc.status}
                                        onChange={(e) => setEditingTc({ ...editingTc, status: e.target.value })}
                                    >
                                        <option value="Needs Review">Needs Review</option>
                                        <option value="Approved">Approved</option>
                                    </select>
                                </div>
                            </div>

                            <div className="tn-form-group">
                                <label>Preconditions</label>
                                <textarea
                                    rows={2}
                                    value={Array.isArray(editingTc.preconditions) ? editingTc.preconditions.join('\n') : editingTc.preconditions}
                                    onChange={(e) => setEditingTc({ ...editingTc, preconditions: e.target.value.split('\n') })}
                                />
                            </div>

                            <div className="tn-form-group">
                                <div className="tn-form-label-row">
                                    <label>Test Steps</label>
                                    <button
                                        type="button"
                                        className="tn-link-btn"
                                        onClick={() => setEditingTc({
                                            ...editingTc,
                                            steps: [...editingTc.steps, { action: '', expected: '' }]
                                        })}
                                    >
                                        + Add Step
                                    </button>
                                </div>
                                <div className="tn-edit-steps-list">
                                    {editingTc.steps.map((st, i) => (
                                        <div key={i} className="tn-edit-step-row">
                                            <span className="tn-step-idx">{i + 1}</span>
                                            <div className="tn-edit-step-inputs">
                                                <input
                                                    type="text"
                                                    placeholder="Action step..."
                                                    value={st.action || st}
                                                    onChange={(e) => {
                                                        const newSteps = [...editingTc.steps];
                                                        newSteps[i] = { ...st, action: e.target.value };
                                                        setEditingTc({ ...editingTc, steps: newSteps });
                                                    }}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Expected outcome..."
                                                    value={st.expected || ''}
                                                    onChange={(e) => {
                                                        const newSteps = [...editingTc.steps];
                                                        newSteps[i] = { ...st, expected: e.target.value };
                                                        setEditingTc({ ...editingTc, steps: newSteps });
                                                    }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="tn-delete-step-btn"
                                                onClick={() => {
                                                    const newSteps = editingTc.steps.filter((_, idx) => idx !== i);
                                                    setEditingTc({ ...editingTc, steps: newSteps });
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
                                    value={editingTc.expectedResult}
                                    onChange={(e) => setEditingTc({ ...editingTc, expectedResult: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="tn-modal__footer">
                            <button className="tn-app-btn tn-app-btn--secondary" onClick={() => setShowEditModal(false)}>
                                Cancel
                            </button>
                            <button className="tn-app-btn tn-app-btn--primary" onClick={handleSaveEdit}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 9. Single Test Regenerate Modal ─── */}
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
                            <p className="tn-modal-desc">Select how AI should optimize <strong>{editingTc.id}</strong>:</p>
                            <div className="tn-radio-group">
                                {[
                                    'Improve scenario clarity and add boundary asserts',
                                    'Increase security attack vectors & payload checks',
                                    'Add edge cases around token TTL and network failures',
                                    'Rewrite in strict Gherkin BDD format'
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
                                {isRegeneratingSingle ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                <span>{isRegeneratingSingle ? 'Optimizing Test...' : 'Regenerate'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 10. Approve Suite Modal ─── */}
            {showApproveModal && (
                <div className="tn-modal-backdrop">
                    <div className="tn-modal tn-modal--sm animate-scale-in">
                        <div className="tn-modal__header">
                            <div className="flex items-center gap-2">
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

            {/* ─── 11. Export Modal ─── */}
            {showExportModal && (
                <div className="tn-modal-backdrop">
                    <div className="tn-modal tn-modal--sm animate-scale-in">
                        <div className="tn-modal__header">
                            <div className="flex items-center gap-2">
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

            {/* ─── 12. Share Modal ─── */}
            {showShareModal && (
                <div className="tn-modal-backdrop">
                    <div className="tn-modal tn-modal--sm animate-scale-in">
                        <div className="tn-modal__header">
                            <div className="flex items-center gap-2">
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
                                <div className="tn-copy-input-wrap">
                                    <input
                                        type="text"
                                        readOnly
                                        value={`https://app.testnexa.ai/suites/pwd-reset-req-001?role=${shareRole.toLowerCase()}`}
                                    />
                                    <button
                                        className="tn-app-btn tn-app-btn--primary tn-app-btn--sm"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`https://app.testnexa.ai/suites/pwd-reset-req-001?role=${shareRole.toLowerCase()}`);
                                            setCopiedLink(true);
                                            setTimeout(() => setCopiedLink(false), 2000);
                                        }}
                                    >
                                        {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                                        <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 13. Refine & Regenerate Dock (Docked at bottom for live API) ─── */}
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
