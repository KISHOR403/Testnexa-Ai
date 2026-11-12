import React, { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import CustomCursor from '../components/CustomCursor';
import NoiseOverlay from '../components/NoiseOverlay';
import TraceThread from '../components/TraceThread';
import CompetitionHero from '../components/CompetitionHero';
import PipelineStickyScene from '../components/PipelineStickyScene';
import ProofStats from '../components/ProofStats';
import FeaturesBento from '../components/FeaturesBento';
import IntegrationsStrip from '../components/IntegrationsStrip';
import CompetitionFinalCTA from '../components/CompetitionFinalCTA';

gsap.registerPlugin(ScrollTrigger);

export const GeneratorPage = () => {
    // Sync Lenis with GSAP ScrollTrigger & Refresh on Font/Image Load
    useEffect(() => {
        const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (isReducedMotion) {
            ScrollTrigger.refresh();
            return;
        }

        const lenis = new Lenis({
            duration: 1.15,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 0.95
        });

        // 1. Sync Lenis scroll with ScrollTrigger
        lenis.on('scroll', ScrollTrigger.update);

        // 2. Drive Lenis RAF from GSAP Ticker
        const updateTicker = (time) => {
            lenis.raf(time * 1000);
        };
        gsap.ticker.add(updateTicker);
        gsap.ticker.lagSmoothing(0);

        // 3. Call ScrollTrigger.refresh() after document.fonts.ready and image loads
        const handleRefresh = () => {
            ScrollTrigger.refresh();
        };

        if (document.fonts?.ready) {
            document.fonts.ready.then(handleRefresh);
        }
        window.addEventListener('load', handleRefresh);
        window.addEventListener('resize', handleRefresh);

        // Safety layout settlement refresh
        const settleTimer = setTimeout(handleRefresh, 300);

        return () => {
            clearTimeout(settleTimer);
            window.removeEventListener('load', handleRefresh);
            window.removeEventListener('resize', handleRefresh);
            gsap.ticker.remove(updateTicker);
            lenis.destroy();
        };
    }, []);

    return (
        <div className="tn-competition-root">
            {/* 3% Film Grain Noise Overlay */}
            <NoiseOverlay />

            {/* Awwwards Custom Cursor with Dynamic Ring & Labels */}
            <CustomCursor />

            {/* Signature Concept: Absolutely Positioned Full-Page SVG Traceability Thread */}
            <TraceThread />

            {/* 1. Hero with Live Interactive Typing Demo (max-width 1100px, 14px+ text) */}
            <CompetitionHero />

            {/* 2. One Pinned Scroll-Driven Sticky Pipeline Scene (+=350%, anticipatePin: 1, scrub: 0.6) */}
            <PipelineStickyScene />

            {/* 3. Proof Stats (Oversized 120px+ Numbers, heavy weight, green glow on 4/4) */}
            <ProofStats />

            {/* 4. Features Bento Grid (Mixed Card Sizes, 3D Hover Tilt max 6deg, Cursor Border Glow) */}
            <FeaturesBento />

            {/* 5. Integrations Strip (Seamless Infinite Marquee with Left/Right Fade Masks & Pause on Hover) */}
            <IntegrationsStrip />

            {/* 6. Controlled 2-Line Headline CTA + Clean 4-Column Footer */}
            <CompetitionFinalCTA />
        </div>
    );
};

export default GeneratorPage;
