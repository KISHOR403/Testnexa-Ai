import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { InlineTestSignal } from '../components/loading';
import { getSafeReturnUrl } from '../hooks/useWorkspaceEntry';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle, loginWithGitHub, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Read destination from 'next' or 'returnTo' search params or router location state (with open-redirect protection)
  const searchParams = new URLSearchParams(location.search);
  const rawReturnTo = searchParams.get('next') || searchParams.get('returnTo') || location.state?.from?.pathname;
  const destination = getSafeReturnUrl(rawReturnTo, '/app/workspace');
  const isEmailVerified = searchParams.get('verified') === 'true' || searchParams.get('verified') === '1';

  // If user is already authenticated and auth verification finished, redirect straight to their intended workspace
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      navigate(destination, { replace: true });
    }
  }, [isAuthLoading, isAuthenticated, destination, navigate]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid work email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await login(formData.email.trim(), formData.password, formData.rememberMe);
      if (result.success) {
        navigate(destination, { replace: true });
      } else {
        setErrors({ submit: result.message || 'Incorrect email or password.' });
      }
    } catch (error) {
      setErrors({ submit: 'An unexpected connection error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    if (provider === 'Google') {
      loginWithGoogle(destination);
    } else if (provider === 'GitHub') {
      loginWithGitHub(destination);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }
    if (errors.submit) {
      setErrors((prev) => ({ ...prev, submit: '' }));
    }
  };

  return (
    <div className="tn-auth-card">
      <h1 className="tn-auth-title">Welcome back</h1>
      <p className="tn-auth-subtitle">Sign in to your TestNexa account</p>

      {/* Social Logins */}
      <div className="tn-auth-social-group">
        <button
          type="button"
          className="tn-auth-social-btn"
          onClick={() => handleSocialLogin('Google')}
          disabled={isLoading}
        >
          <span className="tn-auth-social-icon">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </span>
          Continue with Google
        </button>

        <button
          type="button"
          className="tn-auth-social-btn"
          onClick={() => handleSocialLogin('GitHub')}
          disabled={isLoading}
        >
          <span className="tn-auth-social-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#F5F5F5">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </span>
          Continue with GitHub
        </button>
      </div>

      <div className="tn-auth-divider">
        <span>or continue with email</span>
      </div>

      {/* Email Verified Banner */}
      {isEmailVerified && (
        <div className="tn-auth-success-banner" style={{ marginBottom: '16px' }} role="status">
          Email verified successfully. You can now sign in to access your workspace.
        </div>
      )}

      {/* Form Error Banner */}
      {errors.submit && (
        <div className="tn-auth-error-banner" role="alert">
          {errors.submit}
        </div>
      )}

      {/* Credential Form */}
      <form onSubmit={handleSubmit} className="tn-auth-form" noValidate>
        {/* Email Field */}
        <div className="tn-auth-field">
          <label htmlFor="login-email" className="tn-auth-label">
            Email address
          </label>
          <div className="tn-auth-input-wrapper">
            <input
              type="email"
              id="login-email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`tn-auth-input ${errors.email ? 'is-error' : ''}`}
              placeholder="name@company.com"
              autoComplete="email"
              autoFocus
              disabled={isLoading}
              required
            />
          </div>
          {errors.email && (
            <span className="tn-auth-field-error" role="alert">
              {errors.email}
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
              type={showPassword ? 'text' : 'password'}
              id="login-password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`tn-auth-input ${errors.password ? 'is-error' : ''}`}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isLoading}
              required
            />
            <button
              type="button"
              className="tn-auth-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <span className="tn-auth-field-error" role="alert">
              {errors.password}
            </span>
          )}
        </div>

        {/* Remember Me */}
        <label className="tn-auth-checkbox-row">
          <input
            type="checkbox"
            name="rememberMe"
            checked={formData.rememberMe}
            onChange={handleChange}
            className="tn-auth-checkbox"
            disabled={isLoading}
          />
          <span>Remember me for 30 days</span>
        </label>

        {/* Submit Button */}
        <button
          type="submit"
          className="tn-auth-btn-primary"
          disabled={isLoading}
        >
          {isLoading ? (
            <InlineTestSignal size={15} label="Signing in..." />
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Switch to SignUp */}
      <div className="tn-auth-prompt">
        Don't have an account?{' '}
        <Link to={`/signup${location.search}`}>
          Create account
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
