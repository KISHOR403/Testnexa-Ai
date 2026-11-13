import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, CheckCircle2, Terminal, Sparkles, Cpu, Layers } from 'lucide-react';

const REQUIREMENT_NODE = {
    id: "PRD-AUTH-142",
    title: "Password Recovery & Reset Protocol",
    clause: "PRD §4.2.1: Users must reset passwords using verified email with zero token reuse or enumeration leakage."
};

const TEST_NODES = [
    {
        id: "TC-SEC-01",
        label: "Crypto Single-Use TTL",
        tag: "P0 Security",
        angle: 0,
        distance: 220,
        assertion: "expect(token.ttl).toBeLessThanOrEqual(900);",
        rationale: "Resolves ambiguous 'reset' action: prevents persistent replay tokens and concurrent hijacking across devices."
    },
    {
        id: "TC-TIME-02",
        label: "Timing Invariant Delta",
        tag: "P0 Anti-Enumeration",
        angle: 36,
        distance: 210,
        assertion: "expect(Math.abs(t_valid - t_invalid)).toBeLessThanOrEqual(120);",
        rationale: "Mitigates account probe attacks: enforces constant-time response delta whether email exists or not."
    },
    {
        id: "TC-SYN-03",
        label: "RFC 5322 Normalization",
        tag: "P1 Gateway Syntax",
        angle: 72,
        distance: 230,
        assertion: "expect(res.status).toBe(422); expect(res.body.code).toBe('RFC_ERR');",
        rationale: "Defends against malformed Unicode and multi-byte injections at the API edge before reaching DB."
    },
    {
        id: "TC-RATE-04",
        label: "Burst Request Throttle",
        tag: "P0 Anti-Abuse",
        angle: 108,
        distance: 200,
        assertion: "expect(res_throttle.status).toBe(429); expect(res.headers['retry-after']).toBe('3600');",
        rationale: "Prevents automated flooding of downstream transactional mail queues by client IP & target account."
    },
    {
        id: "TC-SESS-05",
        label: "Global Session Revocation",
        tag: "P0 Session Boundary",
        angle: 144,
        distance: 225,
        assertion: "expect(activeSessions.filter(s => s.status === 'valid')).toHaveLength(0);",
        rationale: "Invalidates all concurrent browser refresh tokens upon password change completion."
    },
    {
        id: "TC-AUD-06",
        label: "Cryptographic Audit Lineage",
        tag: "P1 Compliance",
        angle: 180,
        distance: 220,
        assertion: "expect(sha256(executionTrace)).toEqual(expectedAuditSeal);",
        rationale: "Generates tamper-evident cryptographic hash chain linking test artifact directly to source clause."
    },
    {
        id: "TC-REPL-07",
        label: "Concurrent Replay Guard",
        tag: "P0 Idempotency",
        angle: 216,
        distance: 215,
        assertion: "expect(res_second_call.status).toBe(409);",
        rationale: "Asserts immediate atomic database lock: rejects dual parallel submission of the identical token."
    },
    {
        id: "TC-GATE-08",
        label: "Header Sanitization",
        tag: "P1 Edge Defense",
        angle: 252,
        distance: 230,
        assertion: "expect(headers['x-forwarded-host']).toBeNull();",
        rationale: "Guarantees reset link URL host is bound strictly to whitelist, blocking host-header poison vectors."
    },
    {
        id: "TC-NOTIF-09",
        label: "Out-of-Band Notification",
        tag: "P2 Notification",
        angle: 288,
        distance: 205,
        assertion: "expect(audit_queue.contains('PASSWD_RESET_ALERT')).toBe(true);",
        rationale: "Asserts parallel asynchronous security alert email dispatched to prevent unmonitored silent takeovers."
    },
    {
        id: "TC-CLEAN-10",
        label: "Ephemeral Token Scrubber",
        tag: "P1 Reliability",
        angle: 324,
        distance: 225,
        assertion: "expect(redis.exists(token_key)).toBe(0);",
        rationale: "Verifies memory-resident transient credentials purge within 50ms of verification confirmation."
    }
];

