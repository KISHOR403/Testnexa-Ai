const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    getMaintenanceOverview,
    getFindingById,
    updateFinding,
    analyzeFindingWithAI
} = require('../controllers/maintenance.controller');

const router = express.Router();

router.get('/overview', protect, getMaintenanceOverview);
router.get('/findings/:id', protect, getFindingById);
router.patch('/findings/:id', protect, updateFinding);
router.post('/findings/:id/ai-analyze', protect, analyzeFindingWithAI);

module.exports = router;

