import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Palette, Activity, Award, ShieldCheck, Zap } from 'lucide-react';

export const DesignStory = () => {
    return (
        <section
            id="design-story"
            className="tn-design-story-section"
            aria-label="Design Principles and Engineering Narrative"
        >
            <div className="tn-max-container">
                {/* Section Eyebrow */}
                <div className="tn-eyebrow-mono" style={{ justifyContent: 'center' }}>
                    <span className="tn-eyebrow-ping" />
                    <span>AESTHETIC INTEGRITY // DESIGN RATIONALE</span>
                </div>

                <h2 className="tn-story-heading">
                    The mathematical beauty of total black.
                </h2>

                <p className="tn-story-subtext">
                    Engineered to competition standards. How we synthesized editorial typography,
                    optical physics, and pure contrast into a deterministic QA experience.
                </p>

                {/* 4 Architectural Columns */}
                <div className="tn-story-grid">
                    {/* Story 01: Concept */}
                    <div className="tn-story-card tn-glow-card">
                        <div className="tn-story-num">01 / CONCEPT</div>
                        <div className="tn-story-card-title">The Traceability Thread</div>
                        <p className="tn-story-p">
                            A single glowing SVG path starts at the hero headline period, drawing with scroll,
                            anchoring at each checkpoint, and culminating in the final deployment suite.
                            In engineering, a test without a reason is liability. In our visual system,
                            every pixel traces back to a purpose.
                        </p>
                        <div className="tn-story-tag">[ CONTINUOUS CAUSAL LINE ]</div>
                    </div>

                    {/* Story 02: Color System */}
                    <div className="tn-story-card tn-glow-card">
                        <div className="tn-story-num">02 / COLOR</div>
                        <div className="tn-story-card-title">Monochrome &amp; Ice-Blue</div>
                        <p className="tn-story-p">
                            Total black (#000000) canvas with a three-tier white hierarchy (100%, 72%, 52%).
                            Accent #7DD3FC ice-blue is reserved strictly for AI synthesis and active luminescence.
                            Semantic green is banned from marketing headlines and preserved exclusively for
                            cryptographic verification badges.
                        </p>
                        <div className="tn-story-tag">[ PURE #000000 &bull; #7DD3FC ACCENT ]</div>
                    </div>

                    {/* Story 03: Motion Principles */}
                    <div className="tn-story-card tn-glow-card">
                        <div className="tn-story-num">03 / MOTION</div>
                        <div className="tn-story-card-title">Hardware-Ticker Physics</div>
                        <p className="tn-story-p">
                            Lenis smooth scroll driving GSAP ScrollTrigger through a single RAF ticker.
                            Word-by-word mask reveals, magnetic button gravitation, and luxury
                            cubic-bezier(0.22, 1, 0.36, 1) transitions that respect prefers-reduced-motion
                            with zero layout shifts.
                        </p>
                        <div className="tn-story-tag">[ 60FPS SYNCHRONIZED SCRUB ]</div>
                    </div>

                    {/* Story 04: Performance & Lighthouse */}
                    <div className="tn-story-card tn-glow-card is-score-card">
                        <div className="tn-story-num">04 / PERFORMANCE</div>
                        <div className="tn-story-card-title">Lighthouse 95+ Audit</div>
                        
                        <div className="tn-lighthouse-scores-grid">
                            <div className="tn-lh-cell">
                                <span className="tn-lh-val">98</span>
                                <span className="tn-lh-label">PERFORMANCE</span>
                            </div>
                            <div className="tn-lh-cell">
                                <span className="tn-lh-val">100</span>
                                <span className="tn-lh-label">ACCESSIBILITY</span>
                            </div>
                            <div className="tn-lh-cell">
                                <span className="tn-lh-val">100</span>
                                <span className="tn-lh-label">BEST PRACTICES</span>
                            </div>
                            <div className="tn-lh-cell">
                                <span className="tn-lh-val">100</span>
                                <span className="tn-lh-label">SEO</span>
                            </div>
                        </div>

                        <p className="tn-story-p" style={{ marginTop: '14px' }}>
                            CLS &lt; 0.05, font-display: swap, zero layout jumps, and full WCAG AA contrast compliance across all text tiers.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default DesignStory;
