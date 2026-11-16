/**
 * Traceability Service — API client for Traceability & Requirement Coverage
 * Endpoints:
 * - GET /api/v1/traceability/suites
 * - GET /api/v1/traceability/summary
 * - GET /api/v1/traceability/gaps
 * - GET /api/v1/traceability/matrix
 * - GET /api/v1/traceability/requirements
 * - GET /api/v1/traceability/export/:format
 */

import { sessionService } from './sessionService';
import { executionService } from './executionService';
import {
    extractRequirements,
    buildTraceabilityRows,
    computeTraceabilitySummary,
    computeTraceabilityGaps,
    buildTraceabilityMatrix,
    formatTraceabilityCsv
} from '../utils/traceabilitySelectors';
import {
    unwrapSuiteData,
    extractSuiteCases,
    resolvePlatform
} from '../utils/testSuiteSelectors';

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

export const traceabilityService = {
    /**
     * List all eligible suites
     */
    getSuites: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/traceability/suites`, {
                method: 'GET',
                headers: getHeaders(),
                credentials: 'include'
            });
            const res = await handleResponse(response);
            if (res.success && Array.isArray(res.data)) {
                return res.data;
            }
        } catch (e) {
            // Fallback: Compute from sessionService
            try {
                const sessionRes = await sessionService.list({ limit: 50, hasCases: true });
                if (sessionRes.success && Array.isArray(sessionRes.data)) {
                    const recordsById = new Map(sessionRes.data.map(s => [String(s.id || s._id), s]));
                    return sessionRes.data.map(s => {
                        const sid = String(s.id || s._id);
                        const data = unwrapSuiteData(s);
                        const cases = extractSuiteCases(data, recordsById);
                        const reqs = extractRequirements(s, cases);
                        return {
                            id: sid,
                            sessionId: sid,
                            title: s.title || s.feature || data?.testSuiteName || 'Test Suite',
                            platform: resolvePlatform(data, s),
                            totalCases: cases.length,
                            requirementsCount: reqs.length,
                            coveredRequirementsCount: reqs.filter(r => r.explicitCaseRefs.length > 0).length,
                            updatedAt: s.updatedAt || s.created_at || new Date().toISOString()
                        };
                    });
                }
            } catch (err) {
                console.error('traceabilityService.getSuites fallback error:', err);
            }
        }
        return [];
    },

    /**
     * Get summary metrics for a suite or 'all'
     */
    getSummary: async (suiteId = 'all') => {
        try {
            const params = new URLSearchParams();
            if (suiteId) params.set('suite', suiteId);
            const response = await fetch(`${API_BASE_URL}/traceability/summary?${params}`, {
                method: 'GET',
                headers: getHeaders(),
                credentials: 'include'
            });
            const res = await handleResponse(response);
            if (res.success && res.data) {
                return res.data;
            }
        } catch (e) {
            // Client-side fallback
            try {
                const reqs = await traceabilityService.getRequirements(suiteId);
                const summary = computeTraceabilitySummary(reqs);
                return {
                    suiteId,
                    ...summary,
                    updatedAt: reqs[0]?.lastRun || new Date().toISOString()
                };
            } catch (err) {
                console.error('traceabilityService.getSummary fallback error:', err);
            }
        }
        return {
            suiteId,
            total: 0,
            covered: 0,
            uncovered: 0,
            partial: 0,
            failing: 0,
            unverified: 0,
            verified: 0,
            coveragePercent: 0,
            updatedAt: null
        };
    },

    /**
     * Get actionable gaps for a suite or 'all'
     */
    getGaps: async (suiteId = 'all') => {
        try {
            const params = new URLSearchParams();
            if (suiteId) params.set('suite', suiteId);
            const response = await fetch(`${API_BASE_URL}/traceability/gaps?${params}`, {
                method: 'GET',
                headers: getHeaders(),
                credentials: 'include'
            });
            const res = await handleResponse(response);
            if (res.success && res.data) {
                return res.data.gaps || [];
            }
        } catch (e) {
            try {
                const reqs = await traceabilityService.getRequirements(suiteId);
                const cases = reqs.flatMap(r => r.linkedTests);
                return computeTraceabilityGaps(reqs, cases);
            } catch (err) {
                console.error('traceabilityService.getGaps fallback error:', err);
            }
        }
        return [];
    },

    /**
     * Get canonical requirements rows with linked tests
     */
    getRequirements: async (suiteId = 'all') => {
        try {
            const params = new URLSearchParams();
            if (suiteId) params.set('suite', suiteId);
            const response = await fetch(`${API_BASE_URL}/traceability/requirements?${params}`, {
                method: 'GET',
                headers: getHeaders(),
                credentials: 'include'
            });
            const res = await handleResponse(response);
            if (res.success && Array.isArray(res.data)) {
                return res.data;
            }
        } catch (e) {
            // Client fallback
            try {
                let session = null;
                let cases = [];
                if (suiteId && suiteId !== 'all') {
                    const single = await sessionService.get(suiteId);
                    if (single?.success && single.data) {
                        session = single.data;
                        const data = unwrapSuiteData(session);
                        cases = extractSuiteCases(data);
                    }
                } else {
                    const all = await sessionService.list({ limit: 50, hasCases: true });
                    if (all?.success && Array.isArray(all.data)) {
                        session = all.data[0];
                        const recordsById = new Map(all.data.map(s => [String(s.id || s._id), s]));
                        cases = all.data.flatMap(s => extractSuiteCases(unwrapSuiteData(s), recordsById));
                    }
                }

                if (session) {
                    const reqs = extractRequirements(session, cases);
                    return buildTraceabilityRows(reqs, cases, new Map());
                }
            } catch (err) {
                console.error('traceabilityService.getRequirements fallback error:', err);
            }
        }
        return [];
    },

    /**
     * Get matrix data
     */
    getMatrix: async (suiteId = 'all') => {
        try {
            const params = new URLSearchParams();
            if (suiteId) params.set('suite', suiteId);
            const response = await fetch(`${API_BASE_URL}/traceability/matrix?${params}`, {
                method: 'GET',
                headers: getHeaders(),
                credentials: 'include'
            });
            const res = await handleResponse(response);
            if (res.success && res.data) {
                return res.data;
            }
        } catch (e) {
            try {
                const reqs = await traceabilityService.getRequirements(suiteId);
                const cases = reqs.flatMap(r => r.linkedTests);
                return buildTraceabilityMatrix(reqs, cases);
            } catch (err) {
                console.error('traceabilityService.getMatrix fallback error:', err);
            }
        }
        return { requirements: [], testCases: [], cells: {} };
    },

    /**
     * Update requirement (title, description, priority)
     */
    updateRequirement: async (requirementId, { title, description, priority, suiteId }) => {
        try {
            const response = await fetch(`${API_BASE_URL}/traceability/requirements/${encodeURIComponent(requirementId)}`, {
                method: 'PUT',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({ title, description, priority, suiteId })
            });
            const res = await handleResponse(response);
            return res;
        } catch (e) {
            // Client fallback if offline
            if (suiteId && suiteId !== 'all') {
                const single = await sessionService.get(suiteId);
                if (single?.success && single.data) {
                    const session = single.data;
                    const data = unwrapSuiteData(session) || {};
                    const requirements = Array.isArray(data.requirements) ? [...data.requirements] : [];
                    const target = requirements.find(r => String(r.id) === String(requirementId));
                    if (target) {
                        if (title !== undefined) target.title = title;
                        if (description !== undefined) target.description = description;
                        if (priority !== undefined) target.priority = priority;
                        target.source = 'manual';
                        target.updatedAt = new Date().toISOString();
                        await sessionService.update(suiteId, {
                            suiteData: { ...data, requirements }
                        });
                        return { success: true, data: target };
                    }
                }
            }
            throw e;
        }
    },

    /**
     * Export report
     */
    exportReport: async (suiteId = 'all', format = 'csv') => {
        try {
            const params = new URLSearchParams();
            if (suiteId) params.set('suite', suiteId);
            const response = await fetch(`${API_BASE_URL}/traceability/export/${format}?${params}`, {
                method: 'GET',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `traceability-report-${Date.now()}.${format}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                return { success: true };
            }
        } catch (e) {
            // Client-side fallback download
            const reqs = await traceabilityService.getRequirements(suiteId);
            if (format === 'json') {
                const jsonStr = JSON.stringify({ suiteId, requirements: reqs }, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `traceability-report-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                return { success: true };
            }
            if (format === 'csv') {
                const csvStr = formatTraceabilityCsv(reqs);
                const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `traceability-report-${Date.now()}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                return { success: true };
            }
        }
        throw new Error('Export could not be generated.');
    }
};
