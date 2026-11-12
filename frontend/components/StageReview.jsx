import React, { useState } from 'react';
import { ArrowRight, Check, AlertTriangle, ShieldCheck, CheckCircle2, Sliders } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const REVIEW_ITEMS = [
    {
        id: 'TC-FUNC-001',
        title: 'Submit registered email & verify single-use token dispatch',
        type: 'Functional',
        priority: 'P0',
        clause: 'REQ-142.1 (Valid Recovery)',
        assertionSpec: 'expect(token.ttl).toBeLessThanOrEqual(900); expect(session.revoked).toBe(true);',
        initialStatus: 'Approved'
    },
    {
        id: 'TC-NEG-002',
        title: 'Malformed email syntax rejection at gateway (RFC 5322)',
        type: 'Negative',
        priority: 'P1',
        clause: 'REQ-142.2 (RFC Syntax)',
        assertionSpec: 'expect(res.status).toBe(422); expect(res.body.error).toBe("INVALID_EMAIL_FORMAT");',
        initialStatus: 'Approved'
    },
    {
        id: 'TC-SEC-003',
        title: 'Account enumeration timing delta (≤ 120ms standard deviation)',
        type: 'Security',
        priority: 'P0',
        clause: 'REQ-142.3 (Timing Attack)',
        assertionSpec: 'expect(Math.abs(t_valid - t_invalid)).toBeLessThanOrEqual(120);',
        initialStatus: 'Approved'
    },
    {
        id: 'TC-SEC-004',
        title: 'Rate limiting enforcement (> 5 requests per hour per IP)',
        type: 'Security',
        priority: 'P0',
        clause: 'REQ-142.4 (Throttling)',
        assertionSpec: 'expect(res_throttle.status).toBe(429); expect(res_throttle.headers["retry-after"]).toBeDefined();',
        initialStatus: 'Needs Review'
    }
];

export const StageReview = () => {
    const [statuses, setStatuses] = useState(() => {
        const initial = {};
        REVIEW_ITEMS.forEach(item => {
            initial[item.id] = item.initialStatus;
        });
        return initial;
    });

    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const toggleStatus = (id) => {
        setStatuses(prev => ({
            ...prev,
            [id]: prev[id] === 'Approved' ? 'Needs Review' : 'Approved'
        }));
    };

    const approvedCount = Object.values(statuses).filter(s => s === 'Approved').length;

    return (
        <section
            id="review"
            className="vt-fullscreen-stage"
            aria-labelledby="heading-review"
        >
            <div className="vt-container">
                {/* Stage Indicator & Guide */}
                <div className="vt-stage-connector-top">
                    <div className="vt-stage-marker-circle">
                        <span>03</span>
                    </div>
                    <div className="vt-stage-stem-line" aria-hidden="true" />
                </div>

                <div className="vt-eyebrow">
                    <span className="vt-eyebrow-node" />
                    <span>03 / REVIEW &bull; ASSERTION SCRUTINY</span>
                </div>

                {/* Large Editorial Headline */}
                <h2 id="heading-review" className="vt-editorial-heading">
                    Every test needs a reason.
                </h2>

                <p className="vt-lead-text">
                    Every generated test must justify its existence. QA engineers inspect assertion logic, adjust parameters, verify requirement clause coverage, and promote test status from review to approved.
                </p>

                {/* Editorial Layout: Pure Typography, Large Numbers, Fine Lines (Zero Screenshot, Zero Box) */}
                <div className="vt-review-editorial-layout">
                    {/* Architectural KPI Metrics Banner - Bare Numbers on Black */}
                    <div className="vt-review-metrics-row">
                        <div className="vt-review-metric-col">
                            <span className="vt-review-metric-number">100%</span>
                            <span className="vt-review-metric-label">PRD Clause Coverage</span>
                            <p className="vt-review-metric-sub">4 of 4 acceptance criteria linked</p>
                        </div>

                        <div className="vt-review-metric-sep" aria-hidden="true" />

                        <div className="vt-review-metric-col">
                            <span className="vt-review-metric-number vt-text-accent">
                                {approvedCount} / {REVIEW_ITEMS.length}
                            </span>
                            <span className="vt-review-metric-label">Tests Approved</span>
                            <p className="vt-review-metric-sub">Interactive sign-off in real time</p>
                        </div>

                        <div className="vt-review-metric-sep" aria-hidden="true" />

                        <div className="vt-review-metric-col">
                            <span className="vt-review-metric-number">0</span>
                            <span className="vt-review-metric-label">Orphan Assertions</span>
                            <p className="vt-review-metric-sub">Zero unmapped or redundant code</p>
                        </div>
                    </div>

                    {/* Interactive Review Station: Clean Lines on Black Canvas */}
                    <div className="vt-review-inspection-station">
                        <div className="vt-inspection-heading-bar">
                            <span className="vt-floating-label">[ QA APPROVAL & ASSERTION INSPECTION ]</span>
                            <span className="vt-interactive-hint">Click status pill to toggle QA sign-off</span>
                        </div>

                        <div className="vt-review-rows-list">
                            {REVIEW_ITEMS.map((item) => {
                                const st = statuses[item.id];
                                const isApproved = st === 'Approved';

                                return (
                                    <div key={item.id} className="vt-review-item-row">
                                        <div className="vt-review-left-meta">
                                            <div className="vt-review-id-tags">
                                                <span className="vt-test-id">{item.id}</span>
                                                <span className={`vt-priority-pill p-${item.priority.toLowerCase()}`}>
                                                    {item.priority}
                                                </span>
                                                <span className="vt-type-pill">{item.type}</span>
                                                <span className="vt-clause-badge">{item.clause}</span>
                                            </div>
                                            <div className="vt-review-test-title">{item.title}</div>
                                            <div className="vt-review-assertion-spec">
                                                <code>{item.assertionSpec}</code>
                                            </div>
                                        </div>

                                        <div className="vt-review-right-action">
                                            <button
                                                type="button"
                                                className={`vt-status-toggle-btn ${isApproved ? 'is-approved' : 'is-review'}`}
                                                onClick={() => toggleStatus(item.id)}
                                                aria-label={`Toggle approval for ${item.id}`}
                                            >
                                                {isApproved ? (
                                                    <>
                                                        <Check size={13} />
                                                        <span>Approved</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertTriangle size={13} />
                                                        <span>Needs Review</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="vt-stage-action-wrap">
                        <a
                            href={getTargetUrl('/app/workspace')}
                            className="vt-inline-link"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                        >
                            <span>Open test review &amp; approval station in workspace</span>
                            <ArrowRight size={13} />
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default StageReview;
