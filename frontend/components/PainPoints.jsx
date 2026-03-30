import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Zap, ShieldAlert, Timer, Sparkles } from 'lucide-react';

const PainPoints = () => {
    return (
        <section id="problem-vs-solution" className="insight-section pain-section-2026">
            <div className="container">
                <div className="pain-section-header">
                    <span className="pain-badge-label">
                        <Sparkles size={12} />
                        Problem vs Solution
                    </span>
                    <h3 className="pain-title-2026">
                        Real QA Pain Points, <span className="title-gradient-accent">Solved.</span>
                    </h3>
                    <p className="pain-subtitle-2026">
                        Every challenge your QA team faces — we've engineered a solution for it.
                    </p>
                </div>

                <div className="pain-grid-2026">
                    <PainCard
                        index={0}
                        icon={<ShieldAlert size={22} />}
                        problem="Missing edge cases in fast sprints"
                        solution="Generates functional, negative, edge & API tests"
                        description="AI analysis ensures boundary conditions are never overlooked even under tight deadlines."
                        accentColor="239, 68, 68"
                        solveColor="0, 212, 193"
                        tag="Coverage"
                    />
                    <PainCard
                        index={1}
                        icon={<AlertCircle size={22} />}
                        problem="Ambiguous requirements from product"
                        solution="Auto-detects ambiguity and asks clarifications"
                        description="Testnexa AI identifies missing logic early, saving hours of developer back-and-forth."
                        accentColor="251, 146, 60"
                        solveColor="99, 102, 241"
                        tag="Clarity"
                    />
                    <PainCard
                        index={2}
                        icon={<Timer size={22} />}
                        problem="Manual test case writing takes hours"
                        solution="Outputs clean, reusable test cases instantly"
                        description="Shift your focus from writing to executing and optimizing your test strategy."
                        accentColor="168, 85, 247"
                        solveColor="34, 211, 238"
                        tag="Speed"
                    />
                </div>
            </div>
        </section>
    );
};

const PainCard = ({ index, icon, problem, solution, description, accentColor, solveColor, tag }) => {
    const cardRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => setIsVisible(true), index * 150);
                }
            },
            { threshold: 0.2 }
        );
        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, [index]);

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    return (
        <div
            ref={cardRef}
            className={`pain-card-2026 ${isVisible ? 'pain-card-visible' : ''}`}
            onMouseMove={handleMouseMove}
            style={{
                '--accent': accentColor,
                '--solve': solveColor,
                '--mouse-x': `${mousePos.x}px`,
                '--mouse-y': `${mousePos.y}px`,
                animationDelay: `${index * 0.15}s`,
            }}
        >
            {/* Spotlight glow that follows cursor */}
            <div className="pain-card-spotlight" />

            {/* Top decorative border gradient */}
            <div className="pain-card-border-glow" />

            {/* Floating tag */}
            <div className="pain-card-tag">
                <Zap size={10} />
                {tag}
            </div>

            {/* Problem section */}
            <div className="pain-card-problem">
                <div className="pain-card-icon-badge pain-icon-problem">
                    {icon}
                </div>
                <div className="pain-card-problem-text">
                    <span className="pain-label-micro">PROBLEM</span>
                    <p>{problem}</p>
                </div>
            </div>

            {/* Arrow connector */}
            <div className="pain-card-connector">
                <div className="connector-line" />
                <div className="connector-pulse" />
                <div className="connector-line" />
            </div>

            {/* Solution section */}
            <div className="pain-card-solution">
                <div className="pain-card-icon-badge pain-icon-solution">
                    <CheckCircle2 size={22} />
                </div>
                <div className="pain-card-solution-text">
                    <span className="pain-label-micro pain-label-solution">SOLUTION</span>
                    <p>{solution}</p>
                </div>
            </div>

            {/* Divider with glow */}
            <div className="pain-card-divider-2026" />

            {/* Description */}
            <p className="pain-card-desc-2026">{description}</p>

            {/* Bottom ambient glow */}
            <div className="pain-card-ambient" />
        </div>
    );
};

export default PainPoints;
