const test = require('node:test');
const assert = require('node:assert');

// Ported or imported sanitizer logic identical to frontend/hooks/useWorkspaceEntry.js
const getSafeReturnUrl = (url, fallback = '/app/workspace') => {
    if (!url || typeof url !== 'string') return fallback;
    const trimmed = url.trim();

    // Must start with exactly one '/' and not followed by another '/' or '\'
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
        return fallback;
    }

    // Disallow protocols anywhere in path (e.g., javascript:, data:, https:)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
        return fallback;
    }

    try {
        const dummyBase = 'http://localhost';
        const parsed = new URL(trimmed, dummyBase);
        if (parsed.origin !== dummyBase) return fallback;
        return parsed.pathname + parsed.search + parsed.hash;
    } catch {
        return fallback;
    }
};

test('Security Sanitizer: getSafeReturnUrl Suite', async (t) => {
    await t.test('1. Valid internal relative path is preserved', () => {
        assert.strictEqual(getSafeReturnUrl('/app/workspace'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('/app/history'), '/app/history');
        assert.strictEqual(getSafeReturnUrl('/app/test-suites/123'), '/app/test-suites/123');
    });

    await t.test('2. Valid internal paths with search and hash parameters are preserved', () => {
        assert.strictEqual(getSafeReturnUrl('/app/workspace?tab=coverage&filter=high'), '/app/workspace?tab=coverage&filter=high');
        assert.strictEqual(getSafeReturnUrl('/app/settings#security'), '/app/settings#security');
    });

    await t.test('3. Open Redirect: Protocol-relative URLs are rejected', () => {
        assert.strictEqual(getSafeReturnUrl('//evil.com/phish'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('//attacker.org'), '/app/workspace');
    });

    await t.test('4. Open Redirect: Backslash evasion attempts are rejected', () => {
        assert.strictEqual(getSafeReturnUrl('/\\evil.com'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('/\\\\attacker.org'), '/app/workspace');
    });

    await t.test('5. Open Redirect: Absolute external URLs are rejected', () => {
        assert.strictEqual(getSafeReturnUrl('https://evil.com'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('http://attacker.org/steal'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('ftp://files.org/malware'), '/app/workspace');
    });

    await t.test('6. XSS / Injection: javascript: and data: schemes are rejected', () => {
        assert.strictEqual(getSafeReturnUrl('javascript:alert(document.cookie)'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('data:text/html,<script>alert(1)</script>'), '/app/workspace');
    });

    await t.test('7. Null, undefined, empty, and whitespace inputs return fallback', () => {
        assert.strictEqual(getSafeReturnUrl(null), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl(undefined), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl(''), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('   '), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl(123), '/app/workspace');
    });

    await t.test('8. Custom fallback is respected when input is invalid', () => {
        assert.strictEqual(getSafeReturnUrl('https://evil.com', '/app/history'), '/app/history');
        assert.strictEqual(getSafeReturnUrl(null, '/app/settings'), '/app/settings');
    });
});
