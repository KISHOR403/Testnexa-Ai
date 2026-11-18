/**
 * Testnexa AI — CI/CD Integrations Frontend Service
 * Connects to GitHub App, Repositories, Pipelines, Workflow Generation,
 * and Token Management endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const getAuthHeaders = () => {
    const headers = {
        'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('testnexa_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const handleResponse = async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const error = new Error(data.message || data.error || `Request failed with status ${res.status}`);
        error.status = res.status;
        error.code = data.code;
        throw error;
    }
    return data;
};

export const cicdService = {
    /**
     * Get GitHub App installation URL with signed single-use state
     */
    async getInstallUrl(returnUrl = '/app/cicd', workspaceId = null) {
        const params = new URLSearchParams({ return_url: returnUrl });
        if (workspaceId) params.append('workspaceId', workspaceId);
        const res = await fetch(`${API_BASE_URL}/integrations/github/install-url?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        const json = await handleResponse(res);
        return json.data;
    },

    /**
     * List all integrations for the current workspace
     */
    async getIntegrations(workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/integrations${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        const json = await handleResponse(res);
        return json.data || [];
    },

    /**
     * Get specific integration details
     */
    async getIntegration(id, workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/integrations/${encodeURIComponent(id)}${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        const json = await handleResponse(res);
        return json.data;
    },

    /**
     * List repositories discovered for an integration
     */
    async getRepositories(integrationId, workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/integrations/${encodeURIComponent(integrationId)}/repos${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        const json = await handleResponse(res);
        return json.data || [];
    },

    /**
     * Sync repositories from GitHub API
     */
    async syncRepositories(integrationId, workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/integrations/${encodeURIComponent(integrationId)}/sync${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const json = await handleResponse(res);
        return json.data || [];
    },

    /**
     * Disconnect integration, pause associated pipelines and revoke tokens
     */
    async disconnectIntegration(integrationId, workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/integrations/${encodeURIComponent(integrationId)}${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    /**
     * List pipelines for the workspace
     */
    async getPipelines(workspaceId = null, filters = {}) {
        const params = new URLSearchParams(filters);
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/pipelines${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        const json = await handleResponse(res);
        return json.data || [];
    },

    /**
     * Get single pipeline details
     */
    async getPipeline(id, workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/pipelines/${encodeURIComponent(id)}${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        const json = await handleResponse(res);
        return json.data;
    },

    /**
     * Create new pipeline connecting repo to suite
     * Returns { pipeline, token, tokenPrefix } where token is returned ONLY ONCE!
     */
    async createPipeline(pipelineData) {
        const res = await fetch(`${API_BASE_URL}/pipelines`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(pipelineData)
        });
        return handleResponse(res);
    },

    /**
     * Update pipeline settings
     */
    async updatePipeline(id, patch, workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/pipelines/${encodeURIComponent(id)}${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(patch)
        });
        const json = await handleResponse(res);
        return json.data;
    },

    /**
     * Delete pipeline and revoke its tokens
     */
    async deletePipeline(id, workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/pipelines/${encodeURIComponent(id)}${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    /**
     * Rotate pipeline token: revokes old tokens and returns new token ONCE
     */
    async rotateToken(id, workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/pipelines/${encodeURIComponent(id)}/token${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const json = await handleResponse(res);
        return json.data;
    },

    /**
     * Get setup instructions and generated workflow YAML
     */
    async getPipelineSetup(id, workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/pipelines/${encodeURIComponent(id)}/setup${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        const json = await handleResponse(res);
        return json.data;
    },

    /**
     * Get Playwright test suite code (.spec.js)
     */
    async getPlaywrightSuiteExport(pipelineId) {
        const url = `${API_BASE_URL}/pipelines/${encodeURIComponent(pipelineId)}/export`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) {
            throw new Error(`Export failed with status ${res.status}`);
        }
        return res.text();
    },

    /**
     * Get test suites for selection in wizard
     */
    async getTestSuites(workspaceId = null) {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/test-suites${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        const json = await handleResponse(res);
        return json.data || [];
    },

    /**
     * Phase 2: Ingested CI execution runs feed
     */
    async getActivity(workspaceId = null, filters = {}) {
        const params = new URLSearchParams({ source: 'ci', ...filters });
        if (workspaceId) params.append('workspaceId', workspaceId);
        const url = `${API_BASE_URL}/runs${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        const json = await handleResponse(res);
        return json.data || json.runs || [];
    }
};

export default cicdService;
