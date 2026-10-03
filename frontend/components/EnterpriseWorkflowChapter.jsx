import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowRight,
    Check,
    GitBranch,
    Shield,
    FileText,
    Terminal,
    Layers,
    AlertTriangle,
    SlidersHorizontal,
    Code,
    CheckCircle2
} from 'lucide-react';
import RevealSection from './RevealSection';

const WORKFLOW_STAGES = [
    { id: 'requirement', num: '01', name: 'Requirement', tag: 'Spec Ingestion' },
    { id: 'analysis', num: '02', name: 'Analysis', tag: 'Boundary & Risk' },
    { id: 'suite', num: '03', name: 'Test Suite', tag: 'Scenario Synthesis' },
    { id: 'coverage', num: '04', name: 'Coverage', tag: 'Clause Audit' },
    { id: 'traceability', num: '05', name: 'Traceability', tag: 'Lineage Lock' },
    { id: 'export', num: '06', name: 'Export', tag: 'CI/CD & Runners' }
];

const ROLES = [
    {
        id: 'qa-eng',
        label: 'QA Engineer',
        focus: 'Test cases, assertions, execution steps',
        activeStages: ['suite', 'export'],
        meta: '24 deterministic test cases with Gherkin BDD exports and Playwright step actions.'
    },
    {
        id: 'qa-lead',
        label: 'QA Lead',
        focus: 'Coverage, risk, review status',
        activeStages: ['analysis', 'coverage'],
        meta: '87% specification coverage audit with 2 high-severity boundary mitigations verified.'
    },
    {
        id: 'eng-mgr',
        label: 'Engineering Manager',
        focus: 'Quality signals, release readiness',
        activeStages: ['coverage', 'traceability'],
        meta: 'Release gate confidence backed by zero orphan tests and automated regression sign-off.'
    },
    {
        id: 'prod-mgr',
        label: 'Product Manager',
        focus: 'Requirement traceability, acceptance coverage',
        activeStages: ['requirement', 'traceability'],
        meta: 'Direct acceptance criteria validation linking user stories to verified assertions.'
    }
];

