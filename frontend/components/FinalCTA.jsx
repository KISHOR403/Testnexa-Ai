import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Terminal, Layers } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const FinalCTA = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    return (
        <section className="tn-section tn-final-cta-section" aria-labelledby="cta-heading">
            <div className="tn-container">
                <div className="tn-final-cta-card">
                    <div className="tn-final-cta-content">
                        <span className="tn-kicker">Ready For Production QA</span>
                        <h2 id="cta-heading" className="tn-final-cta-title">
                            Turn requirements into structured test suites.
                        </h2>
                        <p className="tn-final-cta-desc">
                            Analyze requirements, generate test cases, review coverage and trace every test back to its source.
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
                                <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                                <ArrowRight size={16} />
                            </a>
                        </div>

                        <div className="tn-final-cta-assurances">
                            <div className="tn-assurance-item">
                                <CheckCircle2 size={14} className="text-accent" />
                                <span>Zero setup required</span>
                            </div>
                            <div className="tn-assurance-item">
                                <CheckCircle2 size={14} className="text-accent" />
                                <span>Structured JSON, CSV & Gherkin export</span>
                            </div>
                            <div className="tn-assurance-item">
                                <CheckCircle2 size={14} className="text-accent" />
                                <span>Stateless, isolated data processing</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
