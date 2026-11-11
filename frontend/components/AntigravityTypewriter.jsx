import React, { useState, useEffect } from 'react';

/**
 * AntigravityTypewriter
 * High-precision typewriter effect where text comes letter by letter
 * with Google DeepMind Antigravity gradient text styling and sleek illuminated caret.
 *
 * Defaults to "verified acceptance." on initial paint to guarantee zero layout shift,
 * zero blank states, and instant readability.
 */
const PHRASES = [
    'verified acceptance.',
    'release-ready tests.',
    'executable Playwright suites.',
    'deterministic test graphs.'
];

export const AntigravityTypewriter = ({ staticPrefix = 'From requirements to' }) => {
    const [phraseIndex, setPhraseIndex] = useState(0);
    // Initialize with first phrase so headline is never blank or clipped on load
    const [displayedText, setDisplayedText] = useState(PHRASES[0]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [typingSpeed, setTypingSpeed] = useState(50);

    useEffect(() => {
        // Reduced motion check
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            setDisplayedText(PHRASES[0]);
            return;
        }

        const currentPhrase = PHRASES[phraseIndex];
        let timer;

        if (!isDeleting) {
            // Typing forward (letter by letter)
            if (displayedText.length < currentPhrase.length) {
                timer = setTimeout(() => {
                    setDisplayedText(currentPhrase.slice(0, displayedText.length + 1));
                    setTypingSpeed(40 + Math.random() * 20);
                }, typingSpeed);
            } else {
                // Pause at end of phrase so reader can comfortably absorb it
                timer = setTimeout(() => {
                    setIsDeleting(true);
                    setTypingSpeed(25);
                }, 3200);
            }
        } else {
            // Deleting backward smoothly
            if (displayedText.length > 0) {
                timer = setTimeout(() => {
                    setDisplayedText(currentPhrase.slice(0, displayedText.length - 1));
                    setTypingSpeed(20);
                }, typingSpeed);
            } else {
                // Switch to next phrase
                setIsDeleting(false);
                setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
                setTypingSpeed(100);
            }
        }

        return () => clearTimeout(timer);
    }, [displayedText, isDeleting, phraseIndex, typingSpeed]);

    return (
        <span className="tn-antigravity-heading-wrap" aria-label={`${staticPrefix} ${displayedText || PHRASES[phraseIndex]}`}>
            <span className="tn-heading-prefix">{staticPrefix}</span>{' '}
            <br className="tn-heading-break" />
            <span className="tn-typed-highlight">
                <span className="tn-typed-text">{displayedText}</span>
                <span className="tn-antigravity-caret" aria-hidden="true" />
            </span>
        </span>
    );
};

export default AntigravityTypewriter;
