import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, getSafeReturnUrl } from '../utils/authValidation';

/**
 * Production LoginPage for Testnexa AI
 * Strict Black-and-White theme with high-contrast, WCAG AA compliance,
 * responsive viewports (320px - 2560px), and exhaustive state coverage.
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle, loginWithGitHub, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [touched, setTouched] = useState({
    email: false,
    password: false
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState(null); // { type, message, retryAction? }
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'github' | null
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // DOM Refs for accessibility and focus management
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const serverAlertRef = useRef(null);

  // Parse and sanitize destination URL
  const searchParams = new URLSearchParams(location.search);
  const rawReturnTo = searchParams.get('next') || searchParams.get('returnTo') || location.state?.from?.pathname;
  const destination = getSafeReturnUrl(rawReturnTo, '/app/workspace');
  const isEmailVerified = searchParams.get('verified') === 'true' || searchParams.get('verified') === '1';

  // If already authenticated, redirect straight to verified workspace destination
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      navigate(destination, { replace: true });
    }
  }, [isAuthLoading, isAuthenticated, destination, navigate]);

  // Monitor network online/offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (serverError?.type === 'network') {
        setServerError(null);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setServerError({
        type: 'network',
        message: "Can't reach Testnexa. Check your connection and retry"
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [serverError]);

  // Mobile virtual keyboard handling: scroll focused field into view
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleViewportResize = () => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'BUTTON')) {
        setTimeout(() => {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };
    window.visualViewport.addEventListener('resize', handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  // Keyboard Caps Lock detection
  const handleKeyModifier = (e) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  // Field validation on blur
  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (field === 'email') {
      const err = validateEmail(formData.email);
      setFieldErrors((prev) => ({ ...prev, email: err }));
    } else if (field === 'password') {
      const err = validatePassword(formData.password);
      setFieldErrors((prev) => ({ ...prev, password: err }));
    }
  };

  // Field change handler
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newVal = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newVal
    }));

    // Clear field-specific error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
    // Clear global server error on input modification
    if (serverError) {
      setServerError(null);
    }
  };

  // Validate entire form before submission
  const validateAll = () => {
    const emailErr = validateEmail(formData.email);
    const passErr = validatePassword(formData.password);

    const errors = {};
    if (emailErr) errors.email = emailErr;
    if (passErr) errors.password = passErr;

    setFieldErrors(errors);
    setTouched({ email: true, password: true });

    return {
      isValid: Object.keys(errors).length === 0,
      firstInvalid: emailErr ? 'email' : passErr ? 'password' : null
    };
  };

  // Primary form submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // Prevent double-submits
    if (isSubmitting || oauthLoading) return;

    // Check offline status first
    if (!navigator.onLine) {
      setServerError({
        type: 'network',
        message: "Can't reach Testnexa. Check your connection and retry"
      });
      setTimeout(() => serverAlertRef.current?.focus(), 50);
      return;
    }

    const { isValid, firstInvalid } = validateAll();

    if (!isValid) {
      if (firstInvalid === 'email') {
        emailInputRef.current?.focus();
      } else if (firstInvalid === 'password') {
        passwordInputRef.current?.focus();
      }
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      const result = await login(
        formData.email.trim(),
        formData.password,
        formData.rememberMe
      );

      if (result && result.success) {
        navigate(destination, { replace: true });
      } else {
        // Map server failure safely (never leak email existence)
        const msg = result?.message?.toLowerCase() || '';
        let errType = 'credentials';
        let displayMsg = 'Incorrect email or password';

        if (msg.includes('rate limit') || msg.includes('too many') || result?.code === 'RATE_LIMITED') {
          errType = 'rate-limit';
          displayMsg = 'Too many attempts. Try again in 15 minutes';
        } else if (msg.includes('network') || msg.includes('connection') || msg.includes('timeout')) {
          errType = 'network';
          displayMsg = "Can't reach Testnexa. Check your connection and retry";
        }

        setServerError({ type: errType, message: displayMsg });
        setTimeout(() => serverAlertRef.current?.focus(), 60);
      }
    } catch (err) {
      const isRate = err.response?.status === 429;
      const isNet = !err.response || err.code === 'ERR_NETWORK';

      let errType = 'credentials';
      let displayMsg = 'Incorrect email or password';

      if (isRate) {
        errType = 'rate-limit';
        displayMsg = 'Too many attempts. Try again in 15 minutes';
      } else if (isNet) {
        errType = 'network';
        displayMsg = "Can't reach Testnexa. Check your connection and retry";
      }

      setServerError({ type: errType, message: displayMsg });
      setTimeout(() => serverAlertRef.current?.focus(), 60);
    } finally {
      setIsSubmitting(false);
    }
  };

  // OAuth triggers with loading and error boundaries
  const handleOAuth = async (provider) => {
    if (isSubmitting || oauthLoading) return;

    if (!navigator.onLine) {
      setServerError({
        type: 'network',
        message: "Can't reach Testnexa. Check your connection and retry"
      });
      return;
    }

    setOauthLoading(provider);
    setServerError(null);

    try {
      if (provider === 'google') {
        loginWithGoogle(destination);
      } else if (provider === 'github') {
        loginWithGitHub(destination);
      }
    } catch (err) {
      setServerError({
        type: 'general',
        message: `Unable to initiate ${provider} authentication. Please retry.`
      });
      setOauthLoading(null);
    }
  };

  const isFormValidToSubmit = Boolean(formData.email.trim() && formData.password);

  return (
    <div className="tn-auth-card">
      {/* ─── Heading & Subline ─── */}
      <h1 className="tn-auth-title">Welcome back</h1>
      <p className="tn-auth-subtitle">Sign in to your Testnexa workspace</p>

      {/* ─── Social Login Buttons (Monochrome Outlined 48px) ─── */}
      <div className="tn-auth-social-group">
        {/* Google OAuth Button */}
        <button
          type="button"
          className="tn-auth-social-btn"
          onClick={() => handleOAuth('google')}
          disabled={isSubmitting || !!oauthLoading}
          aria-label="Continue with Google"
        >
          {oauthLoading === 'google' ? (
            <span className="tn-auth-btn-loading">
              <span className="tn-auth-spinner tn-auth-spinner-light" aria-hidden="true" />
              <span>Connecting…</span>
            </span>
          ) : (
            <>
              <span className="tn-auth-social-icon" aria-hidden="true">
                {/* Monochrome Google G Icon in White */}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#ffffff"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#ffffff"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#ffffff"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#ffffff"
                  />
                </svg>
              </span>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* GitHub OAuth Button */}
        <button
          type="button"
          className="tn-auth-social-btn"
          onClick={() => handleOAuth('github')}
          disabled={isSubmitting || !!oauthLoading}
          aria-label="Continue with GitHub"
        >
          {oauthLoading === 'github' ? (
            <span className="tn-auth-btn-loading">
              <span className="tn-auth-spinner tn-auth-spinner-light" aria-hidden="true" />
              <span>Connecting…</span>
            </span>
          ) : (
            <>
              <span className="tn-auth-social-icon" aria-hidden="true">
                {/* Monochrome GitHub Octocat Icon in White */}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </span>
              <span>Continue with GitHub</span>
            </>
          )}
        </button>
      </div>

      {/* ─── Real Divider ─── */}
      <div className="tn-auth-divider">
        <span>or continue with email</span>
      </div>

      {/* Optional Email Verification Toast */}
      {isEmailVerified && (
        <div
          className="tn-auth-server-alert"
          style={{ marginBottom: '16px' }}
          role="status"
        >
          <div className="tn-auth-alert-content">
            <AlertCircle size={16} aria-hidden="true" />
            <span>Email verified successfully. You can now sign in to your workspace.</span>
          </div>
        </div>
      )}

      {/* ─── Primary Form ─── */}
      <form onSubmit={handleSubmit} className="tn-auth-form" noValidate>
        {/* Email Field */}
        <div className="tn-auth-field">
          <label htmlFor="login-email" className="tn-auth-label">
            Email address
          </label>
          <div className="tn-auth-input-wrapper">
            <input
              ref={emailInputRef}
              type="email"
              id="login-email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={() => handleBlur('email')}
              className={`tn-auth-input ${fieldErrors.email ? 'is-error' : ''}`}
              placeholder="name@company.com"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck="false"
              autoFocus
              disabled={isSubmitting || !!oauthLoading}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              required
            />
          </div>
          {fieldErrors.email && (
            <span
              id="login-email-error"
              className="tn-auth-field-error"
              role="alert"
            >
              <AlertCircle size={14} aria-hidden="true" />
              <span>{fieldErrors.email}</span>
            </span>
          )}
        </div>

        {/* Password Field */}
        <div className="tn-auth-field">
          <div className="tn-auth-field-header">
            <label htmlFor="login-password" className="tn-auth-label">
              Password
            </label>
            <Link
              to={`/forgot-password${location.search}`}
              className="tn-auth-forgot-link"
              tabIndex={0}
            >
              Forgot password?
            </Link>
          </div>
          <div className="tn-auth-input-wrapper">
            <input
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              id="login-password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onBlur={() => {
                handleBlur('password');
                setCapsLockActive(false);
              }}
              onKeyDown={handleKeyModifier}
              onKeyUp={handleKeyModifier}
              className={`tn-auth-input ${fieldErrors.password ? 'is-error' : ''}`}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isSubmitting || !!oauthLoading}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              required
            />
            <button
              type="button"
              className="tn-auth-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              tabIndex={0}
            >
              {showPassword ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Caps Lock Warning Banner */}
          {capsLockActive && (
            <div className="tn-auth-caps-warning" role="status">
              <span>Caps Lock is on</span>
            </div>
          )}

          {/* Password Validation Error */}
          {fieldErrors.password && (
            <span
              id="login-password-error"
              className="tn-auth-field-error"
              role="alert"
            >
              <AlertCircle size={14} aria-hidden="true" />
              <span>{fieldErrors.password}</span>
            </span>
          )}
        </div>

        {/* Custom 18px Checkbox: Remember me for 30 days */}
        <label className="tn-auth-checkbox-label">
          <input
            type="checkbox"
            name="rememberMe"
            id="login-remember"
            checked={formData.rememberMe}
            onChange={handleChange}
            className="tn-auth-checkbox-native"
            disabled={isSubmitting || !!oauthLoading}
          />
          <span className="tn-auth-checkbox-custom" aria-hidden="true">
            {formData.rememberMe && (
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 8 6.5 11.5 13 4" />
              </svg>
            )}
          </span>
          <span className="tn-auth-checkbox-text">Remember me for 30 days</span>
        </label>

        {/* ─── Server Error Alert Box Above Button ─── */}
        {serverError && (
          <div
            ref={serverAlertRef}
            className="tn-auth-server-alert"
            role="alert"
            tabIndex={-1}
            aria-live="assertive"
          >
            <div className="tn-auth-alert-content">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{serverError.message}</span>
            </div>
            {serverError.type === 'network' && (
              <button
                type="button"
                className="tn-auth-alert-retry-btn"
                onClick={handleSubmit}
                aria-label="Retry connection"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* ─── Primary Submit Button "Sign in" ─── */}
        <button
          type="submit"
          className="tn-auth-btn-primary"
          disabled={!isFormValidToSubmit || isSubmitting || !!oauthLoading}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <span className="tn-auth-btn-loading">
              <span className="tn-auth-spinner" aria-hidden="true" />
              <span>Signing in…</span>
            </span>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* ─── Footer Link: Create Account ─── */}
      <div className="tn-auth-prompt">
        Don&apos;t have an account?{' '}
        <Link
          to={`/signup${location.search}`}
          className="tn-auth-prompt-link"
        >
          Create account
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
