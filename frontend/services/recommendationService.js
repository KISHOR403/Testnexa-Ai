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
     * Get suite context: requirements with linked test counts, deterministic gaps, and shortcuts
     */
    getContext: async (suiteId) => {
        const url = suiteId
            ? `${API_BASE_URL}/recommendations/context?suite_id=${encodeURIComponent(suiteId)}`
            : `${API_BASE_URL}/recommendations/context`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Generate smart test recommendations for a suite
     */
    generate: async ({ suiteId, requirementId, requestedCategories, focusArea, limit = 6, signal } = {}) => {
        const response = await fetch(`${API_BASE_URL}/recommendations/generate`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            signal,
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
     * Retrieve recommendations for a test suite with optional filters
     */
    getSuiteRecommendations: async (suiteId, filters = {}) => {
        if (!suiteId) throw new Error('suiteId is required');
        const params = new URLSearchParams();
        if (filters.status && filters.status !== 'all') params.set('status', filters.status);
        if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority);
        if (filters.category && filters.category !== 'all') params.set('category', filters.category);
        if (filters.requirementId && filters.requirementId !== 'all') params.set('requirementId', filters.requirementId);
        if (filters.similarityStatus && filters.similarityStatus !== 'all') params.set('similarityStatus', filters.similarityStatus);

        const qs = params.toString() ? `?${params.toString()}` : '';
        const response = await fetch(`${API_BASE_URL}/recommendations/suites/${encodeURIComponent(suiteId)}${qs}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Retrieve a specific recommendation by ID with audit actions
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
     * Update recommendation status (SUGGESTED, ACCEPTED, DISMISSED) or edit fields
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
     * Add single recommendation directly to test suite
     */
    addToSuite: async (id, { idempotencyKey } = {}) => {
        if (!id) throw new Error('id is required');
        const headers = getHeaders();
        if (idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey;
        }
        const response = await fetch(`${API_BASE_URL}/recommendations/${encodeURIComponent(id)}/add`, {
            method: 'POST',
            headers,
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Add/accept recommendations to test suite (idempotent)
     */
    accept: async ({ suiteId, recommendations, recommendationIds, idempotencyKey } = {}) => {
        if (!suiteId) throw new Error('suiteId is required');
        const headers = getHeaders();
        if (idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey;
        }
        const response = await fetch(`${API_BASE_URL}/recommendations/accept`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ suiteId, recommendations, recommendationIds })
        });
        return handleResponse(response);
    },

    /**
     * Bulk add recommendations to suite
     */
    bulkAdd: async ({ suiteId, recommendations, recommendationIds, idempotencyKey } = {}) => {
        if (!suiteId) throw new Error('suiteId is required');
        const headers = getHeaders();
        if (idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey;
        }
        const response = await fetch(`${API_BASE_URL}/recommendations/bulk-add`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ suiteId, recommendations, recommendationIds })
        });
        return handleResponse(response);
    },

    /**
     * Bulk dismiss recommendations
     */
    bulkDismiss: async ({ recommendationIds } = {}) => {
        if (!Array.isArray(recommendationIds) || recommendationIds.length === 0) {
            throw new Error('recommendationIds is required');
        }
        const response = await fetch(`${API_BASE_URL}/recommendations/bulk-dismiss`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ recommendationIds })
        });
        return handleResponse(response);
    },

    /**
     * Undo recently added test cases within 10 minutes
     */
    undo: async ({ suiteId, undoToken, testCaseIds } = {}) => {
        if (!suiteId) throw new Error('suiteId is required');
        const response = await fetch(`${API_BASE_URL}/recommendations/undo`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ suiteId, undoToken, testCaseIds })
        });
        return handleResponse(response);
    },

    /**
     * Convert accepted recommendations to draft test cases in the test suite
     */
    convertToDrafts: async ({ suiteId, recommendationIds, idempotencyKey }) => {
        if (!suiteId) throw new Error('suiteId is required');
        if (!Array.isArray(recommendationIds) || recommendationIds.length === 0) {
            throw new Error('recommendationIds array is required');
        }
        const headers = getHeaders();
        if (idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey;
        }
        const response = await fetch(`${API_BASE_URL}/recommendations/convert-to-drafts`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ suiteId, recommendationIds })
        });
        return handleResponse(response);
    }
};
