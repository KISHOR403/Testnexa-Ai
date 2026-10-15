import React from 'react';
import AntigravityCanvas from './AntigravityCanvas';

/**
 * Calm, restrained background for Testnexa enterprise marketing pages.
 * Includes subtle technical grid and interactive zero-gravity particle field.
 */
const AnimatedBackground = () => {
    return (
        <div className="tn-bg-root" aria-hidden="true">
            {/* Base dark enterprise background */}
            <div className="tn-bg-base" />
            {/* Subtle technical micro-grid */}
            <div className="tn-bg-grid" />
            {/* Interactive zero-gravity particles inspired by Antigravity */}
            <AntigravityCanvas />
        </div>
    );
};

export default AnimatedBackground;
