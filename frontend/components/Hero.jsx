import React, { useState } from 'react';
import {
    ArrowRight,
    Check,
    ChevronRight,
    FileText,
    Layers,
    Shield,
    GitBranch,
    CheckSquare,
    Loader2
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

export const Hero = () => {
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();
    const [sidebarSelection, setSidebarSelection] = useState('suite'); // 'req' | 'suite' | 'cases' | 'coverage' | 'risks' | 'trace'

    const handleExploreWorkflow = (e) => {
        e.preventDefault();
        const target = document.getElementById('workflow');
        if (target) {
            const yOffset = -80;
            const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    return (
        <header className="tn-hero-section" aria-labelledby="hero-main-heading">
            <div className="tn-container">
                {/* ─── Hero Headline & CTAs ─── */}
                <div className="tn-hero-content">
                    <div className="tn-hero-kicker">
                        <span className="tn-kicker-dot" />
                        <span>REQUIREMENT INTELLIGENCE &bull; QA PLATFORM</span>
                    </div>

                    <h1 id="hero-main-heading" className="tn-hero-title">
                        Turn requirements into<br />
                        <span className="tn-hero-title--accent">production-ready test suites.</span>
                    </h1>

                    <p className="tn-hero-desc">
                        Transform Jira tickets, user stories, PRDs and plain-text requirements into structured test cases with coverage, risks and traceability.
                    </p>

                    <div className="tn-hero-actions">
                        <a
                            href={getTargetUrl('/app/workspace')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`tn-btn-primary tn-btn-primary--lg ${isOpening ? 'is-opening' : ''}`}
                            id="hero-generate-cta"
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                            aria-label="Generate Test Suite"
                        >
                            <span>{isOpening ? 'Opening Workspace…' : 'Generate Test Suite'}</span>
                            <ArrowRight size={16} />
                        </a>

                        <button
                            type="button"
                            className="tn-btn-secondary tn-btn-secondary--lg"
                            onClick={handleExploreWorkflow}
                        >
                            <span>Explore Workflow</span>
                        </button>
                    </div>

                    <div className="tn-hero-trust-row" aria-label="Workflow pipeline stages">
                        <span>Requirement</span>
                        <span className="tn-trust-arrow">&rarr;</span>
                        <span>Analysis</span>
                        <span className="tn-trust-arrow">&rarr;</span>
                        <span>Test Suite</span>
                        <span className="tn-trust-arrow">&rarr;</span>
                        <span>Coverage</span>
                    </div>
                </div>

                {/* ─── Authentic TestNexa Software Window ─── */}
                <div className="tn-hero-visual-frame" aria-label="TestNexa Workspace Preview">
                    <div className="tn-software-window">
                        {/* Title Bar */}
                        <div className="tn-window-header">
                            <div className="tn-window-dots" aria-hidden="true">
                                <span className="tn-win-dot tn-win-dot--red" />
                                <span className="tn-win-dot tn-win-dot--amber" />
                                <span className="tn-win-dot tn-win-dot--green" />
                            </div>
                            <div className="tn-window-title">
                                <span className="tn-app-name">TestNexa</span>
                                <span className="tn-title-sep">/</span>
                                <span className="tn-req-label">Requirement REQ-142</span>
                            </div>
                            <div className="tn-window-status">
                                <span className="tn-status-pill-hero">Needs Review</span>
                            </div>
                        </div>

                        {/* App Shell Workspace Layout */}
                        <div className="tn-software-shell">
                            {/* Left App Sidebar */}
                            <nav className="tn-software-sidebar" aria-label="Preview navigation">
                                <div className="tn-sidebar-heading">WORKFLOW</div>
                                <button
                                    type="button"
                                    className={`tn-sidebar-item ${sidebarSelection === 'req' ? 'is-active' : ''}`}
                                    onClick={() => setSidebarSelection('req')}
                                >
                                    <FileText size={14} />
                                    <span>Requirement</span>
                                </button>
                                <button
                                    type="button"
                                    className={`tn-sidebar-item ${sidebarSelection === 'suite' ? 'is-active' : ''}`}
                                    onClick={() => setSidebarSelection('suite')}
                                >
                                    <CheckSquare size={14} />
                                    <span>Test Suite</span>
                                </button>
                                <button
                                    type="button"
                                    className={`tn-sidebar-item ${sidebarSelection === 'cases' ? 'is-active' : ''}`}
                                    onClick={() => setSidebarSelection('cases')}
                                >
                                    <Layers size={14} />
                                    <span>Test Cases</span>
                                    <span className="tn-sidebar-count">24</span>
                                </button>
                                <button
                                    type="button"
                                    className={`tn-sidebar-item ${sidebarSelection === 'coverage' ? 'is-active' : ''}`}
                                    onClick={() => setSidebarSelection('coverage')}
                                >
                                    <Shield size={14} />
                                    <span>Coverage</span>
                                    <span className="tn-sidebar-count">92%</span>
                                </button>
                                <button
                                    type="button"
                                    className={`tn-sidebar-item ${sidebarSelection === 'risks' ? 'is-active' : ''}`}
                                    onClick={() => setSidebarSelection('risks')}
                                >
                                    <span className="tn-alert-dot" />
                                    <span>Risks</span>
                                    <span className="tn-sidebar-count tn-sidebar-count--alert">3</span>
                                </button>
                                <button
                                    type="button"
                                    className={`tn-sidebar-item ${sidebarSelection === 'trace' ? 'is-active' : ''}`}
                                    onClick={() => setSidebarSelection('trace')}
                                >
                                    <GitBranch size={14} />
                                    <span>Traceability</span>
                                </button>
                            </nav>

                            {/* Main Product Area */}
                            <main className="tn-software-main">
                                <div className="tn-software-main__header">
                                    <div className="tn-main-meta">
                                        <h2 className="tn-main-title">Password Reset</h2>
                                        <span className="tn-main-tag">REQ-142</span>
                                        <span className="tn-status-pill-hero">Needs Review</span>
                                    </div>
                                    <span className="tn-main-time">Updated 2m ago</span>
                                </div>

                                {/* Raw Requirement Ingestion */}
                                <div className="tn-software-req-box">
                                    <label className="tn-field-label">REQUIREMENT</label>
                                    <p className="tn-field-quote">
                                        "Users can reset their password using their registered email address."
                                    </p>
                                </div>

                                {/* Requirement Analysis Checkpoints */}
                                <div className="tn-software-analysis-box">
                                    <label className="tn-field-label">ANALYSIS</label>
                                    <div className="tn-check-grid">
                                        <div className="tn-check-cell">
                                            <Check size={14} className="text-accent" />
                                            <span>Functional scenarios identified</span>
                                        </div>
                                        <div className="tn-check-cell">
                                            <Check size={14} className="text-accent" />
                                            <span>Negative scenarios identified</span>
                                        </div>
                                        <div className="tn-check-cell">
                                            <Check size={14} className="text-accent" />
                                            <span>Edge cases identified</span>
                                        </div>
                                        <div className="tn-check-cell">
                                            <Check size={14} className="text-accent" />
                                            <span>Security scenarios identified</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Generated Test Suite Summary Bar */}
                                <div className="tn-software-suite-summary">
                                    <div className="tn-suite-stats-bar">
                                        <div className="tn-stat-item">
                                            <span className="tn-stat-num">24</span>
                                            <span className="tn-stat-lbl">Test Cases</span>
                                        </div>
                                        <div className="tn-stat-sep" />
                                        <div className="tn-stat-item">
                                            <span className="tn-stat-num text-accent">87%</span>
                                            <span className="tn-stat-lbl">Coverage</span>
                                        </div>
                                        <div className="tn-stat-sep" />
                                        <div className="tn-stat-item">
                                            <span className="tn-stat-num text-amber">3</span>
                                            <span className="tn-stat-lbl">High Risks</span>
                                        </div>
                                    </div>

                                    <a
                                        href={getTargetUrl('/app/workspace')}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="tn-review-suite-btn"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleWorkspaceEntry('/app/workspace');
                                        }}
                                    >
                                        <span>Review Test Suite</span>
                                        <ArrowRight size={14} />
                                    </a>
                                </div>
                            </main>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Hero;
