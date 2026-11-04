import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
    Wrench, AlertTriangle, CheckCircle2, Clock, Search, Filter,
    RefreshCw, Layers, ExternalLink, Sparkles, Terminal, FileCode,
    ChevronRight, ArrowRight, ShieldAlert, Cpu, Eye, Check, X,
    Activity, Play
} from 'lucide-react';
import { maintenanceService } from '../../services/maintenanceService';
import { sessionService } from '../../services/sessionService';
import { DataLoadingState } from '../../components/loading';
import '../../styles/app/TestMaintenanceIntelligence.css';

const TestMaintenanceIntelligencePage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Context & Filter States
    const [suites, setSuites] = useState([]);
    const [selectedSuiteId, setSelectedSuiteId] = useState('all');
    const [dateRange, setDateRange] = useState('30d');
    const [selectedBrowser, setSelectedBrowser] = useState('all');
    const [selectedEnvironment, setSelectedEnvironment] = useState('all');

    // Data States
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [findings, setFindings] = useState([]);
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState(null);

    // Filter & Search
    const [issueFilter, setIssueFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Active Drawer & AI States
    const [selectedFinding, setSelectedFinding] = useState(null);
    const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
    const [aiError, setAiError] = useState(null);

    // Resolution Modal
    const [resolvingFinding, setResolvingFinding] = useState(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [isSavingResolution, setIsSavingResolution] = useState(false);

    // Load available suites on mount
    useEffect(() => {
        let isCurrent = true;
        const fetchSuites = async () => {
            try {
                const res = await sessionService.list({ limit: 50 });
                if (isCurrent && res?.data) {
                    setSuites(res.data);
                }
            } catch (err) {
                console.error('Failed to list suites:', err);
            }
        };
        fetchSuites();
        return () => { isCurrent = false; };
    }, []);

    // Compute start and end dates from dateRange
    const computedDates = useMemo(() => {
        const now = new Date();
        let start = new Date();
        if (dateRange === '7d') start.setDate(now.getDate() - 7);
        else if (dateRange === '30d') start.setDate(now.getDate() - 30);
        else if (dateRange === '90d') start.setDate(now.getDate() - 90);
        else start = null;

        return {
            startDate: start ? start.toISOString() : null,
            endDate: now.toISOString()
        };
    }, [dateRange]);

    // Fetch Maintenance Intelligence Overview
    const fetchOverview = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);

        try {
            const res = await maintenanceService.getOverview({
                suiteId: selectedSuiteId === 'all' ? null : selectedSuiteId,
                startDate: computedDates.startDate,
                endDate: computedDates.endDate,
                browser: selectedBrowser === 'all' ? null : selectedBrowser,
                environment: selectedEnvironment === 'all' ? null : selectedEnvironment
            });

            if (res?.data) {
                setFindings(res.data.findings || []);
                setSummary(res.data.summary || null);

                // Re-hydrate selected finding if drawer is open
                if (selectedFinding) {
                    const updated = (res.data.findings || []).find(f => f.id === selectedFinding.id);
                    if (updated) setSelectedFinding(updated);
                }
            }
        } catch (err) {
            console.error('Failed to fetch maintenance overview:', err);
            setError(err.message || 'Failed to analyze maintenance intelligence.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedSuiteId, computedDates, selectedBrowser, selectedEnvironment, selectedFinding]);

    useEffect(() => {
        fetchOverview();
    }, [selectedSuiteId, dateRange, selectedBrowser, selectedEnvironment]);

    // Update Status Action
    const handleUpdateStatus = async (findingId, nextStatus, notes = '') => {
        try {
            const res = await maintenanceService.updateFinding(findingId, {
                status: nextStatus,
                resolutionNotes: notes
            });

            if (res?.data) {
                setFindings(prev => prev.map(f => f.id === findingId ? res.data : f));
                if (selectedFinding?.id === findingId) {
                    setSelectedFinding(res.data);
                }
                setResolvingFinding(null);
                setResolutionNotes('');
            }
        } catch (err) {
            console.error('Failed to update status:', err);
            alert(`Failed to update status: ${err.message}`);
        }
    };

    // Trigger AI Analysis
    const handleAnalyzeAI = async () => {
        if (!selectedFinding) return;
        setIsAnalyzingAI(true);
        setAiError(null);

        try {
            const res = await maintenanceService.analyzeWithAI(selectedFinding.id);
            if (res?.data) {
                setSelectedFinding(res.data);
                setFindings(prev => prev.map(f => f.id === res.data.id ? res.data : f));
            }
        } catch (err) {
            console.error('AI analysis error:', err);
            setAiError(err.message || 'AI diagnosis timed out or failed.');
        } finally {
            setIsAnalyzingAI(false);
        }
    };

    // Filtered Findings
    const filteredFindings = useMemo(() => {
        return findings.filter(f => {
            if (issueFilter !== 'all' && f.issueType !== issueFilter) return false;
            if (statusFilter !== 'all' && f.status !== statusFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = (f.testCaseTitle || '').toLowerCase().includes(q);
                const idMatch = (f.testCaseId || '').toLowerCase().includes(q);
                const locMatch = (f.locator || '').toLowerCase().includes(q);
                const errMatch = (f.errorMessage || '').toLowerCase().includes(q);
                if (!titleMatch && !idMatch && !locMatch && !errMatch) return false;
            }
            return true;
        });
    }, [findings, issueFilter, statusFilter, searchQuery]);

    const getIssueBadge = (type) => {
        switch (type) {
            case 'BROKEN_LOCATOR':
                return <span className="maint-badge maint-badge--broken-locator">Broken Locator</span>;
            case 'OUTDATED_MAPPING':
                return <span className="maint-badge maint-badge--outdated-mapping">Outdated Mapping</span>;
            case 'PERFORMANCE_REGRESSION':
                return <span className="maint-badge maint-badge--performance">Duration Spike</span>;
            case 'ENVIRONMENT_FAILURE':
                return <span className="maint-badge maint-badge--env">Environment Issue</span>;
            case 'APPLICATION_DEFECT':
                return <span className="maint-badge maint-badge--app-defect">Defect Suspected</span>;
            default:
                return <span className="maint-badge maint-badge--repeated-failure">Repeated Failure</span>;
        }
    };

    if (isLoading && !isRefreshing) {
        return (
            <div className="maintenance-page">
                <DataLoadingState
                    message="Scanning automation executions for maintenance risks..."
                    telemetryTag="MAINTENANCE"
                    skeletonType="metrics-detail"
                />
            </div>
        );
    }

    return (
        <div className="maintenance-page">
            {/* Breadcrumbs */}
            <div className="maint-breadcrumbs">
                <Link to="/app/intelligence">Execution Intelligence</Link>
                <span>/</span>
                <span>Test Maintenance</span>
            </div>

            {/* Header */}
            <header className="maint-header">
                <div className="maint-header__title-area">
                    <h1>
                        <Wrench size={24} />
                        Test Maintenance Intelligence
                    </h1>
                    <p>
                        Identify broken Playwright locators, outdated automation mappings, duration spikes, and recurring test script failures across your workspace.
                    </p>
                </div>

                <div className="maint-header__actions">
                    <button
                        type="button"
                        className="maint-btn-primary"
                        onClick={() => fetchOverview(true)}
                        disabled={isRefreshing}
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'spin-animate' : ''} />
                        <span>{isRefreshing ? 'Scanning...' : 'Refresh Scan'}</span>
                    </button>
                </div>
            </header>

            {/* Error Notification */}
            {error && (
                <div className="maint-section" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', marginBottom: '1.25rem' }}>
                    <div style={{ color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Context Filters */}
            <div className="maint-context-card">
                <div className="maint-context-row">
                    <div className="maint-field">
                        <label>Suite Scope</label>
                        <select
                            className="maint-select"
                            value={selectedSuiteId}
                            onChange={(e) => setSelectedSuiteId(e.target.value)}
                        >
                            <option value="all">All Test Suites</option>
                            {suites.map(s => (
                                <option key={s.id || s._id} value={s.id || s._id}>
                                    {s.title || 'Untitled Suite'}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="maint-field">
                        <label>Date Boundary</label>
                        <select
                            className="maint-select"
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                        >
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="90d">Last 90 Days</option>
                            <option value="all">All Recorded Runs</option>
                        </select>
                    </div>

                    <div className="maint-field">
                        <label>Browser Engine</label>
                        <select
                            className="maint-select"
                            value={selectedBrowser}
                            onChange={(e) => setSelectedBrowser(e.target.value)}
                        >
                            <option value="all">All Browsers</option>
                            <option value="chromium">Chromium</option>
                            <option value="firefox">Firefox</option>
                            <option value="webkit">WebKit</option>
                        </select>
                    </div>

                    <div className="maint-field">
                        <label>Environment</label>
                        <select
                            className="maint-select"
                            value={selectedEnvironment}
                            onChange={(e) => setSelectedEnvironment(e.target.value)}
                        >
                            <option value="all">All Environments</option>
                            <option value="production">Production</option>
                            <option value="staging">Staging</option>
                            <option value="qa">QA / Test</option>
                            <option value="development">Development</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Metrics Row */}
            {summary && (
                <div className="maint-summary-row">
                    <div className="maint-stat-pill">
                        <div className="maint-stat-info">
                            <span className="maint-stat-label">Total Findings</span>
                            <span className="maint-stat-count">{summary.totalFindings}</span>
                        </div>
                        <div className="maint-stat-icon">
                            <Wrench size={18} />
                        </div>
                    </div>

                    <div className="maint-stat-pill">
                        <div className="maint-stat-info">
                            <span className="maint-stat-label">Broken Locators</span>
                            <span className="maint-stat-count" style={{ color: '#FCA5A5' }}>
                                {summary.brokenLocatorsCount}
                            </span>
                        </div>
                        <div className="maint-stat-icon" style={{ color: '#EF4444' }}>
                            <AlertTriangle size={18} />
                        </div>
                    </div>

                    <div className="maint-stat-pill">
                        <div className="maint-stat-info">
                            <span className="maint-stat-label">Repeated Failures</span>
                            <span className="maint-stat-count" style={{ color: '#FDBA74' }}>
                                {summary.repeatedFailuresCount}
                            </span>
                        </div>
                        <div className="maint-stat-icon" style={{ color: '#F97316' }}>
                            <Activity size={18} />
                        </div>
                    </div>

                    <div className="maint-stat-pill">
                        <div className="maint-stat-info">
                            <span className="maint-stat-label">Outdated Mappings</span>
                            <span className="maint-stat-count" style={{ color: '#FCD34D' }}>
                                {summary.outdatedMappingsCount}
                            </span>
                        </div>
                        <div className="maint-stat-icon" style={{ color: '#EAB308' }}>
                            <FileCode size={18} />
                        </div>
                    </div>

                    <div className="maint-stat-pill">
                        <div className="maint-stat-info">
                            <span className="maint-stat-label">Duration Spikes</span>
                            <span className="maint-stat-count" style={{ color: '#D8B4FE' }}>
                                {summary.performanceWarningsCount}
                            </span>
                        </div>
                        <div className="maint-stat-icon" style={{ color: '#A855F7' }}>
                            <Clock size={18} />
                        </div>
                    </div>
                </div>
            )}

            {/* Toolbar Filters */}
            <div className="maint-toolbar">
                <div className="maint-toolbar__filters">
                    <div className="maint-search-box">
                        <Search size={14} />
                        <input
                            type="text"
                            className="maint-search-input"
                            placeholder="Search test case or locator..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <select
                        className="maint-filter-select"
                        value={issueFilter}
                        onChange={(e) => setIssueFilter(e.target.value)}
                    >
                        <option value="all">All Issue Types</option>
                        <option value="BROKEN_LOCATOR">Broken Locators</option>
                        <option value="OUTDATED_MAPPING">Outdated Mappings</option>
                        <option value="PERFORMANCE_REGRESSION">Performance Warnings</option>
                        <option value="REPEATED_AUTOMATION_FAILURE">Repeated Failures</option>
                        <option value="ENVIRONMENT_FAILURE">Environment Issues</option>
                        <option value="APPLICATION_DEFECT">Application Defects</option>
                    </select>

                    <select
                        className="maint-filter-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                        <option value="ignored">Ignored</option>
                    </select>
                </div>

                <div style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                    Showing <strong>{filteredFindings.length}</strong> findings
                </div>
            </div>

            {/* Findings Queue Table */}
            {filteredFindings.length > 0 ? (
                <div className="maint-table-wrap">
                    <table className="maint-table">
                        <thead>
                            <tr>
                                <th>Test Case</th>
                                <th>Category</th>
                                <th>Classification</th>
                                <th>Severity</th>
                                <th>Signature / Target</th>
                                <th>Occurrences</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFindings.map((finding) => (
                                <tr
                                    key={finding.id}
                                    className={selectedFinding?.id === finding.id ? 'is-selected' : ''}
                                >
                                    <td>
                                        <div style={{ fontWeight: 600, color: '#F8FAFC' }}>
                                            {finding.testCaseTitle}
                                        </div>
                                        <small style={{ color: '#64748B', fontFamily: 'monospace' }}>
                                            {finding.testCaseId} · {finding.suiteTitle}
                                        </small>
                                    </td>
                                    <td>{getIssueBadge(finding.issueType)}</td>
                                    <td>
                                        <span style={{ fontSize: '0.78rem', color: '#CBD5E1' }}>
                                            {finding.classification}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: finding.severity === 'Critical' ? '#EF4444' : finding.severity === 'High' ? '#F97316' : '#94A3B8'
                                        }}>
                                            {finding.severity}
                                        </span>
                                    </td>
                                    <td>
                                        {finding.locator ? (
                                            <code style={{ color: '#38BDF8', background: '#0B0E11', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                                                {finding.locator}
                                            </code>
                                        ) : (
                                            <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>
                                                {(finding.errorMessage || '').slice(0, 45)}...
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600, color: '#F1F5F9' }}>
                                            {finding.metrics?.occurrenceCount || 1}
                                        </span>
                                        <span style={{ color: '#64748B', fontSize: '0.75rem' }}>
                                            {' '}({finding.metrics?.failureRate || 0}%)
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`maint-badge maint-badge--status-${finding.status}`}>
                                            {finding.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button
                                            type="button"
                                            className="maint-btn-secondary"
                                            onClick={() => setSelectedFinding(finding)}
                                        >
                                            <Eye size={13} />
                                            <span>Inspect</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="maint-empty-state">
                    <div className="maint-empty-icon">
                        <CheckCircle2 size={24} />
                    </div>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#F8FAFC' }}>No Automation Maintenance Risks Detected</h3>
                    <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem' }}>
                        Your Playwright test locators, mappings, and execution durations meet stability thresholds within the selected scope.
                    </p>
                </div>
            )}

            {/* Finding Inspection Drawer */}
            {selectedFinding && (
                <div className="maint-drawer-backdrop" onClick={() => setSelectedFinding(null)}>
                    <div className="maint-drawer" onClick={(e) => e.stopPropagation()}>
                        <header className="maint-drawer__header">
                            <div>
                                <h2>{selectedFinding.testCaseTitle}</h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#94A3B8' }}>
                                    <span style={{ fontFamily: 'monospace' }}>{selectedFinding.testCaseId}</span>
                                    <span>·</span>
                                    <span>{selectedFinding.suiteTitle}</span>
                                    <span>·</span>
                                    <span className={`maint-badge maint-badge--status-${selectedFinding.status}`}>
                                        {selectedFinding.status.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="maint-drawer__close"
                                onClick={() => setSelectedFinding(null)}
                            >
                                ×
                            </button>
                        </header>

                        <div className="maint-drawer__body">
                            {/* Classification Banner */}
                            <div className="maint-section">
                                <div className="maint-section__title">
                                    <AlertTriangle size={14} />
                                    <span>Diagnostic Findings</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem' }}>
                                    {getIssueBadge(selectedFinding.issueType)}
                                    <span className="maint-badge" style={{ background: '#171E25', color: '#CBD5E1' }}>
                                        {selectedFinding.classification}
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.8125rem', color: '#CBD5E1', lineHeight: '1.5', margin: 0 }}>
                                    {selectedFinding.detectionExplanation}
                                </p>
                            </div>

                            {/* Broken Locator Box */}
                            {selectedFinding.locator && (
                                <div className="maint-section">
                                    <div className="maint-section__title">
                                        <Terminal size={14} />
                                        <span>Failed Locator Selector</span>
                                    </div>
                                    <div className="maint-code-box" style={{ color: '#38BDF8', fontWeight: 600 }}>
                                        {selectedFinding.locator}
                                    </div>
                                </div>
                            )}

                            {/* Automation Mapping */}
                            <div className="maint-section">
                                <div className="maint-section__title">
                                    <FileCode size={14} />
                                    <span>Playwright Automation Mapping</span>
                                </div>
                                {selectedFinding.mapping ? (
                                    <div style={{ fontSize: '0.8125rem', color: '#CBD5E1' }}>
                                        <div><strong>Script Reference: </strong><code style={{ color: '#8BAF9A' }}>{selectedFinding.mapping.scriptRef || 'None'}</code></div>
                                        {selectedFinding.mapping.testId && <div><strong>Test Identifier: </strong><code>{selectedFinding.mapping.testId}</code></div>}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.8125rem', color: '#FCD34D' }}>
                                        ⚠️ No active script reference bound to this test case.
                                    </div>
                                )}
                            </div>

                            {/* Error Snippet */}
                            {selectedFinding.errorMessage && (
                                <div className="maint-section">
                                    <div className="maint-section__title">
                                        <AlertTriangle size={14} />
                                        <span>Latest Error Evidence</span>
                                    </div>
                                    <div className="maint-code-box">
                                        {selectedFinding.errorMessage}
                                        {selectedFinding.stackTraceSnippet && (
                                            <>
                                                {'\n\n'}
                                                {selectedFinding.stackTraceSnippet}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Supporting Evidence List */}
                            <div className="maint-section">
                                <div className="maint-section__title">
                                    <Layers size={14} />
                                    <span>Technical Evidence</span>
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: '#CBD5E1', lineHeight: '1.6' }}>
                                    {(selectedFinding.supportingEvidence || []).map((ev, i) => (
                                        <li key={i}>{ev}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* Recommended Maintenance Action */}
                            <div className="maint-section" style={{ borderLeft: '3px solid #8BAF9A' }}>
                                <div className="maint-section__title">
                                    <CheckCircle2 size={14} />
                                    <span>Recommended Action</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#E2E8F0', lineHeight: '1.5' }}>
                                    {selectedFinding.recommendedAction}
                                </p>
                            </div>

                            {/* AI Locator Diagnosis (On Demand) */}
                            {selectedFinding.aiAnalysis ? (
                                <div className="maint-ai-box">
                                    <h4>
                                        <Sparkles size={16} />
                                        AI Locator Refactoring Suggestions
                                    </h4>
                                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#CBD5E1', lineHeight: '1.5' }}>
                                        {selectedFinding.aiAnalysis.explanation}
                                    </p>
                                    {selectedFinding.aiAnalysis.suggestedSelectors?.length > 0 && (
                                        <div>
                                            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 600 }}>
                                                Recommended Playwright Locators
                                            </span>
                                            <div className="maint-selector-list">
                                                {selectedFinding.aiAnalysis.suggestedSelectors.map((sel, idx) => (
                                                    <div key={idx} className="maint-selector-item">
                                                        {sel}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedFinding.aiAnalysis.recommendedFix && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#94A3B8' }}>
                                            <strong>Refactoring Steps: </strong>{selectedFinding.aiAnalysis.recommendedFix}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        type="button"
                                        className="maint-btn-primary"
                                        onClick={handleAnalyzeAI}
                                        disabled={isAnalyzingAI}
                                    >
                                        <Sparkles size={14} className={isAnalyzingAI ? 'spin-animate' : ''} />
                                        <span>{isAnalyzingAI ? 'Generating Locator Diagnosis...' : 'Diagnose Locator with AI'}</span>
                                    </button>
                                </div>
                            )}

                            {aiError && (
                                <div style={{ color: '#FCA5A5', fontSize: '0.8rem' }}>
                                    AI Diagnosis Error: {aiError}
                                </div>
                            )}

                            {/* Resolution Notes If Present */}
                            {selectedFinding.resolutionNotes && (
                                <div className="maint-section">
                                    <div className="maint-section__title">
                                        <Check size={14} />
                                        <span>Investigation / Resolution Notes</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#8BAF9A' }}>
                                        {selectedFinding.resolutionNotes}
                                    </p>
                                </div>
                            )}
                        </div>

                        <footer className="maint-drawer__footer">
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="maint-btn-secondary"
                                    onClick={() => navigate(`/app/test-cases?suiteId=${encodeURIComponent(selectedFinding.suiteId)}`)}
                                >
                                    <ExternalLink size={13} />
                                    <span>Open Test Case</span>
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {selectedFinding.status !== 'investigating' && (
                                    <button
                                        type="button"
                                        className="maint-btn-secondary"
                                        onClick={() => handleUpdateStatus(selectedFinding.id, 'investigating')}
                                    >
                                        <span>Mark Investigating</span>
                                    </button>
                                )}

                                {selectedFinding.status !== 'resolved' ? (
                                    <button
                                        type="button"
                                        className="maint-btn-primary"
                                        onClick={() => {
                                            setResolvingFinding(selectedFinding);
                                            setResolutionNotes('');
                                        }}
                                    >
                                        <Check size={14} />
                                        <span>Resolve Finding</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="maint-btn-secondary"
                                        onClick={() => handleUpdateStatus(selectedFinding.id, 'open')}
                                    >
                                        <span>Reopen</span>
                                    </button>
                                )}
                            </div>
                        </footer>
                    </div>
                </div>
            )}

            {/* Resolve Modal */}
            {resolvingFinding && (
                <div className="maint-modal-backdrop" onClick={() => setResolvingFinding(null)}>
                    <div className="maint-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="maint-modal__header">
                            <h3 style={{ margin: 0, fontSize: '1rem', color: '#F8FAFC' }}>Mark Maintenance Finding as Resolved</h3>
                            <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '1.25rem' }}
                                onClick={() => setResolvingFinding(null)}
                            >
                                ×
                            </button>
                        </header>
                        <div className="maint-modal__body">
                            <p style={{ margin: '0 0 0.875rem 0', fontSize: '0.8125rem', color: '#CBD5E1' }}>
                                Provide resolution notes detailing the script, locator, or mapping fix applied:
                            </p>
                            <textarea
                                rows="3"
                                className="maint-input"
                                style={{ width: '100%', boxSizing: 'border-box' }}
                                placeholder="e.g. Updated Playwright selector to page.getByRole('button', { name: 'Submit' })"
                                value={resolutionNotes}
                                onChange={(e) => setResolutionNotes(e.target.value)}
                            />
                        </div>
                        <footer className="maint-modal__footer">
                            <button
                                type="button"
                                className="maint-btn-secondary"
                                onClick={() => setResolvingFinding(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="maint-btn-primary"
                                onClick={() => handleUpdateStatus(resolvingFinding.id, 'resolved', resolutionNotes)}
                            >
                                Confirm Resolution
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TestMaintenanceIntelligencePage;

