const express = require('express');
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const {
    authLoginRateLimiter,
    authRegisterRateLimiter,
    authPasswordResetRateLimiter
} = require('../middleware/rateLimiter.middleware');
const router = express.Router();

// Sanitizer to guarantee OAuth redirect destinations are safe relative internal paths
const sanitizeReturnUrl = (url, fallback = '/app/workspace') => {
    if (!url || typeof url !== 'string') return fallback;
    const trimmed = url.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
        return fallback;
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
        return fallback;
    }
    try {
        const dummyBase = 'http://localhost';
        const parsed = new URL(trimmed, dummyBase);
        if (parsed.origin !== dummyBase) return fallback;
        let pathname = parsed.pathname;
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
        }
        return pathname + parsed.search + parsed.hash;
    } catch {
        return fallback;
    }
};

// Google Auth Routes
router.get('/google', (req, res, next) => {
    const rawTarget = req.query.next || req.query.returnTo || '/app/workspace';
    const state = sanitizeReturnUrl(rawTarget, '/app/workspace');
    passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
});

router.get('/google/callback',
    (req, res, next) => {
        passport.authenticate('google', { session: false }, async (err, user, info) => {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const state = sanitizeReturnUrl(req.query.state, '/app/workspace');

            if (err) {
                console.error('Google auth error:', err);
                return res.redirect(`${frontendUrl}/login?next=${encodeURIComponent(state)}&error=${encodeURIComponent(err.message)}`);
            }
            if (!user) {
                return res.redirect(`${frontendUrl}/login?next=${encodeURIComponent(state)}&error=authentication_failed`);
            }

            const userId = user.id || user._id;
            const token = authController.generateToken(userId);

            const sep = state.includes('?') ? '&' : '?';
            res.redirect(`${frontendUrl}${state}${sep}token=${token}`);

            // Background non-blocking session recording
            setImmediate(async () => {
                try {
                    await authController.createAuthSession(userId, req);
                } catch (e) {}
            });
        })(req, res, next);
    }
);

// Manual Email/Password Auth
router.post('/register', authRegisterRateLimiter, authController.register);
router.post('/login', authLoginRateLimiter, authController.login);

// Email Verification
router.get('/verify-email', authController.verifyEmail);

// Password Reset Routes
router.post('/forgot-password', authPasswordResetRateLimiter, authController.forgotPassword);
router.put('/reset-password/:token', authPasswordResetRateLimiter, authController.resetPassword);

// GitHub Auth Routes
router.get('/github', (req, res, next) => {
    const rawTarget = req.query.next || req.query.returnTo || '/app/workspace';
    const state = sanitizeReturnUrl(rawTarget, '/app/workspace');
    passport.authenticate('github', { scope: ['user:email'], state })(req, res, next);
});

router.get('/github/callback',
    (req, res, next) => {
        passport.authenticate('github', { session: false }, async (err, user, info) => {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const state = sanitizeReturnUrl(req.query.state, '/app/workspace');

            if (err || !user) {
                return res.redirect(`${frontendUrl}/login?next=${encodeURIComponent(state)}&error=github_auth_failed`);
            }

            const userId = user.id || user._id;
            const token = authController.generateToken(userId);

            const sep = state.includes('?') ? '&' : '?';
            res.redirect(`${frontendUrl}${state}${sep}token=${token}`);

            setImmediate(async () => {
                try {
                    await authController.createAuthSession(userId, req);
                } catch (e) {}
            });
        })(req, res, next);
    }
);

// Real Logout Route
router.post('/logout', optionalProtect, authController.logout);
router.get('/logout', optionalProtect, authController.logout);

// Active Session Management Routes
router.get('/sessions', protect, authController.listSessions);
router.post('/sessions/revoke-others', protect, authController.revokeOtherSessions);
router.post('/sessions/:sessionId/revoke', protect, authController.revokeSession);

// Get Current User Route
router.get('/me', protect, authController.getMe);

// Update Profile & Password
router.put('/update-profile', protect, authController.updateProfile);
router.put('/change-password', protect, authController.changePassword);

// Delete Account Route
router.delete('/account', protect, authController.deleteAccount);

module.exports = router;
