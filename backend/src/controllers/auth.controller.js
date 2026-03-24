const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

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
            password: hashedPassword
        });

        if (user) {
            res.status(201).json({
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
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

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name || user.displayName,
                email: user.email
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

        let provider = 'Email';
        if (req.user.googleId) provider = 'Google';
        else if (req.user.githubId) provider = 'GitHub';

        res.json({
            success: true,
            user: {
                id: req.user._id,
                name: req.user.name || req.user.displayName,
                email: req.user.email,
                avatar: req.user.avatar,
                provider
            }
        });
    } catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
