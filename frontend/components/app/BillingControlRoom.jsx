import React, { useState, useEffect, useCallback, useId } from 'react';
import {
    ShieldCheck, Check, AlertCircle, Loader2, ArrowRight,
    RotateCcw, Download, X, HelpCircle, ExternalLink,
    Zap, Award, Users, Building2, CheckCircle2, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import billingService from '../../services/billingService';
import '../../styles/app/BillingControlRoom.css';

/* ─────────────────────────────────────────────────────────────
   Technical Specification Matrix Data (Capabilities Catalog)
   ───────────────────────────────────────────────────────────── */
const SPEC_GROUPS = [
    {
        id: 'capacity',
        label: '01 // Generation Capacity',
        rows: [
            {
                name: 'Monthly suite allocation',
                desc: 'Full test suites generated per 30-day billing cycle',
                free: '50 suites / mo',
                pro: '500 suites / mo',
                team: '2,000 suites / mo',
                enterprise: 'Unlimited (Fair-use)'
            },
            {
                name: 'Daily execution burst',
                desc: 'Maximum suite generation requests in 24 hours',
                free: '10 suites / day',
                pro: '50 suites / day',
                team: '200 suites / day',
                enterprise: 'Uncapped rate'
            },
            {
                name: 'AI Model architecture',
                desc: 'Underlying foundation model routing',
                free: 'Gemini 2.5 Flash',
                pro: 'Gemini 2.5 Flash + Pro',
                team: 'Gemini 2.5 Flash + Pro (Dual)',
                enterprise: 'Custom fine-tuned weights'
            },
            {
                name: 'Test cases per suite',
                desc: 'Depth and breadth of synthesized scenarios',
                free: 'Up to 25 cases',
                pro: 'Up to 75 cases',
                team: 'Up to 150 cases',
                enterprise: 'Unconstrained'
            }
        ]
    },
    {
        id: 'coverage',
        label: '02 // Coverage Depth & Scenario Types',
        rows: [
            {
                name: 'Functional & Negative paths',
                desc: 'Core user flows and error state validation',
                free: 'Included',
                pro: 'Included',
                team: 'Included',
                enterprise: 'Included'
            },
            {
                name: 'Edge & Boundary analysis',
                desc: 'Corner cases, null inputs, and partition testing',
                free: 'Standard',
                pro: 'Deep boundary matrices',
                team: 'Exhaustive combinatorial',
                enterprise: 'Autonomous boundary fuzzing'
            },
            {
                name: 'Security & Auth permutations',
                desc: 'OWASP Top 10, SQLi, XSS, and session fuzzing',
                free: 'Baseline auth checks',
                pro: 'OWASP Top 10 + 3DS flows',
                team: 'Full SecOps & Penetration',
                enterprise: 'Custom vulnerability suites'
            },
            {
                name: 'Feasibility scoring (SDET)',
                desc: 'Automated testability and automation ROI rating',
                free: '—',
                pro: 'Automated SDET Scoring',
                team: 'Automated SDET Scoring',
                enterprise: 'Custom framework scoring'
            }
        ]
    },
    {
        id: 'integration',
        label: '03 // Export & TMS Integrations',
        rows: [
            {
                name: 'File export formats',
                desc: 'Direct artifact compilation and downloads',
                free: 'JSON only',
                pro: 'JSON, Markdown, CSV',
                team: 'JSON, Markdown, CSV',
                enterprise: 'All formats + Custom schemas'
            },
            {
                name: 'TMS push (TestRail / Zephyr)',
                desc: 'One-click publish to test management systems',
                free: '—',
                pro: 'Direct one-click export',
                team: 'Direct one-click export',
                enterprise: 'Bidirectional synchronization'
            },
            {
                name: 'Jira & Azure DevOps sync',
                desc: 'Issue tracker and ticket requirement mapping',
                free: '—',
                pro: '—',
                team: 'Bidirectional sync',
                enterprise: 'Enterprise webhook hooks'
            },
            {
                name: 'Programmatic API quota',
                desc: 'REST API keys for CI/CD pipeline automation',
                free: '—',
                pro: '500 calls / mo',
                team: '5,000 calls / mo',
                enterprise: 'Dedicated throughput'
            }
        ]
    },
    {
        id: 'collaboration',
        label: '04 // Seats & Collaboration',
        rows: [
            {
                name: 'Included team seats',
                desc: 'Active engineer accounts with full permissions',
                free: '1 seat',
                pro: '1 seat',
                team: '5 seats included',
                enterprise: 'Custom (20+ seats)'
            },
            {
                name: 'Workspace tenancy',
                desc: 'Multi-tenant organization boundary isolation',
                free: 'Personal workspace',
                pro: 'Personal workspace',
                team: 'Shared team workspace',
                enterprise: 'Multi-team cluster'
            },
            {
                name: 'Role-based access control',
                desc: 'Granular owner, admin, engineer, and viewer roles',
                free: 'Owner only',
                pro: 'Owner only',
                team: 'Owner, Admin, Member, Viewer',
                enterprise: 'Custom IAM roles & SAML'
            }
        ]
    },
    {
        id: 'security',
        label: '05 // Security & Infrastructure',
        rows: [
            {
                name: 'SSRF target protection',
                desc: 'Server-side request forgery filtering on base URLs',
                free: 'Enforced',
                pro: 'Enforced',
                team: 'Enforced',
                enterprise: 'Enforced + VPC allowlist'
            },
            {
                name: 'Audit logging retention',
                desc: 'Immutable log of workspace mutations & logins',
                free: '7-day retention',
                pro: '30-day retention',
                team: '90-day retention',
                enterprise: '1-year tamper-evident log'
            },
            {
                name: 'SLA & Support commitment',
                desc: 'Response turnaround and technical support tier',
                free: 'Community forum',
                pro: 'Priority email (24h SLA)',
                team: 'Dedicated Slack (4h SLA)',
                enterprise: '99.9% Uptime + Dedicated TAM'
            }
        ]
    }
];

const PLAN_META = {
    free: {
        name: 'Free Developer',
        desc: 'Individual QA engineer tier with baseline monthly AI test suite generation capacity and standard exports.',
        monthlyPrice: '$0',
        annualPrice: '$0',
        periodSuffix: '/ month',
        annualSuffix: '/ month, billed $0'
    },
    pro: {
        name: 'Pro Platform',
        desc: 'Engineered for dedicated SDETs and solo QA leads requiring high-throughput generation and multi-format exports.',
        monthlyPrice: '$29',
        annualPrice: '$24',
        periodSuffix: '/ month',
        annualSuffix: '/ month, billed $288 / yr'
    },
    team: {
        name: 'Team Architecture',
        desc: 'Purpose-built for QA squads and engineering organizations sharing test suites, environments, and TMS integrations.',
        monthlyPrice: '$99',
        annualPrice: '$79',
        periodSuffix: '/ month',
        annualSuffix: '/ month, billed $948 / yr'
    },
    enterprise: {
        name: 'Enterprise Scale',
        desc: 'Custom infrastructure for large engineering departments requiring fine-tuned AI models, SAML SSO, and dedicated SLAs.',
        monthlyPrice: 'Custom',
        annualPrice: 'Custom',
        periodSuffix: 'quote',
        annualSuffix: 'annual agreement'
    }
};

export const BillingControlRoom = () => {
    const { user, currentWorkspace } = useAuth();
    const [billing, setBilling] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'
    const [confirmModalPlan, setConfirmModalPlan] = useState(null); // planId to switch to
    const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
    const [actionFeedback, setActionFeedback] = useState(null);
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactNotes, setContactNotes] = useState('');
    const [contactSent, setContactSent] = useState(false);
    const [mobileSelectedPlan, setMobileSelectedPlan] = useState('pro');

    // Fetch real billing data from backend
    const loadBillingData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await billingService.getBilling(currentWorkspace?.id || 'current');
            setBilling(data);
            if (data?.billingInterval) {
                setBillingCycle(data.billingInterval);
            }
            if (data?.plan) {
                setMobileSelectedPlan(data.plan.toLowerCase());
            }
        } catch (err) {
            console.error('Failed to load billing metrics:', err);
            setError(err.message || 'Unable to connect to billing telemetry.');
        } finally {
            setIsLoading(false);
        }
    }, [currentWorkspace]);

    useEffect(() => {
        loadBillingData();
    }, [loadBillingData]);

    const activePlanId = (billing?.plan || 'free').toLowerCase();
    const currentPlanDetails = PLAN_META[activePlanId] || PLAN_META.free;

    // Real usage figures
    const usedGenerations = billing?.usedGenerations || 0;
    const quota = billing?.quota || 50;
    const remainingGenerations = billing?.remainingGenerations ?? Math.max(0, quota - usedGenerations);
    const usagePercent = billing?.usagePercent ?? Math.min(100, Math.round((usedGenerations / quota) * 100));
    const daysRemaining = billing?.daysRemaining || 30;

    // Reset date format
    const formattedResetDate = billing?.currentPeriodEnd
        ? new Date(billing.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Next billing cycle';

    // Handle plan switch execution
    const handleExecutePlanChange = async () => {
        if (!confirmModalPlan || isSubmittingPlan) return;
        setIsSubmittingPlan(true);
        setActionFeedback(null);
        try {
            const res = await billingService.updatePlan(currentWorkspace?.id || 'current', {
                plan: confirmModalPlan,
                interval: billingCycle
            });
            if (res.success && res.billing) {
                setBilling(res.billing);
                setActionFeedback({
                    type: 'success',
                    message: `Subscription successfully updated to ${PLAN_META[confirmModalPlan]?.name} (${billingCycle}).`
                });
                setConfirmModalPlan(null);
                setTimeout(() => setActionFeedback(null), 5000);
            }
        } catch (err) {
            setActionFeedback({
                type: 'error',
                message: err.message || 'Failed to update subscription tier.'
            });
        } finally {
            setIsSubmittingPlan(false);
        }
    };

    // Scroll smoothly to comparison canvas
    const handleScrollToCanvas = () => {
        const el = document.getElementById('bcr-spec-canvas');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    // Loading State
    if (isLoading && !billing) {
        return (
            <div className="bcr-container" style={{ padding: '2.5rem 0', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#8BAF9A' }}>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Synchronizing subscription telemetry & quota records…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bcr-container" id="bcr-container">
            {/* Feedback Notifications */}
            {actionFeedback && (
                <div
                    className={`app-settings-feedback ${actionFeedback.type}`}
                    role="status"
                    style={{ animation: 'tnModalFade 0.15s ease-out' }}
                >
                    {actionFeedback.type === 'success' ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> : <AlertCircle size={16} style={{ flexShrink: 0 }} />}
                    <span>{actionFeedback.message}</span>
                </div>
            )}

            {error && (
                <div className="app-settings-feedback error" role="alert">
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span>{error}</span>
                        <button
                            type="button"
                            className="app-settings-btn app-settings-btn--secondary"
                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.74rem' }}
                            onClick={loadBillingData}
                        >
                            <RefreshCw size={12} />
                            <span>Retry</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════ A. COMPACT BILLING HEADER ══════════════ */}
            <header className="bcr-header">
                <div>
                    <div className="bcr-header__kicker">
                        <span style={{ color: '#6E7571' }}>ACCOUNT /</span>
                        <span>BILLING & TELEMETRY</span>
                    </div>
                    <h2 className="bcr-header__title">Subscription & usage</h2>
                    <p className="bcr-header__desc">
                        Real-time capacity allocation, metered test execution limits, and workspace subscription lifecycle.
                    </p>
                </div>

                <div className="bcr-header__telemetry" aria-label="Subscription Telemetry Status">
                    <div className="bcr-telemetry-tag active">
                        <span className="bcr-telemetry-dot" />
                        <span>STATUS: ACTIVE</span>
                    </div>
                    <div className="bcr-telemetry-tag">
                        <span>CYCLE: {billingCycle.toUpperCase()}</span>
                    </div>
                    <div className="bcr-telemetry-tag">
                        <span>RESETS IN {daysRemaining}D</span>
                    </div>
                </div>
            </header>

            {/* ══════════════ B. CURRENT PLAN VISUAL ANCHOR ══════════════ */}
            <section className="bcr-anchor" aria-label="Current Subscription Instrument">
                {/* Left Side: Plan Identity */}
                <div className="bcr-anchor__left">
                    <div>
                        <span className="bcr-anchor__subkicker">CURRENT PLAN</span>
                        <div className="bcr-anchor__plan-name">
                            <span>{currentPlanDetails.name}</span>
                        </div>
                        <p className="bcr-anchor__plan-desc">{currentPlanDetails.desc}</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div className="bcr-anchor__meta-row">
                            <span style={{ color: '#8BAF9A', fontWeight: 600 }}>Active</span>
                            <span>•</span>
                            <span>{billingCycle === 'annual' ? 'Annual commitment' : 'Monthly billing'}</span>
                            <span>•</span>
                            <span>{activePlanId === 'free' ? 'Zero commercial balance' : 'Standard invoice'}</span>
                        </div>

                        <button
                            type="button"
                            className="bcr-plan-btn secondary"
                            style={{ width: 'auto', padding: '0.4rem 0.85rem' }}
                            onClick={handleScrollToCanvas}
                        >
                            <span>Inspect All Tiers</span>
                            <ArrowRight size={13} />
                        </button>
                    </div>
                </div>

                {/* Vertical Divider */}
                <div className="bcr-anchor__divider" aria-hidden="true" />

                {/* Right Side: Usage Instrument */}
                <div className="bcr-anchor__right">
                    <div>
                        <div className="bcr-anchor__usage-header">
                            <span className="bcr-anchor__subkicker">CAPACITY UTILIZATION</span>
                            <div className="bcr-anchor__usage-figure">
                                {usedGenerations} <span>/ {quota >= 10000 ? 'UNLIMITED' : `${quota}`}</span>
                            </div>
                        </div>

                        <div className="bcr-track" role="progressbar" aria-valuenow={usedGenerations} aria-valuemin={0} aria-valuemax={quota}>
                            <div
                                className={`bcr-track__fill ${usagePercent >= 90 ? 'danger' : usagePercent >= 75 ? 'warning' : ''}`}
                                style={{ width: `${Math.min(100, usagePercent)}%` }}
                            />
                        </div>

                        <div className="bcr-anchor__usage-meta">
                            <span>{remainingGenerations} generation cycles remaining</span>
                            <span className="bcr-anchor__usage-percent">{usagePercent}% ALLOCATED</span>
                        </div>
                    </div>

                    <div className="bcr-anchor__reset-note">
                        Current monthly billing period resets on <strong>{formattedResetDate}</strong> at 00:00 UTC.
                    </div>
                </div>
            </section>

            {/* ══════════════ C. VISUAL DATA STRIP ══════════════ */}
            <section className="bcr-data-strip" aria-label="Metered Resource Strip">
                <div className="bcr-data-metric">
                    <span className="bcr-data-metric__label">Test suite generations</span>
                    <span className="bcr-data-metric__value">{usedGenerations}</span>
                    <span className="bcr-data-metric__sub">Cycles this period</span>
                </div>

                <div className="bcr-data-metric">
                    <span className="bcr-data-metric__label">Monthly allowance</span>
                    <span className="bcr-data-metric__value">{quota >= 10000 ? 'Fair-use' : `${quota}`}</span>
                    <span className="bcr-data-metric__sub">Suites per period</span>
                </div>

                <div className="bcr-data-metric">
                    <span className="bcr-data-metric__label">Remaining capacity</span>
                    <span className="bcr-data-metric__value" style={{ color: remainingGenerations === 0 ? '#E06C75' : '#8BAF9A' }}>
                        {remainingGenerations}
                    </span>
                    <span className="bcr-data-metric__sub">Available cycles</span>
                </div>

                <div className="bcr-data-metric">
                    <span className="bcr-data-metric__label">Next reset</span>
                    <span className="bcr-data-metric__value">{daysRemaining}d</span>
                    <span className="bcr-data-metric__sub">{formattedResetDate}</span>
                </div>

                <div className="bcr-data-metric">
                    <span className="bcr-data-metric__label">Additional metered features</span>
                    <span className="bcr-data-metric__value">{billing?.activeSeats || 1} / {billing?.seatsLimit || 1}</span>
                    <span className="bcr-data-metric__sub">Seats & {billing?.meteredMetrics?.activeEnvironments || 0} envs</span>
                </div>
            </section>

            {/* ══════════════ D. PLAN COMPARISON CANVAS ══════════════ */}
            <section className="bcr-spec-canvas" id="bcr-spec-canvas" aria-label="Plan Capability Canvas">
                <div className="bcr-spec-canvas__header">
                    <div className="bcr-spec-canvas__title-wrap">
                        <h3 className="bcr-spec-canvas__title">Technical Specification & Entitlements</h3>
                        <p className="bcr-spec-canvas__subtitle">
                            Direct capacity thresholds, coverage algorithms, export channels, and access boundaries.
                        </p>
                    </div>

                    {/* E. Compact Understated Segmented Period Control */}
                    <div className="bcr-period-toggle" role="radiogroup" aria-label="Billing Cadence">
                        <button
                            type="button"
                            role="radio"
                            aria-checked={billingCycle === 'monthly'}
                            className={`bcr-period-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
                            onClick={() => setBillingCycle('monthly')}
                        >
                            Monthly
                        </button>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={billingCycle === 'annual'}
                            className={`bcr-period-btn ${billingCycle === 'annual' ? 'active' : ''}`}
                            onClick={() => setBillingCycle('annual')}
                        >
                            <span>Annual</span>
                            <span className="bcr-period-save-pill">Save 20%</span>
                        </button>
                    </div>
                </div>

                {/* Specification Table */}
                <div className="bcr-spec-table-wrap">
                    <table className="bcr-spec-table">
                        <thead>
                            <tr>
                                <th className="col-feature">
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#6E7571', textTransform: 'uppercase' }}>
                                        Capability Matrix
                                    </span>
                                </th>

                                {/* Free Tier Column */}
                                <th className={`col-plan ${activePlanId === 'free' ? 'is-current-plan' : ''}`}>
                                    <div className="bcr-plan-header__name">
                                        <span>Free Developer</span>
                                        {activePlanId === 'free' && <span className="bcr-plan-header__badge">Current</span>}
                                    </div>
                                    <div className="bcr-plan-header__price">
                                        $0 <span>/ mo</span>
                                    </div>
                                    <div className="bcr-plan-header__term">Billed $0 / year</div>
                                </th>

                                {/* Pro Tier Column */}
                                <th className={`col-plan ${activePlanId === 'pro' ? 'is-current-plan' : ''}`}>
                                    <div className="bcr-plan-header__name">
                                        <span>Pro Platform</span>
                                        {activePlanId === 'pro' && <span className="bcr-plan-header__badge">Current</span>}
                                    </div>
                                    <div className="bcr-plan-header__price">
                                        {billingCycle === 'annual' ? '$24' : '$29'} <span>/ mo</span>
                                    </div>
                                    <div className="bcr-plan-header__term">
                                        {billingCycle === 'annual' ? 'Billed $288 / year' : 'Billed monthly'}
                                    </div>
                                </th>

                                {/* Team Tier Column */}
                                <th className={`col-plan ${activePlanId === 'team' ? 'is-current-plan' : ''}`}>
                                    <div className="bcr-plan-header__name">
                                        <span>Team Architecture</span>
                                        {activePlanId === 'team' && <span className="bcr-plan-header__badge">Current</span>}
                                    </div>
                                    <div className="bcr-plan-header__price">
                                        {billingCycle === 'annual' ? '$79' : '$99'} <span>/ mo</span>
                                    </div>
                                    <div className="bcr-plan-header__term">
                                        {billingCycle === 'annual' ? 'Billed $948 / year' : 'Billed monthly'}
                                    </div>
                                </th>

                                {/* Enterprise Column */}
                                <th className={`col-plan ${activePlanId === 'enterprise' ? 'is-current-plan' : ''}`}>
                                    <div className="bcr-plan-header__name">
                                        <span>Enterprise Scale</span>
                                        {activePlanId === 'enterprise' && <span className="bcr-plan-header__badge">Current</span>}
                                    </div>
                                    <div className="bcr-plan-header__price">
                                        Custom
                                    </div>
                                    <div className="bcr-plan-header__term">Annual contract</div>
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {SPEC_GROUPS.map((group) => (
                                <React.Fragment key={group.id}>
                                    <tr className="bcr-spec-group-row">
                                        <td colSpan={5}>{group.label}</td>
                                    </tr>
                                    {group.rows.map((row, idx) => (
                                        <tr key={idx} className="bcr-spec-row">
                                            <td>
                                                <div className="bcr-feature-label">{row.name}</div>
                                                <div className="bcr-feature-desc">{row.desc}</div>
                                            </td>
                                            <td className={`bcr-val-cell ${activePlanId === 'free' ? 'is-current-plan' : ''}`}>
                                                {row.free}
                                            </td>
                                            <td className={`bcr-val-cell ${activePlanId === 'pro' ? 'is-current-plan highlight' : ''}`}>
                                                {row.pro}
                                            </td>
                                            <td className={`bcr-val-cell ${activePlanId === 'team' ? 'is-current-plan highlight' : ''}`}>
                                                {row.team}
                                            </td>
                                            <td className={`bcr-val-cell ${activePlanId === 'enterprise' ? 'is-current-plan' : ''}`}>
                                                {row.enterprise}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>

                        <tfoot>
                            <tr>
                                <td>
                                    <span style={{ fontSize: '0.72rem', color: '#6E7571' }}>
                                        Immediate activation on tier change
                                    </span>
                                </td>

                                {/* Free Action */}
                                <td className={activePlanId === 'free' ? 'is-current-plan' : ''}>
                                    {activePlanId === 'free' ? (
                                        <button type="button" className="bcr-plan-btn current" disabled>
                                            <Check size={13} />
                                            <span>Current Tier</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="bcr-plan-btn secondary"
                                            onClick={() => setConfirmModalPlan('free')}
                                        >
                                            <span>Downgrade to Free</span>
                                        </button>
                                    )}
                                </td>

                                {/* Pro Action */}
                                <td className={activePlanId === 'pro' ? 'is-current-plan' : ''}>
                                    {activePlanId === 'pro' ? (
                                        <button type="button" className="bcr-plan-btn current" disabled>
                                            <Check size={13} />
                                            <span>Current Tier</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="bcr-plan-btn primary"
                                            onClick={() => setConfirmModalPlan('pro')}
                                        >
                                            <span>{activePlanId === 'free' ? 'Upgrade to Pro' : 'Switch to Pro'}</span>
                                        </button>
                                    )}
                                </td>

                                {/* Team Action */}
                                <td className={activePlanId === 'team' ? 'is-current-plan' : ''}>
                                    {activePlanId === 'team' ? (
                                        <button type="button" className="bcr-plan-btn current" disabled>
                                            <Check size={13} />
                                            <span>Current Tier</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="bcr-plan-btn primary"
                                            onClick={() => setConfirmModalPlan('team')}
                                        >
                                            <span>Upgrade to Team</span>
                                        </button>
                                    )}
                                </td>

                                {/* Enterprise Action */}
                                <td className={activePlanId === 'enterprise' ? 'is-current-plan' : ''}>
                                    {activePlanId === 'enterprise' ? (
                                        <button type="button" className="bcr-plan-btn current" disabled>
                                            <Check size={13} />
                                            <span>Current Tier</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="bcr-plan-btn secondary"
                                            onClick={() => setShowContactModal(true)}
                                        >
                                            <span>Contact Engineering Sales</span>
                                        </button>
                                    )}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Mobile Plan Comparison Canvas (Screen width <= 768px) */}
                <div className="bcr-spec-mobile-wrap" aria-label="Mobile Plan Comparison">
                    {/* Segmented plan selection tabs */}
                    <div className="bcr-mobile-plan-tabs" role="tablist" aria-label="Select Plan">
                        {['free', 'pro', 'team', 'enterprise'].map((pKey) => {
                            const pMeta = PLAN_META[pKey];
                            const isCurrent = activePlanId === pKey;
                            const isSelected = mobileSelectedPlan === pKey;
                            return (
                                <button
                                    key={pKey}
                                    type="button"
                                    role="tab"
                                    aria-selected={isSelected}
                                    className={`bcr-mobile-tab-btn ${isSelected ? 'active' : ''} ${isCurrent ? 'is-current' : ''}`}
                                    onClick={() => setMobileSelectedPlan(pKey)}
                                >
                                    <span>{pMeta.name.split(' ')[0]}</span>
                                    {isCurrent && <span className="bcr-mobile-tab-current">Current</span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected Plan Details Card */}
                    <div className="bcr-mobile-plan-card">
                        <div className="bcr-mobile-plan-card__header">
                            <div>
                                <div className="bcr-mobile-plan-card__title">
                                    <span>{PLAN_META[mobileSelectedPlan]?.name}</span>
                                    {activePlanId === mobileSelectedPlan && (
                                        <span className="bcr-plan-header__badge">Current Tier</span>
                                    )}
                                </div>
                                <p className="bcr-mobile-plan-card__desc">
                                    {PLAN_META[mobileSelectedPlan]?.desc}
                                </p>
                            </div>

                            <div className="bcr-mobile-plan-card__pricing">
                                <div className="bcr-plan-header__price">
                                    {mobileSelectedPlan === 'enterprise'
                                        ? 'Custom'
                                        : billingCycle === 'annual'
                                        ? PLAN_META[mobileSelectedPlan]?.annualPrice
                                        : PLAN_META[mobileSelectedPlan]?.monthlyPrice}
                                    {mobileSelectedPlan !== 'enterprise' && <span>/ mo</span>}
                                </div>
                                <div className="bcr-plan-header__term">
                                    {mobileSelectedPlan === 'enterprise'
                                        ? 'Annual contract'
                                        : billingCycle === 'annual'
                                        ? PLAN_META[mobileSelectedPlan]?.annualSuffix
                                        : 'Billed monthly'}
                                </div>
                            </div>

                            {/* Plan Action Button */}
                            <div className="bcr-mobile-plan-card__action">
                                {activePlanId === mobileSelectedPlan ? (
                                    <button type="button" className="bcr-plan-btn current" disabled>
                                        <Check size={14} />
                                        <span>Current Tier</span>
                                    </button>
                                ) : mobileSelectedPlan === 'enterprise' ? (
                                    <button
                                        type="button"
                                        className="bcr-plan-btn secondary"
                                        onClick={() => setShowContactModal(true)}
                                    >
                                        <span>Contact Engineering Sales</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="bcr-plan-btn primary"
                                        onClick={() => setConfirmModalPlan(mobileSelectedPlan)}
                                    >
                                        <span>
                                            {activePlanId === 'free'
                                                ? `Upgrade to ${PLAN_META[mobileSelectedPlan]?.name.split(' ')[0]}`
                                                : `Switch to ${PLAN_META[mobileSelectedPlan]?.name.split(' ')[0]}`}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Capability groups broken down vertically */}
                        <div className="bcr-mobile-plan-specs">
                            {SPEC_GROUPS.map((group) => (
                                <div key={group.id} className="bcr-mobile-group">
                                    <div className="bcr-mobile-group__title">{group.label}</div>
                                    <div className="bcr-mobile-group__rows">
                                        {group.rows.map((row, idx) => (
                                            <div key={idx} className="bcr-mobile-spec-item">
                                                <div className="bcr-mobile-spec-label">
                                                    <span className="bcr-feature-label">{row.name}</span>
                                                    <span className="bcr-feature-desc">{row.desc}</span>
                                                </div>
                                                <div className="bcr-mobile-spec-val">
                                                    {row[mobileSelectedPlan]}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════ F. TRANSACTION LEDGER ══════════════ */}
            <section className="bcr-ledger" aria-label="Transaction Ledger">
                <div className="bcr-ledger__header">
                    <h3 className="bcr-ledger__title">Transaction Ledger & Invoices</h3>
                    <p className="bcr-ledger__subtitle">
                        Cryptographically referenced invoices, credit adjustments, and subscription renewal receipts.
                    </p>
                </div>

                {billing?.invoices && billing.invoices.length > 0 ? (
                    <div className="bcr-ledger-table-wrap">
                        <table className="bcr-ledger-table">
                            <thead>
                                <tr>
                                    <th>Reference ID</th>
                                    <th>Billing Date</th>
                                    <th>Description</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Document</th>
                                </tr>
                            </thead>
                            <tbody>
                                {billing.invoices.map((inv) => (
                                    <tr key={inv.id || inv.reference}>
                                        <td>
                                            <span className="bcr-ref-code">{inv.reference}</span>
                                        </td>
                                        <td style={{ color: '#A0A7A2' }}>
                                            {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{inv.description}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{inv.amount}</td>
                                        <td>
                                            <span className="bcr-status-tag">{inv.status || 'PAID'}</span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                type="button"
                                                className="bcr-plan-btn secondary"
                                                style={{ padding: '0.2rem 0.5rem', minHeight: '26px', fontSize: '0.72rem', display: 'inline-flex', width: 'auto' }}
                                                onClick={() => {
                                                    const content = `TestNexa AI Commercial Receipt\nReference: ${inv.reference}\nDate: ${inv.date}\nAmount: ${inv.amount}\nWorkspace: ${currentWorkspace?.id}\nStatus: ${inv.status || 'PAID'}`;
                                                    const blob = new Blob([content], { type: 'text/plain' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `${inv.reference}.txt`;
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                }}
                                            >
                                                <Download size={11} />
                                                <span>Receipt</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bcr-empty-ledger">
                        <span className="bcr-empty-ledger__code">LEDGER_EMPTY // ZERO_COMMERCIAL_TRANSACTIONS</span>
                        <p className="bcr-empty-ledger__text">
                            No billing transactions on file. The current workspace is operating on the Free developer tier with zero outstanding balance.
                        </p>
                    </div>
                )}

                <div className="bcr-payment-method-note">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ color: '#A0A7A2' }}>Payment Configuration:</span>
                        <span>No credit card attached to this workspace. Payment gateway tokenization is initiated upon activating a paid tier.</span>
                    </div>
                    <span>SSL/TLS 256-bit Encrypted</span>
                </div>
            </section>

            {/* ══════════════ CONFIRMATION MODAL: TIER SWITCH ══════════════ */}
            {confirmModalPlan && (
                <div className="bcr-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-plan-title">
                    <div className="bcr-modal-dialog">
                        <div className="bcr-modal-header">
                            <h4 id="modal-plan-title" className="bcr-modal-title">Confirm Plan Adjustment</h4>
                            <button
                                type="button"
                                className="bcr-modal-close"
                                onClick={() => setConfirmModalPlan(null)}
                                disabled={isSubmittingPlan}
                                aria-label="Close modal"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        <div className="bcr-modal-body">
                            <p style={{ margin: 0 }}>
                                You are adjusting the subscription tier for workspace <strong>{currentWorkspace?.name || 'Personal'}</strong> to <strong>{PLAN_META[confirmModalPlan]?.name}</strong> on a <strong>{billingCycle}</strong> cadence.
                            </p>

                            <div className="bcr-modal-spec-box">
                                <div className="bcr-modal-spec-row">
                                    <span>Target Tier</span>
                                    <span>{PLAN_META[confirmModalPlan]?.name}</span>
                                </div>
                                <div className="bcr-modal-spec-row">
                                    <span>Cadence</span>
                                    <span style={{ textTransform: 'capitalize' }}>{billingCycle}</span>
                                </div>
                                <div className="bcr-modal-spec-row">
                                    <span>Price</span>
                                    <span>{billingCycle === 'annual' ? PLAN_META[confirmModalPlan]?.annualPrice : PLAN_META[confirmModalPlan]?.monthlyPrice} / month</span>
                                </div>
                                <div className="bcr-modal-spec-row">
                                    <span>New Monthly Quota</span>
                                    <span>{confirmModalPlan === 'team' ? '2,000 suites' : confirmModalPlan === 'pro' ? '500 suites' : '50 suites'}</span>
                                </div>
                                <div className="bcr-modal-spec-row">
                                    <span>Effective Date</span>
                                    <span>Immediate</span>
                                </div>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.74rem', color: '#6E7571' }}>
                                Quotas and capability entitlements are updated synchronously upon confirmation.
                            </p>
                        </div>

                        <div className="bcr-modal-footer">
                            <button
                                type="button"
                                className="bcr-plan-btn secondary"
                                style={{ width: 'auto' }}
                                onClick={() => setConfirmModalPlan(null)}
                                disabled={isSubmittingPlan}
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                className="bcr-plan-btn primary"
                                style={{ width: 'auto' }}
                                onClick={handleExecutePlanChange}
                                disabled={isSubmittingPlan}
                            >
                                {isSubmittingPlan ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" />
                                        <span>Persisting Change…</span>
                                    </>
                                ) : (
                                    <span>Confirm Subscription Change</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════ ENTERPRISE SALES CONTACT MODAL ══════════════ */}
            {showContactModal && (
                <div className="bcr-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-enterprise-title">
                    <div className="bcr-modal-dialog">
                        <div className="bcr-modal-header">
                            <h4 id="modal-enterprise-title" className="bcr-modal-title">Enterprise Infrastructure Inquiry</h4>
                            <button
                                type="button"
                                className="bcr-modal-close"
                                onClick={() => { setShowContactModal(false); setContactSent(false); }}
                                aria-label="Close modal"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        <div className="bcr-modal-body">
                            {contactSent ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', textAlign: 'center', padding: '1rem 0' }}>
                                    <CheckCircle2 size={32} style={{ color: '#8BAF9A' }} />
                                    <span style={{ fontWeight: 600, color: '#F1F3F1' }}>Inquiry Dispatched</span>
                                    <span style={{ fontSize: '0.78rem', color: '#A0A7A2' }}>
                                        A solutions engineer will reach out to <strong>{user?.email}</strong> with an architecture briefing and custom enterprise proposal.
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <p style={{ margin: 0 }}>
                                        TestNexa AI Enterprise provides dedicated private inference clusters, SOC-2 compliance attestation, custom fine-tuning on proprietary test suites, and tailored multi-seat contracts.
                                    </p>

                                    <div className="bcr-modal-spec-box">
                                        <div className="bcr-modal-spec-row">
                                            <span>Workspace ID</span>
                                            <span style={{ color: '#8BAF9A' }}>{currentWorkspace?.id}</span>
                                        </div>
                                        <div className="bcr-modal-spec-row">
                                            <span>Contact Email</span>
                                            <span>{user?.email}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="bcrContactNotes" style={{ display: 'block', fontSize: '0.74rem', color: '#A0A7A2', marginBottom: '0.35rem' }}>
                                            Seat count or custom architectural requirements (optional):
                                        </label>
                                        <textarea
                                            id="bcrContactNotes"
                                            rows={3}
                                            className="app-settings-input"
                                            placeholder="e.g. 50 seats, self-hosted LLM deployment, Jira Enterprise sync..."
                                            value={contactNotes}
                                            onChange={(e) => setContactNotes(e.target.value)}
                                            style={{ width: '100%', resize: 'none' }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="bcr-modal-footer">
                            <button
                                type="button"
                                className="bcr-plan-btn secondary"
                                style={{ width: 'auto' }}
                                onClick={() => { setShowContactModal(false); setContactSent(false); }}
                            >
                                {contactSent ? 'Close' : 'Cancel'}
                            </button>
                            {!contactSent && (
                                <button
                                    type="button"
                                    className="bcr-plan-btn primary"
                                    style={{ width: 'auto' }}
                                    onClick={() => setContactSent(true)}
                                >
                                    <span>Submit Inquiry</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingControlRoom;
