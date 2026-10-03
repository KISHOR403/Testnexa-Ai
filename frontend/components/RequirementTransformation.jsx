import React, { useState, useEffect, useRef } from 'react';
import {
    FileText,
    Brain,
    CheckSquare,
    AlertTriangle,
    Shield,
    Check,
    Layers,
    ArrowRight,
    GitBranch,
    SlidersHorizontal,
    Code,
    Sparkles
} from 'lucide-react';
import RevealSection from './RevealSection';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const TRANSFORMATION_STEPS = [
    {
        step: 1,
        id: 'requirement',
        title: 'Requirement Ingestion',
        label: 'Raw Requirement',
        summary: 'Deconstruct natural language input into testable acceptance criteria.',
        meta: { source: 'Jira PROD-842', type: 'Authentication', clauses: '4 Testable' }
    },
    {
        step: 2,
        id: 'analysis',
        title: 'AI Analysis & Ambiguity Audit',
        label: 'AI Analysis',
        summary: 'Identify unstated assumptions, negative boundaries, and security vulnerabilities.',
        meta: { ambiguities: '3 Flagged', security: 'OWASP / Rate Limit', status: 'Deconstructed' }
    },
    {
        step: 3,
        id: 'scenarios',
        title: 'Test Scenarios Synthesis',
        label: 'Test Scenarios',
        summary: 'Formulate comprehensive scenario groups covering positive, negative, and edge cases.',
        meta: { scenarios: '4 Groups', coverageType: 'Multi-vector', status: 'Synthesized' }
    },
    {
        step: 4,
        id: 'cases',
        title: 'Executable Test Cases',
        label: 'Test Cases',
        summary: 'Generate deterministic test cases with preconditions, explicit steps, and assertions.',
        meta: { cases: '4 Selected', bdd: 'Cucumber Ready', priority: 'P0 & P1' }
    },
    {
        step: 5,
        id: 'coverage',
        title: 'Coverage, Risk & Traceability',
        label: 'Coverage & Risk',
        summary: 'Calculate clause coverage, isolate release risks, and lock bidirectional traceability.',
        meta: { coverage: '94%', highRisks: '2 Mitigated', traceability: '100%' }
    }
];

