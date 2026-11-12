import React, { useRef } from 'react';
import { ArrowRight, ShieldCheck, Terminal, Heart } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const CompetitionFinalCTA = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();
    const btnRef = useRef(null);

    const handleMouseMove = (e) => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
        if (dist < 100) {
            const pullX = ((e.clientX - centerX) / 100) * 8;
            const pullY = ((e.clientY - centerY) / 100) * 8;
            btnRef.current.style.transform = `translate(${pullX}px, ${pullY}px)`;
        } else {
            btnRef.current.style.transform = `translate(0px, 0px)`;
        }
    };

    return (
        <footer
            id="final-cta-section"
            className="tn-final-cta-section"
            onMouseMove={handleMouseMove}
            aria-label="Footer and Get Started Call to Action"
        >
            <div className="tn-max-container">
                {/* ─── Controlled 2-Line Headline: clamp(40px, 7vw, 96px), text-wrap: balance, no orphan words ─── */}
                <div className="tn-final-hero-block">
                    <div className="tn-eyebrow-mono" style={{ justifyContent: 'center' }}>
                        <span className="tn-eyebrow-ping" />
                        <span>START GENERATING IN SECONDS</span>
                    </div>

                    <h2 className="tn-giant-cta-title">
                        <span className="tn-cta-line-muted">Start with a requirement.</span>
                        <span className="tn-cta-line-bright tn-shimmer-text">Leave with a test suite.</span>
                    </h2>

                    <p className="tn-giant-cta-desc">
                        Turn raw specifications into verified, traceable QA work. Ingest requirements, isolate implicit risks, and export to Playwright and CI/CD in minutes.
                    </p>

                    <div className="tn-final-cta-actions">
                        <a
                            ref={btnRef}
                            href={getTargetUrl('/app/workspace')}
                            className="tn-btn-primary"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                            data-cursor="Start"
                        >
                            <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                            <ArrowRight size={15} />
                        </a>

                        <NavLink to="/api-reference" className="tn-btn-ghost" data-cursor="View">
                            <span>Read API Reference</span>
                        </NavLink>
                    </div>

                    <div className="tn-final-meta-row">
                        <span>Free sandbox tier</span>
                        <span className="tn-meta-dot">&bull;</span>
                        <span>No credit card required</span>
                        <span className="tn-meta-dot">&bull;</span>
                        <span>SOC 2 &amp; ISO 29119 Architecture</span>
                    </div>
                </div>

                {/* ─── Clean 4-Column Footer ─── */}
                <div className="tn-clean-4col-footer">
                    {/* Col 1: Brand */}
                    <div className="tn-footer-col">
                        <div className="tn-footer-brand-title">TESTNEXA AI</div>
                        <p className="tn-footer-brand-tagline">
                            Intelligent QA platform synthesizing deterministic tests from natural language requirements. Every test traces back to a reason.
                        </p>
                        <div className="tn-footer-status-pill">
                            <span className="tn-status-dot-green" />
                            <span>ALL SYSTEMS OPERATIONAL</span>
                        </div>
                    </div>

                    {/* Col 2: Product */}
                    <div className="tn-footer-col">
                        <div className="tn-footer-col-header">PRODUCT</div>
                        <ul className="tn-footer-links">
                            <li><NavLink to="/app/workspace">Test Generator</NavLink></li>
                            <li><NavLink to="/app/test-suites">Suite Manager</NavLink></li>
                            <li><NavLink to="/app/runs">Live Telemetry</NavLink></li>
                            <li><NavLink to="/app/traceability">Traceability Matrix</NavLink></li>
                            <li><NavLink to="/app/cicd">CI/CD Gates</NavLink></li>
                        </ul>
                    </div>

                    {/* Col 3: Developers */}
                    <div className="tn-footer-col">
                        <div className="tn-footer-col-header">DEVELOPERS</div>
                        <ul className="tn-footer-links">
                            <li><NavLink to="/api-reference">REST API</NavLink></li>
                            <li><NavLink to="/best-practices">QA Best Practices</NavLink></li>
                            <li><NavLink to="/help">Documentation</NavLink></li>
                            <li><a href="https://github.com" target="_blank" rel="noreferrer">GitHub Integration</a></li>
                            <li><NavLink to="/help/playwright">Playwright Runner</NavLink></li>
                        </ul>
                    </div>

                    {/* Col 4: Company & Legal */}
                    <div className="tn-footer-col">
                        <div className="tn-footer-col-header">LEGAL &amp; COMPANY</div>
                        <ul className="tn-footer-links">
                            <li><NavLink to="/about">About Us</NavLink></li>
                            <li><NavLink to="/contact">Contact Support</NavLink></li>
                            <li><NavLink to="/privacy">Privacy Policy</NavLink></li>
                            <li><NavLink to="/terms">Terms of Service</NavLink></li>
                            <li><NavLink to="/acceptable-use">Acceptable Use</NavLink></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="tn-footer-bottom-bar">
                    <span className="tn-footer-copyright">
                        &copy; {new Date().getFullYear()} TestNexa AI Inc. All rights reserved.
                    </span>
                    <span className="tn-footer-signature">
                        Designed with mathematical rigor for elite QA teams.
                    </span>
                </div>
            </div>
        </footer>
    );
};

export default CompetitionFinalCTA;
