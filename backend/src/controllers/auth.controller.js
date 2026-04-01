const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/email.service');

// Helper to check DB connection
const checkConnection = () => {
    if (mongoose.connection.readyState !== 1) {
        throw new Error('DATABASE_CONNECTION_ERROR: The server is having trouble connecting to the database. Please check IP whitelisting on MongoDB Atlas.');
    }
};

// Helper to generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
        expiresIn: '30d'
    });
};

exports.generateToken = generateToken;

exports.register = async (req, res) => {
    try {
        checkConnection();
        const { name, email, password } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            name,
            displayName: name,
            email,
            password: hashedPassword,
            provider: 'email',
            isVerified: false,
            lastLogin: new Date(),
            loginCount: 1
        });

        if (user) {
            // Send welcome email to new user (and wait for it)
            await sendWelcomeEmail(name, email);

            res.status(201).json({
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    provider: user.provider,
                    createdAt: user.createdAt
                },
                token: generateToken(user._id)
            });
        }
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        checkConnection();
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user || !user.password) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Update login tracking data
        user.lastLogin = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
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
                totalTestsGenerated: user.totalTestsGenerated,
                createdAt: user.createdAt
            },
            token: generateToken(user._id)
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

        let provider = req.user.provider || 'email';
        if (!req.user.provider) {
            // Fallback for legacy users without provider field
            if (req.user.googleId) provider = 'google';
            else if (req.user.githubId) provider = 'github';
        }

        res.json({
            success: true,
            user: {
                id: req.user._id,
                name: req.user.name || req.user.displayName,
                email: req.user.email,
                avatar: req.user.avatar,
                provider,
                lastLogin: req.user.lastLogin,
                loginCount: req.user.loginCount,
                totalTestsGenerated: req.user.totalTestsGenerated,
                createdAt: req.user.createdAt
            }
        });
    } catch (error) {
        console.error('GetMe error:', error);
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

        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
