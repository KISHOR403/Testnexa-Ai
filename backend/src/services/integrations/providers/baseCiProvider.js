/**
 * TestNexa AI — Base CI/CD Provider Abstraction
 * Defines the standard contract for all CI/CD platforms (GitHub, GitLab, Jenkins).
 */

class BaseCiProvider {
    constructor(id, name, options = {}) {
        this.id = id;
        this.name = name;
        this.isAvailable = options.isAvailable !== undefined ? options.isAvailable : false;
        this.status = options.status || (this.isAvailable ? 'available' : 'coming_soon');
        this.description = options.description || '';
    }

    /**
     * Verifies provided credentials against the provider API
     * @param {Object} credentials - Decrypted provider credentials (e.g., token)
     * @returns {Promise<{ valid: boolean, user?: Object, scopes?: string[], message?: string }>}
     */
    async verifyCredentials(credentials) {
        throw new Error(`verifyCredentials is not implemented for provider ${this.id}`);
    }

    /**
     * Lists repositories accessible with credentials
     * @param {Object} credentials
     * @returns {Promise<Array<{ id: string, name: string, fullName: string, defaultBranch: string, private: boolean }>>}
     */
    async getRepositories(credentials) {
        throw new Error(`getRepositories is not implemented for provider ${this.id}`);
    }

    /**
     * Lists branches for a specific repository
     * @param {Object} credentials
     * @param {string} owner
     * @param {string} repo
     * @returns {Promise<Array<{ name: string, protected: boolean, sha?: string }>>}
     */
    async getBranches(credentials, owner, repo) {
        throw new Error(`getBranches is not implemented for provider ${this.id}`);
    }

    /**
     * Validates incoming webhook signature and parses payload into normalized event
     * @param {Object} headers - HTTP request headers
     * @param {Object} body - Parsed JSON body
     * @param {Buffer|string} rawBody - Raw unparsed body buffer
     * @param {string} secret - Configured webhook secret
     * @returns {{ valid: boolean, event?: Object, error?: string }}
     */
    verifyAndParseWebhook(headers, body, rawBody, secret) {
        throw new Error(`verifyAndParseWebhook is not implemented for provider ${this.id}`);
    }

    /**
     * Reports execution status back to the CI/CD provider
     * @param {Object} credentials
     * @param {Object} options - { owner, repo, commitSha, state, description, targetUrl, context, runId }
     * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
     */
    async reportStatus(credentials, options) {
        throw new Error(`reportStatus is not implemented for provider ${this.id}`);
    }

    /**
     * Generates standard workflow configuration instructions / YAML
     * @param {Object} options - { pipelineId, workspaceId, apiKeyPlaceholder, repo, branch, appUrl }
     * @returns {string}
     */
    generateWorkflowTemplate(options) {
        throw new Error(`generateWorkflowTemplate is not implemented for provider ${this.id}`);
    }
}

module.exports = BaseCiProvider;

