import React from 'react';
import { FileText, Shield, AlertCircle, Scale, Lock, UserCheck } from 'lucide-react';

const TermsPage = () => {
    return (
        <div className="terms-page">
            <div className="container">
                <div className="terms-header">
                    <div className="terms-icon-wrapper">
                        <Scale size={48} className="terms-icon" />
                    </div>
                    <h1 className="terms-title">Terms and Conditions</h1>
                    <p className="terms-subtitle">Last Updated: January 27, 2026</p>
                </div>

                <div className="terms-content glass-card">
                    {/* Introduction */}
                    <section className="terms-section">
                        <div className="section-header">
                            <FileText size={24} className="section-icon" />
                            <h2>1. Introduction</h2>
                        </div>
                        <p>
                            Welcome to TestNexa AI. These Terms and Conditions ("Terms") govern your access to and use of the TestNexa AI platform,
                            including our website, applications, and services (collectively, the "Service"). By accessing or using our Service,
                            you agree to be bound by these Terms.
                        </p>
                        <p>
                            If you do not agree to these Terms, please do not use our Service. We reserve the right to modify these Terms at any time,
                            and such modifications will be effective immediately upon posting.
                        </p>
                    </section>

                    {/* Acceptance of Terms */}
                    <section className="terms-section">
                        <div className="section-header">
                            <UserCheck size={24} className="section-icon" />
                            <h2>2. Acceptance of Terms</h2>
                        </div>
                        <p>
                            By creating an account or using TestNexa AI, you acknowledge that you have read, understood, and agree to be bound by these Terms.
                            You also agree to comply with all applicable laws and regulations regarding your use of the Service.
                        </p>
                        <div className="terms-list">
                            <h3>You agree to:</h3>
                            <ul>
                                <li>Provide accurate and complete information during registration</li>
                                <li>Maintain the security of your account credentials</li>
                                <li>Notify us immediately of any unauthorized access to your account</li>
                                <li>Accept responsibility for all activities under your account</li>
                            </ul>
                        </div>
                    </section>

                    {/* Use of Service */}
                    <section className="terms-section">
                        <div className="section-header">
                            <Shield size={24} className="section-icon" />
                            <h2>3. Use of Service</h2>
                        </div>
                        <h3>3.1 Permitted Use</h3>
                        <p>
                            TestNexa AI provides AI-powered test case generation services. You may use our Service for generating test cases
                            for your software development projects, including functional, negative, edge case, and API testing scenarios.
                        </p>

                        <h3>3.2 Prohibited Activities</h3>
                        <p>You agree not to:</p>
                        <div className="terms-list">
                            <ul>
                                <li>Use the Service for any illegal or unauthorized purpose</li>
                                <li>Attempt to gain unauthorized access to our systems or networks</li>
                                <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                                <li>Use automated systems (bots, scrapers) without explicit permission</li>
                                <li>Upload malicious code, viruses, or harmful content</li>
                                <li>Violate any intellectual property rights</li>
                                <li>Harass, abuse, or harm other users</li>
                                <li>Resell or redistribute the Service without authorization</li>
                            </ul>
                        </div>
                    </section>

                    {/* Intellectual Property */}
                    <section className="terms-section">
                        <div className="section-header">
                            <Lock size={24} className="section-icon" />
                            <h2>4. Intellectual Property Rights</h2>
                        </div>
                        <h3>4.1 Our Rights</h3>
                        <p>
                            All content, features, and functionality of TestNexa AI, including but not limited to text, graphics, logos, icons,
                            images, audio clips, software, and the compilation thereof, are the exclusive property of TestNexa AI and are protected
                            by international copyright, trademark, and other intellectual property laws.
                        </p>

                        <h3>4.2 Your Content</h3>
                        <p>
                            You retain all rights to the requirements and specifications you input into our Service. By using TestNexa AI,
                            you grant us a limited, non-exclusive license to process your input for the purpose of generating test cases.
                        </p>

                        <h3>4.3 Generated Content</h3>
                        <p>
                            Test cases generated by our AI are provided to you under a non-exclusive license. You may use, modify, and
                            distribute the generated test cases for your projects. However, you may not claim ownership of the AI model or algorithms.
                        </p>
                    </section>

                    {/* Privacy and Data */}
                    <section className="terms-section">
                        <div className="section-header">
                            <Shield size={24} className="section-icon" />
                            <h2>5. Privacy and Data Protection</h2>
                        </div>
                        <p>
                            Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy.
                            By using TestNexa AI, you consent to our collection and use of information as described in the Privacy Policy.
                        </p>
                        <div className="terms-list">
                            <h3>Data We Collect:</h3>
                            <ul>
                                <li>Account information (name, email, password)</li>
                                <li>Usage data and analytics</li>
                                <li>Requirements and specifications you input</li>
                                <li>Generated test cases and history</li>
                                <li>Technical information (IP address, browser type, device information)</li>
                            </ul>
                        </div>
                        <p>
                            We implement industry-standard security measures to protect your data. However, no method of transmission over
                            the internet is 100% secure, and we cannot guarantee absolute security.
                        </p>
                    </section>

                    {/* Subscription and Payment */}
                    <section className="terms-section">
                        <div className="section-header">
                            <FileText size={24} className="section-icon" />
                            <h2>6. Subscription and Payment</h2>
                        </div>
                        <h3>6.1 Free Tier</h3>
                        <p>
                            TestNexa AI offers a free tier with limited features and usage quotas. We reserve the right to modify or
                            discontinue the free tier at any time.
                        </p>

                        <h3>6.2 Paid Subscriptions</h3>
                        <p>
                            Premium features require a paid subscription. Subscription fees are billed in advance on a monthly or annual basis.
                            All fees are non-refundable except as required by law.
                        </p>

                        <h3>6.3 Cancellation</h3>
                        <p>
                            You may cancel your subscription at any time. Cancellation will be effective at the end of the current billing period.
                            You will continue to have access to premium features until the end of your paid period.
                        </p>
                    </section>

                    {/* Limitation of Liability */}
                    <section className="terms-section">
                        <div className="section-header">
                            <AlertCircle size={24} className="section-icon" />
                            <h2>7. Limitation of Liability</h2>
                        </div>
                        <p>
                            TestNexa AI is provided "as is" and "as available" without warranties of any kind, either express or implied.
                            We do not guarantee that the Service will be uninterrupted, secure, or error-free.
                        </p>
                        <div className="terms-warning">
                            <AlertCircle size={20} />
                            <p>
                                <strong>Important:</strong> To the maximum extent permitted by law, TestNexa AI shall not be liable for any indirect,
                                incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or
                                business opportunities arising from your use of the Service.
                            </p>
                        </div>
                        <p>
                            AI-generated test cases should be reviewed and validated by qualified professionals before use in production environments.
                            We are not responsible for any issues arising from the use of generated test cases.
                        </p>
                    </section>

                    {/* Termination */}
                    <section className="terms-section">
                        <div className="section-header">
                            <FileText size={24} className="section-icon" />
                            <h2>8. Termination</h2>
                        </div>
                        <p>
                            We reserve the right to suspend or terminate your account and access to the Service at our sole discretion,
                            without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
                        </p>
                        <p>
                            Upon termination, your right to use the Service will immediately cease. We may delete your account data,
                            though we may retain certain information as required by law or for legitimate business purposes.
                        </p>
                    </section>

                    {/* Changes to Terms */}
                    <section className="terms-section">
                        <div className="section-header">
                            <FileText size={24} className="section-icon" />
                            <h2>9. Changes to Terms</h2>
                        </div>
                        <p>
                            We reserve the right to modify these Terms at any time. We will notify users of material changes via email or
                            through the Service. Your continued use of TestNexa AI after such modifications constitutes your acceptance of the updated Terms.
                        </p>
                    </section>

                    {/* Governing Law */}
                    <section className="terms-section">
                        <div className="section-header">
                            <Scale size={24} className="section-icon" />
                            <h2>10. Governing Law and Dispute Resolution</h2>
                        </div>
                        <p>
                            These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction],
                            without regard to its conflict of law provisions.
                        </p>
                        <p>
                            Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration,
                            except where prohibited by law. You agree to waive your right to participate in class action lawsuits.
                        </p>
                    </section>

                    {/* Contact Information */}
                    <section className="terms-section">
                        <div className="section-header">
                            <FileText size={24} className="section-icon" />
                            <h2>11. Contact Information</h2>
                        </div>
                        <p>
                            If you have any questions about these Terms, please contact us at:
                        </p>
                        <div className="contact-info">
                            <p><strong>Email:</strong> legal@testnexaai.com</p>
                            <p><strong>Address:</strong> TestNexa AI Inc., [Your Address]</p>
                            <p><strong>Support:</strong> support@testnexaai.com</p>
                        </div>
                    </section>

                    {/* Acknowledgment */}
                    <section className="terms-section terms-acknowledgment">
                        <div className="acknowledgment-box">
                            <UserCheck size={32} className="ack-icon" />
                            <h3>Acknowledgment</h3>
                            <p>
                                By using TestNexa AI, you acknowledge that you have read these Terms and Conditions,
                                understand them, and agree to be bound by them. If you do not agree to these Terms,
                                you must not use our Service.
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TermsPage;
