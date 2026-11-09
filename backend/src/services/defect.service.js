/**
 * TestNexa AI — Defect Management Service
 *
 * Captures, links, and manages defect records filed during manual or automated test execution.
 * Links defects to runId, runCaseId, testCaseId, failedStepNumber, expected vs actual behavior,
 * severity, priority, and supporting evidence.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const supabaseService = require('./supabaseData.service');

class DefectService {
    constructor() {
        this.inMemoryDefects = new Map();
    }

    /**
     * Create a defect record linked to an execution and test case
     */
    async createDefect(params = {}) {
        const data = params.defectData || params;
        const title = data.title || params.title;
        if (!title || !title.trim()) {
            throw new Error('Defect title is required');
        }

        const description = data.description || params.description || '';
        const expectedResult = data.expectedResult || params.expectedResult || '';
        const actualResult = data.actualResult || params.actualResult || '';
        const severity = data.severity || params.severity || 'major';
        const priority = data.priority || params.priority || 'high';
        const stepNumber = data.stepNumber !== undefined && data.stepNumber !== null
            ? Number(data.stepNumber)
            : (params.stepNumber !== undefined && params.stepNumber !== null ? Number(params.stepNumber) : null);
        const stepIndex = data.stepIndex !== undefined && data.stepIndex !== null
            ? Number(data.stepIndex)
            : (params.stepIndex !== undefined && params.stepIndex !== null
                ? Number(params.stepIndex)
                : (stepNumber !== null ? stepNumber - 1 : null));

        const evidence = data.evidence || params.evidence || [];
        const environment = data.environment || params.environment || null;
        const runId = params.runId || data.runId || null;
        const runCaseId = params.runCaseId || data.runCaseId || null;
        const testCaseId = params.testCaseId || data.testCaseId || null;
        const workspaceId = params.workspaceId || data.workspaceId || null;
        const createdBy = params.user?.name || params.user?.id || params.createdBy || data.createdBy || 'qa_tester';

        const defectId = 'def_' + crypto.randomBytes(8).toString('hex');
        const now = new Date().toISOString();

        const defectRecord = {
            id: defectId,
            defectNumber: `DEF-${Date.now().toString().slice(-5)}`,
            runId: runId || null,
            runCaseId: runCaseId || null,
            testCaseId: testCaseId || null,
            stepIndex: stepIndex !== null ? Number(stepIndex) : null,
            stepNumber: stepNumber !== null ? Number(stepNumber) : (stepIndex !== null ? Number(stepIndex) + 1 : null),
            title: title.trim(),
            description: description.trim(),
            expectedResult: expectedResult.trim(),
            actualResult: actualResult.trim(),
            severity: String(severity).toLowerCase(),
            priority: String(priority),
            status: 'open', // 'open' | 'investigating' | 'in_progress' | 'resolved' | 'closed'
            evidence: Array.isArray(evidence) ? evidence : (evidence ? [evidence] : []),
            environment: environment || null,
            createdBy: createdBy || 'qa_tester',
            createdAt: now,
            updatedAt: now
        };

        this.inMemoryDefects.set(defectId, defectRecord);

        // Also record in supabaseDataService audit log if run exists
        if (runId) {
            try {
                const run = await supabaseService.getTestRunById(runId);
                const targetWsId = run?.workspaceId || workspaceId;
                if (targetWsId) {
                    supabaseService.recordWorkspaceAuditLog({
                        workspaceId: targetWsId,
                        actorId: createdBy,
                        action: 'defect.logged',
                        targetType: 'defect',
                        targetId: defectId,
                        details: {
                            defectNumber: defectRecord.defectNumber,
                            title: defectRecord.title,
                            testCaseId,
                            runId
                        }
                    });
                }
            } catch (auditErr) {
                logger.warn('Failed to record defect audit log:', auditErr.message);
            }
        }

        return defectRecord;
    }

    /**
     * List defects filtered by runId, runCaseId, or testCaseId
     */
    async listDefects({ runId = null, runCaseId = null, testCaseId = null, status = null }) {
        let defects = Array.from(this.inMemoryDefects.values());

        if (runId) {
            defects = defects.filter(d => d.runId === runId);
        }
        if (runCaseId) {
            defects = defects.filter(d => d.runCaseId === runCaseId);
        }
        if (testCaseId) {
            defects = defects.filter(d => d.testCaseId === testCaseId);
        }
        if (status && status !== 'all') {
            defects = defects.filter(d => d.status.toLowerCase() === status.toLowerCase());
        }

        // Sort newest first
        return defects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Get a single defect by ID
     */
    async getDefectById(defectId) {
        if (!defectId) return null;
        return this.inMemoryDefects.get(defectId) || null;
    }

    /**
     * Update defect status or notes
     */
    async updateDefect(defectIdOrConfig, updates = {}) {
        let defectId = defectIdOrConfig;
        let patchData = updates;

        if (defectIdOrConfig && typeof defectIdOrConfig === 'object') {
            defectId = defectIdOrConfig.defectId || defectIdOrConfig.id;
            patchData = defectIdOrConfig.updates || defectIdOrConfig;
        }

        const existing = this.inMemoryDefects.get(defectId);
        if (!existing) {
            throw new Error(`Defect not found (${defectId})`);
        }

        const allowedFields = ['status', 'severity', 'priority', 'title', 'description', 'actualResult', 'expectedResult', 'notes', 'assignedTo'];
        const patch = {};

        for (const f of allowedFields) {
            if (patchData[f] !== undefined) {
                patch[f] = patchData[f];
            }
        }

        patch.updatedAt = new Date().toISOString();
        const updated = { ...existing, ...patch };
        this.inMemoryDefects.set(defectId, updated);
        return updated;
    }
}

module.exports = new DefectService();
