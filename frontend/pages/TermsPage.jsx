import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Printer,
  Copy,
  Check,
  ChevronDown,
  ArrowUp
} from 'lucide-react';
import '../styles/legalPage.css';

// ─── Legal Document Configurations ───
const LEGAL_DOCS = [
  {
    id: 'terms',
    label: 'Terms & Conditions',
    path: '/terms',
    title: 'Terms & Conditions',
    lastUpdated: 'September 12, 2026',
    description: 'These Terms & Conditions govern your access to and use of TestNexa.'
  },
  {
    id: 'privacy',
    label: 'Privacy Policy',
    path: '/privacy',
    title: 'Privacy Policy',
    lastUpdated: 'September 12, 2026',
    description: 'How TestNexa collects, processes, and protects your personal and workspace data.'
  },
  {
    id: 'cookies',
    label: 'Cookie Policy',
    path: '/cookie-policy',
    title: 'Cookie Policy',
    lastUpdated: 'September 12, 2026',
    description: 'How cookies and local browser storage are utilized for authentication and functionality.'
  },
  {
    id: 'api-terms',
    label: 'API Terms',
    path: '/api-terms',
    title: 'Developer API Terms of Use',
    lastUpdated: 'September 12, 2026',
    description: 'Rules, operational safeguards, and limits governing programmatic API access.'
  },
  {
    id: 'acceptable-use',
    label: 'Acceptable Use',
    path: '/acceptable-use',
    title: 'Acceptable Use Policy',
    lastUpdated: 'September 12, 2026',
    description: 'Standards of conduct, prohibited activities, and infrastructure usage policies.'
  }
];

// ─── Section Definitions for Terms & Conditions ───
const TERMS_SECTIONS = [
  { id: 'sec-1', num: '1', title: 'Introduction' },
  { id: 'sec-2', num: '2', title: 'Acceptance of Terms' },
  { id: 'sec-3', num: '3', title: 'Use of Service' },
  { id: 'sec-4', num: '4', title: 'Intellectual Property Rights' },
  { id: 'sec-5', num: '5', title: 'Privacy and Data Protection' },
  { id: 'sec-6', num: '6', title: 'Subscription and Payment' },
  { id: 'sec-7', num: '7', title: 'Limitation of Liability' },
  { id: 'sec-8', num: '8', title: 'Termination' },
  { id: 'sec-9', num: '9', title: 'Changes to Terms' },
  { id: 'sec-10', num: '10', title: 'Governing Law' },
  { id: 'sec-11', num: '11', title: 'Contact Information' }
];

// ─── Sections for Privacy Policy ───
const PRIVACY_SECTIONS = [
  { id: 'priv-1', num: '1', title: 'Information We Collect' },
  { id: 'priv-2', num: '2', title: 'How We Use Your Data' },
  { id: 'priv-3', num: '3', title: 'AI Processing & Data Isolation' },
  { id: 'priv-4', num: '4', title: 'Data Security' },
  { id: 'priv-5', num: '5', title: 'Subprocessors & Infrastructure' },
  { id: 'priv-6', num: '6', title: 'Your Rights & Data Portability' },
  { id: 'priv-7', num: '7', title: 'Privacy Contact' }
];

// ─── Sections for Cookie Policy ───
const COOKIE_SECTIONS = [
  { id: 'cook-1', num: '1', title: 'What Are Cookies?' },
  { id: 'cook-2', num: '2', title: 'Categories of Cookies Used' },
  { id: 'cook-3', num: '3', title: 'Managing Cookie Preferences' },
  { id: 'cook-4', num: '4', title: 'Updates to this Policy' }
];

// ─── Sections for API Terms ───
const API_SECTIONS = [
  { id: 'api-1', num: '1', title: 'API Access & Credentials' },
  { id: 'api-2', num: '2', title: 'Rate Limits & Quota Policies' },
  { id: 'api-3', num: '3', title: 'Acceptable API Usage' },
  { id: 'api-4', num: '4', title: 'Service Levels & Deprecation' },
  { id: 'api-5', num: '5', title: 'Indemnification' }
];

