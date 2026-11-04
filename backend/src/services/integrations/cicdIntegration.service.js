/**
 * TestNexa AI — CI/CD Integration Service
 * Orchestrates third-party CI/CD providers (GitHub Actions), webhook verification,
 * pipeline configurations, real Playwright execution dispatch, and commit status checks.
 */

const crypto = require('crypto');
const supabaseService = require('../supabaseData.service');
const jobQueue = require('../runner/jobQueue.service');
const { getProvider, listProviders } = require('./providers');
const { encryptSecret, decryptSecret, maskSecret } = require('../../utils/encryption');
const logger = require('../../utils/logger');

class CiCdIntegrationService {
    constructor() {
        // Register completion listener on job queue to report commit statuses
        jobQueue.on('job_completed', (event) => {
            this._handleExecutionFinished(event).catch(err => {
                logger.warn('Failed to handle CI execution completion check:', err.message);
            });
        });

        jobQueue.on('job_failed', (event) => {
            this._handleExecutionFinished(event).catch(err => {
                logger.warn('Failed to handle CI execution failure check:', err.message);
            });
        });
    }

    /**
     * Resolves application base URL for report links in CI checks
     */
    _getAppUrl() {
        return process.env.FRONTEND_URL || 'http://localhost:5173';
    }

    /**
     * Connects and authenticates a CI provider (e.g. GitHub)
     */
    async connectProvider(workspaceId, providerId, { token, accountLogin, userEmail = null, actorId = null }) {
        if (!workspaceId) throw new Error('workspaceId is required');
        const provider = getProvider(providerId);
        if (!provider) throw new Error(`Unknown provider: ${providerId}`);
        if (!provider.isAvailable) throw new Error(`Provider ${provider.name} is not currently available`);

        // Verify credentials with provider API
        const authResult = await provider.verifyCredentials({ token });
        if (!authResult.valid) {
            throw new Error(authResult.message || 'Failed to authenticate with provider');
        }

        const encryptedToken = encryptSecret(token);
        const last4 = token.trim().slice(-4);
        const masked = maskSecret(token);

        const connection = await supabaseService.saveCiConnection({
            workspaceId,
            provider: provider.id,
            encryptedToken,
            tokenMasked: masked,
            tokenLast4: last4,
            accountLogin: authResult.user?.login || accountLogin || '',
            accountName: authResult.user?.name || authResult.user?.login || '',
            accountAvatarUrl: authResult.user?.avatarUrl || null,
            accountType: authResult.user?.accountType || 'User',
            scopes: authResult.scopes || [],
            status: 'active',
            lastVerifiedAt: new Date().toISOString()
        });

        await supabaseService.recordWorkspaceAuditLog({
            workspaceId,
            actorId: actorId || 'system',
            action: 'integration.connected',
            changes: { provider: provider.id, account: connection.accountLogin }
        });

        return {
            id: connection.id,
            provider: provider.id,
            accountLogin: connection.accountLogin,
            accountName: connection.accountName,
            accountAvatarUrl: connection.accountAvatarUrl,
            scopes: connection.scopes,
            tokenMasked: connection.tokenMasked,
            status: connection.status,
            lastVerifiedAt: connection.lastVerifiedAt
        };
    }

    /**
     * Gets active provider connection with safely masked credentials
     */
    async getConnection(workspaceId, providerId) {
        if (!workspaceId) return null;
        const conn = await supabaseService.getCiConnectionByProvider(workspaceId, providerId);
        if (!conn) return null;

        return {
            id: conn.id,
            workspaceId: conn.workspaceId,
            provider: conn.provider,
            accountLogin: conn.accountLogin,
            accountName: conn.accountName,
            accountAvatarUrl: conn.accountAvatarUrl,
            accountType: conn.accountType,
            scopes: conn.scopes || [],
            tokenMasked: conn.tokenMasked || maskSecret(conn.tokenLast4 || ''),
            status: conn.status,
            lastVerifiedAt: conn.lastVerifiedAt,
            lastEventAt: conn.lastEventAt || null,
            updatedAt: conn.updatedAt
        };
    }

    /**
     * Disconnects a provider
     */
    async disconnectProvider(workspaceId, providerId, actorId = null) {
        if (!workspaceId) return false;
        const deleted = await supabaseService.deleteCiConnection(workspaceId, providerId);
        if (deleted) {
            await supabaseService.recordWorkspaceAuditLog({
                workspaceId,
                actorId: actorId || 'system',
                action: 'integration.disconnected',
                changes: { provider: providerId }
            });
        }
        return deleted;
    }

