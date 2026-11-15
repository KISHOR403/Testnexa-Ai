import React, { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, MailCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/authValidation';

/**
 * Reusable Production ForgotPasswordPage for Testnexa AI
 * Strict Black-and-White theme with high-contrast, WCAG AA compliance.
 */
const ForgotPasswordPage = () => {
  const location = useLocation();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const emailInputRef = useRef(null);
  const serverAlertRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldError(emailErr);
      emailInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setFieldError('');
    setServerError('');

    try {
      const result = await forgotPassword(email.trim());
      // Anti-enumeration: treat both success and standard response as success screen
      if (result && result.success !== false) {
        setIsSuccess(true);
      } else {
        setServerError(result?.message || 'Unable to process password reset. Please try again.');
        setTimeout(() => serverAlertRef.current?.focus(), 60);
      }
    } catch (err) {
      setServerError("Can't reach Testnexa. Check your connection and retry");
      setTimeout(() => serverAlertRef.current?.focus(), 60);
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
            Enter your work email address and we&apos;ll send you a password reset link.
          </p>

          {serverError && (
            <div
              ref={serverAlertRef}
              className="tn-auth-server-alert"
              style={{ marginBottom: '16px' }}
              role="alert"
              tabIndex={-1}
            >
              <div className="tn-auth-alert-content">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{serverError}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="tn-auth-form" noValidate>
            <div className="tn-auth-field">
              <label htmlFor="forgot-email" className="tn-auth-label">
                Work email
              </label>
              <div className="tn-auth-input-wrapper">
                <input
                  ref={emailInputRef}
                  type="email"
                  id="forgot-email"
                  name="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError) setFieldError('');
                    if (serverError) setServerError('');
                  }}
                  onBlur={() => {
                    const err = validateEmail(email);
                    if (err) setFieldError(err);
                  }}
                  className={`tn-auth-input ${fieldError ? 'is-error' : ''}`}
                  placeholder="name@company.com"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  autoFocus
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? 'forgot-email-error' : undefined}
                  required
                />
              </div>
              {fieldError && (
                <span
                  id="forgot-email-error"
                  className="tn-auth-field-error"
                  role="alert"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{fieldError}</span>
                </span>
              )}
            </div>

            <button
              type="submit"
              className="tn-auth-btn-primary"
              disabled={!email.trim() || isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className="tn-auth-btn-loading">
                  <span className="tn-auth-spinner" aria-hidden="true" />
                  <span>Sending reset link…</span>
                </span>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          <div className="tn-auth-prompt">
            <Link
              to={`/login${location.search}`}
              className="tn-auth-back-link"
              style={{ justifyContent: 'center', width: 'fit-content', margin: '0 auto' }}
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Back to sign in</span>
            </Link>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div className="tn-auth-icon-badge">
              <MailCheck size={20} stroke="#ffffff" />
            </div>
            <h1 className="tn-auth-title" style={{ margin: 0 }}>Check your inbox</h1>
          </div>

          <p className="tn-auth-subtitle" style={{ marginBottom: '20px' }}>
            If an account exists for <strong style={{ color: '#ffffff' }}>{email}</strong>, we&apos;ve sent instructions to reset your password.
          </p>

          <div className="tn-auth-success-banner" style={{ marginBottom: '24px' }}>
            Please check your inbox and spam folder. The password reset link will expire in 1 hour.
          </div>

          <Link
            to={`/login${location.search}`}
            className="tn-auth-btn-primary"
            style={{ textDecoration: 'none', textAlign: 'center', display: 'flex' }}
          >
            Return to sign in
          </Link>
        </>
      )}
    </div>
  );
};

export default ForgotPasswordPage;
