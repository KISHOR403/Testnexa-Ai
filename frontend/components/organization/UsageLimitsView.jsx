import React, { useState, useEffect } from 'react';
import {
    Gauge, AlertTriangle, AlertCircle, CheckCircle, RefreshCw,
    TrendingUp, Database, Cpu, PlaySquare, Workflow, Users,
    Layers, ArrowUpRight, Clock, ShieldAlert, Sparkles, Filter
} from 'lucide-react';
import { organizationService } from '../../services/organizationService';

/**
 * Format bytes into human-readable size
 */
const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
        return `${mb.toFixed(1)} MB`;
    }
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
};

/**
 * Metric icon mapping
 */
const getMetricIcon = (metric) => {
    switch (metric) {
        case 'ai.generations':
            return <Sparkles size={18} className="usage-metric-icon--ai" />;
        case 'ai.failure_analysis':
            return <Cpu size={18} className="usage-metric-icon--ai" />;
        case 'execution.manual':
            return <PlaySquare size={18} className="usage-metric-icon--test" />;
        case 'execution.automated':
            return <Workflow size={18} className="usage-metric-icon--test" />;
        case 'execution.cicd':
            return <TrendingUp size={18} className="usage-metric-icon--test" />;
        case 'members.active':
            return <Users size={18} className="usage-metric-icon--org" />;
        case 'workspaces.active':
            return <Layers size={18} className="usage-metric-icon--org" />;
        case 'storage.bytes':
            return <Database size={18} className="usage-metric-icon--storage" />;
        default:
            return <Gauge size={18} />;
    }
};

/**
 * Standard metric definitions for fallback & display guarantees
 */
const DEFAULT_METRIC_ENTRIES = {
    'ai.generations': { metric: 'ai.generations', name: 'AI Test Generations', category: 'AI', unit: 'count', allowance: 20, used: 0, remaining: 20, percentage: 0 },
    'ai.failure_analysis': { metric: 'ai.failure_analysis', name: 'AI Failure Analyses', category: 'AI', unit: 'count', allowance: 10, used: 0, remaining: 10, percentage: 0 },
    'execution.manual': { metric: 'execution.manual', name: 'Manual Test Executions', category: 'Testing', unit: 'count', allowance: 50, used: 0, remaining: 50, percentage: 0 },
    'execution.automated': { metric: 'execution.automated', name: 'Automated Playwright Executions', category: 'Testing', unit: 'count', allowance: 20, used: 0, remaining: 20, percentage: 0 },
    'execution.cicd': { metric: 'execution.cicd', name: 'CI/CD Pipeline Executions', category: 'Testing', unit: 'count', allowance: 10, used: 0, remaining: 10, percentage: 0 },
    'members.active': { metric: 'members.active', name: 'Active Team Members', category: 'Organization', unit: 'count', allowance: 1, used: 1, remaining: 0, percentage: 100 },
    'workspaces.active': { metric: 'workspaces.active', name: 'Active Workspaces', category: 'Organization', unit: 'count', allowance: 1, used: 1, remaining: 0, percentage: 100 },
    'storage.bytes': { metric: 'storage.bytes', name: 'Artifact Storage', category: 'Storage', unit: 'bytes', allowance: 1073741824, used: 0, remaining: 1073741824, percentage: 0 }
};

