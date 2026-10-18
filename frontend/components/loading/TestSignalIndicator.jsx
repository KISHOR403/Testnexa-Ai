import React from 'react';
import TestNexaLogo from '../TestNexaLogo';

/**
 * TestSignalIndicator
 * 
 * Signature motion visual for TestNexa AI:
 * Features a thin animated signal line moving through a precision geometric path
 * inspired by the TestNexa icon and software test verification telemetry.
 * 
 * Uses the official brand logo directly without distortion or text modification.
 */
export const TestSignalIndicator = ({
    size = 'md',
    showWaveform = true,
    className = '',
    style = {},
    statusText = '',
    ariaLabel = 'Loading verification signal'
}) => {
    // Resolve dimensions based on preset or numeric size
    const dimensionMap = {
        sm: { box: 56, logo: 24, strokeWidth: 1.25, lineDash: '32 140' },
        md: { box: 80, logo: 36, strokeWidth: 1.5, lineDash: '48 180' },
        lg: { box: 104, logo: 48, strokeWidth: 1.75, lineDash: '64 220' }
    };

    const config = typeof size === 'number'
        ? { box: size, logo: Math.round(size * 0.46), strokeWidth: 1.5, lineDash: '48 180' }
        : dimensionMap[size] || dimensionMap.md;

    const boxSize = config.box;
    const logoSize = config.logo;

    return (
        <div
            className={`tn-signal-motif ${className}`.trim()}
            style={{ width: `${boxSize}px`, height: `${boxSize}px`, ...style }}
            role="status"
            aria-label={ariaLabel}
        >
            {/* Precision Geometric SVG Frame & Signal Path */}
            <svg
                className="tn-signal-svg"
                viewBox="0 0 100 100"
                aria-hidden="true"
            >
                {/* Subtle outer alignment ticks at corners */}
                <g className="tn-signal-ticks">
                    {/* Top-left */}
                    <line x1="8" y1="20" x2="8" y2="12" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                    {/* Top-right */}
                    <line x1="92" y1="20" x2="92" y2="12" />
                    <line x1="92" y1="12" x2="84" y2="12" />
                    {/* Bottom-left */}
                    <line x1="8" y1="80" x2="8" y2="88" />
                    <line x1="8" y1="88" x2="16" y2="88" />
                    {/* Bottom-right */}
                    <line x1="92" y1="80" x2="92" y2="88" />
                    <line x1="92" y1="88" x2="84" y2="88" />
                </g>

                {/* Primary Chamfered Hexagonal/Octagonal Test Track */}
                <path
                    className="tn-signal-track"
                    d="M 32 14 L 68 14 L 86 32 L 86 68 L 68 86 L 32 86 L 14 68 L 14 32 Z"
                />

                {/* Animated Test Signal Line traversing the precision geometric circuit */}
                <path
                    className="tn-signal-line"
                    d="M 32 14 L 68 14 L 86 32 L 86 68 L 68 86 L 32 86 L 14 68 L 14 32 Z"
                    style={{ strokeDasharray: config.lineDash }}
                />

                {/* Verification Waveform at bottom if enabled */}
                {showWaveform && (
                    <>
                        <path
                            className="tn-signal-waveform-track"
                            d="M 22 93 H 40 L 44 89 L 48 97 L 52 93 L 56 93 H 78"
                        />
                        <path
                            className="tn-signal-waveform-line"
                            d="M 22 93 H 40 L 44 89 L 48 97 L 52 93 L 56 93 H 78"
                        />
                    </>
                )}
            </svg>

            {/* Inner Surface Backdrop for the Official Brand Logo */}
            <div
                className="tn-signal-ambient-ring"
                style={{
                    inset: `${Math.round(boxSize * 0.18)}px`,
                    borderRadius: '8px'
                }}
            />

            {/* Official TestNexa Logo (unredrawn, undistorted, exact asset) */}
            <div className="tn-signal-icon-wrap">
                <TestNexaLogo
                    size={logoSize}
                    alt="TestNexa AI"
                />
            </div>

            {/* Hidden accessibility text */}
            <span className="sr-only">
                {statusText || ariaLabel}
            </span>
        </div>
    );
};

export default TestSignalIndicator;
