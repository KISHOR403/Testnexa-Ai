import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
    CheckCircle2,
    AlertTriangle,
    ChevronRight,
    Check
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

gsap.registerPlugin(ScrollTrigger);

const PIPELINE_STAGES = [
    {
        num: '01',
        key: 'understand',
        title: 'UNDERSTAND',
        headline: 'Before a test exists, isolate what matters.',
        desc: 'Deconstruct natural language PRD clauses into atomic logical conditions. Automatically flag unstated session boundaries, timing vulnerabilities, and missing rate limits.',
        tag: 'AMBIGUITY ISOLATION'
    },
    {
        num: '02',
        key: 'generate',
        title: 'GENERATE',
        headline: 'Synthesize deterministic tests from acceptance criteria.',
        desc: 'Turn parsed logic into prioritized test suites. Every test case contains explicit preconditions, atomic action steps, strict assertions, and parameterized datasets.',
        tag: 'ATOMIC SYNTHESIS'
    },
    {
        num: '03',
        key: 'review',
        title: 'REVIEW',
        headline: 'Every test needs a verifiable reason.',
        desc: 'Scrutinize assertion logic, adjust tolerance thresholds, and calibrate test suites. QA engineers promote test status from review to approved with zero orphan tests.',
        tag: 'ASSERTION SCRUTINY'
    },
    {
        num: '04',
        key: 'execute',
        title: 'EXECUTE',
        headline: 'Run it. Observe it. Record what happened.',
        desc: 'Execute tests across environments with millisecond telemetry. Live assertions record pass/fail conditions, capture traces, and isolate root causes in real time.',
        tag: 'TELEMETRY OBSERVABILITY'
    },
    {
        num: '05',
        key: 'verify',
        title: 'VERIFY',
        headline: 'Verified.',
        subheadline: 'Quality must be verified.',
        desc: 'Cryptographic chain of custody linking executed test runs directly back to source requirement clauses. Real-time audit proofs with 100% compliance coverage.',
        tag: 'AUDITABLE LINEAGE'
    }
];

/* ─── STAGE 01 VIEW: SPEC CLAUSE & AMBIGUITY ISOLATION ─── */
const SpecClauseView = () => (
    <div className="tn-morph-stage-view">
        <div className="tn-morph-top-header">
            <span className="tn-morph-title">[ INGESTED SPECIFICATION CLAUSE ]</span>
            <span className="tn-morph-pill amber">3 Implicit Vulnerabilities Flagged</span>
        </div>
        <div className="tn-morph-spec-box">
            <p className="tn-morph-spec-quote">
                &ldquo;Users can{' '}
                <span className="tn-ambiguity-token is-pulsing">
                    reset their password
                    <span className="tn-ambiguity-tooltip">Ambiguity: unstated token TTL &amp; multi-device session revocation</span>
                </span>{' '}
                using their{' '}
                <span className="tn-ambiguity-token is-pulsing">
                    registered email address
                    <span className="tn-ambiguity-tooltip">Ambiguity: timing delta allows account existence probe</span>
                </span>.&rdquo;
            </p>
        </div>
        <div className="tn-morph-rules-list">
            <div className="tn-morph-rule-row">
                <span className="tn-rule-num">AC-01</span>
                <div>
                    <span className="tn-rule-title">Cryptographic Single-Use Token (15m TTL)</span>
                    <p className="tn-rule-desc">Strict 900s expiration. Invalidate all existing active user sessions upon reset token generation.</p>
                </div>
            </div>
            <div className="tn-morph-rule-row">
                <span className="tn-rule-num">AC-02</span>
                <div>
                    <span className="tn-rule-title">Timing Delta Mitigation (Constant Time &le; 120ms)</span>
                    <p className="tn-rule-desc">Assert response timing invariant across existent and non-existent email inputs to prevent enumeration.</p>
                </div>
            </div>
            <div className="tn-morph-rule-row">
                <span className="tn-rule-num">AC-03</span>
                <div>
                    <span className="tn-rule-title">Anti-Abuse IP Rate Limiting</span>
                    <p className="tn-rule-desc">Throttle password recovery requests to max 5 attempts/hr per client IP and target account ID.</p>
                </div>
            </div>
        </div>
    </div>
);

