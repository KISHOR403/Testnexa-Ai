const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/user.model');
const AuthSession = require('../models/authSession.model');
const supabaseService = require('../services/supabaseData.service');

exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');

            // Guest user mode
            if (decoded.id && decoded.id.toString().startsWith('guest_')) {
                req.user = { _id: decoded.id, id: decoded.id, isTemporary: true };
                return next();
            }

            // Check if MongoDB session exists (if Mongo is connected)
            if (decoded.sessionId && mongoose.connection.readyState === 1) {
                try {
                    const session = await AuthSession.findById(decoded.sessionId);
                    if (session && (session.revokedAt !== null || (session.expiresAt && session.expiresAt < new Date()))) {
                        return res.status(401).json({
                            success: false,
                            code: 'SESSION_REVOKED',
                            message: 'Session has been revoked or expired. Please sign in again.'
                        });
                    }
                    if (session) {
                        req.sessionId = session._id;
                        if (Date.now() - new Date(session.lastActiveAt).getTime() > 2 * 60 * 1000) {
                            session.lastActiveAt = new Date();
                            session.save().catch(() => {});
                        }
                    }
                } catch (sessErr) {
                    // Ignore session check error if MongoDB is unavailable
                }
            }

            let user = null;

            // 1. Try MongoDB if connected
            if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(decoded.id)) {
                user = await User.findById(decoded.id).select('-password');
            }

            // 2. Try Supabase if user not found in Mongo or Mongo not ready
            if (!user && supabaseService.isAvailable) {
                const sbUser = await supabaseService.findUserById(decoded.id);
                if (sbUser) {
                    user = {
                        _id: sbUser.id,
                        id: sbUser.id,
                        name: sbUser.name,
                        displayName: sbUser.display_name || sbUser.name,
                        email: sbUser.email,
                        avatar: sbUser.avatar,
                        provider: sbUser.provider,
                        totalTestsGenerated: sbUser.total_tests_generated || 0,
                        createdAt: sbUser.created_at
                    };
                }
            }

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
            if (decoded.id && decoded.id.toString().startsWith('guest_')) {
                req.user = { _id: decoded.id, id: decoded.id, isTemporary: true };
                return next();
            }
            if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(decoded.id)) {
                req.user = await User.findById(decoded.id).select('-password');
            }
            if (!req.user && supabaseService.isAvailable) {
                const sbUser = await supabaseService.findUserById(decoded.id);
                if (sbUser) {
                    req.user = {
                        _id: sbUser.id,
                        id: sbUser.id,
                        name: sbUser.name,
                        displayName: sbUser.display_name || sbUser.name,
                        email: sbUser.email,
                        avatar: sbUser.avatar,
                        provider: sbUser.provider,
                        totalTestsGenerated: sbUser.total_tests_generated || 0
                    };
                }
            }
        } catch (e) {
            // Silently ignore
        }
    }
    next();
};
