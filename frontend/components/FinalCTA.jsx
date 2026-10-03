import React from 'react';
import RevealSection from './RevealSection';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const FinalCTA = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    return (
        <section className="tn-section tn-final-cta-section" aria-labelledby="cta-heading">
            <div className="tn-container">
                <div className="tn-final-cta-card">
                    <RevealSection className="tn-final-cta-content">
                        <span className="tn-chapter-pill">READY FOR PRODUCTION QA</span>
                        <h2 id="cta-heading" className="tn-final-cta-title">
                            Your next requirement is already waiting.
                        </h2>
                        <p className="tn-final-cta-subtitle">
                            Turn it into a review-ready test suite.
                        </p>

                        <div className="tn-final-cta-actions">
                            <a
                                href={getTargetUrl('/app/workspace')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`tn-btn-primary tn-btn-primary--lg ${isOpening ? 'is-opening' : ''}`}
                                id="final-cta-btn"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleWorkspaceEntry('/app/workspace');
                                }}
                            >
                                <span>{isOpening ? 'Opening Workspace…' : 'Create a test suite →'}</span>
                            </a>
                            <span className="tn-cta-secondary-note">No credit card required.</span>
                        </div>

                        <div className="tn-final-cta-assurances">
                            <div className="tn-assurance-item">
                                <CheckCircle2 size={13} className="text-green" />
                                <span>Zero setup required</span>
                            </div>
                            <div className="tn-assurance-item">
                                <CheckCircle2 size={13} className="text-green" />
                                <span>Structured JSON, CSV & Cucumber BDD export</span>
                            </div>
                            <div className="tn-assurance-item">
                                <CheckCircle2 size={13} className="text-green" />
                                <span>Stateless, isolated data processing</span>
                            </div>
                        </div>
                    </RevealSection>
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
