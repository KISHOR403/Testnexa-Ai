import React, { useState, useEffect } from 'react';
import TestSignalIndicator from './TestSignalIndicator';

/**
 * AppInitialLoader
 * 
 * Experience A: Initial application loading
 * Branded initialization screen shown strictly when the application boots or
 * authenticates initially. Centered, quiet, restrained contrast.
 * Transitions smoothly into the app when initialization completes without
 * replaying full-screen animations on subsequent client-side route changes.
 */
export const AppInitialLoader = ({
    isReady = false,
    message = 'Preparing your workspace',
    subMessage = 'Verifying security context & execution engine',
    onComplete
}) => {
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [isRendered, setIsRendered] = useState(true);

    useEffect(() => {
        if (isReady) {
            // Trigger smooth fade out
            setIsFadingOut(true);
            const timer = setTimeout(() => {
                setIsRendered(false);
                if (onComplete) onComplete();
            }, 320); // Matches CSS transition duration
            return () => clearTimeout(timer);
        }
    }, [isReady, onComplete]);

    if (!isRendered) return null;

    return (
        <div
            className={`tn-initial-loader ${isFadingOut ? 'is-fading-out' : ''}`}
            role="status"
            aria-live="polite"
            aria-busy={!isReady}
        >
            <div className="tn-initial-loader__container">
                {/* Signature Test Signal Motif */}
                <div className="tn-initial-loader__motif-box">
                    <TestSignalIndicator
                        size="lg"
                        showWaveform={true}
                        ariaLabel="TestNexa AI initialization in progress"
                    />
                </div>

                {/* Branded Identity */}
                <div className="tn-initial-loader__brand">
                    <div className="tn-initial-loader__title-row">
                        <span className="tn-initial-loader__name">TestNexa AI</span>
                        <span className="tn-initial-loader__badge">Core</span>
                    </div>
                    <p className="tn-initial-loader__message">
                        {message}
                    </p>
                </div>

                {/* Precision Execution Telemetry Line */}
                <div className="tn-initial-loader__telemetry">
                    <div className="tn-initial-loader__trace-track" aria-hidden="true">
                        <div className="tn-initial-loader__trace-line" />
                    </div>

                    <div className="tn-initial-loader__status-row">
                        <span className="tn-initial-loader__status-indicator">
                            <span className="tn-initial-loader__pulse-dot" />
                            <span>INITIALIZING</span>
                        </span>
                        <span>{subMessage}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppInitialLoader;
