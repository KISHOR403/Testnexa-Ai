import React, { useState, useEffect, useRef } from 'react';
import './ShowcaseAnimation.css';

/**
 * Animated Product Showcase - Continuous Traceability Thread
 * 12s pure CSS hardware-accelerated loop illustrating how Testnexa AI
 * converts natural language requirements into rigorously traced test cases.
 *
 * Decorative element: aria-hidden="true", zero tab stops, paused when tab hidden or hovered.
 */
const ShowcaseAnimation = ({
  timeOverride = null,
  forceStatic = false,
  className = ''
}) => {
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef(null);

  // Monitor document visibility to pause execution when the browser tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabHidden(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const isPaused = isTabHidden || isHovered;

  // Determine override dataset attribute for test suites or visual validation
  const datasetAttrs = {};
  if (forceStatic) {
    datasetAttrs['data-static-frame'] = 'true';
  } else if (timeOverride) {
    datasetAttrs['data-time-frame'] = `${timeOverride}s`;
  }

  return (
    <div
      ref={containerRef}
      className={`tn-showcase-container ${className}`.trim()}
      aria-hidden="true"
      tabIndex={-1}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...datasetAttrs}
    >
      {/* ─── Mock Workspace Panel ─── */}
      <div className={`tn-showcase-panel ${isPaused ? 'is-paused' : ''}`}>
        {/* Soft Scan-line Sweep */}
        <div className="tn-showcase-scanline" />

        {/* 1. Top Header Bar */}
        <div className="tn-showcase-header">
          <div className="tn-showcase-header-left">
            <span className="tn-showcase-live-dot" />
            <span className="tn-showcase-title-mono">spec-analysis · PRD-AUTH-004</span>
          </div>
          <span className="tn-showcase-badge-mono">ACTIVE SPEC</span>
        </div>

        {/* 2. Requirement Box with Typing and Ambiguity Detection */}
        <div className="tn-showcase-requirement-box">
          <div className="tn-showcase-req-tag">
            <span>REQ-01</span>
            <span>·</span>
            <span>SPECIFICATION</span>
          </div>

          <div className="tn-showcase-req-text">
            <span className="tn-showcase-req-typed">
              Users must{' '}
              <span className="tn-ambiguous-word">reset</span>{' '}
              their password using their{' '}
              <span className="tn-ambiguous-word">registered</span>{' '}
              email.
            </span>
          </div>

          {/* Ambiguity Alert Tooltip Chip */}
          <div className="tn-showcase-tooltip">
            <span className="tn-showcase-tooltip-dot" />
            <span>Ambiguous: define token lifetime</span>
          </div>
        </div>

        {/* 3. Test-Case Cards Stream */}
        <div className="tn-showcase-cards">
          {/* Card 1 */}
          <div className="tn-showcase-card tn-showcase-card-1">
            <div className="tn-card-top">
              <div className="tn-card-id-tag">
                <span className="tn-card-id">TC-01</span>
                <span className="tn-card-tag">SEC</span>
              </div>
              <span className="tn-card-traced-pill">
                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2.5 6 5 8.5 9.5 3.5" />
                </svg>
                Traced
              </span>
            </div>
            <div className="tn-card-title">Token Lifetime Expiry</div>
            <div className="tn-card-rationale">Rejects tokens older than 15 mins</div>
          </div>

          {/* Card 2 */}
          <div className="tn-showcase-card tn-showcase-card-2">
            <div className="tn-card-top">
              <div className="tn-card-id-tag">
                <span className="tn-card-id">TC-02</span>
                <span className="tn-card-tag">EDGE</span>
              </div>
              <span className="tn-card-traced-pill">
                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2.5 6 5 8.5 9.5 3.5" />
                </svg>
                Traced
              </span>
            </div>
            <div className="tn-card-title">Unregistered Email Request</div>
            <div className="tn-card-rationale">Returns silent 200 without leaking account status</div>
          </div>

          {/* Card 3 */}
          <div className="tn-showcase-card tn-showcase-card-3">
            <div className="tn-card-top">
              <div className="tn-card-id-tag">
                <span className="tn-card-id">TC-03</span>
                <span className="tn-card-tag">POS</span>
              </div>
              <span className="tn-card-traced-pill">
                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2.5 6 5 8.5 9.5 3.5" />
                </svg>
                Traced
              </span>
            </div>
            <div className="tn-card-title">Standard Reset Flow</div>
            <div className="tn-card-rationale">Issues single-use HMAC token and sends dispatch</div>
          </div>
        </div>

        {/* 4. Traceability Thread SVG Paths */}
        <svg
          className="tn-showcase-threads-svg"
          viewBox="0 0 512 400"
          preserveAspectRatio="none"
        >
          {/* Thread from TC-01 */}
          <path
            className="tn-trace-path"
            d="M 28 200 C 28 150, 60 115, 120 102"
          />
          <circle className="tn-trace-pulse" cx="74" cy="126" r="3" />

          {/* Thread from TC-02 */}
          <path
            className="tn-trace-path"
            d="M 28 268 C 28 190, 70 120, 160 102"
          />
          <circle className="tn-trace-pulse" cx="94" cy="144" r="3" />

          {/* Thread from TC-03 */}
          <path
            className="tn-trace-path"
            d="M 28 336 C 28 230, 80 125, 200 102"
          />
          <circle className="tn-trace-pulse" cx="114" cy="168" r="3" />
        </svg>

        {/* 5. Stat Row */}
        <div className="tn-showcase-stats-row">
          <div className="tn-showcase-stat-box">
            <span className="tn-showcase-stat-val">3</span>
            <span className="tn-showcase-stat-label">Tests</span>
          </div>
          <div className="tn-showcase-stat-box">
            <span className="tn-showcase-stat-val">100%</span>
            <span className="tn-showcase-stat-label">Traced</span>
          </div>
          <div className="tn-showcase-stat-box">
            <span className="tn-showcase-stat-val">0</span>
            <span className="tn-showcase-stat-label">Orphan Assertions</span>
          </div>
        </div>
      </div>

      {/* ─── Footer Quote & Caption Under Mock Panel ─── */}
      <div className="tn-showcase-footer">
        <h2 className="tn-showcase-quote">
          Every test traces back to a reason.
        </h2>
        <p className="tn-showcase-caption">
          <span className="tn-showcase-caption-full">
            Continuous traceability from natural language requirements to automated test suites.
          </span>
          <span className="tn-showcase-caption-short">
            Continuous traceability from requirements to test execution.
          </span>
        </p>
      </div>
    </div>
  );
};

export default ShowcaseAnimation;
