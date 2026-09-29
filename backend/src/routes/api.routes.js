const express = require('express');
const { generateTestCases, getTestHistory, getGenerationStatus } = require('../controllers/generate.controller');
const { submitContact } = require('../controllers/contact.controller');
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const { contactRateLimiter } = require('../middleware/rateLimiter.middleware');

const router = express.Router();

// POST /api/v1/generate - Generate test cases (optional auth to save history)
router.post('/generate', optionalProtect, generateTestCases);
router.post('/generations', optionalProtect, generateTestCases);

// GET /api/v1/generations/:id - Get generation status
router.get('/generations/:id', optionalProtect, getGenerationStatus);

// GET /api/v1/history - Get test generation history (requires auth)
router.get('/history', protect, getTestHistory);

// POST /api/v1/contact - Public contact & support form with spam protection & rate limiting
router.post('/contact', contactRateLimiter, submitContact);

module.exports = router;

