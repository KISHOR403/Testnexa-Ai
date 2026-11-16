/**
 * Intelligence Service — API Client for QA Health & Authoring Intelligence
 * Endpoints:
 * - GET /api/v1/intelligence/overview?suite_id=<id|all>
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

export const intelligenceService = {
    /**
     * Fetch QA Health & Intelligence Overview for a suite or all suites
     * @param {string} [suiteId='all']
     */
    getOverview: async (suiteId = 'all') => {
        const cleanSuiteId = suiteId && String(suiteId).trim() ? String(suiteId).trim() : 'all';
        const url = `${API_BASE_URL}/intelligence/overview?suite_id=${encodeURIComponent(cleanSuiteId)}`;
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders()
            });
            const data = await handleResponse(response);
            return data.data;
        } catch (err) {
            // Re-throw so callers can handle or show retry UI
            throw err;
        }
    }
};

export default intelligenceService;
