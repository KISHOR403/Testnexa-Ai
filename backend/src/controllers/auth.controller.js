const User = require('../models/user.model');
const AuthSession = require('../models/authSession.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/email.service');
const { parseUserAgent, parseClientIp, getLocationFromIp } = require('../utils/deviceParser');
const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');

// Helper to check DB connection
const checkConnection = () => {
    if (mongoose.connection.readyState !== 1 && !supabaseService.isAvailable) {
        throw new Error('DATABASE_CONNECTION_ERROR: The server is having trouble connecting to the database. Please check IP whitelisting on MongoDB Atlas or Supabase configuration.');
    }
};

// Helper to generate JWT with optional sessionId
const generateToken = (id, sessionId) => {
    const payload = { id };
    if (sessionId) {
        payload.sessionId = sessionId.toString();
    }
    return jwt.sign(payload, process.env.JWT_SECRET || 'secret123', {
        expiresIn: '30d'
    });
};

// Helper to create an active user AuthSession
const createAuthSession = async (userId, req) => {
    try {
        if (mongoose.connection.readyState !== 1) return null;
        const userAgent = req?.headers ? (req.headers['user-agent'] || '') : '';
        const ipAddress = parseClientIp(req);
        const { browser, os, deviceDisplay } = parseUserAgent(userAgent);
        const location = getLocationFromIp(ipAddress);
        const sessionIdentifier = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const session = await AuthSession.create({
            userId,
            sessionIdentifier,
            device: deviceDisplay,
            browser,
            os,
            userAgent,
            ipAddress,
            location,
            lastActiveAt: new Date(),
            expiresAt
        });

        return session;
    } catch (err) {
        console.error('Failed to create AuthSession:', err);
        return null;
    }
};

exports.generateToken = generateToken;
exports.createAuthSession = createAuthSession;

