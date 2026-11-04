/**
 * TestNexa AI — CI/CD Integrations Frontend Service
 */

const API_BASE = '/api/v1/integrations/cicd';

const getAuthHeaders = () => {
    const headers = {
        'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const handleResponse = async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.error || `Request failed with status ${res.status}`);
    }
    return data;
};

export const cicdService = {
    async getProviders() {
        const res = await fetch(`${API_BASE}/providers`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getConnectionStatus(provider = 'github', workspaceId) {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
        const res = await fetch(`${API_BASE}/${provider}/status${query}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async connectProvider(provider = 'github', payload) {
        const res = await fetch(`${API_BASE}/${provider}/connect`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    async disconnectProvider(provider = 'github', workspaceId) {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
        const res = await fetch(`${API_BASE}/${provider}/disconnect${query}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getRepositories(provider = 'github', workspaceId) {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
        const res = await fetch(`${API_BASE}/${provider}/repositories${query}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getBranches(provider = 'github', owner, repo, workspaceId) {
        const params = new URLSearchParams({ owner, repo });
        if (workspaceId) params.append('workspaceId', workspaceId);
        const res = await fetch(`${API_BASE}/${provider}/branches?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getPipelines(workspaceId, filters = {}) {
        const params = new URLSearchParams(filters);
        if (workspaceId) params.append('workspaceId', workspaceId);
        const res = await fetch(`${API_BASE}/pipelines?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getPipeline(id, workspaceId) {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
        const res = await fetch(`${API_BASE}/pipelines/${id}${query}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async createPipeline(pipelineData) {
        const res = await fetch(`${API_BASE}/pipelines`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(pipelineData)
        });
        return handleResponse(res);
    },

    async updatePipeline(id, updates, workspaceId) {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
        const res = await fetch(`${API_BASE}/pipelines/${id}${query}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(res);
    },

    async deletePipeline(id, workspaceId) {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
        const res = await fetch(`${API_BASE}/pipelines/${id}${query}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async triggerPipeline(id, triggerData = {}) {
        const res = await fetch(`${API_BASE}/pipelines/${id}/trigger`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(triggerData)
        });
        return handleResponse(res);
    },

    async getActivity(workspaceId, filters = {}) {
        const params = new URLSearchParams(filters);
        if (workspaceId) params.append('workspaceId', workspaceId);
        const res = await fetch(`${API_BASE}/activity?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getSetupInstructions(provider = 'github', pipelineId = null, workspaceId) {
        const params = new URLSearchParams();
        if (pipelineId) params.append('pipelineId', pipelineId);
        if (workspaceId) params.append('workspaceId', workspaceId);
        const res = await fetch(`${API_BASE}/instructions/${provider}?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    }
};

export default cicdService;

