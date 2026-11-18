/**
 * Testnexa AI — Support Routes
 * Mounts POST /api/v1/support/requests with 20KB body limit and rate limiting.
 */

const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');
const { optionalProtect } = require('../middleware/auth.middleware');
const { supportRateLimiter } = require('../middleware/rateLimiter.middleware');

// Strict body limit: 20 KB
const strictJsonLimit = express.json({ limit: '20kb' });

router.post(
    '/requests',
    strictJsonLimit,
    supportRateLimiter,
    optionalProtect,
    supportController.submitSupportRequest
);

module.exports = router;
