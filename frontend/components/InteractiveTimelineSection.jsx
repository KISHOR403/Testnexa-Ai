import React, { useState } from 'react';
import {
    ArrowRight,
    CheckCircle2,
    Shield,
    Check,
    AlertTriangle,
    Layers,
    FileText,
    Terminal,
    ChevronRight
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const TIMELINE_STAGES = [
    {
        num: '01',
        title: 'UNDERSTAND',
        shortDesc: 'Analyze requirements and identify ambiguity.',
        badge: 'DOC-AUTH-2026',
        detail: 'Ingest PRD clauses & Jira user stories into deterministic specification models, flagging implicit assumptions and timing vulnerabilities.',
        stats: '3 Risk Flags Isolated • 100% Clause Coverage'
    },
    {
        num: '02',
        title: 'GENERATE',
        shortDesc: 'Generate structured test scenarios.',
        badge: '24 Scenarios',
        detail: 'Synthesize prioritized functional, negative, and edge test cases complete with atomic preconditions, steps, assertions, and test data.',
        stats: 'P0 / P1 / P2 Prioritized • Atomic Steps'
    },
    {
        num: '03',
        title: 'REVIEW',
        shortDesc: 'Review test cases and coverage.',
        badge: 'QA Approval',
        detail: 'QA engineers inspect assertion logic, edit step parameters, and transition test status from Needs Review to Approved.',
        stats: '24/24 Tests Approved • Zero Orphan Logic'
    },
    {
        num: '04',
        title: 'EXECUTE',
        shortDesc: 'Record real manual or automated execution.',
        badge: 'Live Run #842',
        detail: 'Execute tests step-by-step with Pass / Fail / Blocked evaluations, actual result observations, defect logging, and draft auto-recovery.',
        stats: 'Step Assertions • Evidence Capture'
    },
    {
        num: '05',
        title: 'VERIFY',
        shortDesc: 'Connect outcomes to requirements and traceability.',
        badge: 'Audit Verified',
        detail: 'Cryptographic chain of custody linking executed test runs directly back to source requirement clauses for compliance verification.',
        stats: 'Audit Ready • Zero Untested Requirements'
    }
];

const SAMPLE_GENERATED_CASES = [
    { id: 'TC-FUNC-001', title: 'Submit registered email & verify single-use token dispatch', type: 'Functional', priority: 'P0', status: 'Approved' },
    { id: 'TC-NEG-002', title: 'Malformed email syntax rejection at gateway', type: 'Negative', priority: 'P1', status: 'Approved' },
    { id: 'TC-NEG-003', title: 'Expired reset token redemption replay rejection (> 15m TTL)', type: 'Negative', priority: 'P0', status: 'Approved' },
    { id: 'TC-SEC-004', title: 'Rate limiting enforcement (> 5 requests per hour per IP)', type: 'Security', priority: 'P0', status: 'Needs Review' }
];

const TRACE_LINKS = [
    { req: 'REQ-142.1 (Valid Recovery)', tc: 'TC-FUNC-001 (Token Dispatch)', run: 'Run #842 · Passed · 42ms', proof: '100% Verified' },
    { req: 'REQ-142.2 (RFC 5322 Syntax)', tc: 'TC-NEG-002 (Malformed Input)', run: 'Run #842 · Passed · 18ms', proof: '100% Verified' },
    { req: 'REQ-142.3 (15m Token Expiration)', tc: 'TC-NEG-003 (Expired Token)', run: 'Run #842 · Passed · 65ms', proof: '100% Verified' },
    { req: 'REQ-142.4 (5 Req/Hr Rate Limit)', tc: 'TC-SEC-004 (Throttle Rule)', run: 'Run #842 · Passed · 94ms', proof: '100% Verified' }
];

export const InteractiveTimelineSection = () => {
    const [activeStageIndex, setActiveStageIndex] = useState(0); // 0 = Understand, 1 = Generate, etc.
    const [caseStatuses, setCaseStatuses] = useState({});
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const activeStage = TIMELINE_STAGES[activeStageIndex];

    const toggleStatus = (id) => {
        setCaseStatuses((prev) => ({
            ...prev,
            [id]: prev[id] === 'Approved' ? 'Needs Review' : 'Approved'
        }));
    };

    return (
        <section
            id="workflow"
            className="vt-timeline-section"
            aria-labelledby="timeline-main-heading"
        >
            <div className="vt-container">
                {/* ─── Header ─── */}
                <div className="vt-timeline-header">
                    <div className="vt-eyebrow">
                        <span className="vt-eyebrow-node" />
                        <span>THE INTERACTIVE TIMELINE</span>
                    </div>

                    <h2 id="timeline-main-heading" className="vt-editorial-heading">
                        From requirement to verified release.<br />
                        <span className="vt-text-accent">Five continuous stages.</span>
                    </h2>

                    <p className="vt-lead-text">
                        An end-to-end engineering loop with zero gaps between specification, generation, review, execution, and audit-ready verification.
                    </p>
                </div>

                {/* ─── Vention-Inspired Horizontal Timeline Track ─── */}
                <div className="vt-timeline-track-wrap" role="region" aria-label="Interactive 5-Stage Timeline">
                    {/* Thin Dotted Horizontal Axis Line */}
                    <div className="vt-timeline-axis-line" aria-hidden="true" />

                    {/* 5 Alternating Timeline Nodes */}
                    <div className="vt-timeline-nodes-grid" role="tablist">
                        {TIMELINE_STAGES.map((stage, idx) => {
                            const isActive = idx === activeStageIndex;
                            const isOdd = idx % 2 === 0; // 0 (01), 2 (03), 4 (05) are Above; 1 (02), 3 (04) are Below

                            return (
                                <button
                                    key={stage.num}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    className={`vt-timeline-node-col ${isActive ? 'is-active' : ''}`}
                                    onClick={() => setActiveStageIndex(idx)}
                                >
                                    {/* Content positioned ABOVE the dotted line for odd indices */}
                                    {isOdd && (
                                        <>
                                            <div className="vt-node-content-block is-above">
                                                <span className="vt-node-title">{stage.title}</span>
                                                <p className="vt-node-desc">{stage.shortDesc}</p>
                                            </div>
                                            <div className="vt-marker-stem" aria-hidden="true" />
                                        </>
                                    )}

                                    {/* Large Circular Timeline Marker */}
                                    <div className="vt-circle-marker">
                                        <span>{stage.num}</span>
                                    </div>

                                    {/* Content positioned BELOW the dotted line for even indices */}
                                    {!isOdd && (
                                        <>
                                            <div className="vt-marker-stem" aria-hidden="true" />
                                            <div className="vt-node-content-block is-below">
                                                <span className="vt-node-title">{stage.title}</span>
                                                <p className="vt-node-desc">{stage.shortDesc}</p>
                                            </div>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ─── Interactive Stage Focal Showcase Console ─── */}
                <div className="vt-stage-showcase-wrap" role="region" aria-label={`Stage ${activeStage.num} Live Preview`}>
                    <div className="vt-stage-meta-bar">
                        <div>
                            <span className="vt-stage-index-badge">
                                STAGE {activeStage.num} &bull; {activeStage.title}
                            </span>
                            <p className="vt-stage-detail-text">
                                {activeStage.detail}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#8BAF9A', display: 'block' }}>
                                {activeStage.stats}
                            </span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--vt-text-muted)' }}>
                                Stage Checkpoint Active
                            </span>
                        </div>
                    </div>

                    {/* Dynamic Stage Interface Visual Content */}
                    <div className="vt-stage-view-body">
                        {/* Stage 01: Understand (Requirement Intelligence) */}
                        {activeStageIndex === 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                                <div style={{ borderLeft: '2px solid var(--vt-accent)', paddingLeft: '16px' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--vt-text-muted)' }}>INGESTED SPECIFICATION</span>
                                    <h4 style={{ color: '#FFFFFF', margin: '4px 0 8px', fontSize: '1.05rem' }}>DOC-AUTH-2026 PRD Section 4.2</h4>
                                    <p style={{ color: '#BAC5BE', fontSize: '0.86rem', fontStyle: 'italic', margin: 0 }}>
                                        &ldquo;Users can reset their password using their registered email address.&rdquo;
                                    </p>
                                </div>
                                <div style={{ borderLeft: '2px solid var(--vt-accent)', paddingLeft: '16px' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--vt-text-muted)' }}>DECOMPOSED CONDITIONS</span>
                                    <h4 style={{ color: '#FFFFFF', margin: '4px 0 8px', fontSize: '1.05rem' }}>3 Implicit Risks Identified</h4>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', color: '#BAC5BE', fontSize: '0.82rem', lineHeight: 1.6 }}>
                                        <li>Missing token lifetime &rarr; Synthesize 15-minute TTL</li>
                                        <li>Account enumeration &rarr; Assert constant-time API timing</li>
                                        <li>Session replay &rarr; Invalidate all active sessions upon reset</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Stage 02: Generate (Structured Test Suite) */}
                        {activeStageIndex === 1 && (
                            <div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--vt-border)', textAlign: 'left', color: 'var(--vt-text-muted)', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                            <th style={{ padding: '8px 12px 8px 0' }}>CASE ID</th>
                                            <th style={{ padding: '8px 12px' }}>TEST SCENARIO</th>
                                            <th style={{ padding: '8px 12px' }}>TYPE</th>
                                            <th style={{ padding: '8px 12px' }}>PRIORITY</th>
                                            <th style={{ padding: '8px 0', textAlign: 'right' }}>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {SAMPLE_GENERATED_CASES.map((c) => (
                                            <tr key={c.id} style={{ borderBottom: '1px solid var(--vt-border-subtle)' }}>
                                                <td style={{ padding: '12px 12px 12px 0', fontFamily: 'monospace', color: 'var(--vt-accent)' }}>{c.id}</td>
                                                <td style={{ padding: '12px 12px', color: '#F2F2F0' }}>{c.title}</td>
                                                <td style={{ padding: '12px 12px', color: 'var(--vt-text-secondary)' }}>{c.type}</td>
                                                <td style={{ padding: '12px 12px', fontFamily: 'monospace', color: c.priority === 'P0' ? '#E06C75' : '#E5C07B' }}>{c.priority}</td>
                                                <td style={{ padding: '12px 0', textAlign: 'right' }}>
                                                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '2px', background: 'rgba(139, 175, 154, 0.1)', color: '#8BAF9A', border: '1px solid rgba(139, 175, 154, 0.25)', fontFamily: 'monospace' }}>
                                                        {c.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Stage 03: Review (QA Approval Station) */}
                        {activeStageIndex === 2 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {SAMPLE_GENERATED_CASES.map((tc) => {
                                    const st = caseStatuses[tc.id] || tc.status;
                                    const isAppr = st === 'Approved';
                                    return (
                                        <div key={tc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--vt-border-subtle)' }}>
                                            <div>
                                                <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--vt-accent)', marginRight: '8px' }}>{tc.id}</span>
                                                <span style={{ fontSize: '0.88rem', color: '#F2F2F0' }}>{tc.title}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => toggleStatus(tc.id)}
                                                style={{
                                                    background: isAppr ? 'rgba(139, 175, 154, 0.15)' : 'rgba(229, 192, 123, 0.15)',
                                                    border: `1px solid ${isAppr ? 'rgba(139, 175, 154, 0.35)' : 'rgba(229, 192, 123, 0.35)'}`,
                                                    color: isAppr ? '#8BAF9A' : '#E5C07B',
                                                    padding: '4px 12px',
                                                    borderRadius: '2px',
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.72rem',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px'
                                                }}
                                            >
                                                {isAppr ? <Check size={12} /> : <AlertTriangle size={12} />}
                                                <span>{st}</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Stage 04: Execute (Real Panoramic Interface 2.89:1) */}
                        {activeStageIndex === 3 && (
                            <div className="vt-panoramic-container">
                                <img
                                    src="/screenshots/product-canvas.png"
                                    alt="TestNexa Execution Workspace"
                                    className="vt-panoramic-image"
                                    loading="lazy"
                                />
                            </div>
                        )}

                        {/* Stage 05: Verify (Traceability Matrix) */}
                        {activeStageIndex === 4 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {TRACE_LINKS.map((item, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 24px 1.2fr 24px 1fr 24px 100px', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--vt-border-subtle)', fontSize: '0.84rem' }}>
                                        <span style={{ color: '#F2F2F0' }}>{item.req}</span>
                                        <ChevronRight size={14} color="var(--vt-text-muted)" />
                                        <span style={{ color: '#BAC5BE' }}>{item.tc}</span>
                                        <ChevronRight size={14} color="var(--vt-text-muted)" />
                                        <span style={{ fontFamily: 'monospace', color: '#8BAF9A' }}>{item.run}</span>
                                        <ChevronRight size={14} color="var(--vt-text-muted)" />
                                        <span style={{ fontFamily: 'monospace', color: '#6DAE82', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <CheckCircle2 size={13} />
                                            <span>{item.proof}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <a
                            href={getTargetUrl('/app/workspace')}
                            className="vt-inline-link"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                        >
                            <span>Open active stage in TestNexa workspace</span>
                            <ArrowRight size={13} />
                        </a>

                        <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--vt-text-muted)' }}>
                            Stage {activeStage.num} of 05 &bull; Interactive Engineering Story
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default InteractiveTimelineSection;
