import React from 'react';
import { ArrowRight } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const FinalCTA = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    return (
        <section 
            id="final-cta" 
            className="tn-final-cta-section" 
            aria-labelledby="final-cta-heading"
        >
            <div className="tn-container">
                <div className="tn-final-cta-flow">
                    
                    {/* Eyebrow with minimalist jade line marker */}
                    <div className="tn-final-cta-eyebrow-row">
                        <span className="tn-final-cta-accent-bar" aria-hidden="true" />
                        <span className="tn-final-cta-eyebrow">READY WHEN YOU ARE</span>
                    </div>

                    {/* Headline — Typographic Focal Point */}
                    <h2 id="final-cta-heading" className="tn-final-cta-title">
                        Start with a requirement.{' '}
                        <br className="tn-cta-br" />
                        Leave with a <span className="tn-cta-accent-text">test suite.</span>
                    </h2>

                    {/* Supporting Sentence */}
                    <p className="tn-final-cta-subtitle">
                        Turn unstructured requirements into reviewable, traceable QA work.
                    </p>

                    {/* Primary Action & Reassurance */}
                    <div className="tn-final-cta-action-dock">
                        <a
                            href={getTargetUrl('/app/workspace')}
                            className={`tn-final-cta-btn ${isOpening ? 'is-opening' : ''}`}
                            id="final-cta-btn"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                        >
                            <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                            <ArrowRight size={15} className="tn-final-cta-btn-arrow" aria-hidden="true" />
                        </a>

                        <p className="tn-final-cta-reassurance">
                            Start free · No credit card required
                        </p>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
