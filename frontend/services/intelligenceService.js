/**
 * Intelligence Service — API Client for QA Health & Authoring Intelligence
 * Endpoints:
 * - GET /api/v1/intelligence/overview?suite_id=<id|all>
 * - GET /api/v1/intelligence/activity?suite_id=<id|all>&days=<7|14|30|90>&tz=<timezone>
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
            throw err;
        }
    },

    /**
     * Fetch authoring and review activity timeseries
     * @param {string} [suiteId='all']
     * @param {number} [days=30]
     * @param {string} [tz]
     */
    getActivity: async (suiteId = 'all', days = 30, tz = null) => {
        const cleanSuiteId = suiteId && String(suiteId).trim() ? String(suiteId).trim() : 'all';
        const userTz = tz || (Intl?.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');
        const url = `${API_BASE_URL}/intelligence/activity?suite_id=${encodeURIComponent(cleanSuiteId)}&days=${encodeURIComponent(days)}&tz=${encodeURIComponent(userTz)}`;
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders()
            });
            const data = await handleResponse(response);
            return data.data;
        } catch (err) {
            throw err;
        }
    }
};

export default intelligenceService;
