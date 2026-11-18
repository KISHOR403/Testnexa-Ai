/**
 * Testnexa AI — CI/CD Integration Service (GitHub App Model)
 * Orchestrates GitHub App installations, repository syncing, suite pipelines,
 * token generation/rotation, export workflows, and webhook deliveries.
 * 
 * Design Principle: Testnexa does NOT run tests. The customer's own GitHub Actions
 * runner executes Playwright tests and posts JSON results back to Testnexa.
 */

const crypto = require('crypto');
const supabaseService = require('../supabaseData.service');
const githubAppService = require('./githubApp.service');
const pipelineExportService = require('./pipelineExport.service');
const logger = require('../../utils/logger');

class CicdIntegrationService {
    /**
     * Generate GitHub App installation URL with signed single-use state
     */
    getInstallUrl({ userId, workspaceId, returnUrl = '/app/workspace' }) {
        if (!userId || !workspaceId) {
            throw new Error('userId and workspaceId are required to generate install URL');
        }

        const state = githubAppService.generateSignedState({
            userId: String(userId),
            workspaceId: String(workspaceId),
            returnUrl: String(returnUrl)
        });

        const slug = process.env.GITHUB_APP_SLUG || 'testnexa-ci';
        const installUrl = `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`;

        return {
            installUrl,
            state
        };
    }

    /**
     * Handle GitHub App post-installation callback
     */
    async handleCallback({ code, installationId, setupAction, state }) {
        if (!state) {
            const err = new Error('Missing state parameter in callback');
            err.statusCode = 400;
            err.code = 'MISSING_STATE';
            throw err;
        }

        const verified = githubAppService.verifySignedState(state);
        if (!verified.valid) {
            const err = new Error('Invalid or expired installation state. Please try connecting again.');
            err.statusCode = 400;
            err.code = 'INVALID_STATE';
            throw err;
        }

        const { userId, workspaceId, returnUrl } = verified.payload;
        const instId = String(installationId || '');

        if (!instId) {
            const err = new Error('Missing installation_id parameter in callback');
            err.statusCode = 400;
            err.code = 'MISSING_INSTALLATION_ID';
            throw err;
        }

        // Mint installation access token to inspect account details
        let externalAccount = '';
        try {
            const instToken = await githubAppService.getInstallationAccessToken(instId);
            const instData = await githubAppService.makeGitHubRequest('/installation/repositories', instToken);
            if (instData && Array.isArray(instData.repositories) && instData.repositories.length > 0) {
                externalAccount = instData.repositories[0].owner?.login || '';
            }
        } catch (err) {
            logger.warn('Failed to query initial GitHub installation details:', err.message);
        }

        // Check for existing integration for this workspace
        const existingIntegrations = await supabaseService.listIntegrations(workspaceId, 'github');
        const existing = existingIntegrations.find(i => i.installation_id === instId);

        let integration;
        if (existing) {
            integration = await supabaseService.updateIntegration(existing.id, {
                status: 'active',
                external_account: externalAccount || existing.external_account
            }, workspaceId);
        } else {
            integration = await supabaseService.saveIntegration({
                workspace_id: workspaceId,
                provider: 'github',
                external_account: externalAccount || `github_${instId}`,
                installation_id: instId,
                status: 'active',
                created_by: userId
            });
        }

        // Background initial repo sync
        this.syncRepos(integration.id, workspaceId).catch(err => {
            logger.warn(`Initial repo sync note for integration ${integration.id}:`, err.message);
        });

        return {
            success: true,
            integration,
            returnUrl: returnUrl || '/app/workspace'
        };
    }

    /**
     * List all integrations for a workspace
     */
    async listIntegrations(workspaceId) {
        if (!workspaceId) return [];
        return supabaseService.listIntegrations(workspaceId, 'all');
    }

    /**
     * Get integration details by ID
     */
    async getIntegration(id, workspaceId) {
        if (!id || !workspaceId) return null;
        return supabaseService.getIntegrationById(id, workspaceId);
    }

