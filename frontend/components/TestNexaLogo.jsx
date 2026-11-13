import React from 'react';

/**
 * Shared TestNexa AI Official Brand Logo Mark
 * Rendered with pure SVG vector geometry recolored to white + --accent via CSS variables.
 */
export const TestNexaLogo = ({
    size = 28,
    className = '',
    style = {},
    ...props
}) => {
    const dimension = typeof size === 'number' ? `${size}px` : size;

    return (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`tn-brand-logo-svg ${className}`.trim()}
            style={{
                width: dimension,
                height: dimension,
                display: 'inline-block',
                verticalAlign: 'middle',
                flexShrink: 0,
                ...style,
            }}
            aria-label="TestNexa AI Logo"
            {...props}
        >
            <defs>
                <linearGradient id="tnLogoAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="60%" stopColor="var(--accent, #7DD3FC)" />
                    <stop offset="100%" stopColor="var(--accent, #7DD3FC)" />
                </linearGradient>
                <filter id="tnLogoGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="var(--accent-glow, rgba(125, 211, 252, 0.4))" />
                </filter>
            </defs>

            {/* Outer Geometric Isometric Hexagon Nexus Structure in White */}
            <path
                d="M16 2.5 L27.5 9.2 V22.8 L16 29.5 L4.5 22.8 V9.2 Z"
                stroke="var(--text-1, #FFFFFF)"
                strokeWidth="1.75"
                strokeLinejoin="round"
                fill="none"
                opacity="0.95"
            />

            {/* Inner Top Facet Lines in Subtle White */}
            <path
                d="M16 2.5 V16 M4.5 9.2 L16 16 M27.5 9.2 L16 16"
                stroke="var(--text-1, #FFFFFF)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.35"
            />

            {/* Central Test Nexus Core & Cross-Vectors in Ice-Blue Accent */}
            <path
                d="M16 10 L22 14 V20 L16 23.5 L10 20 Z"
                fill="var(--accent-soft, rgba(125, 211, 252, 0.15))"
                stroke="url(#tnLogoAccentGrad)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                filter="url(#tnLogoGlow)"
            />

            {/* Inner Dynamic Nexus Node (T-N intersection spark) */}
            <circle
                cx="16"
                cy="16"
                r="2.2"
                fill="var(--text-1, #FFFFFF)"
            />
            <circle
                cx="16"
                cy="16"
                r="4"
                stroke="var(--accent, #7DD3FC)"
                strokeWidth="1"
                opacity="0.85"
            />

            {/* Connecting Traced Target Nodes */}
            <circle cx="16" cy="2.5" r="1.4" fill="var(--accent, #7DD3FC)" />
            <circle cx="27.5" cy="9.2" r="1.4" fill="var(--text-1, #FFFFFF)" />
            <circle cx="27.5" cy="22.8" r="1.4" fill="var(--accent, #7DD3FC)" />
            <circle cx="16" cy="29.5" r="1.4" fill="var(--text-1, #FFFFFF)" />
            <circle cx="4.5" cy="22.8" r="1.4" fill="var(--accent, #7DD3FC)" />
            <circle cx="4.5" cy="9.2" r="1.4" fill="var(--text-1, #FFFFFF)" />
        </svg>
    );
};

export default TestNexaLogo;
