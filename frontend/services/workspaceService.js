/**
 * Workspace Service — API client for TestNexa AI Workspace Settings & Environments
 * Connects directly to /api/v1/workspaces endpoints with JWT authentication.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const getHeaders = () => {
    const token = localStorage.getItem('testnexa_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
};

const handleResponse = async (response) => {
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(json.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.code = json.code || 'UNKNOWN_ERROR';
        error.data = json.data;
        throw error;
    }
    return json;
};

export const workspaceService = {
    /**
     * Get the active workspace settings for current authenticated user
     */
    getCurrentWorkspace: async () => {
        const response = await fetch(`${API_BASE_URL}/workspaces/current`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return res.data;
    },

    /**
     * Get workspace settings for a specific workspace ID (defaults to 'current')
     */
    getSettings: async (workspaceId = 'current') => {
        const id = workspaceId || 'current';
        const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(id)}/settings`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return res.data;
    },

    /**
     * Update workspace settings (name, defaultEnvironmentId, version)
     * Supports updateSettings(payload) or updateSettings(workspaceId, payload)
     */
    updateSettings: async (workspaceIdOrPayload, maybePayload) => {
        let workspaceId = 'current';
        let payload = {};

        if (typeof workspaceIdOrPayload === 'string') {
            workspaceId = workspaceIdOrPayload;
            payload = maybePayload || {};
        } else if (typeof workspaceIdOrPayload === 'object' && workspaceIdOrPayload !== null) {
            payload = workspaceIdOrPayload;
            if (payload.workspaceId) workspaceId = payload.workspaceId;
        }

        const body = {};
        if (payload.name !== undefined) body.name = payload.name;
        if (payload.defaultEnvironmentId !== undefined) body.defaultEnvironmentId = payload.defaultEnvironmentId;
        if (payload.version !== undefined) body.version = payload.version;

        const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/settings`, {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(body)
        });
        const res = await handleResponse(response);
        return {
            success: res.success,
            message: res.message,
            workspace: res.data
        };
    },

    /**
     * List configured environments for a workspace (defaults to 'current')
     */
    getEnvironments: async (workspaceId = 'current') => {
        const id = workspaceId || 'current';
        const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(id)}/environments`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return {
            success: res.success,
            environments: res.data || []
        };
    }
};

export default workspaceService;
