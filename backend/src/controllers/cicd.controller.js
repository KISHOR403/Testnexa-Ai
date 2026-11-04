/**
 * TestNexa AI — CI/CD Integrations Controller
 * Exposes REST endpoints for provider connections, pipeline configurations,
 * manual execution triggers, activity logs, and inbound webhook reception.
 */

const cicdService = require('../services/integrations/cicdIntegration.service');
const { listProviders } = require('../services/integrations/providers');
const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');

const resolveWorkspaceId = async (req) => {
    const userId = req.user?._id || req.user?.id;
    if (req.body?.workspaceId) return req.body.workspaceId;
    if (req.query?.workspaceId) return req.query.workspaceId;
    if (req.params?.workspaceId) return req.params.workspaceId;

    if (userId) {
        const primary = await supabaseService.getUserPrimaryWorkspace(userId, req.user.name || '');
        return primary ? primary.id : null;
    }
    return null;
};

const verifyAccess = async (req, res, workspaceId) => {
    const userId = req.user?._id || req.user?.id;
    if (!workspaceId) {
        res.status(400).json({ success: false, message: 'No workspace context provided' });
        return false;
    }
    const hasAccess = await supabaseService.verifyUserWorkspaceAccess(workspaceId, userId);
    if (!hasAccess) {
        res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'You do not have access to this workspace'
        });
        return false;
    }
    return true;
};

/**
 * GET /api/v1/integrations/cicd/providers
 * Returns all registered providers and their availability status
 */
