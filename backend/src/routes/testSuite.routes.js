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

// Playwright Export
router.get('/:id/export/playwright', optionalProtect, async (req, res) => {
    try {
        const suite = await supabaseService.getSession(req.params.id, req.user?._id || req.user?.id);
        if (!suite) {
            return res.status(404).json({ success: false, message: 'Test suite not found' });
        }
        const specCode = pipelineExportService.generatePlaywrightSuiteCode(suite);
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="suite-${req.params.id}.spec.js"`);
        return res.status(200).send(specCode);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

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
