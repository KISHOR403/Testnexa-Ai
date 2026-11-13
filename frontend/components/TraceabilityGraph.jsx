import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const TEST_NODES = [
    {
        id: "TC-01",
        title: "Single-use reset token with strict 15m TTL",
        rationale: "Prevents persistent replay attacks and unauthorized session takeover across client devices.",
        x: 380,
        y: 70,
        path: "M 290 240 C 315 160, 355 110, 380 70"
    },
    {
        id: "TC-02",
        title: "Constant-time API response delta (≤ 120ms)",
        rationale: "Eliminates timing attack vectors that reveal whether an address exists in the database.",
        x: 495,
        y: 190,
        path: "M 290 240 C 375 225, 440 205, 495 190"
    },
    {
        id: "TC-03",
        title: "Unregistered email gets a neutral reply",
        rationale: "Prevents attackers from learning which emails have accounts.",
        x: 495,
        y: 310,
        path: "M 290 240 C 385 260, 445 290, 495 310"
    },
    {
        id: "TC-04",
        title: "Invalidate all concurrent active sessions",
        rationale: "Revokes existing browser tokens immediately upon successful credential replacement.",
        x: 380,
        y: 410,
        path: "M 290 240 C 325 320, 360 370, 380 410"
    },
    {
        id: "TC-05",
        title: "Strict client IP and account burst rate limiting",
        rationale: "Blocks brute-force flooding of transactional email and password endpoints.",
        x: 200,
        y: 410,
        path: "M 290 240 C 255 320, 220 370, 200 410"
    },
    {
        id: "TC-06",
        title: "Reject malformed RFC 5322 payloads",
        rationale: "Blocks edge-injection payloads and header-poisoning attempts at the API gateway.",
        x: 85,
        y: 310,
        path: "M 290 240 C 195 260, 135 290, 85 310"
    },
    {
        id: "TC-07",
        title: "Atomic database lock on token redemption",
        rationale: "Rejects parallel race condition submissions attempting concurrent password reuse.",
        x: 85,
        y: 190,
        path: "M 290 240 C 205 225, 140 205, 85 190"
    },
    {
        id: "TC-08",
        title: "Cryptographic HMAC audit hash generation",
        rationale: "Ensures tamper-evident compliance audit trail linking each run directly back to PRD-AUTH-004.",
        x: 200,
        y: 70,
        path: "M 290 240 C 265 160, 225 110, 200 70"
    }
];

export const TraceabilityGraph = () => {
    // Default selected node to TC-03 to match reference design exactly
    const [selectedNode, setSelectedNode] = useState(TEST_NODES[2]);
    const [hoveredNode, setHoveredNode] = useState(null);

    const activeNode = hoveredNode || selectedNode || TEST_NODES[2];

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
                    An interactive causality network. Select any test node to trace its direct lineage
                    to the acceptance clause.
                </p>

                {/* 2-Card Layout Matching Reference Exactly */}
                <div className="tn-reference-graph-grid">
                    {/* ─── LEFT CARD: Interactive Radial Graph with Curved Splines ─── */}
                    <div className="tn-graph-card-left" data-cursor="Inspect">
                        <svg
                            className="tn-radial-graph-svg"
                            viewBox="0 0 580 480"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <defs>
                                <filter id="tnGraphLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(125, 211, 252, 0.7)" />
                                </filter>
                            </defs>

                            {/* 8 Curved Connecting Spline Lines */}
                            {TEST_NODES.map((node) => {
                                const isActive = activeNode.id === node.id;
                                return (
                                    <g key={`spline-${node.id}`}>
                                        <path
                                            d={node.path}
                                            fill="none"
                                            stroke={isActive ? "#7DD3FC" : "rgba(255, 255, 255, 0.22)"}
                                            strokeWidth={isActive ? "2" : "1"}
                                            style={{
                                                transition: "stroke 0.25s ease, stroke-width 0.25s ease",
                                                filter: isActive ? "url(#tnGraphLineGlow)" : "none"
                                            }}
                                        />

                                        {/* Dynamic Travelling Pulse Particle when Node is Active */}
                                        {isActive && (
                                            <circle
                                                r="3"
                                                fill="#7DD3FC"
                                                filter="url(#tnGraphLineGlow)"
                                            >
                                                <animateMotion
                                                    path={node.path}
                                                    dur="1.8s"
                                                    repeatCount="indefinite"
                                                />
                                            </circle>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Central Requirement Node: Solid White Circle with Black Text */}
                            <g className="tn-graph-center-group">
                                <circle
                                    cx="290"
                                    cy="240"
                                    r="38"
                                    fill="#FFFFFF"
                                    style={{
                                        filter: "drop-shadow(0 0 20px rgba(255, 255, 255, 0.25))"
                                    }}
                                />
                                <text
                                    x="290"
                                    y="235"
                                    textAnchor="middle"
                                    fill="#000000"
                                    fontFamily="'JetBrains Mono', monospace"
                                    fontSize="12"
                                    fontWeight="700"
                                    letterSpacing="0.04em"
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    PRD-AUTH
                                </text>
                                <text
                                    x="290"
                                    y="253"
                                    textAnchor="middle"
                                    fill="#000000"
                                    fontFamily="'JetBrains Mono', monospace"
                                    fontSize="12"
                                    fontWeight="700"
                                    letterSpacing="0.04em"
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    -004
                                </text>
                            </g>

                            {/* 8 Surrounding Test Nodes (TC-01 through TC-08) */}
                            {TEST_NODES.map((node) => {
                                const isActive = activeNode.id === node.id;
                                return (
                                    <g
                                        key={`node-${node.id}`}
                                        className="tn-test-node-item"
                                        onClick={() => setSelectedNode(node)}
                                        onMouseEnter={() => setHoveredNode(node)}
                                        onMouseLeave={() => setHoveredNode(null)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <circle
                                            cx={node.x}
                                            cy={node.y}
                                            r="23"
                                            fill="#050505"
                                            stroke={isActive ? "#7DD3FC" : "rgba(255, 255, 255, 0.28)"}
                                            strokeWidth={isActive ? "1.75" : "1"}
                                            style={{
                                                transition: "all 0.2s ease",
                                                filter: isActive ? "drop-shadow(0 0 12px rgba(125, 211, 252, 0.45))" : "none"
                                            }}
                                        />
                                        <text
                                            x={node.x}
                                            y={node.y + 4}
                                            textAnchor="middle"
                                            fill={isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.85)"}
                                            fontFamily="'JetBrains Mono', monospace"
                                            fontSize="11"
                                            fontWeight="600"
                                            letterSpacing="0.04em"
                                            style={{ pointerEvents: 'none', userSelect: 'none', transition: "fill 0.2s ease" }}
                                        >
                                            {node.id}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    {/* ─── RIGHT CARD: Editorial Detail Panel Matching Reference ─── */}
                    <div className="tn-graph-card-right">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeNode.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                className="tn-graph-detail-inner"
                            >
                                <div className="tn-graph-meta-tag">
                                    {activeNode.id} &rarr; PRD-AUTH-004
                                </div>

                                <h3 className="tn-graph-card-title">
                                    {activeNode.title}
                                </h3>

                                <p className="tn-graph-card-desc">
                                    {activeNode.rationale}
                                </p>
                            </motion.div>
                        </AnimatePresence>

                        <div className="tn-graph-card-prompt">
                            Select a test node to read its rationale.
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TraceabilityGraph;
