import React, { Suspense, lazy } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import TestNexaLogo from '../components/TestNexaLogo';
import '../styles/auth.css';

// Lazy-load the animated product showcase so it never blocks form interaction
const ShowcaseAnimation = lazy(() => import('../components/auth/ShowcaseAnimation'));

/**
 * Reusable Production AuthLayout
 * Strict Black-and-White B2B SaaS Design System:
 * - Desktop (>=1024px): 45% Form column | 55% Animated Showcase panel
 * - Tablets (768-1023px): Centered card with 3-step continuous traceability strip
 * - Phones (320-430px): 100dvh single-column, 20px padding, collapsed back arrow
 */
const AuthLayout = () => {
  return (
    <div className="tn-auth-viewport">
      <div className="tn-auth-layout-grid auth">
        {/* ─── LEFT COLUMN: Form & Navigation ─── */}
        <section className="tn-auth-form-col" aria-label="Authentication">
          {/* Header Bar */}
          <header className="tn-auth-topbar">
            <Link to="/" className="tn-auth-brand" aria-label="Testnexa Home">
              <TestNexaLogo size={26} className="tn-auth-brand-logo" />
              <span className="tn-auth-brand-wordmark">Testnexa</span>
            </Link>

            <Link to="/" className="tn-auth-back-link" aria-label="Back to website">
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="tn-auth-back-text">Back to website</span>
            </Link>
          </header>

          {/* Tablet 3-step continuous traceability strip (768-1023px) */}
          <div className="tn-auth-tablet-strip" aria-hidden="true">
            <div className="tn-strip-step is-active">
              <span className="tn-strip-num">01</span>
              <span className="tn-strip-label">Requirement</span>
            </div>
            <div className="tn-strip-line" />
            <div className="tn-strip-step">
              <span className="tn-strip-num">02</span>
              <span className="tn-strip-label">Tests</span>
            </div>
            <div className="tn-strip-line" />
            <div className="tn-strip-step">
              <span className="tn-strip-num">03</span>
              <span className="tn-strip-label">Traced</span>
            </div>
          </div>

          {/* Centered Form Content Slot */}
          <main className="tn-auth-form-center">
            <Outlet />
          </main>

          {/* Footer Legal Links */}
          <footer className="tn-auth-footer">
            <span className="tn-auth-copyright">
              &copy; {new Date().getFullYear()} Testnexa AI. All rights reserved.
            </span>
            <div className="tn-auth-legal-links">
              <Link to="/privacy" className="tn-auth-legal-link">Privacy</Link>
              <span className="tn-auth-legal-sep" aria-hidden="true">&bull;</span>
              <Link to="/terms" className="tn-auth-legal-link">Terms</Link>
            </div>
          </footer>
        </section>

        {/* ─── RIGHT COLUMN: Animated Product Showcase (Desktop >= 1024px) ─── */}
        <aside
          className="tn-auth-showcase-col"
          aria-hidden="true"
          tabIndex={-1}
        >
          {/* Subtle dot grid with radial mask */}
          <div className="tn-auth-showcase-grid" />

          {/* Soft white drifting radial glow */}
          <div className="tn-auth-showcase-glow" />

          {/* Lazy-loaded Showcase Mock with reserved CLS bounds */}
          <Suspense fallback={<div className="tn-showcase-fallback" />}>
            <ShowcaseAnimation />
          </Suspense>
        </aside>
      </div>
    </div>
  );
};

export default AuthLayout;
