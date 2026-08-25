import React, { useState, useEffect, useRef } from 'react';
import useScrollReveal from '../hooks/useScrollReveal';

/* ────────────────────────────────────────────
   Animated Counter Hook
   ──────────────────────────────────────────── */
const useCountUp = (target, duration = 1800, isVisible = false) => {
    const [count, setCount] = useState(0);
    const hasRun = useRef(false);

    useEffect(() => {
        if (!isVisible || hasRun.current) return;
        hasRun.current = true;

        const startTime = performance.now();
        const animate = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [isVisible, target, duration]);

    return count;
};

const METRICS = [
    {
        value: 80,
        suffix: '%',
        qualitative: 'Faster',
        description: 'Test planning acceleration',
        note: 'Estimated based on typical manual test design workflows',
    },
    {
        value: 3,
        suffix: '×',
        qualitative: 'Broader',
        description: 'Scenario coverage expansion',
        note: 'Compared to typical manual test case creation',
    },
    {
        value: 100,
        suffix: '%',
        qualitative: 'Traceable',
        description: 'Full requirement traceability',
        note: 'Every test case maps back to source requirements',
    },
];

const WhyThisMatters = () => {
    const headerReveal = useScrollReveal({ threshold: 0.2 });
    const metricsReveal = useScrollReveal({ threshold: 0.15 });

    return (
        <section id="why-this-matters" className="tn-metrics" aria-labelledby="metrics-heading">
            <div className="container">
                <div
                    ref={headerReveal.ref}
                    className={`tn-section-header scroll-reveal-fade-up ${headerReveal.isVisible ? 'revealed' : ''}`}
                >
                    <h2 id="metrics-heading" className="tn-section-title">
                        Better Requirements.<br />
                        Better Tests.<br />
                        Less Rework.
                    </h2>
                </div>

                <div
                    ref={metricsReveal.ref}
                    className={`tn-metrics__grid scroll-reveal-stagger ${metricsReveal.isVisible ? 'revealed' : ''}`}
                >
                    {METRICS.map((metric, i) => (
                        <MetricCard
                            key={i}
                            metric={metric}
                            isVisible={metricsReveal.isVisible}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

const MetricCard = ({ metric, isVisible }) => {
    const count = useCountUp(metric.value, 1800, isVisible);

    return (
        <div className="tn-metrics__card">
            <div className="tn-metrics__number">
                <span className="tn-metrics__count">{count}</span>
                <span className="tn-metrics__suffix">{metric.suffix}</span>
            </div>
            <span className="tn-metrics__qualitative">{metric.qualitative}</span>
            <p className="tn-metrics__desc">{metric.description}</p>
            <p className="tn-metrics__note">{metric.note}</p>
        </div>
    );
};

export default WhyThisMatters;
