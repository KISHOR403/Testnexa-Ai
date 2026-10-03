import React, { useState, useEffect } from 'react';

const CHAPTER_STAGES = [
    { id: 'product-canvas', label: '01 Canvas' },
    { id: 'transformation', label: '02 Intelligence' },
    { id: 'solutions', label: '03 Workflow' },
    { id: 'test-suite', label: '04 Test Suites' },
    { id: 'traceability', label: '05 Lineage' },
    { id: 'developers', label: '06 Pipeline' }
];

export const GlobalWorkflowIndicator = () => {
    const [activeSection, setActiveSection] = useState('workflow');
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY || window.pageYOffset;
            const heroHeight = window.innerHeight * 0.7;

            // Only show after scrolling past top of hero
            setIsVisible(scrollY > heroHeight);

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
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
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
        <aside className="tn-global-workflow-indicator" aria-label="Page Chapter Navigator">
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
