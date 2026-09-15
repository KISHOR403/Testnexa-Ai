const express = require('express');
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const router = express.Router();

// Google Auth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    (req, res, next) => {
        passport.authenticate('google', async (err, user, info) => {
            if (err) {
                console.error('Google auth error:', err);
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
            }
            if (!user) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                return res.redirect(`${frontendUrl}/login?error=authentication_failed`);
            }
            req.logIn(user, async (loginErr) => {
                if (loginErr) {
                    console.error('Session login error:', loginErr);
                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(loginErr.message)}`);
                }
                const userId = user._id || user.id;
                const session = await authController.createAuthSession(userId, req);
                const token = authController.generateToken(userId, session?._id);
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                res.redirect(`${frontendUrl}?token=${token}`);
            });
        })(req, res, next);
    }
);

// Manual Email/Password Auth
router.post('/register', authController.register);
router.post('/login', authController.login);

// Password Reset Routes
router.post('/forgot-password', authController.forgotPassword);
router.put('/reset-password/:token', authController.resetPassword);

// GitHub Auth Routes
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/login' }),
    async (req, res) => {
        // Successful authentication
        const userId = req.user._id || req.user.id;
        const session = await authController.createAuthSession(userId, req);
        const token = authController.generateToken(userId, session?._id);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}?token=${token}`);
    }
);

// Real Logout Route (clears backend session, marks AuthSession as revoked, and clears cookie)
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

module.exports = router;
