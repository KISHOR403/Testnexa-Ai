import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Mail, MapPin, Send, HelpCircle, CheckCircle,
    AlertCircle, Loader2, ArrowRight, ChevronRight,
    ShieldCheck, RefreshCw
} from 'lucide-react';
import axios from 'axios';
import '../styles/ContactPage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const INITIAL_FORM = {
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    message: '',
    // Honeypot field: invisible to human users, filled by bots
    website: ''
};

const ContactPage = () => {
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState({
        loading: false,
        success: false,
        referenceId: null,
        error: null
    });

    const validate = () => {
        const errs = {};
        const cleanFirst = formData.firstName.trim();
        const cleanLast = formData.lastName.trim();
        const cleanEmail = formData.email.trim();
        const cleanCompany = formData.company.trim();
        const cleanMessage = formData.message.trim();

        if (!cleanFirst) {
            errs.firstName = 'First name is required.';
        } else if (cleanFirst.length < 2) {
            errs.firstName = 'First name must be at least 2 characters.';
        } else if (cleanFirst.length > 50) {
            errs.firstName = 'First name cannot exceed 50 characters.';
        }

        if (cleanLast.length > 50) {
            errs.lastName = 'Last name cannot exceed 50 characters.';
        }

        if (!cleanEmail) {
            errs.email = 'Work email address is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            errs.email = 'Please provide a valid email address (e.g. name@company.com).';
        } else if (cleanEmail.length > 255) {
            errs.email = 'Email address cannot exceed 255 characters.';
        }

        if (cleanCompany.length > 100) {
            errs.company = 'Company name cannot exceed 100 characters.';
        }

        if (!cleanMessage) {
            errs.message = 'Please describe your inquiry or requirement.';
        } else if (cleanMessage.length < 10) {
            errs.message = 'Message must be at least 10 characters long.';
        } else if (cleanMessage.length > 2000) {
            errs.message = 'Message cannot exceed 2000 characters.';
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (errors[name]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }

        if (status.error) {
            setStatus(prev => ({ ...prev, error: null }));
        }
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        // Prevent duplicate submissions while in flight
        if (status.loading) {
            return;
        }

        if (!validate()) {
            return;
        }

        setStatus({ loading: true, success: false, referenceId: null, error: null });

        try {
            const response = await axios.post(`${API_BASE_URL}/contact`, {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim(),
                company: formData.company.trim(),
                message: formData.message.trim(),
                website: formData.website
            });

            if (response.data?.success) {
                setStatus({
                    loading: false,
                    success: true,
                    referenceId: response.data.referenceId || null,
                    error: null
                });
                // Reset form on verified success
                setFormData(INITIAL_FORM);
                setErrors({});
            } else {
                setStatus({
                    loading: false,
                    success: false,
                    referenceId: null,
                    error: response.data?.message || 'Unable to record your message. Please try again or email support@testnexa.ai directly.'
                });
            }
        } catch (err) {
            const errorMsg =
                err.response?.data?.message ||
                'A network error occurred while sending your message. Please check your connection and retry, or email support@testnexa.ai directly.';

            // Keep user entries intact when submission fails
            setStatus({
                loading: false,
                success: false,
                referenceId: null,
                error: errorMsg
            });
        }
    };

    const handleResetForm = () => {
        setStatus({ loading: false, success: false, referenceId: null, error: null });
        setFormData(INITIAL_FORM);
        setErrors({});
    };

    return (
        <div className="contact-page-root">
            <div className="contact-container">
                {/* ─── Breadcrumb Navigation ─── */}
                <nav className="contact-breadcrumbs" aria-label="Breadcrumbs">
                    <Link to="/" className="contact-breadcrumb-link">Home</Link>
                    <ChevronRight size={14} aria-hidden="true" />
                    <span className="contact-breadcrumb-current" aria-current="page">Contact us</span>
                </nav>

                {/* ─── Hero Header (Calm, Professional, No Neon Glow) ─── */}
                <header className="contact-hero">
                    <div className="contact-hero__badge">
                        <Mail size={13} aria-hidden="true" />
                        <span>Get in Touch</span>
                    </div>
                    <h1 className="contact-hero__title">Contact us</h1>
                    <p className="contact-hero__desc">
                        Have questions, product feedback, or enterprise requirements? Our engineering and support team is ready to help your QA workflow.
                    </p>
                </header>

                {/* ─── Main Two-Column Layout ─── */}
                <div className="contact-grid-layout">
                    {/* Left Column: Form / Success State */}
                    <div className="contact-card">
                        <div className="contact-card__header">
                            <h2 className="contact-card__title">Send us a message</h2>
                            <p className="contact-card__subtitle">
                                Provide your requirements below and we will respond to your team promptly.
                            </p>
                        </div>

                        {status.success ? (
                            <div className="contact-success-box" role="status" aria-live="polite">
                                <div className="contact-success-icon-wrap" aria-hidden="true">
                                    <CheckCircle size={26} />
                                </div>
                                <h3 className="contact-success-title">Message Received</h3>
                                {status.referenceId && (
                                    <div className="contact-success-ref">
                                        <span>Reference:</span>
                                        <strong>{status.referenceId}</strong>
                                    </div>
                                )}
                                <p className="contact-success-desc">
                                    Thank you for reaching out to TestNexa. Our engineering and support team has received your message and will review it within 1 business day.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleResetForm}
                                    className="contact-reset-btn"
                                >
                                    <RefreshCw size={14} aria-hidden="true" />
                                    <span>Send another message</span>
                                </button>
                            </div>
                        ) : (
                            <form className="contact-form" onSubmit={handleSubmit} noValidate>
                                {/* ─── Submission Error Banner with Retry ─── */}
                                {status.error && (
                                    <div className="contact-error-banner" role="alert" aria-live="assertive">
                                        <div className="contact-error-banner__content">
                                            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                                            <span>{status.error}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSubmit}
                                            className="contact-error-banner__retry"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                )}

                                {/* ─── Honeypot Anti-Spam Field ─── */}
                                <div className="contact-honeypot" aria-hidden="true">
                                    <label htmlFor="contact-hp-website">Leave this field empty</label>
                                    <input
                                        type="text"
                                        id="contact-hp-website"
                                        name="website"
                                        value={formData.website}
                                        onChange={handleChange}
                                        tabIndex={-1}
                                        autoComplete="off"
                                    />
                                </div>

                                {/* ─── First & Last Name ─── */}
                                <div className="contact-form-row">
                                    <div className="contact-form-group">
                                        <label className="contact-label" htmlFor="contact-first-name">
                                            <span className="contact-label-text">
                                                First name
                                                <span className="contact-required" aria-hidden="true">*</span>
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            id="contact-first-name"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            className={`contact-input ${errors.firstName ? 'has-error' : ''}`}
                                            placeholder="Jane"
                                            maxLength={50}
                                            disabled={status.loading}
                                            aria-required="true"
                                            aria-invalid={errors.firstName ? 'true' : 'false'}
                                            aria-describedby={errors.firstName ? 'first-name-error' : undefined}
                                            autoComplete="given-name"
                                        />
                                        {errors.firstName && (
                                            <span id="first-name-error" className="contact-error-msg" role="alert">
                                                <AlertCircle size={13} aria-hidden="true" />
                                                {errors.firstName}
                                            </span>
                                        )}
                                    </div>

                                    <div className="contact-form-group">
                                        <label className="contact-label" htmlFor="contact-last-name">
                                            <span className="contact-label-text">
                                                Last name
                                                <span className="contact-optional">(optional)</span>
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            id="contact-last-name"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            className={`contact-input ${errors.lastName ? 'has-error' : ''}`}
                                            placeholder="Smith"
                                            maxLength={50}
                                            disabled={status.loading}
                                            aria-invalid={errors.lastName ? 'true' : 'false'}
                                            aria-describedby={errors.lastName ? 'last-name-error' : undefined}
                                            autoComplete="family-name"
                                        />
                                        {errors.lastName && (
                                            <span id="last-name-error" className="contact-error-msg" role="alert">
                                                <AlertCircle size={13} aria-hidden="true" />
                                                {errors.lastName}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* ─── Work Email & Company ─── */}
                                <div className="contact-form-row">
                                    <div className="contact-form-group">
                                        <label className="contact-label" htmlFor="contact-email">
                                            <span className="contact-label-text">
                                                Work email address
                                                <span className="contact-required" aria-hidden="true">*</span>
                                            </span>
                                        </label>
                                        <input
                                            type="email"
                                            id="contact-email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className={`contact-input ${errors.email ? 'has-error' : ''}`}
                                            placeholder="jane@company.com"
                                            maxLength={255}
                                            disabled={status.loading}
                                            aria-required="true"
                                            aria-invalid={errors.email ? 'true' : 'false'}
                                            aria-describedby={errors.email ? 'email-error' : undefined}
                                            autoComplete="email"
                                        />
                                        {errors.email && (
                                            <span id="email-error" className="contact-error-msg" role="alert">
                                                <AlertCircle size={13} aria-hidden="true" />
                                                {errors.email}
                                            </span>
                                        )}
                                    </div>

                                    <div className="contact-form-group">
                                        <label className="contact-label" htmlFor="contact-company">
                                            <span className="contact-label-text">
                                                Company / Organization
                                                <span className="contact-optional">(optional)</span>
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            id="contact-company"
                                            name="company"
                                            value={formData.company}
                                            onChange={handleChange}
                                            className={`contact-input ${errors.company ? 'has-error' : ''}`}
                                            placeholder="Acme Corp"
                                            maxLength={100}
                                            disabled={status.loading}
                                            aria-invalid={errors.company ? 'true' : 'false'}
                                            aria-describedby={errors.company ? 'company-error' : undefined}
                                            autoComplete="organization"
                                        />
                                        {errors.company && (
                                            <span id="company-error" className="contact-error-msg" role="alert">
                                                <AlertCircle size={13} aria-hidden="true" />
                                                {errors.company}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* ─── Message Area with Live Character Count ─── */}
                                <div className="contact-form-group">
                                    <div className="contact-label">
                                        <span className="contact-label-text">
                                            Message
                                            <span className="contact-required" aria-hidden="true">*</span>
                                        </span>
                                        <span
                                            className={`contact-char-count ${formData.message.length > 1950 ? 'contact-char-count--warn' : ''}`}
                                            aria-live="polite"
                                        >
                                            {formData.message.length} / 2000
                                        </span>
                                    </div>
                                    <textarea
                                        id="contact-message"
                                        name="message"
                                        value={formData.message}
                                        onChange={handleChange}
                                        className={`contact-textarea ${errors.message ? 'has-error' : ''}`}
                                        placeholder="How can TestNexa support your QA workflow, API test generation, or enterprise deployment?"
                                        rows={5}
                                        maxLength={2000}
                                        disabled={status.loading}
                                        aria-required="true"
                                        aria-invalid={errors.message ? 'true' : 'false'}
                                        aria-describedby={errors.message ? 'message-error' : undefined}
                                    />
                                    {errors.message && (
                                        <span id="message-error" className="contact-error-msg" role="alert">
                                            <AlertCircle size={13} aria-hidden="true" />
                                            {errors.message}
                                        </span>
                                    )}
                                </div>

                                {/* ─── Submit Action & Privacy Note ─── */}
                                <div className="contact-submit-row">
                                    <p className="contact-privacy-note">
                                        Your details are protected under our{' '}
                                        <Link to="/terms">Terms & Privacy Policy</Link>.
                                    </p>
                                    <button
                                        type="submit"
                                        className="contact-submit-btn"
                                        disabled={status.loading}
                                        aria-busy={status.loading}
                                    >
                                        {status.loading ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                                <span>Sending message...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Send message</span>
                                                <Send size={15} aria-hidden="true" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Right Column: Direct Channels & Verified Business Details */}
                    <aside className="contact-sidebar" aria-label="Direct Contact Channels">
                        {/* Channel 1: Email Support */}
                        <div className="contact-info-card">
                            <div className="contact-info-icon" aria-hidden="true">
                                <Mail size={18} />
                            </div>
                            <div className="contact-info-body">
                                <h3 className="contact-info-title">Email Support</h3>
                                <p className="contact-info-desc">
                                    For technical questions, suite generation help, or account issues.
                                </p>
                                <a
                                    href="mailto:support@testnexa.ai"
                                    className="contact-info-link"
                                    aria-label="Send email to support@testnexa.ai"
                                >
                                    <span>support@testnexa.ai</span>
                                    <ArrowRight size={13} aria-hidden="true" />
                                </a>
                                <div className="contact-info-meta">
                                    Typically replies within 1 business day.
                                </div>
                            </div>
                        </div>

                        {/* Channel 2: Sales & Enterprise */}
                        <div className="contact-info-card">
                            <div className="contact-info-icon" aria-hidden="true">
                                <ShieldCheck size={18} />
                            </div>
                            <div className="contact-info-body">
                                <h3 className="contact-info-title">Sales & Enterprise</h3>
                                <p className="contact-info-desc">
                                    Inquire about custom quota limits, private VPC deployment, and team licenses.
                                </p>
                                <a
                                    href="mailto:sales@testnexa.ai"
                                    className="contact-info-link"
                                    aria-label="Send email to sales@testnexa.ai"
                                >
                                    <span>sales@testnexa.ai</span>
                                    <ArrowRight size={13} aria-hidden="true" />
                                </a>
                                <div className="contact-info-meta">
                                    Dedicated onboarding and custom SLA options.
                                </div>
                            </div>
                        </div>

                        {/* Channel 3: Office Location */}
                        <div className="contact-info-card">
                            <div className="contact-info-icon" aria-hidden="true">
                                <MapPin size={18} />
                            </div>
                            <div className="contact-info-body">
                                <h3 className="contact-info-title">Office Location</h3>
                                <p className="contact-info-desc" style={{ marginBottom: '0.25rem' }}>
                                    Guwahati, Assam, India
                                </p>
                                <div className="contact-info-meta">
                                    Available Monday – Friday, 9:00 AM – 6:00 PM IST
                                </div>
                            </div>
                        </div>

                        {/* Documentation Callout */}
                        <div className="contact-help-card">
                            <div className="contact-help-card__text">
                                <strong>Need instant documentation?</strong>
                                Guides, tutorials, and test suite best practices are available in our Help Center.
                            </div>
                            <Link to="/help" className="contact-help-card__btn">
                                <span>Browse Docs</span>
                                <ArrowRight size={13} aria-hidden="true" />
                            </Link>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;
