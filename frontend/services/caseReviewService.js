/**
 * Case Review Service — API client for test case approvals, versioned edits,
 * AI regeneration preview/apply, and requirement linking.
 */

const getBaseUrl = () => {
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
            return import.meta.env.VITE_API_BASE_URL;
        }
    } catch (_) {}
    if (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL) {
        return process.env.VITE_API_BASE_URL;
    }
    return 'http://localhost:5000/api/v1';
};

const API_BASE_URL = getBaseUrl();

const getHeaders = (extra = {}) => {
    let token = null;
    try {
        if (typeof localStorage !== 'undefined') {
            token = localStorage.getItem('testnexa_token');
        }
    } catch (_) {}
    const headers = {
        'Content-Type': 'application/json',
        ...extra
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
};

const handleResponse = async (response) => {
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await response.json().catch(() => ({})) : await response.text().catch(() => '');

    if (!response.ok) {
        const error = new Error(
            (data && data.message) || (data && data.error) || `Request failed (${response.status})`
        );
        error.status = response.status;
        error.code = data?.code || (response.status === 409 ? 'CASE_CHANGED' : 'UNKNOWN_ERROR');
        error.data = data;
        error.headers = response.headers;
        throw error;
    }

    return {
        data,
        status: response.status,
        headers: response.headers
    };
};

export const caseReviewService = {
    /**
     * Approve a test case (optimistic concurrency requires exact version match)
     */
    approveCase: async (caseId, version) => {
        const response = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}/approval`, {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ action: 'approve', version })
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Reject a test case with a required reason (5..500 chars)
     */
    rejectCase: async (caseId, version, reason) => {
        if (!reason || typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 500) {
            throw new Error('A rejection reason between 5 and 500 characters is required.');
        }
        const response = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}/approval`, {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ action: 'reject', version, reason: reason.trim() })
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Reset approval status back to 'pending'
     */
    resetApproval: async (caseId, version) => {
        const response = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}/approval`, {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ action: 'reset', version })
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Approve remaining pending test cases in a suite
     */
    approveRemaining: async (suiteId, { caseIds = [], expectedCount }, idempotencyKey = null) => {
        const key = idempotencyKey || `ar_${suiteId}_${Date.now()}`;
        const response = await fetch(`${API_BASE_URL}/suites/${encodeURIComponent(suiteId)}/approve-remaining`, {
            method: 'POST',
            headers: getHeaders({ 'Idempotency-Key': key }),
            credentials: 'include',
            body: JSON.stringify({ caseIds, expectedCount })
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Undo approvals within 10-minute window
     */
    undoApproval: async ({ batchId = null, caseIds = null }) => {
        const response = await fetch(`${API_BASE_URL}/approvals/undo`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ batchId, caseIds })
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Edit a test case with optimistic concurrency guard
     */
    updateCase: async (caseId, payload, { version, confirmUnlinked = false } = {}) => {
        const headers = getHeaders();
        if (version !== undefined && version !== null) {
            headers['If-Match'] = String(version);
        }

        const bodyData = {
            ...payload,
            version: version !== undefined ? version : payload.version,
            confirmUnlinked: confirmUnlinked || payload.confirmUnlinked || false
        };

        const response = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}`, {
            method: 'PUT',
            headers,
            credentials: 'include',
            body: JSON.stringify(bodyData)
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Get version history for a test case
     */
    getCaseVersions: async (caseId) => {
        const response = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}/versions`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Restore a specific snapshot to create sequential version N+1
     */
    restoreVersion: async (caseId, versionNumber) => {
        const response = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}/versions/${encodeURIComponent(versionNumber)}/restore`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * AI Regeneration stateless preview (writes 0 rows to DB)
     */
    previewRegenerate: async (caseId, { instruction = '' } = {}, signal = null) => {
        const response = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}/regenerate/preview`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            signal: signal || undefined,
            body: JSON.stringify({ instruction: instruction ? instruction.slice(0, 200) : '' })
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Apply AI Regeneration proposal (creates new version, resets approval)
     */
    applyRegenerate: async (caseId, { version, proposal }, idempotencyKey = null) => {
        const key = idempotencyKey || `apply_${caseId}_v${version}_${Date.now()}`;
        const response = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}/regenerate/apply`, {
            method: 'POST',
            headers: getHeaders({ 'Idempotency-Key': key }),
            credentials: 'include',
            body: JSON.stringify({ version, proposal })
        });
        const res = await handleResponse(response);
        return res.data;
    },

    regeneratePreview: (caseId, options, signal) => caseReviewService.previewRegenerate(caseId, options, signal),
    regenerateApply: (caseId, options, key) => caseReviewService.applyRegenerate(caseId, options, key),


    /**
     * List suite requirements with canonical counts
     */
    getSuiteRequirements: async (suiteId) => {
        const response = await fetch(`${API_BASE_URL}/suites/${encodeURIComponent(suiteId)}/requirements`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Get single requirement with source quote and linked tests
     */
    getRequirement: async (reqId) => {
        const response = await fetch(`${API_BASE_URL}/requirements/${encodeURIComponent(reqId)}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Create manual requirement (auto-generates REQ_<SUITE>_<NNN>)
     */
    createRequirement: async (payload) => {
        const response = await fetch(`${API_BASE_URL}/requirements`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Update requirement (modifying title/desc flags linked cases as stale)
     */
    updateRequirement: async (reqId, payload) => {
        const response = await fetch(`${API_BASE_URL}/requirements/${encodeURIComponent(reqId)}`, {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Delete requirement with dependency check (force=true if linked)
     */
    deleteRequirement: async (reqId, { force = false } = {}) => {
        const query = force ? '?force=true' : '';
        const response = await fetch(`${API_BASE_URL}/requirements/${encodeURIComponent(reqId)}${query}`, {
            method: 'DELETE',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Link test case to requirement (enforces same suite)
     */
    linkTest: async (reqId, caseId, rationale = '') => {
        const response = await fetch(`${API_BASE_URL}/requirements/${encodeURIComponent(reqId)}/tests`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ caseId, rationale })
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Unlink test case from requirement (checks LAST_LINK rule)
     */
    unlinkTest: async (reqId, caseId, { confirmUnlinked = false } = {}) => {
        const query = confirmUnlinked ? '?confirmUnlinked=true' : '';
        const response = await fetch(`${API_BASE_URL}/requirements/${encodeURIComponent(reqId)}/tests/${encodeURIComponent(caseId)}${query}`, {
            method: 'DELETE',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return res.data;
    },


    /**
     * Export Playwright spec honoring approved filter
     */
    exportPlaywright: async (suiteId, { approved = 'only' } = {}) => {
        const query = `?approved=${encodeURIComponent(approved)}`;
        const response = await fetch(`${API_BASE_URL}/suites/${encodeURIComponent(suiteId)}/export/playwright${query}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        const res = await handleResponse(response);
        return {
            ...res.data,
            exportedCount: Number(res.headers.get('x-exported-count') || 0),
            skippedCount: Number(res.headers.get('x-skipped-count') || 0)
        };
    }
};

export default caseReviewService;
