import React from 'react';

/**
 * Premium CSS-only background for the Testnexa AI landing page.
 * Replaces the heavy canvas particle system with performant CSS gradients,
 * noise texture, and subtle grid pattern.
 */
const AnimatedBackground = () => {
    return (
        <div className="tn-bg-root" aria-hidden="true">
            {/* Base gradient layer */}
            <div className="tn-bg-base" data-parallax-offset="-10" data-parallax-type="hero" />
            {/* Subtle ambient glow — top center */}
            <div className="tn-bg-glow tn-bg-glow--teal" data-parallax-offset="-15" data-parallax-type="hero" />
            {/* Subtle dot grid */}
            <div className="tn-bg-grid" data-parallax-offset="-5" data-parallax-type="hero" />
            {/* Noise/grain texture overlay */}
            <svg className="tn-bg-noise" aria-hidden="true">
                <filter id="tn-noise-filter">
                    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#tn-noise-filter)" opacity="0.03" />
            </svg>
        </div>
    );
};

export default AnimatedBackground;
