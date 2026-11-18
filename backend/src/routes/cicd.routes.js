/**
 * Testnexa AI — Legacy CI/CD Routes (Backward Compatibility)
 * Aliases legacy routes to the modern GitHub App and Pipeline services
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    getInstallUrl,
    listIntegrations,
    getIntegration,
    listIntegrationRepos,
    syncIntegrationRepos,
    disconnectIntegration,
    listPipelines,
    createPipeline,
    getPipeline,
    updatePipeline,
    deletePipeline,
    rotatePipelineToken,
    getPipelineSetup,
    exportPipelinePlaywright,
    handleGitHubWebhook,
    ingestCiResults
} = require('../controllers/cicd.controller');

const router = express.Router();

// Public webhook ingress
router.post('/webhooks/:provider', handleGitHubWebhook);

// Integrations
router.get('/github/install-url', protect, getInstallUrl);
router.get('/providers', protect, async (req, res) => {
    res.json({
        success: true,
        data: [{ id: 'github', name: 'GitHub', isAvailable: true, description: 'Connect GitHub via GitHub App' }]
    });
});
router.get('/', protect, listIntegrations);
router.get('/:id', protect, getIntegration);
router.get('/:id/repos', protect, listIntegrationRepos);
router.post('/:id/sync', protect, syncIntegrationRepos);
router.delete('/:id', protect, disconnectIntegration);

// Pipelines
router.get('/pipelines', protect, listPipelines);
router.post('/pipelines', protect, createPipeline);
router.get('/pipelines/:id', protect, getPipeline);
router.patch('/pipelines/:id', protect, updatePipeline);
router.put('/pipelines/:id', protect, updatePipeline);
router.delete('/pipelines/:id', protect, deletePipeline);
router.post('/pipelines/:id/token', protect, rotatePipelineToken);
router.get('/pipelines/:id/setup', protect, getPipelineSetup);
router.get('/pipelines/:id/export', protect, exportPipelinePlaywright);

// Results Ingestion
router.post('/results', ingestCiResults);

module.exports = router;
