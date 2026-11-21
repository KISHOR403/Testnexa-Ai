const express = require('express');
const router = express.Router();
const { optionalProtect } = require('../middleware/auth.middleware');
const {
    copilotRateLimiter,
    copilotChatRateLimiter,
    copilotConcurrencyLimiter,
    copilotFeedbackRateLimiter
} = require('../middleware/rateLimiter.middleware');
const {
    getContext,
    chat,
    recordFeedback,
    getFeedbackSummary,
    getSuiteContext
} = require('../controllers/copilot.controller');

// Enforce 20 KB body limit on Copilot JSON payloads
router.use(express.json({ limit: '20kb' }));

// Auth context extraction
router.use(optionalProtect);

// 1. Authoritative Context Builder (GET /api/v1/copilot/context)
router.get('/context', copilotRateLimiter, getContext);

// 2. Stateless Streaming Chat (POST /api/v1/copilot/chat)
router.post('/chat', copilotChatRateLimiter, copilotConcurrencyLimiter, chat);

// 3. User Feedback (POST /api/v1/copilot/feedback)
router.post('/feedback', copilotFeedbackRateLimiter, recordFeedback);

// 4. Admin Feedback Summary (GET /api/v1/copilot/feedback/summary)
router.get('/feedback/summary', getFeedbackSummary);

// 5. Legacy context compatibility (GET /api/v1/copilot/context/:testSuiteId)
router.get('/context/:testSuiteId', copilotRateLimiter, getSuiteContext);

module.exports = router;
