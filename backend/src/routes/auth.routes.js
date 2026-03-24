const express = require('express');
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const router = express.Router();

// Google Auth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    (req, res, next) => {
        passport.authenticate('google', (err, user, info) => {
            if (err) {
                console.error('Google auth error:', err);
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
            }
            if (!user) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                return res.redirect(`${frontendUrl}/login?error=authentication_failed`);
            }
            req.logIn(user, (loginErr) => {
                if (loginErr) {
                    console.error('Session login error:', loginErr);
                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(loginErr.message)}`);
                }
                const token = authController.generateToken(user._id);
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                res.redirect(`${frontendUrl}?token=${token}`);
            });
        })(req, res, next);
    }
);

// Manual Email/Password Auth
router.post('/register', authController.register);
router.post('/login', authController.login);

// GitHub Auth Routes
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication
        const token = authController.generateToken(req.user._id);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}?token=${token}`);
    }
);

// Logout Routes
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

router.post('/logout', (req, res) => {
    // For JWT, the frontend just discards the token. 
    // This endpoint is here to satisfy the requirement and can be used to blacklist tokens if needed.
    res.json({ success: true, message: 'Logged out successfully' });
});

// Get Current User Route
router.get('/me', protect, authController.getMe);

module.exports = router;