exports.register = async (req, res) => {
    try {
        checkConnection();
        const { name, email, password } = req.body;
        const now = new Date();

        // 1. Check if user exists in either database
        let userExists = false;
        if (supabaseService.isAvailable) {
            const sbCheck = await supabaseService.findUserByEmail(email);
            if (sbCheck) userExists = true;
        }
        if (!userExists && mongoose.connection.readyState === 1) {
            const mongoCheck = await User.findOne({ email });
            if (mongoCheck) userExists = true;
        }

        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let createdUserId = null;
        let createdUser = null;

        // 2. Save to Supabase (if available)
        if (supabaseService.isAvailable) {
            try {
                const sbUser = await supabaseService.createUser({
                    name,
                    displayName: name,
                    email,
                    password: hashedPassword,
                    provider: 'email',
                    isVerified: false
                });
                createdUserId = sbUser.id;
                createdUser = {
                    id: sbUser.id,
                    _id: sbUser.id,
                    name: sbUser.name,
                    email: sbUser.email,
                    avatar: sbUser.avatar,
                    provider: sbUser.provider,
                    createdAt: sbUser.created_at
                };
            } catch (sbErr) {
                logger.error('Supabase register error:', sbErr);
            }
        }

        // 3. Also Save to MongoDB (if connected)
        if (mongoose.connection.readyState === 1) {
            try {
                const mongoData = {
                    name,
                    displayName: name,
                    email,
                    password: hashedPassword,
                    provider: 'email',
                    isVerified: false,
                    lastLogin: now,
                    loginCount: 1,
                    passwordChangedAt: now,
                    welcomeEmailSent: true
                };
                if (createdUserId && mongoose.Types.ObjectId.isValid(createdUserId)) {
                    mongoData._id = createdUserId;
                }
                const mUser = await User.create(mongoData);
                if (!createdUser) {
                    createdUserId = mUser._id;
                    createdUser = {
                        id: mUser._id,
                        _id: mUser._id,
                        name: mUser.name,
                        email: mUser.email,
                        avatar: mUser.avatar,
                        provider: mUser.provider,
                        createdAt: mUser.createdAt
                    };
                }
            } catch (mongoErr) {
                logger.warn('MongoDB register sync error:', mongoErr.message);
            }
        }

        if (!createdUser) {
            return res.status(500).json({ success: false, message: 'Failed to create user account in database' });
        }

        // Active session & token
        const session = await createAuthSession(createdUserId, req);
        const token = generateToken(createdUserId, session?._id);

        // Send welcome email to new user asynchronously
        sendWelcomeEmail(name, email).catch(e => logger.error('Welcome email error:', e?.message || e));

        return res.status(201).json({
            success: true,
            user: createdUser,
            token
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        checkConnection();
        const { email, password } = req.body;
        const now = new Date();

        let matchedUser = null;
        let userSource = null;

        // 1. Try Supabase lookup
        if (supabaseService.isAvailable) {
            try {
                const sbUser = await supabaseService.findUserByEmail(email);
                if (sbUser && sbUser.password) {
                    const isMatch = await bcrypt.compare(password, sbUser.password);
                    if (isMatch) {
                        matchedUser = sbUser;
                        userSource = 'supabase';
                    }
                }
            } catch (sbErr) {
                logger.error('Supabase login check error:', sbErr);
            }
        }

        // 2. Try MongoDB lookup if not matched yet
        if (!matchedUser && mongoose.connection.readyState === 1) {
            try {
                const mongoUser = await User.findOne({ email });
                if (mongoUser && mongoUser.password) {
                    const isMatch = await bcrypt.compare(password, mongoUser.password);
                    if (isMatch) {
                        matchedUser = mongoUser;
                        userSource = 'mongodb';
                    }
                }
            } catch (mongoErr) {
                logger.warn('MongoDB login check error:', mongoErr.message);
            }
        }

        if (!matchedUser) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // 3. Update both databases
        const userId = matchedUser.id || matchedUser._id;
        const newLoginCount = (matchedUser.login_count || matchedUser.loginCount || 0) + 1;

        if (supabaseService.isAvailable) {
            if (userSource === 'supabase') {
                await supabaseService.updateUser(userId, {
                    last_login: now.toISOString(),
                    login_count: newLoginCount
                }).catch(() => {});
            } else {
                // User was in MongoDB only, sync them to Supabase!
                await supabaseService.createUser({
                    id: userId.toString(),
                    email: matchedUser.email,
                    password: matchedUser.password,
                    name: matchedUser.name || matchedUser.displayName,
                    displayName: matchedUser.displayName || matchedUser.name,
                    avatar: matchedUser.avatar,
                    provider: matchedUser.provider || 'email',
                    isVerified: !!matchedUser.isVerified
                }).catch(() => {});
            }
        }

        if (mongoose.connection.readyState === 1) {
            try {
                await User.findOneAndUpdate(
                    { email },
                    { $set: { lastLogin: now }, $inc: { loginCount: 1 } }
                );
            } catch (mErr) {}
        }

        const session = await createAuthSession(userId, req);
        const token = generateToken(userId, session?._id);

        return res.json({
            success: true,
            user: {
                id: userId,
                _id: userId,
                name: matchedUser.name || matchedUser.display_name || matchedUser.displayName,
                email: matchedUser.email,
                avatar: matchedUser.avatar,
                provider: matchedUser.provider || 'email',
                lastLogin: now,
                loginCount: newLoginCount,
                totalTestsGenerated: matchedUser.total_tests_generated || matchedUser.totalTestsGenerated || 0,
                createdAt: matchedUser.created_at || matchedUser.createdAt
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMe = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userId = req.user.id || req.user._id;
        let provider = req.user.provider || 'email';
        if (!req.user.provider) {
            if (req.user.googleId) provider = 'google';
            else if (req.user.githubId) provider = 'github';
        }

        res.json({
            success: true,
            user: {
                id: userId,
                name: req.user.name || req.user.displayName,
                email: req.user.email,
                avatar: req.user.avatar,
                provider,
                lastLogin: req.user.lastLogin,
                loginCount: req.user.loginCount,
                passwordChangedAt: req.user.passwordChangedAt,
                totalTestsGenerated: req.user.totalTestsGenerated || 0,
                createdAt: req.user.createdAt
            }
        });
    } catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        // 1. Invalidate session in DB if sessionId is present
        if (req.sessionId && mongoose.connection.readyState === 1) {
            await AuthSession.findByIdAndUpdate(req.sessionId, { revokedAt: new Date() });
        } else if (req.user?._id && mongoose.connection.readyState === 1) {
            // Revoke current user's active session
            await AuthSession.updateMany(
                { userId: req.user._id, revokedAt: null },
                { revokedAt: new Date() }
            );
        }

        // 2. Clear Passport & Express session cleanly
        if (typeof req.logout === 'function') {
            req.logout({ keepSessionInfo: false }, (err) => {
                if (req.session) {
                    try { req.session.destroy(() => {}); } catch (e) {}
                }
            });
        } else if (req.session) {
            try { req.session.destroy(() => {}); } catch (e) {}
        }

        // 4. Clear auth cookie
        res.clearCookie('connect.sid', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.json({
            success: true,
            message: 'Logged out with warnings'
        });
    }
};

exports.listSessions = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, sessions: [] });
        }

        const sessions = await AuthSession.find({
            userId: req.user._id,
            revokedAt: null,
            expiresAt: { $gt: new Date() }
        }).sort({ lastActiveAt: -1 });

        const currentSessionId = req.sessionId ? req.sessionId.toString() : null;

        const formattedSessions = sessions.map(s => ({
            id: s._id,
            device: s.device,
            browser: s.browser,
            os: s.os,
            ipAddress: s.ipAddress,
            location: s.location,
            lastActiveAt: s.lastActiveAt,
            createdAt: s.createdAt,
            isCurrent: currentSessionId ? (s._id.toString() === currentSessionId) : false
        }));

        // If no session explicitly matched (e.g. legacy token), mark the first/most recent as current
        if (formattedSessions.length > 0 && !formattedSessions.some(s => s.isCurrent)) {
            formattedSessions[0].isCurrent = true;
        }

        res.json({
            success: true,
            sessions: formattedSessions
        });
    } catch (error) {
        console.error('List sessions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.revokeSession = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ success: false, message: 'Database connection unavailable' });
        }

        const { sessionId } = req.params;
        const session = await AuthSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        // Ownership enforcement: Authenticated user must own the session
        if (session.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to revoke this session' });
        }

        session.revokedAt = new Date();
        await session.save();

        // If user is revoking their own current session, clear passport/express sessions
        if (req.sessionId && req.sessionId.toString() === sessionId.toString()) {
            if (typeof req.logout === 'function') {
                req.logout({ keepSessionInfo: false }, () => {
                    if (req.session) {
                        try { req.session.destroy(() => {}); } catch (e) {}
                    }
                });
            } else if (req.session) {
                try { req.session.destroy(() => {}); } catch (e) {}
            }
            res.clearCookie('connect.sid', { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        }

        res.json({
            success: true,
            message: 'Session revoked successfully'
        });
    } catch (error) {
        console.error('Revoke session error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.revokeOtherSessions = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ success: false, message: 'Database connection unavailable' });
        }

        const filter = {
            userId: req.user._id,
            revokedAt: null
        };

        if (req.sessionId) {
            filter._id = { $ne: req.sessionId };
        }

        const result = await AuthSession.updateMany(
            filter,
            { revokedAt: new Date() }
        );

        res.json({
            success: true,
            message: 'All other sessions revoked successfully',
            revokedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Revoke other sessions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        checkConnection();
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'There is no user with that email' });
        }

        // Generate token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Hash token and set to resetPasswordToken field
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Set expire (15 minutes)
        user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

        await user.save();

        // Create reset URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

        try {
            const emailResult = await sendPasswordResetEmail(user.email, resetUrl);
            if (!emailResult || !emailResult.success) {
                user.resetPasswordToken = undefined;
                user.resetPasswordExpire = undefined;
                await user.save();
                return res.status(500).json({ success: false, message: 'Email could not be sent' });
            }

            res.status(200).json({ success: true, message: 'Email sent successfully' });
        } catch (err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();
            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        checkConnection();
        
        // Get hashed token
        const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        // Set new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
        user.passwordChangedAt = new Date();

        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        // Invalidate all existing sessions on password reset for security
        await AuthSession.updateMany(
            { userId: user._id, revokedAt: null },
            { revokedAt: new Date() }
        );

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        checkConnection();
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
        const { name } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (name && name.trim()) {
            user.name = name.trim();
            user.displayName = name.trim();
        }
        await user.save();
        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name || user.displayName,
                email: user.email,
                avatar: user.avatar,
                provider: user.provider || 'email',
                lastLogin: user.lastLogin,
                loginCount: user.loginCount,
                passwordChangedAt: user.passwordChangedAt,
                totalTestsGenerated: user.totalTestsGenerated,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        checkConnection();
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.password) {
            if (!currentPassword) {
                return res.status(400).json({ success: false, message: 'Please provide your current password' });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'Current password is incorrect' });
            }
        }
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.passwordChangedAt = new Date();
        await user.save();

        // Invalidate all other active sessions upon password change for security
        const filter = { userId: user._id, revokedAt: null };
        if (req.sessionId) filter._id = { $ne: req.sessionId };
        await AuthSession.updateMany(filter, { revokedAt: new Date() });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
