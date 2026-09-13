const express = require('express');
const { generateTestCases, getTestHistory, getGenerationStatus } = require('../controllers/generate.controller');
const { protect } = require('../middleware/auth.middleware');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const AuthSession = require('../models/authSession.model');
const mongoose = require('mongoose');

const router = express.Router();

// Middleware to optionally attach user (doesn't require auth, but attaches user if token exists and is valid)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
            if (mongoose.connection.readyState === 1) {
                // If session is revoked, don't attach user
                if (decoded.sessionId) {
                    const session = await AuthSession.findById(decoded.sessionId);
                    if (!session || session.revokedAt !== null || (session.expiresAt && session.expiresAt < new Date())) {
                        return next();
                    }
                }
                req.user = await User.findById(decoded.id).select('-password');
            }
        }
    } catch (err) {
        // Silently fail — user just won't have history saved
    }
    next();
};

// POST /api/v1/generate - Generate test cases (optional auth to save history)
router.post('/generate', optionalAuth, generateTestCases);
router.post('/generations', optionalAuth, generateTestCases);

// GET /api/v1/generations/:id - Get generation status
router.get('/generations/:id', optionalAuth, getGenerationStatus);

// GET /api/v1/history - Get test generation history (requires auth)
router.get('/history', protect, getTestHistory);

module.exports = router;
