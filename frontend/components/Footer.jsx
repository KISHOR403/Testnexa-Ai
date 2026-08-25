import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Github, Linkedin, Mail } from 'lucide-react';
import useScrollReveal from '../hooks/useScrollReveal';

const Footer = () => {
    const footerReveal = useScrollReveal({ threshold: 0.1 });

    return (
        <footer className="tn-footer" role="contentinfo">
            <div className="tn-footer__border" aria-hidden="true" />
            <div
                ref={footerReveal.ref}
                className={`container tn-footer__inner scroll-reveal-fade-up ${footerReveal.isVisible ? 'revealed' : ''}`}
            >
                {/* Brand column */}
                <div className="tn-footer__brand">
                    <Link to="/" className="tn-footer__logo">
                        <div className="tn-footer__logo-icon">
                            <img src="/testnexa-logo.png" alt="" width="24" height="24" style={{ borderRadius: '6px', objectFit: 'cover' }} />
                        </div>
                        <span className="tn-footer__logo-text">Testnexa AI</span>
                    </Link>
                    <p className="tn-footer__desc">
                        Transform requirements into comprehensive, prioritized test suites using advanced AI intelligence.
                    </p>
                    <div className="tn-footer__socials">
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                            <Twitter size={16} />
                        </a>
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                            <Github size={16} />
                        </a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                            <Linkedin size={16} />
                        </a>
                        <a href="mailto:contact@testnexa.ai" aria-label="Email">
                            <Mail size={16} />
                        </a>
                    </div>
                </div>

                {/* Link columns */}
                <div className="tn-footer__links">
                    <div className="tn-footer__col">
                        <h4>Product</h4>
                        <ul>
                            <li><Link to="/">Generator</Link></li>
                            <li><Link to="/history">History</Link></li>
                            <li><Link to="/#features">Features</Link></li>
                        </ul>
                    </div>

                    <div className="tn-footer__col">
                        <h4>Resources</h4>
                        <ul>
                            <li><Link to="/help">Documentation</Link></li>
                            <li><Link to="/api-reference">API Reference</Link></li>
                            <li><Link to="/best-practices">Quick Start</Link></li>
                        </ul>
                    </div>

                    <div className="tn-footer__col">
                        <h4>Company</h4>
                        <ul>
                            <li><Link to="/about">About</Link></li>
                            <li><Link to="/contact">Contact</Link></li>
                            <li><Link to="/privacy">Privacy</Link></li>
                            <li><Link to="/terms">Terms</Link></li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="tn-footer__bottom">
                <div className="container tn-footer__bottom-inner">
                    <p>&copy; {new Date().getFullYear()} Testnexa AI. All rights reserved.</p>
                    <div className="tn-footer__status">
                        <span className="tn-footer__status-dot" />
                        <span>All systems operational</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
