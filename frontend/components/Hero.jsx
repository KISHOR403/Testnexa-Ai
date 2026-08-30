import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    Search,
    Download,
    Share2,
    RefreshCw,
    CheckSquare,
    AlertTriangle,
    Shield,
    GitBranch,
    FileText,
    Copy,
    ExternalLink,
    Filter,
    Check,
    Lock,
    Clock,
    Terminal,
    ChevronRight,
    Layers,
    ListFilter,
    Sparkles,
    CheckCheck,
    Code,
    Edit3,
    Plus,
    Trash2,
    Send,
    Bot,
    User,
    X,
    XCircle,
    Info,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

// Realistic QA Test Suite Demo Data
const INITIAL_DEMO_TESTS = [
    {
        id: 'TC-001',
        title: 'Reset password with valid registered email',
        scenario: 'Verify standard password recovery email dispatch',
        type: 'Functional',
        priority: 'High',
        severity: 'Critical',
        status: 'Needs Review',
        reqId: 'REQ-001',
        preconditions: 'User account exists with verified email address (active in DB).',
        steps: [
            { num: '01', action: 'Navigate to /forgot-password and input valid registered email.', expected: 'Input accepted; Submit button enabled.' },
            { num: '02', action: 'Click "Send Reset Instructions".', expected: 'HTTP 200 returned; generic success confirmation shown; reset token generated.' },
            { num: '03', action: 'Inspect email dispatch queue for generated token URL.', expected: 'Email received within 10s containing one-time cryptographically secure link.' }
        ],
        expectedResult: 'System sends single-use reset link and displays standard confirmation without disclosing user existence.',
        testData: 'email: "alex.qa@company.internal", method: "POST /api/auth/forgot-password"'
    },
    {
        id: 'TC-002',
        title: 'Reset password with invalid email format',
        scenario: 'Validate client & server RFC 5322 compliance',
        type: 'Negative',
        priority: 'High',
        severity: 'Major',
        status: 'Needs Review',
        reqId: 'REQ-001',
        preconditions: 'Password recovery form is accessible in browser.',
        steps: [
            { num: '01', action: 'Input malformed email strings: "user@", "user@.com", "user@domain..com".', expected: 'Inline client validation blocks submission with "Enter a valid email address".' },
            { num: '02', action: 'Attempt direct API POST with invalid email body.', expected: 'HTTP 422 Unprocessable Entity returned with structured validation schema error.' }
        ],
        expectedResult: 'System rejects malformed email strings at both client UI and API gateway with clear error feedback.',
        testData: 'payload: { email: "malformed@invalid..com" }'
    },
    {
        id: 'TC-003',
        title: 'Submit empty or whitespace email payload',
        scenario: 'Ensure required field constraints are strictly enforced',
        type: 'Validation',
        priority: 'Medium',
        severity: 'Minor',
        status: 'Needs Review',
        reqId: 'REQ-001',
        preconditions: 'User on forgot-password page.',
        steps: [
            { num: '01', action: 'Leave email input completely empty and click Submit.', expected: 'Submit button prevented or validation error "Email is required" displayed.' },
            { num: '02', action: 'Input 5 whitespace characters "     " and click Submit.', expected: 'Input trimmed; validation error "Email is required" displayed.' }
        ],
        expectedResult: 'Form enforces non-empty trimmed email constraint and prevents empty API request dispatch.',
        testData: 'input: "     "'
    },
    {
        id: 'TC-004',
        title: 'Use expired reset link beyond TTL',
        scenario: 'Verify token expiration window strictly blocks credential update',
        type: 'Edge Case',
        priority: 'High',
        severity: 'Critical',
        status: 'Needs Review',
        reqId: 'REQ-001',
        preconditions: 'A previously generated reset token exists and has exceeded the 15-minute TTL window.',
        steps: [
            { num: '01', action: 'Open password reset URL with expired token parameter.', expected: 'Token validation triggered during page mount.' },
            { num: '02', action: 'Submit new compliant password in input fields.', expected: 'HTTP 400 Bad Request returned with error code "TOKEN_EXPIRED".' }
        ],
        expectedResult: 'System gracefully rejects expired token, leaves original credentials intact, and offers link to request a fresh token.',
        testData: 'token: "exp_tok_982734", expiresAt: "2026-08-28T10:00:00Z"'
    },
    {
        id: 'TC-005',
        title: 'Reuse previously consumed reset token',
        scenario: 'Prevent replay attacks by enforcing one-time nonce invalidation',
        type: 'Security',
        priority: 'High',
        severity: 'Critical',
        status: 'Needs Review',
        reqId: 'REQ-001',
        preconditions: 'Reset token was already successfully redeemed in a prior session.',
        steps: [
            { num: '01', action: 'Attempt to reuse consumed token to submit a second password update.', expected: 'Database checks nonce state; finds token marked as USED.' },
            { num: '02', action: 'Inspect security audit log.', expected: 'Security alert logged for duplicate token redemption attempt; request terminated.' }
        ],
        expectedResult: 'Single-use cryptographic nonce cannot be reused under any circumstance, preventing token replay attacks.',
        testData: 'token: "consumed_tok_33421", status: "REDEEMED"'
    }
];