    /**
     * Sync available repositories from GitHub for an installation
     */
    async syncRepos(integrationId, workspaceId) {
        const integration = await supabaseService.getIntegrationById(integrationId, workspaceId);
        if (!integration) {
            const err = new Error('Integration not found');
            err.statusCode = 404;
            err.code = 'INTEGRATION_NOT_FOUND';
            throw err;
        }

        if (integration.status !== 'active') {
            const err = new Error('Integration is suspended or revoked');
            err.statusCode = 400;
            err.code = 'INTEGRATION_INACTIVE';
            throw err;
        }

        const instToken = await githubAppService.getInstallationAccessToken(integration.installation_id);
        const data = await githubAppService.makeGitHubRequest('/installation/repositories', instToken);

        const repos = (data?.repositories || []).map(r => ({
            repo_id: String(r.id),
            full_name: r.full_name,
            default_branch: r.default_branch || 'main',
            private: Boolean(r.private),
            selected: true
        }));

        const saved = await supabaseService.saveIntegrationRepos(integration.id, repos);
        return saved;
    }

    /**
     * Disconnect an integration, pause pipelines, and revoke pipeline tokens
     */
    async disconnectIntegration(integrationId, workspaceId) {
        const integration = await supabaseService.getIntegrationById(integrationId, workspaceId);
        if (!integration) {
            const err = new Error('Integration not found');
            err.statusCode = 404;
            err.code = 'INTEGRATION_NOT_FOUND';
            throw err;
        }

        // Pause associated pipelines and revoke tokens
        const pipelines = await supabaseService.listPipelines(workspaceId, { integrationId: integration.id });
        for (const p of pipelines) {
            await supabaseService.updatePipeline(p.id, { status: 'paused' }, workspaceId);
            await supabaseService.revokePipelineTokens(p.id);
        }

        // Delete integration
        await supabaseService.deleteIntegration(integration.id, workspaceId);

        return { success: true };
    }

    /**
     * Create a pipeline connecting a repository to a test suite
     */
    async createPipeline(workspaceId, { integrationId, repoId, suiteId, name, branchFilters, triggers, reportCheck }) {
        if (!workspaceId || !integrationId || !repoId || !suiteId) {
            const err = new Error('workspaceId, integrationId, repoId, and suiteId are required');
            err.statusCode = 400;
            err.code = 'MISSING_REQUIRED_FIELDS';
            throw err;
        }

        // Validate integration
        const integration = await supabaseService.getIntegrationById(integrationId, workspaceId);
        if (!integration) {
            const err = new Error('Integration not found');
            err.statusCode = 404;
            err.code = 'INTEGRATION_NOT_FOUND';
            throw err;
        }

        // Validate uniqueness: (repo_id, suite_id)
        const existing = await supabaseService.getPipelineByRepoAndSuite(repoId, suiteId);
        if (existing) {
            const err = new Error('A pipeline connecting this repository and suite already exists');
            err.statusCode = 409;
            err.code = 'PIPELINE_EXISTS';
            throw err;
        }

        // Create pipeline
        const pipeline = await supabaseService.savePipeline({
            workspace_id: workspaceId,
            integration_id: integrationId,
            repo_id: repoId,
            suite_id: suiteId,
            name: name || `Pipeline for ${suiteId}`,
            branch_filters: branchFilters || ['main'],
            triggers: triggers || { pull_request: true, push: true },
            report_check: reportCheck !== undefined ? Boolean(reportCheck) : true,
            status: 'active'
        });

        // Generate initial random 32-byte pipeline token
        // Plaintext token is returned ONLY once in this response and never stored
        const rawToken = 'tnx_ci_' + crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const prefix = rawToken.slice(0, 15);

        const tokenRecord = await supabaseService.savePipelineToken({
            pipeline_id: pipeline.id,
            token_hash: tokenHash,
            prefix
        });

        return {
            pipeline,
            token: rawToken,
            tokenPrefix: prefix,
            tokenId: tokenRecord.id
        };
    }

    /**
     * List pipelines for a workspace
     */
    async listPipelines(workspaceId, filters = {}) {
        if (!workspaceId) return [];
        return supabaseService.listPipelines(workspaceId, filters);
    }

    /**
     * Get pipeline by ID
     */
    async getPipeline(id, workspaceId) {
        if (!id || !workspaceId) return null;
        return supabaseService.getPipelineById(id, workspaceId);
    }

    /**
     * Update pipeline configuration
     */
    async updatePipeline(id, patch, workspaceId) {
        if (!id || !workspaceId) return null;
        return supabaseService.updatePipeline(id, patch, workspaceId);
    }

