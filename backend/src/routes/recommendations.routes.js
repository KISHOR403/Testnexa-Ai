const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    getRecommendationsContext,
    generateRecommendations,
    getSuiteRecommendations,
    getRecommendationById,
    updateRecommendation,
    convertToDrafts,
    acceptRecommendations,
    undoRecommendations
} = require('../controllers/recommendations.controller');

const router = express.Router();

// All recommendations routes require authentication and workspace isolation
router.get('/context', protect, getRecommendationsContext);
router.post('/generate', protect, generateRecommendations);
router.get('/suites/:suiteId', protect, getSuiteRecommendations);
router.get('/:id', protect, getRecommendationById);
router.patch('/:id', protect, updateRecommendation);
router.post('/convert-to-drafts', protect, convertToDrafts);
router.post('/accept', protect, acceptRecommendations);
router.post('/undo', protect, undoRecommendations);

module.exports = router;


