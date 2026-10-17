const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/email.service');
const { parseUserAgent, parseClientIp, getLocationFromIp } = require('../utils/deviceParser');
const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');

// Helper to check DB connection
const checkConnection = () => {
    if (!supabaseService.isAvailable) {
        throw new Error('DATABASE_CONNECTION_ERROR: The server is having trouble connecting to Supabase. Please check your Supabase configuration.');
    }
};

// Password Complexity Policy: At least 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character
const validatePasswordStrength = (password) => {
    if (!password || typeof password !== 'string') {
        return { valid: false, message: 'Password is required.' };
    }
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters.' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter.' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter.' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number.' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one special character.' };
    }
    return { valid: true };
};

const sanitizeEmail = (email) => {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
};

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Helper to generate JWT with optional sessionId & rememberMe duration
const generateToken = (id, sessionId, rememberMe = true) => {
    const payload = { id };
    if (sessionId) {
        payload.sessionId = sessionId.toString();
    }
    return jwt.sign(payload, process.env.JWT_SECRET || 'secret123', {
        expiresIn: rememberMe ? '30d' : '1d'
    });
};

// Helper to create an active user AuthSession with rememberMe persistence
const createAuthSession = async (userId, req, rememberMe = true) => {
    try {
        const userAgent = req?.headers ? (req.headers['user-agent'] || '') : '';
        const ipAddress = parseClientIp(req);
        const { browser, os, deviceDisplay } = parseUserAgent(userAgent);
        const location = getLocationFromIp(ipAddress);
        const durationDays = rememberMe ? 30 : 1;
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

        const session = await supabaseService.createAuthSession({
            userId,
            device: deviceDisplay,
            browser,
            os,
            userAgent,
            ipAddress,
            location,
            expiresAt
        });

        return session;
    } catch (err) {
        logger.error('Failed to create AuthSession:', err);
        return null;
    }
};

exports.validatePasswordStrength = validatePasswordStrength;
exports.sanitizeEmail = sanitizeEmail;
exports.isValidEmail = isValidEmail;
exports.generateToken = generateToken;
exports.createAuthSession = createAuthSession;