// ─── Sections for Acceptable Use ───
const AUP_SECTIONS = [
  { id: 'aup-1', num: '1', title: 'Scope & Purpose' },
  { id: 'aup-2', num: '2', title: 'Prohibited Activities' },
  { id: 'aup-3', num: '3', title: 'System Security & Testing Boundaries' },
  { id: 'aup-4', num: '4', title: 'Enforcement & Reporting' }
];

const TermsPage = ({ defaultDocId }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Resolve current active doc
  const getDocFromPath = () => {
    if (defaultDocId) return defaultDocId;
    const path = location.pathname.toLowerCase();
    if (path.includes('privacy')) return 'privacy';
    if (path.includes('cookie')) return 'cookies';
    if (path.includes('api-terms')) return 'api-terms';
    if (path.includes('acceptable-use')) return 'acceptable-use';
    return 'terms';
  };

  const [activeDocId, setActiveDocId] = useState(getDocFromPath());
  const [activeSectionId, setActiveSectionId] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setActiveDocId(getDocFromPath());
  }, [location.pathname, defaultDocId]);

  const activeDoc = LEGAL_DOCS.find(d => d.id === activeDocId) || LEGAL_DOCS[0];

  const sectionsByDoc = {
    terms: TERMS_SECTIONS,
    privacy: PRIVACY_SECTIONS,
    cookies: COOKIE_SECTIONS,
    'api-terms': API_SECTIONS,
    'acceptable-use': AUP_SECTIONS
  };

  const activeSections = sectionsByDoc[activeDocId] || TERMS_SECTIONS;

  // Set default active section
  useEffect(() => {
    if (activeSections.length > 0) {
      setActiveSectionId(activeSections[0].id);
    }
  }, [activeDocId]);

  // Scrollspy via IntersectionObserver
  useEffect(() => {
    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSectionId(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-15% 0px -65% 0px',
      threshold: 0
    });

    activeSections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [activeDocId, activeSections]);

  const handleDocSwitch = (doc) => {
    setActiveDocId(doc.id);
    navigate(doc.path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSmoothScroll = (e, sectionId) => {
    e.preventDefault();
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSectionId(sectionId);
      // update hash without jumping
      window.history.replaceState(null, '', `#${sectionId}`);
    }
  };

  const handleMobileSectionSelect = (e) => {
    const sectionId = e.target.value;
    if (sectionId) {
      const target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveSectionId(sectionId);
        window.history.replaceState(null, '', `#${sectionId}`);
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="tn-legal-root">
      {/* ─── Compact Legal Header ─── */}
      <header className="tn-legal-header">
        <div className="tn-legal-container">
          <div className="tn-legal-header__inner">
            <div className="tn-legal-header__content">
              <nav className="tn-legal-breadcrumb" aria-label="Breadcrumb">
                <Link to="/terms" className="tn-legal-breadcrumb__link">Legal</Link>
                <span className="tn-legal-breadcrumb__separator">/</span>
                <span className="tn-legal-breadcrumb__current">{activeDoc.title}</span>
              </nav>

              <h1 className="tn-legal-title">{activeDoc.title}</h1>

              <div className="tn-legal-meta">
                <span>Last updated: {activeDoc.lastUpdated}</span>
              </div>

              <p className="tn-legal-description">{activeDoc.description}</p>
            </div>

            <div className="tn-legal-header__actions">
              <button
                type="button"
                className="tn-legal-action-btn"
                onClick={handlePrint}
                title="Print or save document as PDF"
                aria-label="Print document"
              >
                <Printer size={14} aria-hidden="true" />
                <span>Print</span>
              </button>
              <button
                type="button"
                className="tn-legal-action-btn"
                onClick={handleCopyLink}
                title="Copy direct link to document"
                aria-label="Copy link to document"
              >
                {copiedLink ? <Check size={14} color="#00D9C0" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                <span>{copiedLink ? 'Link copied' : 'Copy link'}</span>
              </button>
            </div>
          </div>

          {/* ─── Mobile Jump & Switch Controls ─── */}
          <div className="tn-legal-mobile-bar" aria-label="Mobile navigation">
            <div className="tn-legal-mobile-select-wrap">
              <label htmlFor="mobile-doc-select" className="sr-only">Select Legal Document</label>
              <select
                id="mobile-doc-select"
                className="tn-legal-mobile-select"
                value={activeDocId}
                onChange={(e) => {
                  const doc = LEGAL_DOCS.find(d => d.id === e.target.value);
                  if (doc) handleDocSwitch(doc);
                }}
              >
                {LEGAL_DOCS.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="tn-legal-mobile-select-icon" aria-hidden="true" />
            </div>

            <div className="tn-legal-mobile-select-wrap">
              <label htmlFor="mobile-section-select" className="sr-only">Jump to Section</label>
              <select
                id="mobile-section-select"
                className="tn-legal-mobile-select"
                value={activeSectionId}
                onChange={handleMobileSectionSelect}
              >
                <option value="" disabled>On this page...</option>
                {activeSections.map(sec => (
                  <option key={sec.id} value={sec.id}>{sec.num}. {sec.title}</option>
                ))}
              </select>
              <ChevronDown size={14} className="tn-legal-mobile-select-icon" aria-hidden="true" />
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Desktop 3-Column Documentation Grid ─── */}
      <main className="tn-legal-container">
        <div className="tn-legal-grid">
          {/* ════ LEFT COLUMN: Legal Navigation ════ */}
          <aside className="tn-legal-sidebar" aria-label="Legal Documents Navigation">
            <div className="tn-legal-nav-header">Legal</div>
            <nav className="tn-legal-nav">
              {LEGAL_DOCS.map((doc) => {
                const isActive = doc.id === activeDocId;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleDocSwitch(doc)}
                    className={`tn-legal-nav-link ${isActive ? 'is-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span>{doc.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* ════ CENTER COLUMN: Terms & Legal Content ════ */}
          <article className="tn-legal-document" role="document">
            {/* ────────────────────────────────────────────────────────────
                DOCUMENT 1: TERMS & CONDITIONS
               ──────────────────────────────────────────────────────────── */}
            {activeDocId === 'terms' && (
              <>
                {/* 1. Introduction */}
                <section id="sec-1" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">1. Introduction</h2>
                  <p>
                    Welcome to TestNexa (&quot;TestNexa&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). These Terms &amp; Conditions
                    (&quot;Terms&quot;) govern your access to and use of TestNexa, including our automated test intelligence
                    platform, web applications, and developer software testing services (collectively, the &quot;Service&quot;).
                  </p>
                  <p>
                    Please read these Terms carefully before accessing or using the Service. By accessing, browsing,
                    or using the Service in any manner, you acknowledge that you have read, understood, and agreed to be
                    legally bound by these Terms and our incorporated Privacy Policy.
                  </p>
                </section>

                {/* 2. Acceptance of Terms */}
                <section id="sec-2" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">2. Acceptance of Terms</h2>
                  <p>
                    By creating an account, accessing the Service, generating test suites, or integrating our APIs,
                    you signify your agreement to these Terms. If you do not agree to all conditions outlined herein,
                    you must refrain from accessing or using TestNexa.
                  </p>

                  <h3 className="tn-legal-clause__subheading">2.1 Eligibility</h3>
                  <p>
                    You must be at least 18 years of age (or have reached the legal age of majority in your jurisdiction)
                    to access or use the Service. If you are entering into these Terms on behalf of an entity, such as
                    your employer or company, you represent and warrant that you possess the full legal authority to bind
                    that organization to these Terms.
                  </p>

                  <h3 className="tn-legal-clause__subheading">2.2 User Responsibilities</h3>
                  <p>
                    You agree to maintain the confidentiality of any authentication credentials associated with your
                    account and are responsible for all activities that occur under your account. You agree to notify us
                    promptly of any unauthorized use or security compromise regarding your credentials.
                  </p>
                </section>

                {/* 3. Use of Service */}
                <section id="sec-3" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">3. Use of Service</h2>

                  <h3 className="tn-legal-clause__subheading">3.1 Permitted Use</h3>
                  <p>
                    Subject to compliance with these Terms, TestNexa grants you a limited, non-exclusive, non-transferable,
                    revocable right to access and use the Service for your internal business and lawful software quality
                    assurance and testing workflows.
                  </p>

                  <h3 className="tn-legal-clause__subheading">3.2 Prohibited Activities</h3>
                  <p>In accessing or using TestNexa, you agree not to:</p>
                  <ul className="tn-legal-list">
                    <li>Circumvent or attempt to bypass system rate-limits, access control barriers, or quota mechanisms.</li>
                    <li>Reverse engineer, decompile, disassemble, or derive underlying source code or system architectures of the Service.</li>
                    <li>Submit material containing malicious code, viruses, or unlawful, harassing, or infringing data.</li>
                    <li>Interfere with, compromise the operational integrity of, or burden the infrastructure supporting the Service.</li>
                    <li>Use the Service or generated output to construct or train a directly competing commercial testing product.</li>
                  </ul>
                </section>

                {/* 4. Intellectual Property Rights */}
                <section id="sec-4" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">4. Intellectual Property Rights</h2>

                  <h3 className="tn-legal-clause__subheading">4.1 Our Rights</h3>
                  <p>
                    The Service, including its platform architecture, synthesis algorithms, risk scoring models, user interfaces,
                    trademarks, brand assets, and documentation, is and remains the exclusive intellectual property of
                    TestNexa and its licensors. Except for the limited access rights expressly granted herein, no other rights
                    are conveyed.
                  </p>

                  <h3 className="tn-legal-clause__subheading">4.2 Your Content</h3>
                  <p>
                    You retain ownership of any requirements, user stories, software specifications, and project metadata
                    (&quot;Customer Input&quot;) that you submit to the Service. You grant TestNexa a limited, non-exclusive license
                    solely to process and transmit your Customer Input to operate and deliver the Service to you.
                  </p>

                  <h3 className="tn-legal-clause__subheading">4.3 Generated Content</h3>
                  <p>
                    Subject to your compliance with these Terms and applicable payment obligations, TestNexa assigns to you all
                    right, title, and interest in and to the concrete test cases, steps, and test suites generated specifically
                    for your submitted requirements. You may freely use, integrate, and execute these test suites in your
                    commercial or open-source software projects.
                  </p>
                </section>

                {/* 5. Privacy and Data Protection */}
                <section id="sec-5" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">5. Privacy and Data Protection</h2>
                  <p>
                    Our data collection and processing practices are governed by our{' '}
                    <Link to="/privacy" className="tn-legal-inline-link">
                      Privacy Policy
                    </Link>
                    , which is incorporated into these Terms by reference. Please review our Privacy Policy to understand how
                    we handle personal and technical information.
                  </p>
                  <p>
                    We implement industry-standard administrative, physical, and technical safeguards designed to protect
                    your information against unauthorized access, loss, or alteration.
                  </p>
                </section>

                {/* 6. Subscription and Payment */}
                <section id="sec-6" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">6. Subscription and Payment</h2>

                  <h3 className="tn-legal-clause__subheading">6.1 Free Tier</h3>
                  <p>
                    TestNexa offers free tier access for evaluation and individual developers with designated usage quotas.
                    We reserve the right to modify or adjust free tier allocations, features, and availability at our reasonable
                    discretion.
                  </p>

                  <h3 className="tn-legal-clause__subheading">6.2 Paid Subscriptions</h3>
                  <p>
                    Certain advanced features and increased generation limits require a paid subscription. Paid plans are
                    billed in advance on a recurring monthly or annual basis according to the pricing presented at checkout.
                    You agree to provide accurate and current billing details.
                  </p>

                  <h3 className="tn-legal-clause__subheading">6.3 Cancellation</h3>
                  <p>
                    You may cancel your subscription at any time through your workspace settings. Upon cancellation, your
                    subscription will remain active through the conclusion of your current prepaid billing cycle.
                  </p>
                </section>

                {/* 7. Limitation of Liability */}
                <section id="sec-7" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">7. Limitation of Liability</h2>
                  <p>
                    The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis, without warranties of any kind, whether
                    express, statutory, or implied, including but not limited to the implied warranties of merchantability,
                    fitness for a particular purpose, and non-infringement.
                  </p>

                  {/* Concise, subtle AI Notice */}
                  <div className="tn-legal-notice" role="note">
                    <span className="tn-legal-notice__label">Important Notice</span>
                    <p className="tn-legal-notice__text">
                      AI-generated test cases and recommendations should be reviewed and validated by qualified users
                      before being relied upon for production testing or other critical decisions. TestNexa does not
                      guarantee absolute accuracy, completeness, or fault coverage of generated test suites.
                    </p>
                  </div>

                  <p>
                    To the maximum extent permitted by applicable law, TestNexa and its affiliates shall not be liable for
                    any indirect, incidental, consequential, special, or punitive damages, including loss of profits, data,
                    or business interruption, arising out of or in connection with your use of or inability to use the Service.
                  </p>
                </section>

                {/* 8. Termination */}
                <section id="sec-8" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">8. Termination</h2>
                  <p>
                    We may suspend or terminate your access to the Service at any time, with or without notice, if you breach
                    any provision of these Terms or engage in conduct that harms or impairs the Service, other users, or third parties.
                  </p>
                  <p>
                    You may terminate your account at any time by ceasing all use of the Service and submitting an account closure
                    request. Upon termination, provisions that by their nature should survive termination shall survive, including
                    intellectual property, disclaimers, limitations of liability, and governing law.
                  </p>
                </section>

                {/* 9. Changes to Terms */}
                <section id="sec-9" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">9. Changes to Terms</h2>
                  <p>
                    We may revise these Terms from time to time to reflect changes in our Service, legal requirements, or operational
                    practices. When updates occur, we will post the revised version on this page with an updated &quot;Last updated&quot; date.
                  </p>
                  <p>
                    Your continued access to or use of the Service following the posting of revised Terms constitutes your
                    acceptance of and agreement to the updated Terms.
                  </p>
                </section>

                {/* 10. Governing Law */}
                <section id="sec-10" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">10. Governing Law and Dispute Resolution</h2>
                  <p>
                    These Terms and any dispute arising out of or related to them shall be governed by and construed in accordance
                    with applicable laws, without giving effect to any conflict of law principles that would apply the laws of another
                    jurisdiction.
                  </p>
                  <p>
                    Prior to initiating formal legal proceedings, the parties agree to first seek in good faith to resolve any dispute
                    informally through direct negotiation and communication.
                  </p>
                </section>

                {/* 11. Contact Information */}
                <section id="sec-11" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">11. Contact Information</h2>
                  <p>
                    If you have questions regarding these Terms &amp; Conditions, please contact us:
                  </p>

                  <div className="tn-legal-contact-box">
                    <div className="tn-legal-contact-item">
                      <span className="tn-legal-contact-item__label">Email</span>
                      <a href="mailto:support@testnexa.ai" className="tn-legal-contact-item__val">
                        support@testnexa.ai
                      </a>
                    </div>
                    <div className="tn-legal-contact-item">
                      <span className="tn-legal-contact-item__label">Legal Inquiries</span>
                      <a href="mailto:legal@testnexa.ai" className="tn-legal-contact-item__val">
                        legal@testnexa.ai
                      </a>
                    </div>
                    <div className="tn-legal-contact-item">
                      <span className="tn-legal-contact-item__label">Support Portal</span>
                      <Link to="/contact" className="tn-legal-contact-item__val">
                        Support Contact Center
                      </Link>
                    </div>
                    <div className="tn-legal-contact-item">
                      <span className="tn-legal-contact-item__label">Address</span>
                      <span className="tn-legal-contact-item__placeholder">
                        [Company Legal Address — To be specified upon production filing]
                      </span>
                    </div>
                  </div>
                </section>

                {/* Simple Final Acknowledgement (Section 14) */}
                <div className="tn-legal-acknowledgement">
                  <h3 className="tn-legal-acknowledgement__heading">Acknowledgement</h3>
                  <p className="tn-legal-acknowledgement__text">
                    By accessing or using TestNexa, you acknowledge that you have read and agree to these Terms &amp; Conditions.
                  </p>
                </div>
              </>
            )}

            {/* ────────────────────────────────────────────────────────────
                DOCUMENT 2: PRIVACY POLICY
               ──────────────────────────────────────────────────────────── */}
            {activeDocId === 'privacy' && (
              <>
                <section id="priv-1" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">1. Information We Collect</h2>
                  <p>
                    TestNexa collects information necessary to authenticate users, facilitate workspace collaboration, and
                    generate prioritized test suites:
                  </p>
                  <ul className="tn-legal-list">
                    <li><strong>Account Information:</strong> Name, professional email address, and authentication credentials.</li>
                    <li><strong>Customer Input:</strong> Software requirements, test parameters, and user stories provided for synthesis.</li>
                    <li><strong>Operational Telemetry:</strong> Log records, latency metrics, error events, and feature interaction data.</li>
                    <li><strong>Technical Details:</strong> Browser type, operating system version, and IP addresses for security auditing.</li>
                  </ul>
                </section>

                <section id="priv-2" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">2. How We Use Your Data</h2>
                  <p>
                    Data collected is utilized strictly to provide, maintain, and optimize the Service, authenticate sessions,
                    prevent platform abuse, and deliver technical support. We do not sell personal data or customer requirements.
                  </p>
                </section>

                <section id="priv-3" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">3. AI Processing &amp; Data Isolation</h2>
                  <p>
                    Your requirement inputs are processed in sandboxed sessions. TestNexa does not utilize your confidential
                    software requirements or internal source specifications to train public foundational generative models.
                  </p>
                </section>

                <section id="priv-4" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">4. Data Security</h2>
                  <p>
                    We maintain technical, administrative, and physical controls to protect customer data. Communication with
                    the platform is encrypted in transit using industry-standard TLS protocols, and stored records are protected
                    with encryption at rest.
                  </p>
                </section>

                <section id="priv-5" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">5. Subprocessors &amp; Infrastructure</h2>
                  <p>
                    We engage vetted third-party infrastructure and hosting providers to deliver reliable cloud computing services.
                    All providers are subject to strict confidentiality and security commitments.
                  </p>
                </section>

                <section id="priv-6" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">6. Your Rights &amp; Data Portability</h2>
                  <p>
                    Depending on your location, you may have rights under applicable privacy legislation to access, update,
                    export, or request deletion of your personal data. These requests may be initiated through your account
                    settings or by contacting our team.
                  </p>
                </section>

                <section id="priv-7" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">7. Privacy Contact</h2>
                  <p>
                    For inquiries or requests regarding our privacy practices, please contact us at{' '}
                    <a href="mailto:privacy@testnexa.ai" className="tn-legal-inline-link">
                      privacy@testnexa.ai
                    </a>
                    .
                  </p>
                </section>
              </>
            )}

            {/* ────────────────────────────────────────────────────────────
                DOCUMENT 3: COOKIE POLICY
               ──────────────────────────────────────────────────────────── */}
            {activeDocId === 'cookies' && (
              <>
                <section id="cook-1" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">1. What Are Cookies?</h2>
                  <p>
                    Cookies are small text files stored on your computer or device when accessing web applications. We also
                    use browser local storage mechanisms to persist session authentication and theme preferences.
                  </p>
                </section>

                <section id="cook-2" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">2. Categories of Cookies Used</h2>
                  <ul className="tn-legal-list">
                    <li><strong>Essential Cookies:</strong> Required for secure user login, session validation, and CSRF protection.</li>
                    <li><strong>Functional Storage:</strong> Remembers your workspace preferences, theme mode, and view selections.</li>
                    <li><strong>Performance Telemetry:</strong> Anonymized metrics to diagnose latency and ensure platform stability.</li>
                  </ul>
                </section>

                <section id="cook-3" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">3. Managing Cookie Preferences</h2>
                  <p>
                    Most web browsers allow you to manage or delete cookies via your browser settings. Note that disabling essential
                    authentication cookies will prevent you from logging into your workspace.
                  </p>
                </section>

                <section id="cook-4" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">4. Updates to this Policy</h2>
                  <p>
                    We may update our Cookie Policy periodically. Significant changes will be reflected with an updated timestamp
                    at the top of this document.
                  </p>
                </section>
              </>
            )}

            {/* ────────────────────────────────────────────────────────────
                DOCUMENT 4: API TERMS
               ──────────────────────────────────────────────────────────── */}
            {activeDocId === 'api-terms' && (
              <>
                <section id="api-1" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">1. API Access &amp; Credentials</h2>
                  <p>
                    Programmatic access to TestNexa endpoints requires valid authentication tokens. You are solely responsible
                    for maintaining the security of your API keys and must not expose them in public repositories or insecure clients.
                  </p>
                </section>

                <section id="api-2" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">2. Rate Limits &amp; Quota Policies</h2>
                  <p>
                    API requests are governed by per-minute and monthly volume quotas commensurate with your tier. Calls exceeding
                    designated limits will receive HTTP 429 rate limit responses.
                  </p>
                </section>

                <section id="api-3" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">3. Acceptable API Usage</h2>
                  <p>
                    You agree not to use the API to execute denial-of-service tests against our endpoints, bypass platform
                    protections, or scrape data for unauthorized commercial replication.
                  </p>
                </section>

                <section id="api-4" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">4. Service Levels &amp; Deprecation</h2>
                  <p>
                    We strive to maintain high availability for API endpoints. In the event of breaking API changes or endpoint
                    deprecation, we endeavor to provide advance notification via technical documentation and developer advisories.
                  </p>
                </section>

                <section id="api-5" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">5. Indemnification</h2>
                  <p>
                    You agree to defend and hold harmless TestNexa from any claims or liabilities resulting from third-party systems
                    or automated CI/CD deployments connected through your API credentials.
                  </p>
                </section>
              </>
            )}

            {/* ────────────────────────────────────────────────────────────
                DOCUMENT 5: ACCEPTABLE USE POLICY
               ──────────────────────────────────────────────────────────── */}
            {activeDocId === 'acceptable-use' && (
              <>
                <section id="aup-1" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">1. Scope &amp; Purpose</h2>
                  <p>
                    This Acceptable Use Policy outlines the behavioral standards and infrastructure boundaries required when
                    interacting with TestNexa services. It applies to all users, accounts, and automated API callers.
                  </p>
                </section>

                <section id="aup-2" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">2. Prohibited Activities</h2>
                  <ul className="tn-legal-list">
                    <li>Attempting unauthorized access to system accounts, databases, or multi-tenant infrastructure.</li>
                    <li>Submitting requirements containing malicious payloads, exploits, or unlawful content.</li>
                    <li>Automated scraping or bulk query extraction without prior written approval.</li>
                    <li>Interfering with network performance or attempting denial-of-service disruptions.</li>
                  </ul>
                </section>

                <section id="aup-3" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">3. System Security &amp; Testing Boundaries</h2>
                  <p>
                    Penetration testing and security research against TestNexa production hosts must be coordinated with our security
                    team in advance. Unauthorized probing or scanning is strictly prohibited.
                  </p>
                </section>

                <section id="aup-4" className="tn-legal-clause">
                  <h2 className="tn-legal-clause__heading">4. Enforcement &amp; Reporting</h2>
                  <p>
                    Violations of this policy may result in immediate suspension or termination of account access. Suspected
                    security violations or platform abuse should be reported to{' '}
                    <a href="mailto:security@testnexa.ai" className="tn-legal-inline-link">
                      security@testnexa.ai
                    </a>
                    .
                  </p>
                </section>
              </>
            )}
          </article>

          {/* ════ RIGHT COLUMN: On This Page (TOC) ════ */}
          <aside className="tn-legal-toc" aria-label="On this page table of contents">
            <div className="tn-legal-toc__header">On this page</div>
            <nav className="tn-legal-toc__nav">
              <ul className="tn-legal-toc__list">
                {activeSections.map((section) => {
                  const isActive = activeSectionId === section.id;
                  return (
                    <li key={section.id} className="tn-legal-toc__item">
                      <a
                        href={`#${section.id}`}
                        onClick={(e) => handleSmoothScroll(e, section.id)}
                        className={`tn-legal-toc__link ${isActive ? 'is-active' : ''}`}
                        aria-current={isActive ? 'location' : undefined}
                      >
                        <span className="tn-legal-toc__num">{section.num}.</span>
                        <span className="tn-legal-toc__text">{section.title}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <button
              type="button"
              className="tn-legal-toc__top-btn"
              onClick={scrollToTop}
              title="Return to top of page"
            >
              <ArrowUp size={12} aria-hidden="true" />
              <span>Back to top</span>
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default TermsPage;
