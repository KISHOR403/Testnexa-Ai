/**
 * Smart Test Recommendations Service — Frontend API Client
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

export const recommendationService = {
    /**
     * Generate smart test recommendations for a suite
     */
    generate: async ({ suiteId, requirementId, requestedCategories, focusArea, limit = 6 } = {}) => {
        const response = await fetch(`${API_BASE_URL}/recommendations/generate`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                suiteId,
                requirementId,
                requestedCategories,
                focusArea,
                limit
            })
        });
        return handleResponse(response);
    },

    /**
     * Retrieve the latest recommendations for a test suite
     */
    getSuiteRecommendations: async (suiteId) => {
        if (!suiteId) throw new Error('suiteId is required');
        const response = await fetch(`${API_BASE_URL}/recommendations/suites/${encodeURIComponent(suiteId)}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Retrieve a specific recommendation by ID
     */
    getRecommendation: async (id) => {
        if (!id) throw new Error('id is required');
        const response = await fetch(`${API_BASE_URL}/recommendations/${encodeURIComponent(id)}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Update recommendation status (accept, reject) or edit fields
     */
    update: async (id, { status, editedFields } = {}) => {
        if (!id) throw new Error('id is required');
        const response = await fetch(`${API_BASE_URL}/recommendations/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ status, editedFields })
        });
        return handleResponse(response);
    },

    /**
     * Convert accepted recommendations to draft test cases in the test suite
     */
    convertToDrafts: async ({ suiteId, recommendationIds }) => {
        if (!suiteId) throw new Error('suiteId is required');
        if (!Array.isArray(recommendationIds) || recommendationIds.length === 0) {
            throw new Error('recommendationIds array is required');
        }
        const response = await fetch(`${API_BASE_URL}/recommendations/convert-to-drafts`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ suiteId, recommendationIds })
        });
        return handleResponse(response);
    }
};
