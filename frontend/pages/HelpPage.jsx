import React from 'react';
import { BookOpen, FileText, XCircle, AlertTriangle } from 'lucide-react';

const HelpPage = () => (
    <div className="help-page doc-page-container">
        <div className="container">
            <div className="doc-header">
                <div className="terms-icon-wrapper doc-icon-wrapper">
                    <BookOpen size={48} className="icon-primary" />
                </div>
                <h1 className="terms-title doc-title">Help & Documentation</h1>
                <p className="terms-subtitle doc-subtitle">
                    Learn the core concepts of software testing and how TestNexa AI accelerates the process.
                </p>
            </div>

            <div className="doc-grid">
                <div className="glass-card doc-card">
                    <div className="doc-card-header">
                        <FileText className="icon-primary" size={24} />
                        <h3 className="doc-card-title">What is a Requirement?</h3>
                    </div>
                    <p className="doc-card-text">
                        A requirement is a description of what an application should do. It defines the features, functionality, and behavior of the system.
                    </p>
                    <div className="doc-example-box">
                        <span className="doc-example-label">Example:</span>
                        "User can login using email and password."
                    </div>
                </div>

                <div className="glass-card doc-card">
                    <div className="doc-card-header">
                        <BookOpen className="icon-secondary" size={24} />
                        <h3 className="doc-card-title">What is a Test Case?</h3>
                    </div>
                    <p className="doc-card-text">
                        A test case is a set of conditions or variables under which a tester will determine whether a system under test satisfies requirements or functions correctly.
                    </p>
                    <div className="doc-example-box">
                        <span className="doc-example-label">Example:</span>
                        "Verify that user is redirected to dashboard after valid login."
                    </div>
                </div>

                <div className="glass-card doc-card">
                    <div className="doc-card-header">
                        <XCircle className="icon-purple" size={24} />
                        <h3 className="doc-card-title">Negative Case?</h3>
                    </div>
                    <p className="doc-card-text">
                        Negative testing is performed to check the system against invalid input data or behavior. It ensures your app handles errors gracefully.
                    </p>
                    <div className="doc-example-box">
                        <span className="doc-example-label">Example:</span>
                        "Try logging in with a password that is too short."
                    </div>
                </div>

                <div className="glass-card doc-card">
                    <div className="doc-card-header">
                        <AlertTriangle className="icon-amber" size={24} />
                        <h3 className="doc-card-title">Edge Case?</h3>
                    </div>
                    <p className="doc-card-text">
                        An edge case is a problem or situation that occurs only at an extreme (maximum or minimum) operating parameter.
                    </p>
                    <div className="doc-example-box">
                        <span className="doc-example-label">Example:</span>
                        "Check system behavior when 10,000 users try to login at the exact same second."
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default HelpPage;
