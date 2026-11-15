import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateEmail, validatePassword, getSafeReturnUrl } from '../../frontend/utils/authValidation.js';

describe('Auth Validation Utilities', () => {
  describe('validateEmail', () => {
    it('returns error message for empty, null, or whitespace-only email', () => {
      assert.equal(validateEmail(''), 'Enter a valid email address');
      assert.equal(validateEmail(null), 'Enter a valid email address');
      assert.equal(validateEmail(undefined), 'Enter a valid email address');
      assert.equal(validateEmail('   '), 'Enter a valid email address');
    });

    it('returns error message for malformed emails', () => {
      assert.equal(validateEmail('plainaddress'), 'Enter a valid email address');
      assert.equal(validateEmail('@missingusername.com'), 'Enter a valid email address');
      assert.equal(validateEmail('username@.com'), 'Enter a valid email address');
      assert.equal(validateEmail('username@domain'), 'Enter a valid email address');
      assert.equal(validateEmail('username@domain.'), 'Enter a valid email address');
      assert.equal(validateEmail('user name@domain.com'), 'Enter a valid email address');
    });

    it('returns null for valid email addresses', () => {
      assert.equal(validateEmail('engineer@testnexa.ai'), null);
      assert.equal(validateEmail('user.name+tag@company.co.uk'), null);
      assert.equal(validateEmail('dev_team@sub.domain.org'), null);
    });

    it('never leaks whether an email address exists in the system', () => {
      // Regardless of who the email belongs to, syntactically valid inputs return null
      assert.equal(validateEmail('existing.admin@testnexa.ai'), null);
      assert.equal(validateEmail('nonexistent.ghost@randomcompany123.com'), null);
    });
  });

  describe('validatePassword', () => {
    it('returns error message when password is empty or blank', () => {
      assert.equal(validatePassword(''), 'Password is required');
      assert.equal(validatePassword(null), 'Password is required');
      assert.equal(validatePassword('   '), 'Password is required');
    });

    it('returns null when password is provided', () => {
      assert.equal(validatePassword('P@ssword123'), null);
      assert.equal(validatePassword('any-non-empty-string'), null);
    });
  });

  describe('getSafeReturnUrl (Same-Origin & Open-Redirect Protection)', () => {
    const fallback = '/app/workspace';

    it('returns fallback for null, undefined, or empty strings', () => {
      assert.equal(getSafeReturnUrl(null, fallback), fallback);
      assert.equal(getSafeReturnUrl(undefined, fallback), fallback);
      assert.equal(getSafeReturnUrl('', fallback), fallback);
      assert.equal(getSafeReturnUrl('   ', fallback), fallback);
    });

    it('rejects protocol-relative URLs (//evil.com)', () => {
      assert.equal(getSafeReturnUrl('//evil.com', fallback), fallback);
      assert.equal(getSafeReturnUrl('//evil.com/app', fallback), fallback);
      assert.equal(getSafeReturnUrl('///evil.com', fallback), fallback);
    });

    it('rejects backslash escaping (/\\evil.com)', () => {
      assert.equal(getSafeReturnUrl('/\\evil.com', fallback), fallback);
      assert.equal(getSafeReturnUrl('/\\/evil.com', fallback), fallback);
    });

    it('rejects external schemes (https://, http://, javascript:, data:)', () => {
      assert.equal(getSafeReturnUrl('https://evil.com', fallback), fallback);
      assert.equal(getSafeReturnUrl('http://attacker.org/phish', fallback), fallback);
      assert.equal(getSafeReturnUrl('javascript:alert(1)', fallback), fallback);
      assert.equal(getSafeReturnUrl('data:text/html,<script>alert(1)</script>', fallback), fallback);
    });

    it('allows valid relative paths within same origin', () => {
      assert.equal(getSafeReturnUrl('/app/test-suites', fallback), '/app/test-suites');
      assert.equal(getSafeReturnUrl('/app/runs/run-123?filter=all', fallback), '/app/runs/run-123?filter=all');
      assert.equal(getSafeReturnUrl('/help#section-auth', fallback), '/help#section-auth');
    });

    it('normalizes legacy convenience alias paths to canonical app paths', () => {
      assert.equal(getSafeReturnUrl('/workspace', fallback), '/app/workspace');
      assert.equal(getSafeReturnUrl('/generator', fallback), '/app/workspace');
      assert.equal(getSafeReturnUrl('/suites', fallback), '/app/test-suites');
      assert.equal(getSafeReturnUrl('/suites/12345', fallback), '/app/test-suites/12345');
      assert.equal(getSafeReturnUrl('/billing', fallback), '/app/settings?tab=billing');
    });
  });
});
