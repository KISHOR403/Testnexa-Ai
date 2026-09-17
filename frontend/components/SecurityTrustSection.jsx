import React from 'react';
import { ShieldCheck, Lock, EyeOff, Users, CheckCircle2 } from 'lucide-react';

const SECURITY_CAPABILITIES = [
    {
        icon: EyeOff,
        title: 'Stateless Model Inference',
        desc: 'Your requirements and proprietary specifications are processed strictly in ephemeral memory. TestNexa does not retain, store, or train machine learning models on your requirements.'
    },
    {
        icon: Lock,
        title: 'Session & Workspace Isolation',
        desc: 'All test suites and generation artifacts are segregated by authenticated user accounts with JWT validation and cryptographically signed session tokens.'
    },
    {
        icon: Users,
        title: 'Granular Role-Based Sharing',
        desc: 'Collaborate safely across departments with role-based access controls for shared test suites: Viewer (read-only), Reviewer (approval), and Editor (refinement).'
    },
    {
        icon: ShieldCheck,
        title: 'Built-in Security Modeling',
        desc: 'TestNexa systematically evaluates requirements for OWASP boundary conditions, token expiration TTLs, cryptographic nonce invalidation, and rate limiting.'
    }
];

export const SecurityTrustSection = () => {
    return (
        <section className="tn-section tn-security-trust-section" aria-labelledby="security-heading">
            <div className="tn-container">
                <div className="tn-section-header">
                    <span className="tn-kicker">Security & Privacy</span>
                    <h2 id="security-heading" className="tn-section-title">
                        Built for enterprise test engineering.
                    </h2>
                    <p className="tn-section-subtitle">
                        Stateless inference, workspace isolation, and role-based access for engineering teams.
                    </p>
                </div>

                <div className="tn-security-grid">
                    {SECURITY_CAPABILITIES.map((cap) => {
                        const Icon = cap.icon;
                        return (
                            <div key={cap.title} className="tn-security-card">
                                <div className="tn-sec-icon-box">
                                    <Icon size={18} />
                                </div>
                                <h3 className="tn-sec-title">{cap.title}</h3>
                                <p className="tn-sec-desc">{cap.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default SecurityTrustSection;
