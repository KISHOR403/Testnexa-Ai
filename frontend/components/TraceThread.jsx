import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export const TraceThread = () => {
    const [pageHeight, setPageHeight] = useState(6000);
    const [threadStartY, setThreadStartY] = useState(240);
    const [nodes, setNodes] = useState([]);
    const pathRef = useRef(null);
    const containerRef = useRef(null);

    const [scrollY, setScrollY] = useState(0);

    // Measure anchors and page height
    const recalculateThread = useCallback(() => {
        const root = document.querySelector('.tn-competition-root') || document.body;
        const totalHeight = Math.max(root.scrollHeight, document.documentElement.scrollHeight);
        setPageHeight(totalHeight);

        // Find starting period in hero headline
        const periodEl = document.getElementById('hero-headline-period') || document.getElementById('hero-title');
        const currentScroll = window.scrollY || window.pageYOffset;
        let startY = 240;
        if (periodEl) {
            const rect = periodEl.getBoundingClientRect();
            startY = rect.top + currentScroll + (rect.height / 2);
            setThreadStartY(startY);
        }

        const anchors = [
            { el: periodEl, name: '01 Hook & Spec' },
            { el: document.getElementById('pipeline-scene') || document.getElementById('workflow'), name: '02 Continuous Pipeline' },
            { el: document.getElementById('traceability-graph'), name: '03 Causality Graph' },
            { el: document.getElementById('proof-section'), name: '04 Verification Proof' },
            { el: document.getElementById('features-bento'), name: '05 Architecture' },
            { el: document.getElementById('design-story'), name: '06 Design Story' },
            { el: document.getElementById('final-cta-section'), name: '07 Production Suite' }
        ];

        const measuredNodes = [];
        anchors.forEach((item, index) => {
            if (item.el) {
                const rect = item.el.getBoundingClientRect();
                const topPos = rect.top + currentScroll + (index === 0 ? 0 : 36);
                measuredNodes.push({
                    id: `node-${index}`,
                    name: item.name,
                    top: topPos,
                    percent: totalHeight > 0 ? topPos / totalHeight : 0
                });
            }
        });

        setNodes(measuredNodes);

        // Update stroke dash array
        if (pathRef.current) {
            const length = pathRef.current.getTotalLength();
            pathRef.current.style.strokeDasharray = `${length}`;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            const progress = maxScroll > 0 ? Math.min(1, Math.max(0, (window.scrollY || 0) / maxScroll)) : 0;
            pathRef.current.style.strokeDashoffset = `${length * (1 - progress)}`;
        }
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const currentScroll = window.scrollY || window.pageYOffset;
            setScrollY(currentScroll);
            if (!pathRef.current) return;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            const progress = maxScroll > 0 ? Math.min(1, Math.max(0, currentScroll / maxScroll)) : 0;
            const length = pathRef.current.getTotalLength();
            pathRef.current.style.strokeDashoffset = `${length * (1 - progress)}`;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', recalculateThread, { passive: true });

        // Recalculate on ScrollTrigger refresh
        ScrollTrigger.addEventListener('refresh', recalculateThread);

        // Settle recalculation on font and image readiness
        if (document.fonts?.ready) {
            document.fonts.ready.then(recalculateThread);
        }
        window.addEventListener('load', recalculateThread);

        const initialTimer = setTimeout(recalculateThread, 200);
        const secondTimer = setTimeout(recalculateThread, 800);
        const thirdTimer = setTimeout(recalculateThread, 1800);

        return () => {
            clearTimeout(initialTimer);
            clearTimeout(secondTimer);
            clearTimeout(thirdTimer);
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', recalculateThread);
            window.removeEventListener('load', recalculateThread);
            ScrollTrigger.removeEventListener('refresh', recalculateThread);
        };
    }, [recalculateThread]);

    return (
        <aside
            ref={containerRef}
            className="tn-trace-thread-container"
            aria-label="Traceability Thread Indicator"
        >
            {/* SVG Path spanning from headline period down through full page */}
            <svg
                className="tn-thread-svg"
                style={{ height: `${pageHeight}px`, width: '40px' }}
                viewBox={`0 0 40 ${pageHeight}`}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Background Dim Guide Track */}
                <line
                    x1="20"
                    y1={threadStartY}
                    x2="20"
                    y2={pageHeight}
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                />

                {/* Glowing Active Drawn Line starting from Hero Headline Period */}
                <path
                    ref={pathRef}
                    d={`M 20 ${threadStartY} L 20 ${pageHeight}`}
                    stroke="var(--accent, #7DD3FC)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{
                        filter: 'drop-shadow(0 0 8px var(--accent-glow, rgba(125, 211, 252, 0.25)))',
                        transition: 'stroke-dashoffset 0.08s linear'
                    }}
                />
            </svg>

            {/* Checkpoint Nodes along the Thread */}
            <div className="tn-thread-nodes-layer">
                {nodes.map((node) => {
                    const isLit = (scrollY + (typeof window !== 'undefined' ? window.innerHeight * 0.45 : 400)) >= node.top;
                    return (
                        <div
                            key={node.id}
                            className={`tn-thread-stage-node ${isLit ? 'is-lit' : ''}`}
                            style={{ top: `${node.top}px` }}
                        >
                            <div className="tn-node-core" />
                            <div className="tn-node-pulse" />
                            <span className="tn-node-tooltip">{node.name}</span>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};

export default TraceThread;
