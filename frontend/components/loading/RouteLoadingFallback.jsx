import React, { useState, useEffect } from 'react';
import TestSignalIndicator from './TestSignalIndicator';

/**
 * RouteLoadingFallback
 * 
 * Used for React Router lazy route suspense boundaries.
 * Preserves the page layout without blank flashes or full-screen takeovers.
 * Renders a razor-thin top signal bar, plus a restrained centered indicator
 * only if the chunk retrieval takes more than 120ms.
 */
export const RouteLoadingFallback = ({ label = 'Loading view' }) => {
    const [showCenterIndicator, setShowCenterIndicator] = useState(false);

    useEffect(() => {
        // Only show centered indicator if route takes longer than 120ms to avoid flicker
        const timer = setTimeout(() => setShowCenterIndicator(true), 120);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            className="tn-route-loading-fallback"
            role="status"
            aria-live="polite"
            aria-label={label}
        >
            {/* Top Layout-Preserving Signal Line */}
            <div className="tn-route-top-signal" aria-hidden="true">
                <div className="tn-route-top-signal-bar" />
            </div>

            {/* Restrained Quiet Indicator */}
            {showCenterIndicator && (
                <div className="tn-route-quiet-center">
                    <TestSignalIndicator size="sm" showWaveform={false} />
                    <span className="tn-route-quiet-text">
                        Loading workspace module…
                    </span>
                </div>
            )}
        </div>
    );
};

export default RouteLoadingFallback;
