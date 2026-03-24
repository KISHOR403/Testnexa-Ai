import React from 'react';
import { Users, Code, Award, Target, Rocket } from 'lucide-react';

const AboutUsPage = () => {
    return (
        <div className="help-page about-page-container">
            <div className="container">
                <div className="terms-header about-header">
                    <div className="terms-icon-wrapper about-icon-wrapper">
                        <Users size={48} className="icon-secondary" />
                    </div>
                    <h1 className="terms-title about-title">About TestNexa AI</h1>
                    <p className="terms-subtitle about-subtitle">
                        We are fundamentally changing how software teams approach testing by moving from manual case creation to AI-driven generation.
                    </p>
                </div>

                <div className="glass-card about-mission-card">
                    <div className="about-mission-glow"></div>
                    <div className="about-mission-content">
                        <h2 className="about-mission-title">Our Mission</h2>
                        <p className="about-mission-text">
                            At TestNexa AI, we believe that QA engineers and developers spend too much time writing boilerplate test cases and not enough time exploring complex edge scenarios. Our mission is to accelerate the testing lifecycle while increasing overall software quality. By leveraging Large Language Models, we extract intent directly from requirements to build rigorous, comprehensive test suites in seconds.
                        </p>
                    </div>
                    
                    <div className="about-features-grid">
                        <div className="about-feature-item">
                            <div className="about-feature-icon">
                                <Rocket className="icon-primary" size={32} />
                            </div>
                            <h4 className="about-feature-title">Speed</h4>
                            <p className="about-feature-text">Generate 100s of test cases in seconds, not days.</p>
                        </div>
                        <div className="about-feature-item">
                            <div className="about-feature-icon">
                                <Target className="icon-purple" size={32} />
                            </div>
                            <h4 className="about-feature-title">Accuracy</h4>
                            <p className="about-feature-text">Catch edge cases that human testers frequently miss.</p>
                        </div>
                        <div className="about-feature-item">
                            <div className="about-feature-icon">
                                <Award className="icon-amber" size={32} />
                            </div>
                            <h4 className="about-feature-title">Quality</h4>
                            <p className="about-feature-text">Standardized, consistent, and structured test artifacts.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutUsPage;
