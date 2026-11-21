const express = require('express');
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const {
    listSessions,
    createSession,
    getSession,
    updateSession,
    deleteSession,
    getVersions,
    createVersion,
    createShare,
    getShare,
    revokeShare
} = require('../controllers/session.controller');
const pipelineExportService = require('../services/integrations/pipelineExport.service');
const supabaseService = require('../services/supabaseData.service');

const router = express.Router();

const caseReviewController = require('../controllers/caseReview.controller');

// Playwright Export
router.get('/:id/export/playwright', optionalProtect, async (req, res) => {
    try {
        const approvedFilter = req.query.approved || 'only'; // 'only' | 'include_pending'
        const suite = await supabaseService.getSession(req.params.id, req.user?._id || req.user?.id);
        if (!suite) {
            return res.status(404).json({ success: false, message: 'Test suite not found' });
        }
        const specCode = pipelineExportService.generatePlaywrightSuiteCode(suite, { approved: approvedFilter });
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="suite-${req.params.id}.spec.js"`);
        res.setHeader('X-Exported-Count', String(specCode.exportedCount || 0));
        res.setHeader('X-Skipped-Count', String(specCode.skippedCount || 0));

        if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
            return res.status(200).json({
                success: true,
                specCode: specCode.toString(),
                exportedCount: specCode.exportedCount || 0,
                skippedCount: specCode.skippedCount || 0
            });
        }

        return res.status(200).send(specCode.toString());
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Suite Requirements & Review Actions
router.get('/:id/requirements', protect, caseReviewController.getSuiteRequirements);
router.post('/:id/approve-remaining', protect, caseReviewController.approveRemaining);

// Share management (strictly owner/authenticated)
router.get('/:id/share', protect, getShare);
router.post('/:id/share', protect, createShare);
router.delete('/:id/share', protect, revokeShare);

// Read test suite: supports authenticated users and shared links (guests & collaborators)
router.get('/:id', optionalProtect, getSession);

// Protected workspace routes
router.get('/', protect, listSessions);
router.post('/', protect, createSession);
router.patch('/:id', optionalProtect, updateSession); // Enforces owner / editor / reviewer / viewer roles
router.delete('/:id', protect, deleteSession);

// Version management
router.get('/:id/versions', protect, getVersions);
router.post('/:id/versions', protect, createVersion);

module.exports = router;
