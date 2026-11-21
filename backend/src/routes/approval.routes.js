/**
 * Testnexa AI — Approvals & Undo Routes
 * Mounts on:
 *   /api/v1/approvals
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const caseReviewController = require('../controllers/caseReview.controller');

const router = express.Router();

// Step 3: Undo approvals within 10-minute window
router.post('/undo', protect, caseReviewController.undoApproval);

module.exports = router;
