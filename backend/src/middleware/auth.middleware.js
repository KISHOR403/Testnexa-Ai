const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/user.model');
const AuthSession = require('../models/authSession.model');

exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');

            // Check if MongoDB is connected
            if (mongoose.connection.readyState !== 1) {
                // If ID starts with guest_, it's a guest user from passport guest mode
                if (decoded.id && decoded.id.toString().startsWith('guest_')) {
                    req.user = { _id: decoded.id, isTemporary: true };
                    return next();
                }
                throw new Error('Database not connected');
            }

            // Check if token is tied to an active AuthSession
            if (decoded.sessionId) {
                const session = await AuthSession.findById(decoded.sessionId);
                if (!session || session.revokedAt !== null || (session.expiresAt && session.expiresAt < new Date())) {
                    return res.status(401).json({
                        success: false,
                        code: 'SESSION_REVOKED',
                        message: 'Session has been revoked or expired. Please sign in again.'
                    });
                }
                req.sessionId = session._id;

                // Throttled update of lastActiveAt
                if (Date.now() - new Date(session.lastActiveAt).getTime() > 2 * 60 * 1000) {
                    session.lastActiveAt = new Date();
                    session.save().catch(() => {});
                }
            }

            const user = await User.findById(decoded.id).select('-password');
            if (!user) {
                return res.status(401).json({ success: false, message: 'User account no longer exists' });
            }

            req.user = user;
            return next();
        } catch (error) {
            console.error('Auth check error:', error.message);
            return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

// Middleware that extracts user & session if token is valid, but doesn't block if missing or revoked
exports.optionalProtect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
            if (decoded.sessionId) {
                req.sessionId = decoded.sessionId;
            }
            if (mongoose.connection.readyState === 1) {
                req.user = await User.findById(decoded.id).select('-password');
            }
        } catch (e) {
            // Silently ignore
        }
    }
    next();
};
