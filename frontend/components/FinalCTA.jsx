import React from 'react';
import { ArrowRight } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const FinalCTA = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    return (
        <section
            id="final-cta"
            className="vt-cta-section"
            aria-labelledby="final-cta-heading"
        >
            <div className="vt-container">
                <div style={{ maxWidth: 940 }}>
                    <div className="vt-eyebrow">
                        <span className="vt-eyebrow-node" />
                        <span>GET STARTED TODAY</span>
                    </div>

                    <h2 id="final-cta-heading" className="vt-cta-title">
                        Start with a requirement.<br />
                        <span className="vt-text-accent">Leave with a test suite.</span>
                    </h2>

                    <p className="vt-lead-text">
                        Turn natural language specifications into verified, traceable QA work. Ingest requirements, isolate implicit risks, and export to Playwright and CI/CD in minutes.
                    </p>

                    <div className="vt-cta-actions">
                        <a
                            href={getTargetUrl('/app/workspace')}
                            className="vt-cta-button"
                            id="final-cta-btn"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                        >
                            <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                            <ArrowRight size={16} />
                        </a>

                        <span className="vt-cta-meta">
                            Start free &bull; No credit card required &bull; Full workspace access
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