exports.getAvailableProviders = async (req, res) => {
    try {
        const providers = listProviders();
        res.json({ success: true, data: providers });
    } catch (err) {
        logger.error('Error listing CI providers:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/integrations/cicd/:provider/connect
 * Connects an authorized provider (e.g. GitHub PAT)
 */
exports.connectProvider = async (req, res) => {
    try {
        const { provider } = req.params;
        const { token, accountLogin } = req.body;
        const workspaceId = await resolveWorkspaceId(req);

        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        if (!token || !token.trim()) {
            return res.status(400).json({ success: false, message: 'Authentication token is required' });
        }

        const connection = await cicdService.connectProvider(workspaceId, provider, {
            token: token.trim(),
            accountLogin,
            actorId: req.user._id || req.user.id
        });

        res.status(200).json({
            success: true,
            data: connection,
            message: `${provider} connected successfully`
        });
    } catch (err) {
        logger.error(`Error connecting CI provider ${req.params.provider}:`, err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/integrations/cicd/:provider/status
 * Gets provider connection status with masked credentials
 */
exports.getConnectionStatus = async (req, res) => {
    try {
        const { provider } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const connection = await cicdService.getConnection(workspaceId, provider);
        res.json({
            success: true,
            data: connection || { status: 'disconnected', provider }
        });
    } catch (err) {
        logger.error('Error fetching connection status:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/integrations/cicd/:provider/disconnect
 * Disconnects provider
 */
exports.disconnectProvider = async (req, res) => {
    try {
        const { provider } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const success = await cicdService.disconnectProvider(workspaceId, provider, req.user._id || req.user.id);
        res.json({
            success: true,
            message: success ? `${provider} disconnected` : 'No active connection found'
        });
    } catch (err) {
        logger.error('Error disconnecting provider:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/integrations/cicd/:provider/repositories
 * Lists repositories authorized by the connected token
 */
exports.listRepositories = async (req, res) => {
    try {
        const { provider } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const repos = await cicdService.getRepositories(workspaceId, provider);
        res.json({ success: true, data: repos });
    } catch (err) {
        logger.warn('Error listing repositories:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/integrations/cicd/:provider/branches
 * Lists branches for a repo
 */
exports.listBranches = async (req, res) => {
    try {
        const { provider } = req.params;
        const { owner, repo } = req.query;
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        if (!owner || !repo) {
            return res.status(400).json({ success: false, message: 'owner and repo query parameters are required' });
        }

        const branches = await cicdService.getBranches(workspaceId, provider, owner, repo);
        res.json({ success: true, data: branches });
    } catch (err) {
        logger.warn('Error listing branches:', err.message);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/integrations/cicd/pipelines
 * Lists configured pipelines
 */
exports.listPipelines = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const pipelines = await cicdService.getPipelines(workspaceId, req.query);
        res.json({ success: true, data: pipelines });
    } catch (err) {
        logger.error('Error listing pipelines:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/integrations/cicd/pipelines
 * Creates a new pipeline trigger configuration
 */
exports.createPipeline = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const pipeline = await cicdService.createPipeline(workspaceId, {
            ...req.body,
            createdBy: req.user._id || req.user.id
        });

        res.status(201).json({
            success: true,
            data: pipeline,
            message: 'Pipeline configured successfully'
        });
    } catch (err) {
        logger.error('Error creating pipeline:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/integrations/cicd/pipelines/:id
 */
exports.getPipeline = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const pipeline = await cicdService.getPipelineById(workspaceId, id);
        if (!pipeline) {
            return res.status(404).json({ success: false, message: 'Pipeline not found' });
        }

        res.json({ success: true, data: pipeline });
    } catch (err) {
        logger.error('Error fetching pipeline:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PUT /api/v1/integrations/cicd/pipelines/:id
 */
exports.updatePipeline = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const updated = await cicdService.updatePipeline(workspaceId, id, req.body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Pipeline not found' });
        }

        res.json({ success: true, data: updated, message: 'Pipeline updated successfully' });
    } catch (err) {
        logger.error('Error updating pipeline:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/v1/integrations/cicd/pipelines/:id
 */
exports.deletePipeline = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const deleted = await cicdService.deletePipeline(workspaceId, id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Pipeline not found' });
        }

        res.json({ success: true, message: 'Pipeline deleted' });
    } catch (err) {
        logger.error('Error deleting pipeline:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/integrations/cicd/pipelines/:id/trigger
 * Dispatches a real test execution for this pipeline
 */
exports.triggerPipeline = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const result = await cicdService.triggerPipelineManually(workspaceId, id, {
            branch: req.body?.branch,
            commitSha: req.body?.commitSha,
            commitMessage: req.body?.commitMessage,
            triggeredBy: req.user?.name || req.user?.email || 'User',
            userId: req.user?._id || req.user?.id
        });

        res.status(202).json({
            success: true,
            data: result,
            message: 'CI execution dispatched successfully'
        });
    } catch (err) {
        logger.error('Error triggering pipeline:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/integrations/cicd/activity
 * Lists execution history triggered by CI/CD
 */
exports.getActivity = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const activity = await cicdService.getActivity(workspaceId, req.query);
        res.json({ success: true, data: activity });
    } catch (err) {
        logger.error('Error fetching CI activity:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/integrations/cicd/instructions/:provider
 * Returns setup guide, webhook URLs, and YAML workflow template
 */
exports.getSetupInstructions = async (req, res) => {
    try {
        const { provider } = req.params;
        const { pipelineId } = req.query;
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace required' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const instructions = await cicdService.generateSetupInstructions(workspaceId, provider, pipelineId);
        res.json({ success: true, data: instructions });
    } catch (err) {
        logger.error('Error generating CI instructions:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/integrations/cicd/webhooks/:provider
 * Public endpoint for provider webhook delivery (authenticated via HMAC signature)
 */
exports.handleWebhook = async (req, res) => {
    try {
        const { provider } = req.params;
        const result = await cicdService.handleWebhook(
            provider,
            req.headers,
            req.body,
            req.rawBody || Buffer.from(JSON.stringify(req.body || {}))
        );

        res.status(result.statusCode || 200).json(result);
    } catch (err) {
        logger.error(`Error processing ${req.params.provider} webhook:`, err);
        res.status(500).json({ success: false, message: 'Webhook processing error: ' + err.message });
    }
};