    /**
     * Helper to retrieve decrypted token for authorized outgoing API calls
     */
    async _getDecryptedToken(workspaceId, providerId) {
        const conn = await supabaseService.getCiConnectionByProvider(workspaceId, providerId);
        if (!conn || !conn.encryptedToken) return null;
        try {
            return decryptSecret(conn.encryptedToken);
        } catch (err) {
            logger.error(`Failed to decrypt ${providerId} token for workspace ${workspaceId}:`, err.message);
            return null;
        }
    }

    /**
     * Lists accessible repositories from connected provider
     */
    async getRepositories(workspaceId, providerId) {
        const token = await this._getDecryptedToken(workspaceId, providerId);
        if (!token) {
            throw new Error(`Workspace is not connected to ${providerId}. Please connect your account first.`);
        }
        const provider = getProvider(providerId);
        if (!provider) throw new Error(`Unknown provider: ${providerId}`);

        return await provider.getRepositories({ token });
    }

    /**
     * Lists branches for a repository
     */
    async getBranches(workspaceId, providerId, owner, repo) {
        const token = await this._getDecryptedToken(workspaceId, providerId);
        if (!token) {
            throw new Error(`Workspace is not connected to ${providerId}`);
        }
        const provider = getProvider(providerId);
        if (!provider) throw new Error(`Unknown provider: ${providerId}`);

        return await provider.getBranches({ token }, owner, repo);
    }

    /**
     * Creates a new CI/CD pipeline configuration
     */
    async createPipeline(workspaceId, pipelineData) {
        if (!workspaceId) throw new Error('workspaceId is required');
        const {
            name,
            provider = 'github',
            repository,
            branch = 'main',
            suiteId,
            targetEnvironment = {},
            triggerEvents = ['push', 'pull_request'],
            browser = 'chromium',
            timeoutMinutes = 15,
            retries = 1,
            isActive = true,
            createdBy = null
        } = pipelineData;

        if (!name || !name.trim()) throw new Error('Pipeline name is required');
        if (!repository || !repository.trim()) throw new Error('Repository is required');
        if (!suiteId) throw new Error('Target test suite is required');

        // Verify suite exists in workspace context
        const suite = await supabaseService.getSession(suiteId, createdBy);
        if (!suite) {
            throw new Error(`Selected test suite (${suiteId}) not found in workspace`);
        }

        // Generate high-entropy webhook secret
        const webhookSecret = crypto.randomBytes(24).toString('hex');

        const pipeline = await supabaseService.saveCiPipeline({
            workspaceId,
            name: name.trim(),
            provider: provider.toLowerCase(),
            repository: repository.trim(),
            branch: branch ? branch.trim() : 'main',
            suiteId,
            suiteName: suite.name || 'Test Suite',
            targetEnvironment,
            triggerEvents: Array.isArray(triggerEvents) ? triggerEvents : ['push', 'pull_request'],
            browser: browser || 'chromium',
            timeoutMinutes: Number(timeoutMinutes) || 15,
            retries: Number(retries) || 1,
            isActive: Boolean(isActive),
            webhookSecret,
            createdBy
        });

        await supabaseService.recordWorkspaceAuditLog({
            workspaceId,
            actorId: createdBy || 'system',
            action: 'pipeline.created',
            changes: { pipelineId: pipeline.id, name: pipeline.name, repository: pipeline.repository }
        });

        return pipeline;
    }

    /**
     * Lists pipelines for a workspace
     */
    async getPipelines(workspaceId, filters = {}) {
        return await supabaseService.getCiPipelines(workspaceId, filters);
    }

    /**
     * Gets a single pipeline by ID
     */
    async getPipelineById(workspaceId, pipelineId) {
        return await supabaseService.getCiPipelineById(workspaceId, pipelineId);
    }

    /**
     * Updates an existing pipeline
     */
    async updatePipeline(workspaceId, pipelineId, updates = {}) {
        return await supabaseService.updateCiPipeline(workspaceId, pipelineId, updates);
    }

    /**
     * Deletes a pipeline
     */
    async deletePipeline(workspaceId, pipelineId) {
        return await supabaseService.deleteCiPipeline(workspaceId, pipelineId);
    }

