import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle2, Check, Circle } from 'lucide-react';
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

  const passwordRules = [
    { key: 'length', label: 'At least 8 characters', test: (pwd) => pwd.length >= 8 },
    { key: 'uppercase', label: 'One uppercase letter', test: (pwd) => /[A-Z]/.test(pwd) },
    { key: 'lowercase', label: 'One lowercase letter', test: (pwd) => /[a-z]/.test(pwd) },
    { key: 'number', label: 'One number', test: (pwd) => /\d/.test(pwd) },
    { key: 'special', label: 'One special character (!@#$%^&*)', test: (pwd) => /[@$!%*?&#^()_+={}[\]:;"'<>,.~`|\\/-]/.test(pwd) }
  ];

  const validateForm = () => {
    const failedRule = passwordRules.find((rule) => !rule.test(formData.password));
    if (!formData.password) {
      setError('Password is required');
      return false;
    } else if (failedRule) {
      setError(`Password must satisfy all security rules (${failedRule.label.toLowerCase()})`);
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
      } else {
        setError(result.message || 'Failed to reset password. The link may have expired.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please request a new reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  return (
    <div className="tn-auth-card">
      {!isSuccess ? (
        <>
          <h1 className="tn-auth-title">Set new password</h1>
          <p className="tn-auth-subtitle">
            Choose a secure password for your TestNexa account.
          </p>

          {error && (
            <div className="tn-auth-error-banner" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="tn-auth-form" noValidate>
            {/* New Password */}
            <div className="tn-auth-field">
              <label htmlFor="reset-password" className="tn-auth-label">
                New password
              </label>
              <div className="tn-auth-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="reset-password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`tn-auth-input ${error && !formData.password ? 'is-error' : ''}`}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  autoFocus
                  disabled={isSubmitting}
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
            </div>

            {/* Password Rules Checklist */}
            <div className="tn-auth-pwd-checklist" aria-live="polite">
              {passwordRules.map((rule) => {
                const isValid = rule.test(formData.password);
                return (
                  <div
                    key={rule.key}
                    className={`tn-auth-pwd-item ${isValid ? 'is-valid' : ''}`}
                  >
                    <span className="tn-auth-pwd-icon">
                      {isValid ? (
                        <Check size={12} strokeWidth={3} />
                      ) : (
                        <Circle size={10} strokeWidth={2} />
                      )}
                    </span>
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Confirm New Password */}
            <div className="tn-auth-field">
              <label htmlFor="reset-confirm-password" className="tn-auth-label">
                Confirm new password
              </label>
              <div className="tn-auth-input-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="reset-confirm-password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`tn-auth-input ${error && formData.password !== formData.confirmPassword ? 'is-error' : ''}`}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  className="tn-auth-password-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
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
                  <span>Updating password...</span>
                </>
              ) : (
                'Reset password'
              )}
            </button>
          </form>

          <div className="tn-auth-prompt">
            <Link to="/login" className="tn-auth-back-link" style={{ justifyContent: 'center' }}>
              Back to sign in
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
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'grid',
              placeItems: 'center',
              color: '#10B981'
            }}>
              <CheckCircle2 size={20} />
            </div>
            <h1 className="tn-auth-title" style={{ margin: 0 }}>Password updated</h1>
          </div>

          <p className="tn-auth-subtitle" style={{ marginBottom: '20px' }}>
            Your TestNexa account password has been successfully updated. You can now sign in with your new credentials.
          </p>

          <Link
            to="/login"
            className="tn-auth-btn-primary"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            Sign in with new password
          </Link>
        </>
      )}
    </div>
  );
};

export default ResetPasswordPage;
