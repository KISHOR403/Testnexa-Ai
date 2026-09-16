/**
 * Session Service — API client for WorkspaceSession CRUD
 * Source of truth for persistent user history (replaces localStorage).
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const getHeaders = () => {
    const token = localStorage.getItem('testnexa_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
};

const handleResponse = async (response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed (${response.status})`);
    }
    return response.json();
};

export const sessionService = {
    /**
     * List sessions with optional search, filter, sort, pagination
     */
    list: async ({ search, status, context, sort, page = 1, limit = 20 } = {}) => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        if (context) params.set('context', context);
        if (sort) params.set('sort', sort);
        params.set('page', page);
        params.set('limit', limit);

        const response = await fetch(`${API_BASE_URL}/sessions?${params}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include',
        });
        return handleResponse(response);
    },

    /**
     * Create a new session
     */
    create: async ({ requirement, context, depth, title } = {}) => {
        const response = await fetch(`${API_BASE_URL}/sessions`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ requirement, context, depth, title }),
        });
        return handleResponse(response);
    },

    /**
     * Get a single session with full data (messages, suiteData, versions)
     */
    get: async (sessionId) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
                method: 'GET',
                headers: getHeaders(),
                credentials: 'include',
                signal: controller.signal
            });
            return await handleResponse(response);
        } finally {
            clearTimeout(timeoutId);
        }
    },

    /**
     * Partial update a session
     */
    update: async (sessionId, patch) => {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(patch),
        });
        return handleResponse(response);
    },

    /**
     * Delete a session permanently
     */
    delete: async (sessionId) => {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: getHeaders(),
            credentials: 'include',
        });
        return handleResponse(response);
    },

    /**
     * Get version history for a session
     */
    getVersions: async (sessionId) => {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/versions`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include',
        });
        return handleResponse(response);
    },

    /**
     * Create a new version snapshot
     */
    createVersion: async (sessionId) => {
        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/versions`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
        });
        return handleResponse(response);
    },
};

export const testSuiteService = {
    list: async (params) => {
        const queryParams = new URLSearchParams();
        if (params?.search) queryParams.set('search', params.search);
        if (params?.status) queryParams.set('status', params.status);
        if (params?.context) queryParams.set('context', params.context);
        if (params?.sort) queryParams.set('sort', params.sort);
        if (params?.page) queryParams.set('page', params.page);
        if (params?.limit) queryParams.set('limit', params.limit);

        const response = await fetch(`${API_BASE_URL}/test-suites?${queryParams}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include',
        });
        return handleResponse(response);
    },
    get: async (id) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(`${API_BASE_URL}/test-suites/${id}`, {
                method: 'GET',
                headers: getHeaders(),
                credentials: 'include',
                signal: controller.signal
            });
            return await handleResponse(response);
        } finally {
            clearTimeout(timeoutId);
        }
    },
    create: async (data) => {
        const response = await fetch(`${API_BASE_URL}/test-suites`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
    update: async (id, patch) => {
        const response = await fetch(`${API_BASE_URL}/test-suites/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(patch),
        });
        return handleResponse(response);
    },
    delete: async (id) => {
        const response = await fetch(`${API_BASE_URL}/test-suites/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
            credentials: 'include',
        });
        return handleResponse(response);
    }
};

