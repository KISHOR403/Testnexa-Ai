/**
 * TestNexa AI — Quality Insights & Advanced Test Analytics Routes
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const qualityInsightsController = require('../controllers/qualityInsights.controller');

const router = express.Router();

// All analytics routes require authentication
router.use(protect);

// Consolidated overview
router.get('/overview', qualityInsightsController.getOverview);

// Individual metric telemetry endpoints
router.get('/health', qualityInsightsController.getHealth);
router.get('/trends', qualityInsightsController.getTrends);
router.get('/failures', qualityInsightsController.getFailures);
router.get('/flaky', qualityInsightsController.getFlaky);
router.get('/suite-comparison', qualityInsightsController.getSuiteComparison);

// AI-assisted quality insights (with quota metering)
router.post('/ai-insights', qualityInsightsController.generateAIInsights);

// Export (CSV report)
router.get('/export', qualityInsightsController.exportCSV);

module.exports = router;
