import React, { useState, useEffect, useRef } from 'react';
import {
    FileText,
    Brain,
    CheckSquare,
    ShieldAlert,
    AlertTriangle,
    Shield,
    Check,
    Layers,
    ArrowRight,
    Terminal,
    GitBranch,
    Search,
    ChevronRight,
    SlidersHorizontal,
    Code,
    Sparkles
} from 'lucide-react';

const STORY_STATES = [
    {
        id: 'requirement',
        stepNum: '01',
        label: 'Requirement',
        headline: 'Start with the requirement.',
        tagline: 'Raw spec ingestion & decomposition',
        description: 'Input raw user stories, Jira tickets, PRDs, or API specs. TestNexa parses the language, isolates actors, and structures messy requirements into clear criteria.',
        meta: [
            { label: 'Source', value: 'Jira PROD-842' },
            { label: 'Clauses Identified', value: '5 testable clauses' },
            { label: 'Type', value: 'Authentication' }
        ]
    },
    {
        id: 'analysis',
        stepNum: '02',
        label: 'AI Analysis',
        headline: 'Testnexa analyzes what the requirement actually means.',
        tagline: 'Ambiguity & boundary detection',
        description: 'Before writing test cases, the model analyzes the specification for missing assumptions, unstated negative boundaries, token lifecycles, and security race conditions.',
        meta: [
            { label: 'Ambiguities Detected', value: '4 critical omissions' },
            { label: 'Security Checks', value: 'OWASP / Rate Limit' },
            { label: 'Analysis Score', value: 'Ready for Suite' }
        ]
    },
    {
        id: 'suite',
        stepNum: '03',
        label: 'Test Suite',
        headline: 'Generate structured test cases ready for review.',
        tagline: 'Preconditions, steps & assertions',
        description: 'Synthesizes functional, negative, edge-case, and validation test cases with explicit step-by-step actions, expected outcomes, and BDD Gherkin exports.',
        meta: [
            { label: 'Total Cases', value: '18 Generated' },
            { label: 'Negative Ratio', value: '40% Negative / Edge' },
            { label: 'BDD Syntax', value: 'Cucumber Ready' }
        ]
    },
    {
        id: 'coverage',
        stepNum: '04',
        label: 'Coverage',
        headline: 'Know what is covered before execution.',
        tagline: 'Coverage gap audit & risk mapping',
        description: 'Audit test coverage against every requirement clause. Isolate high-severity gaps, verify bidirectional traceability, and approve release readiness.',
        meta: [
            { label: 'Clause Coverage', value: '92% Verified' },
            { label: 'High Risks', value: '3 Actionable' },
            { label: 'Trace Lineage', value: '100% Mapped' }
        ]
    }
];