export const UsageLimitsView = ({ activeOrg, onUpgradeClick }) => {
    const [usageData, setUsageData] = useState(null);
    const [historyEvents, setHistoryEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [historyFilter, setHistoryFilter] = useState('all');
    const [resolvedOrg, setResolvedOrg] = useState(activeOrg);

    useEffect(() => {
        if (activeOrg?.id) {
            setResolvedOrg(activeOrg);
            loadUsageData(activeOrg.id);
        } else {
            resolveFallbackOrg();
        }
    }, [activeOrg?.id]);

    const resolveFallbackOrg = async () => {
        setIsLoading(true);
        setError('');
        try {
            const res = await organizationService.getUserOrganizations();
            const orgs = res.data || [];
            if (orgs.length > 0) {
                const target = orgs[0];
                setResolvedOrg(target);
                await loadUsageData(target.id);
            } else {
                setIsLoading(false);
            }
        } catch (err) {
            setError(err.message || 'Unable to connect to organization service');
            setIsLoading(false);
        }
    };

    const loadUsageData = async (orgId = null, refresh = false) => {
        const targetId = orgId || resolvedOrg?.id || activeOrg?.id;
        if (!targetId) {
            setIsLoading(false);
            return;
        }

        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        setError('');

        try {
            const [usageRes, historyRes] = await Promise.all([
                organizationService.getUsage(targetId),
                organizationService.getUsageHistory(targetId, { limit: 20 })
            ]);

            if (usageRes?.success) {
                setUsageData(usageRes.data);
            }
            if (historyRes?.success) {
                setHistoryEvents(historyRes.data || []);
            }
        } catch (err) {
            setError(err.message || 'Failed to load usage information');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="org-card usage-limits-loading">
                <div className="usage-skeleton-header">
                    <div className="skeleton-bar" style={{ width: '220px', height: '24px' }} />
                    <div className="skeleton-bar" style={{ width: '120px', height: '36px' }} />
                </div>
                <div className="usage-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="usage-metric-card skeleton-card">
                            <div className="skeleton-bar" style={{ width: '60%', height: '18px', marginBottom: '12px' }} />
                            <div className="skeleton-bar" style={{ width: '100%', height: '8px', marginBottom: '12px' }} />
                            <div className="skeleton-bar" style={{ width: '40%', height: '14px' }} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!usageData && !isLoading) {
        return (
            <div className="org-card usage-history-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                <AlertCircle size={36} style={{ color: '#F59E0B', margin: '0 auto 1rem auto' }} />
                <h3 className="org-card__title" style={{ marginBottom: '0.5rem' }}>Usage Information Unavailable</h3>
                <p className="org-card__subtitle" style={{ maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
                    {error || 'Unable to retrieve usage quotas for the active organization. Please verify your connection or try again.'}
                </p>
                <button
                    className="org-btn org-btn--primary"
                    onClick={() => resolveFallbackOrg()}
                >
                    <RefreshCw size={14} />
                    Retry Connection
                </button>
            </div>
        );
    }

    const currentOrg = resolvedOrg || activeOrg;
    const plan = (usageData?.plan || currentOrg?.plan || 'free').toUpperCase();
    const billingPeriod = usageData?.billingPeriod;
    const warnings = usageData?.warnings || [];
    const serverMetrics = usageData?.metrics || {};
    const metrics = { ...DEFAULT_METRIC_ENTRIES, ...serverMetrics };

    const filteredHistory = historyEvents.filter(evt => {
        if (historyFilter === 'all') return true;
        return evt.metric === historyFilter;
    });

    return (
        <div className="usage-limits-container">
            {/* Header overview card */}
            <div className="org-card usage-header-card">
                <div className="usage-header-card__top">
                    <div className="usage-header-card__info">
                        <div className="usage-plan-badge-wrapper">
                            <span className={`usage-plan-badge usage-plan-badge--${plan.toLowerCase()}`}>
                                {plan} PLAN
                            </span>
                            <span className="usage-interval-pill">
                                {usageData?.billingInterval === 'yearly' ? 'Annual Billing' : 'Monthly Cycle'}
                            </span>
                        </div>
                        <h2 className="usage-header-title">Usage & Quotas Management</h2>
                        <p className="usage-header-subtitle">
                            Monitor metered consumption, enforce plan allowances, and ensure continuous testing capacity.
                        </p>
                    </div>

                    <div className="usage-header-actions">
                        <button
                            className="org-btn org-btn--secondary"
                            onClick={() => loadUsageData(null, true)}
                            disabled={isRefreshing}
                            title="Refresh usage statistics"
                        >
                            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
                            Refresh
                        </button>
                        <button
                            className="org-btn org-btn--primary usage-upgrade-btn"
                            onClick={onUpgradeClick}
                        >
                            <ArrowUpRight size={14} />
                            Upgrade Plan
                        </button>
                    </div>
                </div>

                {/* Billing cycle & reset timeline bar */}
                {billingPeriod && (
                    <div className="usage-cycle-bar">
                        <div className="usage-cycle-item">
                            <Clock size={15} className="usage-cycle-icon" />
                            <span className="usage-cycle-label">Billing Cycle:</span>
                            <span className="usage-cycle-value">
                                {new Date(billingPeriod.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                {' — '}
                                {new Date(billingPeriod.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>

                        <div className="usage-cycle-item">
                            <span className="usage-cycle-label">Reset In:</span>
                            <span className="usage-cycle-badge">
                                {billingPeriod.daysRemaining} {billingPeriod.daysRemaining === 1 ? 'day' : 'days'}
                            </span>
                            <span className="usage-cycle-subtext">
                                (Resets {new Date(billingPeriod.resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Error notice if present */}
            {error && (
                <div className="org-banner org-banner--error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* Quota threshold warning banners */}
            {warnings.length > 0 && (
                <div className="usage-warnings-stack">
                    {warnings.map((w, idx) => {
                        const isCritical = w.threshold >= 90;
                        return (
                            <div
                                key={idx}
                                className={`usage-warning-banner ${isCritical ? 'usage-warning-banner--critical' : 'usage-warning-banner--warning'}`}
                            >
                                <div className="usage-warning-banner__icon">
                                    {isCritical ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
                                </div>
                                <div className="usage-warning-banner__body">
                                    <strong>{w.name}: </strong>
                                    <span>
                                        {w.threshold >= 100
                                            ? `Quota completely exhausted (${w.used}/${w.allowance}). Further operations will be blocked until next cycle or plan upgrade.`
                                            : `Organization has reached ${w.threshold}% of allocated capacity (${w.used}/${w.allowance}).`}
                                    </span>
                                </div>
                                <button className="org-btn org-btn--sm usage-warning-btn" onClick={onUpgradeClick}>
                                    Unlock Capacity
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Metered metrics grid */}
            <div className="usage-grid">
                {Object.values(metrics).map((m) => {
                    const isStorage = m.unit === 'bytes';
                    const usedText = isStorage ? formatBytes(m.used) : m.used.toLocaleString();
                    const allowanceText = isStorage ? formatBytes(m.allowance) : m.allowance.toLocaleString();
                    const remainingText = isStorage ? formatBytes(m.remaining) : m.remaining.toLocaleString();

                    let statusClass = 'usage-bar--normal';
                    if (m.percentage >= 90) statusClass = 'usage-bar--danger';
                    else if (m.percentage >= 75) statusClass = 'usage-bar--warning';

                    return (
                        <div key={m.metric} className="usage-metric-card">
                            <div className="usage-metric-card__header">
                                <div className="usage-metric-card__title-row">
                                    <span className="usage-metric-icon-wrap">
                                        {getMetricIcon(m.metric)}
                                    </span>
                                    <div>
                                        <h4 className="usage-metric-card__title">{m.name}</h4>
                                        <span className="usage-category-pill">{m.category}</span>
                                    </div>
                                </div>
                                <span className={`usage-metric-percentage ${m.percentage >= 90 ? 'danger' : m.percentage >= 75 ? 'warning' : ''}`}>
                                    {m.percentage}%
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="usage-bar-track">
                                <div
                                    className={`usage-bar-fill ${statusClass}`}
                                    style={{ width: `${Math.min(100, m.percentage)}%` }}
                                />
                            </div>

                            <div className="usage-metric-card__stats">
                                <div className="usage-stat-col">
                                    <span className="usage-stat-label">Consumed</span>
                                    <span className="usage-stat-value">{usedText}</span>
                                </div>
                                <div className="usage-stat-col">
                                    <span className="usage-stat-label">Remaining</span>
                                    <span className="usage-stat-value">{remainingText}</span>
                                </div>
                                <div className="usage-stat-col" style={{ textAlign: 'right' }}>
                                    <span className="usage-stat-label">Limit</span>
                                    <span className="usage-stat-value">{allowanceText}</span>
                                </div>
                            </div>

                            {m.reserved > 0 && (
                                <div className="usage-metric-reserved-pill">
                                    <span>+{m.reserved} currently reserved in flight</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Granular Usage Event Log */}
            <div className="org-card usage-history-card">
                <div className="usage-history-card__header">
                    <div>
                        <h3 className="org-card__title">Recent Metered Usage Events</h3>
                        <p className="org-card__subtitle">
                            Authoritative server-side events committed toward this organization's active billing cycle.
                        </p>
                    </div>

                    <div className="usage-history-filter">
                        <Filter size={14} />
                        <select
                            value={historyFilter}
                            onChange={(e) => setHistoryFilter(e.target.value)}
                            className="org-select org-select--sm"
                        >
                            <option value="all">All Metrics</option>
                            <option value="ai.generations">AI Test Generations</option>
                            <option value="ai.failure_analysis">AI Failure Analyses</option>
                            <option value="execution.manual">Manual Executions</option>
                            <option value="execution.automated">Automated Runs</option>
                            <option value="execution.cicd">CI/CD Pipeline Runs</option>
                        </select>
                    </div>
                </div>

                {filteredHistory.length === 0 ? (
                    <div className="usage-empty-history">
                        <CheckCircle size={32} className="usage-empty-icon" />
                        <p>No usage events recorded for this selection.</p>
                        <span className="usage-empty-subtext">Events are metered automatically upon operation execution.</span>
                    </div>
                ) : (
                    <div className="org-table-wrapper">
                        <table className="org-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Metric</th>
                                    <th>Quantity</th>
                                    <th>Operation / Resource</th>
                                    <th>Source</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistory.map((evt) => (
                                    <tr key={evt.id}>
                                        <td className="usage-table-time">
                                            {new Date(evt.timestamp).toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td>
                                            <span className="usage-metric-table-badge">
                                                {metrics[evt.metric]?.name || evt.metric}
                                            </span>
                                        </td>
                                        <td className="usage-table-qty">
                                            +{evt.quantity} {evt.unit}
                                        </td>
                                        <td className="usage-table-op">
                                            <code>{evt.operationId || evt.resourceType || '—'}</code>
                                        </td>
                                        <td>{evt.source || 'Web App'}</td>
                                        <td>
                                            <span className="usage-status-pill committed">Committed</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

