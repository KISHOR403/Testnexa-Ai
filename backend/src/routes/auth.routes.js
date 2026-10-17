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

// Google Auth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    (req, res, next) => {
        passport.authenticate('google', { session: false }, async (err, user, info) => {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            if (err) {
                console.error('Google auth error:', err);
                return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
            }
            if (!user) {
                return res.redirect(`${frontendUrl}/login?error=authentication_failed`);
            }

            const userId = user.id || user._id;
            const token = authController.generateToken(userId);

            // Fast instant redirect to frontend
            res.redirect(`${frontendUrl}?token=${token}`);

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

// Password Reset Routes
router.post('/forgot-password', authPasswordResetRateLimiter, authController.forgotPassword);
router.put('/reset-password/:token', authPasswordResetRateLimiter, authController.resetPassword);

// GitHub Auth Routes
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback',
    (req, res, next) => {
        passport.authenticate('github', { session: false }, async (err, user, info) => {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            if (err || !user) {
                return res.redirect(`${frontendUrl}/login?error=github_auth_failed`);
            }

            const userId = user.id || user._id;
            const token = authController.generateToken(userId);

            // Fast instant redirect to frontend
            res.redirect(`${frontendUrl}?token=${token}`);

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
