import React, { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import CustomCursor from '../components/CustomCursor';
import NoiseOverlay from '../components/NoiseOverlay';
import BrandIntro from '../components/BrandIntro';
import TraceThread from '../components/TraceThread';
import CompetitionHero from '../components/CompetitionHero';
import PipelineStickyScene from '../components/PipelineStickyScene';
import TraceabilityGraph from '../components/TraceabilityGraph';
import ProofSection from '../components/ProofSection';
import FeaturesBento from '../components/FeaturesBento';
import DesignStory from '../components/DesignStory';
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

        // Expose lenis instance globally for smooth navbar and anchor transitions
        window.__lenis = lenis;

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
            delete window.__lenis;
            window.removeEventListener('load', handleRefresh);
            window.removeEventListener('resize', handleRefresh);
            gsap.ticker.remove(updateTicker);
            lenis.destroy();
        };
    }, []);

    return (
        <div className="tn-competition-root">
            {/* 1-Second Skippable Brand Intro Animation */}
            <BrandIntro />

            {/* 3% Film Grain Noise Overlay */}
            <NoiseOverlay />

            {/* Awwwards Custom Cursor with Dynamic Ring & Labels */}
            <CustomCursor />

            {/* Signature Concept: Absolutely Positioned Full-Page SVG Traceability Thread */}
            <TraceThread />

            {/* 1. Hook & Live Interactive Typing Demo */}
            <CompetitionHero />

            {/* 2. One Pinned Scroll-Driven Sticky Pipeline Scene */}
            <PipelineStickyScene />

            {/* 3. Signature Causality Visual: Interactive Traceability Graph */}
            <TraceabilityGraph />

            {/* 4. Proof: Oversized Metrics, Before/After Slider, 16:9 Reel, Built in Public */}
            <ProofSection />

            {/* 5. Features Bento Grid (Mixed Card Sizes, 3D Hover Tilt, Cursor Glow) */}
            <FeaturesBento />

            {/* 6. Design Story: Concept, Color, Motion, Lighthouse 95+ Audit */}
            <DesignStory />

            {/* 7. Integrations Strip (Seamless Infinite Marquee with Edge Fade Masks) */}
            <IntegrationsStrip />

            {/* 8. Controlled 2-Line Headline CTA + Clean 4-Column Footer */}
            <CompetitionFinalCTA />
        </div>
    );
};

export default GeneratorPage;
