import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Shield, Sparkles, Terminal } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const GENERATED_TESTS = [
    {
        id: 'TC-FUNC-001',
        title: 'Submit registered email & verify single-use token dispatch',
        type: 'Functional',
        priority: 'P0',
        assertions: 4,
        status: 'Approved',
        precondition: 'Active user account with verified email exists in auth repository.',
        expected: 'HTTP 200 OK; single-use token dispatched via secure transport with 15-minute TTL.'
    },
    {
        id: 'TC-NEG-002',
        title: 'Malformed email syntax rejection at gateway (RFC 5322)',
        type: 'Negative',
        priority: 'P1',
        assertions: 3,
        status: 'Approved',
        precondition: 'Client attempts recovery payload with non-compliant unicode/syntax strings.',
        expected: 'HTTP 422 Unprocessable Entity; explicit error envelope; zero database queries.'
    },
    {
        id: 'TC-SEC-003',
        title: 'Timing attack audit: constant-time API response delta',
        type: 'Security',
        priority: 'P0',
        assertions: 5,
        status: 'Approved',
        precondition: 'Attacker probes with 1,000 mixed existing and non-existing email addresses.',
        expected: 'Execution delta ≤ 120ms standard deviation; zero account enumeration leakage.'
    },
    {
        id: 'TC-SEC-004',
        title: 'Anti-abuse rate limiting enforcement (> 5 requests / hour)',
        type: 'Security',
        priority: 'P0',
        assertions: 3,
        status: 'Approved',
        precondition: 'Same client IP and target account ID triggers 6 consecutive recovery requests.',
        expected: 'HTTP 429 Too Many Requests; Retry-After header enforced; security event logged.'
    }
];

export const StageGenerate = () => {
    const [activeCaseId, setActiveCaseId] = useState('TC-FUNC-001');
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const selectedCase = GENERATED_TESTS.find(t => t.id === activeCaseId) || GENERATED_TESTS[0];

    return (
        <section
            id="generate"
            className="vt-fullscreen-stage"
            aria-labelledby="heading-generate"
        >
            <div className="vt-container">
                {/* Stage Indicator & Guide */}
                <div className="vt-stage-connector-top">
                    <div className="vt-stage-marker-circle">
                        <span>02</span>
                    </div>
                    <div className="vt-stage-stem-line" aria-hidden="true" />
                </div>

                <div className="vt-eyebrow">
                    <span className="vt-eyebrow-node" />
                    <span>02 / GENERATE &bull; TEST SYNTHESIS</span>
                </div>

                {/* Large Editorial Headline */}
                <h2 id="heading-generate" className="vt-editorial-heading">
                    Turn requirements<br />
                    <span className="vt-text-accent">into intelligent tests.</span>
                </h2>

                <p className="vt-lead-text">
                    Deterministic synthesis transforms parsed requirements into atomic, executable test cases — prioritized by risk, mapped to acceptance clauses, and complete with strict assertions and realistic test data.
                </p>

                {/* Editorial Split Composition without Cards */}
                <div className="vt-generate-grid">
                    {/* Left Column: Live Generated Test Cases Stream */}
                    <div className="vt-generate-tests-stream">
                        <div className="vt-stream-header-strip">
                            <span className="vt-floating-label">[ SYNTHESIZED TEST SUITE ]</span>
                            <span className="vt-stream-suite-badge">24 Tests Generated &bull; DOC-AUTH-2026</span>
                        </div>

                        <div className="vt-test-rows-wrap" role="tablist" aria-label="Generated Test Cases">
                            {GENERATED_TESTS.map((tc) => {
                                const isActive = tc.id === activeCaseId;
                                return (
                                    <button
                                        key={tc.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        className={`vt-test-case-row ${isActive ? 'is-active' : ''}`}
                                        onClick={() => setActiveCaseId(tc.id)}
                                    >
                                        <div className="vt-test-row-main">
                                            <div className="vt-test-row-badges">
                                                <span className="vt-test-id">{tc.id}</span>
                                                <span className={`vt-priority-pill p-${tc.priority.toLowerCase()}`}>
                                                    {tc.priority}
                                                </span>
                                                <span className="vt-type-pill">{tc.type}</span>
                                            </div>
                                            <div className="vt-test-title">{tc.title}</div>
                                        </div>

                                        <div className="vt-test-row-meta">
                                            <span className="vt-assertion-count">{tc.assertions} Assertions</span>
                                            <span className="vt-approval-tag">
                                                <CheckCircle2 size={12} />
                                                <span>{tc.status}</span>
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Selected Test Inspection Details - Bare typography on black with fine accent border */}
                        <div className="vt-test-inspection-details">
                            <div className="vt-inspection-section">
                                <span className="vt-inspection-k">PRECONDITION</span>
                                <p className="vt-inspection-v">{selectedCase.precondition}</p>
                            </div>
                            <div className="vt-inspection-section">
                                <span className="vt-inspection-k">ASSERTION CRITERIA</span>
                                <p className="vt-inspection-v">{selectedCase.expected}</p>
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
                                <span>Generate structured test suites in workspace</span>
                                <ArrowRight size={13} />
                            </a>
                        </div>
                    </div>

                    {/* Right Column: Cropped Product Interface Integrated Directly into Composition (No Box) */}
                    <div className="vt-generate-visual">
                        <div className="vt-cropped-interface-canvas">
                            <img
                                src="/screenshots/hero-preview.png"
                                alt="TestNexa Generated Test Cases Interface"
                                className="vt-cropped-interface-img vt-generate-crop"
                                loading="lazy"
                            />
                            {/* Smooth Vignette Fade */}
                            <div className="vt-interface-gradient-fade" aria-hidden="true" />
                        </div>

                        {/* Floating Technical Summary Strip */}
                        <div className="vt-visual-metadata-strip">
                            <div className="vt-meta-pair">
                                <span className="vt-meta-k">SYNTHESIS SPEED</span>
                                <span className="vt-meta-v vt-text-accent">&lt; 3.2s</span>
                            </div>
                            <div className="vt-meta-sep" aria-hidden="true">&bull;</div>
                            <div className="vt-meta-pair">
                                <span className="vt-meta-k">SUITE DIVERSITY</span>
                                <span className="vt-meta-v">Func / Neg / Sec</span>
                            </div>
                            <div className="vt-meta-sep" aria-hidden="true">&bull;</div>
                            <div className="vt-meta-pair">
                                <span className="vt-meta-k">TRACEABILITY LINK</span>
                                <span className="vt-meta-v">REQ-142 Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default StageGenerate;