    /**
     * Dispatches real test execution for a pipeline
     */
    async dispatchPipelineExecution(pipeline, eventContext = {}) {
        const {
            triggerType = 'webhook',
            branch = pipeline.branch,
            commitSha = null,
            commitMessage = '',
            author = 'CI Runner',
            prNumber = null,
            deliveryId = null,
            requestedBy = null
        } = eventContext;

        logger.info(`[CI/CD] Dispatching execution for pipeline "${pipeline.name}" (${pipeline.id}) on branch "${branch}"`);

        // 1. Verify test suite exists
        const suite = await supabaseService.getSession(pipeline.suiteId, pipeline.createdBy);
        if (!suite) {
            throw new Error(`Target test suite ${pipeline.suiteId} does not exist`);
        }

        const commitShort = commitSha ? commitSha.substring(0, 7) : 'head';
        const runName = `[CI: ${pipeline.provider.toUpperCase()}] ${pipeline.name} - ${branch}@${commitShort}`;

        // 2. Create actual unified TestRun record
        const run = await supabaseService.createTestRun({
            workspaceId: pipeline.workspaceId,
            suiteId: pipeline.suiteId,
            name: runName,
            description: `Automated CI execution triggered via ${pipeline.provider} (${triggerType}) on ${pipeline.repository}#${branch}`,
            executionType: 'automated',
            environmentId: pipeline.environmentId || null,
            targetEnvironment: {
                ...(pipeline.targetEnvironment || {}),
                browser: pipeline.browser || 'chromium',
                ciTriggered: true,
                repository: pipeline.repository,
                branch,
                commitSha
            },
            createdBy: requestedBy || pipeline.createdBy || null
        });

        // 3. Create CI Activity record
        const activity = await supabaseService.saveCiActivity({
            workspaceId: pipeline.workspaceId,
            pipelineId: pipeline.id,
            pipelineName: pipeline.name,
            runId: run.id,
            provider: pipeline.provider,
            repository: pipeline.repository,
            branch,
            commitSha,
            commitMessage: commitMessage ? commitMessage.slice(0, 200) : '',
            author,
            prNumber,
            deliveryId,
            triggerType,
            status: 'running',
            startedAt: new Date().toISOString()
        });

        // 4. Report initial 'pending' status check to GitHub if commitSha is present
        if (commitSha && pipeline.provider === 'github') {
            const token = await this._getDecryptedToken(pipeline.workspaceId, pipeline.provider);
            if (token) {
                const [owner, repoName] = pipeline.repository.split('/');
                if (owner && repoName) {
                    const provider = getProvider('github');
                    await provider.reportStatus({ token }, {
                        owner,
                        repo: repoName,
                        commitSha,
                        state: 'pending',
                        description: 'TestNexa AI: Playwright execution running...',
                        targetUrl: `${this._getAppUrl()}/app/runs/${run.id}`,
                        context: `TestNexa AI / ${pipeline.name}`
                    });
                }
            }
        }

        // 5. Submit job to existing Playwright jobQueue
        let job = null;
        try {
            job = await jobQueue.submitJob({
                runId: run.id,
                workspaceId: pipeline.workspaceId,
                adapter: 'playwright',
                targetEnvironment: {
                    ...(pipeline.targetEnvironment || {}),
                    browser: pipeline.browser || 'chromium'
                },
                requestedBy: requestedBy || pipeline.createdBy || null
            });
        } catch (jobErr) {
            logger.error(`[CI/CD] Failed to enqueue job for run ${run.id}:`, jobErr.message);
            await supabaseService.updateCiActivity(activity.id, {
                status: 'error',
                errorMessage: jobErr.message,
                completedAt: new Date().toISOString()
            });

            // Report error to GitHub
            if (commitSha && pipeline.provider === 'github') {
                const token = await this._getDecryptedToken(pipeline.workspaceId, pipeline.provider);
                if (token) {
                    const [owner, repoName] = pipeline.repository.split('/');
                    if (owner && repoName) {
                        const provider = getProvider('github');
                        await provider.reportStatus({ token }, {
                            owner,
                            repo: repoName,
                            commitSha,
                            state: 'error',
                            description: `TestNexa AI error: ${jobErr.message.slice(0, 100)}`,
                            targetUrl: `${this._getAppUrl()}/app/runs/${run.id}`,
                            context: `TestNexa AI / ${pipeline.name}`
                        });
                    }
                }
            }

            throw jobErr;
        }

        return {
            runId: run.id,
            jobId: job?.id,
            activityId: activity.id,
            status: 'running'
        };
    }