export const TraceabilityGraph = () => {
    const [hoveredNode, setHoveredNode] = useState(null);
    const [clickedNode, setClickedNode] = useState(null);
    const [pulseProgress, setPulseProgress] = useState(0);

    const handleNodeClick = (node) => {
        setClickedNode(node);
        setPulseProgress(0);
        let p = 0;
        const interval = setInterval(() => {
            p += 0.08;
            if (p >= 1) {
                setPulseProgress(1);
                clearInterval(interval);
            } else {
                setPulseProgress(p);
            }
        }, 20);
    };

    // Calculate Cartesian coordinates from polar coordinates for SVG
    const centerX = 360;
    const centerY = 280;

    return (
        <section
            id="traceability-graph"
            className="tn-graph-section"
            aria-label="Interactive Requirement Traceability Graph"
        >
            <div className="tn-max-container">
                {/* Section Header */}
                <div className="tn-eyebrow-mono" style={{ justifyContent: 'center' }}>
                    <span className="tn-eyebrow-ping" />
                    <span>CRYPTOGRAPHIC AUDIT GRAPH // CAUSAL PROOFS</span>
                </div>

                <h2 className="tn-graph-heading">
                    Every test traces back to a reason.
                </h2>

                <p className="tn-graph-subtext">
                    An interactive causality network. Hover any test node to trace its direct lineage
                    to the acceptance clause, or click to verify the mathematical audit pulse.
                </p>

                {/* Desktop Interactive SVG Graph (Hidden on mobile) */}
                <div className="tn-graph-canvas-wrapper" data-cursor="Trace">
                    <svg
                        className="tn-graph-svg"
                        viewBox="0 0 720 560"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <linearGradient id="tnPathGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#FFFFFF" />
                                <stop offset="100%" stopColor="#7DD3FC" />
                            </linearGradient>
                            <filter id="tnGraphPulseGlow">
                                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(125, 211, 252, 0.55)" />
                            </filter>
                        </defs>

                        {/* Background Radar Conic Guides */}
                        <circle cx={centerX} cy={centerY} r="120" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3 3" fill="none" />
                        <circle cx={centerX} cy={centerY} r="220" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="4 4" fill="none" />

                        {/* Connecting Line Paths */}
                        {TEST_NODES.map((node) => {
                            const rad = (node.angle * Math.PI) / 180;
                            const x = centerX + Math.cos(rad) * node.distance;
                            const y = centerY + Math.sin(rad) * node.distance;

                            const isHovered = hoveredNode?.id === node.id;
                            const isDimmed = hoveredNode && !isHovered;

                            return (
                                <g key={`path-${node.id}`}>
                                    <line
                                        x1={centerX}
                                        y1={centerY}
                                        x2={x}
                                        y2={y}
                                        stroke={isHovered ? "var(--accent)" : "rgba(255, 255, 255, 0.12)"}
                                        strokeWidth={isHovered ? "2.5" : "1"}
                                        strokeDasharray={isHovered ? "none" : "3 3"}
                                        style={{
                                            transition: "all 0.25s ease",
                                            opacity: isDimmed ? 0.15 : 1,
                                            filter: isHovered ? "url(#tnGraphPulseGlow)" : "none"
                                        }}
                                    />

                                    {/* Click Animated Pulse Travelling from Center to Node */}
                                    {clickedNode?.id === node.id && (
                                        <circle
                                            cx={centerX + (x - centerX) * pulseProgress}
                                            cy={centerY + (y - centerY) * pulseProgress}
                                            r="4"
                                            fill="var(--accent)"
                                            filter="url(#tnGraphPulseGlow)"
                                        />
                                    )}
                                </g>
                            );
                        })}

                        {/* 10 Test Nodes */}
                        {TEST_NODES.map((node) => {
                            const rad = (node.angle * Math.PI) / 180;
                            const x = centerX + Math.cos(rad) * node.distance;
                            const y = centerY + Math.sin(rad) * node.distance;

                            const isHovered = hoveredNode?.id === node.id;
                            const isDimmed = hoveredNode && !isHovered;

                            return (
                                <g
                                    key={`node-${node.id}`}
                                    className="tn-graph-node-group"
                                    onMouseEnter={() => setHoveredNode(node)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    onClick={() => handleNodeClick(node)}
                                    style={{
                                        cursor: "pointer",
                                        transition: "opacity 0.25s ease",
                                        opacity: isDimmed ? 0.2 : 1
                                    }}
                                >
                                    {/* Outer Hover Ring */}
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={isHovered ? "20" : "14"}
                                        fill="#050505"
                                        stroke={isHovered ? "var(--accent)" : "rgba(255, 255, 255, 0.25)"}
                                        strokeWidth={isHovered ? "2" : "1"}
                                        style={{ transition: "all 0.2s ease" }}
                                    />

                                    {/* Inner Core */}
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={isHovered ? "7" : "5"}
                                        fill={isHovered ? "var(--accent)" : "#FFFFFF"}
                                        style={{ transition: "all 0.2s ease" }}
                                    />

                                    {/* Node ID Mono Label */}
                                    <text
                                        x={x}
                                        y={y + (y > centerY ? 28 : -22)}
                                        textAnchor="middle"
                                        fill={isHovered ? "var(--accent)" : "rgba(255, 255, 255, 0.65)"}
                                        fontFamily="'JetBrains Mono', monospace"
                                        fontSize="11"
                                        letterSpacing="0.06em"
                                        style={{ transition: "fill 0.2s ease", pointerEvents: "none" }}
                                    >
                                        {node.id}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Central Requirement Nexus Node */}
                        <g className="tn-graph-center-node">
                            <circle
                                cx={centerX}
                                cy={centerY}
                                r="42"
                                fill="#080808"
                                stroke="var(--accent)"
                                strokeWidth="2"
                                filter="url(#tnGraphPulseGlow)"
                            />
                            <circle
                                cx={centerX}
                                cy={centerY}
                                r="48"
                                stroke="rgba(125, 211, 252, 0.3)"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                                fill="none"
                            />
                            <text
                                x={centerX}
                                y={centerY - 6}
                                textAnchor="middle"
                                fill="#FFFFFF"
                                fontFamily="'Space Grotesk', sans-serif"
                                fontSize="12"
                                fontWeight="600"
                            >
                                PRD CLAUSE
                            </text>
                            <text
                                x={centerX}
                                y={centerY + 12}
                                textAnchor="middle"
                                fill="var(--accent)"
                                fontFamily="'JetBrains Mono', monospace"
                                fontSize="10"
                                letterSpacing="0.08em"
                            >
                                §4.2 AUTH
                            </text>
                        </g>
                    </svg>

                    {/* Interactive Rationale Inspection Card */}
                    <div className="tn-graph-detail-panel">
                        <div className="tn-detail-header">
                            <span className="tn-detail-tag">
                                {hoveredNode ? hoveredNode.tag : "[ SELECT ANY NODE TO INSPECT CAUSALITY ]"}
                            </span>
                            <span className="tn-detail-id">
                                {hoveredNode ? hoveredNode.id : REQUIREMENT_NODE.id}
                            </span>
                        </div>

                        <div className="tn-detail-title">
                            {hoveredNode ? hoveredNode.label : REQUIREMENT_NODE.title}
                        </div>

                        <div className="tn-detail-clause">
                            <span className="tn-clause-k">ORIGIN:</span> {REQUIREMENT_NODE.clause}
                        </div>

                        {hoveredNode && (
                            <>
                                <div className="tn-detail-assertion">
                                    <code>{hoveredNode.assertion}</code>
                                </div>
                                <div className="tn-detail-rationale">
                                    <span className="tn-rationale-k">FORMAL REASON:</span> {hoveredNode.rationale}
                                </div>
                            </>
                        )}

                        <div className="tn-detail-status-bar">
                            <div className="tn-audit-seal">
                                <CheckCircle2 size={13} color="var(--ok)" />
                                <span>100% Cryptographically Bound</span>
                            </div>
                            <span className="tn-audit-badge">Zero Orphan Tests</span>
                        </div>
                    </div>
                </div>

                {/* Mobile Static Fallback (Single-Column High-Density List) */}
                <div className="tn-graph-mobile-fallback">
                    <div className="tn-mobile-req-card">
                        <div className="tn-req-tag">ROOT CLAUSE: {REQUIREMENT_NODE.id}</div>
                        <div className="tn-req-title">{REQUIREMENT_NODE.title}</div>
                        <p className="tn-req-p">{REQUIREMENT_NODE.clause}</p>
                    </div>

                    <div className="tn-mobile-nodes-list">
                        {TEST_NODES.slice(0, 6).map((node) => (
                            <div key={`m-${node.id}`} className="tn-mobile-test-card">
                                <div className="tn-m-top">
                                    <span className="tn-m-id">{node.id}</span>
                                    <span className="tn-m-tag">{node.tag}</span>
                                    <CheckCircle2 size={12} color="var(--ok)" style={{ marginLeft: "auto" }} />
                                </div>
                                <div className="tn-m-title">{node.label}</div>
                                <div className="tn-m-rationale">{node.rationale}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TraceabilityGraph;