const COVERAGE_ITEMS = [
    { req: 'REQ-001', label: 'Password Reset Core Flow', coverage: 94, tests: 8, status: 'Optimal' },
    { req: 'REQ-002', label: 'Email Format & Domain Validation', coverage: 88, tests: 5, status: 'Good' },
    { req: 'REQ-003', label: 'Token Expiration & Invalidation', coverage: 100, tests: 4, status: 'Complete' },
    { req: 'REQ-004', label: 'Rate Limiting & Anti-Enumeration', coverage: 92, tests: 3, status: 'Optimal' }
];

const RISK_ITEMS = [
    { level: 'Critical', title: 'Expired Token Invalidation Gap', category: 'Security', linkedTc: 'TC-004', desc: 'Failure to enforce server-side expiration allows indefinite password reset window.' },
    { level: 'Critical', title: 'Token Replay / Nonce Reuse', category: 'Security', linkedTc: 'TC-005', desc: 'Tokens not invalidated immediately after first successful consumption expose replay vulnerability.' },
    { level: 'Medium', title: 'Email Address Enumeration Timing', category: 'Privacy', linkedTc: 'TC-001', desc: 'Different response times for existing vs non-existing emails expose user directory.' }
];

const TRACE_ITEMS = [
    {
        reqId: 'REQ-001',
        title: 'User Password Recovery',
        children: ['TC-001: Valid email dispatch', 'TC-002: Malformed email rejection', 'TC-003: Empty input validation', 'TC-004: Expired link handling', 'TC-005: Replay token rejection']
    }
];

// Helper to format Gherkin
const formatGherkinDemo = (tc) => {
    if (!tc) return '';
    return `@${tc.type.toLowerCase().replace(/\s+/g, '_')} @${tc.priority.toLowerCase()}
Scenario: ${tc.title}
    Given ${tc.preconditions}
    When ${tc.steps[0]?.action || 'the scenario triggers'}
    Then ${tc.steps[0]?.expected || 'verification passes'}
    ${tc.steps[1] ? `And ${tc.steps[1].action}\n    Then ${tc.steps[1].expected}` : ''}
    Then ${tc.expectedResult}`;
};

