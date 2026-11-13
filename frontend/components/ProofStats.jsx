import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Activity, ShieldCheck, Terminal, Play, CheckCircle2, Flame } from 'lucide-react';

export const ProofStats = () => {
    const sectionRef = useRef(null);
    const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

    const [coverage, setCoverage] = useState(0);
    const [approved, setApproved] = useState(0);
    const [orphans, setOrphans] = useState(12);

    useEffect(() => {
        if (!isInView) return;

        // easeOutExpo counting animation
        let progress = 0;
        const duration = 1500;
        const intervalTime = 25;
        const totalSteps = duration / intervalTime;

        const timer = setInterval(() => {
            progress += 1 / totalSteps;
            // easeOutExpo: 1 - Math.pow(2, -10 * progress)
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

    return (
        <section
            ref={sectionRef}
            className="tn-proof-stats-section"
            aria-label="Platform Proof and Verification Metrics"
        >
            <div className="tn-max-container">
                <div className="tn-eyebrow-mono" style={{ textAlign: 'center', justifyContent: 'center' }}>
                    <span className="tn-eyebrow-ping" />
                    <span>VERIFICATION METRICS // PRODUCTION RECORD</span>
                </div>

                <h2 className="tn-stats-heading">
                    Engineered for zero compliance gaps.
                </h2>

                {/* ─── Oversized Numbers (120px+) ─── */}
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

                {/* ─── Real Run Telemetry & Interactive Simulation Slot ─── */}
                <div className="tn-real-run-card tn-glow-card" data-cursor="Simulate">
                    <div className="tn-real-run-header">
                        <div className="tn-run-left">
                            <span className="tn-pulse-badge-green">
                                <span className="tn-pulse-dot" />
                                LIVE TEST RUN #842
                            </span>
                            <span className="tn-run-repo">github.com/company/auth-service &bull; branch: main</span>
                        </div>
                        <div className="tn-run-right">
                            <span className="tn-run-telemetry-mono">EXECUTION LATENCY: 1.42s &bull; ASSERTIONS: 72/72 PASS</span>
                        </div>
                    </div>

                    <div className="tn-simulation-slot">
                        <div className="tn-simulation-left">
                            <div className="tn-sim-row">
                                <span className="tn-sim-badge pass">PASS</span>
                                <span className="tn-sim-name">test_token_ttl_15m_boundary</span>
                                <span className="tn-sim-time">38ms</span>
                            </div>
                            <div className="tn-sim-row">
                                <span className="tn-sim-badge pass">PASS</span>
                                <span className="tn-sim-name">test_rfc5322_email_syntax_normalization</span>
                                <span className="tn-sim-time">14ms</span>
                            </div>
                            <div className="tn-sim-row">
                                <span className="tn-sim-badge pass">PASS</span>
                                <span className="tn-sim-name">test_account_enumeration_timing_invariant</span>
                                <span className="tn-sim-time">36ms</span>
                            </div>
                            <div className="tn-sim-row">
                                <span className="tn-sim-badge pass">PASS</span>
                                <span className="tn-sim-name">test_anti_abuse_throttle_burst_rejection</span>
                                <span className="tn-sim-time">29ms</span>
                            </div>
                        </div>

                        <div className="tn-simulation-right">
                            <div className="tn-sim-terminal-screen">
                                <div className="tn-sim-screen-header">
                                    <Terminal size={12} color="var(--accent)" />
                                    <span>TRACED ARTIFACT EVIDENCE // SHA256:7f9a2b</span>
                                </div>
                                <div className="tn-sim-screen-body">
                                    <code>
                                        &gt; Running Playwright Test Suite...<br />
                                        &gt; [Browser]: Chromium 1280x720 Headless<br />
                                        &gt; [Coverage]: 4/4 PRD Clauses Verified<br />
                                        &gt; [Artifacts]: video.webm, trace.zip captured<br />
                                        &gt; <span style={{ color: 'var(--ok)' }}>All 24 test cases passed with cryptographic audit lineage.</span>
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProofStats;