/* ─── STAGE 02 VIEW: SYNTHESIZED TEST SUITE ─── */
const TestSuiteStreamView = () => (
    <div className="tn-morph-stage-view">
        <div className="tn-morph-top-header">
            <span className="tn-morph-title">[ SYNTHESIZED TEST SUITE ]</span>
            <span className="tn-morph-pill cyan">24 Tests Generated &bull; 100% Clause Linked</span>
        </div>
        <div className="tn-morph-tests-stream">
            <div className="tn-stream-card">
                <div className="tn-stream-card-top">
                    <span className="tn-stream-id">TC-FUNC-001</span>
                    <span className="tn-priority-badge p0">P0</span>
                    <span className="tn-stream-type">Functional</span>
                    <span className="tn-stream-check"><CheckCircle2 size={13} color="var(--ok)" /></span>
                </div>
                <div className="tn-stream-title">Submit registered email &amp; verify single-use token dispatch with 15m TTL</div>
                <div className="tn-stream-assertion">
                    <code>expect(res.status).toBe(200); expect(token.ttl).toBeLessThanOrEqual(900);</code>
                </div>
            </div>
            <div className="tn-stream-card">
                <div className="tn-stream-card-top">
                    <span className="tn-stream-id">TC-NEG-002</span>
                    <span className="tn-priority-badge p1">P1</span>
                    <span className="tn-stream-type">Negative</span>
                    <span className="tn-stream-check"><CheckCircle2 size={13} color="var(--ok)" /></span>
                </div>
                <div className="tn-stream-title">Malformed RFC 5322 syntax rejection at client gateway</div>
                <div className="tn-stream-assertion">
                    <code>expect(res.status).toBe(422); expect(res.body.error).toBe('INVALID_FORMAT');</code>
                </div>
            </div>
            <div className="tn-stream-card">
                <div className="tn-stream-card-top">
                    <span className="tn-stream-id">TC-SEC-003</span>
                    <span className="tn-priority-badge p0">P0</span>
                    <span className="tn-stream-type">Security</span>
                    <span className="tn-stream-check"><CheckCircle2 size={13} color="var(--ok)" /></span>
                </div>
                <div className="tn-stream-title">Account enumeration timing attack audit across 1,000 mixed probes</div>
                <div className="tn-stream-assertion">
                    <code>expect(Math.abs(t_valid - t_invalid)).toBeLessThanOrEqual(120);</code>
                </div>
            </div>
        </div>
    </div>
);

