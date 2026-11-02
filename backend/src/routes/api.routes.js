const express = require('express');
const {
    generateTestCases,
    getTestHistory,
    getGenerationStatus,
    analyzeRequirement,
    regenerateSingleTestCase
} = require('../controllers/generate.controller');
const { submitContact } = require('../controllers/contact.controller');
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const { contactRateLimiter } = require('../middleware/rateLimiter.middleware');

const router = express.Router();

// POST /api/v1/generate/analyze - Analyze requirement before generation (requires auth)
router.post('/generate/analyze', protect, analyzeRequirement);
router.post('/generations/analyze', protect, analyzeRequirement);

// POST /api/v1/generate/regenerate-case - Regenerate individual test case (requires auth)
router.post('/generate/regenerate-case', protect, regenerateSingleTestCase);

// POST /api/v1/generate - Generate test cases (strictly protected: requires valid authenticated session)
router.post('/generate', protect, generateTestCases);
router.post('/generations', protect, generateTestCases);

// GET /api/v1/generations/:id - Get generation status (strictly protected)
router.get('/generations/:id', protect, getGenerationStatus);

// GET /api/v1/history - Get test generation history (requires auth)
router.get('/history', protect, getTestHistory);

// POST /api/v1/contact - Public contact & support form with spam protection & rate limiting
router.post('/contact', contactRateLimiter, submitContact);

module.exports = router;

