import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const PainPoints = () => {
    return (
        <section id="problem-vs-solution" className="insight-section">
            <div className="container">
                <span className="section-label">Problem vs Solution</span>
                <h3 className="section-title-large">Real QA Pain Points, Solved.</h3>

                <div className="pain-grid">
                    <PainCard
                        problem="Missing edge cases in fast sprints"
                        solution="Generates functional, negative, edge & API tests"
                        description="AI analysis ensures boundary conditions are never overlooked even under tight deadlines."
                    />
                    <PainCard
                        problem="Ambiguous requirements from product"
                        solution="Auto-detects ambiguity and asks clarifications"
                        description="Testnexa AI identifies missing logic early, saving hours of developer back-and-forth."
                    />
                    <PainCard
                        problem="Manual test case writing takes hours"
                        solution="Outputs clean, reusable test cases instantly"
                        description="Shift your focus from writing to executing and optimizing your test strategy."
                    />
                </div>
            </div>
        </section>
    );
};

const PainCard = ({ problem, solution, description }) => (
    <div className="pain-card">
        <div className="pain-header">
            <div className="pain-point">
                <AlertCircle size={16} />
                <span>Problem: {problem}</span>
            </div>
            <div className="solution-point">
                <CheckCircle2 size={16} />
                <span>Solution: {solution}</span>
            </div>
        </div>
        <div className="pain-divider" />
        <p className="pain-description">{description}</p>
    </div>
);

export default PainPoints;
