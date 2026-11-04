/**
 * TestNexa AI — CI/CD Integrations Routes
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    getAvailableProviders,
    connectProvider,
    getConnectionStatus,
    disconnectProvider,
    listRepositories,
    listBranches,
    listPipelines,
    createPipeline,
    getPipeline,
    updatePipeline,
    deletePipeline,
    triggerPipeline,
    getActivity,
    getSetupInstructions,
    handleWebhook
} = require('../controllers/cicd.controller');

const router = express.Router();

// Public webhook ingress (authenticated via HMAC-SHA256 payload signature)
router.post('/webhooks/:provider', handleWebhook);

// Authenticated CI/CD management endpoints
router.get('/providers', protect, getAvailableProviders);
router.post('/:provider/connect', protect, connectProvider);
router.get('/:provider/status', protect, getConnectionStatus);
router.post('/:provider/disconnect', protect, disconnectProvider);
router.get('/:provider/repositories', protect, listRepositories);
router.get('/:provider/branches', protect, listBranches);

// Pipeline management
router.get('/pipelines', protect, listPipelines);
router.post('/pipelines', protect, createPipeline);
router.get('/pipelines/:id', protect, getPipeline);
router.put('/pipelines/:id', protect, updatePipeline);
router.delete('/pipelines/:id', protect, deletePipeline);
router.post('/pipelines/:id/trigger', protect, triggerPipeline);

// Activity logs & setup instructions
router.get('/activity', protect, getActivity);
router.get('/instructions/:provider', protect, getSetupInstructions);

module.exports = router;

