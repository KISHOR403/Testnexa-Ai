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
     * Get feature availability configuration for execution methods
     */
    getExecutionFeatures: async () => {
        const response = await fetch(`${API_BASE_URL}/runs/features`, {
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

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
        stepOutcomes = {},
        stepObservations = {},
        environment = null,
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
                stepOutcomes,
                stepObservations,
                environment,
                artifact
            })
        });
        return handleResponse(response);
    },

    /**
     * Execute an actual API test case via backend HTTP dispatcher
     */
    executeApiCase: async (runId, caseId, apiPayload = {}) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/execute-api`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(apiPayload)
        });
        return handleResponse(response);
    },

    /**
     * Get historical attempts across all runs for a specific test case ID
     */
    getTestCaseHistory: async (caseId) => {
        const response = await fetch(`${API_BASE_URL}/runs/cases/${encodeURIComponent(caseId)}/history`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Save manual execution draft for a run case
     */
    saveExecutionDraft: async (runId, caseId, draftData) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/draft`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(draftData)
        });
        return handleResponse(response);
    },
    saveCaseDraft: async (runId, caseId, draftData) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/draft`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(draftData)
        });
        return handleResponse(response);
    },

    /**
     * Get saved manual execution draft for a run case
     */
    getExecutionDraft: async (runId, caseId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/draft`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },
    getCaseDraft: async (runId, caseId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/draft`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Create a defect linked to a failed step/run case
     */
    createDefect: async (runId, caseId, defectData) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/defects`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(defectData)
        });
        return handleResponse(response);
    },

    /**
     * List defects logged for a run case
     */
    getCaseDefects: async (runId, caseId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${caseId}/defects`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * List all defects logged across a test run
     */
    getRunDefects: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/defects`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
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

    /** List persisted artifacts for a run through the authenticated execution API. */
    listRunArtifacts: async (runId, caseId = null) => {
        const params = new URLSearchParams();
        if (caseId) params.set('caseId', caseId);
        const query = params.toString();
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/artifacts${query ? `?${query}` : ''}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /** Fetch private artifact bytes without exposing storage paths or signed URLs. */
    getArtifactFile: async (runId, artifactId) => {
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/artifacts/${artifactId}/file`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.message || `Artifact could not be loaded (${response.status})`);
            error.status = response.status;
            throw error;
        }
        return response.blob();
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
     * Get registered Playwright automation projects / sources
     */
    getAutomationSources: async () => {
        const response = await fetch(`${API_BASE_URL}/runs/automation/sources`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Validate automation mapping configuration statically without needing existing run
     */
    validateAutomationConfig: async (configData) => {
        const response = await fetch(`${API_BASE_URL}/runs/automation/validate`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(configData)
        });
        return handleResponse(response);
    },

    /**
     * Standalone execute single Playwright test scenario
     */
    executeSingleTest: async (executionPayload) => {
        const response = await fetch(`${API_BASE_URL}/runs/automation/execute-single`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify(executionPayload)
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
    },

    /**
     * Phase 2: Rerun selected test cases specifically
     */
    rerunSelected: async ({ runId, caseIds = [], workspaceId = null }) => {
        const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/rerun-selected${query}`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ caseIds })
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Rerun a single test case
     */
    rerunSingleCase: async ({ runId, caseId, workspaceId = null }) => {
        const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/rerun-case/${caseId}${query}`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({})
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get rerun lineage history for an execution run
     */
    getRerunHistory: async (runId, workspaceId = null) => {
        const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/reruns${query}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get hierarchical relationships (parent, original, children)
     */
    getRerunRelationships: async (runId, workspaceId = null) => {
        const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/rerun-relationships${query}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get terminal state comparison between a rerun execution and its original run
     */
    getRerunComparison: async (runId, rerunId = null) => {
        const query = rerunId ? `?rerunId=${encodeURIComponent(rerunId)}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/rerun-comparison${query}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get full failure trends analysis payload
     */
    getFullFailureTrends: async ({ workspaceId, suiteId, interval = 'daily', startDate, endDate, browser, environment, executionMethod } = {}) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);
        if (suiteId && suiteId !== 'all') params.set('suiteId', suiteId);
        if (interval) params.set('interval', interval);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (browser && browser !== 'all') params.set('browser', browser);
        if (environment && environment !== 'all') params.set('environment', environment);
        if (executionMethod && executionMethod !== 'all') params.set('executionMethod', executionMethod);

        const response = await fetch(`${API_BASE_URL}/runs/trends/full?${params.toString()}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get failure trends summary metrics
     */
    getFailureTrendsSummary: async (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        const response = await fetch(`${API_BASE_URL}/runs/trends/summary?${qs}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get failure trends time-series data
     */
    getFailureTrendsTimeSeries: async (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        const response = await fetch(`${API_BASE_URL}/runs/trends/time-series?${qs}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get failure signatures list with search & pagination
     */
    getFailureSignatures: async ({ workspaceId, suiteId, classification, errorType, search, page = 1, limit = 20 } = {}) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);
        if (suiteId && suiteId !== 'all') params.set('suiteId', suiteId);
        if (classification && classification !== 'all') params.set('classification', classification);
        if (errorType && errorType !== 'all') params.set('errorType', errorType);
        if (search) params.set('search', search);
        if (page) params.set('page', page);
        if (limit) params.set('limit', limit);

        const response = await fetch(`${API_BASE_URL}/runs/trends/signatures?${params.toString()}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get signature details by ID
     */
    getFailureSignatureDetail: async (signatureId, { workspaceId, suiteId } = {}) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);
        if (suiteId && suiteId !== 'all') params.set('suiteId', suiteId);

        const response = await fetch(`${API_BASE_URL}/runs/trends/signatures/${signatureId}?${params.toString()}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get failure classifications breakdown
     */
    getFailureClassifications: async (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        const response = await fetch(`${API_BASE_URL}/runs/trends/classifications?${qs}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get unified execution intelligence dashboard payload
     */
    getIntelligenceDashboard: async ({ workspaceId, suiteId, interval = 'daily', startDate, endDate, browser, environment, executionMethod } = {}) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);
        if (suiteId && suiteId !== 'all') params.set('suiteId', suiteId);
        if (interval) params.set('interval', interval);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (browser && browser !== 'all') params.set('browser', browser);
        if (environment && environment !== 'all') params.set('environment', environment);
        if (executionMethod && executionMethod !== 'all') params.set('executionMethod', executionMethod);

        const response = await fetch(`${API_BASE_URL}/runs/intelligence/dashboard?${params.toString()}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get prioritized needs attention queue
     */
    getIntelligenceAttention: async (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        const response = await fetch(`${API_BASE_URL}/runs/intelligence/attention?${qs}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * Phase 2: Get requirement coverage overview
     */
    getIntelligenceCoverage: async (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        const response = await fetch(`${API_BASE_URL}/runs/intelligence/coverage?${qs}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    /**
     * AI Failure Root Cause Analysis
     */
    analyzeFailureRootCause: async (runId, runCaseId, { forceFresh = false, workspaceId } = {}) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);
        const qs = params.toString() ? `?${params.toString()}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${runCaseId}/analyze-root-cause${qs}`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ forceFresh })
        });
        return handleResponse(response);
    },

    getFailureRootCauseAnalyses: async (runId, runCaseId, { workspaceId } = {}) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);
        const qs = params.toString() ? `?${params.toString()}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/${runId}/cases/${runCaseId}/root-cause-analyses${qs}`, {
            method: 'GET',
            headers: getHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    submitFailureAnalysisFeedback: async (analysisId, { rating, comment, workspaceId } = {}) => {
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspaceId', workspaceId);
        const qs = params.toString() ? `?${params.toString()}` : '';
        const response = await fetch(`${API_BASE_URL}/runs/root-cause-analyses/${analysisId}/feedback${qs}`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ rating, comment })
        });
        return handleResponse(response);
    }
};
