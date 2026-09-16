import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ForgotPasswordPage = () => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Email address is required');
      return;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid work email address');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await forgotPassword(email.trim());
      // Even on error, if it's anti-enumeration or success, show success state
      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.message || 'Unable to process password reset. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="tn-auth-card">
      {!isSuccess ? (
        <>
          <h1 className="tn-auth-title">Reset your password</h1>
          <p className="tn-auth-subtitle">
            Enter your work email address and we'll send you a password reset link.
          </p>

          {error && (
            <div className="tn-auth-error-banner" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="tn-auth-form" noValidate>
            <div className="tn-auth-field">
              <label htmlFor="forgot-email" className="tn-auth-label">
                Work email
              </label>
              <div className="tn-auth-input-wrapper">
                <input
                  type="email"
                  id="forgot-email"
                  name="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  className={`tn-auth-input ${error ? 'is-error' : ''}`}
                  placeholder="name@company.com"
                  autoComplete="email"
                  autoFocus
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="tn-auth-btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Sending reset link...</span>
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          <div className="tn-auth-prompt">
            <Link to="/login" className="tn-auth-back-link" style={{ justifyContent: 'center' }}>
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(0, 217, 192, 0.1)',
              border: '1px solid rgba(0, 217, 192, 0.25)',
              display: 'grid',
              placeItems: 'center',
              color: '#00D9C0'
            }}>
              <MailCheck size={20} />
            </div>
            <h1 className="tn-auth-title" style={{ margin: 0 }}>Check your inbox</h1>
          </div>

          <p className="tn-auth-subtitle" style={{ marginBottom: '20px' }}>
            If an account exists for <strong style={{ color: '#F5F5F5' }}>{email}</strong>, we've sent instructions to reset your password.
          </p>

          <div className="tn-auth-success-banner" style={{ marginBottom: '24px' }}>
            Please check your inbox and spam folder. The password reset link will expire in 1 hour.
          </div>

          <Link
            to="/login"
            className="tn-auth-btn-primary"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            Return to sign in
          </Link>
        </>
      )}
    </div>
  );
};

export default ForgotPasswordPage;
