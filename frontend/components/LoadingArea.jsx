import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

const LoadingArea = ({ isGenerating }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const steps = [
        "Analyzing requirement with Gemini AI...",
        "Applying QA logic & rules...",
        "Generating comprehensive test cases...",
        "Identifying edge cases & risks...",
        "Finalizing structured output..."
    ];

    useEffect(() => {
        let interval;
        if (isGenerating) {
            setCurrentStep(0);
            interval = setInterval(() => {
                setCurrentStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
            }, 1200); // Faster steps for faster generation
        } else {
            setCurrentStep(0);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

    if (!isGenerating) return null;

    return (
        <div className="loading-area glass-card">
            <div className="loading-header">
                <Loader2 className="animate-spin" size={24} color="var(--primary)" />
                <h3>AI is thinking...</h3>
                <p className="loading-subtitle">Engineerd for enterprise-grade depth and analysis</p>
            </div>

            <div className="loading-preview-checklist">
                <h4>Your test suite will include:</h4>
                <div className="preview-grid">
                    <PreviewItem text="Functional test cases" />
                    <PreviewItem text="Negative & validation scenarios" />
                    <PreviewItem text="Edge & boundary cases" />
                    <PreviewItem text="API test checklist" />
                    <PreviewItem text="Non-functional checks" />
                    <PreviewItem text="Clarification questions" />
                </div>
            </div>

            <div className="loading-steps">
                {steps.map((step, index) => (
                    <div key={index} className={`loading-step ${index <= currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}>
                        <div className="step-indicator">
                            {index < currentStep ? <CheckCircle2 size={16} /> : <div className="step-dot" />}
                        </div>
                        <span>{step}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PreviewItem = ({ text }) => (
    <div className="preview-item">
        <CheckCircle2 size={14} className="text-primary" />
        <span>{text}</span>
    </div>
);

export default LoadingArea;
