const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.Mixed,
        ref: 'User',
        required: true,
        index: true
    },
    sessionIdentifier: {
        type: String,
        required: true,
        index: true
    },
    device: {
        type: String,
        default: 'Unknown Device'
    },
    browser: {
        type: String,
        default: 'Unknown Browser'
    },
    os: {
        type: String,
        default: 'Unknown OS'
    },
    userAgent: {
        type: String,
        default: ''
    },
    ipAddress: {
        type: String,
        default: 'Unknown IP'
    },
    location: {
        type: String,
        default: 'Local Network'
    },
    lastActiveAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    revokedAt: {
        type: Date,
        default: null,
        index: true
    }
}, {
    timestamps: true,
    bufferCommands: false
});

// Compound indexes for fast user-specific active session querying
authSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
authSessionSchema.index({ userId: 1, lastActiveAt: -1 });

module.exports = mongoose.model('AuthSession', authSessionSchema);
