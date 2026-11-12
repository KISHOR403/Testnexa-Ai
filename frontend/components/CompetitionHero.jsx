import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, Cpu, Sparkles, Terminal } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const DEFAULT_SENTENCE = "Users must reset their password using their registered email.";

const STREAMED_TESTS = [
    {
        id: "TC-AUTH-01",
        priority: "P0",
        type: "Security Boundary",
        title: "Single-use cryptographic reset token with strict 15m TTL",
        rationale: "Resolves ambiguous 'reset' action — prevents persistent replay tokens & concurrent hijacking."
    },
    {
        id: "TC-AUTH-02",
        priority: "P0",
        type: "Anti-Enumeration",
        title: "Constant-time API response delta (≤ 120ms) across valid/invalid addresses",
        rationale: "Mitigates ambiguous 'registered' condition — prevents timing attacks probing user accounts."
    },
    {
        id: "TC-AUTH-03",
        priority: "P1",
        type: "Input Validation",
        title: "RFC 5322 syntax normalization rejecting malformed payloads with 422",
        rationale: "Bounds unspecified email syntax edge cases at the API gateway level."
    }
];

export const CompetitionHero = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    // Word-by-word reveal for headline
    const headlineWords = ["From", "requirements", "to", "verified", "acceptance."];

    // Live typing state
    const [typedText, setTypedText] = useState("");
    const [typingFinished, setTypingFinished] = useState(false);
    const [highlightAmbiguity, setHighlightAmbiguity] = useState(false);
    const [activeScan, setActiveScan] = useState(false);
    const [streamedIndex, setStreamedIndex] = useState(0);

    // User interactive test input
    const [userRequirement, setUserRequirement] = useState("");
    const [isAnalyzingCustom, setIsAnalyzingCustom] = useState(false);

    // Mouse position for cursor-following radial glow & magnetic button
    const heroRef = useRef(null);
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
    const primaryBtnRef = useRef(null);
    const secondaryBtnRef = useRef(null);

    // Typing effect loop
    useEffect(() => {
        let currentText = "";
        let charIdx = 0;
        let timer;

        const typeChar = () => {
            if (charIdx < DEFAULT_SENTENCE.length) {
                currentText += DEFAULT_SENTENCE[charIdx];
                setTypedText(currentText);
                charIdx++;
                timer = setTimeout(typeChar, 32);
            } else {
                setTypingFinished(true);
                // Trigger ambiguity pulse after typing completes
                setTimeout(() => {
                    setHighlightAmbiguity(true);
                    setActiveScan(true);
                }, 400);
            }
        };

        const startTimer = setTimeout(typeChar, 800);
        return () => {
            clearTimeout(startTimer);
            clearTimeout(timer);
        };
    }, []);

    // Stream in test cases one by one
    useEffect(() => {
        if (!activeScan) return;
        const interval = setInterval(() => {
            setStreamedIndex((prev) => {
                if (prev < STREAMED_TESTS.length) {
                    return prev + 1;
                }
                clearInterval(interval);
                return prev;
            });
        }, 700);

        return () => clearInterval(interval);
    }, [activeScan]);

    // Handle mouse move for radial glow & magnetic hover
    const handleMouseMove = (e) => {
        if (!heroRef.current) return;
        const rect = heroRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setMousePos({ x, y });

        // Magnetic effect on buttons
        [primaryBtnRef, secondaryBtnRef].forEach((ref) => {
            if (!ref.current) return;
            const bRect = ref.current.getBoundingClientRect();
            const bCenterX = bRect.left + bRect.width / 2;
            const bCenterY = bRect.top + bRect.height / 2;
            const dist = Math.hypot(e.clientX - bCenterX, e.clientY - bCenterY);
            if (dist < 100) {
                const pullX = ((e.clientX - bCenterX) / 100) * 8;
                const pullY = ((e.clientY - bCenterY) / 100) * 8;
                ref.current.style.transform = `translate(${pullX}px, ${pullY}px)`;
            } else {
                ref.current.style.transform = `translate(0px, 0px)`;
            }
        });
    };

    const handleCustomRequirementSubmit = (e) => {
        e.preventDefault();
        if (!userRequirement.trim()) return;
        setIsAnalyzingCustom(true);
        setTimeout(() => {
            setIsAnalyzingCustom(false);
            handleWorkspaceEntry('/app/workspace');
        }, 600);
    };

    const handleExploreWorkflow = (e) => {
        e.preventDefault();
        const target = document.getElementById('pipeline-scene') || document.getElementById('workflow');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <section
            ref={heroRef}
            className="tn-hero-competition"
            onMouseMove={handleMouseMove}
            aria-labelledby="hero-title"
        >
            {/* Drifting faint dot-grid */}
            <div className="tn-hero-dot-grid" aria-hidden="true" />

            {/* Faint cursor-following radial glow (max 8% opacity) */}
            <div
                className="tn-hero-glow"
                style={{
                    background: `radial-gradient(circle 500px at ${mousePos.x}% ${mousePos.y}%, rgba(56, 189, 248, 0.08), transparent 70%)`
                }}
                aria-hidden="true"
            />

            <div className="tn-max-container" style={{ position: 'relative', zIndex: 2 }}>
                {/* ─── 1. Header Typography ─── */}
                <div className="tn-hero-text-block">
                    {/* Eyebrow Label with 0.12em tracking */}
                    <div className="tn-hero-eyebrow-mono">
                        <span className="tn-eyebrow-ping" />
                        <span>INTELLIGENT QA ENGINEERING PLATFORM</span>
                    </div>

                    {/* Mask Reveal Word by Word Headline */}
                    <h1 id="hero-title" className="tn-hero-headline">
                        {headlineWords.map((word, idx) => {
                            const isGreen = word === "verified" || word.startsWith("acceptance");
                            return (
                                <span key={idx} className="tn-headline-word-mask">
                                    <motion.span
                                        initial={{ y: "115%", opacity: 0 }}
                                        animate={{ y: "0%", opacity: 1 }}
                                        transition={{
                                            duration: 0.75,
                                            delay: idx * 0.065,
                                            ease: [0.22, 1, 0.36, 1]
                                        }}
                                        className={`tn-headline-word ${isGreen ? 'is-semantic-green' : ''}`}
                                    >
                                        {word}&nbsp;
                                    </motion.span>
                                </span>
                            );
                        })}
                    </h1>

                    <p className="tn-hero-subtitle">
                        TestNexa deconstructs natural language specifications, surfaces hidden edge cases,
                        synthesizes deterministic assertions, and guarantees every test traces back to a reason.
                    </p>

                    {/* Actions: Primary White + Secondary Ghost with Magnetic Hover */}
                    <div className="tn-hero-action-buttons">
                        <a
                            ref={primaryBtnRef}
                            href={getTargetUrl('/app/workspace')}
                            className="tn-btn-primary"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                            data-cursor="Try"
                        >
                            <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                            <ArrowRight size={15} />
                        </a>

                        <button
                            ref={secondaryBtnRef}
                            type="button"
                            className="tn-btn-ghost"
                            onClick={handleExploreWorkflow}
                            data-cursor="View"
                        >
                            <span>Explore Pipeline</span>
                        </button>
                    </div>
                </div>

                {/* ─── 2. LIVE INTERACTIVE DEMO (Large & Centered) ─── */}
                <div className="tn-hero-live-demo-wrap" data-cursor="Interactive">
                    {/* Live Demo Frame */}
                    <div className="tn-live-demo-panel">
                        {/* Cyan Scanning Laser Line */}
                        {activeScan && (
                            <motion.div
                                className="tn-demo-scanline"
                                animate={{ top: ["0%", "100%", "0%"] }}
                                transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
                                aria-hidden="true"
                            />
                        )}

                        {/* Demo Terminal Header */}
                        <div className="tn-demo-header">
                            <div className="tn-demo-header-dots">
                                <span className="tn-dot red" />
                                <span className="tn-dot amber" />
                                <span className="tn-dot green" />
                            </div>
                            <div className="tn-demo-title-mono">
                                <span>SPEC_ANALYSIS_ENGINE // DOC-AUTH-2026.PRD</span>
                            </div>
                            <div className="tn-demo-status-pill">
                                <span className="tn-status-glow-cyan" />
                                <span>LIVE ENGINE</span>
                            </div>
                        </div>

                        {/* a) Typed Requirement Sentence with Ambiguity Pulse */}
                        <div className="tn-demo-input-box">
                            <span className="tn-demo-input-prefix">PRD &gt;</span>
                            <div className="tn-demo-typed-string">
                                {!typingFinished ? (
                                    <span>{typedText}<span className="tn-cursor-blink">|</span></span>
                                ) : (
                                    <span>
                                        Users must{" "}
                                        <span className={`tn-ambiguity-token ${highlightAmbiguity ? 'is-pulsing' : ''}`}>
                                            reset
                                            <span className="tn-ambiguity-tooltip">Ambiguity: unstated TTL & session policy</span>
                                        </span>{" "}
                                        their password using their{" "}
                                        <span className={`tn-ambiguity-token ${highlightAmbiguity ? 'is-pulsing' : ''}`}>
                                            registered
                                            <span className="tn-ambiguity-tooltip">Ambiguity: timing enumeration vulnerability</span>
                                        </span>{" "}
                                        email.
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Streamed Synthesized Test Cases */}
                        <div className="tn-demo-stream-container">
                            <div className="tn-demo-stream-bar">
                                <span className="tn-demo-stream-label">
                                    [ SYNTHESIZED TEST SCENARIOS &bull; STRICT ASSERTIONS ]
                                </span>
                                <span className="tn-demo-stream-counter">
                                    {streamedIndex} of 3 Generated
                                </span>
                            </div>

                            <div className="tn-demo-cards-list">
                                {STREAMED_TESTS.slice(0, streamedIndex).map((test) => (
                                    <motion.div
                                        key={test.id}
                                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                        className="tn-demo-test-card"
                                    >
                                        <div className="tn-test-card-top">
                                            <div className="tn-test-card-meta">
                                                <span className="tn-test-id-pill">{test.id}</span>
                                                <span className="tn-test-priority-pill">{test.priority}</span>
                                                <span className="tn-test-type-label">{test.type}</span>
                                            </div>

                                            {/* d) Green Traced Check */}
                                            <div className="tn-traced-indicator">
                                                <CheckCircle2 size={13} color="#22C55E" />
                                                <span>TRACED</span>
                                            </div>
                                        </div>

                                        <div className="tn-test-card-title">{test.title}</div>
                                        <div className="tn-test-card-rationale">
                                            <span className="tn-rationale-label">REASON:</span> {test.rationale}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Interactive User Input Test */}
                        <form className="tn-demo-interactive-form" onSubmit={handleCustomRequirementSubmit}>
                            <input
                                type="text"
                                className="tn-demo-user-input"
                                placeholder="Try with your own requirement (e.g. 'Admins can revoke API keys immediately')..."
                                value={userRequirement}
                                onChange={(e) => setUserRequirement(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="tn-demo-run-btn"
                                disabled={isAnalyzingCustom}
                            >
                                <Sparkles size={13} />
                                <span>{isAnalyzingCustom ? 'Deconstructing…' : 'Analyze'}</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CompetitionHero;
