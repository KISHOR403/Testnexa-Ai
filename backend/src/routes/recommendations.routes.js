const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    generateRecommendations,
    getSuiteRecommendations,
    getRecommendationById,
    updateRecommendation,
    convertToDrafts
} = require('../controllers/recommendations.controller');

const router = express.Router();

// All recommendations routes require authentication and workspace isolation
router.post('/generate', protect, generateRecommendations);
router.get('/suites/:suiteId', protect, getSuiteRecommendations);
router.get('/:id', protect, getRecommendationById);
router.patch('/:id', protect, updateRecommendation);
router.post('/convert-to-drafts', protect, convertToDrafts);

module.exports = router;
