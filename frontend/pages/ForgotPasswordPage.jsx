import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const { forgotPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email) {
            setError('Email is required');
            return;
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const result = await forgotPassword(email);
            if (result.success) {
                setIsSuccess(true);
            } else {
                setError(result.message);
            }
        } catch (error) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => {
        setEmail(e.target.value);
        if (error) {
            setError('');
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card glass-card">
                    {/* Switch to login layout */}
                    <Link to="/login" className="back-link">
                        <ArrowLeft size={16} /> Back to Login
                    </Link>

                    {/* Logo and Title */}
                    <div className="login-header" style={{ marginTop: '1.5rem' }}>
                        <div className="login-logo">
                            <img src="/testnexa-logo.png" alt="Testnexa AI" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                        </div>
                        <h1 className="login-title">Reset Password</h1>
                        <p className="login-subtitle">
                            Enter your email address and we'll send you a link to reset your password.
                        </p>
                    </div>

                    {!isSuccess ? (
                        /* Reset Form */
                        <form onSubmit={handleSubmit} className="login-form">
                            {error && (
                                <div className="form-error-banner animate-fade-in">
                                    {error}
                                </div>
                            )}

                            {/* Email Field */}
                            <div className="form-group">
                                <label htmlFor="email" className="form-label">
                                    Email Address
                                </label>
                                <div className="input-wrapper">
                                    <Mail size={18} className="input-icon" />
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={email}
                                        onChange={handleChange}
                                        className={`form-input ${error ? 'error' : ''}`}
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                    />
                                </div>
                                {error && (
                                    <span className="error-message">{error}</span>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="btn-login"
                                style={{ marginTop: '1rem' }}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="spinner"></div>
                                        Sending Link...
                                    </>
                                ) : (
                                    <>
                                        <Mail size={18} />
                                        Send Reset Link
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        /* Success Message */
                        <div className="success-state animate-fade-in" style={{ textAlign: 'center', padding: '1rem 0' }}>
                            <div className="success-icon-wrapper" style={{ 
                                width: '64px', height: '64px', borderRadius: '50%', 
                                background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                margin: '0 auto 1.5rem'
                            }}>
                                <Mail size={32} color="#10b981" />
                            </div>
                            <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '0.5rem' }}>Check your email</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                                We've sent a password reset link to <strong>{email}</strong>. 
                                Please check your inbox and spam folder.
                            </p>
                            <button
                                type="button"
                                className="btn-login"
                                onClick={() => navigate('/login')}
                            >
                                Return to Login
                            </button>
                        </div>
                    )}
                </div>

                {/* Background Decorations */}
                <div className="login-bg-decoration decoration-1"></div>
                <div className="login-bg-decoration decoration-2"></div>
            </div>
            
            <style jsx>{`
                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    font-weight: 500;
                    text-decoration: none;
                    transition: color 0.2s;
                    position: absolute;
                    top: 1.5rem;
                    left: 1.5rem;
                }
                .back-link:hover {
                    color: var(--primary);
                }
            `}</style>
        </div>
    );
};

export default ForgotPasswordPage;
