import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const FinalCTA = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    return (
        <section className="tn-section tn-final-cta-section" aria-labelledby="final-cta-heading">
            <div className="tn-container">
                <div className="tn-final-cta-canvas">
                    <div className="tn-chapter-eyebrow">
                        <span className="tn-kicker-dot" />
                        <span>PRODUCTION-READY QUALITY GATE</span>
                    </div>

                    <h2 id="final-cta-heading" className="tn-final-cta-title">
                        Your next requirement is already waiting.
                    </h2>

                    <p className="tn-final-cta-subtitle">
                        Turn raw specifications into deterministic, execution-ready test suites in seconds.
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

                        <span className="tn-cta-note">No credit card required &bull; Free instant workspace</span>
                    </div>

                    <div className="tn-final-cta-assurances">
                        <div className="tn-assurance-item">
                            <CheckCircle2 size={13} className="text-green" />
                            <span>Zero setup required</span>
                        </div>
                        <div className="tn-assurance-divider" />
                        <div className="tn-assurance-item">
                            <CheckCircle2 size={13} className="text-green" />
                            <span>Playwright, Cypress & Cucumber BDD export</span>
                        </div>
                        <div className="tn-assurance-divider" />
                        <div className="tn-assurance-item">
                            <CheckCircle2 size={13} className="text-green" />
                            <span>Stateless, isolated data privacy</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
