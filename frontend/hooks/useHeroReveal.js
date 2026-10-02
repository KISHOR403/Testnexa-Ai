import { useEffect, useState, useRef } from 'react';

/**
 * HeroReveal — Page-load entrance animation for the hero section.
 *
 * Unlike scroll-triggered reveals, this fires once on mount after a short
 * requestAnimationFrame to ensure the initial hidden state paints before
 * the transition begins (avoiding FOUC).
 *
 * Returns `isRevealed` boolean and a ref. Apply the ref to the hero wrapper.
 * The CSS handles the actual animation via `.tn-hero-reveal.is-revealed`.
 */
const useHeroReveal = () => {
    const [isRevealed, setIsRevealed] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        // Double-rAF ensures the browser has painted the initial hidden state
        // before we flip the class, guaranteeing the transition runs.
        const frameId = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setIsRevealed(true);
            });
        });

        return () => cancelAnimationFrame(frameId);
    }, []);

    return { ref, isRevealed };
};

export default useHeroReveal;
