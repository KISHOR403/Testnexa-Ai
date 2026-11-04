/**
 * TestNexa AI — GitHub Actions CI/CD Provider Implementation
 * Implements real GitHub API integration:
 * - Token verification & OAuth scope discovery
 * - Repository & branch inspection
 * - HMAC-SHA256 webhook signature verification (X-Hub-Signature-256)
 * - Event normalization (push, pull_request, workflow_dispatch)
 * - Commit status check reporting (POST /repos/{owner}/{repo}/statuses/{sha})
 * - Workflow template generation for .github/workflows/testnexa.yml
 */

const crypto = require('crypto');
const BaseCiProvider = require('./baseCiProvider');
const logger = require('../../../utils/logger');

class GitHubProvider extends BaseCiProvider {
    constructor() {
        super('github', 'GitHub Actions', {
            isAvailable: true,
            status: 'available',
            description: 'Trigger Playwright test suites on Push, Pull Request, and Dispatch events with commit status checks.'
        });
        this.apiBaseUrl = 'https://api.github.com';
    }

    /**
     * Common fetch helper with GitHub API headers and timeout
     */
    async _githubFetch(endpoint, options = {}, token) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.apiBaseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            const headers = {
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'TestNexa-AI-Runner',
                'X-GitHub-Api-Version': '2022-11-28',
                ...(token ? { 'Authorization': `Bearer ${token.trim()}` } : {}),
                ...(options.headers || {})
            };

