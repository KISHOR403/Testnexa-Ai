import React, { useState } from 'react';
import { Mail, MessageSquare, MapPin, Send, HelpCircle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const ContactPage = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        company: '',
        message: '',
        // Honeypot field: invisible to human users, filled by bots
        website: ''
    });

    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState({ loading: false, success: false, error: null });

    const validate = () => {
        const errs = {};
        const cleanFirst = formData.firstName.trim();
        const cleanLast = formData.lastName.trim();
        const cleanEmail = formData.email.trim();
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
        }

        if (!cleanMessage) {
            errs.message = 'Please provide a message or inquiry.';
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
            setErrors(prev => ({ ...prev, [name]: null }));
        }
        if (status.error) {
            setStatus(prev => ({ ...prev, error: null }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        setStatus({ loading: true, success: false, error: null });

        try {
            const response = await axios.post(`${API_BASE_URL}/contact`, {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim(),
                company: formData.company.trim(),
                message: formData.message.trim(),
                website: formData.website // Honeypot
            });

            if (response.data?.success) {
                setStatus({ loading: false, success: true, error: null });
                // Reset form fields
                setFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    company: '',
                    message: '',
                    website: ''
                });
            } else {
                setStatus({
                    loading: false,
                    success: false,
                    error: response.data?.message || 'Failed to send message. Please try again.'
                });
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'A network error occurred while sending your message. Please try again or email support@testnexa.ai directly.';
            setStatus({ loading: false, success: false, error: errorMsg });
        }
    };

    const handleSendAnother = () => {
        setStatus({ loading: false, success: false, error: null });
    };

    return (
        <div className="help-page" style={{ paddingTop: '100px', minHeight: '100vh', paddingBottom: '80px' }}>
            <div className="container">
                <div className="terms-header text-center mb-12">
                    <div className="terms-icon-wrapper mx-auto mb-6" aria-hidden="true">
                        <MessageSquare size={48} className="text-primary" />
                    </div>
                    <h1 className="terms-title text-4xl font-bold mb-4">Contact Us</h1>
                    <p className="terms-subtitle text-gray-400 max-w-2xl mx-auto">
                        Have questions, feedback, or need enterprise support? Our team is ready to help.
                    </p>
                </div>

                <div className="contact-grid">
                    <div className="glass-card contact-form-section" style={{ background: '#0A0A0A', border: '1px solid #1C1C1C' }}>
                        <h2 className="contact-form-title" style={{ color: '#F5F5F5' }}>Send us a Message</h2>

                        {status.success ? (
                            <div className="contact-success-box" role="status" style={{
                                padding: '28px',
                                background: 'rgba(79, 140, 255, 0.06)',
                                border: '1px solid rgba(79, 140, 255, 0.25)',
                                borderRadius: '8px',
                                textAlign: 'center',
                                marginTop: '16px'
                            }}>
                                <CheckCircle size={44} style={{ color: '#4F8CFF', margin: '0 auto 16px auto' }} />
                                <h3 style={{ color: '#F5F5F5', fontSize: '1.25rem', marginBottom: '8px' }}>Message Received</h3>
                                <p style={{ color: '#A3A3A3', lineHeight: '1.6', marginBottom: '24px' }}>
                                    Thank you for contacting TestNexa. Our team has received your message and will review it promptly.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleSendAnother}
                                    className="btn-primary"
                                    style={{
                                        background: '#F5F5F5',
                                        color: '#050505',
                                        border: 'none',
                                        padding: '10px 20px',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Send Another Message
                                </button>
                            </div>
                        ) : (
                            <form className="contact-form" onSubmit={handleSubmit} noValidate>
                                {status.error && (
                                    <div className="contact-error-banner" role="alert" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 16px',
                                        marginBottom: '20px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '6px',
                                        color: '#f87171',
                                        fontSize: '0.9rem'
                                    }}>
                                        <AlertCircle size={18} style={{ flexShrink: 0 }} />
                                        <span>{status.error}</span>
                                    </div>
                                )}

                                {/* Honeypot spam trap (hidden from real users) */}
                                <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0, overflow: 'hidden' }} aria-hidden="true">
                                    <label htmlFor="form-website-hp">Leave this empty</label>
                                    <input
                                        type="text"
                                        id="form-website-hp"
                                        name="website"
                                        value={formData.website}
                                        onChange={handleChange}
                                        tabIndex={-1}
                                        autoComplete="off"
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="contact-first-name" style={{ color: '#F5F5F5' }}>
                                            First Name <span style={{ color: '#4F8CFF' }} aria-hidden="true">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="contact-first-name"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            className={`form-input ${errors.firstName ? 'is-error' : ''}`}
                                            placeholder="Jane"
                                            maxLength={50}
                                            disabled={status.loading}
                                            aria-required="true"
                                            aria-invalid={errors.firstName ? 'true' : 'false'}
                                            aria-describedby={errors.firstName ? 'first-name-error' : undefined}
                                            style={{
                                                background: '#111111',
                                                border: errors.firstName ? '1px solid #ef4444' : '1px solid #1C1C1C',
                                                color: '#F5F5F5'
                                            }}
                                        />
                                        {errors.firstName && (
                                            <span id="first-name-error" role="alert" style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                                {errors.firstName}
                                            </span>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="contact-last-name" style={{ color: '#F5F5F5' }}>
                                            Last Name
                                        </label>
                                        <input
                                            type="text"
                                            id="contact-last-name"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            className={`form-input ${errors.lastName ? 'is-error' : ''}`}
                                            placeholder="Smith"
                                            maxLength={50}
                                            disabled={status.loading}
                                            aria-invalid={errors.lastName ? 'true' : 'false'}
                                            aria-describedby={errors.lastName ? 'last-name-error' : undefined}
                                            style={{
                                                background: '#111111',
                                                border: errors.lastName ? '1px solid #ef4444' : '1px solid #1C1C1C',
                                                color: '#F5F5F5'
                                            }}
                                        />
                                        {errors.lastName && (
                                            <span id="last-name-error" role="alert" style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                                {errors.lastName}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="contact-email" style={{ color: '#F5F5F5' }}>
                                            Work Email Address <span style={{ color: '#4F8CFF' }} aria-hidden="true">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            id="contact-email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className={`form-input ${errors.email ? 'is-error' : ''}`}
                                            placeholder="jane@company.com"
                                            maxLength={255}
                                            disabled={status.loading}
                                            aria-required="true"
                                            aria-invalid={errors.email ? 'true' : 'false'}
                                            aria-describedby={errors.email ? 'email-error' : undefined}
                                            style={{
                                                background: '#111111',
                                                border: errors.email ? '1px solid #ef4444' : '1px solid #1C1C1C',
                                                color: '#F5F5F5'
                                            }}
                                        />
                                        {errors.email && (
                                            <span id="email-error" role="alert" style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                                {errors.email}
                                            </span>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="contact-company" style={{ color: '#F5F5F5' }}>
                                            Company / Organization
                                        </label>
                                        <input
                                            type="text"
                                            id="contact-company"
                                            name="company"
                                            value={formData.company}
                                            onChange={handleChange}
                                            className="form-input"
                                            placeholder="Acme Corp"
                                            maxLength={100}
                                            disabled={status.loading}
                                            style={{
                                                background: '#111111',
                                                border: '1px solid #1C1C1C',
                                                color: '#F5F5F5'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label className="form-label" htmlFor="contact-message" style={{ color: '#F5F5F5', margin: 0 }}>
                                            Message <span style={{ color: '#4F8CFF' }} aria-hidden="true">*</span>
                                        </label>
                                        <span style={{ fontSize: '0.75rem', color: formData.message.length > 1900 ? '#f87171' : '#737373' }}>
                                            {formData.message.length} / 2000
                                        </span>
                                    </div>
                                    <textarea
                                        id="contact-message"
                                        name="message"
                                        value={formData.message}
                                        onChange={handleChange}
                                        className={`form-input ${errors.message ? 'is-error' : ''}`}
                                        placeholder="How can we help your engineering or QA team?"
                                        rows={5}
                                        maxLength={2000}
                                        disabled={status.loading}
                                        aria-required="true"
                                        aria-invalid={errors.message ? 'true' : 'false'}
                                        aria-describedby={errors.message ? 'message-error' : undefined}
                                        style={{
                                            background: '#111111',
                                            border: errors.message ? '1px solid #ef4444' : '1px solid #1C1C1C',
                                            color: '#F5F5F5',
                                            resize: 'vertical'
                                        }}
                                    />
                                    {errors.message && (
                                        <span id="message-error" role="alert" style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                            {errors.message}
                                        </span>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="btn-primary btn-contact-submit"
                                    disabled={status.loading}
                                    style={{
                                        background: '#F5F5F5',
                                        color: '#050505',
                                        border: 'none',
                                        height: '44px',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        cursor: status.loading ? 'not-allowed' : 'pointer',
                                        opacity: status.loading ? 0.7 : 1
                                    }}
                                >
                                    {status.loading ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>Sending message...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Send Message</span>
                                            <Send size={16} />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>

                    <div className="contact-info-section">
                        <div className="glass-card contact-info-card" style={{ background: '#0A0A0A', border: '1px solid #1C1C1C' }}>
                            <div className="info-icon-wrapper email" style={{ background: 'rgba(79, 140, 255, 0.1)', color: '#4F8CFF' }}>
                                <Mail size={24} />
                            </div>
                            <div className="info-content">
                                <h3 style={{ color: '#F5F5F5' }}>Email Support</h3>
                                <p style={{ color: '#A3A3A3' }}>Our support team aims to reply within 24 business hours.</p>
                                <a href="mailto:support@testnexa.ai" className="info-link" style={{ color: '#4F8CFF' }}>support@testnexa.ai</a>
                            </div>
                        </div>

                        <div className="glass-card contact-info-card" style={{ background: '#0A0A0A', border: '1px solid #1C1C1C' }}>
                            <div className="info-icon-wrapper sales" style={{ background: 'rgba(79, 140, 255, 0.1)', color: '#4F8CFF' }}>
                                <HelpCircle size={24} />
                            </div>
                            <div className="info-content">
                                <h3 style={{ color: '#F5F5F5' }}>Sales & Enterprise</h3>
                                <p style={{ color: '#A3A3A3' }}>Custom volume limits, dedicated models, and private enterprise VPC deployment.</p>
                                <a href="mailto:sales@testnexa.ai" className="info-link" style={{ color: '#4F8CFF' }}>sales@testnexa.ai</a>
                            </div>
                        </div>

                        <div className="glass-card contact-info-card" style={{ background: '#0A0A0A', border: '1px solid #1C1C1C' }}>
                            <div className="info-icon-wrapper location" style={{ background: 'rgba(79, 140, 255, 0.1)', color: '#4F8CFF' }}>
                                <MapPin size={24} />
                            </div>
                            <div className="info-content">
                                <h3 style={{ color: '#F5F5F5' }}>Office Location</h3>
                                <p style={{ color: '#A3A3A3' }}>
                                    Guwahati, Assam, India
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;
