import React from 'react';

/**
 * Shared TestNexa AI Official Brand Logo Component
 * Renders the official brand symbol with true RGBA transparency.
 * Preserves exact foreground symbol geometry, colors, and aspect ratio.
 */
export const TestNexaLogo = ({
    size = 28,
    className = '',
    style = {},
    alt = 'TestNexa AI',
    ...props
}) => {
    const dimension = typeof size === 'number' ? `${size}px` : size;

    return (
        <img
            src="/testnexa-logo.png"
            alt={alt}
            width={typeof size === 'number' ? size : undefined}
            height={typeof size === 'number' ? size : undefined}
            className={`tn-brand-logo-img ${className}`.trim()}
            style={{
                width: dimension,
                height: dimension,
                objectFit: 'contain',
                display: 'inline-block',
                verticalAlign: 'middle',
                flexShrink: 0,
                ...style,
            }}
            draggable={false}
            {...props}
        />
    );
};

export default TestNexaLogo;
