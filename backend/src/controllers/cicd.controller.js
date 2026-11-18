/**
 * Testnexa AI — CI/CD Integrations Controller
 * Exposes REST endpoints for GitHub App connection, repository syncing,
 * suite pipelines CRUD, token rotation, workflow generation, export,
 * webhook handling, and result ingestion.
 */

const cicdService = require('../services/integrations/cicdIntegration.service');
const ciIngestionService = require('../services/integrations/ciIngestion.service');
const pipelineExportService = require('../services/integrations/pipelineExport.service');
const supabaseService = require('../services/supabaseData.service');
const auditService = require('../services/auditService');
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

/**
 * GET /api/v1/integrations/github/install-url
 * Returns GitHub App installation URL with signed single-use state
 */
exports.getInstallUrl = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const workspaceId = await resolveWorkspaceId(req);
        const returnUrl = req.query.return_url || req.query.returnUrl || '/app/workspace';

        if (!userId || !workspaceId) {
            return res.status(400).json({ success: false, message: 'Active user and workspace context required' });
        }

        const data = cicdService.getInstallUrl({ userId, workspaceId, returnUrl });
        res.status(200).json({ success: true, data });
    } catch (err) {
        logger.error('Error generating install URL:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/integrations/github/callback
 * Handles post-installation redirection from GitHub
 */
exports.handleCallback = async (req, res) => {
    try {
        const { code, installation_id, setup_action, state } = req.query;

        const result = await cicdService.handleCallback({
            code,
            installationId: installation_id,
            setupAction: setup_action,
            state
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const sep = result.returnUrl.includes('?') ? '&' : '?';
        return res.redirect(`${frontendUrl}${result.returnUrl}${sep}integration_connected=true`);
    } catch (err) {
        logger.error('Error in GitHub App callback:', err);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/app/workspace?error=github_install_failed&message=${encodeURIComponent(err.message)}`);
    }
};

/**
 * GET /api/v1/integrations
 * Lists all active integrations for the current workspace
 */
exports.listIntegrations = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace context required' });
        }

        const integrations = await cicdService.listIntegrations(workspaceId);
        res.status(200).json({ success: true, data: integrations });
    } catch (err) {
        logger.error('Error listing integrations:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/integrations/:id
 * Gets integration details
 */
exports.getIntegration = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        const integration = await cicdService.getIntegration(id, workspaceId);

        if (!integration) {
            return res.status(404).json({ success: false, message: 'Integration not found' });
        }
        res.status(200).json({ success: true, data: integration });
    } catch (err) {
        logger.error('Error getting integration:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/integrations/:id/repos
 * Lists repositories available under this installation
 */
exports.listIntegrationRepos = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        const integration = await cicdService.getIntegration(id, workspaceId);

        if (!integration) {
            return res.status(404).json({ success: false, message: 'Integration not found' });
        }

        let repos = await supabaseService.listIntegrationRepos(id);
        if (repos.length === 0) {
            repos = await cicdService.syncRepos(id, workspaceId).catch(() => []);
        }

        res.status(200).json({ success: true, data: repos });
    } catch (err) {
        logger.error('Error listing integration repos:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/integrations/:id/sync
 * Syncs repositories from GitHub
 */
exports.syncIntegrationRepos = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        const repos = await cicdService.syncRepos(id, workspaceId);

        res.status(200).json({ success: true, data: repos, message: 'Repositories synced successfully' });
    } catch (err) {
        logger.error('Error syncing repos:', err);
        const status = err.statusCode || 500;
        res.status(status).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/v1/integrations/:id
 * Disconnects integration, pauses pipelines, and revokes tokens
 */
exports.disconnectIntegration = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        await cicdService.disconnectIntegration(id, workspaceId);

        res.status(200).json({ success: true, message: 'Integration disconnected successfully' });
    } catch (err) {
        logger.error('Error disconnecting integration:', err);
        const status = err.statusCode || 500;
        res.status(status).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/pipelines
 * Creates a new pipeline connecting a repository to a suite
 */
exports.createPipeline = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const { integrationId, repoId, suiteId, name, branchFilters, triggers, reportCheck } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace context required' });
        }

        const result = await cicdService.createPipeline(workspaceId, {
            integrationId,
            repoId,
            suiteId,
            name,
            branchFilters,
            triggers,
            reportCheck
        });

        res.status(201).json({
            success: true,
            data: result.pipeline,
            token: result.token, // Returned ONLY once
            tokenPrefix: result.tokenPrefix,
            message: 'Pipeline created. Please save the token securely as it will not be displayed again.'
        });
    } catch (err) {
        logger.error('Error creating pipeline:', err);
        const status = err.statusCode || 500;
        res.status(status).json({ success: false, message: err.message, code: err.code });
    }
};

/**
 * GET /api/v1/pipelines
 * Lists pipelines for the current workspace
 */
exports.listPipelines = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        const { integrationId, repoId, suiteId, status } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace context required' });
        }

        const pipelines = await cicdService.listPipelines(workspaceId, {
            integrationId,
            repoId,
            suiteId,
            status
        });

        res.status(200).json({ success: true, data: pipelines });
    } catch (err) {
        logger.error('Error listing pipelines:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/pipelines/:id
 * Gets pipeline details
 */
exports.getPipeline = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        const pipeline = await cicdService.getPipeline(id, workspaceId);

        if (!pipeline) {
            return res.status(404).json({ success: false, message: 'Pipeline not found' });
        }
        res.status(200).json({ success: true, data: pipeline });
    } catch (err) {
        logger.error('Error getting pipeline:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PATCH /api/v1/pipelines/:id
 * Updates pipeline settings
 */
exports.updatePipeline = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        const { name, branchFilters, triggers, status, reportCheck } = req.body;

        const updated = await cicdService.updatePipeline(id, {
            ...(name !== undefined && { name }),
            ...(branchFilters !== undefined && { branch_filters: branchFilters }),
            ...(triggers !== undefined && { triggers }),
            ...(status !== undefined && { status }),
            ...(reportCheck !== undefined && { report_check: Boolean(reportCheck) })
        }, workspaceId);

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Pipeline not found' });
        }

        res.status(200).json({ success: true, data: updated });
    } catch (err) {
        logger.error('Error updating pipeline:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/v1/pipelines/:id
 * Deletes pipeline and revokes its tokens
 */
exports.deletePipeline = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        const deleted = await cicdService.deletePipeline(id, workspaceId);

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Pipeline not found' });
        }

        res.status(200).json({ success: true, message: 'Pipeline deleted successfully' });
    } catch (err) {
        logger.error('Error deleting pipeline:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/pipelines/:id/token
 * Rotates pipeline token: revokes old active tokens and returns new plaintext token once
 */
exports.rotatePipelineToken = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        const result = await cicdService.rotatePipelineToken(id, workspaceId);

        res.status(200).json({
            success: true,
            data: {
                token: result.token, // Plaintext returned ONLY once
                prefix: result.prefix,
                createdAt: result.createdAt
            },
            message: 'Pipeline token rotated successfully. Update your GitHub repository secret TESTNEXA_TOKEN.'
        });
    } catch (err) {
        logger.error('Error rotating pipeline token:', err);
        const status = err.statusCode || 500;
        res.status(status).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/pipelines/:id/setup
 * Returns GitHub Actions workflow YAML and setup instructions
 */
exports.getPipelineSetup = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        const setup = await cicdService.getPipelineSetup(id, workspaceId);

        res.status(200).json({ success: true, data: setup });
    } catch (err) {
        logger.error('Error generating pipeline setup:', err);
        const status = err.statusCode || 500;
        res.status(status).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/v1/pipelines/:id/export
 * Exports Playwright test suite code (.spec.js) ensuring every test title starts with [TC_KEY]
 */
exports.exportPipelinePlaywright = async (req, res) => {
    try {
        const { id } = req.params;
        const workspaceId = await resolveWorkspaceId(req);
        const pipeline = await cicdService.getPipeline(id, workspaceId);

        if (!pipeline) {
            return res.status(404).json({ success: false, message: 'Pipeline not found' });
        }

        const suite = await supabaseService.getSession(pipeline.suite_id);
        if (!suite) {
            return res.status(404).json({ success: false, message: 'Suite not found' });
        }

        const specCode = pipelineExportService.generatePlaywrightSuiteCode(suite);
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="suite-${pipeline.suite_id}.spec.js"`);
        return res.status(200).send(specCode);
    } catch (err) {
        logger.error('Error exporting Playwright suite:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/v1/webhooks/github
 * Inbound GitHub App webhook handler
 */
exports.handleGitHubWebhook = async (req, res) => {
    try {
        const event = req.headers['x-github-event'] || req.headers['X-GitHub-Event'];
        const deliveryId = req.headers['x-github-delivery'] || req.headers['X-GitHub-Delivery'];
        const signature = req.headers['x-hub-signature-256'] || req.headers['X-Hub-Signature-256'];
        const rawBody = req.rawBody || JSON.stringify(req.body);

        const result = await cicdService.handleWebhook({
            event,
            deliveryId,
            signature,
            rawBody,
            payload: req.body
        });

        res.status(200).json(result);
    } catch (err) {
        logger.error('Error processing GitHub webhook:', err);
        const status = err.statusCode || 500;
        res.status(status).json({ success: false, message: err.message, code: err.code });
    }
};

/**
 * POST /api/v1/ci/results
 * Results ingestion endpoint called by customer's GitHub Actions workflow
 * Gated behind FEATURE_TEST_RUNS (returns 501 when false)
 */
exports.ingestCiResults = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        const result = await ciIngestionService.ingestResults({
            token,
            headers: req.headers,
            payload: req.body
        });

        res.status(200).json({ success: true, data: result });
    } catch (err) {
        const status = err.statusCode || 500;
        logger.warn('CI ingestion rejection:', { status, code: err.code, message: err.message });
        res.status(status).json({ success: false, code: err.code || 'INGESTION_ERROR', message: err.message });
    }
};
