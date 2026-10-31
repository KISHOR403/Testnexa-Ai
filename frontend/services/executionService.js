/**
 * Execution Service — Client for Unified Test Runs, Cases, Executions & Artifacts
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

export const executionService = {
    /**
     * List test runs
     */
    listRuns: async ({ workspaceId, page = 1, limit = 20, status, executionType, search, sort = 'newest' } = {}) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);
        if (page) params.set('page', page);
        if (limit) params.set('limit', limit);
        if (status && status !== 'all') params.set('status', status);
        if (executionType && executionType !== 'all') params.set('executionType', executionType);
        if (search) params.set('search', search);
        if (sort) params.set('sort', sort);

        const response = await fetch(`${API_BASE_URL}/runs?${params.toString()}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Create a new test run
     */
    createRun: async ({
        workspaceId,
        suiteId,
        suiteVersion,
        name,
        description,
        executionType,
        environmentId,
        targetEnvironment,
        assignedTo,
        selectedCaseIds,
        customCases
    }) => {
        const response = await fetch(`${API_BASE_URL}/runs`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                workspaceId,
                suiteId,
                suiteVersion,
                name,
                description,
                executionType,
                environmentId,
                targetEnvironment,
                assignedTo,
                selectedCaseIds,
                customCases
            })
        });
        return handleResponse(response);
    },

    /**
     * Get single test run by ID (with cases and summary)
     */
    getRun: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Update run details
     */
    updateRun: async (runId, updates) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(updates)
        });
        return handleResponse(response);
    },

    /**
     * Safely cancel a test run
     */
    cancelRun: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cancel`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * List cases inside a run
     */
    listRunCases: async (runId, { status, executionType, search } = {}) => {
        const params = new URLSearchParams();
        if (status && status !== 'all') params.set('status', status);
        if (executionType && executionType !== 'all') params.set('executionType', executionType);
        if (search) params.set('search', search);

        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases?${params.toString()}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Get single run case with attempt history
     */
    getRunCase: async (runId, caseId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Record execution attempt for a run case
     */
    recordExecution: async (runId, caseId, {
        status,
        actualResult,
        notes,
        errorMessage,
        stackTrace,
        durationMs,
        executorType = 'manual',
        artifact = null
    }) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/execute`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                status,
                actualResult,
                notes,
                errorMessage,
                stackTrace,
                durationMs,
                executorType,
                artifact
            })
        });
        return handleResponse(response);
    },

    /**
     * Upload an artifact/screenshot
     */
    uploadArtifact: async (runId, caseId, { name, data, mimeType, executionId, artifactType, metadata }) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/artifacts`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ name, data, mimeType, executionId, artifactType, metadata })
        });
        return handleResponse(response);
    },

    /**
     * Get artifact file URL
     */
    getArtifactUrl: (runId, artifactId) => {
        return `${API_BASE_URL}/runs/${runId}/artifacts/${artifactId}/file`;
    },

    /**
     * Trigger automated test execution job
     */
    triggerAutomatedRun: async (runId, { adapter = 'playwright', targetEnvironment } = {}) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/execute-automated`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ adapter, targetEnvironment })
        });
        return handleResponse(response);
    },

    /**
     * Get approved Playwright test suites inventory
     */
    getAutomationInventory: async () => {
        const response = await fetch(`${API_BASE_URL}/runs/automation/inventory`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Validate an automation script configuration statically
     */
    validateCaseScript: async (runId, caseId, configData) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/validate-script`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(configData)
        });
        return handleResponse(response);
    },

    /**
     * Run isolated dry run test execution in real browser context
     */
    testCaseScript: async (runId, caseId, configData) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/test-script`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(configData)
        });
        return handleResponse(response);
    },

    /**
     * Generate scenario-specific Playwright template matching test case snapshot
     */
    suggestCaseTemplate: async (runId, caseId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/suggest-template`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Update Playwright automation mapping for a specific test case
     */
    updateCaseAutomationMapping: async (runId, caseId, mappingData) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/automation-mapping`, {
            method: 'PUT',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(mappingData)
        });
        return handleResponse(response);
    },

    /**
     * Auto-configure approved Playwright scripts for all unconfigured cases in a run
     */
    autoConfigureMappings: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/auto-configure-mappings`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Rerun failed test cases via Playwright
     */
    rerunFailed: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/rerun-failed`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Get active/latest automation job for a run
     */
    getRunJob: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/job`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * List workspace members for assignment
     */
    listMembers: async (workspaceId = null) => {
        const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/members${query}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get unified execution report (manual + automated metrics, method breakdown, duration, failure diagnostics)
     */
    getRunReport: async (runId, workspaceId = null) => {
        const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/report${query}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Compare target run against baseline run (identifying regressions, fixes, shifts, duration delta)
     */
    compareRuns: async (runId, baselineRunId, workspaceId = null) => {
        const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/compare/${baselineRunId}${query}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Flexible execution rerun (scope: 'failed' | 'selected' | 'all') with append-only attempt history
     */
    rerun: async ({ runId, scope = 'failed', caseIds = [], workspaceId = null }) => {
        const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/rerun${query}`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ scope, caseIds })
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get requirement coverage metrics linked to actual test execution outcomes
     */
    getRunCoverage: async (runId, workspaceId = null) => {
        const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/coverage${query}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Export execution report in json, csv, or pdf/html format
     */
    exportReport: async (runId, format = 'json', workspaceId = null) => {
        const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
        const url = `${API_BASE_URL}/runs/${runId}/export/${format}${query}`;

        if (format === 'pdf' || format === 'html') {
            // Open print-ready report in a clean popup window
            window.open(url, '_blank');
            return { success: true };
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });

        if (format === 'csv') {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `test_run_${runId}_results.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            return { success: true };
        }

        return handleResponse(response);
    }
};
