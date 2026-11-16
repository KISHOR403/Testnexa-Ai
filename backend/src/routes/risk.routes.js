const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { authExportRateLimiter } = require('../middleware/rateLimiter.middleware');
const riskController = require('../controllers/risk.controller');

const router = express.Router();

router.use(protect);

// Summary, Matrix, and Export routes (mounted before /:id)
router.get('/summary', riskController.getSummary);
router.get('/matrix', riskController.getMatrix);
router.get('/export', authExportRateLimiter, riskController.exportRisks);
router.get('/execution-failures', riskController.getExecutionFailures);

// Core CRUD & Linkage
router.get('/', riskController.listRisks);
router.post('/', riskController.createRisk);
router.get('/:id', riskController.getRiskById);
router.patch('/:id', riskController.updateStatus);
router.post('/:id/tests', riskController.linkTests);
router.delete('/:id/tests/:testCaseId', riskController.unlinkTest);

module.exports = router;
