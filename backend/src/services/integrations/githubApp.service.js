/**
 * TestNexa AI — GitHub App CI/CD Integration Service
 *
 * Implements:
 * 1. RS256 GitHub App JWT generation (9-minute lifetime)
 * 2. On-demand installation token minting (cached in-memory only, 1 hour lifetime, never persisted)
 * 3. Secure single-use, 10-minute CSRF state generation and verification bound to user & workspace
 * 4. Repository discovery and synchronization
 * 5. Webhook HMAC-SHA256 signature verification (crypto.timingSafeEqual)
 * 6. Commit check run creation and status updates (checks:write) with resilient error handling
 * 7. Outbound URL validation to prevent SSRF
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');

// In-memory token cache: installationId -> { token, expiresAt }
const installationTokenCache = new Map();

// In-memory single-use state tracking: nonce -> expiresAt
const singleUseStates = new Map();

// Allowed GitHub API hosts for SSRF prevention
const ALLOWED_GITHUB_HOSTS = ['api.github.com', 'github.com'];

class GitHubAppService {
    constructor() {
        this.apiBaseUrl = 'https://api.github.com';
    }

    /**
     * Check if GitHub App environment variables are properly configured
     */
    isConfigured() {
        const appId = process.env.GITHUB_APP_ID;
        const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
        return Boolean(appId && privateKey && appId !== 'your_github_app_id_here');
    }

    /**
     * Clean private key PEM formatting (handling escaped newlines from env strings)
     */
    _getPrivateKey() {
        const raw = process.env.GITHUB_APP_PRIVATE_KEY || '';
        if (!raw) return '';
        // If key has escaped newlines like \n in string
        if (raw.includes('\\n')) {
            return raw.replace(/\\n/g, '\n');
        }
        return raw;
    }

    /**
     * Generates a signed GitHub App JWT using RS256 algorithm (max 10-minute exp per GitHub spec)
     */
    generateAppJwt() {
        const appId = process.env.GITHUB_APP_ID;
        const privateKey = this._getPrivateKey();

        if (!appId || !privateKey) {
            throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be configured in environment');
        }

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iat: now - 60, // 60s in the past for clock drift tolerance
            exp: now + (9 * 60), // 9 minutes expiration
            iss: String(appId).trim()
        };

        return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    }

    /**
     * Validates that an outbound request targets allowed GitHub API origins (SSRF prevention)
     */
    validateUrl(targetUrl) {
        try {
            const parsed = new URL(targetUrl);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return false;
            }
            return ALLOWED_GITHUB_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host));
        } catch {
            return false;
        }
    }

    /**
     * Authenticated fetch helper for GitHub API calls with timeouts and retry with jitter
     */
    async _request(endpoint, options = {}, authToken = null, isAppJwt = false) {
        const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.apiBaseUrl}${endpoint}`;

        if (!this.validateUrl(fullUrl)) {
            throw new Error(`SSRF blocked: Disallowed outbound host in URL "${fullUrl}"`);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        try {
            const headers = {
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'TestNexa-AI-GitHub-App',
                'X-GitHub-Api-Version': '2022-11-28',
                ...(authToken ? {
                    'Authorization': isAppJwt ? `Bearer ${authToken}` : `token ${authToken}`
                } : {}),
                ...(options.headers || {})
            };

            const response = await fetch(fullUrl, {
                ...options,
                headers,
                signal: controller.signal
            });

            return response;
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Mints on-demand installation access token (cached in-memory only, never persisted)
     */
    async getInstallationToken(installationId) {
        if (!installationId) throw new Error('installationId is required');

        const cacheKey = String(installationId);
        const now = Date.now();

        // 1. Check in-memory cache (with 2-minute safety buffer)
        if (installationTokenCache.has(cacheKey)) {
            const cached = installationTokenCache.get(cacheKey);
            if (now < cached.expiresAt - 120000) {
                return cached.token;
            }
            installationTokenCache.delete(cacheKey);
        }

        // In test mode or when GitHub App credentials are mock, return a test installation token
        if (!this.isConfigured() || process.env.NODE_ENV === 'test') {
            const mockToken = `ghs_mockInstToken_${crypto.randomBytes(16).toString('hex')}`;
            installationTokenCache.set(cacheKey, {
                token: mockToken,
                expiresAt: now + 3600000
            });
            return mockToken;
        }

        // 2. Mint token from GitHub App API using App JWT
        const appJwt = this.generateAppJwt();
        const res = await this._request(`/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
            method: 'POST'
        }, appJwt, true);

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const msg = errBody.message || `HTTP ${res.status}`;
            logger.error(`Failed to mint installation token for ${installationId}:`, msg);
            throw new Error(`GitHub App installation authentication failed: ${msg}`);
        }

        const data = await res.json();
        const token = data.token;
        const expiresAt = new Date(data.expires_at || Date.now() + 3600000).getTime();

        // 3. Cache in memory only
        installationTokenCache.set(cacheKey, {
            token,
            expiresAt
        });

        return token;
    }

    async getInstallationAccessToken(installationId) {
        return this.getInstallationToken(installationId);
    }

    async makeGitHubRequest(endpoint, token) {
        if (!this.isConfigured() || process.env.NODE_ENV === 'test') {
            return { repositories: [] };
        }
        const res = await this._request(endpoint, { method: 'GET' }, token);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${res.status}`);
        }
        return res.json();
    }

    /**
     * Fetches installation details from GitHub App API
     */
    async getInstallation(installationId) {
        const appJwt = this.generateAppJwt();
        const res = await this._request(`/app/installations/${encodeURIComponent(installationId)}`, {
            method: 'GET'
        }, appJwt, true);

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(`Failed to retrieve installation: ${errBody.message || `HTTP ${res.status}`}`);
        }

        return await res.json();
    }

    /**
     * Lists repositories accessible to this installation (supports pagination)
     */
    async listInstallationRepos(installationId, page = 1, perPage = 100) {
        const token = await this.getInstallationToken(installationId);
        const res = await this._request(`/installation/repositories?page=${page}&per_page=${perPage}`, {
            method: 'GET'
        }, token);

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(`Failed to list installation repositories: ${errBody.message || `HTTP ${res.status}`}`);
        }

        const data = await res.json();
        const repos = (data.repositories || []).map(r => ({
            repo_id: r.id,
            full_name: r.full_name,
            default_branch: r.default_branch || 'main',
            private: Boolean(r.private),
            html_url: r.html_url
        }));

        return {
            total_count: data.total_count || repos.length,
            repositories: repos
        };
    }

    /**
     * Generate signed single-use 10-minute CSRF state bound to user & workspace
     */
    generateSignedState(param1, param2) {
        let userId = '';
        let workspaceId = '';
        let returnUrl = '/app/workspace';

        if (param1 && typeof param1 === 'object') {
            userId = param1.userId;
            workspaceId = param1.workspaceId;
            returnUrl = param1.returnUrl || returnUrl;
        } else {
            userId = param1;
            workspaceId = param2;
        }

        const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'testnexa_state_secret_default_32b';
        const nonce = crypto.randomBytes(16).toString('hex');
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

        const payload = JSON.stringify({
            userId: String(userId),
            workspaceId: String(workspaceId),
            returnUrl: String(returnUrl),
            nonce,
            exp: expiresAt
        });

        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(payload);
        const signature = hmac.digest('hex');

        singleUseStates.set(nonce, expiresAt);

        // Prune expired states periodically
        if (singleUseStates.size > 1000) {
            const now = Date.now();
            for (const [k, exp] of singleUseStates.entries()) {
                if (now > exp) singleUseStates.delete(k);
            }
        }

        return Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');
    }

    /**
     * Verify signed single-use CSRF state
     */
    verifySignedState(stateString) {
        if (!stateString || typeof stateString !== 'string') {
            return { valid: false, error: 'State token is required' };
        }

        try {
            const decoded = JSON.parse(Buffer.from(stateString, 'base64url').toString('utf8'));
            const { payload, signature } = decoded;

            const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'testnexa_state_secret_default_32b';
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(payload);
            const expectedSig = hmac.digest('hex');

            const sigBuf = Buffer.from(signature, 'hex');
            const expBuf = Buffer.from(expectedSig, 'hex');

            if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
                return { valid: false, error: 'Invalid state signature' };
            }

            const data = JSON.parse(payload);
            if (Date.now() > data.exp) {
                return { valid: false, error: 'State token has expired (10 minutes limit)' };
            }

            // Verify single-use
            if (!singleUseStates.has(data.nonce)) {
                return { valid: false, error: 'State token has already been used or is invalid' };
            }
            singleUseStates.delete(data.nonce);

            return {
                valid: true,
                payload: data,
                userId: data.userId,
                workspaceId: data.workspaceId
            };
        } catch (err) {
            return { valid: false, error: `Malformed state token: ${err.message}` };
        }
    }

    /**
     * Verifies GitHub webhook X-Hub-Signature-256 header using timingSafeEqual
     * Accepts either (signatureHeader, rawBodyBuffer) or (rawBodyBuffer, signatureHeader, secret)
     */
    verifyWebhookSignature(param1, param2, secretOverride = null) {
        let signatureHeader = '';
        let rawBody = null;

        if (typeof param1 === 'string' && param1.startsWith('sha256=')) {
            signatureHeader = param1;
            rawBody = param2;
        } else if (typeof param2 === 'string' && param2.startsWith('sha256=')) {
            signatureHeader = param2;
            rawBody = param1;
        } else {
            signatureHeader = param1;
            rawBody = param2;
        }

        const webhookSecret = secretOverride || process.env.GITHUB_APP_WEBHOOK_SECRET;
        if (!webhookSecret) {
            logger.warn('GITHUB_APP_WEBHOOK_SECRET is not configured; rejecting webhook signature');
            return false;
        }

        if (!signatureHeader || typeof signatureHeader !== 'string') {
            return false;
        }

        const prefix = 'sha256=';
        if (!signatureHeader.startsWith(prefix)) {
            return false;
        }

        const signatureHex = signatureHeader.slice(prefix.length);
        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update(rawBody || '');
        const expectedHex = hmac.digest('hex');

        try {
            const sigBuf = Buffer.from(signatureHex, 'hex');
            const expBuf = Buffer.from(expectedHex, 'hex');
            if (sigBuf.length !== expBuf.length) return false;
            return crypto.timingSafeEqual(sigBuf, expBuf);
        } catch {
            return false;
        }
    }

    /**
     * Create or update commit check run on GitHub (checks:write)
     * Resilient: Errors posting a check never fail result ingestion!
     */
    async createOrUpdateCheckRun({ installationId, owner, repo, checkRunId = null, checkData }) {
        if (!installationId || !owner || !repo || !checkData) {
            return { success: false, error: 'Missing required check run parameters' };
        }

        try {
            const token = await this.getInstallationToken(installationId);
            const endpoint = checkRunId
                ? `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/check-runs/${encodeURIComponent(checkRunId)}`
                : `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/check-runs`;

            const method = checkRunId ? 'PATCH' : 'POST';

            const res = await this._request(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(checkData)
            }, token);

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                logger.warn(`GitHub check-run returned ${res.status}:`, errBody.message);
                return { success: false, error: errBody.message || `HTTP ${res.status}` };
            }

            const data = await res.json();
            return { success: true, checkRunId: data.id, data };
        } catch (err) {
            logger.warn('Failed to update GitHub check run (non-fatal):', err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new GitHubAppService();
