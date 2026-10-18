const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    getCurrentWorkspaceSettings,
    getWorkspaceSettings,
    updateWorkspaceSettings,
    getWorkspaceEnvironments,
    createWorkspaceEnvironment,
    deleteWorkspaceEnvironment,
    getWorkspaceBilling,
    updateWorkspacePlan
} = require('../controllers/workspace.controller');

const router = express.Router();

// All workspace routes strictly require authentication
router.use(protect);

// Active / Current workspace
router.get('/current', getCurrentWorkspaceSettings);
router.get('/current/settings', getCurrentWorkspaceSettings);
router.get('/current/environments', getWorkspaceEnvironments);
router.post('/current/environments', createWorkspaceEnvironment);
router.delete('/current/environments/:environmentId', deleteWorkspaceEnvironment);
router.patch('/current/settings', updateWorkspaceSettings);
router.put('/current/settings', updateWorkspaceSettings);
router.patch('/current', updateWorkspaceSettings);
router.put('/current', updateWorkspaceSettings);

// Workspace Billing & Usage
router.get('/current/billing', getWorkspaceBilling);
router.post('/current/billing/plan', updateWorkspacePlan);
router.get('/:workspaceId/billing', getWorkspaceBilling);
router.post('/:workspaceId/billing/plan', updateWorkspacePlan);

// Workspace settings operations
router.get('/:workspaceId/settings', getWorkspaceSettings);
router.patch('/:workspaceId/settings', updateWorkspaceSettings);
router.put('/:workspaceId/settings', updateWorkspaceSettings);

// Workspace environments
router.get('/:workspaceId/environments', getWorkspaceEnvironments);
router.post('/:workspaceId/environments', createWorkspaceEnvironment);
router.delete('/:workspaceId/environments/:environmentId', deleteWorkspaceEnvironment);

module.exports = router;

