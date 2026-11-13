import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Terminal, Play, Pause, CheckCircle2, ShieldCheck, GitBranch, Github, Cpu, ExternalLink, Download } from 'lucide-react';

export const ProofSection = () => {
    const sectionRef = useRef(null);
    const isInView = useInView(sectionRef, { once: true, margin: '-80px' });

    // Counter animation for proof stats
    const [coverage, setCoverage] = useState(0);
    const [approved, setApproved] = useState(0);
    const [orphans, setOrphans] = useState(12);

    useEffect(() => {
        if (!isInView) return;
        let progress = 0;
        const duration = 1400;
        const intervalTime = 25;
        const totalSteps = duration / intervalTime;

        const timer = setInterval(() => {
            progress += 1 / totalSteps;
            const ease = progress >= 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setCoverage(Math.round(ease * 100));
            setApproved(Math.min(4, Math.round(ease * 4)));
            setOrphans(Math.max(0, Math.round(12 * (1 - ease))));

            if (progress >= 1) {
                clearInterval(timer);
                setCoverage(100);
                setApproved(4);
                setOrphans(0);
            }
        }, intervalTime);

        return () => clearInterval(timer);
    }, [isInView]);

    // Before / After Draggable Slider State
    const sliderContainerRef = useRef(null);
    const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
    const [isDragging, setIsDragging] = useState(false);

    const handleSliderMove = (clientX) => {
        if (!sliderContainerRef.current) return;
        const rect = sliderContainerRef.current.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const pct = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
        setSliderPos(pct);
    };

    const handleMouseDown = () => setIsDragging(true);
    const handleMouseUp = () => setIsDragging(false);

    useEffect(() => {
        const onMouseMove = (e) => {
            if (isDragging) handleSliderMove(e.clientX);
        };
        const onTouchMove = (e) => {
            if (isDragging && e.touches[0]) handleSliderMove(e.touches[0].clientX);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging]);

    // Product Reel (16:9) Play/Pause Simulation State
    const [isPlaying, setIsPlaying] = useState(true);
    const [videoStep, setVideoStep] = useState(0);

    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => {
            setVideoStep((prev) => (prev + 1) % 5);
        }, 1600);
        return () => clearInterval(interval);
    }, [isPlaying]);

    return (
        <section
            ref={sectionRef}
            id="proof-section"
            className="tn-proof-stats-section"
            aria-label="Mathematical Proof & Verification Metrics"
        >
            <div className="tn-max-container">
                {/* ─── 1. Header Typography ─── */}
                <div className="tn-eyebrow-mono" style={{ justifyContent: 'center' }}>
                    <span className="tn-eyebrow-ping" />
                    <span>VERIFICATION METRICS // EMPIRICAL VALIDATION</span>
                </div>

                <h2 className="tn-stats-heading">
                    Engineered for zero compliance gaps.
                </h2>

                {/* ─── 2. Oversized Proof Metrics ─── */}
                <div className="tn-oversized-stats-grid">
                    <div className="tn-stat-cell">
                        <div className="tn-stat-number">{coverage}%</div>
                        <div className="tn-stat-label-mono">[ SPECIFICATION COVERAGE ]</div>
                        <p className="tn-stat-sub">100% of parsed PRD requirements mapped directly to atomic assertions.</p>
                    </div>

                    <div className="tn-stat-divider" aria-hidden="true" />

                    <div className="tn-stat-cell">
                        <div className="tn-stat-number has-accent-glow">{approved}/4</div>
                        <div className="tn-stat-label-mono">
                            <CheckCircle2 size={13} color="var(--ok)" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '6px' }} />
                            [ QUALITY GATES APPROVED ]
                        </div>
                        <p className="tn-stat-sub">Zero unreviewed tests deployed to CI/CD pipelines.</p>
                    </div>

                    <div className="tn-stat-divider" aria-hidden="true" />

                    <div className="tn-stat-cell">
                        <div className="tn-stat-number">{orphans}</div>
                        <div className="tn-stat-label-mono">[ ORPHAN ASSERTIONS ]</div>
                        <p className="tn-stat-sub">Every single test step traces back to a verified business reason.</p>
                    </div>
                </div>

                {/* ─── 3. Before / After Interactive Draggable Slider ─── */}
                <div className="tn-slider-module-wrapper">
                    <div className="tn-slider-top-label">
                        <span>BEFORE / AFTER ARCHITECTURE BENCHMARK</span>
                        <span className="tn-benchmark-tag">[ SAMPLE DATASET BENCHMARK ]</span>
                    </div>

                    <div
                        ref={sliderContainerRef}
                        className="tn-before-after-container"
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                        style={{ userSelect: 'none' }}
                    >
                        {/* RIGHT (AFTER): TestNexa Intelligence */}
                        <div className="tn-slider-layer is-after">
                            <div className="tn-layer-content">
                                <span className="tn-layer-badge is-after-badge">AFTER: TESTNEXA DETERMINISTIC</span>
                                <div className="tn-metric-stat">1.4s Synthesis &bull; 100% Traceability</div>
                                <ul className="tn-layer-points">
                                    <li>&bull; Implicit PRD ambiguities isolated automatically</li>
                                    <li>&bull; Zero orphan assertions — every step has a formal reason</li>
                                    <li>&bull; Deterministic Playwright code with cryptographic audit proof</li>
                                    <li>&bull; Zero flakiness — timing invariants and TTLs rigorously bounded</li>
                                </ul>
                            </div>
                        </div>

                        {/* LEFT (BEFORE): Manual / Legacy QA */}
                        <div
                            className="tn-slider-layer is-before"
                            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                        >
                            <div className="tn-layer-content">
                                <span className="tn-layer-badge is-before-badge">BEFORE: HEURISTIC / MANUAL QA</span>
                                <div className="tn-metric-stat">14 Days &bull; 38% Ambiguity Escape</div>
                                <ul className="tn-layer-points">
                                    <li>&bull; Edge cases missed in natural language specs</li>
                                    <li>&bull; 30%+ orphaned assertions untraceable to business goals</li>
                                    <li>&bull; Flaky tests and race conditions escaping to production</li>
                                    <li>&bull; Painful manual maintenance and compliance audit failures</li>
                                </ul>
                            </div>
                        </div>

                        {/* Draggable Divider Handle */}
                        <div
                            className="tn-slider-divider"
                            style={{ left: `${sliderPos}%` }}
                        >
                            <div className="tn-divider-handle" aria-label="Drag slider to compare Before and After">
                                <span className="tn-handle-arrow">&lsaquo;</span>
                                <span className="tn-handle-arrow">&rsaquo;</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── 4. Product Reel Slot (16:9 Aspect Ratio) ─── */}
                <div className="tn-reel-section-wrap">
                    <div className="tn-reel-header-bar">
                        <div className="tn-reel-title-group">
                            <span className="tn-pulse-dot" />
                            <span className="tn-reel-title">TESTNEXA AUTOMATION REEL // 16:9 LIVE EXECUTION</span>
                        </div>
                        <button
                            type="button"
                            className="tn-reel-play-btn"
                            onClick={() => setIsPlaying(!isPlaying)}
                            aria-label={isPlaying ? "Pause test runner reel" : "Play test runner reel"}
                        >
                            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                            <span>{isPlaying ? "PAUSE STREAM" : "RESUME STREAM"}</span>
                        </button>
                    </div>

                    <div className="tn-product-reel-slot">
                        <div className="tn-reel-terminal-screen">
                            <div className="tn-reel-top-telemetry">
                                <span>RUNNER: chromium-x64-headless</span>
                                <span>SPEC: PRD-AUTH-142.spec.ts</span>
                                <span style={{ color: "var(--ok)", fontWeight: 600 }}>STATUS: 72/72 VALIDATED</span>
                            </div>

                            <div className="tn-reel-code-feed">
                                <div className={`tn-code-line ${videoStep >= 0 ? 'is-active' : ''}`}>
                                    <span className="tn-c-num">01</span>
                                    <code>import &#123; test, expect &#125; from '@playwright/test';</code>
                                </div>
                                <div className={`tn-code-line ${videoStep >= 1 ? 'is-active' : ''}`}>
                                    <span className="tn-c-num">02</span>
                                    <code>test('TC-SEC-01: Single-use token strict TTL invariant', async (&#123; request &#125;) =&gt; &#123;</code>
                                </div>
                                <div className={`tn-code-line ${videoStep >= 2 ? 'is-active' : ''}`}>
                                    <span className="tn-c-num">03</span>
                                    <code className="tn-indent">&gt; const res = await request.post('/api/auth/reset-token', &#123; data: &#123; email: 'user@corp.internal' &#125; &#125;);</code>
                                </div>
                                <div className={`tn-code-line ${videoStep >= 3 ? 'is-active' : ''}`}>
                                    <span className="tn-c-num">04</span>
                                    <code className="tn-indent">&gt; expect(res.status()).toBe(200); expect(token.ttl).toBeLessThanOrEqual(900);</code>
                                </div>
                                <div className={`tn-code-line ${videoStep >= 4 ? 'is-active' : ''}`}>
                                    <span className="tn-c-num">05</span>
                                    <code className="tn-indent-pass">&gt; [PASS] Causal proof verified against PRD §4.2.1 // Audit hash: e3b0c44298fc1c14</code>
                                </div>
                            </div>

                            <div className="tn-reel-footer-status">
                                <div className="tn-sha-badge">
                                    <ShieldCheck size={13} color="var(--accent)" />
                                    <span>SHA-256 PROOF SEAL: 7f9a2ba3c14d9e</span>
                                </div>
                                <span className="tn-time-stamp">Recorded execution: 1.42s latency</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── 5. "Built in Public" Strip ─── */}
                <div className="tn-built-in-public-strip">
                    <div className="tn-public-col brand-col">
                        <div className="tn-public-label">BUILT IN PUBLIC // OPEN STANDARDS</div>
                        <p className="tn-public-desc">
                            Transparent engineering. Grounded in deterministic formal methods,
                            open-source testing runtimes, and zero stochastic hallucinations.
                        </p>
                    </div>

                    <div className="tn-public-col stack-col">
                        <div className="tn-public-label">VERIFIED RUNTIME STACK</div>
                        <div className="tn-stack-badges">
                            <span className="tn-stack-pill">Playwright Core</span>
                            <span className="tn-stack-pill">React 19</span>
                            <span className="tn-stack-pill">Vite 7</span>
                            <span className="tn-stack-pill">GSAP 3</span>
                            <span className="tn-stack-pill">Lenis</span>
                        </div>
                    </div>

                    <div className="tn-public-col actions-col">
                        <a
                            href="https://github.com"
                            target="_blank"
                            rel="noreferrer"
                            className="tn-public-action-btn"
                        >
                            <Github size={14} />
                            <span>GitHub Source Reference</span>
                            <ExternalLink size={12} />
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProofSection;
