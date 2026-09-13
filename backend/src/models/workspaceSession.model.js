const mongoose = require('mongoose');

// Individual conversation message
const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

// Suite version snapshot
const versionSchema = new mongoose.Schema({
    versionNumber: {
        type: Number,
        required: true
    },
    suiteData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    summary: {
        total: { type: Number, default: 0 },
        functional: { type: Number, default: 0 },
        negative: { type: Number, default: 0 },
        edge: { type: Number, default: 0 },
        nonFunctional: { type: Number, default: 0 },
        apiChecklist: { type: Number, default: 0 }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const workspaceSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    generationId: {
        type: String,
        index: true,
        sparse: true
    },
    title: {
        type: String,
        default: 'Untitled Session'
    },
    status: {
        type: String,
        enum: ['Draft', 'Generated', 'NeedsReview', 'Approved', 'Archived'],
        default: 'Draft'
    },
    requirement: {
        type: String,
        default: ''
    },
    context: {
        type: String,
        enum: ['web', 'mobile', 'api'],
        default: 'web'
    },
    depth: {
        type: String,
        enum: ['Essential', 'Standard', 'Comprehensive'],
        default: 'Standard'
    },

    // Conversation messages (embedded array)
    messages: [messageSchema],

    // Current generated suite data (the full normalized result)
    suiteData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Version history snapshots
    versions: [versionSchema],
    currentVersion: {
        type: Number,
        default: 0
    },

    // Cached summary for list views (avoids loading full suiteData)
    summary: {
        total: { type: Number, default: 0 },
        functional: { type: Number, default: 0 },
        negative: { type: Number, default: 0 },
        edge: { type: Number, default: 0 },
        nonFunctional: { type: Number, default: 0 },
        apiChecklist: { type: Number, default: 0 }
    },

    // Quality metrics
    quality: {
        confidenceLevel: { type: String, default: '' },
        ambiguityScore: { type: String, default: '' },
        coverageConfidence: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
    bufferCommands: false
});

// Compound indexes for efficient user-scoped queries
workspaceSessionSchema.index({ userId: 1, updatedAt: -1 });
workspaceSessionSchema.index({ userId: 1, status: 1 });
workspaceSessionSchema.index({ userId: 1, context: 1 });

// Text index for search across title and requirement
workspaceSessionSchema.index({ title: 'text', requirement: 'text' });

module.exports = mongoose.model('WorkspaceSession', workspaceSessionSchema);
