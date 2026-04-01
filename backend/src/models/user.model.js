const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    githubId: {
        type: String,
        unique: true,
        sparse: true
    },
    displayName: {
        type: String,
        required: false
    },
    name: {
        type: String,
        required: false
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: false // Optional for OAuth users
    },
    avatar: {
        type: String,
        default: null
    },
    provider: {
        type: String,
        enum: ['email', 'google', 'github'],
        default: 'email'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: null
    },
    loginCount: {
        type: Number,
        default: 0
    },
    totalTestsGenerated: {
        type: Number,
        default: 0
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, {
    timestamps: true, // Automatically adds createdAt and updatedAt
    bufferCommands: false // Disable buffering to avoid timeouts when DB is down
});

module.exports = mongoose.model('User', userSchema);