exports.register = async (req, res) => {
    try {
        checkConnection();
        const cleanName = (req.body.name || '').trim();
        const cleanEmail = sanitizeEmail(req.body.email);
        const password = req.body.password;

        if (!cleanName || cleanName.length < 2) {
            return res.status(400).json({ success: false, message: 'Please enter your full name (at least 2 characters).' });
        }

        if (!cleanEmail || !isValidEmail(cleanEmail)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        }

        const pwdCheck = validatePasswordStrength(password);
        if (!pwdCheck.valid) {
            return res.status(400).json({ success: false, message: pwdCheck.message });
        }

        // 1. Check if user exists in Supabase
        const existingUser = await supabaseService.findUserByEmail(cleanEmail);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Create user in Supabase
        const sbUser = await supabaseService.createUser({
            name: cleanName,
            displayName: cleanName,
            email: cleanEmail,
            password: hashedPassword,
            provider: 'email',
            isVerified: false
        });

        const createdUser = {
            id: sbUser.id,
            _id: sbUser.id,
            name: sbUser.name,
            email: sbUser.email,
            avatar: sbUser.avatar,
            provider: sbUser.provider,
            createdAt: sbUser.created_at
        };

        // Active session & token
        const session = await createAuthSession(sbUser.id, req);
        const token = generateToken(sbUser.id, session?.id || session?._id);

        // Send welcome email to new user asynchronously
        sendWelcomeEmail(cleanName, cleanEmail).catch(e => logger.error('Welcome email error:', e?.message || e));

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
        const { email, password, rememberMe = false } = req.body;
        const cleanEmail = sanitizeEmail(email);
        const now = new Date();

        if (!cleanEmail || !password) {
            return res.status(400).json({ success: false, message: 'Please enter your email and password.' });
        }

        // 1. Query Supabase
        const user = await supabaseService.findUserByEmail(cleanEmail);
        if (!user || !user.password) {
            return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
        }

        // 2. Update user stats in Supabase
        const newLoginCount = (user.login_count || 0) + 1;
        await supabaseService.updateUser(user.id, {
            last_login: now.toISOString(),
            login_count: newLoginCount
        }).catch(() => {});

        const isPersistent = Boolean(rememberMe);
        const session = await createAuthSession(user.id, req, isPersistent);
        const token = generateToken(user.id, session?.id || session?._id, isPersistent);

        return res.json({
            success: true,
            user: {
                id: user.id,
                _id: user.id,
                name: user.name || user.display_name,
                email: user.email,
                avatar: user.avatar,
                provider: user.provider || 'email',
                lastLogin: now,
                loginCount: newLoginCount,
                totalTestsGenerated: user.total_tests_generated || 0,
                createdAt: user.created_at
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
                _id: userId,
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
        const userId = req.user?.id || req.user?._id;

        // 1. Invalidate session in Supabase
        if (req.sessionId) {
            await supabaseService.revokeAuthSession(req.sessionId, userId);
        } else if (userId) {
            await supabaseService.revokeOtherAuthSessions(userId, null);
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

        // 3. Clear auth cookie
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
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const sessions = await supabaseService.listAuthSessions(userId);
        const currentSessionId = req.sessionId ? req.sessionId.toString() : null;

        const formattedSessions = sessions.map(s => ({
            id: s.id || s._id,
            device: s.device,
            browser: s.browser,
            os: s.os,
            ipAddress: s.ipAddress,
            location: s.location,
            lastActiveAt: s.lastActiveAt,
            createdAt: s.createdAt,
            isCurrent: currentSessionId ? ((s.id || s._id).toString() === currentSessionId) : false
        }));

        if (formattedSessions.length > 0 && !formattedSessions.some(s => s.isCurrent)) {
            formattedSessions[0].isCurrent = true;
        } else if (formattedSessions.length === 0) {
            const userAgent = req.headers['user-agent'] || 'Mozilla/5.0';
            const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
            let device = 'Desktop Browser (Chrome / Windows)';
            let browser = 'Chrome';
            let os = 'Windows';
            if (/iphone|ipad|ipod/i.test(userAgent)) {
                device = 'Apple iPhone';
                browser = 'Mobile Safari';
                os = 'iOS';
            } else if (/android/i.test(userAgent)) {
                device = 'Android Device';
                browser = 'Chrome Mobile';
                os = 'Android';
            } else if (/mac/i.test(userAgent)) {
                device = 'MacBook / macOS';
                os = 'macOS';
            } else if (/linux/i.test(userAgent)) {
                device = 'Linux Desktop';
                os = 'Linux';
            }

            formattedSessions.push({
                id: 'sess_' + (req.sessionId || 'curr_local'),
                device,
                browser,
                os,
                ipAddress: ip === '::1' ? '127.0.0.1' : ip,
                location: 'Current Session',
                lastActiveAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                isCurrent: true
            });
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
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const { sessionId } = req.params;
        const session = await supabaseService.getAuthSession(sessionId);

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        if (session.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to revoke this session' });
        }

        await supabaseService.revokeAuthSession(sessionId, userId);

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
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const revokedCount = await supabaseService.revokeOtherAuthSessions(userId, req.sessionId);

        res.json({
            success: true,
            message: 'All other sessions revoked successfully',
            revokedCount
        });
    } catch (error) {
        console.error('Revoke other sessions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        checkConnection();
        const cleanEmail = sanitizeEmail(req.body.email);

        if (!cleanEmail || !isValidEmail(cleanEmail)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        }

        const user = await supabaseService.findUserByEmail(cleanEmail);
        const genericSuccessMessage = "If an account exists for this email, we'll send a password reset link.";

        if (!user) {
            return res.status(200).json({ success: true, message: genericSuccessMessage });
        }

        // Generate secure token
        const resetToken = crypto.randomBytes(20).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await supabaseService.setResetPasswordToken(cleanEmail, tokenHash, expiresAt);

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

        try {
            await sendPasswordResetEmail(user.email, resetUrl);
            res.status(200).json({ success: true, message: genericSuccessMessage });
        } catch (err) {
            await supabaseService.clearResetPasswordToken(user.id);
            return res.status(500).json({ success: false, message: 'Could not send reset email. Please try again later.' });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        checkConnection();

        const pwdCheck = validatePasswordStrength(req.body.password);
        if (!pwdCheck.valid) {
            return res.status(400).json({ success: false, message: pwdCheck.message });
        }

        const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await supabaseService.findUserByResetToken(resetPasswordToken);

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired password reset link.' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);

        await supabaseService.updatePassword(user.id, hashedPassword);
        await supabaseService.clearResetPasswordToken(user.id);

        // Invalidate all active sessions for security
        await supabaseService.revokeOtherAuthSessions(user.id, null);

        res.status(200).json({
            success: true,
            message: 'Password updated successfully.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        checkConnection();
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const { name } = req.body;
        const cleanName = (name || '').trim();

        const updated = await supabaseService.updateProfile(userId, {
            name: cleanName,
            displayName: cleanName
        });

        res.json({
            success: true,
            user: {
                id: updated.id,
                _id: updated.id,
                name: updated.name || updated.display_name,
                email: updated.email,
                avatar: updated.avatar,
                provider: updated.provider || 'email',
                lastLogin: updated.last_login,
                loginCount: updated.login_count,
                passwordChangedAt: updated.password_changed_at,
                totalTestsGenerated: updated.total_tests_generated || 0,
                createdAt: updated.created_at
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
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }

        const user = await supabaseService.findUserById(userId);
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
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await supabaseService.updatePassword(userId, hashedPassword);
        await supabaseService.revokeOtherAuthSessions(userId, req.sessionId);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteAccount = async (req, res) => {
    try {
        checkConnection();
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const user = await supabaseService.findUserById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { confirmationText, password, reason, feedback } = req.body || {};

        // Validate reason is provided
        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Please select a reason for deleting your account.'
            });
        }

        // If email password user, check password if provided
        if (user.password && password) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'Password verification failed. Account deletion aborted.' });
            }
        }

        // Verify explicit textual confirmation
        const cleanConfirm = (confirmationText || '').trim().toUpperCase();
        if (cleanConfirm !== 'DELETE' && cleanConfirm !== (user.email || '').trim().toUpperCase()) {
            return res.status(400).json({
                success: false,
                message: 'Please type "DELETE" or your exact account email to confirm account deletion.'
            });
        }

        logger.warn('User requested permanent account deletion with exit survey', {
            userId,
            email: user.email,
            reason: reason.trim(),
            feedback: (feedback || '').trim(),
            deletedAt: new Date().toISOString()
        });

        // Perform cascading deletion
        await supabaseService.deleteUser(userId);

        logger.info('Account deleted successfully via settings request', {
            userId,
            email: user.email,
            reason: reason.trim()
        });

        // Clear session cookies if present
        res.clearCookie('token');
        res.clearCookie('testnexa_session');

        return res.json({
            success: true,
            message: 'Your account and all associated test suites have been permanently deleted.'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'An error occurred while deleting your account. Please try again or contact support@testnexa.ai.'
        });
    }
};
