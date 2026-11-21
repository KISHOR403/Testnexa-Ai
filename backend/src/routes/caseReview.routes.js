/**
 * Testnexa AI — Case Review & Versioning Routes
 * Mounts on:
 *   /api/v1/cases
 *   /api/v1/test-cases
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const caseReviewController = require('../controllers/caseReview.controller');
const testCaseController = require('../controllers/testCase.controller');

const router = express.Router();

// Existing test case listing and retrieval
router.get('/', protect, testCaseController.listTestCases);
router.get('/:id', protect, testCaseController.getTestCaseById);

// Step 3: Approval
router.patch('/:id/approval', protect, caseReviewController.updateApproval);

// Step 4: Versioned Edit & History
router.put('/:id', protect, caseReviewController.editCase);
router.get('/:id/versions', protect, caseReviewController.getVersions);
router.post('/:id/versions/:v/restore', protect, caseReviewController.restoreVersion);

// Step 5: Regenerate Preview & Apply
router.post('/:id/regenerate/preview', protect, caseReviewController.previewRegenerate);
router.post('/:id/regenerate/apply', protect, caseReviewController.applyRegenerate);

module.exports = router;
