import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ResetPasswordPage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { resetPassword } = useAuth();
    
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const validateForm = () => {
        if (!formData.password) {
            setError('Password is required');
            return false;
        } else if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return false;
        } else if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const result = await resetPassword(token, formData.password);
            if (result.success) {
                setIsSuccess(true);
                // Redirect to login page so they can log in explicitly
                setTimeout(() => navigate('/login'), 3000);
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
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (error) setError('');
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card glass-card">
                    {/* Logo and Title */}
                    <div className="login-header">
                        <div className="login-logo">
                            <img src="/testnexa-logo.png" alt="Testnexa AI" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                        </div>
                        <h1 className="login-title">Set New Password</h1>
                        <p className="login-subtitle">
                            Please enter your new password below.
                        </p>
                    </div>

                    {!isSuccess ? (
                        /* Reset Password Form */
                        <form onSubmit={handleSubmit} className="login-form">
                            {error && (
                                <div className="form-error-banner animate-fade-in">
                                    {error}
                                </div>
                            )}

                            {/* Password Field */}
                            <div className="form-group">
                                <label htmlFor="password" className="form-label">
                                    New Password
                                </label>
                                <div className="input-wrapper">
                                    <Lock size={18} className="input-icon" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={`form-input ${error && error.includes('Password') ? 'error' : ''}`}
                                        placeholder="Enter new password"
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password Field */}
                            <div className="form-group" style={{ marginTop: '0.5rem' }}>
                                <label htmlFor="confirmPassword" className="form-label">
                                    Confirm New Password
                                </label>
                                <div className="input-wrapper">
                                    <Lock size={18} className="input-icon" />
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className={`form-input ${error && error.includes('match') ? 'error' : ''}`}
                                        placeholder="Confirm new password"
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="btn-login"
                                style={{ marginTop: '1.5rem' }}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="spinner"></div>
                                        Resetting...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={20} />
                                        Reset Password
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        /* Success Message */
                        <div className="success-state animate-fade-in" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                            <div className="success-icon-wrapper" style={{ 
                                width: '64px', height: '64px', borderRadius: '50%', 
                                background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                margin: '0 auto 1.5rem'
                            }}>
                                <CheckCircle2 size={32} color="#10b981" />
                            </div>
                            <h3 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.75rem' }}>Password Reset Successful!</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                                Your password has been successfully updated. Please log in with your new password. You will be redirected to the login page shortly.
                            </p>
                            <button
                                type="button"
                                className="btn-login"
                                onClick={() => navigate('/login')}
                            >
                                Go to Login
                            </button>
                        </div>
                    )}
                </div>

                {/* Background Decorations */}
                <div className="login-bg-decoration decoration-1"></div>
                <div className="login-bg-decoration decoration-2"></div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
