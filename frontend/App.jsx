import React, { Suspense, lazy, useState } from 'react';
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
const TestRunsPage = lazy(() => import('./pages/app/TestRunsPage'));
const TestCasesPage = lazy(() => import('./pages/app/TestCasesPage'));
const RunExecutionPage = lazy(() => import('./pages/app/RunExecutionPage'));
const AppSettingsPage = lazy(() => import('./pages/app/AppSettingsPage'));

// Dynamic discovery for Admin Console (active locally/privately; gracefully absent in public repo)
const adminPages = import.meta.glob('./pages/admin/*.jsx');
const adminLayouts = import.meta.glob('./layouts/AdminLayout.jsx');
const adminGuards = import.meta.glob('./components/AdminProtectedRoute.jsx');

const AdminProtectedRoute = adminGuards['./components/AdminProtectedRoute.jsx']
  ? lazy(adminGuards['./components/AdminProtectedRoute.jsx'])
  : ({ children }) => children;

const AdminLayout = adminLayouts['./layouts/AdminLayout.jsx']
  ? lazy(adminLayouts['./layouts/AdminLayout.jsx'])
  : () => <Navigate to="/login" replace />;

const AdminOverviewPage = adminPages['./pages/admin/AdminOverviewPage.jsx']
  ? lazy(adminPages['./pages/admin/AdminOverviewPage.jsx'])
  : () => <Navigate to="/login" replace />;

const AdminUsersPage = adminPages['./pages/admin/AdminUsersPage.jsx']
  ? lazy(adminPages['./pages/admin/AdminUsersPage.jsx'])
  : () => null;

const AdminWorkspacesPage = adminPages['./pages/admin/AdminWorkspacesPage.jsx']
  ? lazy(adminPages['./pages/admin/AdminWorkspacesPage.jsx'])
  : () => null;

const AdminBillingPage = adminPages['./pages/admin/AdminBillingPage.jsx']
  ? lazy(adminPages['./pages/admin/AdminBillingPage.jsx'])
  : () => null;

const AdminGenerationsPage = adminPages['./pages/admin/AdminGenerationsPage.jsx']
  ? lazy(adminPages['./pages/admin/AdminGenerationsPage.jsx'])
  : () => null;

const AdminHealthPage = adminPages['./pages/admin/AdminHealthPage.jsx']
  ? lazy(adminPages['./pages/admin/AdminHealthPage.jsx'])
  : () => null;

const AdminSupportPage = adminPages['./pages/admin/AdminSupportPage.jsx']
  ? lazy(adminPages['./pages/admin/AdminSupportPage.jsx'])
  : () => null;

const AdminAuditLogsPage = adminPages['./pages/admin/AdminAuditLogsPage.jsx']
  ? lazy(adminPages['./pages/admin/AdminAuditLogsPage.jsx'])
  : () => null;

const AdminConfigPage = adminPages['./pages/admin/AdminConfigPage.jsx']
  ? lazy(adminPages['./pages/admin/AdminConfigPage.jsx'])
  : () => null;

const AdminLoginPage = adminPages['./pages/admin/AdminLoginPage.jsx']
  ? lazy(adminPages['./pages/admin/AdminLoginPage.jsx'])
  : () => <Navigate to="/login" replace />;

import { useAuth } from './context/AuthContext';
import { AppInitialLoader, RouteLoadingFallback } from './components/loading';

// Suite share link redirect helper (handles shared workspace links)
const SuiteShareRedirect = () => {
  const { id } = useParams();
  const location = useLocation();
  const targetPath = id ? `/app/test-suites/${id}${location.search}` : '/app/test-suites';
  return <Navigate to={targetPath} replace />;
};

// Run share / direct link redirect helper
const RunShareRedirect = () => {
  const { id } = useParams();
  const location = useLocation();
  const targetPath = id ? `/app/runs/${id}${location.search}` : '/app/runs';
  return <Navigate to={targetPath} replace />;
};

function AppContent() {
  const { isLoading } = useAuth();
  const [hasBootstrapped, setHasBootstrapped] = useState(() => {
    return sessionStorage.getItem('testnexa_app_initialized') === 'true';
  });

  const handleBootstrapComplete = () => {
    sessionStorage.setItem('testnexa_app_initialized', 'true');
    setHasBootstrapped(true);
  };

  return (
    <>
      {/* ─── A. INITIAL APPLICATION LOADING ─── */}
      {!hasBootstrapped && (
        <AppInitialLoader
          isReady={!isLoading}
          message="Preparing your workspace"
          onComplete={handleBootstrapComplete}
        />
      )}

      {/* Dynamic SEO, Canonical & OpenGraph Controller */}
      <SeoManager />

      <Suspense fallback={<RouteLoadingFallback />}>
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
            <Route path="workspace/new-test-suite" element={<Navigate to="/app/workspace" replace />} />
            <Route path="workspace/:sessionId" element={<WorkspacePage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="test-suites" element={<TestSuitesListPage />} />
            <Route path="test-suites/:id" element={<TestSuiteDetailPage />} />
            <Route path="test-cases" element={<TestCasesPage />} />
            <Route path="runs" element={<TestRunsPage />} />
            <Route path="runs/:runId" element={<RunExecutionPage />} />
            <Route path="coverage" element={<CoveragePage />} />
            <Route path="risks" element={<RisksPage />} />
            <Route path="traceability" element={<TraceabilityPage />} />
            <Route path="settings" element={<AppSettingsPage />} />
            <Route path="billing" element={<Navigate to="/app/settings?tab=billing" replace />} />
          </Route>

          {/* ─── DEDICATED ADMINISTRATOR LOGIN ─── */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* ─── SECURE PLATFORM ADMIN CONSOLE ─── */}
          <Route path="/admin" element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="workspaces" element={<AdminWorkspacesPage />} />
            <Route path="billing" element={<AdminBillingPage />} />
            <Route path="generations" element={<AdminGenerationsPage />} />
            <Route path="health" element={<AdminHealthPage />} />
            <Route path="support" element={<AdminSupportPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="config" element={<AdminConfigPage />} />
          </Route>

          {/* ─── DIRECT REDIRECTS FOR CONVENIENCE & SHARE LINKS ─── */}
          <Route path="/suites/:id" element={<SuiteShareRedirect />} />
          <Route path="/suites" element={<Navigate to="/app/test-suites" replace />} />
          <Route path="/runs/:id" element={<RunShareRedirect />} />
          <Route path="/runs" element={<Navigate to="/app/runs" replace />} />
          <Route path="/workspace/new-test-suite" element={<Navigate to="/app/workspace" replace />} />
          <Route path="/workspace" element={<Navigate to="/app/workspace" replace />} />
          <Route path="/new-test-suite" element={<Navigate to="/app/workspace" replace />} />
          <Route path="/generator" element={<Navigate to="/app/workspace" replace />} />
          <Route path="/history" element={<Navigate to="/app/history" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
          <Route path="/billing" element={<Navigate to="/app/settings?tab=billing" replace />} />

          {/* ─── CATCH-ALL 404 NOT FOUND ─── */}
          <Route element={<MarketingLayout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
