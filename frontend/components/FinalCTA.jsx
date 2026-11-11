import React from 'react';
import { ArrowRight } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const FinalCTA = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    return (
        <section 
            id="final-cta" 
            className="de-section de-cta-section" 
            aria-labelledby="final-cta-heading"
        >
            <div className="de-container">
                <div style={{ maxWidth: 960 }}>
                    <div className="de-eyebrow">
                        <span className="de-eyebrow-dot" />
                        <span>06 / GET STARTED</span>
                    </div>

                    <h2 id="final-cta-heading" className="de-cta-massive-title">
                        Start with a requirement.<br />
                        <span className="de-text-accent">Leave with a test suite.</span>
                    </h2>

                    <p className="de-lead">
                        Turn natural language specifications into verified, traceable QA work. Ingest requirements, isolate implicit risks, and export to Playwright and CI/CD in minutes.
                    </p>

                    <div className="de-cta-action-row">
                        <a
                            href={getTargetUrl('/app/workspace')}
                            className="de-cta-btn"
                            id="final-cta-btn"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                        >
                            <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                            <ArrowRight size={16} />
                        </a>

                        <span className="de-cta-reassurance">
                            Start free &bull; No credit card required &bull; Full access
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
