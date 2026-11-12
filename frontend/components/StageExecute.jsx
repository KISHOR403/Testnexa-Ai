import React from 'react';
import { ArrowRight, CheckCircle2, Play, Terminal, Activity, Clock } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const TELEMETRY_STEPS = [
    {
        timestamp: '00.12s',
        event: 'SESSION_INIT',
        detail: 'Chromium headless context initialized (1280x720 viewport, trace recording enabled)',
        status: 'READY'
    },
    {
        timestamp: '00.42s',
        event: 'ASSERT_TOKEN_DISPATCH',
        detail: 'TC-FUNC-001: Verified single-use token generated (15m TTL) & delivered via mock SMTP',
        status: 'PASSED',
        delta: '38ms'
    },
    {
        timestamp: '00.68s',
        event: 'ASSERT_SYNTAX_REJECT',
        detail: 'TC-NEG-002: Malformed RFC 5322 payload rejected by gateway; HTTP 422 returned',
        status: 'PASSED',
        delta: '14ms'
    },
    {
        timestamp: '00.94s',
        event: 'ASSERT_TIMING_INVARIANCE',
        detail: 'TC-SEC-003: Account enumeration timing delta measured across 1k probes (delta: 36ms ≤ 120ms)',
        status: 'PASSED',
        delta: '36ms'
    },
    {
        timestamp: '01.38s',
        event: 'ASSERT_RATE_LIMIT',
        detail: 'TC-SEC-004: Anti-abuse throttle triggered on 6th request; HTTP 429 Retry-After enforced',
        status: 'PASSED',
        delta: '29ms'
    }
];

export const StageExecute = () => {
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    return (
        <section
            id="execute"
            className="vt-fullscreen-stage"
            aria-labelledby="heading-execute"
        >
            <div className="vt-container">
                {/* Stage Indicator & Guide */}
                <div className="vt-stage-connector-top">
                    <div className="vt-stage-marker-circle">
                        <span>04</span>
                    </div>
                    <div className="vt-stage-stem-line" aria-hidden="true" />
                </div>

                <div className="vt-eyebrow">
                    <span className="vt-eyebrow-node" />
                    <span>04 / EXECUTE &bull; RUN OBSERVABILITY</span>
                </div>

                {/* Large Editorial Headline */}
                <h2 id="heading-execute" className="vt-editorial-heading">
                    Run it. Observe it.<br />
                    <span className="vt-text-accent">Record what happened.</span>
                </h2>

                <p className="vt-lead-text">
                    Execute tests manually or trigger automated suites across environments. Inspect millisecond-level step telemetry, live assertion validation, defect diagnosis, and automated trace evidence.
                </p>

                {/* Editorial Split Composition */}
                <div className="vt-execute-grid">
                    {/* Left: Real Execution Telemetry Stream (Bare on Black Canvas) */}
                    <div className="vt-execute-telemetry-col">
                        <div className="vt-telemetry-meta-header">
                            <div>
                                <span className="vt-floating-label">[ LIVE EXECUTION TELEMETRY ]</span>
                                <div className="vt-run-id-title">Run #842 &bull; Suite: Password Recovery Matrix</div>
                            </div>
                            <div className="vt-run-badge-group">
                                <span className="vt-status-pill-passed">
                                    <CheckCircle2 size={12} />
                                    <span>24 / 24 Passed</span>
                                </span>
                                <span className="vt-duration-pill">
                                    <Clock size={12} />
                                    <span>1.42s Total</span>
                                </span>
                            </div>
                        </div>

                        {/* Telemetry Event Stream Rows */}
                        <div className="vt-telemetry-stream-list" role="feed" aria-label="Step Telemetry Stream">
                            {TELEMETRY_STEPS.map((step, idx) => (
                                <div key={idx} className="vt-telemetry-item">
                                    <div className="vt-telemetry-stem-guide" aria-hidden="true" />
                                    <div className="vt-telemetry-node" aria-hidden="true" />
                                    <div className="vt-telemetry-body">
                                        <div className="vt-telemetry-line-top">
                                            <span className="vt-telemetry-time">{step.timestamp}</span>
                                            <span className="vt-telemetry-event">{step.event}</span>
                                            {step.delta && (
                                                <span className="vt-telemetry-delta">Latency: {step.delta}</span>
                                            )}
                                            <span className="vt-telemetry-status-pill">{step.status}</span>
                                        </div>
                                        <p className="vt-telemetry-desc">{step.detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="vt-stage-action-wrap">
                            <a
                                href={getTargetUrl('/app/runs')}
                                className="vt-inline-link"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleWorkspaceEntry('/app/runs');
                                }}
                            >
                                <span>Inspect live test runs &amp; failure artifacts in workspace</span>
                                <ArrowRight size={13} />
                            </a>
                        </div>
                    </div>

                    {/* Right: Selectively Cropped Genuine Execution Interface (No Frame / Bleeds into Canvas) */}
                    <div className="vt-execute-visual-col">
                        <div className="vt-cropped-interface-canvas vt-panoramic-crop-wrap">
                            <img
                                src="/screenshots/product-canvas.png"
                                alt="TestNexa Live Run Report & Step Execution Telemetry"
                                className="vt-cropped-interface-img vt-execute-crop"
                                loading="lazy"
                            />
                            {/* Smooth Vignette Fade */}
                            <div className="vt-interface-gradient-fade" aria-hidden="true" />
                        </div>

                        {/* Floating Telemetry Footnote */}
                        <div className="vt-visual-metadata-strip">
                            <div className="vt-meta-pair">
                                <span className="vt-meta-k">ENVIRONMENT</span>
                                <span className="vt-meta-v vt-text-accent">Playwright Chromium</span>
                            </div>
                            <div className="vt-meta-sep" aria-hidden="true">&bull;</div>
                            <div className="vt-meta-pair">
                                <span className="vt-meta-k">ASSERTIONS EVALUATED</span>
                                <span className="vt-meta-v">72 Strict Checks</span>
                            </div>
                            <div className="vt-meta-sep" aria-hidden="true">&bull;</div>
                            <div className="vt-meta-pair">
                                <span className="vt-meta-k">ARTIFACT EVIDENCE</span>
                                <span className="vt-meta-v">Trace / Video / Logs</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default StageExecute;
