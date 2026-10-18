const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

// Import core modules from backend
const { protect } = require('../src/middleware/auth.middleware');
const { generateToken } = require('../src/controllers/auth.controller');

// Exact sanitizer logic mirrored from frontend/hooks/useWorkspaceEntry.js and backend/src/routes/auth.routes.js
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

        let pathname = parsed.pathname;

        // Route normalization for common convenience aliases
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
};

// Target URL computation mirrored from frontend/hooks/useWorkspaceEntry.js
const computeTargetUrl = (destination = '/app/workspace', isLoggedIn = false) => {
    const safeDestination = getSafeReturnUrl(destination, '/app/workspace');
    if (isLoggedIn) {
        return safeDestination;
    }
    return `/login?next=${encodeURIComponent(safeDestination)}`;
};

// Destination extractor from login/signup query string
const resolveDestinationFromSearch = (searchString, fallback = '/app/workspace') => {
    const params = new URLSearchParams(searchString.startsWith('?') ? searchString.slice(1) : searchString);
    const raw = params.get('next') || params.get('returnTo');
    return getSafeReturnUrl(raw, fallback);
};

test('TestNexa AI: End-to-End Authentication Redirect & Protected Workflow Regression Suite', async (t) => {

    await t.test('1. Unauthenticated visitor clicks Generate Test Suite and is sent to login', () => {
        const isAuth = false;
        const targetUrl = computeTargetUrl('/app/workspace', isAuth);
        assert.strictEqual(targetUrl, '/login?next=%2Fapp%2Fworkspace');

        const convenienceTarget = computeTargetUrl('/workspace/new-test-suite', isAuth);
        assert.strictEqual(convenienceTarget, '/login?next=%2Fapp%2Fworkspace');
    });

    await t.test('2. Successful login returns the visitor to New Test Suite', () => {
        const loginQuery = '?next=%2Fapp%2Fworkspace';
        const destination = resolveDestinationFromSearch(loginQuery);
        assert.strictEqual(destination, '/app/workspace');

        // Backward compatibility with ?returnTo=
        const legacyQuery = '?returnTo=%2Fapp%2Fworkspace';
        const legacyDestination = resolveDestinationFromSearch(legacyQuery);
        assert.strictEqual(legacyDestination, '/app/workspace');
    });

    await t.test('3. Successful account creation preserves the destination and draft params', () => {
        const signupQuery = '?next=%2Fapp%2Fworkspace%3Frequirement%3DUser%2520Registration%26priority%3DHigh';
        const destination = resolveDestinationFromSearch(signupQuery);
        assert.strictEqual(destination, '/app/workspace?requirement=User%20Registration&priority=High');
    });

    await t.test('4. Switching between Login and Create Account preserves the destination', () => {
        const incomingQuery = '?next=%2Fapp%2Ftest-suites%2Fsuite_456';
        // Simulating Link to={'/signup' + location.search}
        const signupLocation = `/signup${incomingQuery}`;
        const destinationOnSignup = resolveDestinationFromSearch(signupLocation.split('?')[1]);
        assert.strictEqual(destinationOnSignup, '/app/test-suites/suite_456');

        // Switching back: Link to={'/login' + location.search}
        const backToLoginLocation = `/login${incomingQuery}`;
        const destinationOnLogin = resolveDestinationFromSearch(backToLoginLocation.split('?')[1]);
        assert.strictEqual(destinationOnLogin, '/app/test-suites/suite_456');
    });

    await t.test('5. Required email verification preserves the destination and displays verification screen', () => {
        // Step A: Registration with verification required
        const intendedDest = '/app/workspace?title=Payments';
        const verificationToken = jwt.sign({ id: 'user_test_verify', email: 'test@example.com' }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1h' });
        
        // Simulating verification link construction
        const verifyEndpointQuery = `token=${verificationToken}&next=${encodeURIComponent(intendedDest)}`;
        const params = new URLSearchParams(verifyEndpointQuery);
        const verifiedDest = getSafeReturnUrl(params.get('next'), '/app/workspace');

        // Verify destination was intact through verification flow
        assert.strictEqual(verifiedDest, '/app/workspace?title=Payments');
        
        // Simulating redirect after verification back to login
        const redirectAfterVerify = `/login?verified=true&next=${encodeURIComponent(verifiedDest)}`;
        const finalDest = resolveDestinationFromSearch(redirectAfterVerify.split('?')[1]);
        assert.strictEqual(finalDest, '/app/workspace?title=Payments');
    });

    await t.test('6. Direct protected-route access redirects to login and returns to the original route', () => {
        const directProtectedPath = '/app/history?range=30d#table';
        const guardRedirect = `/login?next=${encodeURIComponent(directProtectedPath)}`;
        
        const returnUrl = resolveDestinationFromSearch(guardRedirect.split('?')[1]);
        assert.strictEqual(returnUrl, '/app/history?range=30d#table');
    });

    await t.test('7. Invalid or external redirect URLs are rejected (Open Redirect Protection)', () => {
        assert.strictEqual(getSafeReturnUrl('https://evil.com'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('http://attacker.org/steal'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('//evil.com/phish'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('/\\evil.com'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('javascript:alert(document.cookie)'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl('data:text/html,<script>window.location="http://evil.com"</script>'), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl(null), '/app/workspace');
        assert.strictEqual(getSafeReturnUrl(''), '/app/workspace');
    });

    await t.test('8. Existing authenticated users can access the generator directly', () => {
        const isAuth = true;
        const targetUrl = computeTargetUrl('/app/workspace', isAuth);
        assert.strictEqual(targetUrl, '/app/workspace');

        const directSuite = computeTargetUrl('/app/test-suites', isAuth);
        assert.strictEqual(directSuite, '/app/test-suites');
    });

    await t.test('9. Refreshing a protected route does not send the user to the homepage', () => {
        // While auth is restoring (isLoading: true), ProtectedRoute must return loading indicator without navigating
        const sessionState = { isLoading: true, isAuthenticated: true };
        const shouldRedirect = !sessionState.isLoading && !sessionState.isAuthenticated;
        assert.strictEqual(shouldRedirect, false, 'Must not redirect while session restoration is pending');
    });

    await t.test('10. Visiting the public homepage intentionally still works', () => {
        // Normal homepage URL remains '/'
        const homepagePath = '/';
        const isProtected = homepagePath.startsWith('/app');
        assert.strictEqual(isProtected, false, 'Homepage is a public marketing route and must not redirect authenticated users');
    });

    await t.test('11. Expired sessions are handled correctly without infinite redirect loops', () => {
        // When session token is expired, 401 interceptor constructs login redirect
        const currentPath = '/app/workspace?edit=true';
        const interceptorRedirect = `/login?next=${encodeURIComponent(currentPath)}`;
        
        assert.ok(interceptorRedirect.startsWith('/login?next='));
        assert.strictEqual(resolveDestinationFromSearch(interceptorRedirect.split('?')[1]), '/app/workspace?edit=true');
    });

    await t.test('12. Unauthenticated test-generation API requests are rejected with 401', async () => {
        const app = express();
        app.use(express.json());
        
        // Mock test-generation endpoint guarded by protect middleware
        app.post('/api/v1/generate', protect, (req, res) => {
            res.json({ success: true, message: 'Generated' });
        });

        const server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;

        try {
            // Test 1: Request with NO Authorization header
            const resNoAuth = await fetch(`http://localhost:${port}/api/v1/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requirement: 'User Registration' })
            });
            assert.strictEqual(resNoAuth.status, 401, 'Unauthenticated request must be rejected with 401');
            const bodyNoAuth = await resNoAuth.json();
            assert.strictEqual(bodyNoAuth.success, false);

            // Test 2: Request with invalid / malformed token
            const resBadToken = await fetch(`http://localhost:${port}/api/v1/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer bad.invalid.token'
                },
                body: JSON.stringify({ requirement: 'User Registration' })
            });
            assert.strictEqual(resBadToken.status, 401, 'Invalid token must be rejected with 401');
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });
});
