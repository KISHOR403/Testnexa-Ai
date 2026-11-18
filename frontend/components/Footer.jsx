import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Github, Linkedin, Mail, Activity, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import TestNexaLogo from './TestNexaLogo';

export const Footer = () => {
    const [systemStatus, setSystemStatus] = useState({
        status: 'checking',
        text: 'Checking status...'
    });

    useEffect(() => {
        let isMounted = true;
        const abortCtrl = new AbortController();

        fetch('/api/v1/status', { signal: abortCtrl.signal })
            .then(res => {
                if (!res.ok) throw new Error('Status service response not OK');
                return res.json();
            })
            .then(data => {
                if (!isMounted) return;
                if (data.status === 'outage') {
                    setSystemStatus({ status: 'outage', text: 'Service disruption' });
                } else if (data.status === 'degraded') {
                    setSystemStatus({ status: 'degraded', text: 'Some systems degraded' });
                } else if (data.status === 'operational') {
                    setSystemStatus({ status: 'operational', text: 'All systems operational' });
                } else {
                    setSystemStatus({ status: 'unavailable', text: 'Status unavailable' });
                }
            })
            .catch(() => {
                if (!isMounted) return;
                // Never fallback to default "operational" if call fails
                setSystemStatus({ status: 'unavailable', text: 'Status unavailable' });
            });

        return () => {
            isMounted = false;
            abortCtrl.abort();
        };
    }, []);

    const renderStatusIcon = () => {
        switch (systemStatus.status) {
            case 'operational':
                return <CheckCircle size={13} className="tn-footer__status-icon" aria-hidden="true" />;
            case 'degraded':
            case 'outage':
                return <AlertCircle size={13} className="tn-footer__status-icon" aria-hidden="true" />;
            default:
                return <Activity size={13} className="tn-footer__status-icon" aria-hidden="true" />;
        }
    };

    return (
        <footer className="tn-footer" role="contentinfo">
            <div className="tn-container tn-footer__inner">
                {/* Brand column */}
                <div className="tn-footer__brand">
                    <Link to="/" className="tn-footer__logo" aria-label="Testnexa home">
                        <TestNexaLogo size={24} />
                        <span className="tn-footer__logo-text">Testnexa</span>
                    </Link>
                    <p className="tn-footer__desc">
                        Requirement analysis and structured test suite generation for QA teams.
                    </p>
                    <Link
                        to="/help"
                        className={`tn-footer__status-row tn-footer__status-row--${systemStatus.status}`}
                        title={`System status: ${systemStatus.text}`}
                        aria-label={`System status: ${systemStatus.text}. Click to view documentation.`}
                    >
                        {renderStatusIcon()}
                        <span className="tn-footer__status-text">{systemStatus.text}</span>
                    </Link>
                </div>

                {/* Link columns */}
                <div className="tn-footer__links-grid">
                    <div className="tn-footer__col">
                        <h4>Product</h4>
                        <ul>
                            <li><Link to="/">Overview</Link></li>
                            <li><a href="/#workflow">Workflow</a></li>
                            <li><a href="/#review-risk">Features</a></li>
                            <li><Link to="/app/suites">Test Suites</Link></li>
                        </ul>
                    </div>

                    <div className="tn-footer__col">
                        <h4>Resources</h4>
                        <ul>
                            <li><Link to="/help">Help Center</Link></li>
                            <li><Link to="/help/resources/glossary">QA Glossary</Link></li>
                            <li><Link to="/help/resources/whats-new">What's New</Link></li>
                            <li><Link to="/api-reference">API Reference</Link></li>
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
                            <li>
                                <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('testnexa:open-cookie-preferences'))}
                                    className="tn-footer__btn-link"
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
                    <p>&copy; {new Date().getFullYear()} Testnexa AI. All rights reserved.</p>
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
