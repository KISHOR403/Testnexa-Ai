/**
 * Copilot Service — API client for TestNexa Contextual QA Copilot
 * Connects to /api/v1/copilot endpoints.
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
        const err = new Error(errorData.message || `Request failed (${response.status})`);
        err.code = errorData.code;
        err.status = response.status;
        err.retryAfter = errorData.retryAfter;
        throw err;
    }
    return response.json();
};

export const copilotService = {
    /**
     * Run contextual QA analysis
     * @param {Object} params
     * @param {string} [params.testSuiteId]
     * @param {string} [params.testCaseId]
     * @param {string} [params.contextScope] - 'suite' | 'test_case' | 'coverage' | 'risks' | 'requirement'
     * @param {string} [params.action] - 'review_coverage' | 'find_missing_scenarios' | 'review_test_case' | 'find_edge_cases' | 'analyze_security' | 'explain_traceability' | 'improve_test_case' | 'custom_query'
     * @param {string} [params.query]
     * @param {Object} [params.localSuiteContext]
     */
    analyze: async ({ testSuiteId, testCaseId, contextScope = 'suite', action = 'review_coverage', query, localSuiteContext }) => {
        const response = await fetch(`${API_BASE_URL}/copilot/analyze`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                testSuiteId,
                testCaseId,
                contextScope,
                action,
                query,
                localSuiteContext
            })
        });
        return handleResponse(response);
    },

    /**
     * Add Copilot-suggested test case to test suite (Human-in-the-loop)
     * @param {Object} params
     * @param {string} [params.testSuiteId]
     * @param {Object} params.testCase
     * @param {Object} [params.localSuiteContext]
     */
    addTest: async ({ testSuiteId, testCase, localSuiteContext }) => {
        const response = await fetch(`${API_BASE_URL}/copilot/actions/add-test`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                testSuiteId,
                testCase,
                localSuiteContext
            })
        });
        return handleResponse(response);
    },

    /**
     * Apply user-approved improvements to an existing test case (Human-in-the-loop)
     * @param {Object} params
     * @param {string} [params.testSuiteId]
     * @param {string} params.testCaseId
     * @param {Object} params.proposed
     */
    improveTest: async ({ testSuiteId, testCaseId, proposed }) => {
        const response = await fetch(`${API_BASE_URL}/copilot/actions/improve-test`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                testSuiteId,
                testCaseId,
                proposed
            })
        });
        return handleResponse(response);
    },

    /**
     * Get lightweight context summary for a suite
     * @param {string} testSuiteId
     */
    getContext: async (testSuiteId) => {
        const response = await fetch(`${API_BASE_URL}/copilot/context/${testSuiteId}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    }
};
