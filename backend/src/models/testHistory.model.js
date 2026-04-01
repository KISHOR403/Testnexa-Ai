const mongoose = require('mongoose');

const testHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    requirement: {
        type: String,
        required: true
    },
    appType: {
        type: String,
        default: 'web'
    },
    detailLevel: {
        type: String,
        default: 'standard'
    },
    testFocus: {
        type: String,
        default: 'mixed'
    },
    feature: {
        type: String,
        default: ''
    },
    summary: {
        total: { type: Number, default: 0 },
        functional: { type: Number, default: 0 },
        negative: { type: Number, default: 0 },
        edge: { type: Number, default: 0 },
        nonFunctional: { type: Number, default: 0 },
        apiChecklist: { type: Number, default: 0 }
    },
    quality: {
        confidenceLevel: { type: String, default: '' },
        ambiguityScore: { type: String, default: '' }
    },
    processingTime: {
        type: String,
        default: ''
    },
    model: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Index for efficient queries
testHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('TestHistory', testHistorySchema);
