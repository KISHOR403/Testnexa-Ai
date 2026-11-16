/**
 * Risk Service — API Client for Threat Modeling, Risk Vectors & Mitigation
 * Endpoints:
 * - GET /api/v1/risks/summary?suite_id=<id|all>
 * - GET /api/v1/risks?suite_id=&severity=&category=&status=&mitigation=&source=&q=&sort=&order=&page=&limit=
 * - GET /api/v1/risks/matrix?suite_id=<id|all>
 * - GET /api/v1/risks/:id
 * - POST /api/v1/risks
 * - PATCH /api/v1/risks/:id
 * - POST /api/v1/risks/:id/tests
 * - DELETE /api/v1/risks/:id/tests/:testCaseId
 * - GET /api/v1/risks/export?format=csv|json
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

export const riskService = {
    getSummary: async (suiteId = 'all') => {
        const sid = suiteId && String(suiteId).trim() ? String(suiteId).trim() : 'all';
        const url = `${API_BASE_URL}/risks/summary?suite_id=${encodeURIComponent(sid)}`;
        const res = await fetch(url, { method: 'GET', headers: getHeaders() });
        const data = await handleResponse(res);
        return data.data;
    },

    listRisks: async (params = {}) => {
        const query = new URLSearchParams();
        if (params.suiteId && params.suiteId !== 'all') query.set('suite_id', params.suiteId);
        if (params.severity && params.severity !== 'all') query.set('severity', params.severity.toLowerCase());
        if (params.category && params.category !== 'all') query.set('category', params.category.toLowerCase());
        if (params.status && params.status !== 'all') query.set('status', params.status.toLowerCase());
        if (params.mitigation && params.mitigation !== 'all') query.set('mitigation', params.mitigation.toLowerCase());
        if (params.source && params.source !== 'all') query.set('source', params.source.toLowerCase());
        if (params.q) query.set('q', params.q);
        if (params.sort) query.set('sort', params.sort);
        if (params.order) query.set('order', params.order);
        if (params.page) query.set('page', params.page);
        if (params.limit) query.set('limit', params.limit);

        const url = `${API_BASE_URL}/risks${query.toString() ? `?${query.toString()}` : ''}`;
        const res = await fetch(url, { method: 'GET', headers: getHeaders() });
        return handleResponse(res);
    },

    getMatrix: async (suiteId = 'all') => {
        const sid = suiteId && String(suiteId).trim() ? String(suiteId).trim() : 'all';
        const url = `${API_BASE_URL}/risks/matrix?suite_id=${encodeURIComponent(sid)}`;
        const res = await fetch(url, { method: 'GET', headers: getHeaders() });
        const data = await handleResponse(res);
        return data.data;
    },

    getRiskById: async (id) => {
        const url = `${API_BASE_URL}/risks/${encodeURIComponent(id)}`;
        const res = await fetch(url, { method: 'GET', headers: getHeaders() });
        const data = await handleResponse(res);
        return data.data;
    },

    createRisk: async (payload) => {
        const url = `${API_BASE_URL}/risks`;
        const res = await fetch(url, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await handleResponse(res);
        return data.data;
    },

    updateStatus: async (id, status, acceptedReason = null) => {
        const url = `${API_BASE_URL}/risks/${encodeURIComponent(id)}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status, acceptedReason })
        });
        const data = await handleResponse(res);
        return data.data;
    },

    linkTests: async (id, testCases) => {
        const url = `${API_BASE_URL}/risks/${encodeURIComponent(id)}/tests`;
        const res = await fetch(url, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ testCases })
        });
        const data = await handleResponse(res);
        return data.data;
    },

    unlinkTest: async (id, testCaseId) => {
        const url = `${API_BASE_URL}/risks/${encodeURIComponent(id)}/tests/${encodeURIComponent(testCaseId)}`;
        const res = await fetch(url, { method: 'DELETE', headers: getHeaders() });
        const data = await handleResponse(res);
        return data.data;
    },

    exportRisks: async (suiteId = 'all', format = 'json') => {
        const sid = suiteId && String(suiteId).trim() ? String(suiteId).trim() : 'all';
        const url = `${API_BASE_URL}/risks/export?suite_id=${encodeURIComponent(sid)}&format=${encodeURIComponent(format)}`;
        const res = await fetch(url, { method: 'GET', headers: getHeaders() });
        if (format === 'csv') {
            return res.text();
        }
        const data = await handleResponse(res);
        return data.data;
    }
};
