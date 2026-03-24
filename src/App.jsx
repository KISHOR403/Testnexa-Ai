import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AntigravityBackground from './components/AntigravityBackground';
import GeneratorPage from './pages/GeneratorPage';
import HistoryPage from './pages/HistoryPage';
import HelpPage from './pages/HelpPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import TermsPage from './pages/TermsPage';
import ApiReferencePage from './pages/ApiReferencePage';
import BestPracticesPage from './pages/BestPracticesPage';
import AboutUsPage from './pages/AboutUsPage';
import ContactPage from './pages/ContactPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import HistorySidebar from './components/HistorySidebar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const handleNewAnalysis = () => {
    setResetKey(prev => prev + 1);
  };

  return (
    <Router>
      <ScrollToTop />
      <div className={`app-container sidebar-has-rail ${isSidebarOpen ? 'sidebar-is-open' : ''}`}>
        <AntigravityBackground />
        <HistorySidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpen={() => setIsSidebarOpen(true)}
          onNewAnalysis={handleNewAnalysis}
        />
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNewAnalysis={handleNewAnalysis}
        />
        <main>
          <Routes>
            <Route path="/" element={<GeneratorPage key={resetKey} />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/api-reference" element={<ApiReferencePage />} />
            <Route path="/best-practices" element={<BestPracticesPage />} />
            <Route path="/about" element={<AboutUsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
