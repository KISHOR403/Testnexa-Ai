import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Twitter, Github, Linkedin, Mail } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const Footer = () => {
    const footerReveal = useScrollReveal({ threshold: 0.1 });

    return (
        <footer className="footer-container">
            <div className="footer-glow-effect"></div>
            <div
                ref={footerReveal.ref}
                className={`container footer-content scroll-reveal-fade-up ${footerReveal.isVisible ? 'revealed' : ''}`}
            >
                <div className="footer-brand-column">
                    <Link to="/" className="footer-logo">
                        <div className="footer-logo-icon">
                            <img src="/testnexa-logo.png" alt="Testnexa AI" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                        </div>
                        <div className="footer-logo-text">
                            <span className="footer-brand">TestNexa AI</span>
                        </div>
                    </Link>
                    <p className="footer-description">
                        Transform requirements into comprehensive, prioritized test suites leveraging advanced LLM intelligence. Stop missing edge cases.
                    </p>
                    <div className="footer-socials">
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-icon">
                            <Twitter size={18} />
                        </a>
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="social-icon">
                            <Github size={18} />
                        </a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="social-icon">
                            <Linkedin size={18} />
                        </a>
                        <a href="mailto:contact@testnexa.ai" className="social-icon">
                            <Mail size={18} />
                        </a>
                    </div>
                </div>

                <div className="footer-links-grid">
                    <div className="footer-nav-column">
                        <h4 className="footer-col-title">Product</h4>
                        <ul className="footer-links-list">
                            <li><Link to="/" className="footer-link">Generator</Link></li>
                            <li><Link to="/history" className="footer-link">History</Link></li>
                            <li><Link to="/#features" className="footer-link">Features</Link></li>
                            <li><span className="footer-link-badge">Pro Coming Soon</span></li>
                        </ul>
                    </div>

                    <div className="footer-nav-column">
                        <h4 className="footer-col-title">Resources</h4>
                        <ul className="footer-links-list">
                            <li><Link to="/help" className="footer-link">Documentation</Link></li>
                            <li><Link to="/api-reference" className="footer-link">API Reference</Link></li>
                            <li><Link to="/best-practices" className="footer-link">Best Practices</Link></li>
                        </ul>
                    </div>

                    <div className="footer-nav-column">
                        <h4 className="footer-col-title">Company</h4>
                        <ul className="footer-links-list">
                            <li><Link to="/about" className="footer-link">About Us</Link></li>
                            <li><Link to="/contact" className="footer-link">Contact</Link></li>
                            <li><Link to="/privacy" className="footer-link">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="footer-link">Terms of Service</Link></li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="footer-bottom-bar">
                <div className="container footer-bottom-content">
                    <p className="footer-copyright">
                        &copy; {new Date().getFullYear()} TestNexa AI. All rights reserved.
                    </p>
                    <div className="footer-status">
                        <div className="status-dot"></div>
                        <span>All systems operational</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
