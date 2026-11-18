/**
 * Testnexa AI — Help Center Routes
 * Feedback collection, search miss analytics, and admin summary.
 */

const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');
const { protect, optionalProtect, requireAdmin } = require('../middleware/auth.middleware');
const { helpFeedbackRateLimiter, helpSearchMissRateLimiter } = require('../middleware/rateLimiter.middleware');

router.post(
    '/feedback',
    helpFeedbackRateLimiter,
    optionalProtect,
    supportController.submitArticleFeedback
);

router.post(
    '/search-misses',
    helpSearchMissRateLimiter,
    supportController.submitSearchMiss
);

router.get(
    '/admin-summary',
    protect,
    requireAdmin,
    supportController.getAdminSummary
);

module.exports = router;
