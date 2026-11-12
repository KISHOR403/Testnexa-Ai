import React from 'react';
import { ArrowRight } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const FinalCTA = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    return (
        <section
            id="final-cta"
            className="vt-fullscreen-stage vt-final-cta-stage"
            aria-labelledby="final-cta-heading"
        >
            <div className="vt-container">
                {/* Stage Indicator & Guide */}
                <div className="vt-stage-connector-top">
                    <div className="vt-stage-marker-circle">
                        <span>07</span>
                    </div>
                    <div className="vt-stage-stem-line" aria-hidden="true" />
                </div>

                <div className="vt-eyebrow">
                    <span className="vt-eyebrow-node" />
                    <span>07 / PRODUCTION QUALITY</span>
                </div>

                {/* Oversized Typography - Exact user requirement */}
                <h2 id="final-cta-heading" className="vt-editorial-heading vt-cta-massive-title">
                    Start with a requirement.<br />
                    <span className="vt-text-accent">Leave with a test suite.</span>
                </h2>

                <p className="vt-lead-text vt-cta-lead-text">
                    Turn natural language specifications into verified, traceable QA work. Ingest requirements, isolate implicit risks, and export to Playwright and CI/CD in minutes.
                </p>

                {/* Minimal CTA Action: ONE jade-green button. NO CARD, NO BORDER FRAME, NO LARGE BACKGROUND PANEL */}
                <div className="vt-cta-action-row">
                    <a
                        href={getTargetUrl('/app/workspace')}
                        className="vt-jade-cta-button"
                        id="final-cta-btn"
                        onClick={(e) => {
                            e.preventDefault();
                            handleWorkspaceEntry('/app/workspace');
                        }}
                    >
                        <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                        <ArrowRight size={16} />
                    </a>

                    <div className="vt-cta-fine-meta">
                        <span>Start free</span>
                        <span className="vt-cta-meta-dot">&bull;</span>
                        <span>No credit card required</span>
                        <span className="vt-cta-meta-dot">&bull;</span>
                        <span>Full workspace access</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