            const res = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal
            });

            return res;
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Verifies GitHub token and returns authenticated user and scope metadata
     */
    async verifyCredentials(credentials) {
        const token = credentials?.token;
        if (!token || typeof token !== 'string' || !token.trim()) {
            return { valid: false, message: 'GitHub Personal Access Token is required' };
        }

        try {
            const res = await this._githubFetch('/user', { method: 'GET' }, token);
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                return {
                    valid: false,
                    message: errBody.message || `GitHub authentication failed (HTTP ${res.status})`
                };
            }

            const data = await res.json();
            const scopesHeader = res.headers.get('x-oauth-scopes') || '';
            const scopes = scopesHeader.split(',').map(s => s.trim()).filter(Boolean);

            return {
                valid: true,
                user: {
                    id: data.id,
                    login: data.login,
                    name: data.name || data.login,
                    avatarUrl: data.avatar_url,
                    htmlUrl: data.html_url,
                    accountType: data.type || 'User'
                },
                scopes,
                tokenType: token.startsWith('github_pat_') ? 'fine_grained' : 'classic'
            };
        } catch (err) {
            logger.warn('GitHub credential verification network error:', err.message);
            return {
                valid: false,
                message: err.name === 'AbortError' ? 'GitHub API request timed out' : `Connection error: ${err.message}`
            };
        }
    }

    /**
     * Lists repositories accessible with credentials
     */
    async getRepositories(credentials) {
        const token = credentials?.token;
        if (!token) return [];

        try {
            const res = await this._githubFetch('/user/repos?per_page=100&sort=updated', { method: 'GET' }, token);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to fetch repositories (HTTP ${res.status})`);
            }

            const repos = await res.json();
            if (!Array.isArray(repos)) return [];

            return repos.map(repo => ({
                id: String(repo.id),
                name: repo.name,
                fullName: repo.full_name,
                owner: repo.owner?.login || '',
                defaultBranch: repo.default_branch || 'main',
                private: Boolean(repo.private),
                htmlUrl: repo.html_url,
                description: repo.description || '',
                updatedAt: repo.updated_at
            }));
        } catch (err) {
            logger.error('Failed to list GitHub repositories:', err.message);
            throw err;
        }
    }

    /**
     * Lists branches for a specific repository
     */
    async getBranches(credentials, owner, repo) {
        const token = credentials?.token;
        if (!token) return [];
        if (!owner || !repo) throw new Error('Repository owner and name are required');

        try {
            const res = await this._githubFetch(`/repos/${owner}/${repo}/branches?per_page=100`, { method: 'GET' }, token);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Failed to fetch branches (HTTP ${res.status})`);
            }

            const branches = await res.json();
            if (!Array.isArray(branches)) return [];

            return branches.map(b => ({
                name: b.name,
                protected: Boolean(b.protected),
                sha: b.commit?.sha || null
            }));
        } catch (err) {
            logger.error(`Failed to list branches for ${owner}/${repo}:`, err.message);
            throw err;
        }
    }

    /**
     * Validates incoming webhook signature and parses payload into normalized event
     */
    verifyAndParseWebhook(headers, body, rawBody, secret) {
        const sigHeader = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
        const eventType = headers['x-github-event'] || headers['X-GitHub-Event'];
        const deliveryId = headers['x-github-delivery'] || headers['X-GitHub-Delivery'] || `del_${Date.now()}`;

        if (!secret) {
            return { valid: false, error: 'Webhook secret is not configured for this pipeline' };
        }

        if (!sigHeader) {
            return { valid: false, error: 'Missing X-Hub-Signature-256 header' };
        }

        // Verify HMAC-SHA256 signature
        try {
            const expectedSignature = 'sha256=' + crypto
                .createHmac('sha256', secret)
                .update(rawBody)
                .digest('hex');

            const sigBuffer = Buffer.from(sigHeader, 'utf8');
            const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

            if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
                return { valid: false, error: 'Invalid HMAC-SHA256 signature' };
            }
        } catch (sigErr) {
            return { valid: false, error: 'Signature verification calculation failed: ' + sigErr.message };
        }

        // Parse normalized event details
        let parsed = body;
        if (typeof parsed === 'string') {
            try {
                parsed = JSON.parse(parsed);
            } catch (e) {
                return { valid: false, error: 'Malformed JSON payload' };
            }
        }

        const normalized = {
            provider: 'github',
            deliveryId,
            eventType,
            repository: parsed.repository?.full_name || '',
            owner: parsed.repository?.owner?.login || '',
            repoName: parsed.repository?.name || '',
            isPrivate: Boolean(parsed.repository?.private),
            sender: parsed.sender?.login || 'github',
            raw: parsed
        };

        if (eventType === 'push') {
            // Ignore branch deletion events
            if (parsed.deleted) {
                return { valid: false, error: 'Ignored branch deletion push event' };
            }

            normalized.branch = (parsed.ref || '').replace(/^refs\/heads\//, '');
            normalized.commitSha = parsed.after || parsed.head_commit?.id || null;
            normalized.commitMessage = parsed.head_commit?.message || 'Push event';
            normalized.author = parsed.head_commit?.author?.name || parsed.sender?.login || 'Unknown';
            normalized.commitUrl = parsed.head_commit?.url || parsed.compare || null;
        } else if (eventType === 'pull_request') {
            const action = parsed.action;
            const validActions = ['opened', 'synchronize', 'reopened'];
            if (!validActions.includes(action)) {
                return { valid: false, error: `Ignored pull_request action: ${action}` };
            }

            normalized.action = action;
            normalized.branch = parsed.pull_request?.head?.ref || '';
            normalized.baseBranch = parsed.pull_request?.base?.ref || '';
            normalized.commitSha = parsed.pull_request?.head?.sha || null;
            normalized.commitMessage = parsed.pull_request?.title || 'Pull Request';
            normalized.prNumber = parsed.pull_request?.number || null;
            normalized.prUrl = parsed.pull_request?.html_url || null;
            normalized.author = parsed.pull_request?.user?.login || parsed.sender?.login || 'Unknown';
        } else if (eventType === 'workflow_dispatch') {
            normalized.branch = (parsed.ref || '').replace(/^refs\/heads\//, '') || 'main';
            normalized.commitSha = parsed.workflow_run?.head_sha || parsed.inputs?.commit_sha || null;
            normalized.commitMessage = parsed.inputs?.message || 'Manual workflow dispatch trigger';
            normalized.author = parsed.sender?.login || 'Unknown';
        } else if (eventType === 'ping') {
            return {
                valid: true,
                isPing: true,
                zen: parsed.zen,
                repository: normalized.repository,
                deliveryId
            };
        } else {
            return { valid: false, error: `Unsupported GitHub event type: ${eventType}` };
        }

        return { valid: true, event: normalized };
    }

    /**
     * Reports execution status back to GitHub via Commit Status API
     * POST /repos/{owner}/{repo}/statuses/{sha}
     */
    async reportStatus(credentials, options = {}) {
        const token = credentials?.token;
        const {
            owner,
            repo,
            commitSha,
            state, // 'pending' | 'success' | 'failure' | 'error'
            description,
            targetUrl,
            context = 'TestNexa AI / Quality Gate'
        } = options;

        if (!token) {
            return { success: false, error: 'GitHub token not provided for status check' };
        }
        if (!owner || !repo || !commitSha) {
            return { success: false, error: 'owner, repo, and commitSha are required to report status' };
        }

        // Map status
        let mappedState = 'error';
        const s = (state || '').toLowerCase();
        if (['pending', 'queued', 'running'].includes(s)) mappedState = 'pending';
        else if (['success', 'passed', 'completed'].includes(s)) mappedState = 'success';
        else if (['failure', 'failed'].includes(s)) mappedState = 'failure';
        else mappedState = 'error';

        const payload = {
            state: mappedState,
            target_url: targetUrl || '',
            description: (description || `TestNexa AI execution ${mappedState}`).slice(0, 140),
            context
        };

        try {
            const res = await this._githubFetch(
                `/repos/${owner}/${repo}/statuses/${commitSha}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                },
                token
            );

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                logger.warn(`GitHub commit status check returned ${res.status}:`, errBody.message);
                return { success: false, error: errBody.message || `HTTP ${res.status}` };
            }

            const data = await res.json();
            return { success: true, data };
        } catch (err) {
            logger.warn('Failed to report GitHub commit status check:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Generates standard GitHub Actions workflow YAML
     */
    generateWorkflowTemplate(options = {}) {
        const {
            branch = 'main',
            repo = 'your-org/your-repo',
            appUrl = 'https://app.testnexa.ai',
            pipelineId = 'YOUR_PIPELINE_ID'
        } = options;

        return `# .github/workflows/testnexa-qa.yml
# TestNexa AI — Automated Playwright QA Gate
# Automatically triggers and reports test executions on GitHub pull requests and push events.

name: TestNexa AI Quality Gate

on:
  push:
    branches: [ ${branch} ]
  pull_request:
    branches: [ ${branch} ]
  workflow_dispatch:
    inputs:
      test_suite:
        description: 'Optional suite override'
        required: false

jobs:
  testnexa-execution:
    name: Verify Quality Gate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Trigger TestNexa AI Automated Suite
        id: testnexa
        run: |
          echo "Dispatching execution to TestNexa AI..."
          RESPONSE=$(curl -s -X POST "${appUrl}/api/v1/integrations/cicd/pipelines/${pipelineId}/trigger" \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer \${{ secrets.TESTNEXA_API_KEY }}" \\
            -d '{
              "branch": "\${{ github.ref_name }}",
              "commitSha": "\${{ github.sha }}",
              "commitMessage": "\${{ github.event.head_commit.message || github.event.pull_request.title }}",
              "sender": "\${{ github.actor }}"
            }')
          echo "Response: $RESPONSE"
`;
    }
}

module.exports = new GitHubProvider();

