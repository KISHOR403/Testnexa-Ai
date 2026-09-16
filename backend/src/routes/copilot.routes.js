const express = require('express');
const router = express.Router();
const { optionalProtect } = require('../middleware/auth.middleware');
const { copilotRateLimiter } = require('../middleware/rateLimiter.middleware');
const {
    analyzeSuite,
    addSuggestedtestCase,
    applyTestImprovement,
    getSuiteContext
} = require('../controllers/copilot.controller');

// Apply authentication extraction and rate limiter
router.use(optionalProtect);
router.use(copilotRateLimiter);

// 1. Context-aware Copilot Analysis
router.post('/analyze', analyzeSuite);

// 2. Human-in-the-loop Action: Add suggested test case
router.post('/actions/add-test', addSuggestedtestCase);

// 3. Human-in-the-loop Action: Improve existing test case
router.post('/actions/improve-test', applyTestImprovement);

// 4. Compact Context Retrieval
router.get('/context/:testSuiteId', getSuiteContext);

module.exports = router;
