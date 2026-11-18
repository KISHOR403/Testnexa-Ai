/**
 * Testnexa AI — Integrations Routes
 * Supports GitHub App OAuth/App connect, repos sync, and disconnect
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    getInstallUrl,
    handleCallback,
    listIntegrations,
    getIntegration,
    listIntegrationRepos,
    syncIntegrationRepos,
    disconnectIntegration
} = require('../controllers/cicd.controller');

const router = express.Router();

// GitHub App Connect & Callback
router.get('/github/install-url', protect, getInstallUrl);
router.get('/github/callback', handleCallback);

// Workspace Integrations CRUD
router.get('/', protect, listIntegrations);
router.get('/:id', protect, getIntegration);
router.get('/:id/repos', protect, listIntegrationRepos);
router.post('/:id/sync', protect, syncIntegrationRepos);
router.delete('/:id', protect, disconnectIntegration);

module.exports = router;
