/**
 * TestNexa AI — Quality Insights Frontend Service
 * Real-time connection to Advanced Test Analytics, KPI Health, Trends, and AI Quality Insights.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const API_BASE = `${API_BASE_URL}/analytics/quality-insights`;

const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('testnexa_token') || localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const safeFetch = async (url, options = {}, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                ...getAuthHeaders(),
                ...(options.headers || {})
            },
            signal: options.signal || controller.signal
        });
        clearTimeout(timer);
        return res;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            throw new Error('Analytics request timed out. Please verify your connection.');
        }
        throw err;
    }
};

const handleResponse = async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.error || `Request failed (HTTP ${res.status})`);
    }
    return data;
};

export const qualityInsightsService = {
    /**
     * Get consolidated Quality Insights workspace payload
     */
    async getOverview(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        });

        const qs = params.toString();
        const res = await safeFetch(`${API_BASE}/overview${qs ? `?${qs}` : ''}`);
        return handleResponse(res);
    },

    /**
     * Get Execution Health KPIs & rates
     */
    async getHealth(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        });
        const qs = params.toString();
        const res = await safeFetch(`${API_BASE}/health${qs ? `?${qs}` : ''}`);
        return handleResponse(res);
    },

    /**
     * Get execution trends time-series
     */
    async getTrends(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        });
        const qs = params.toString();
        const res = await safeFetch(`${API_BASE}/trends${qs ? `?${qs}` : ''}`);
        return handleResponse(res);
    },

    /**
     * Get failure intelligence
     */
    async getFailures(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        });
        const qs = params.toString();
        const res = await safeFetch(`${API_BASE}/failures${qs ? `?${qs}` : ''}`);
        return handleResponse(res);
    },

    /**
     * Get flaky test analytics
     */
    async getFlaky(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        });
        const qs = params.toString();
        const res = await safeFetch(`${API_BASE}/flaky${qs ? `?${qs}` : ''}`);
        return handleResponse(res);
    },

    /**
     * Get suite comparison matrix
     */
    async getSuiteComparison(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        });
        const qs = params.toString();
        const res = await safeFetch(`${API_BASE}/suite-comparison${qs ? `?${qs}` : ''}`);
        return handleResponse(res);
    },

    /**
     * Generate AI-Assisted Quality Insights (quota metered)
     */
    async generateAIInsights(filters = {}) {
        const res = await safeFetch(`${API_BASE}/ai-insights`, {
            method: 'POST',
            body: JSON.stringify(filters)
        }, 20000); // 20s timeout for AI generation
        return handleResponse(res);
    },

    /**
     * Export Filtered Quality Insights as CSV
     */
    async exportCSV(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        });
        const qs = params.toString();
        const res = await safeFetch(`${API_BASE}/export${qs ? `?${qs}` : ''}`);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'CSV Export failed');
        }
        return res.blob();
    }
};
