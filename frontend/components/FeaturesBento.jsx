import React, { useRef } from 'react';
import { motion } from 'motion/react';
import {
    Sparkles,
    Shield,
    Workflow,
    GitBranch,
    FileCheck,
    Cpu,
    ArrowUpRight,
    Terminal,
    Layers
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

// Helper hook for 3D tilt (max 6deg) + cursor-following border glow
const useTiltEffect = () => {
    const cardRef = useRef(null);

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -6; // max -6 to 6 deg
        const rotateY = ((x - centerX) / centerX) * 6;

        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
        cardRef.current.style.setProperty('--glow-x', `${x}px`);
        cardRef.current.style.setProperty('--glow-y', `${y}px`);
    };

    const handleMouseLeave = () => {
        if (!cardRef.current) return;
        cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    };

    return { cardRef, handleMouseMove, handleMouseLeave };
};

const TiltCard = ({ className, children, ...props }) => {
    const { cardRef, handleMouseMove, handleMouseLeave } = useTiltEffect();

    return (
        <div
            ref={cardRef}
            className={`tn-bento-card tn-glow-card ${className || ''}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            {...props}
        >
            <div className="tn-card-cursor-glow" aria-hidden="true" />
            {children}
        </div>
    );
};

export const FeaturesBento = () => {
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    return (
        <section
            id="features-bento"
            className="tn-bento-section"
            aria-label="Core Engineering Capabilities"
        >
            <div className="tn-max-container">
                <div className="tn-eyebrow-mono">
                    <span className="tn-eyebrow-ping" />
                    <span>ENGINEERING CAPABILITIES // ARCHITECTURE</span>
                </div>

                <h2 className="tn-bento-heading">
                    Engineered to eradicate QA guesswork.
                </h2>

                <p className="tn-bento-lead">
                    Replace brittle manual test plans with deterministic, auditable software intelligence.
                </p>

                {/* ─── Bento Grid with Mixed Card Sizes ─── */}
                <div className="tn-bento-grid">
                    {/* Card 1: Wide Featured Card (2 Columns) — Cropped Meaningful Mockup Detail */}
                    <TiltCard className="col-span-2" data-cursor="Inspect">
                        <div className="tn-bento-card-inner">
                            <div className="tn-bento-header">
                                <span className="tn-bento-tag">[ ATOMIC ASSERTION SYNTHESIS ]</span>
                                <h3 className="tn-bento-title">Deterministic Test Generation</h3>
                                <p className="tn-bento-desc">
                                    Every generated case contains concrete assertions, timing invariants, and test data mapped to PRD clauses.
                                </p>
                            </div>

                            {/* Readable Mockup Cropped to ONE Meaningful Detail */}
                            <div className="tn-bento-mockup-crop">
                                <div className="tn-mockup-header-bar">
                                    <span className="tn-mockup-id">TC-AUTH-001</span>
                                    <span className="tn-mockup-badge">P0 &bull; RFC 5322 Syntax Gateway</span>
                                    <span className="tn-mockup-status">Approved</span>
                                </div>
                                <div className="tn-mockup-code-detail">
                                    <code>
                                        <span className="token-fn">test</span>('Assert single-use token revoked upon second submission', <span className="token-async">async</span> ({'{ page }'}) =&gt; {'{'}<br />
                                        &nbsp;&nbsp;<span className="token-await">await</span> page.<span className="token-fn">goto</span>('/api/v1/auth/reset');<br />
                                        &nbsp;&nbsp;<span className="token-fn">expect</span>(res.status).<span className="token-fn">toBe</span>(<span className="token-num">401</span>);<br />
                                        &nbsp;&nbsp;<span className="token-fn">expect</span>(res.body.error).<span className="token-fn">toBe</span>('<span className="token-str">TOKEN_ALREADY_REDEEMED</span>');<br />
                                        {'}'});
                                    </code>
                                </div>
                                <div className="tn-mockup-rationale-strip">
                                    <span className="tn-rationale-tag">VERIFIED REASON:</span>
                                    <span>Protects against replay attacks and token double-spending (DOC-AUTH-2026 PRD §4.2).</span>
                                </div>
                            </div>
                        </div>
                    </TiltCard>

                    {/* Card 2: Single Column Tall — Timing Attack Invariance */}
                    <TiltCard data-cursor="Analyze">
                        <div className="tn-bento-card-inner">
                            <div className="tn-bento-header">
                                <span className="tn-bento-tag">[ SECURITY AUDITING ]</span>
                                <h3 className="tn-bento-title">Timing Delta Auditing</h3>
                                <p className="tn-bento-desc">
                                    Detects timing leaks where attackers can deduce if an email exists by analyzing response milliseconds.
                                </p>
                            </div>

                            <div className="tn-timing-metric-box">
                                <div className="tn-delta-meter">
                                    <span className="tn-delta-value">36ms</span>
                                    <span className="tn-delta-label">Observed Delta</span>
                                </div>
                                <div className="tn-delta-threshold">Threshold: &le; 120ms standard deviation</div>
                                <div className="tn-delta-status-pill">Constant-Time Enforced</div>
                            </div>
                        </div>
                    </TiltCard>

                    {/* Card 3: Single Column Compact — Flaky Test Eradication */}
                    <TiltCard data-cursor="Inspect">
                        <div className="tn-bento-card-inner">
                            <div className="tn-bento-header">
                                <span className="tn-bento-tag">[ FLAKY ERADICATION ]</span>
                                <h3 className="tn-bento-title">Deterministic Locators</h3>
                                <p className="tn-bento-desc">
                                    Zero fragile XPath or nth-child selectors. Synthesizes accessible, resilient Playwright locators with strict auto-waiting.
                                </p>
                            </div>

                            <div className="tn-locator-spec">
                                <code>page.getByRole('button', {'{ name: "Submit" }'})</code>
                            </div>
                        </div>
                    </TiltCard>

                    {/* Card 4: Wide Card (2 Columns) — Bidirectional Traceability */}
                    <TiltCard className="col-span-2" data-cursor="Matrix">
                        <div className="tn-bento-card-inner">
                            <div className="tn-bento-header">
                                <span className="tn-bento-tag">[ AUDIT LINEAGE ]</span>
                                <h3 className="tn-bento-title">Cryptographic Traceability Matrix</h3>
                                <p className="tn-bento-desc">
                                    Every test outcome is cryptographically linked to requirement IDs and execution run timestamps for SOC 2 and ISO 29119 audits.
                                </p>
                            </div>

                            <div className="tn-mini-trace-matrix">
                                <div className="tn-mini-trace-row">
                                    <span className="tn-req-pill">DOC-AUTH §4.2.1</span>
                                    <span className="tn-connector-dot">&bull; &bull; &bull;</span>
                                    <span className="tn-case-pill">TC-FUNC-001</span>
                                    <span className="tn-connector-dot">&bull; &bull; &bull;</span>
                                    <span className="tn-proof-pill">Run #842 (Passed)</span>
                                </div>
                                <div className="tn-mini-trace-row">
                                    <span className="tn-req-pill">DOC-AUTH §4.2.2</span>
                                    <span className="tn-connector-dot">&bull; &bull; &bull;</span>
                                    <span className="tn-case-pill">TC-NEG-002</span>
                                    <span className="tn-connector-dot">&bull; &bull; &bull;</span>
                                    <span className="tn-proof-pill">Run #842 (Passed)</span>
                                </div>
                            </div>
                        </div>
                    </TiltCard>
                </div>
            </div>
        </section>
    );
};

export default FeaturesBento;
