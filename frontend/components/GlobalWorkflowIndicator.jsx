import React, { useState, useEffect } from 'react';

const CHAPTER_STAGES = [
    { id: 'workflow', label: '00 Timeline' },
    { id: 'understand', label: '01 Understand' },
    { id: 'generate', label: '02 Generate' },
    { id: 'review', label: '03 Review' },
    { id: 'execute', label: '04 Execute' },
    { id: 'verify', label: '05 Verify' },
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
                if (rect.top <= window.innerHeight * 0.7) {
                    isPastChapters = true;
                }
            }

            if (footerEl) {
                const fRect = footerEl.getBoundingClientRect();
                if (fRect.top <= window.innerHeight) {
                    isPastChapters = true;
                }
            }

            const isNearBottom = (window.innerHeight + scrollY) >= (document.documentElement.scrollHeight - 300);

            // Only show after scrolling past hero and while strictly within timeline stages
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

        handleScroll();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
            window.removeEventListener('hashchange', handleScroll);
        };
    }, []);

    const scrollTo = (id) => {
        const el = document.getElementById(id);
        if (el) {
            const yOffset = -40;
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    if (!isVisible) return null;

    return (
        <aside
            className="vt-global-workflow-indicator"
            aria-label="Interactive QA Timeline Progress"
        >
            <div className="vt-indicator-track">
                {/* Continuous thin vertical line down the track */}
                <div className="vt-indicator-axis-line" aria-hidden="true" />

                {CHAPTER_STAGES.map((stage) => {
                    const isActive = activeSection === stage.id;
                    return (
                        <button
                            key={stage.id}
                            type="button"
                            className={`vt-indicator-node ${isActive ? 'is-active' : ''}`}
                            onClick={() => scrollTo(stage.id)}
                            aria-label={`Jump to ${stage.label}`}
                            aria-current={isActive ? 'step' : undefined}
                        >
                            <span className="vt-indicator-bullet" />
                            <span className="vt-indicator-label">{stage.label}</span>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
};

export default GlobalWorkflowIndicator;