    /**
     * Rotate pipeline token: revokes old active tokens and returns new plaintext token once
     */
    async rotatePipelineToken(id, workspaceId) {
        const pipeline = await supabaseService.getPipelineById(id, workspaceId);
        if (!pipeline) {
            const err = new Error('Pipeline not found');
            err.statusCode = 404;
            err.code = 'PIPELINE_NOT_FOUND';
            throw err;
        }

        // Revoke all existing tokens for this pipeline
        await supabaseService.revokePipelineTokens(pipeline.id);

        // Generate new random 32-byte token
        const rawToken = 'tnx_ci_' + crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const prefix = rawToken.slice(0, 15);

        const tokenRecord = await supabaseService.savePipelineToken({
            pipeline_id: pipeline.id,
            token_hash: tokenHash,
            prefix
        });

        return {
            token: rawToken,
            prefix,
            tokenPrefix: prefix,
            tokenId: tokenRecord.id,
            createdAt: tokenRecord.created_at
        };
    }

    /**
     * Get pipeline setup instructions and generated workflow YAML
     */
    async getPipelineSetup(id, workspaceId) {
        const pipeline = await supabaseService.getPipelineById(id, workspaceId);
        if (!pipeline) {
            const err = new Error('Pipeline not found');
            err.statusCode = 404;
            err.code = 'PIPELINE_NOT_FOUND';
            throw err;
        }

        const repo = await supabaseService.getIntegrationRepoById(pipeline.repo_id, pipeline.integration_id);
        const suite = await supabaseService.getSession(pipeline.suite_id);

        const workflowYaml = pipelineExportService.generateWorkflowYaml({
            pipeline,
            repo,
            suite
        });

        return {
            pipeline,
            repo,
            suiteTitle: suite?.title || suite?.feature || 'Test Suite',
            workflowPath: '.github/workflows/testnexa.yml',
            workflowYaml,
            secretName: 'TESTNEXA_TOKEN'
        };
    }

    /**
     * Delete pipeline
     */
    async deletePipeline(id, workspaceId) {
        if (!id || !workspaceId) return false;
        return supabaseService.deletePipeline(id, workspaceId);
    }

    /**
     * Handle incoming GitHub webhook event with HMAC-SHA256 signature verification and replay deduplication
     */
    async handleWebhook({ event, deliveryId, signature, rawBody, payload }) {
        if (!deliveryId) {
            const err = new Error('Missing X-GitHub-Delivery header');
            err.statusCode = 400;
            err.code = 'MISSING_DELIVERY_HEADER';
            throw err;
        }

        // 1. Replay check: has this delivery already been processed?
        const isProcessed = await supabaseService.isWebhookDeliveryProcessed(deliveryId);
        if (isProcessed) {
            logger.info(`Ignoring duplicate webhook delivery ${deliveryId} (${event})`);
            return {
                acknowledged: true,
                duplicate: true,
                deliveryId
            };
        }

        // 2. Webhook HMAC-SHA256 signature verification
        const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
        if (secret) {
            const isValid = githubAppService.verifyWebhookSignature(rawBody, signature, secret);
            if (!isValid) {
                const err = new Error('Invalid webhook HMAC signature');
                err.statusCode = 401;
                err.code = 'INVALID_SIGNATURE';
                throw err;
            }
        }

        // Record delivery as processed
        await supabaseService.recordWebhookDelivery({
            deliveryId,
            event,
            status: 'processed'
        });

        // 3. Process event actions
        if (event === 'installation') {
            const action = payload.action;
            const instId = String(payload.installation?.id || '');
            if (instId) {
                const existing = await supabaseService.getIntegrationByInstallationId(instId);
                if (existing) {
                    if (action === 'deleted') {
                        await supabaseService.updateIntegration(existing.id, { status: 'revoked' });
                    } else if (action === 'suspend') {
                        await supabaseService.updateIntegration(existing.id, { status: 'suspended' });
                    } else if (action === 'unsuspend') {
                        await supabaseService.updateIntegration(existing.id, { status: 'active' });
                    }
                }
            }
        } else if (event === 'installation_repositories') {
            const instId = String(payload.installation?.id || '');
            if (instId) {
                const existing = await supabaseService.getIntegrationByInstallationId(instId);
                if (existing) {
                    await this.syncRepos(existing.id, existing.workspace_id).catch(() => null);
                }
            }
        }

        return {
            acknowledged: true,
            event,
            deliveryId
        };
    }
}

module.exports = new CicdIntegrationService();