export const EnterpriseWorkflowChapter = () => {
    const [activeStageIndex, setActiveStageIndex] = useState(0);
    const [activeRoleId, setActiveRoleId] = useState('qa-eng');
    const [hasScrolledIn, setHasScrolledIn] = useState(false);
    const sectionRef = useRef(null);

    // Progressive activation on scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setHasScrolledIn(true);
                }
            },
            { threshold: 0.25 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Subtle automatic signal progression if user hasn't manually interacted
    useEffect(() => {
        if (!hasScrolledIn) return;
        const timer = setTimeout(() => {
            setActiveStageIndex((prev) => (prev < 5 ? prev + 1 : prev));
        }, 1800);
        return () => clearTimeout(timer);
    }, [hasScrolledIn, activeStageIndex]);

    const activeRole = ROLES.find((r) => r.id === activeRoleId) || ROLES[0];
    const activeStage = WORKFLOW_STAGES[activeStageIndex];

    return (
        <section
            id="solutions"
            ref={sectionRef}
            className="tn-section tn-workflow-chapter"
            aria-labelledby="workflow-chapter-heading"
        >
            <div className="tn-container">
                {/* ─── 1. Section Intro: Clean Open Canvas ─── */}
                <div className="tn-wf-intro">
                    <span className="tn-wf-eyebrow">FROM REQUIREMENT TO RELEASE</span>
                    <h2 id="workflow-chapter-heading" className="tn-wf-title">
                        A complete QA workflow,<br />
                        not just a test generator.
                    </h2>
                    <p className="tn-wf-subtitle">
                        Move from raw requirements to structured tests, coverage analysis, traceability, and release-ready validation.
                    </p>
                </div>

                {/* ─── 2. View As: Role Selector Control ─── */}
                <div className="tn-wf-role-bar">
                    <span className="tn-wf-role-label">VIEW AS:</span>
                    <div className="tn-wf-role-list" role="tablist" aria-label="Stakeholder Perspectives">
                        {ROLES.map((r) => {
                            const isSelected = r.id === activeRoleId;
                            return (
                                <button
                                    key={r.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isSelected}
                                    onClick={() => setActiveRoleId(r.id)}
                                    className={`tn-wf-role-btn ${isSelected ? 'is-selected' : ''}`}
                                >
                                    <span>{r.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="tn-wf-role-focus">
                        <span className="tn-wf-role-focus-tag">FOCUS</span>
                        <span className="tn-wf-role-focus-text">{activeRole.focus}</span>
                    </div>
                </div>

                {/* ─── 3. Single Continuous Workflow Rail ─── */}
                <div className="tn-wf-rail-container" role="tablist" aria-label="QA Pipeline Stages">
                    <div className="tn-wf-rail">
                        {WORKFLOW_STAGES.map((stage, idx) => {
                            const isActive = idx === activeStageIndex;
                            const isPassed = idx < activeStageIndex;
                            const isRoleRelevant = activeRole.activeStages.includes(stage.id);

                            return (
                                <React.Fragment key={stage.id}>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => setActiveStageIndex(idx)}
                                        className={`tn-wf-rail-node ${isActive ? 'is-active' : ''} ${isPassed ? 'is-passed' : ''} ${isRoleRelevant ? 'is-role-focus' : ''}`}
                                    >
                                        <span className="tn-rail-dot" />
                                        <span className="tn-rail-num">{stage.num}</span>
                                        <span className="tn-rail-name">{stage.name}</span>
                                        <span className="tn-rail-tag">{stage.tag}</span>
                                    </button>

                                    {idx < WORKFLOW_STAGES.length - 1 && (
                                        <div
                                            className={`tn-wf-rail-track ${idx < activeStageIndex ? 'is-filled' : ''} ${idx === activeStageIndex ? 'is-active-track' : ''}`}
                                            aria-hidden="true"
                                        >
                                            <div className="tn-rail-track-line" />
                                            <span className="tn-rail-track-pulse" />
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* ─── 4. Main Visual: Interactive QA Workflow Map ─── */}
                <div className="tn-wf-map-canvas" aria-label="Interactive QA Workflow Map">
                    {/* Map Header Status */}
                    <div className="tn-wf-map-top">
                        <div className="tn-wf-map-legend">
                            <span className="tn-wf-legend-dot" />
                            <span className="tn-wf-legend-title">LIVE SPECIFICATION PIPELINE &bull; REQ-142</span>
                        </div>
                        <div className="tn-wf-map-active-meta">
                            <span>Active Stage:</span>
                            <code>{activeStage.num} {activeStage.name}</code>
                        </div>
                    </div>

                    {/* Technical Flow Hierarchy Visual */}
                    <div className="tn-wf-nodes-flow">
                        
                        {/* NODE 1: REQUIREMENT */}
                        <div className={`tn-wf-node-block tn-node-req ${activeStageIndex === 0 ? 'is-focused' : ''}`}>
                            <div className="tn-node-pill">01 &bull; REQUIREMENT</div>
                            <div className="tn-node-content">
                                <div className="tn-node-title-row">
                                    <FileText size={13} className="text-accent" />
                                    <strong>REQ-142: Password Reset Recovery</strong>
                                </div>
                                <p className="tn-node-sub">"Users can reset their password using their registered email."</p>
                            </div>
                        </div>

                        {/* STEM 1 */}
                        <div className="tn-wf-flow-stem" aria-hidden="true">
                            <span className="tn-stem-line" />
                            <span className="tn-stem-arrow">&darr;</span>
                        </div>

                        {/* NODE 2: ANALYSIS & OMISSION BRANCHES */}
                        <div className={`tn-wf-node-block tn-node-analysis ${activeStageIndex === 1 ? 'is-focused' : ''}`}>
                            <div className="tn-node-pill">02 &bull; ANALYSIS DECOMPOSITION</div>
                            <div className="tn-analysis-split-row">
                                <div className="tn-asplit-card">
                                    <div className="tn-asplit-head">
                                        <AlertTriangle size={12} className="text-amber" />
                                        <span>3 Ambiguities Detected</span>
                                    </div>
                                    <span className="tn-asplit-meta">Token TTL &bull; Anti-enumeration &bull; Rate limit</span>
                                </div>
                                <div className="tn-asplit-card">
                                    <div className="tn-asplit-head">
                                        <Shield size={12} className="text-red" />
                                        <span>2 High-Severity Risks</span>
                                    </div>
                                    <span className="tn-asplit-meta">IP mail quota flooding &bull; Token replay</span>
                                </div>
                            </div>
                        </div>

                        {/* STEM 2 */}
                        <div className="tn-wf-flow-stem" aria-hidden="true">
                            <span className="tn-stem-line" />
                            <span className="tn-stem-arrow">&darr;</span>
                        </div>

                        {/* NODE 3: TEST SUITE & TRI-VECTOR CLASSIFICATION */}
                        <div className={`tn-wf-node-block tn-node-suite ${activeStageIndex === 2 ? 'is-focused' : ''}`}>
                            <div className="tn-node-pill">03 &bull; TEST SUITE (24 CASES GENERATED)</div>
                            <div className="tn-suite-tri-row">
                                <div className="tn-suite-col">
                                    <div className="tn-scol-head">
                                        <span className="tn-scol-dot tn-scol-dot--func" />
                                        <strong>Functional (12)</strong>
                                    </div>
                                    <span>Token dispatch, redemption, password mutation</span>
                                </div>
                                <div className="tn-suite-col">
                                    <div className="tn-scol-head">
                                        <span className="tn-scol-dot tn-scol-dot--neg" />
                                        <strong>Negative (7)</strong>
                                    </div>
                                    <span>RFC 5322 regex validation, invalid token payload</span>
                                </div>
                                <div className="tn-suite-col">
                                    <div className="tn-scol-head">
                                        <span className="tn-scol-dot tn-scol-dot--sec" />
                                        <strong>Security (5)</strong>
                                    </div>
                                    <span>IP threshold (5 req/min), uniform response timing</span>
                                </div>
                            </div>
                        </div>

                        {/* STEM 3 */}
                        <div className="tn-wf-flow-stem" aria-hidden="true">
                            <span className="tn-stem-line" />
                            <span className="tn-stem-arrow">&darr;</span>
                        </div>

                        {/* NODE 4 & 5: DUAL INTEGRITY STAGE (COVERAGE & TRACEABILITY) */}
                        <div className="tn-wf-dual-row">
                            <div className={`tn-wf-node-block tn-node-cov ${activeStageIndex === 3 ? 'is-focused' : ''}`}>
                                <div className="tn-node-pill">04 &bull; COVERAGE AUDIT</div>
                                <div className="tn-cov-mini-stat">
                                    <span className="tn-cov-big-num text-green font-mono">87%</span>
                                    <div className="tn-cov-sub-info">
                                        <strong>Specification Clause Coverage</strong>
                                        <span>4 of 4 acceptance criteria covered</span>
                                    </div>
                                </div>
                            </div>

                            <div className={`tn-wf-node-block tn-node-trace ${activeStageIndex === 4 ? 'is-focused' : ''}`}>
                                <div className="tn-node-pill">05 &bull; TRACEABILITY LINEAGE</div>
                                <div className="tn-cov-mini-stat">
                                    <span className="tn-cov-big-num text-accent font-mono">24 / 24</span>
                                    <div className="tn-cov-sub-info">
                                        <strong>100% Bidirectional Link</strong>
                                        <span>Zero orphan tests &bull; REQ-142 Locked</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* STEM 4 */}
                        <div className="tn-wf-flow-stem" aria-hidden="true">
                            <span className="tn-stem-line" />
                            <span className="tn-stem-arrow">&darr;</span>
                        </div>

                        {/* NODE 6: EXPORT & RUNNERS */}
                        <div className={`tn-wf-node-block tn-node-export ${activeStageIndex === 5 ? 'is-focused' : ''}`}>
                            <div className="tn-node-pill">06 &bull; AUTOMATION & CI/CD EXPORT</div>
                            <div className="tn-export-dest-list">
                                <span className="tn-exp-chip">Playwright</span>
                                <span className="tn-exp-chip">Cypress</span>
                                <span className="tn-exp-chip">Cucumber BDD</span>
                                <span className="tn-exp-chip">Jira Software</span>
                                <span className="tn-exp-chip">REST API</span>
                            </div>
                        </div>

                    </div>

                    {/* Dynamic Role Context Footnote */}
                    <div className="tn-wf-role-footnote">
                        <span className="tn-wf-fn-label">{activeRole.label} Viewpoint:</span>
                        <p className="tn-wf-fn-desc">{activeRole.meta}</p>
                    </div>
                </div>

                {/* ─── 5. Compact Inline Engineering Controls Strip ─── */}
                <div className="tn-eng-controls-strip" aria-label="Enterprise Engineering Controls">
                    <div className="tn-eng-ctrl-item">
                        <span className="tn-eng-ctrl-key">SECURITY</span>
                        <span className="tn-eng-ctrl-val">Tenant isolation</span>
                    </div>

                    <span className="tn-eng-ctrl-sep" aria-hidden="true">│</span>

                    <div className="tn-eng-ctrl-item">
                        <span className="tn-eng-ctrl-key">PRIVACY</span>
                        <span className="tn-eng-ctrl-val">Requirement data protection</span>
                    </div>

                    <span className="tn-eng-ctrl-sep" aria-hidden="true">│</span>

                    <div className="tn-eng-ctrl-item">
                        <span className="tn-eng-ctrl-key">ACCESS</span>
                        <span className="tn-eng-ctrl-val">Role-based permissions</span>
                    </div>

                    <span className="tn-eng-ctrl-sep" aria-hidden="true">│</span>

                    <div className="tn-eng-ctrl-item">
                        <span className="tn-eng-ctrl-key">AUDIT</span>
                        <span className="tn-eng-ctrl-val">Traceable workflow</span>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default EnterpriseWorkflowChapter;
