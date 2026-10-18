/**
 * Billing Service — API client for TestNexa AI Subscription, Quota & Plans
 * Connects directly to /api/v1/workspaces/:workspaceId/billing
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

export const billingService = {
    /**
     * Get authoritative billing details, quota, and current cycle usage for workspace
     */
    getBilling: async (workspaceId = 'current') => {
        const id = workspaceId || 'current';
        const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(id)}/billing`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return res.data;
    },

    /**
     * Update workspace subscription tier (free, pro, team, enterprise)
     */
    updatePlan: async (workspaceId = 'current', { plan, interval = 'monthly' }) => {
        const id = workspaceId || 'current';
        const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(id)}/billing/plan`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ plan, interval })
        });
        const res = await handleResponse(response);
        return {
            success: res.success,
            message: res.message,
            billing: res.data
        };
    }
};

export default billingService;
