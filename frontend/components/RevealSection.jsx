import React from 'react';
import useScrollReveal from '../hooks/useScrollReveal';

/**
 * RevealSection — Scroll-triggered staggered reveal for marketing sections.
 *
 * Wraps a section header group (eyebrow → heading → description → content)
 * and applies a subtle translateY + opacity entrance animation when the
 * section first enters the viewport.
 *
 * Usage:
 *   <RevealSection>
 *     <span className="tn-kicker">Label</span>
 *     <h2>Heading</h2>
 *     <p>Description</p>
 *   </RevealSection>
 *
 * The component adds CSS classes; all animation is driven by CSS transitions
 * for maximum performance (opacity + transform only, GPU-composited).
 */
const RevealSection = ({
    children,
    className = '',
    as: Tag = 'div',
    threshold = 0.15,
    rootMargin = '0px 0px -10% 0px',
    ...rest
}) => {
    const { ref, isVisible } = useScrollReveal({
        threshold,
        rootMargin,
        triggerOnce: true,
    });

    return (
        <Tag
            ref={ref}
            className={`tn-reveal-group ${isVisible ? 'is-revealed' : ''} ${className}`}
            {...rest}
        >
            {children}
        </Tag>
    );
};

/**
 * RevealBlock — Single-element scroll reveal (for product previews, cards, etc.)
 *
 * Unlike RevealSection which staggers its children, RevealBlock animates
 * as a single unit with a configurable delay.
 *
 * Usage:
 *   <RevealBlock delay={220}>
 *     <div className="product-preview">...</div>
 *   </RevealBlock>
 */
const RevealBlock = ({
    children,
    className = '',
    as: Tag = 'div',
    delay = 0,
    threshold = 0.12,
    rootMargin = '0px 0px -8% 0px',
    ...rest
}) => {
    const { ref, isVisible } = useScrollReveal({
        threshold,
        rootMargin,
        triggerOnce: true,
    });

    const style = delay > 0 ? { transitionDelay: `${delay}ms` } : undefined;

    return (
        <Tag
            ref={ref}
            className={`tn-reveal-block ${isVisible ? 'is-revealed' : ''} ${className}`}
            style={style}
            {...rest}
        >
            {children}
        </Tag>
    );
};

export { RevealSection, RevealBlock };
export default RevealSection;
