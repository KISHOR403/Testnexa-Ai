import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const WORKFLOW_STAGES = [
    {
        num: '01',
        id: 'requirement',
        title: 'Requirement',
        desc: 'Ingest PRD clauses & Jira stories into normalized models.',
        detail: 'DOC-AUTH-2026 Section 4.2: Password recovery & token lifecycle requirements normalized.'
    },
    {
        num: '02',
        id: 'analysis',
        title: 'Analysis',
        desc: 'Deconstruct implicit assumptions & security boundaries.',
        detail: '3 implicit risks isolated: account enumeration timing, missing token TTL, unhandled RFC boundaries.'
    },
    {
        num: '03',
        id: 'generation',
        title: 'Generation',
        desc: 'Synthesize prioritized functional, negative & edge tests.',
        detail: '24 deterministic test cases generated with atomic preconditions, steps, assertions, and test data.'
    },
    {
        num: '04',
        id: 'review',
        title: 'Review',
        desc: 'QA engineers inspect assertions and approve test cases.',
        detail: 'Inline assertion review: 24/24 test cases approved with verified clause-to-scenario mapping.'
    },
    {
        num: '05',
        id: 'execution',
        title: 'Execution',
        desc: 'Step-level manual execution with draft persistence.',
        detail: 'Interactive execution station: step verification, observation capture, and defect linking.'
    },
    {
        num: '06',
        id: 'reporting',
        title: 'Reporting',
        desc: 'Audit-ready traceability and pass-rate analytics.',
        detail: 'Pass-rate analytics calculated strictly from executed tests with zero orphan test cases.'
    }
];

export const EnterpriseWorkflowChapter = () => {
    const [activeStageIndex, setActiveStageIndex] = useState(2); // Default to Generation
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const activeStage = WORKFLOW_STAGES[activeStageIndex];

    return (
        <section
            id="workflow"
            className="de-section de-section-alt"
            aria-labelledby="workflow-heading"
        >
            <div className="de-container">
                {/* ─── 1. SECTION INTRO ─── */}
                <div className="de-workflow-header-wrap">
                    <div>
                        <div className="de-eyebrow">
                            <span className="de-eyebrow-dot" />
                            <span>02 / THE QA WORKFLOW</span>
                        </div>
                        <h2 id="workflow-heading" className="de-editorial-title">
                            From a requirement to a verified release.
                        </h2>
                        <p className="de-lead">
                            From raw specifications to executed test runs and defect tracking, TestNexa delivers an uninterrupted engineering loop across every phase of testing.
                        </p>
                    </div>

                    <a
                        href={getTargetUrl('/app/workspace')}
                        className="de-inline-link"
                        onClick={(e) => {
                            e.preventDefault();
                            handleWorkspaceEntry('/app/workspace');
                        }}
                    >
                        <span>Open workflow workspace</span>
                        <ArrowRight size={13} />
                    </a>
                </div>

                {/* ─── 2. WIDE HORIZONTAL PROGRESSION (NO CARDS) ─── */}
                <div className="de-workflow-track" role="tablist" aria-label="Workflow Stages">
                    {WORKFLOW_STAGES.map((stage, idx) => {
                        const isActive = idx === activeStageIndex;
                        return (
                            <button
                                key={stage.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                className={`de-workflow-step ${isActive ? 'is-active' : ''}`}
                                onClick={() => setActiveStageIndex(idx)}
                            >
                                <span className="de-step-num">{stage.num}</span>
                                <span className="de-step-title">{stage.title}</span>
                                <p className="de-step-desc">{stage.desc}</p>
                            </button>
                        );
                    })}
                </div>

                {/* ─── 3. GENUINE PANORAMIC PRODUCT SHOWCASE (Natural 2.89:1 Ratio) ─── */}
                <div className="de-workflow-canvas-wrap">
                    <div className="de-panoramic-frame">
                        <img
                            src="/screenshots/product-canvas.png"
                            alt="TestNexa Product Canvas and QA Workbench"
                            className="de-panoramic-img"
                            loading="lazy"
                        />
                    </div>

                    <div className="de-canvas-caption-bar">
                        <div>
                            <span>ACTIVE CHECKPOINT: </span>
                            <span className="de-canvas-caption-active">STAGE {activeStage.num} &mdash; {activeStage.title.toUpperCase()}</span>
                            <span style={{ margin: '0 8px' }}>&bull;</span>
                            <span>{activeStage.detail}</span>
                        </div>
                        <div>
                            <span>24 Scenarios Verified &bull; 100% Clause Coverage</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default EnterpriseWorkflowChapter;
