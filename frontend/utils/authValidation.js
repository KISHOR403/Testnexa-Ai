/**
 * Testnexa AI - Authentication Validation & Return URL Sanitization
 * Strict security controls for input validation and same-origin redirect protection.
 */

/**
 * Validates an email address.
 * Returns an error string if invalid, or null if valid.
 * Does NOT reveal whether an email account exists.
 *
 * @param {string} email
 * @returns {string|null}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return 'Enter a valid email address';
  }
  const trimmed = email.trim();
  // Standard RFC 5322 regex approximation for production email fields
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return 'Enter a valid email address';
  }
  return null;
}

/**
 * Validates a password input.
 * Returns an error string if invalid, or null if valid.
 *
 * @param {string} password
 * @returns {string|null}
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string' || !password.trim()) {
    return 'Password is required';
  }
  return null;
}

/**
 * Validates and sanitizes a return URL to prevent Open Redirect vulnerabilities.
 * Only relative paths starting with a single '/' are permitted.
 * Protocol-relative ('//'), backslash ('/\\'), and external URL schemes are rejected.
 * Also normalizes convenience alias routes to canonical application routes.
 *
 * @param {string} url - Candidate return URL
 * @param {string} fallback - Safe fallback URL (defaults to '/app/workspace')
 * @returns {string} Safe relative URL
 */
export function getSafeReturnUrl(url, fallback = '/app/workspace') {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();

  // Reject empty or non-relative candidates
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }

  // Reject protocols anywhere in candidate (e.g. javascript:, data:, https:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback;
  }

  try {
    const dummyBase = 'http://localhost';
    const parsed = new URL(trimmed, dummyBase);

    // Verify origin remained localhost without escaping
    if (parsed.origin !== dummyBase) return fallback;

    let pathname = parsed.pathname;

    // Canonical route normalization
    if (
      pathname === '/workspace' ||
      pathname === '/workspace/new-test-suite' ||
      pathname === '/app/workspace/new-test-suite' ||
      pathname === '/generator' ||
      pathname === '/new-test-suite'
    ) {
      pathname = '/app/workspace';
    } else if (pathname === '/suites') {
      pathname = '/app/test-suites';
    } else if (pathname.startsWith('/suites/')) {
      pathname = pathname.replace('/suites/', '/app/test-suites/');
    } else if (pathname === '/billing') {
      pathname = '/app/settings';
      if (!parsed.search.includes('tab=')) {
        parsed.search = parsed.search ? `${parsed.search}&tab=billing` : '?tab=billing';
      }
    }

    return pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
