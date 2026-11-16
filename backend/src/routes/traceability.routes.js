const express = require('express');
const { optionalProtect } = require('../middleware/auth.middleware');
const traceabilityController = require('../controllers/traceability.controller');

const router = express.Router();

// Traceability routes support authenticated workspace users, guest sessions, and public/shared queries
router.use(optionalProtect);

router.get('/suites', traceabilityController.listSuites);
router.get('/summary', traceabilityController.getSummary);
router.get('/gaps', traceabilityController.getGaps);
router.get('/matrix', traceabilityController.getMatrix);
router.get('/requirements', traceabilityController.getRequirements);
router.put('/requirements/:id', traceabilityController.updateRequirement);
router.get('/export/:format', traceabilityController.exportReport);

module.exports = router;
