import React from 'react';

/**
 * Calm, restrained background for Testnexa enterprise marketing pages.
 * Replaces generic cyan glow blobs with a clean, high-performance base and subtle technical grid.
 */
const AnimatedBackground = () => {
    return (
        <div className="tn-bg-root" aria-hidden="true">
            {/* Base dark enterprise background */}
            <div className="tn-bg-base" />
            {/* Subtle technical micro-grid */}
            <div className="tn-bg-grid" />
        </div>
    );
};

export default AnimatedBackground;
