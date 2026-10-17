import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Github, Linkedin, Mail } from 'lucide-react';
import TestNexaLogo from './TestNexaLogo';

export const Footer = () => {
    return (
        <footer className="tn-footer" role="contentinfo">
            <div className="tn-container tn-footer__inner">
                {/* Brand column */}
                <div className="tn-footer__brand">
                    <Link to="/" className="tn-footer__logo">
                        <TestNexaLogo size={24} />
                        <span className="tn-footer__logo-text">TestNexa</span>
                    </Link>
                    <p className="tn-footer__desc">
                        Requirement analysis and structured test suite generation for QA teams.
                    </p>
                    <div className="tn-footer__status-row">
                        <span className="tn-footer__status-dot" aria-hidden="true" />
                        <span>All systems operational</span>
                    </div>
                </div>

                {/* Link columns */}
                <div className="tn-footer__links-grid">
                    <div className="tn-footer__col">
                        <h4>Product</h4>
                        <ul>
                            <li><Link to="/">Overview</Link></li>
                            <li><a href="/#workflow">Workflow</a></li>
                            <li><a href="/#features">Features</a></li>
                            <li><Link to="/app/test-suites">Test Suites</Link></li>
                            <li><Link to="/app/history">History</Link></li>
                        </ul>
                    </div>

                    <div className="tn-footer__col">
                        <h4>Resources</h4>
                        <ul>
                            <li><Link to="/help">Documentation</Link></li>
                            <li><Link to="/api-reference">API Reference</Link></li>
                            <li><Link to="/best-practices">Quick Start</Link></li>
                            <li><Link to="/help">Help Center</Link></li>
                        </ul>
                    </div>

                    <div className="tn-footer__col">
                        <h4>Company</h4>
                        <ul>
                            <li><Link to="/about">About</Link></li>
                            <li><Link to="/contact">Contact</Link></li>
                        </ul>
                    </div>

                    <div className="tn-footer__col">
                        <h4>Legal</h4>
                        <ul>
                            <li><Link to="/privacy">Privacy Policy</Link></li>
                            <li><Link to="/terms">Terms of Service</Link></li>
                            <li><Link to="/acceptable-use">Security Policy</Link></li>
                            <li><Link to="/cookie-policy">Cookie Policy</Link></li>
                            <li>
                                <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('testnexa:open-cookie-preferences'))}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: 0,
                                        color: 'inherit',
                                        font: 'inherit',
                                        fontSize: '0.88rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    Cookie Preferences
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="tn-footer__bottom">
                <div className="tn-container tn-footer__bottom-inner">
                    <p>&copy; {new Date().getFullYear()} TestNexa AI. All rights reserved.</p>
                    <div className="tn-footer__socials">
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                            <Github size={15} />
                        </a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                            <Linkedin size={15} />
                        </a>
                        <a href="mailto:contact@testnexa.ai" aria-label="Contact Email">
                            <Mail size={15} />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
