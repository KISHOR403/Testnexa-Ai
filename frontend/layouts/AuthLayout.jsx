import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../styles/auth.css';

const AuthLayout = () => {
    return (
        <div className="tn-auth-shell">
            {/* Minimal Top Navigation */}
            <header className="tn-auth-header">
                <Link to="/" className="tn-auth-brand" aria-label="TestNexa Home">
                    <img
                        src="/testnexa-logo.png"
                        alt="TestNexa AI Logo"
                        width="28"
                        height="28"
                        className="tn-auth-brand-logo"
                    />
                    <span className="tn-auth-brand-text">TestNexa</span>
                </Link>

                <Link to="/" className="tn-auth-back-link">
                    <ArrowLeft size={14} />
                    <span>Back to website</span>
                </Link>
            </header>

            {/* Main Auth Container */}
            <main className="tn-auth-main">
                <Outlet />
            </main>

            {/* Minimal Footer */}
            <footer className="tn-auth-footer">
                <span>&copy; {new Date().getFullYear()} TestNexa AI. All rights reserved.</span>
                <div className="tn-auth-footer-links">
                    <Link to="/terms">Terms</Link>
                    <span className="tn-auth-footer-sep">&bull;</span>
                    <Link to="/privacy">Privacy</Link>
                </div>
            </footer>
        </div>
    );
};

export default AuthLayout;
