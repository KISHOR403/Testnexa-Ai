import React, { useState, useEffect } from 'react';

const CHAPTER_STAGES = [
    { id: 'product-canvas', label: '01 Canvas' },
    { id: 'transformation', label: '02 Intelligence' },
    { id: 'workflow', label: '03 Workflow' },
    { id: 'review-risk', label: '04 Review & Risk' },
    { id: 'traceability', label: '05 Traceability' },
    { id: 'integrations', label: '06 Pipeline' }
];

export const GlobalWorkflowIndicator = () => {
    const [activeSection, setActiveSection] = useState('workflow');
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY || window.pageYOffset;
            const heroHeight = window.innerHeight * 0.7;

            // Check if user has reached the final CTA section or footer
            const finalCtaEl = document.getElementById('final-cta');
            const footerEl = document.querySelector('.tn-footer');
            let isPastChapters = false;

            if (window.location.hash === '#final-cta') {
                isPastChapters = true;
            }

            if (finalCtaEl) {
                const rect = finalCtaEl.getBoundingClientRect();
                // If final CTA has entered the viewport at all, hide indicator
                if (rect.top <= window.innerHeight) {
                    isPastChapters = true;
                }
            }

            if (footerEl) {
                const fRect = footerEl.getBoundingClientRect();
                if (fRect.top <= window.innerHeight) {
                    isPastChapters = true;
                }
            }

            // Also check if near bottom of page
            const isNearBottom = (window.innerHeight + scrollY) >= (document.documentElement.scrollHeight - 300);

            // Only show after scrolling past top of hero and while strictly within chapters 1-6
            setIsVisible(scrollY > heroHeight && !isPastChapters && !isNearBottom);

            // Find current active section
            for (let i = CHAPTER_STAGES.length - 1; i >= 0; i--) {
                const el = document.getElementById(CHAPTER_STAGES[i].id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top <= window.innerHeight * 0.45) {
                        setActiveSection(CHAPTER_STAGES[i].id);
                        break;
                    }
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll, { passive: true });
        window.addEventListener('hashchange', handleScroll, { passive: true });

        // Initial check and periodic checks on mount to catch late anchor scroll jumps
        handleScroll();
        const pollInterval = setInterval(handleScroll, 100);
        const stopPollTimer = setTimeout(() => clearInterval(pollInterval), 3000);

        // Native IntersectionObserver for immediate reactive visibility change
        let observer;
        const finalCtaEl = document.getElementById('final-cta');
        const footerEl = document.querySelector('.tn-footer');
        if (typeof IntersectionObserver !== 'undefined') {
            observer = new IntersectionObserver(() => {
                handleScroll();
            }, { threshold: [0, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0] });

            if (finalCtaEl) observer.observe(finalCtaEl);
            if (footerEl) observer.observe(footerEl);
        }

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
            window.removeEventListener('hashchange', handleScroll);
            clearInterval(pollInterval);
            clearTimeout(stopPollTimer);
            if (observer) observer.disconnect();
        };
    }, []);

    const scrollTo = (id) => {
        const el = document.getElementById(id);
        if (el) {
            const yOffset = -70;
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    if (!isVisible) return null;

    return (
        <aside 
            className="tn-global-workflow-indicator is-visible" 
            aria-label="Page Chapter Navigator"
        >
            <div className="tn-gwi-track" />
            <div className="tn-gwi-steps">
                {CHAPTER_STAGES.map((step) => {
                    const isActive = activeSection === step.id;
                    return (
                        <button
                            key={step.id}
                            type="button"
                            onClick={() => scrollTo(step.id)}
                            className={`tn-gwi-step-btn ${isActive ? 'is-active' : ''}`}
                            aria-label={`Jump to Chapter: ${step.label}`}
                            aria-current={isActive ? 'true' : undefined}
                        >
                            <span className="tn-gwi-dot">
                                {isActive && <span className="tn-gwi-dot-inner" />}
                            </span>
                            <span className="tn-gwi-label">{step.label}</span>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
};

export default GlobalWorkflowIndicator;
