/**
 * Testnexa AI — Requirements Management Routes
 * Mounts on:
 *   /api/v1/requirements
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const caseReviewController = require('../controllers/caseReview.controller');

const router = express.Router();

router.post('/', protect, caseReviewController.createRequirement);
router.get('/:id', protect, caseReviewController.getRequirement);
router.patch('/:id', protect, caseReviewController.updateRequirement);
router.delete('/:id', protect, caseReviewController.deleteRequirement);

// Requirement <-> Test Case links
router.post('/:id/tests', protect, caseReviewController.linkRequirementCase);
router.delete('/:id/tests/:caseId', protect, caseReviewController.unlinkRequirementCase);

module.exports = router;
