import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const TEST_NODES = [
    {
        id: "TC-01",
        title: "Single-use reset token with strict 15m TTL",
        rationale: "Prevents persistent replay attacks and unauthorized session takeover across client devices.",
        x: 380,
        y: 75,
        path: "M 280 240 C 295 150, 335 95, 380 75"
    },
    {
        id: "TC-02",
        title: "Constant-time API response delta (≤ 120ms)",
        rationale: "Eliminates timing attack vectors that reveal whether an address exists in the database.",
        x: 485,
        y: 170,
        path: "M 280 240 C 355 260, 425 210, 485 170"
    },
    {
        id: "TC-03",
        title: "Unregistered email gets a neutral reply",
        rationale: "Prevents attackers from learning which emails have accounts.",
        x: 485,
        y: 310,
        path: "M 280 240 C 355 220, 425 270, 485 310"
    },
    {
        id: "TC-04",
        title: "Invalidate all concurrent active sessions",
        rationale: "Revokes existing browser tokens immediately upon successful credential replacement.",
        x: 380,
        y: 405,
        path: "M 280 240 C 295 330, 335 385, 380 405"
    },
    {
        id: "TC-05",
        title: "Strict client IP and account burst rate limiting",
        rationale: "Blocks brute-force flooding of transactional email and password endpoints.",
        x: 180,
        y: 405,
        path: "M 280 240 C 265 330, 225 385, 180 405"
    },
    {
        id: "TC-06",
        title: "Reject malformed RFC 5322 payloads",
        rationale: "Blocks edge-injection payloads and header-poisoning attempts at the API gateway.",
        x: 75,
        y: 310,
        path: "M 280 240 C 205 220, 135 270, 75 310"
    },
    {
        id: "TC-07",
        title: "Atomic database lock on token redemption",
        rationale: "Rejects parallel race condition submissions attempting concurrent password reuse.",
        x: 75,
        y: 170,
        path: "M 280 240 C 205 260, 135 210, 75 170"
    },
    {
        id: "TC-08",
        title: "Cryptographic HMAC audit hash generation",
        rationale: "Ensures tamper-evident compliance audit trail linking each run directly back to PRD-AUTH-004.",
        x: 180,
        y: 75,
        path: "M 280 240 C 265 150, 225 95, 180 75"
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
                            viewBox="0 0 560 480"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            {/* 8 Curved Connecting Spline Lines */}
                            {TEST_NODES.map((node) => {
                                const isActive = activeNode.id === node.id;
                                return (
                                    <path
                                        key={`spline-${node.id}`}
                                        d={node.path}
                                        fill="none"
                                        stroke={isActive ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.22)"}
                                        strokeWidth={isActive ? "1.2" : "1"}
                                        style={{
                                            transition: "stroke 0.2s ease, stroke-width 0.2s ease"
                                        }}
                                    />
                                );
                            })}

                            {/* Central Requirement Node: Solid White Circle with Black Text */}
                            <g className="tn-graph-center-group">
                                <circle
                                    cx="280"
                                    cy="240"
                                    r="36"
                                    fill="#FFFFFF"
                                />
                                <text
                                    x="280"
                                    y="235"
                                    textAnchor="middle"
                                    fill="#000000"
                                    fontFamily="'JetBrains Mono', monospace"
                                    fontSize="11"
                                    fontWeight="700"
                                    letterSpacing="0.04em"
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    PRD-AUTH
                                </text>
                                <text
                                    x="280"
                                    y="252"
                                    textAnchor="middle"
                                    fill="#000000"
                                    fontFamily="'JetBrains Mono', monospace"
                                    fontSize="11"
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
                                            r="20"
                                            fill="#050505"
                                            stroke={isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.28)"}
                                            strokeWidth={isActive ? "1.5" : "1"}
                                            style={{
                                                transition: "all 0.2s ease"
                                            }}
                                        />
                                        <text
                                            x={node.x}
                                            y={node.y + 4}
                                            textAnchor="middle"
                                            fill={isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.88)"}
                                            fontFamily="'JetBrains Mono', monospace"
                                            fontSize="10.5"
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
