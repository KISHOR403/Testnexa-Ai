import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';

const TIMELINE_STAGES = [
    {
        num: '01',
        id: 'understand',
        title: 'UNDERSTAND',
        shortDesc: 'Analyze raw specifications and isolate implicit risks before code runs.',
        badge: 'DOC-AUTH-2026',
        isAbove: true
    },
    {
        num: '02',
        id: 'generate',
        title: 'GENERATE',
        shortDesc: 'Synthesize prioritized test cases with atomic assertions and test data.',
        badge: '24 Scenarios',
        isAbove: false
    },
    {
        num: '03',
        id: 'review',
        title: 'REVIEW',
        shortDesc: 'Scrutinize assertions, verify 100% clause coverage, and approve quality.',
        badge: 'QA Approval',
        isAbove: true
    },
    {
        num: '04',
        id: 'execute',
        title: 'EXECUTE',
        shortDesc: 'Run manual or automated suites with millisecond telemetry and evidence.',
        badge: 'Run #842 Telemetry',
        isAbove: false
    },
    {
        num: '05',
        id: 'verify',
        title: 'VERIFY',
        shortDesc: 'Audit-ready cryptographic traceability linking outcomes to PRD clauses.',
        badge: 'Traceability Matrix',
        isAbove: true
    }
];

export const WorkflowTimeline = () => {
    const [activeStageId, setActiveStageId] = useState('understand');

    // Scroll listener to update active marker based on which full-screen section is in view
    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY || window.pageYOffset;
            const threshold = window.innerHeight * 0.4;

            for (let i = TIMELINE_STAGES.length - 1; i >= 0; i--) {
                const el = document.getElementById(TIMELINE_STAGES[i].id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top <= threshold) {
                        setActiveStageId(TIMELINE_STAGES[i].id);
                        break;
                    }
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToStage = (id) => {
        const target = document.getElementById(id);
        if (target) {
            const yOffset = -40;
            const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    return (
        <section
            id="workflow"
            className="vt-timeline-section"
            aria-labelledby="timeline-main-heading"
        >
            <div className="vt-container">
                {/* ─── Editorial Header ─── */}
                <div className="vt-timeline-header">
                    <div className="vt-eyebrow">
                        <span className="vt-eyebrow-node" />
                        <span>00 / THE CONTINUOUS QA TIMELINE</span>
                    </div>

                    <h2 id="timeline-main-heading" className="vt-editorial-heading">
                        From requirement to verified release.<br />
                        <span className="vt-text-accent">Five interconnected stages.</span>
                    </h2>

                    <p className="vt-lead-text">
                        An end-to-end engineering loop with zero gaps between specification deconstruction, test generation, assertion review, telemetry execution, and audit-ready verification.
                    </p>
                </div>

                {/* ─── Horizontal Interactive Timeline Track (Desktop) / Vertical (Mobile) ─── */}
                <div className="vt-timeline-track-wrap" role="region" aria-label="Interactive 5-Stage QA Timeline">
                    {/* Thin Dotted Horizontal Axis Line (Desktop only) */}
                    <div className="vt-timeline-axis-line" aria-hidden="true" />

                    {/* 5 Alternating Timeline Nodes */}
                    <div className="vt-timeline-nodes-grid" role="tablist">
                        {TIMELINE_STAGES.map((stage) => {
                            const isActive = stage.id === activeStageId;

                            return (
                                <button
                                    key={stage.num}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    className={`vt-timeline-node-col ${isActive ? 'is-active' : ''}`}
                                    onClick={() => {
                                        setActiveStageId(stage.id);
                                        scrollToStage(stage.id);
                                    }}
                                >
                                    {/* Content positioned ABOVE the dotted line for odd indices */}
                                    {stage.isAbove && (
                                        <>
                                            <div className="vt-node-content-block is-above">
                                                <span className="vt-node-stage-badge">{stage.badge}</span>
                                                <span className="vt-node-title">{stage.title}</span>
                                                <p className="vt-node-desc">{stage.shortDesc}</p>
                                                <span className="vt-node-jump-hint">
                                                    <span>Jump to stage</span>
                                                    <ArrowDown size={11} />
                                                </span>
                                            </div>
                                            <div className="vt-marker-stem" aria-hidden="true" />
                                        </>
                                    )}

                                    {/* Large Numbered Circular Timeline Marker */}
                                    <div className="vt-circle-marker">
                                        <span>{stage.num}</span>
                                    </div>

                                    {/* Content positioned BELOW the dotted line for even indices */}
                                    {!stage.isAbove && (
                                        <>
                                            <div className="vt-marker-stem" aria-hidden="true" />
                                            <div className="vt-node-content-block is-below">
                                                <span className="vt-node-stage-badge">{stage.badge}</span>
                                                <span className="vt-node-title">{stage.title}</span>
                                                <p className="vt-node-desc">{stage.shortDesc}</p>
                                                <span className="vt-node-jump-hint">
                                                    <span>Jump to stage</span>
                                                    <ArrowDown size={11} />
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Subtle horizontal indicator / transition anchor */}
                <div className="vt-timeline-bottom-anchor">
                    <span className="vt-timeline-scroll-prompt">
                        Scroll to explore full-screen storytelling
                    </span>
                    <div className="vt-timeline-vertical-guide" aria-hidden="true" />
                </div>
            </div>
        </section>
    );
};

export default WorkflowTimeline;
