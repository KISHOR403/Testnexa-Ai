import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import MarketingLayout from './layouts/MarketingLayout';
import AppLayout from './layouts/AppLayout';

// Marketing Pages
import GeneratorPage from './pages/GeneratorPage';
import HelpPage from './pages/HelpPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import TermsPage from './pages/TermsPage';
import ApiReferencePage from './pages/ApiReferencePage';
import BestPracticesPage from './pages/BestPracticesPage';
import AboutUsPage from './pages/AboutUsPage';
import ContactPage from './pages/ContactPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Application Pages (Inside App Shell with Sidebar)
import WorkspacePage from './pages/app/WorkspacePage';
import HistoryPage from './pages/app/HistoryPage';
import TestSuitesListPage from './pages/app/TestSuitesListPage';
import TestSuiteDetailPage from './pages/app/TestSuiteDetailPage';
import CoveragePage from './pages/app/CoveragePage';
import RisksPage from './pages/app/RisksPage';
import TraceabilityPage from './pages/app/TraceabilityPage';
import AppSettingsPage from './pages/app/AppSettingsPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* ─── PUBLIC MARKETING WEBSITE (No Application Sidebar) ─── */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<GeneratorPage />} />
          <Route path="/features" element={<GeneratorPage />} />
          <Route path="/solutions" element={<GeneratorPage />} />
          <Route path="/how-it-works" element={<GeneratorPage />} />
          <Route path="/audience" element={<GeneratorPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/api-reference" element={<ApiReferencePage />} />
          <Route path="/best-practices" element={<BestPracticesPage />} />
          <Route path="/about" element={<AboutUsPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>

        {/* ─── ENTERPRISE APPLICATION SHELL (Dedicated Sidebar + Header) ─── */}
        <Route path="/app" element={<AppLayout />}>
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

        {/* ─── DIRECT REDIRECTS FOR CONVENIENCE ─── */}
        <Route path="/workspace" element={<Navigate to="/app/workspace" replace />} />
        <Route path="/history" element={<Navigate to="/app/history" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