/* ─── STAGE 03 VIEW: ASSERTION REVIEW STATION ─── */
const AssertionReviewView = ({ reviewToggled, onToggle }) => (
    <div className="tn-morph-stage-view">
        <div className="tn-morph-top-header">
            <span className="tn-morph-title">[ ASSERTION REVIEW STATION ]</span>
            <span className="tn-morph-pill green">Zero Orphan Tests</span>
        </div>
        <div className="tn-review-station-card">
            <div className="tn-review-card-meta">
                <span className="tn-stream-id">TC-SEC-004</span>
                <span className="tn-priority-badge p0">P0 Security</span>
                <span className="tn-review-clause">Clause: REQ-142.4 (Throttling)</span>
            </div>
            <h3 className="tn-review-card-title">Anti-abuse rate limiting (&gt; 5 requests per hour per client IP)</h3>
            <div className="tn-review-spec-box">
                <span className="tn-spec-k">ATOMIC ASSERTION:</span>
                <code>expect(res_throttle.status).toBe(429); expect(res_throttle.headers['retry-after']).toBeDefined();</code>
            </div>
            <div className="tn-review-rationale-box">
                <span className="tn-spec-k">QA RATIONALE:</span>
                <p className="tn-rationale-text">
                    Mitigates automated brute-force flooding of the transactional reset queue.
                    Requires strict client IP validation and token dispatch throttle enforcement.
                </p>
            </div>
            <div className="tn-review-approval-row">
                <span className="tn-approval-label">QA Sign-Off Status:</span>
                <button
                    type="button"
                    className={`tn-toggle-approval-btn ${reviewToggled ? 'is-approved' : 'is-review'}`}
                    onClick={onToggle}
                >
                    {reviewToggled ? (
                        <>
                            <Check size={14} color="var(--ok)" />
                            <span>Approved for CI/CD</span>
                        </>
                    ) : (
                        <>
                            <AlertTriangle size={14} color="var(--warn)" />
                            <span>Needs QA Review</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    </div>
);

/* ─── STAGE 04 VIEW: EXECUTION TELEMETRY FEED (ISOLATED LIVE STATE) ─── */
const ExecutionTelemetryFeed = ({ isActive }) => {
    const [tickIndex, setTickIndex] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setTickIndex(0);
            return;
        }

        const interval = setInterval(() => {
            setTickIndex((prev) => (prev < 4 ? prev + 1 : prev));
        }, 360);

        return () => clearInterval(interval);
    }, [isActive]);

    return (
        <div className="tn-morph-stage-view">
            <div className="tn-morph-top-header">
                <span className="tn-morph-title">[ TELEMETRY RUN REPORT // RUN #842 ]</span>
                <span className="tn-morph-pill cyan">Live Telemetry &bull; Playwright Core</span>
            </div>
            <div className="tn-execute-terminal-box">
                <div className="tn-telemetry-meta-bar">
                    <span>Session: prod-runner-alpha</span>
                    <span>Duration: 1.42s</span>
                    <span style={{ color: 'var(--ok)' }}>Status: 24/24 Passed</span>
                </div>
                <div className="tn-terminal-log-feed">
                    <div className="tn-log-line pass">
                        <span className="tn-log-time">00.12s</span>
                        <span className="tn-log-tag">[INIT]</span>
                        <span>Chromium headless context spawned (1280x720, trace enabled)</span>
                    </div>
                    {tickIndex >= 1 && (
                        <div className="tn-log-line pass tn-fade-in-line">
                            <span className="tn-log-time">00.42s</span>
                            <span className="tn-log-tag">[ASSERT]</span>
                            <span>TC-FUNC-001: Verified single-use token generated (15m TTL) &bull; 38ms</span>
                        </div>
                    )}
                    {tickIndex >= 2 && (
                        <div className="tn-log-line pass tn-fade-in-line">
                            <span className="tn-log-time">00.68s</span>
                            <span className="tn-log-tag">[ASSERT]</span>
                            <span>TC-NEG-002: Malformed RFC 5322 payload rejected &bull; HTTP 422 &bull; 14ms</span>
                        </div>
                    )}
                    {tickIndex >= 3 && (
                        <div className="tn-log-line pass tn-fade-in-line">
                            <span className="tn-log-time">00.94s</span>
                            <span className="tn-log-tag">[ASSERT]</span>
                            <span>TC-SEC-003: Timing delta measured across 1k probes (36ms &le; 120ms) &bull; PASSED</span>
                        </div>
                    )}
                    {tickIndex >= 4 && (
                        <div className="tn-log-line pass tn-fade-in-line">
                            <span className="tn-log-time">01.38s</span>
                            <span className="tn-log-tag">[DONE]</span>
                            <span>All 72 strict assertions validated &bull; Zero flakiness</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ─── STAGE 05 VIEW: TRACEABILITY MATRIX & VERIFICATION (ISOLATED LIVE STATE) ─── */
const TraceabilityMatrixView = ({ isActive }) => {
    const [coverageCounter, setCoverageCounter] = useState(0);

    useEffect(() => {
        if (!isActive) {
            setCoverageCounter(0);
            return;
        }

        let start = 0;
        const duration = 750;
        const stepTime = 30;
        const totalSteps = duration / stepTime;
        const stepVal = 100 / totalSteps;

        const timer = setInterval(() => {
            start += stepVal;
            if (start >= 100) {
                setCoverageCounter(100);
                clearInterval(timer);
            } else {
                setCoverageCounter(Math.floor(start));
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [isActive]);

    return (
        <div className="tn-morph-stage-view tn-verify-stage-view">
            <div className="tn-morph-top-header">
                <span className="tn-morph-title">[ BIDIRECTIONAL TRACEABILITY MATRIX ]</span>
                <span className="tn-morph-pill green">
                    Coverage: {coverageCounter}% Verified
                </span>
            </div>
            <div className="tn-trace-cascade-matrix">
                {[
                    { req: 'PRD §4.2.1 Token Dispatch', tc: 'TC-FUNC-001', run: 'Run #842 (38ms)' },
                    { req: 'PRD §4.2.2 RFC Syntax', tc: 'TC-NEG-002', run: 'Run #842 (14ms)' },
                    { req: 'PRD §4.2.3 Timing Invariant', tc: 'TC-SEC-003', run: 'Run #842 (36ms)' },
                    { req: 'PRD §4.2.4 Rate Limiting', tc: 'TC-SEC-004', run: 'Run #842 (29ms)' }
                ].map((row, idx) => (
                    <div key={idx} className="tn-trace-row">
                        <span className="tn-trace-spec">{row.req}</span>
                        <span className="tn-trace-arrow">&rarr;</span>
                        <span className="tn-trace-case">{row.tc}</span>
                        <span className="tn-trace-arrow">&rarr;</span>
                        <span className="tn-trace-run">{row.run}</span>
                        <span className="tn-trace-arrow">&rarr;</span>
                        <span className="tn-trace-badge pass">
                            <CheckCircle2 size={13} color="var(--ok)" />
                            <span>VERIFIED</span>
                        </span>
                    </div>
                ))}
            </div>
            <div className="tn-coverage-progress-bar">
                <div
                    className="tn-coverage-progress-fill"
                    style={{
                        width: `${coverageCounter}%`,
                        transition: 'width 0.05s linear'
                    }}
                />
            </div>
        </div>
    );
};

export const PipelineStickyScene = () => {
    const [activeStageIdx, setActiveStageIdx] = useState(0);
    const [isReducedMotion, setIsReducedMotion] = useState(false);
    const [reviewToggled, setReviewToggled] = useState(true);

    const activeStageIdxRef = useRef(0);
    const sceneRef = useRef(null);
    const pinWrapRef = useRef(null);
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    // Detect prefers-reduced-motion
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        setIsReducedMotion(media.matches);
        const listener = (e) => setIsReducedMotion(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);

    // GSAP ScrollTrigger Pinned Scene
    useEffect(() => {
        if (!sceneRef.current || !pinWrapRef.current) return;
        if (isReducedMotion) return;

        const ctx = gsap.context(() => {
            const numStages = PIPELINE_STAGES.length;

            ScrollTrigger.create({
                id: 'pipeline-sticky-trigger',
                trigger: sceneRef.current,
                start: 'top top',
                end: '+=350%', // about 70vh of scroll per stage
                pin: pinWrapRef.current,
                pinSpacing: true,
                anticipatePin: 1,
                // Direct progress calculation without artificial scrub lag
                onUpdate: (self) => {
                    const progress = self.progress;
                    const stage = Math.min(
                        numStages - 1,
                        Math.max(0, Math.floor(progress * numStages))
                    );
                    // Only dispatch state update when crossing stage boundaries
                    if (stage !== activeStageIdxRef.current) {
                        activeStageIdxRef.current = stage;
                        setActiveStageIdx(stage);
                    }
                }
            });
        }, sceneRef);

        return () => ctx.revert();
    }, [isReducedMotion]);

    const activeStage = PIPELINE_STAGES[activeStageIdx];

    // Smooth navigation when clicking on stage rail
    const handleStageClick = (idx) => {
        activeStageIdxRef.current = idx;
        setActiveStageIdx(idx);

        const st = ScrollTrigger.getById('pipeline-sticky-trigger');
        if (st) {
            const target = st.start + (st.end - st.start) * (idx / (PIPELINE_STAGES.length - 1));
            if (window.__lenis) {
                window.__lenis.scrollTo(target, { duration: 0.8 });
            } else {
                window.scrollTo({ top: target, behavior: 'smooth' });
            }
        }
    };

    // Render individual panel views
    const renderStagePanel = (stageIdx, isActive) => {
        switch (stageIdx) {
            case 0:
                return <SpecClauseView />;
            case 1:
                return <TestSuiteStreamView />;
            case 2:
                return (
                    <AssertionReviewView
                        reviewToggled={reviewToggled}
                        onToggle={() => setReviewToggled(!reviewToggled)}
                    />
                );
            case 3:
                return <ExecutionTelemetryFeed isActive={isActive} />;
            case 4:
                return <TraceabilityMatrixView isActive={isActive} />;
            default:
                return null;
        }
    };

    // Reduced motion or no-JS: show all stages stacked normally
    if (isReducedMotion) {
        return (
            <section id="workflow" className="tn-pipeline-reduced-motion-stack" aria-label="5-Stage QA Pipeline">
                <div id="pipeline-scene" className="tn-max-container">
                    <div className="tn-eyebrow-mono">
                        <span className="tn-eyebrow-ping" />
                        <span>CONTINUOUS QA PIPELINE // SPECIFICATION TO VERIFICATION</span>
                    </div>
                    {PIPELINE_STAGES.map((st, idx) => (
                        <div key={st.key} className="tn-reduced-stage-item">
                            <div className="tn-reduced-stage-info">
                                <div className="tn-rail-bullet"><span>{st.num}</span></div>
                                <h2 className="tn-pipeline-heading">{st.headline}</h2>
                                <p className="tn-pipeline-desc">{st.desc}</p>
                            </div>
                            <div className="tn-pipeline-right-panel tn-glow-card">
                                {renderStagePanel(idx, true)}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section
            ref={sceneRef}
            id="workflow"
            className="tn-pipeline-scene-container"
            aria-label="Interactive 5-Stage QA Pipeline"
        >
            <div ref={pinWrapRef} id="pipeline-scene" className="tn-pipeline-pinned-wrap">
                <div className="tn-max-container">
                    {/* Clean single eyebrow header */}
                    <div className="tn-pipeline-top-bar">
                        <div className="tn-eyebrow-mono">
                            <span className="tn-eyebrow-ping" />
                            <span>CONTINUOUS QA PIPELINE // STAGE {activeStage.num} OF 05</span>
                        </div>
                        <span className="tn-pipeline-badge-tag">{activeStage.tag}</span>
                    </div>

                    <div className="tn-pipeline-grid-layout">
                        {/* ─── LEFT COLUMN: Stage Info + Progress Rail ─── */}
                        <div className="tn-pipeline-left-rail">
                            {/* Five Stage Progress Rail */}
                            <div className="tn-stage-progress-rail" role="tablist">
                                {PIPELINE_STAGES.map((st, idx) => {
                                    const isActive = idx === activeStageIdx;
                                    const isPassed = idx < activeStageIdx;
                                    return (
                                        <button
                                            key={st.key}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            className={`tn-rail-stage-btn ${isActive ? 'is-active' : ''} ${isPassed ? 'is-passed' : ''}`}
                                            onClick={() => handleStageClick(idx)}
                                        >
                                            <div className="tn-rail-bullet">
                                                <span>{st.num}</span>
                                            </div>
                                            <div className="tn-rail-text">
                                                <span className="tn-rail-title">{st.title}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* GPU-Accelerated Copy Stack (Zero Lag on Scroll) */}
                            <div className="tn-pipeline-stage-copy">
                                <div className="tn-pipeline-copy-stack">
                                    {PIPELINE_STAGES.map((st, idx) => {
                                        const isActive = idx === activeStageIdx;
                                        return (
                                            <div
                                                key={st.key}
                                                className={`tn-pipeline-copy-pane ${isActive ? 'is-active' : ''}`}
                                                aria-hidden={!isActive}
                                            >
                                                <h2 className="tn-pipeline-heading">
                                                    {st.headline}
                                                </h2>
                                                {st.subheadline && (
                                                    <div className="tn-pipeline-subheadline">
                                                        {st.subheadline}
                                                    </div>
                                                )}
                                                <p className="tn-pipeline-desc">
                                                    {st.desc}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="tn-pipeline-cta-link">
                                    <a
                                        href={getTargetUrl('/app/workspace')}
                                        className="tn-inline-mono-link"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleWorkspaceEntry('/app/workspace');
                                        }}
                                    >
                                        <span>Inspect {activeStage.title} in workspace</span>
                                        <ChevronRight size={13} />
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* ─── RIGHT COLUMN: One Morphing Product Panel (GPU CSS Grid Stack) ─── */}
                        <div className="tn-pipeline-right-panel tn-glow-card" data-cursor="Inspect">
                            <div className="tn-pipeline-panels-stack">
                                {PIPELINE_STAGES.map((st, idx) => {
                                    const isActive = idx === activeStageIdx;
                                    return (
                                        <div
                                            key={st.key}
                                            className={`tn-pipeline-stage-pane ${isActive ? 'is-active' : ''}`}
                                            aria-hidden={!isActive}
                                        >
                                            {renderStagePanel(idx, isActive)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PipelineStickyScene;
