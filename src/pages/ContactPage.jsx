import React from 'react';
import { Mail, MessageSquare, MapPin, Send, HelpCircle } from 'lucide-react';

const ContactPage = () => {
    return (
        <div className="help-page" style={{ paddingTop: '100px', minHeight: '100vh' }}>
            <div className="container">
                <div className="terms-header text-center mb-12">
                    <div className="terms-icon-wrapper mx-auto mb-6">
                        <MessageSquare size={48} className="text-primary" />
                    </div>
                    <h1 className="terms-title text-4xl font-bold mb-4">Contact Us</h1>
                    <p className="terms-subtitle text-gray-400 max-w-2xl mx-auto">
                        Have questions, feedback, or need enterprise support? Our team is ready to help.
                    </p>
                </div>

                <div className="contact-grid">
                    <div className="glass-card contact-form-section">
                        <h2 className="contact-form-title">Send us a Message</h2>
                        <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">First Name</label>
                                    <input type="text" className="form-input" placeholder="John" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Last Name</label>
                                    <input type="text" className="form-input" placeholder="Doe" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input type="email" className="form-input" placeholder="john@example.com" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Message</label>
                                <textarea className="form-input" placeholder="How can we help you?"></textarea>
                            </div>
                            <button className="btn-primary btn-contact-submit">
                                Send Message <Send size={18} />
                            </button>
                        </form>
                    </div>

                    <div className="contact-info-section">
                        <div className="glass-card contact-info-card">
                            <div className="info-icon-wrapper email">
                                <Mail size={24} />
                            </div>
                            <div className="info-content">
                                <h3>Email Support</h3>
                                <p>Our support team aims to reply within 24 hours.</p>
                                <a href="mailto:support@testnexa.ai" className="info-link">support@testnexa.ai</a>
                            </div>
                        </div>

                        <div className="glass-card contact-info-card">
                            <div className="info-icon-wrapper sales">
                                <HelpCircle size={24} />
                            </div>
                            <div className="info-content">
                                <h3>Sales & Enterprise</h3>
                                <p>Looking for custom models and enterprise SSO?</p>
                                <a href="mailto:sales@testnexa.ai" className="info-link">sales@testnexa.ai</a>
                            </div>
                        </div>

                        <div className="glass-card contact-info-card">
                            <div className="info-icon-wrapper location">
                                <MapPin size={24} />
                            </div>
                            <div className="info-content">
                                <h3>Office Location</h3>
                                <p>
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