export const RequirementTransformation = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const containerRef = useRef(null);
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current || window.innerWidth < 1024) return;
            const rect = containerRef.current.getBoundingClientRect();
            const totalScroll = rect.height - window.innerHeight;
            if (totalScroll <= 0) return;

            const scrolled = -rect.top;
            const progress = Math.max(0, Math.min(1, scrolled / totalScroll));
            const stepIndex = Math.min(5, Math.max(1, Math.floor(progress * 5) + 1));
            setCurrentStep(stepIndex);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <section
            id="transformation"
            ref={containerRef}
            className="tn-section tn-transformation-section"
            aria-labelledby="transformation-heading"
        >
            <div className="tn-container">
                <RevealSection className="tn-section-header">
                    <div className="tn-chapter-eyebrow">
                        <span className="tn-chapter-pill">SIGNATURE WORKFLOW</span>
                        <span className="tn-chapter-sub">Requirement Transformation Engine</span>
                    </div>
                    <h2 id="transformation-heading" className="tn-section-title">
                        From raw requirement to verified test suite.
                    </h2>
                    <p className="tn-section-subtitle">
                        Watch how a single ambiguous specification statement systematically transforms into structured, review-ready engineering assets.
                    </p>
                </RevealSection>

                <div className="tn-transformation-grid">
                    {/* ─── LEFT COLUMN: Docked / Partially Pinned Requirement Panel ─── */}
                    <div className="tn-transform-dock">
                        <div className="tn-docked-card">
                            <div className="tn-dock-header">
                                <span className="tn-dock-badge">ACTIVE REQUIREMENT SPEC</span>
                                <span className="tn-dock-id">REQ-142</span>
                            </div>

                            <div className="tn-dock-body">
                                <p className="tn-dock-quote">
                                    "Users can reset their password using their registered email."
                                </p>
                            </div>

                            {/* Transformation Progress Stepper */}
                            <div className="tn-dock-stepper" role="tablist" aria-label="Transformation Steps">
                                <span className="tn-dock-stepper-title">TRANSFORMATION PIPELINE:</span>
                                {TRANSFORMATION_STEPS.map((s) => {
                                    const isActive = currentStep === s.step;
                                    const isDone = currentStep > s.step;
                                    return (
                                        <button
                                            key={s.step}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            onClick={() => setCurrentStep(s.step)}
                                            className={`tn-dock-step-btn ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                                        >
                                            <span className="tn-dstep-num">
                                                {isDone ? <Check size={11} className="text-green" /> : `0${s.step}`}
                                            </span>
                                            <div className="tn-dstep-info">
                                                <span className="tn-dstep-label">{s.label}</span>
                                                <span className="tn-dstep-status">
                                                    {isActive ? 'Processing' : isDone ? 'Verified' : 'Pending'}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="tn-dock-cta-box">
                                <a
                                    href={getTargetUrl('/app/workspace')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="tn-btn-primary tn-btn-primary--full"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleWorkspaceEntry('/app/workspace');
                                    }}
                                >
                                    <span>{isOpening ? 'Opening…' : 'Generate Test Suite →'}</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* ─── RIGHT COLUMN: Interactive Transforming Stage Panel ─── */}
                    <div className="tn-transform-stage">
                        {/* STEP 1: REQUIREMENT DECOMPOSITION */}
                        {currentStep === 1 && (
                            <div className="tn-stage-card tn-fade-in" role="tabpanel">
                                <div className="tn-stage-header">
                                    <div className="tn-stage-step-tag">
                                        <span className="tn-stage-dot" />
                                        <span>STEP 1 &bull; REQUIREMENT DECOMPOSITION</span>
                                    </div>
                                    <span className="tn-stage-timestamp">Ingested via Jira PROD-842</span>
                                </div>

                                <div className="tn-stage-content">
                                    <h3 className="tn-stage-title">Deconstructing Natural Language Specification</h3>
                                    <p className="tn-stage-desc">
                                        The engine decomposes unformatted user stories into atomic actors, target endpoints, and stated acceptance criteria.
                                    </p>

                                    <div className="tn-decomp-breakdown">
                                        <div className="tn-decomp-item">
                                            <span className="tn-decomp-label">Target Actor</span>
                                            <span className="tn-decomp-val font-mono">Registered User</span>
                                        </div>
                                        <div className="tn-decomp-item">
                                            <span className="tn-decomp-label">Action Vector</span>
                                            <span className="tn-decomp-val font-mono">POST /api/v1/auth/reset-request</span>
                                        </div>
                                        <div className="tn-decomp-item">
                                            <span className="tn-decomp-label">Verification Media</span>
                                            <span className="tn-decomp-val font-mono">Registered Email &bull; SMTP</span>
                                        </div>
                                        <div className="tn-decomp-item">
                                            <span className="tn-decomp-label">Initial Completeness</span>
                                            <span className="tn-decomp-val text-amber font-mono">62% (Omissions detected)</span>
                                        </div>
                                    </div>

                                    <div className="tn-stage-actions-row">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(2)}
                                            className="tn-stage-next-btn"
                                        >
                                            <span>Proceed to Step 2: AI Analysis</span>
                                            <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: AI ANALYSIS */}
                        {currentStep === 2 && (
                            <div className="tn-stage-card tn-fade-in" role="tabpanel">
                                <div className="tn-stage-header">
                                    <div className="tn-stage-step-tag">
                                        <span className="tn-stage-dot" />
                                        <span>STEP 2 &bull; AI ANALYSIS & BOUNDARY AUDIT</span>
                                    </div>
                                    <span className="tn-badge tn-badge--amber">3 Ambiguities Flagged</span>
                                </div>

                                <div className="tn-stage-content">
                                    <h3 className="tn-stage-title">Detecting Unstated Requirements & Risks</h3>
                                    <p className="tn-stage-desc">
                                        Prior to test synthesis, the model audits the specification across Functional, Negative, Security, and Boundary vectors.
                                    </p>

                                    <div className="tn-analysis-vectors-grid">
                                        <div className="tn-vector-box">
                                            <div className="tn-vector-head">
                                                <Layers size={14} className="text-accent" />
                                                <strong>Functional</strong>
                                            </div>
                                            <p>Valid registered email address triggers single-use cryptographic token dispatch.</p>
                                        </div>

                                        <div className="tn-vector-box">
                                            <div className="tn-vector-head">
                                                <AlertTriangle size={14} className="text-amber" />
                                                <strong>Negative</strong>
                                            </div>
                                            <p>Malformed email syntax rejection; unverified address handling with uniform latency.</p>
                                        </div>

                                        <div className="tn-vector-box">
                                            <div className="tn-vector-head">
                                                <Shield size={14} className="text-red" />
                                                <strong>Security</strong>
                                            </div>
                                            <p>OWASP anti-enumeration uniform responses; token entropy validation (256-bit).</p>
                                        </div>

                                        <div className="tn-vector-box">
                                            <div className="tn-vector-head">
                                                <SlidersHorizontal size={14} className="text-blue" />
                                                <strong>Boundary</strong>
                                            </div>
                                            <p>15-minute token TTL expiration window; IP rate-limiting cap at 5 requests/min.</p>
                                        </div>
                                    </div>

                                    <div className="tn-stage-actions-row">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(3)}
                                            className="tn-stage-next-btn"
                                        >
                                            <span>Proceed to Step 3: Test Scenarios</span>
                                            <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: TEST SCENARIOS */}
                        {currentStep === 3 && (
                            <div className="tn-stage-card tn-fade-in" role="tabpanel">
                                <div className="tn-stage-header">
                                    <div className="tn-stage-step-tag">
                                        <span className="tn-stage-dot" />
                                        <span>STEP 3 &bull; TEST SCENARIOS</span>
                                    </div>
                                    <span className="tn-badge tn-badge--blue">4 Scenarios Derived</span>
                                </div>

                                <div className="tn-stage-content">
                                    <h3 className="tn-stage-title">Multi-Dimensional Scenario Synthesis</h3>
                                    <p className="tn-stage-desc">
                                        Scenarios derived directly from the analyzed specification, covering happy path, failure states, and security bounds.
                                    </p>

                                    <div className="tn-scenarios-stack">
                                        <div className="tn-scen-item">
                                            <span className="tn-scen-pill tn-scen-pill--func">Functional</span>
                                            <div className="tn-scen-text">
                                                <strong>Password reset flow with registered email</strong>
                                                <p>Submits valid email, asserts HTTP 200, checks cryptographic token delivery.</p>
                                            </div>
                                        </div>

                                        <div className="tn-scen-item">
                                            <span className="tn-scen-pill tn-scen-pill--neg">Negative</span>
                                            <div className="tn-scen-text">
                                                <strong>Invalid email format & unregistered accounts</strong>
                                                <p>Asserts RFC 5322 regex validation and prevents account enumeration.</p>
                                            </div>
                                        </div>

                                        <div className="tn-scen-item">
                                            <span className="tn-scen-pill tn-scen-pill--edge">Boundary</span>
                                            <div className="tn-scen-text">
                                                <strong>Expired reset token redemption (TTL Exceeded)</strong>
                                                <p>Asserts HTTP 400 TOKEN_EXPIRED at T+15m01s and prevents password update.</p>
                                            </div>
                                        </div>

                                        <div className="tn-scen-item">
                                            <span className="tn-scen-pill tn-scen-pill--sec">Security</span>
                                            <div className="tn-scen-text">
                                                <strong>IP rate limiting on recovery endpoint</strong>
                                                <p>Enforces threshold of max 5 requests/minute per client IP (HTTP 429).</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="tn-stage-actions-row">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(4)}
                                            className="tn-stage-next-btn"
                                        >
                                            <span>Proceed to Step 4: Executable Test Cases</span>
                                            <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: EXECUTABLE TEST CASES */}
                        {currentStep === 4 && (
                            <div className="tn-stage-card tn-fade-in" role="tabpanel">
                                <div className="tn-stage-header">
                                    <div className="tn-stage-step-tag">
                                        <span className="tn-stage-dot" />
                                        <span>STEP 4 &bull; EXECUTABLE TEST CASES</span>
                                    </div>
                                    <span className="tn-badge tn-badge--green">Ready for Execution</span>
                                </div>

                                <div className="tn-stage-content">
                                    <h3 className="tn-stage-title">Deterministic Steps & Assertions</h3>
                                    <p className="tn-stage-desc">
                                        Test cases generated with explicit preconditions, input parameters, step actions, and expected assertions.
                                    </p>

                                    <div className="tn-tc-transform-table">
                                        <div className="tn-tc-transform-row">
                                            <span className="tn-tc-code">TC-001</span>
                                            <div className="tn-tc-col-main">
                                                <strong>Submit registered email and verify recovery token dispatch</strong>
                                                <span className="tn-tc-submeta">Preconditions: Active user exists &bull; 3 Steps &bull; Functional (P0)</span>
                                            </div>
                                            <span className="tn-badge tn-badge--green">Ready</span>
                                        </div>

                                        <div className="tn-tc-transform-row">
                                            <span className="tn-tc-code">TC-002</span>
                                            <div className="tn-tc-col-main">
                                                <strong>Enforce RFC 5322 regex validation & assert HTTP 422 payload</strong>
                                                <span className="tn-tc-submeta">Input: "user@domain..com" &bull; 2 Steps &bull; Negative (P0)</span>
                                            </div>
                                            <span className="tn-badge tn-badge--green">Ready</span>
                                        </div>

                                        <div className="tn-tc-transform-row">
                                            <span className="tn-tc-code">TC-003</span>
                                            <div className="tn-tc-col-main">
                                                <strong>Assert token invalidation after 15-minute TTL expiration window</strong>
                                                <span className="tn-tc-submeta">Token issued 16m ago &bull; 2 Steps &bull; Edge Case (P1)</span>
                                            </div>
                                            <span className="tn-badge tn-badge--green">Ready</span>
                                        </div>

                                        <div className="tn-tc-transform-row">
                                            <span className="tn-tc-code">TC-004</span>
                                            <div className="tn-tc-col-main">
                                                <strong>Rate limit IP exceeding 5 password reset requests per minute</strong>
                                                <span className="tn-tc-submeta">Burst: 6 req/min &bull; Assert HTTP 429 &bull; Security (P0)</span>
                                            </div>
                                            <span className="tn-badge tn-badge--green">Ready</span>
                                        </div>
                                    </div>

                                    <div className="tn-stage-actions-row">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(5)}
                                            className="tn-stage-next-btn"
                                        >
                                            <span>Proceed to Step 5: Coverage & Risk</span>
                                            <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 5: COVERAGE & RISK */}
                        {currentStep === 5 && (
                            <div className="tn-stage-card tn-fade-in" role="tabpanel">
                                <div className="tn-stage-header">
                                    <div className="tn-stage-step-tag">
                                        <span className="tn-stage-dot" />
                                        <span>STEP 5 &bull; COVERAGE, RISK & TRACEABILITY</span>
                                    </div>
                                    <span className="tn-badge tn-badge--green">Suite Verified</span>
                                </div>

                                <div className="tn-stage-content">
                                    <h3 className="tn-stage-title">Continuous Verification Metrics</h3>
                                    <p className="tn-stage-desc">
                                        Complete quantitative audit proving requirement coverage, high-severity risk mitigation, and zero orphan tests.
                                    </p>

                                    <div className="tn-step5-metrics-row">
                                        <div className="tn-s5-metric">
                                            <span className="tn-s5-lbl">Total Clause Coverage</span>
                                            <span className="tn-s5-val text-green font-mono">94%</span>
                                            <span className="tn-s5-sub">All acceptance criteria tested</span>
                                        </div>
                                        <div className="tn-s5-metric">
                                            <span className="tn-s5-lbl">High-Severity Risks</span>
                                            <span className="tn-s5-val text-amber font-mono">2 High</span>
                                            <span className="tn-s5-sub">Mitigated by TC-003 & TC-004</span>
                                        </div>
                                        <div className="tn-s5-metric">
                                            <span className="tn-s5-lbl">Traceability Matrix</span>
                                            <span className="tn-s5-val text-accent font-mono">100%</span>
                                            <span className="tn-s5-sub">Every test traces to REQ-142</span>
                                        </div>
                                    </div>

                                    <div className="tn-s5-summary-box">
                                        <div className="tn-s5-box-head">
                                            <GitBranch size={14} className="text-accent" />
                                            <strong>Bidirectional Lineage Integrity</strong>
                                        </div>
                                        <p>
                                            Requirement <strong>REQ-142</strong> is bound to 4 scenarios, 24 test cases, and 2 security mitigations. Ready to export to CI/CD runners, Playwright, or Jira.
                                        </p>
                                    </div>

                                    <div className="tn-stage-actions-row">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            className="tn-btn-secondary"
                                        >
                                            <span>Restart Transformation</span>
                                        </button>
                                        <a
                                            href={getTargetUrl('/app/workspace')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="tn-btn-primary"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleWorkspaceEntry('/app/workspace');
                                            }}
                                        >
                                            <span>Open in Workspace →</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default RequirementTransformation;
