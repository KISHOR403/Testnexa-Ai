import React, { useState } from 'react';
import RevealSection from './RevealSection';
import {
    GitBranch,
    CheckCircle2,
    Code,
    Layers,
    ShieldAlert,
    FileCheck,
    ArrowRight,
    ShieldCheck,
    Lock,
    EyeOff,
    Check
} from 'lucide-react';

const PIPELINE_STAGES = [
    { num: '01', name: 'Requirement', sub: 'Spec Ingestion' },
    { num: '02', name: 'Analysis', sub: 'Ambiguity Flagging' },
    { num: '03', name: 'Test Suite', sub: 'Synthesis & Steps' },
    { num: '04', name: 'Coverage', sub: 'Gap & Risk Audit' },
    { num: '05', name: 'Traceability', sub: 'Lineage Lock' },
    { num: '06', name: 'Export', sub: 'CI/CD & Runners' }
];

const STAKEHOLDERS = [
    {
        id: 'qa-eng',
        role: 'QA Engineer',
        icon: Code,
        objective: 'Instant structured test suites with zero manual boilerplate.',
        outputs: 'Precondition specs, step actions, expected assertions, Cucumber BDD syntax'
    },
    {
        id: 'qa-lead',
        role: 'QA Lead',
        icon: Layers,
        objective: 'Audit coverage distribution, risk priorities, and full clause lineage.',
        outputs: 'Clause coverage percentage, risk severity matrix, bidirectional lineage map'
    },
    {
        id: 'eng-mgr',
        role: 'Engineering Manager',
        icon: ShieldAlert,
        objective: 'Prevent critical edge-case and rate-limit leaks before staging release.',
        outputs: 'Release risk assessment, security boundary alerts, sprint test readiness'
    },
    {
        id: 'prod-mgr',
        role: 'Product Manager',
        icon: FileCheck,
        objective: 'Validate requirement completeness and testability during grooming.',
        outputs: 'Missing acceptance criteria alerts, ambiguity flags, testable rules'
    }
];

export const EnterpriseWorkflowChapter = () => {
    const [activeRole, setActiveRole] = useState('qa-eng');

    return (
        <section id="enterprise-workflow" className="tn-section tn-enterprise-chapter" aria-labelledby="chapter5-heading">
            <div className="tn-container">
                {/* ─── Chapter Header ─── */}
                <RevealSection className="tn-section-header">
                    <div className="tn-story-chapter-eyebrow">
                        <span className="tn-chapter-pill">CHAPTER 05</span>
                        <span className="tn-chapter-sub">Enterprise Governance</span>
                    </div>
                    <h2 id="chapter5-heading" className="tn-section-title">
                        A complete QA workflow, not just a test generator.
                    </h2>
                    <p className="tn-section-subtitle">
                        From raw requirement ingestion to automated regression sign-off across your entire engineering organization.
                    </p>
                </RevealSection>

                {/* ─── 1. End-to-End Workflow Pipeline Strip ─── */}
                <div className="tn-pipeline-strip-wrap" data-parallax-offset="12">
                    <div className="tn-pipeline-strip">
                        {PIPELINE_STAGES.map((stage, idx) => (
                            <React.Fragment key={stage.num}>
                                <div className="tn-pipe-step">
                                    <span className="tn-pipe-num">{stage.num}</span>
                                    <div className="tn-pipe-info">
                                        <strong className="tn-pipe-name">{stage.name}</strong>
                                        <span className="tn-pipe-sub">{stage.sub}</span>
                                    </div>
                                </div>
                                {idx < PIPELINE_STAGES.length - 1 && (
                                    <div className="tn-pipe-arrow-sep" aria-hidden="true">
                                        <ArrowRight size={14} />
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* ─── 2. Unified Stakeholder Value Matrix ─── */}
                <div className="tn-stakeholder-panel" data-parallax-offset="10">
                    <div className="tn-stakeholder-header">
                        <span className="tn-stakeholder-title">Cross-Functional Engineering Alignment</span>
                        <div className="tn-role-tabs">
                            {STAKEHOLDERS.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setActiveRole(s.id)}
                                    className={`tn-role-tab-btn ${activeRole === s.id ? 'is-active' : ''}`}
                                >
                                    <span>{s.role}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="tn-role-display-body">
                        {STAKEHOLDERS.map((s) => {
                            const isSelected = s.id === activeRole;
                            const Icon = s.icon;
                            if (!isSelected) return null;
                            return (
                                <div key={s.id} className="tn-role-active-view">
                                    <div className="tn-role-view-left">
                                        <div className="tn-role-icon-box">
                                            <Icon size={20} />
                                        </div>
                                        <div>
                                            <h3 className="tn-role-active-title">{s.role}</h3>
                                            <p className="tn-role-active-obj">{s.objective}</p>
                                        </div>
                                    </div>

                                    <div className="tn-role-view-right">
                                        <span className="tn-role-deliverables-label">PRIMARY ARTIFACTS & DELIVERABLES</span>
                                        <div className="tn-role-deliverable-item">
                                            <Check size={14} className="text-accent" />
                                            <span>{s.outputs}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ─── 3. Enterprise Security & Trust Assurance ─── */}
                <div className="tn-enterprise-trust-bar">
                    <div className="tn-trust-bar-item">
                        <EyeOff size={16} className="text-accent" />
                        <div>
                            <strong>Stateless Model Inference</strong>
                            <p>Customer requirements are never stored, logged, or used for model training.</p>
                        </div>
                    </div>

                    <div className="tn-trust-bar-item">
                        <Lock size={16} className="text-accent" />
                        <div>
                            <strong>Workspace & Session Isolation</strong>
                            <p>Tenant data segregated with JWT authorization and cryptographically signed sessions.</p>
                        </div>
                    </div>

                    <div className="tn-trust-bar-item">
                        <ShieldCheck size={16} className="text-accent" />
                        <div>
                            <strong>Role-Based Access Control</strong>
                            <p>Granular team permissions across Viewer, Reviewer, and Editor roles.</p>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default EnterpriseWorkflowChapter;
