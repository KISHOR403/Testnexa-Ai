const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    getRecommendationsContext,
    generateRecommendations,
    getSuiteRecommendations,
    getRecommendationById,
    updateRecommendation,
    addRecommendationToSuite,
    convertToDrafts,
    acceptRecommendations,
    bulkAddRecommendations,
    bulkDismissRecommendations,
    undoRecommendations
} = require('../controllers/recommendations.controller');

const router = express.Router();

// All recommendations routes require authentication and workspace isolation
router.get('/context', protect, getRecommendationsContext);
router.post('/generate', protect, generateRecommendations);
router.get('/suites/:suiteId', protect, getSuiteRecommendations);
router.get('/:id', protect, getRecommendationById);
router.patch('/:id', protect, updateRecommendation);
router.post('/:id/add', protect, addRecommendationToSuite);
router.post('/convert-to-drafts', protect, convertToDrafts);
router.post('/accept', protect, acceptRecommendations);
router.post('/bulk-add', protect, bulkAddRecommendations);
router.post('/bulk-dismiss', protect, bulkDismissRecommendations);
router.post('/undo', protect, undoRecommendations);

module.exports = router;
