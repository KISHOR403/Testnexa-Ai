import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, AnimatePresence } from 'motion/react';
import {
    CheckCircle2,
    AlertTriangle,
    ShieldCheck,
    Terminal,
    ChevronRight,
    Sliders,
    Play,
    Check,
    Lock,
    Clock,
    Activity
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

export const PipelineStickyScene = () => {
    const [activeStageIdx, setActiveStageIdx] = useState(0);
    const [isReducedMotion, setIsReducedMotion] = useState(false);
    const sceneRef = useRef(null);
    const pinWrapRef = useRef(null);
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    // Stage 03 Review interactive toggle
    const [reviewToggled, setReviewToggled] = useState(true);

    // Stage 04 Live Ticking Log lines
    const [tickIndex, setTickIndex] = useState(0);

    // Stage 05 Coverage Counter (0 -> 100%)
    const [coverageCounter, setCoverageCounter] = useState(0);

    // Detect prefers-reduced-motion
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        setIsReducedMotion(media.matches);
        const listener = (e) => setIsReducedMotion(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);

    // GSAP ScrollTrigger Pinned Scene: end set to "+=350%", scrub: 0.6, anticipatePin: 1
    useEffect(() => {
        if (!sceneRef.current || !pinWrapRef.current) return;
        if (isReducedMotion) return;

        const ctx = gsap.context(() => {
            const numStages = PIPELINE_STAGES.length;

            ScrollTrigger.create({
                trigger: sceneRef.current,
                start: 'top top',
                end: '+=350%', // about 70vh of scroll per stage
                pin: pinWrapRef.current,
                pinSpacing: true,
                anticipatePin: 1,
                scrub: 0.6,
                onUpdate: (self) => {
                    const progress = self.progress;
                    const stage = Math.min(
                        numStages - 1,
                        Math.floor(progress * numStages)
                    );
                    setActiveStageIdx(stage);
                }
            });
        }, sceneRef);

        return () => ctx.revert();
    }, [isReducedMotion]);

    // Live ticking simulation when on stage 04
    useEffect(() => {
        if (activeStageIdx !== 3) {
            setTickIndex(0);
            return;
        }

        const interval = setInterval(() => {
            setTickIndex((prev) => (prev < 4 ? prev + 1 : prev));
        }, 450);

        return () => clearInterval(interval);
    }, [activeStageIdx]);

    // Animate coverage counter 0 -> 100% on stage 05
    useEffect(() => {
        if (activeStageIdx !== 4) {
            setCoverageCounter(0);
            return;
        }

        let start = 0;
        const duration = 1000;
        const stepTime = 20;
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
    }, [activeStageIdx]);

    const activeStage = PIPELINE_STAGES[activeStageIdx];

    const handleStageClick = (idx) => {
        setActiveStageIdx(idx);
    };

    // Render individual panel content based on stage index
    const renderStagePanel = (stageIdx) => {
        switch (stageIdx) {
            case 0:
                return (
                    <div className="tn-morph-stage-view">
                        <div className="tn-morph-top-header">
                            <span className="tn-morph-title">[ INGESTED SPECIFICATION CLAUSE ]</span>
                            <span className="tn-morph-pill amber">3 Implicit Vulnerabilities Flagged</span>
                        </div>
                        <div className="tn-morph-spec-box">
                            <p className="tn-morph-spec-quote">
                                &ldquo;Users can{" "}
                                <span className="tn-ambiguity-token is-pulsing">
                                    reset their password
                                    <span className="tn-ambiguity-tooltip">Ambiguity: unstated token TTL &amp; multi-device session revocation</span>
                                </span>{" "}
                                using their{" "}
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
            case 1:
                return (
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
            case 2:
                return (
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
                                    onClick={() => setReviewToggled(!reviewToggled)}
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
            case 3:
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
                                    <motion.div
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="tn-log-line pass"
                                    >
                                        <span className="tn-log-time">00.42s</span>
                                        <span className="tn-log-tag">[ASSERT]</span>
                                        <span>TC-FUNC-001: Verified single-use token generated (15m TTL) &bull; 38ms</span>
                                    </motion.div>
                                )}
                                {tickIndex >= 2 && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="tn-log-line pass"
                                    >
                                        <span className="tn-log-time">00.68s</span>
                                        <span className="tn-log-tag">[ASSERT]</span>
                                        <span>TC-NEG-002: Malformed RFC 5322 payload rejected &bull; HTTP 422 &bull; 14ms</span>
                                    </motion.div>
                                )}
                                {tickIndex >= 3 && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="tn-log-line pass"
                                    >
                                        <span className="tn-log-time">00.94s</span>
                                        <span className="tn-log-tag">[ASSERT]</span>
                                        <span>TC-SEC-003: Timing delta measured across 1k probes (36ms &le; 120ms) &bull; PASSED</span>
                                    </motion.div>
                                )}
                                {tickIndex >= 4 && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="tn-log-line pass"
                                    >
                                        <span className="tn-log-time">01.38s</span>
                                        <span className="tn-log-tag">[DONE]</span>
                                        <span>All 72 strict assertions validated &bull; Zero flakiness</span>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 4:
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
                                { req: 'PRD §4.2.1 Token Dispatch', tc: 'TC-FUNC-001', run: 'Run #842 (38ms)', hash: 'sha256:7f9a2b' },
                                { req: 'PRD §4.2.2 RFC Syntax', tc: 'TC-NEG-002', run: 'Run #842 (14ms)', hash: 'sha256:e3c109' },
                                { req: 'PRD §4.2.3 Timing Invariant', tc: 'TC-SEC-003', run: 'Run #842 (36ms)', hash: 'sha256:4a88f1' },
                                { req: 'PRD §4.2.4 Rate Limiting', tc: 'TC-SEC-004', run: 'Run #842 (29ms)', hash: 'sha256:91d4e0' }
                            ].map((row, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.12, duration: 0.35 }}
                                    className="tn-trace-row"
                                >
                                    <span className="tn-trace-spec">{row.req}</span>
                                    <ChevronRight size={13} color="rgba(255,255,255,0.2)" />
                                    <span className="tn-trace-case">{row.tc}</span>
                                    <ChevronRight size={13} color="rgba(255,255,255,0.2)" />
                                    <span className="tn-trace-run">{row.run}</span>
                                    <ChevronRight size={13} color="rgba(255,255,255,0.2)" />
                                    <span className="tn-trace-verified-pill">
                                        <CheckCircle2 size={13} color="var(--ok)" />
                                        <span>Verified</span>
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                        <div className="tn-verify-coverage-bar-wrap">
                            <div className="tn-coverage-label-row">
                                <span>PRD Clause Verification Integrity</span>
                                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{coverageCounter}% Complete</span>
                            </div>
                            <div className="tn-coverage-progress-track">
                                <motion.div
                                    className="tn-coverage-progress-fill"
                                    style={{ width: `${coverageCounter}%` }}
                                />
                            </div>
                        </div>
                    </div>
                );
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
                                {renderStagePanel(idx)}
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
                    {/* Clean single eyebrow header - no duplicate labels */}
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

                            {/* Active Stage Crossfading Copy */}
                            <div className="tn-pipeline-stage-copy">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeStage.key}
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -14 }}
                                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        <h2 className="tn-pipeline-heading">
                                            {activeStage.headline}
                                        </h2>
                                        {activeStage.subheadline && (
                                            <div className="tn-pipeline-subheadline">
                                                {activeStage.subheadline}
                                            </div>
                                        )}
                                        <p className="tn-pipeline-desc">
                                            {activeStage.desc}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>

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

                        {/* ─── RIGHT COLUMN: One Morphing Product Panel ─── */}
                        <div className="tn-pipeline-right-panel tn-glow-card" data-cursor="Inspect">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeStage.key}
                                    initial={{ opacity: 0, scale: 0.985 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.985 }}
                                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                    style={{ width: '100%' }}
                                >
                                    {renderStagePanel(activeStageIdx)}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PipelineStickyScene;