export const StickyProductStory = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const containerRef = useRef(null);

    // Track scroll position to update activeIndex
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const handleScroll = () => {
            if (!containerRef.current || window.innerWidth < 1024) return;
            const rect = containerRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            
            // Container top relative to viewport
            const totalScrollable = rect.height - windowHeight;
            if (totalScrollable <= 0) return;

            const scrolledInto = -rect.top;
            const progress = Math.max(0, Math.min(1, scrolledInto / totalScrollable));

            // Map progress 0..1 to 0..3
            const index = Math.min(3, Math.floor(progress * 4));
            setActiveIndex(index);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const currentState = STORY_STATES[activeIndex];

    return (
        <section 
            id="workflow" 
            ref={containerRef} 
            className="tn-sticky-story-section"
            aria-label="Interactive Product Story"
        >
            <div className="tn-sticky-story-wrapper">
                <div className="tn-container tn-sticky-story-container">
                    
                    {/* ─── LEFT COLUMN: Sticky Narrative & Stage Indicators ─── */}
                    <div className="tn-story-narrative-col">
                        <div className="tn-story-chapter-eyebrow">
                            <span className="tn-chapter-pill">CHAPTER 01</span>
                            <span className="tn-chapter-sub">Requirement to Understanding</span>
                        </div>

                        {/* Subtle Vertical Workflow Indicator */}
                        <div className="tn-vertical-workflow" aria-label="Workflow Stages">
                            <div className="tn-workflow-track" />
                            {STORY_STATES.map((step, idx) => (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => setActiveIndex(idx)}
                                    className={`tn-workflow-step-btn ${idx === activeIndex ? 'is-active' : ''} ${idx < activeIndex ? 'is-completed' : ''}`}
                                    aria-current={idx === activeIndex ? 'step' : undefined}
                                >
                                    <span className="tn-workflow-dot">
                                        {idx < activeIndex ? <Check size={10} /> : <span className="tn-dot-inner" />}
                                    </span>
                                    <span className="tn-workflow-step-num">{step.stepNum}</span>
                                    <span className="tn-workflow-step-label">{step.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Active Narrative Text */}
                        <div className="tn-story-narrative-card">
                            <span className="tn-story-state-tagline">{currentState.tagline}</span>
                            <h2 className="tn-story-headline">{currentState.headline}</h2>
                            <p className="tn-story-desc">{currentState.description}</p>

                            {/* Small Supporting Metadata (Not card spam) */}
                            <div className="tn-story-meta-row">
                                {currentState.meta.map((m) => (
                                    <div key={m.label} className="tn-story-meta-item">
                                        <span className="tn-story-meta-label">{m.label}</span>
                                        <span className="tn-story-meta-val">{m.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Interactive Step Switcher for Mobile / Quick Jump */}
                            <div className="tn-story-pills-nav">
                                {STORY_STATES.map((s, idx) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setActiveIndex(idx)}
                                        className={`tn-story-pill-nav-item ${idx === activeIndex ? 'is-active' : ''}`}
                                        aria-label={`Jump to stage ${s.stepNum}: ${s.label}`}
                                    >
                                        {s.stepNum} &bull; {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ─── RIGHT COLUMN: Anchored Continuous Software Interface ─── */}
                    <div className="tn-story-product-col">
                        {/* Layer 1: Ambient Background Grid (translateY 0-20px) */}
                        <div 
                            className="tn-story-bg-layer" 
                            data-parallax-offset="20"
                            aria-hidden="true" 
                        />

                        {/* Layer 2: Product Application Shell (translateY 0-40px) */}
                        <div 
                            className="tn-story-shell-window"
                            data-parallax-offset="35"
                        >
                            {/* Window Title Bar */}
                            <div className="tn-window-header">
                                <div className="tn-window-dots" aria-hidden="true">
                                    <span className="tn-win-dot tn-win-dot--red" />
                                    <span className="tn-win-dot tn-win-dot--amber" />
                                    <span className="tn-win-dot tn-win-dot--green" />
                                </div>
                                <div className="tn-window-title">
                                    <span className="tn-app-name">TestNexa</span>
                                    <span className="tn-title-sep">/</span>
                                    <span className="tn-req-label">REQ-142: Password Reset Recovery</span>
                                </div>
                                <div className="tn-window-status">
                                    <span className="tn-status-pill-story">
                                        <span className="tn-pulse-dot" />
                                        <span>Live Stage: {currentState.label}</span>
                                    </span>
                                </div>
                            </div>

                            {/* Secondary Navigation & View Switcher */}
                            <div className="tn-story-subnav">
                                <div className="tn-story-subnav-tabs">
                                    {STORY_STATES.map((tab, idx) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveIndex(idx)}
                                            className={`tn-story-tab-btn ${idx === activeIndex ? 'is-active' : ''}`}
                                        >
                                            <span className="tn-tab-idx">{tab.stepNum}</span>
                                            <span>{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="tn-story-subnav-tools">
                                    <span className="tn-tool-pill">Branch: main</span>
                                    <span className="tn-tool-pill">Suite v2.4</span>
                                </div>
                            </div>

                            {/* Viewport: Continuous Dynamic State Panels */}
                            <div className="tn-story-viewport">
                                
                                {/* STATE 01: REQUIREMENT PANEL */}
                                <div className={`tn-state-panel ${activeIndex === 0 ? 'is-visible' : 'is-hidden'}`}>
                                    <div className="tn-panel-header-strip">
                                        <div className="tn-panel-badge-group">
                                            <span className="tn-badge tn-badge--blue">Jira PROD-842</span>
                                            <span className="tn-badge tn-badge--neutral">Auth & Identity</span>
                                            <span className="tn-badge tn-badge--amber">Needs Validation</span>
                                        </div>
                                        <span className="tn-panel-timestamp">Ingested 2m ago</span>
                                    </div>

                                    <div className="tn-req-spec-box">
                                        <h3 className="tn-req-spec-title">User Story & Acceptance Spec</h3>
                                        <p className="tn-req-spec-body">
                                            "As a registered user, I want to reset my password using my verified email address, so that I can regain access to my account if I lose my credentials."
                                        </p>
                                    </div>

                                    <div className="tn-ac-checklist">
                                        <h4 className="tn-ac-title">Stated Acceptance Criteria:</h4>
                                        <div className="tn-ac-item">
                                            <Check size={14} className="text-green" />
                                            <span>User submits email address on /forgot-password endpoint.</span>
                                        </div>
                                        <div className="tn-ac-item">
                                            <Check size={14} className="text-green" />
                                            <span>System dispatches password reset link containing verification token.</span>
                                        </div>
                                        <div className="tn-ac-item">
                                            <Check size={14} className="text-green" />
                                            <span>User inputs new compliant password and submits change request.</span>
                                        </div>
                                        <div className="tn-ac-item tn-ac-item--flagged">
                                            <AlertTriangle size={14} className="text-amber" />
                                            <span>Missing: Expiration TTL, invalid token behavior, rate limiting rules.</span>
                                        </div>
                                    </div>
                                </div>

                                {/* STATE 02: AI ANALYSIS PANEL */}
                                <div className={`tn-state-panel ${activeIndex === 1 ? 'is-visible' : 'is-hidden'}`}>
                                    <div className="tn-panel-header-strip">
                                        <div className="tn-panel-badge-group">
                                            <span className="tn-badge tn-badge--amber">4 Ambiguities Flagged</span>
                                            <span className="tn-badge tn-badge--blue">Intent Deconstructed</span>
                                        </div>
                                        <span className="tn-panel-timestamp">Analysis Complete (340ms)</span>
                                    </div>

                                    <div className="tn-ambiguity-notice">
                                        <AlertTriangle size={16} className="text-amber" />
                                        <div>
                                            <strong>Unstated Specifications Detected</strong>
                                            <p>Original story lacked token TTL expiration, anti-enumeration security, and rate limiting thresholds.</p>
                                        </div>
                                    </div>

                                    <div className="tn-analysis-categories-grid">
                                        <div className="tn-analysis-cat-box">
                                            <div className="tn-cat-header">
                                                <Layers size={14} className="text-accent" />
                                                <span>Functional Scenarios (5)</span>
                                            </div>
                                            <p>Valid registered email dispatch, token redemption flow, session termination.</p>
                                        </div>

                                        <div className="tn-analysis-cat-box">
                                            <div className="tn-cat-header">
                                                <AlertTriangle size={14} className="text-amber" />
                                                <span>Negative Scenarios (4)</span>
                                            </div>
                                            <p>Malformed email syntax, unregistered email address, already-consumed token reuse.</p>
                                        </div>

                                        <div className="tn-analysis-cat-box">
                                            <div className="tn-cat-header">
                                                <Shield size={14} className="text-red" />
                                                <span>Security & Abuse (3)</span>
                                            </div>
                                            <p>IP rate limiting (5 req/min), uniform response timing (anti-enumeration), token entropy.</p>
                                        </div>

                                        <div className="tn-analysis-cat-box">
                                            <div className="tn-cat-header">
                                                <SlidersHorizontal size={14} className="text-blue" />
                                                <span>Edge Cases & TTL (3)</span>
                                            </div>
                                            <p>Token redemption at T+15m01s (expired TTL), simultaneous resets, network timeout.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* STATE 03: TEST SUITE PANEL */}
                                <div className={`tn-state-panel ${activeIndex === 2 ? 'is-visible' : 'is-hidden'}`}>
                                    <div className="tn-panel-header-strip">
                                        <div className="tn-panel-badge-group">
                                            <span className="tn-badge tn-badge--green">18 Test Cases Generated</span>
                                            <span className="tn-badge tn-badge--neutral">BDD Ready</span>
                                        </div>
                                        <span className="tn-panel-timestamp">Status: Ready for Review</span>
                                    </div>

                                    <div className="tn-suite-preview-list">
                                        <div className="tn-suite-row is-high-priority">
                                            <div className="tn-suite-row-id">
                                                <span className="tn-tc-id">TC-001</span>
                                                <span className="tn-priority-tag tn-priority-tag--high">P0 &bull; High</span>
                                            </div>
                                            <div className="tn-suite-row-body">
                                                <strong>Submit registered email and verify cryptographic token dispatch</strong>
                                                <span className="tn-suite-meta">Type: Functional &bull; Preconditions: Active verified account &bull; 3 Steps</span>
                                            </div>
                                            <span className="tn-tc-status-pill">Ready</span>
                                        </div>

                                        <div className="tn-suite-row is-high-priority">
                                            <div className="tn-suite-row-id">
                                                <span className="tn-tc-id">TC-002</span>
                                                <span className="tn-priority-tag tn-priority-tag--high">P0 &bull; High</span>
                                            </div>
                                            <div className="tn-suite-row-body">
                                                <strong>Enforce RFC 5322 regex validation & assert HTTP 422 payload</strong>
                                                <span className="tn-suite-meta">Type: Negative &bull; Input: "user@", "admin..test" &bull; 2 Steps</span>
                                            </div>
                                            <span className="tn-tc-status-pill">Ready</span>
                                        </div>

                                        <div className="tn-suite-row">
                                            <div className="tn-suite-row-id">
                                                <span className="tn-tc-id">TC-003</span>
                                                <span className="tn-priority-tag tn-priority-tag--med">P1 &bull; Med</span>
                                            </div>
                                            <div className="tn-suite-row-body">
                                                <strong>Assert token invalidation after 15-minute TTL expiration window</strong>
                                                <span className="tn-suite-meta">Type: Edge Case &bull; Preconditions: Token issued 16m ago &bull; 2 Steps</span>
                                            </div>
                                            <span className="tn-tc-status-pill">Ready</span>
                                        </div>

                                        <div className="tn-suite-row">
                                            <div className="tn-suite-row-id">
                                                <span className="tn-tc-id">TC-004</span>
                                                <span className="tn-priority-tag tn-priority-tag--high">P0 &bull; High</span>
                                            </div>
                                            <div className="tn-suite-row-body">
                                                <strong>Rate limit IP exceeding 5 password reset requests per minute</strong>
                                                <span className="tn-suite-meta">Type: Security &bull; Assert: HTTP 429 Too Many Requests &bull; 2 Steps</span>
                                            </div>
                                            <span className="tn-tc-status-pill">Ready</span>
                                        </div>
                                    </div>
                                </div>

                                {/* STATE 04: COVERAGE PANEL */}
                                <div className={`tn-state-panel ${activeIndex === 3 ? 'is-visible' : 'is-hidden'}`}>
                                    <div className="tn-panel-header-strip">
                                        <div className="tn-panel-badge-group">
                                            <span className="tn-badge tn-badge--green">92% Clause Coverage</span>
                                            <span className="tn-badge tn-badge--blue">Zero Orphan Tests</span>
                                        </div>
                                        <span className="tn-panel-timestamp">Specification Audit: PASSED</span>
                                    </div>

                                    {/* Overall Progress Meter */}
                                    <div className="tn-coverage-meter-block">
                                        <div className="tn-cov-meter-header">
                                            <span>Total Specification Coverage</span>
                                            <span className="text-green font-mono font-bold">92.4%</span>
                                        </div>
                                        <div className="tn-cov-track">
                                            <div className="tn-cov-fill" style={{ width: '92.4%' }} />
                                        </div>
                                    </div>

                                    {/* Dimensions & Risk Cards */}
                                    <div className="tn-coverage-columns">
                                        <div className="tn-cov-bars-sub">
                                            <div className="tn-cov-sub-bar">
                                                <span>Functional Coverage</span>
                                                <span className="font-mono">94%</span>
                                            </div>
                                            <div className="tn-cov-sub-bar">
                                                <span>Negative Boundary Coverage</span>
                                                <span className="font-mono">88%</span>
                                            </div>
                                            <div className="tn-cov-sub-bar">
                                                <span>Security & Rate Limiting</span>
                                                <span className="font-mono">100%</span>
                                            </div>
                                            <div className="tn-cov-sub-bar">
                                                <span>Edge Case / TTL Expiration</span>
                                                <span className="font-mono">85%</span>
                                            </div>
                                        </div>

                                        <div className="tn-cov-risk-summary">
                                            <div className="tn-cov-risk-badge tn-cov-risk-badge--high">
                                                <strong>3 High-Severity Gaps</strong>
                                                <p>Mitigated by TC-003, TC-004, TC-005 in generated test suite.</p>
                                            </div>
                                            <div className="tn-cov-trace-link">
                                                <GitBranch size={13} className="text-accent" />
                                                <span>100% Bidirectional Traceability Verified</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Window Footer Status Strip */}
                            <div className="tn-window-footer">
                                <div className="tn-footer-left">
                                    <span className="tn-stat-dot" />
                                    <span>Engine: TestNexa Intelligence v3</span>
                                </div>
                                <div className="tn-footer-right">
                                    <span>Active State: {currentState.stepNum} &bull; {currentState.label}</span>
                                </div>
                            </div>
                        </div>

                        {/* Layer 3: Foreground Highlight Badges (translateY 0-60px) */}
                        <div 
                            className="tn-story-floating-badge" 
                            data-parallax-offset="55"
                            aria-hidden="true"
                        >
                            <Sparkles size={14} className="text-accent" />
                            <span>Continuous Requirement Verification</span>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default StickyProductStory;