export const ProductWorkbench = ({ compact = false }) => {
    const [testCases, setTestCases] = useState(INITIAL_DEMO_TESTS);
    const [suiteStatus, setSuiteStatus] = useState('Needs Review'); // 'Needs Review' | 'Approved'
    const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'coverage' | 'risks' | 'traceability'
    const [selectedTcId, setSelectedTcId] = useState('TC-004');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedRows, setSelectedRows] = useState(['TC-001', 'TC-002', 'TC-003', 'TC-004', 'TC-005']);
    const [showGherkin, setShowGherkin] = useState(false);

    // Modals and Drawers
    const [showAiCopilot, setShowAiCopilot] = useState(false);
    const [showAiInsightsDrawer, setShowAiInsightsDrawer] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTc, setEditingTc] = useState(null);
    const [showRegenModal, setShowRegenModal] = useState(false);
    const [regenGoal, setRegenGoal] = useState('Add security attack vectors & payload checks');
    const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState('json');
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareRole, setShareRole] = useState('Reviewer');
    const [copiedLink, setCopiedLink] = useState(false);

    // AI Copilot Chat State
    const [chatInput, setChatInput] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [chatMessages, setChatMessages] = useState([
        {
            sender: 'assistant',
            text: `I'm Testnexa Copilot. I've audited the Password Reset suite (REQ-001). I can detect coverage gaps, suggest security boundary tests, inspect selected test cases, or generate Gherkin scenarios.`,
            suggestions: [
                'Are we missing any security scenarios?',
                'Is the selected test sufficient?',
                'Explain requirement coverage gaps',
                'Generate rate limiting tests'
            ]
        }
    ]);

    const selectedTc = useMemo(() => {
        return testCases.find(tc => tc.id === selectedTcId) || testCases[0];
    }, [testCases, selectedTcId]);

    const filteredTests = useMemo(() => {
        return testCases.filter(tc => {
            const matchesSearch = tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tc.scenario.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === 'All' || tc.type === typeFilter;
            const matchesPriority = priorityFilter === 'All' || tc.priority === priorityFilter;
            const matchesStatus = statusFilter === 'All' ||
                (statusFilter === 'Approved' && tc.status === 'Approved') ||
                (statusFilter === 'Needs Review' && tc.status === 'Needs Review');
            return matchesSearch && matchesType && matchesPriority && matchesStatus;
        });
    }, [testCases, searchQuery, typeFilter, priorityFilter, statusFilter]);

    const toggleRowSelect = (id) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    };

    // Bulk Actions
    const handleBulkApprove = () => {
        setTestCases(prev => prev.map(tc => selectedRows.includes(tc.id) ? { ...tc, status: 'Approved' } : tc));
        setSelectedRows([]);
    };

    const handleBulkPriority = (newPriority) => {
        setTestCases(prev => prev.map(tc => selectedRows.includes(tc.id) ? { ...tc, priority: newPriority } : tc));
        setSelectedRows([]);
    };

    // Single Test Handlers
    const handleApproveSingle = (id) => {
        setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, status: tc.status === 'Approved' ? 'Needs Review' : 'Approved' } : tc));
    };

    const handleApproveSuite = () => {
        setTestCases(prev => prev.map(tc => ({ ...tc, status: 'Approved' })));
        setSuiteStatus('Approved');
        setShowApproveModal(false);
    };

    const handleOpenEdit = (tc) => {
        setEditingTc(JSON.parse(JSON.stringify(tc)));
        setShowEditModal(true);
    };

    const handleSaveEdit = () => {
        if (!editingTc) return;
        setTestCases(prev => prev.map(tc => tc.id === editingTc.id ? editingTc : tc));
        setShowEditModal(false);
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
                            { num: String(tc.steps.length + 1).padStart(2, '0'), action: `Verify security boundary assertion for ${regenGoal.toLowerCase()}.`, expected: 'Payload blocked with structured telemetry log.' }
                        ]
                    };
                }
                return tc;
            }));
            setIsRegeneratingSingle(false);
            setShowRegenModal(false);
        }, 1000);
    };

    const handleAddMissingTests = () => {
        const newTests = [
            {
                id: `TC-006`,
                title: 'Enforce rate limiting on repeated reset dispatches',
                scenario: 'Block brute-force mail server flooding via 5+ requests in 60s',
                type: 'Security',
                priority: 'High',
                severity: 'Critical',
                status: 'Needs Review',
                reqId: 'REQ-001',
                preconditions: 'User or automated client on /forgot-password endpoint.',
                steps: [
                    { num: '01', action: 'Submit 5 consecutive password reset requests within 30 seconds.', expected: 'First 3 requests process normally; 4th and 5th return HTTP 429 Too Many Requests.' },
                    { num: '02', action: 'Inspect retry-after header.', expected: 'Header contains "Retry-After: 60" cooldown window.' }
                ],
                expectedResult: 'API gateway throttles excessive reset requests and logs anomaly event.',
                testData: 'rateLimit: "3 req/min", clientIP: "198.51.100.42"'
            }
        ];

        setTestCases(prev => [...prev, ...newTests]);
        setSelectedTcId('TC-006');
        setActiveTab('tests');
        setShowAiInsightsDrawer(false);
    };

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
                action = { label: 'Generate Rate Limiting Test', type: 'add_missing' };
            } else if (lower.includes('sufficient') || lower.includes('tc-004') || lower.includes('selected')) {
                replyText = `**${selectedTc.id}: ${selectedTc.title}** covers the expiration TTL window correctly. However, I recommend adding an explicit check for concurrent redemption while token expiration evaluates.`;
            } else {
                replyText = `Requirement **REQ-001** has 94% coverage. 18 test cases are mapped. The remaining 6% gap is in distributed cache token invalidation.`;
            }

            setChatMessages(prev => [...prev, {
                sender: 'assistant',
                text: replyText,
                action
            }]);
            setIsAiThinking(false);
        }, 700);
    };

    const handleExport = () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(testCases, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute('href', dataStr);
        anchor.setAttribute('download', `TestSuite_REQ-001.${exportFormat}`);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setShowExportModal(false);
    };

    return (
        <div className={`tn-app-workspace ${compact ? 'tn-app-workspace--compact' : ''}`}>
            {/* ─── 1. Product Workspace Header ─── */}
            <div className="tn-app-header">
                <div className="tn-app-header__identity">
                    <div className="tn-app-header__breadcrumbs">
                        <span className="tn-app-crumb-root">Test Suite</span>
                        <ChevronRight size={14} className="tn-app-crumb-sep" />
                        <span className="tn-app-crumb-active">Password Reset Suite</span>
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
                        title="Export suite"
                    >
                        <Download size={14} />
                        <span>Export</span>
                    </button>

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

            {/* ─── 2. Compact Summary Metrics Row ─── */}
            <div className="tn-app-summary-bar">
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num">{testCases.length}</span>
                    <span className="tn-app-stat__label">Test Cases</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--cyan">94%</span>
                    <span className="tn-app-stat__label">Req Coverage</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--amber">6</span>
                    <span className="tn-app-stat__label">High Priority</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num">4</span>
                    <span className="tn-app-stat__label">Edge Cases</span>
                </div>
                <div className="tn-app-stat-divider" />
                <div className="tn-app-stat">
                    <span className="tn-app-stat__num tn-app-stat__num--emerald">
                        {testCases.filter(t => t.status === 'Approved').length} / {testCases.length}
                    </span>
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
                    <span className="tn-app-tab__badge">{testCases.length}</span>
                </button>
                <button
                    className={`tn-app-tab ${activeTab === 'coverage' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('coverage')}
                >
                    <Layers size={15} />
                    <span>Coverage</span>
                    <span className="tn-app-tab__badge">94%</span>
                </button>
                <button
                    className={`tn-app-tab ${activeTab === 'risks' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('risks')}
                >
                    <Shield size={15} />
                    <span>Risks</span>
                    <span className="tn-app-tab__badge tn-app-tab__badge--alert">3</span>
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
                {activeTab === 'tests' && (
                    <div className="tn-app-tests-view">
                        {/* Compact Toolbar */}
                        <div className="tn-app-toolbar">
                            <div className="tn-app-toolbar__left">
                                <div className="tn-app-search">
                                    <Search size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search test cases by ID, title, or scenario..."
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
                                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                        <option value="All">All Statuses</option>
                                        <option value="Needs Review">Needs Review</option>
                                        <option value="Approved">Approved</option>
                                    </select>
                                </div>
                                <span className="tn-app-count-label">{filteredTests.length} tests displayed</span>
                            </div>
                        </div>

                        {/* Floating Bulk Actions Bar */}
                        {selectedRows.length > 0 && (
                            <div className="tn-bulk-floating animate-slide-up">
                                <span className="tn-bulk-count">
                                    <strong>{selectedRows.length}</strong> selected
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
                                        <span>Export</span>
                                    </button>
                                    <button className="tn-bulk-close" onClick={() => setSelectedRows([])}>
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Master-Detail Split Workspace */}
                        <div className="tn-app-split-workspace">
                            {/* Left: Test Case Table */}
                            <div className="tn-app-table-pane">
                                <table className="tn-qa-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '36px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={filteredTests.length > 0 && selectedRows.length === filteredTests.length}
                                                    onChange={() => setSelectedRows(selectedRows.length === filteredTests.length ? [] : filteredTests.map(t => t.id))}
                                                    aria-label="Select all"
                                                />
                                            </th>
                                            <th style={{ width: '84px' }}>ID</th>
                                            <th>Test Scenario & Title</th>
                                            <th style={{ width: '100px' }}>Type</th>
                                            <th style={{ width: '90px' }}>Priority</th>
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
                                                            <span>{tc.scenario}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`tn-type-tag tn-type-tag--${tc.type.toLowerCase().replace(/\s+/g, '')}`}>
                                                            {tc.type}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`tn-prio-tag tn-prio-tag--${tc.priority.toLowerCase()}`}>
                                                            {tc.priority}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`tn-status-pill tn-status-pill--${tc.status === 'Approved' ? 'approved' : 'review'}`}>
                                                            <span className="tn-status-dot" />
                                                            {tc.status === 'Approved' ? '✓ Approved' : 'Needs Review'}
                                                        </span>
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
                                            <span className="tn-detail-req">{selectedTc.reqId}</span>
                                            <span className={`tn-status-pill tn-status-pill--${selectedTc.status === 'Approved' ? 'approved' : 'review'}`}>
                                                <span className="tn-status-dot" /> {selectedTc.status === 'Approved' ? '✓ Approved' : 'Needs Review'}
                                            </span>
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
                                            onClick={() => { setEditingTc(selectedTc); setShowRegenModal(true); }}
                                            title="Regenerate / enhance test"
                                        >
                                            <RefreshCw size={13} />
                                            <span>Regen</span>
                                        </button>
                                        <button
                                            className={`tn-app-btn tn-app-btn--sm ${showGherkin ? 'tn-app-btn--primary' : 'tn-app-btn--secondary'}`}
                                            onClick={() => setShowGherkin(!showGherkin)}
                                            title="Toggle BDD Gherkin"
                                        >
                                            <Code size={13} />
                                            <span>BDD</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="tn-detail-badges-row">
                                    <div>
                                        <label>TYPE</label>
                                        <span className="tn-badge-value">{selectedTc.type}</span>
                                    </div>
                                    <div>
                                        <label>PRIORITY</label>
                                        <span className="tn-badge-value text-amber-400">{selectedTc.priority}</span>
                                    </div>
                                    <div>
                                        <label>SEVERITY</label>
                                        <span className="tn-badge-value">{selectedTc.severity}</span>
                                    </div>
                                    <div>
                                        <label>TRACEABILITY</label>
                                        <span className="tn-badge-value text-teal-400">{selectedTc.reqId}</span>
                                    </div>
                                </div>

                                {showGherkin ? (
                                    <div className="tn-gherkin-view">
                                        <div className="tn-gherkin-header">
                                            <span>Cucumber / Behave Gherkin Feature</span>
                                        </div>
                                        <pre className="tn-gherkin-code">
                                            <code>{formatGherkinDemo(selectedTc)}</code>
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="tn-detail-body">
                                        <div className="tn-detail-section">
                                            <h5>PRECONDITIONS</h5>
                                            <p className="tn-precon-text">{selectedTc.preconditions}</p>
                                        </div>

                                        <div className="tn-detail-section">
                                            <h5>TEST STEPS ({selectedTc.steps?.length || 0})</h5>
                                            <div className="tn-detail-steps">
                                                {selectedTc.steps.map((st, i) => (
                                                    <div key={i} className="tn-step-item">
                                                        <span className="tn-step-num">{st.num || String(i + 1).padStart(2, '0')}</span>
                                                        <div className="tn-step-content">
                                                            <p className="tn-step-action"><strong>Action:</strong> {st.action}</p>
                                                            <p className="tn-step-expected"><strong>Expected:</strong> {st.expected}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="tn-detail-section">
                                            <h5>EXPECTED RESULT</h5>
                                            <div className="tn-expected-box">
                                                <CheckSquare size={15} className="text-teal-400 shrink-0" />
                                                <p>{selectedTc.expectedResult}</p>
                                            </div>
                                        </div>

                                        <div className="tn-detail-section">
                                            <h5>TEST PARAMETERS</h5>
                                            <div className="tn-data-snippet">
                                                <code>{selectedTc.testData}</code>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

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
                            {COVERAGE_ITEMS.map((item) => (
                                <div key={item.req} className="tn-coverage-row">
                                    <div className="tn-coverage-row__meta">
                                        <span className="tn-tc-id">{item.req}</span>
                                        <strong>{item.label}</strong>
                                        <span className="tn-coverage-count">{item.tests} Test Cases</span>
                                    </div>
                                    <div className="tn-coverage-row__bar-wrap">
                                        <div className="tn-coverage-bar">
                                            <div className="tn-coverage-bar__fill" style={{ width: `${item.coverage}%` }} />
                                        </div>
                                        <span className="tn-coverage-pct">{item.coverage}%</span>
                                    </div>
                                </div>
                            ))}
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
                                <li><strong>Rate Limiting:</strong> Repeated password reset requests from single IP or target account.</li>
                                <li><strong>Concurrent Redemptions:</strong> Dual redemption of identical token across race conditions.</li>
                            </ul>
                            <button className="tn-app-btn tn-app-btn--primary tn-app-btn--sm" onClick={handleAddMissingTests}>
                                <Sparkles size={13} />
                                <span>Generate Missing Tests (2)</span>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'risks' && (
                    <div className="tn-app-risks-view">
                        <div className="tn-risks-header">
                            <div>
                                <h4>Identified Security & Logic Risks</h4>
                                <p>Critical boundary gaps flagged by AI requirement intelligence.</p>
                            </div>
                        </div>
                        <div className="tn-risks-grid">
                            {RISK_ITEMS.map((r, i) => (
                                <div key={i} className={`tn-risk-card tn-risk-card--${r.level.toLowerCase()}`}>
                                    <div className="tn-risk-card__top">
                                        <span className={`tn-risk-badge tn-risk-badge--${r.level.toLowerCase()}`}>{r.level} Risk</span>
                                        <span className="tn-risk-cat">{r.category}</span>
                                        <span className="tn-risk-linked" onClick={() => { setSelectedTcId(r.linkedTc); setActiveTab('tests'); }} style={{ cursor: 'pointer' }}>
                                            Linked: {r.linkedTc} &rarr;
                                        </span>
                                    </div>
                                    <h5>{r.title}</h5>
                                    <p>{r.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'traceability' && (
                    <div className="tn-app-trace-view">
                        <div className="tn-trace-header">
                            <h4>Requirement &rarr; Generated Test Tree</h4>
                            <p>End-to-end traceability graph from raw product requirement to verification test suite.</p>
                        </div>
                        <div className="tn-trace-tree">
                            {TRACE_ITEMS.map((tr) => (
                                <div key={tr.reqId} className="tn-trace-root">
                                    <div className="tn-trace-root__node">
                                        <span className="tn-tc-id">{tr.reqId}</span>
                                        <strong>{tr.title}</strong>
                                        <span className="tn-trace-status">Source Requirement</span>
                                    </div>
                                    <div className="tn-trace-branches">
                                        {tr.children.map((ch, idx) => (
                                            <div key={idx} className="tn-trace-leaf">
                                                <span className="tn-trace-leaf__connector" />
                                                <code>{ch}</code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
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
                        <span>Context: <strong>{selectedTc.id || 'REQ-001'}</strong> ({selectedTc.title?.slice(0, 30)}...)</span>
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
                                    value={editingTc.preconditions}
                                    onChange={(e) => setEditingTc({ ...editingTc, preconditions: e.target.value })}
                                />
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
                            <p className="tn-modal-desc">Select optimization objective for <strong>{editingTc.id}</strong>:</p>
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
                                Approving this test suite will certify all <strong>{testCases.length} test cases</strong> for production execution and CI/CD integration.
                            </p>
                            <div className="tn-approval-summary">
                                <div><span>Total Tests:</span> <strong>{testCases.length}</strong></div>
                                <div><span>Requirement:</span> <strong>REQ-001</strong></div>
                                <div><span>Coverage:</span> <strong className="text-teal-400">94%</strong></div>
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
                        </div>

                        <div className="tn-modal__footer">
                            <button className="tn-app-btn tn-app-btn--secondary" onClick={() => setShowExportModal(false)}>
                                Cancel
                            </button>
                            <button className="tn-app-btn tn-app-btn--primary" onClick={handleExport}>
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
        </div>
    );
};

// ─── Main Hero Section ───
const HERO_INTELLIGENCE_ITEMS = [
    'Functional flow',
    'Validation rules',
    'Negative scenarios',
    'Security requirements',
    'Edge cases'
];

const HERO_ANALYSIS_ITEMS = [
    'Functional scenarios',
    'Negative scenarios',
    'Security scenarios',
    'Edge cases',
    'Boundary conditions'
];

const HERO_TEST_ROWS = [
    { id: 'TC-001', title: 'Reset password with valid registered email', type: 'Functional', priority: 'High' },
    { id: 'TC-002', title: 'Reset password with invalid email format', type: 'Negative', priority: 'High' },
    { id: 'TC-003', title: 'Submit empty email payload', type: 'Validation', priority: 'Medium' },
    { id: 'TC-004', title: 'Use expired reset link beyond TTL', type: 'Edge Case', priority: 'High' },
    { id: 'TC-005', title: 'Reuse previously consumed reset token', type: 'Security', priority: 'High' }
];

const HeroProductVisualization = () => (
    <div className="tn-hero-product" aria-label="Requirement to generated test suite workflow">
        <div className="tn-hero-product__halo" aria-hidden="true" />

        <div className="tn-hero-metric tn-hero-metric--coverage">
            <strong>94%</strong>
            <span>Requirement Coverage</span>
        </div>
        <div className="tn-hero-metric tn-hero-metric--risk">
            <strong>6</strong>
            <span>High Risk Scenarios</span>
        </div>
        <div className="tn-hero-metric tn-hero-metric--tests">
            <strong>18</strong>
            <span>Generated Tests</span>
        </div>

        <div className="tn-hero-workspace">
            <div className="tn-hero-workspace__topbar">
                <div className="tn-hero-workspace__brand">
                    <span className="tn-hero-workspace__logo">T</span>
                    <span>Testnexa AI</span>
                </div>
                <div className="tn-hero-workspace__path">
                    <span>Requirement</span>
                    <ChevronRight size={14} />
                    <span>Test Suite</span>
                </div>
            </div>

            <div className="tn-hero-flow">
                <section className="tn-hero-stage tn-hero-stage--requirement">
                    <div className="tn-hero-stage__label">Requirement</div>
                    <div className="tn-hero-requirement-card">
                        <span>Password Reset</span>
                        <p>"Users can reset their password using their registered email address."</p>
                    </div>

                    <div className="tn-hero-intelligence">
                        <div className="tn-hero-intelligence__header">
                            <span>Requirement Intelligence</span>
                            <span className="tn-hero-processing">
                                <Loader2 size={12} />
                                Processing
                            </span>
                        </div>
                        <div className="tn-hero-intelligence__list">
                            {HERO_INTELLIGENCE_ITEMS.map((item, index) => (
                                <div className="tn-hero-check-row" style={{ '--tn-row-delay': `${index * 0.16}s` }} key={item}>
                                    <Check size={13} />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="tn-hero-connector tn-hero-connector--one" aria-hidden="true">
                    <span />
                </div>

                <section className="tn-hero-stage tn-hero-stage--analysis">
                    <div className="tn-hero-stage__label">AI Analysis</div>
                    <div className="tn-hero-analysis-panel">
                        <div className="tn-hero-analysis-panel__status">
                            <Sparkles size={14} />
                            <span>Understanding requirement...</span>
                        </div>
                        <div className="tn-hero-analysis-list">
                            {HERO_ANALYSIS_ITEMS.map((item, index) => (
                                <div className="tn-hero-analysis-row" style={{ '--tn-row-delay': `${0.35 + index * 0.14}s` }} key={item}>
                                    <span>{item}</span>
                                    <CheckCircle2 size={14} />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="tn-hero-connector tn-hero-connector--two" aria-hidden="true">
                    <span />
                </div>

                <section className="tn-hero-stage tn-hero-stage--suite">
                    <div className="tn-hero-stage__label">Generated Test Suite</div>
                    <div className="tn-hero-suite-panel">
                        <div className="tn-hero-suite-header">
                            <div>
                                <span>Password Reset Suite</span>
                                <strong>Execution-ready coverage map</strong>
                            </div>
                            <span className="tn-hero-suite-ready">Ready</span>
                        </div>

                        <div className="tn-hero-suite-stats">
                            <div><strong>18</strong><span>Test Cases</span></div>
                            <div><strong>94%</strong><span>Coverage</span></div>
                            <div><strong>6</strong><span>High Priority</span></div>
                            <div><strong>4</strong><span>Edge Cases</span></div>
                        </div>

                        <div className="tn-hero-test-table">
                            {HERO_TEST_ROWS.map((test, index) => (
                                <div className="tn-hero-test-row" style={{ '--tn-row-delay': `${0.8 + index * 0.13}s` }} key={test.id}>
                                    <span className="tn-hero-test-row__id">{test.id}</span>
                                    <span className="tn-hero-test-row__title">{test.title}</span>
                                    <span className="tn-hero-chip">{test.type}</span>
                                    <span className={`tn-hero-priority tn-hero-priority--${test.priority.toLowerCase()}`}>{test.priority}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    </div>
);

const Hero = ({ onOpenGenerator }) => {
    const reveal = useScrollReveal({ threshold: 0.1 });
    const navigate = useNavigate();

    const handleAction = useCallback(() => {
        if (typeof onOpenGenerator === 'function') {
            onOpenGenerator();
        } else {
            navigate('/app/workspace');
        }
    }, [onOpenGenerator, navigate]);

    return (
        <header className="tn-hero" aria-labelledby="hero-heading">
            <div className="tn-hero__glow" aria-hidden="true" />
            <div
                ref={reveal.ref}
                className={`tn-container tn-hero__inner scroll-reveal-fade-up ${reveal.isVisible ? 'revealed' : ''}`}
            >
                {/* ─── Hero Text Content ─── */}
                <div className="tn-hero__text">
                    <div className="tn-eyebrow" aria-label="Product Badge">
                        <span className="tn-eyebrow__dot" />
                        <span className="tn-eyebrow__text">AI-POWERED QA ENGINEERING</span>
                    </div>

                    <h1 id="hero-heading" className="tn-hero__headline">
                        Turn Requirements Into <span className="tn-hero__headline-accent">Production-Ready</span> Test Suites.
                    </h1>

                    <p className="tn-hero__subtext">
                        Transform ambiguous requirements into complete, prioritized and execution-ready test suites with
                        AI-powered requirement intelligence.
                    </p>

                    <div className="tn-hero__ctas">
                        <a
                            href="/app/workspace"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tn-btn tn-btn--primary tn-btn--lg"
                            id="hero-generate-btn"
                        >
                            Generate Test Suite
                            <ArrowRight size={18} />
                        </a>
                        <a
                            href="#engineering-maturity"
                            className="tn-btn tn-btn--secondary tn-btn--lg"
                        >
                            Explore How It Works
                        </a>
                    </div>

                    <div className="tn-hero__trust" aria-label="Product assurances">
                        <span>No setup required</span>
                        <span>AI-powered</span>
                        <span>Export-ready</span>
                    </div>
                </div>

                <HeroProductVisualization />
            </div>
        </header>
    );
};

export default Hero;
