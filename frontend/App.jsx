import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';

// Layouts & Guards
import MarketingLayout from './layouts/MarketingLayout';
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import SeoManager from './components/SeoManager';

// Lazy-loaded Marketing & Static Pages
const GeneratorPage = lazy(() => import('./pages/GeneratorPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ApiReferencePage = lazy(() => import('./pages/ApiReferencePage'));
const BestPracticesPage = lazy(() => import('./pages/BestPracticesPage'));
const AboutUsPage = lazy(() => import('./pages/AboutUsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Lazy-loaded Application Pages
const WorkspacePage = lazy(() => import('./pages/app/WorkspacePage'));
const HistoryPage = lazy(() => import('./pages/app/HistoryPage'));
const TestSuitesListPage = lazy(() => import('./pages/app/TestSuitesListPage'));
const TestSuiteDetailPage = lazy(() => import('./pages/app/TestSuiteDetailPage'));
const CoveragePage = lazy(() => import('./pages/app/CoveragePage'));
const RisksPage = lazy(() => import('./pages/app/RisksPage'));
const TraceabilityPage = lazy(() => import('./pages/app/TraceabilityPage'));
const AppSettingsPage = lazy(() => import('./pages/app/AppSettingsPage'));

// Minimal, accessible loading fallback
const PageLoadingFallback = () => (
  <div
    style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050505'
    }}
    role="status"
    aria-label="Loading page"
  >
    <div
      style={{
        width: '32px',
        height: '32px',
        border: '2px solid rgba(79, 140, 255, 0.15)',
        borderTopColor: '#4F8CFF',
        borderRadius: '50%',
        animation: 'tnSpin 0.7s linear infinite'
      }}
    />
    <style>{`
      @keyframes tnSpin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Suite share link redirect helper (handles shared workspace links)
const SuiteShareRedirect = () => {
  const { id } = useParams();
  const location = useLocation();
  const targetPath = id ? `/app/test-suites/${id}${location.search}` : '/app/test-suites';
  return <Navigate to={targetPath} replace />;
};

function App() {
  return (
    <Router>
      {/* Dynamic SEO, Canonical & OpenGraph Controller */}
      <SeoManager />

      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          {/* ─── DEDICATED MINIMAL AUTH PAGES ─── */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          </Route>

          {/* ─── PUBLIC MARKETING & STATIC PAGES ─── */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<GeneratorPage />} />
            <Route path="/features" element={<GeneratorPage />} />
            <Route path="/solutions" element={<GeneratorPage />} />
            <Route path="/how-it-works" element={<GeneratorPage />} />
            <Route path="/audience" element={<GeneratorPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/help/:articleId" element={<HelpPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/cookie-policy" element={<TermsPage defaultDocId="cookies" />} />
            <Route path="/api-terms" element={<TermsPage defaultDocId="api-terms" />} />
            <Route path="/acceptable-use" element={<TermsPage defaultDocId="acceptable-use" />} />
            <Route path="/legal" element={<TermsPage />} />
            <Route path="/api-reference" element={<ApiReferencePage />} />
            <Route path="/best-practices" element={<BestPracticesPage />} />
            <Route path="/about" element={<AboutUsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/404" element={<NotFoundPage />} />
          </Route>

          {/* ─── APPLICATION / WORKSPACE PAGES ─── */}
          <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/app/workspace" replace />} />
            <Route path="workspace" element={<WorkspacePage />} />
            <Route path="workspace/:sessionId" element={<WorkspacePage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="test-suites" element={<TestSuitesListPage />} />
            <Route path="test-suites/:id" element={<TestSuiteDetailPage />} />
            <Route path="coverage" element={<CoveragePage />} />
            <Route path="risks" element={<RisksPage />} />
            <Route path="traceability" element={<TraceabilityPage />} />
            <Route path="settings" element={<AppSettingsPage />} />
          </Route>

          {/* ─── DIRECT REDIRECTS FOR CONVENIENCE & SHARE LINKS ─── */}
          <Route path="/suites/:id" element={<SuiteShareRedirect />} />
          <Route path="/suites" element={<Navigate to="/app/test-suites" replace />} />
          <Route path="/workspace" element={<Navigate to="/app/workspace" replace />} />
          <Route path="/history" element={<Navigate to="/app/history" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

          {/* ─── CATCH-ALL 404 NOT FOUND ─── */}
          <Route element={<MarketingLayout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
