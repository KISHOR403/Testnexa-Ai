import React from 'react';
import { Zap, ShieldCheck, FileJson, Sparkles } from 'lucide-react';

const Hero = () => {
    return (
        <section className="hero">
            <div className="container hero-content">
                <div className="hero-badge">
                    <Sparkles size={14} className="badge-icon" />
                    <span>AI-Powered Test Generation</span>
                </div>

                <h1 className="hero-title animate-fade-up">
                    <span className="text-secondary opacity-80">Testnexa AI</span><br />
                    Intelligent QA Design
                </h1>
                <p className="hero-subtitle animate-fade-up" style={{ animationDelay: '0.1s' }}>
                    Automatically convert unclear product requirements into complete, prioritized test cases
                    with edge cases, API checks, and security validations — in seconds.
                </p>

                <div className="hero-cards-row">
                    <div className="feature-card-compact glass-card">
                        <div className="icon-box-compact teal">
                            <Zap size={20} />
                        </div>
                        <div className="text-box-compact">
                            <h4>Instant Generation</h4>
                            <p>From text to tests in seconds</p>
                        </div>
                    </div>

                    <div className="feature-card-compact glass-card">
                        <div className="icon-box-compact purple">
                            <ShieldCheck size={20} />
                        </div>
                        <div className="text-box-compact">
                            <h4>Complete Coverage</h4>
                            <p>Functional, negative & edge</p>
                        </div>
                    </div>

                    <div className="feature-card-compact glass-card">
                        <div className="icon-box-compact green">
                            <FileJson size={20} />
                        </div>
                        <div className="text-box-compact">
                            <h4>Multi-Format Export</h4>
                            <p>JSON, Markdown & more</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
