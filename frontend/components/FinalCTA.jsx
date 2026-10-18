import React from 'react';
import { ArrowRight } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const FinalCTA = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    return (
        <section className="tn-section tn-final-cta-section" aria-labelledby="final-cta-heading">
            <div className="tn-container">
                <div className="tn-final-cta-canvas">
                    <div className="tn-chapter-eyebrow">
                        <span className="tn-kicker-dot" />
                        <span>GET STARTED</span>
                    </div>

                    <h2 id="final-cta-heading" className="tn-final-cta-title">
                        Start with a requirement.<br />Leave with a test suite.
                    </h2>

                    <p className="tn-final-cta-subtitle">
                        Turn unstructured requirements into reviewable, traceable QA work.
                    </p>

                    <div className="tn-final-cta-actions">
                        <a
                            href={getTargetUrl('/app/workspace')}
                            className={`tn-btn-primary tn-btn-primary--lg ${isOpening ? 'is-opening' : ''}`}
                            id="final-cta-btn"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                        >
                            <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                            <ArrowRight size={15} />
                        </a>

                        <span className="tn-cta-note">No credit card required &bull; Free instant workspace</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
