const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/user.model');

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
                    req.user = { _id: decoded.id, isTemporary: true, displayName: 'Guest User' };
                    return next();
                }
                throw new Error('Database not connected');
            }

            req.user = await User.findById(decoded.id).select('-password');
            next();
        } catch (error) {
            console.error('Auth check error:', error);
            res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};
