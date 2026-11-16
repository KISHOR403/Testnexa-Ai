const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { requireFeature } = require('../middleware/featureFlag.middleware');
const {
    getMaintenanceOverview,
    getFindingById,
    updateFinding,
    analyzeFindingWithAI
} = require('../controllers/maintenance.controller');

const router = express.Router();

router.use(protect);
router.use(requireFeature('testRuns'));

router.get('/overview', getMaintenanceOverview);
router.get('/findings/:id', getFindingById);
router.patch('/findings/:id', updateFinding);
router.post('/findings/:id/ai-analyze', analyzeFindingWithAI);

module.exports = router;

