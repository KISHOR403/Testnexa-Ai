import React, { useState, useEffect, useRef } from 'react';
import { X, Send, AlertCircle, CheckCircle, ShieldAlert, Loader2 } from 'lucide-react';

const TOPICS = [
    { value: 'generation', label: 'Test Suite Generation' },
    { value: 'traceability_coverage', label: 'Coverage & Traceability' },
    { value: 'export', label: 'Exporting Tests (Playwright / Cypress / etc.)' },
    { value: 'integrations', label: 'CI/CD & GitHub Integrations' },
    { value: 'account', label: 'Account, Workspaces & Permissions' },
    { value: 'billing', label: 'Billing & Plan Upgrades' },
    { value: 'bug', label: 'Report a Platform Bug' },
    { value: 'other', label: 'Other General Inquiry' }
];

export const ContactSupportModal = ({ isOpen, onClose, initialTopic = 'generation' }) => {
    const [topic, setTopic] = useState(initialTopic);
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [consent, setConsent] = useState(false);
    const [honeypot, setHoneypot] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState('');
    const [successData, setSuccessData] = useState(null);

    const dialogRef = useRef(null);
    const firstInputRef = useRef(null);

    // Auto-fill logged-in user email if available in localStorage
    useEffect(() => {
        if (isOpen) {
            try {
                const storedUser = localStorage.getItem('user') || localStorage.getItem('auth_user');
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    if (parsed.email) setEmail(parsed.email);
                }
            } catch (_) {}
            setStatus('idle');
            setErrorMsg('');
            setSuccessData(null);
            setTimeout(() => firstInputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen && status !== 'submitting') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, status, onClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (honeypot) {
            // Honeypot caught spam bot
            setStatus('success');
            setSuccessData({ id: 'REF-BOT-TRAPPED', expectedResponseTime: 'a few hours' });
            return;
        }

        if (message.trim().length < 20) {
            setErrorMsg('Please describe your issue with at least 20 characters.');
            return;
        }

        if (message.trim().length > 4000) {
            setErrorMsg('Message exceeds the maximum limit of 4000 characters.');
            return;
        }

        if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
            setErrorMsg('Please provide a valid contact email address.');
            return;
        }

        if (!consent) {
            setErrorMsg('Please confirm agreement to be contacted regarding this request.');
            return;
        }

        setStatus('submitting');

        try {
            const res = await fetch('/api/v1/support/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({
                    topic,
                    message: message.trim(),
                    email: email.trim(),
                    page_url: window.location.pathname,
                    app_version: '2.4.0',
                    consent: true,
                    website: honeypot // honeypot
                })
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 429) {
                    throw new Error('Too many support requests submitted. Please try again in an hour.');
                }
                throw new Error(data.message || data.error || 'Failed to submit request.');
            }

            setStatus('success');
            setSuccessData({
                id: data.id || `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                expectedResponseTime: data.expectedResponseTime || '4 business hours'
            });
        } catch (err) {
            setStatus('error');
            setErrorMsg(err.message || "Can't reach Testnexa support. Please check your network connection.");
        }
    };

    return (
        <div className="help-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && status !== 'submitting') onClose(); }}>
            <div
                className="help-modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="contact-support-title"
                ref={dialogRef}
            >
                <div className="help-modal-header">
                    <h2 id="contact-support-title" className="help-modal-title">Contact support</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="help-modal-close"
                        aria-label="Close support dialog"
                        disabled={status === 'submitting'}
                    >
                        <X size={18} />
                    </button>
                </div>

                {status === 'success' ? (
                    <div className="help-modal-success">
                        <CheckCircle size={36} className="help-modal-icon-success" />
                        <h3 className="help-modal-success-title">Request received</h3>
                        <p className="help-modal-success-desc">
                            Your reference number is <strong>{successData?.id}</strong>.
                            Our engineering and QA support team will review your inquiry and reply to <strong>{email}</strong> within {successData?.expectedResponseTime}.
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="help-btn-primary"
                            style={{ marginTop: '20px' }}
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="help-modal-form" noValidate>
                        <div className="help-modal-banner">
                            <ShieldAlert size={16} className="help-modal-banner-icon" />
                            <span>Confidentiality: Do not include passwords, authorization keys, or live customer PII.</span>
                        </div>

                        {errorMsg && (
                            <div className="help-modal-error" role="alert">
                                <AlertCircle size={16} />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        {/* Honeypot field (hidden from genuine users) */}
                        <div style={{ display: 'none' }} aria-hidden="true">
                            <label htmlFor="hp-website">Leave blank</label>
                            <input
                                id="hp-website"
                                type="text"
                                tabIndex="-1"
                                autoComplete="off"
                                value={honeypot}
                                onChange={(e) => setHoneypot(e.target.value)}
                            />
                        </div>

                        <div className="help-form-field">
                            <label htmlFor="support-topic" className="help-form-label">
                                Topic <span className="help-required">*</span>
                            </label>
                            <select
                                id="support-topic"
                                ref={firstInputRef}
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className="help-form-select"
                                disabled={status === 'submitting'}
                            >
                                {TOPICS.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="help-form-field">
                            <label htmlFor="support-email" className="help-form-label">
                                Contact email <span className="help-required">*</span>
                            </label>
                            <input
                                id="support-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="developer@company.com"
                                className="help-form-input"
                                disabled={status === 'submitting'}
                                required
                            />
                        </div>

                        <div className="help-form-field">
                            <div className="help-form-label-row">
                                <label htmlFor="support-message" className="help-form-label">
                                    Message details <span className="help-required">*</span>
                                </label>
                                <span className={`help-form-counter ${message.length > 4000 ? 'is-overflow' : ''}`}>
                                    {message.length} / 4000
                                </span>
                            </div>
                            <textarea
                                id="support-message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Describe what you observed, what steps caused it, or what assistance you need..."
                                className="help-form-textarea"
                                rows={5}
                                disabled={status === 'submitting'}
                                required
                            />
                        </div>

                        <div className="help-form-checkbox-row">
                            <input
                                id="support-consent"
                                type="checkbox"
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                                className="help-form-checkbox"
                                disabled={status === 'submitting'}
                                required
                            />
                            <label htmlFor="support-consent" className="help-form-checkbox-label">
                                I agree to allow Testnexa support engineers to review this inquiry and contact me at the address provided.
                            </label>
                        </div>

                        <div className="help-modal-actions">
                            <button
                                type="button"
                                onClick={onClose}
                                className="help-btn-secondary"
                                disabled={status === 'submitting'}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="help-btn-primary"
                                disabled={status === 'submitting' || message.trim().length < 20 || !email}
                            >
                                {status === 'submitting' ? (
                                    <>
                                        <Loader2 size={15} className="help-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send size={15} />
                                        Submit request
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ContactSupportModal;
