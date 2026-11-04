/**
 * Test Maintenance Intelligence Service — Frontend API Client
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
        const error = new Error(errorData.message || `Request failed (${response.status})`);
        error.status = response.status;
        error.code = errorData.code;
        error.data = errorData;
        throw error;
    }
    return response.json();
};

export const maintenanceService = {
    /**
     * Get maintenance intelligence overview and findings
     */
    getOverview: async ({
        workspaceId,
        suiteId,
        startDate,
        endDate,
        browser,
        environment,
        issueType,
        classification,
        status,
        search
    } = {}) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);
        if (suiteId && suiteId !== 'all') params.set('suiteId', suiteId);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (browser && browser !== 'all') params.set('browser', browser);
        if (environment && environment !== 'all') params.set('environment', environment);
        if (issueType && issueType !== 'all') params.set('issueType', issueType);
        if (classification && classification !== 'all') params.set('classification', classification);
        if (status && status !== 'all') params.set('status', status);
        if (search) params.set('search', search);

        const response = await fetch(`${API_BASE_URL}/maintenance/overview?${params.toString()}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Get finding by ID
     */
    getFinding: async (findingId, workspaceId) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);

        const response = await fetch(`${API_BASE_URL}/maintenance/findings/${encodeURIComponent(findingId)}?${params.toString()}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Update finding status (open, investigating, resolved, ignored)
     */
    updateFinding: async (findingId, { status, resolutionNotes, workspaceId }) => {
        const response = await fetch(`${API_BASE_URL}/maintenance/findings/${encodeURIComponent(findingId)}`, {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ status, resolutionNotes, workspaceId })
        });
        return handleResponse(response);
    },

    /**
     * Run on-demand AI analysis on a maintenance finding
     */
    analyzeWithAI: async (findingId, workspaceId) => {
        const response = await fetch(`${API_BASE_URL}/maintenance/findings/${encodeURIComponent(findingId)}/ai-analyze`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ workspaceId })
        });
        return handleResponse(response);
    }
};