    /**
     * Handles webhook payload from a CI/CD provider
     */
    async handleWebhook(providerId, headers, body, rawBody) {
        const provider = getProvider(providerId);
        if (!provider || !provider.isAvailable) {
            return { success: false, statusCode: 400, message: `Unsupported provider: ${providerId}` };
        }

        const deliveryId = headers['x-github-delivery'] || headers['X-GitHub-Delivery'];

        // Replay and duplicate event prevention
        if (deliveryId && supabaseService.isCiDeliveryProcessed(deliveryId)) {
            logger.info(`[CI/CD Webhook] Duplicate delivery ${deliveryId} ignored`);
            return { success: true, statusCode: 200, duplicate: true, message: 'Event already processed' };
        }

        // Quick repository lookup from payload
        let repoFullName = body?.repository?.full_name || '';
        let branch = (body?.ref || '').replace(/^refs\/heads\//, '');
        if (!branch && body?.pull_request?.head?.ref) {
            branch = body.pull_request.head.ref;
        }
        const eventType = headers['x-github-event'] || headers['X-GitHub-Event'] || 'unknown';

        if (!repoFullName) {
            return { success: false, statusCode: 400, message: 'Missing repository full_name in payload' };
        }

        // Find candidate active pipelines matching this repository
        const candidatePipelines = await supabaseService.findMatchingPipelines({
            repository: repoFullName,
            branch,
            eventType
        });

        if (candidatePipelines.length === 0) {
            // Check if ping event
            if (eventType === 'ping') {
                return { success: true, statusCode: 200, message: 'Ping acknowledged' };
            }
            logger.info(`[CI/CD Webhook] No matching active pipelines found for repo ${repoFullName} branch ${branch} event ${eventType}`);
            return {
                success: true,
                statusCode: 200,
                matched: 0,
                message: `No active pipeline configured for ${repoFullName} on ${branch}`
            };
        }

        let verifiedPipelines = [];
        let errors = [];

        // Verify webhook signature against matching pipelines
        for (const pipeline of candidatePipelines) {
            const verification = provider.verifyAndParseWebhook(
                headers,
                body,
                rawBody || Buffer.from(JSON.stringify(body)),
                pipeline.webhookSecret
            );

            if (verification.valid) {
                verifiedPipelines.push({ pipeline, event: verification.event });
            } else {
                errors.push(verification.error);
            }
        }

        if (verifiedPipelines.length === 0) {
            logger.warn(`[CI/CD Webhook] Signature verification failed for all candidates of repo ${repoFullName}`);
            return {
                success: false,
                statusCode: 401,
                message: 'Webhook signature verification failed',
                details: errors
            };
        }

        // Mark delivery as processed
        if (deliveryId) {
            supabaseService.recordCiDelivery(deliveryId);
        }

        // Dispatch execution for verified pipelines
        const dispatched = [];
        for (const { pipeline, event } of verifiedPipelines) {
            try {
                const res = await this.dispatchPipelineExecution(pipeline, {
                    triggerType: event.eventType,
                    branch: event.branch,
                    commitSha: event.commitSha,
                    commitMessage: event.commitMessage,
                    author: event.author,
                    prNumber: event.prNumber,
                    deliveryId
                });
                dispatched.push({ pipelineId: pipeline.id, runId: res.runId });
            } catch (dispatchErr) {
                logger.error(`[CI/CD] Failed to dispatch pipeline ${pipeline.id}:`, dispatchErr.message);
                dispatched.push({ pipelineId: pipeline.id, error: dispatchErr.message });
            }
        }

        return {
            success: true,
            statusCode: 200,
            matched: candidatePipelines.length,
            dispatched
        };
    }

    /**
     * Manually triggers a pipeline execution
     */
    async triggerPipelineManually(workspaceId, pipelineId, options = {}) {
        const pipeline = await supabaseService.getCiPipelineById(workspaceId, pipelineId);
        if (!pipeline) {
            throw new Error(`Pipeline ${pipelineId} not found`);
        }

        return await this.dispatchPipelineExecution(pipeline, {
            triggerType: 'manual',
            branch: options.branch || pipeline.branch,
            commitSha: options.commitSha || null,
            commitMessage: options.commitMessage || 'Manual dashboard execution dispatch',
            author: options.triggeredBy || 'TestNexa User',
            requestedBy: options.userId || null
        });
    }

    /**
     * Handles completion of a test run dispatched by CI
     */
    async _handleExecutionFinished(event) {
        const { runId, workspaceId, status, passed, failed, total } = event;
        if (!runId || !workspaceId) return;

        // Find activity item for this run
        const activities = await supabaseService.getCiActivity(workspaceId);
        const activity = activities.find(a => a.runId === runId);
        if (!activity) return; // Not a CI-triggered run

        const finalStatus = (status === 'completed' || status === 'passed')
            ? 'passed'
            : (status === 'failed' ? 'failed' : 'error');

        const now = new Date().toISOString();
        const durationSeconds = activity.startedAt
            ? Math.round((new Date(now) - new Date(activity.startedAt)) / 1000)
            : 0;

        await supabaseService.updateCiActivity(activity.id, {
            status: finalStatus,
            passedCases: passed || 0,
            failedCases: failed || 0,
            totalCases: total || 0,
            durationSeconds,
            completedAt: now
        });

        // Report commit status check to provider
        if (activity.commitSha && activity.provider === 'github') {
            const token = await this._getDecryptedToken(workspaceId, activity.provider);
            if (!token) return;

            const [owner, repoName] = (activity.repository || '').split('/');
            if (!owner || !repoName) return;

            const provider = getProvider('github');
            const passRate = total > 0 ? Math.round(((passed || 0) / total) * 100) : 0;
            const description = finalStatus === 'passed'
                ? `TestNexa AI: All ${passed || total} tests passed (${passRate}%)`
                : (finalStatus === 'failed'
                    ? `TestNexa AI: ${failed} failed of ${total} tests (${passRate}% pass rate)`
                    : 'TestNexa AI: Execution encountered an error');

            await provider.reportStatus({ token }, {
                owner,
                repo: repoName,
                commitSha: activity.commitSha,
                state: finalStatus === 'passed' ? 'success' : (finalStatus === 'failed' ? 'failure' : 'error'),
                description,
                targetUrl: `${this._getAppUrl()}/app/runs/${runId}`,
                context: `TestNexa AI / ${activity.pipelineName || 'Quality Gate'}`
            });
        }
    }

    /**
     * Lists pipeline execution activity
     */
    async getActivity(workspaceId, filters = {}) {
        return await supabaseService.getCiActivity(workspaceId, filters);
    }

    /**
     * Generates setup instructions and workflow YAML
     */
    async generateSetupInstructions(workspaceId, providerId, pipelineId = null) {
        const provider = getProvider(providerId);
        if (!provider) throw new Error(`Unknown provider: ${providerId}`);

        let pipeline = null;
        if (pipelineId) {
            pipeline = await supabaseService.getCiPipelineById(workspaceId, pipelineId);
        }

        const appUrl = this._getAppUrl();
        const webhookUrl = `${appUrl}/api/v1/integrations/cicd/webhooks/${provider.id}`;

        const workflowYaml = provider.generateWorkflowTemplate({
            branch: pipeline?.branch || 'main',
            repo: pipeline?.repository || 'owner/repo',
            appUrl,
            pipelineId: pipeline?.id || 'YOUR_PIPELINE_ID'
        });

        return {
            provider: provider.id,
            providerName: provider.name,
            webhookUrl,
            webhookSecret: pipeline?.webhookSecret || 'YOUR_GENERATED_WEBHOOK_SECRET',
            workflowYaml,
            supportedEvents: ['push', 'pull_request', 'workflow_dispatch'],
            setupSteps: [
                {
                    step: 1,
                    title: 'Generate GitHub Personal Access Token',
                    details: 'Create a fine-grained or classic token with "repo" and "repo:status" permissions and connect it in TestNexa AI.'
                },
                {
                    step: 2,
                    title: 'Add Repository Secret',
                    details: 'In your GitHub repository, navigate to Settings > Secrets and variables > Actions, and add TESTNEXA_API_KEY with your workspace API key.'
                },
                {
                    step: 3,
                    title: 'Configure GitHub Webhook (Optional for direct webhooks)',
                    details: `In GitHub repo Settings > Webhooks, add Payload URL "${webhookUrl}", Content type "application/json", and your pipeline secret.`
                },
                {
                    step: 4,
                    title: 'Commit Workflow YAML',
                    details: 'Add the generated YAML file to your repository at .github/workflows/testnexa-qa.yml and push to GitHub.'
                }
            ]
        };
    }
}

module.exports = new CiCdIntegrationService();

