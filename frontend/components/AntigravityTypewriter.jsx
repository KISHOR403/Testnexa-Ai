import React, { useState, useEffect } from 'react';

/**
 * AntigravityTypewriter
 * High-precision typewriter effect with iridescent glowing cursor
 * inspired by Google Antigravity's interactive headline typing.
 */
const PHRASES = [
    'release-ready tests.',
    'executable Playwright suites.',
    'verified acceptance criteria.',
    'deterministic test graphs.'
];

export const AntigravityTypewriter = ({ staticPrefix = 'From requirements to' }) => {
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState(PHRASES[0]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [typingSpeed, setTypingSpeed] = useState(70);

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
            // Typing forward
            if (displayedText.length < currentPhrase.length) {
                timer = setTimeout(() => {
                    setDisplayedText(currentPhrase.slice(0, displayedText.length + 1));
                    setTypingSpeed(45 + Math.random() * 35); // human-like variance
                }, typingSpeed);
            } else {
                // Pause at end of phrase
                timer = setTimeout(() => {
                    setIsDeleting(true);
                    setTypingSpeed(30);
                }, 2600);
            }
        } else {
            // Deleting backward
            if (displayedText.length > 0) {
                timer = setTimeout(() => {
                    setDisplayedText(currentPhrase.slice(0, displayedText.length - 1));
                    setTypingSpeed(25);
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
        <span className="tn-antigravity-heading-wrap" aria-label={`${staticPrefix} ${displayedText}`}>
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
