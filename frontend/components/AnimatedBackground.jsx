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
            <div className="tn-bg-base" />
            {/* Teal radial glow — top center */}
            <div className="tn-bg-glow tn-bg-glow--teal" />
            {/* Violet radial glow — bottom right */}
            <div className="tn-bg-glow tn-bg-glow--violet" />
            {/* Subtle dot grid */}
            <div className="tn-bg-grid" />
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
