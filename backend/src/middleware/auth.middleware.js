const jwt = require('jsonwebtoken');
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

            // Check active session status if sessionId was embedded in token
            if (decoded.sessionId && supabaseService.isAvailable) {
                try {
                    const session = await supabaseService.getAuthSession(decoded.sessionId);
                    if (session && (session.revokedAt !== null || (session.expiresAt && new Date(session.expiresAt) < new Date()))) {
                        return res.status(401).json({
                            success: false,
                            code: 'SESSION_REVOKED',
                            message: 'Session has been revoked or expired. Please sign in again.'
                        });
                    }
                    if (session) {
                        req.sessionId = session.id || session._id;
                        if (Date.now() - new Date(session.lastActiveAt).getTime() > 2 * 60 * 1000) {
                            supabaseService.touchAuthSession(session.id || session._id).catch(() => {});
                        }
                    }
                } catch (sessErr) {
                    // Fail open on non-critical session check errors
                }
            }

            let user = null;

            if (supabaseService.isAvailable && decoded.id) {
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
            if (supabaseService.isAvailable && decoded.id) {
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
