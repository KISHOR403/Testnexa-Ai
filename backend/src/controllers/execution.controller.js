const supabaseService = require('../services/supabaseData.service');
const { saveArtifactBuffer, getArtifactBuffer } = require('../utils/artifactStorage');
const jobQueue = require('../services/runner/jobQueue.service');
const logger = require('../utils/logger');
const path = require('path');
const automationInventory = require('../services/runner/automationInventory.service');
const scriptValidator = require('../services/runner/scriptValidator.service');
const templateGenerator = require('../services/runner/templateGenerator.service');
const { executeSinglePlaywrightTest } = require('../services/runner/playwrightRunner.worker');
const executionReport = require('../services/runner/executionReport.service');
const rerunExecution = require('../services/runner/rerunExecution.service');
const failureTrendsService = require('../services/runner/failureTrends.service');
const executionIntelligenceService = require('../services/runner/executionIntelligence.service');
const rootCauseAnalysisService = require('../services/runner/rootCauseAnalysis.service');
const apiExecutionService = require('../services/runner/apiExecution.service');
const executionStatusEngine = require('../services/runner/executionStatusEngine.service');
const defectService = require('../services/defect.service');
const auditService = require('../services/auditService');
const usageMeteringService = require('../services/usageMetering.service');

/**
 * Resolves the target workspace ID for the request
 */
const resolveWorkspaceId = async (req) => {
    const userId = req.user._id || req.user.id;
    if (req.body?.workspaceId) return req.body.workspaceId;
    if (req.query?.workspaceId) return req.query.workspaceId;
    if (req.params?.workspaceId) return req.params.workspaceId;

    const primary = await supabaseService.getUserPrimaryWorkspace(userId, req.user.name || '');
    return primary ? primary.id : null;
};

/**
 * Verifies that the user has access to the workspace
 */
const verifyAccess = async (req, res, workspaceId) => {
    const userId = req.user._id || req.user.id;
    if (!workspaceId) {
        res.status(400).json({ success: false, message: 'No workspace context provided' });
        return false;
    }
    const hasAccess = await supabaseService.verifyUserWorkspaceAccess(workspaceId, userId);
    if (!hasAccess) {
        res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'You do not have access to this workspace'
        });
        return false;
    }
    return true;
};

/**
 * CREATE a new Test Run
 * POST /api/v1/runs
 */
exports.createRun = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const workspaceId = await resolveWorkspaceId(req);

        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace not found' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const {
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
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Test run name is required' });
        }

        // Enforce execution quota
        const execMetric = (executionType || 'manual') === 'automated' ? 'execution.automated' : 'execution.manual';
        const orgId = await usageMeteringService.resolveOrgForRequest(req, userId);
        let quotaReservation = null;

        if (orgId) {
            try {
                quotaReservation = await usageMeteringService.reserveQuota({
                    orgId,
                    workspaceId,
                    userId,
                    metric: execMetric,
                    quantity: 1,
                    operationId: `run_${Date.now()}`
                });
            } catch (qErr) {
                if (qErr.code === 'QUOTA_EXCEEDED') {
                    return res.status(403).json({
                        success: false,
                        code: 'QUOTA_EXCEEDED',
                        message: qErr.message,
                        data: qErr.data
                    });
                }
                throw qErr;
            }
        }

        const run = await supabaseService.createTestRun({
            workspaceId,
            suiteId: suiteId || null,
            suiteVersion: suiteVersion || 1,
            name: name.trim(),
            description: description || '',
            executionType: executionType || 'manual',
            environmentId: environmentId || null,
            targetEnvironment: targetEnvironment || {},
            createdBy: userId,
            assignedTo: assignedTo || null,
            selectedCaseIds: selectedCaseIds || [],
            customCases: customCases || null
        });

        // Commit usage allowance for newly created run
        if (quotaReservation) {
            await usageMeteringService.commitUsage({
                reservationId: quotaReservation.id,
                orgId,
                workspaceId,
                userId,
                resourceType: 'execution',
                metric: execMetric,
                quantity: 1,
                operationId: run.id,
                source: 'Web App',
                metadata: { runId: run.id, name: run.name, executionType: run.executionType }
            }).catch(e => logger.warn('Failed to commit execution quota:', e.message));
        }

        // Audit log
        await supabaseService.recordWorkspaceAuditLog({
            workspaceId,
            actorId: userId,
            action: 'test_run.created',
            changes: { runId: run.id, name: run.name, executionType: run.executionType },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        const ws = await supabaseService.getWorkspace(workspaceId);
        await auditService.logFromRequest(req, {
            orgId: ws?.orgId || 'default_org',
            workspaceId,
            action: 'execution.started',
            resourceType: 'execution',
            resourceId: run.id,
            resourceDisplayName: run.name,
            metadata: { executionType: run.executionType, totalTests: run.totalTests }
        });

        res.status(201).json({
            success: true,
            data: run
        });
    } catch (err) {
        logger.error('Error creating test run:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * LIST Test Runs for workspace
 * GET /api/v1/runs
 */
exports.listRuns = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20 } });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const {
            page = 1,
            limit = 20,
            status,
            executionType,
            search,
            sort = 'newest'
        } = req.query;

        const result = await supabaseService.listTestRuns({
            workspaceId,
            page: parseInt(page, 10) || 1,
            limit: Math.min(parseInt(limit, 10) || 20, 100),
            status,
            executionType,
            search,
            sort
        });

        res.json({
            success: true,
            data: result.runs,
            pagination: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                totalPages: result.totalPages
            }
        });
    } catch (err) {
        logger.error('Error listing test runs:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET a single Test Run with cases and progress
 * GET /api/v1/runs/:id
 */
exports.getRun = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);

        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        res.json({
            success: true,
            data: run
        });
    } catch (err) {
        logger.error('Error fetching test run:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * UPDATE a Test Run
 * PATCH /api/v1/runs/:id
 */
exports.updateRun = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const { name, description, assignedTo, status } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (assignedTo !== undefined) updates.assigned_to = assignedTo;
        if (status !== undefined) updates.status = status;

        const updated = await supabaseService.updateTestRun(id, run.workspaceId, updates);
        res.json({
            success: true,
            data: updated
        });
    } catch (err) {
        logger.error('Error updating test run:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * CANCEL a Test Run safely
 * POST /api/v1/runs/:id/cancel
 */
exports.cancelRun = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id || req.user.id;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const cancelledRun = await supabaseService.cancelTestRun(id, run.workspaceId, userId);

        // Audit log
        await supabaseService.recordWorkspaceAuditLog({
            workspaceId: run.workspaceId,
            actorId: userId,
            action: 'test_run.cancelled',
            changes: { runId: id },
            ipAddress: req.ip,
            userAgent: typeof req.get === 'function' ? req.get('user-agent') : 'unknown'
        });

        const cancelWs = await supabaseService.getWorkspace(run.workspaceId);
        await auditService.logFromRequest(req, {
            orgId: cancelWs?.orgId || 'default_org',
            workspaceId: run.workspaceId,
            action: 'execution.cancelled',
            resourceType: 'execution',
            resourceId: id,
            resourceDisplayName: run.name || id,
            metadata: { previousStatus: run.status }
        });

        res.json({
            success: true,
            data: cancelledRun,
            message: 'Test run has been cancelled safely'
        });
    } catch (err) {
        logger.error('Error cancelling test run:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * LIST test cases inside a run
 * GET /api/v1/runs/:id/cases
 */
exports.listRunCases = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const { status, executionType, search } = req.query;
        const cases = await supabaseService.getRunCases(id, { status, executionType, search });

        res.json({
            success: true,
            data: cases
        });
    } catch (err) {
        logger.error('Error listing run cases:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET a single run case
 * GET /api/v1/runs/:id/cases/:caseId
 */
exports.getRunCase = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        let runCase = await supabaseService.getRunCaseById(caseId);
        if (!runCase || runCase.runId !== id) {
            const allRunCases = await supabaseService.getRunCases(id);
            runCase = allRunCases.find(rc => rc.id === caseId || rc.testCaseId === caseId);
        }
        if (!runCase) {
            return res.status(404).json({ success: false, message: 'Test run case not found' });
        }

        const executions = await supabaseService.getCaseExecutions(runCase.id);
        const artifacts = await supabaseService.getRunArtifacts(id, runCase.id);

        res.json({
            success: true,
            data: {
                ...runCase,
                executions: executions || [],
                artifacts: artifacts || []
            }
        });
    } catch (err) {
        logger.error('Error fetching run case:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * RECORD test execution attempt (Manual or Automated result)
 * POST /api/v1/runs/:id/cases/:caseId/execute
 */
exports.recordExecution = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const userId = req.user._id || req.user.id;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        let runCase = await supabaseService.getRunCaseById(caseId);
        if (!runCase || runCase.runId !== id) {
            const allRunCases = await supabaseService.getRunCases(id);
            runCase = allRunCases.find(rc => rc.id === caseId || rc.testCaseId === caseId);
        }
        if (!runCase) {
            return res.status(404).json({ success: false, message: 'Test run case not found' });
        }

        const {
            status,
            actualResult,
            notes,
            errorMessage,
            stackTrace,
            durationMs,
            executorType = 'manual',
            stepOutcomes = {},
            stepObservations = {},
            environment = null
        } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Execution status is required' });
        }

        // Validate completion rules and derive status via Centralized Status Engine
        const caseSteps = runCase.caseSnapshot?.steps || [];
        const validation = executionStatusEngine.validateCompletionRequest({
            steps: caseSteps,
            stepOutcomes: stepOutcomes || {},
            requestedStatus: status,
            actualResult: actualResult || ''
        });

        if (!validation.isValid && executorType === 'manual') {
            return res.status(400).json({
                success: false,
                code: validation.code || 'VALIDATION_FAILED',
                message: validation.message,
                evaluation: validation.evaluation
            });
        }

        const effectiveStatus = validation.effectiveStatus || String(status).toLowerCase();

        const result = await supabaseService.recordTestExecution({
            runId: id,
            runCaseId: runCase.id,
            testCaseId: runCase.testCaseId,
            status: effectiveStatus,
            actualResult: actualResult || '',
            notes: notes || '',
            errorMessage: errorMessage || '',
            stackTrace: stackTrace || '',
            durationMs: durationMs || 0,
            executedBy: userId,
            executorType,
            stepOutcomes,
            stepObservations,
            environment
        });

        // If evidence screenshot or artifact was uploaded in same payload
        if (req.body.artifact && req.body.artifact.data) {
            try {
                const saved = await saveArtifactBuffer({
                    workspaceId: run.workspaceId,
                    runId: id,
                    name: req.body.artifact.name || `evidence_${runCase.id}.png`,
                    data: req.body.artifact.data,
                    mimeType: req.body.artifact.mimeType || 'image/png'
                });

                await supabaseService.saveArtifact({
                    runId: id,
                    runCaseId: runCase.id,
                    executionId: result.execution.id,
                    name: saved.name,
                    artifactType: 'screenshot',
                    mimeType: saved.mimeType,
                    sizeBytes: saved.sizeBytes,
                    storagePath: saved.storagePath,
                    metadata: { source: 'manual_execution_evidence' }
                });

                if (saved.sizeBytes) {
                    const orgId = await usageMeteringService.resolveOrgForRequest(req, userId);
                    if (orgId) {
                        await usageMeteringService.recordStorageDelta(orgId, saved.sizeBytes, `evidence_${runCase.id}`);
                    }
                }
            } catch (artErr) {
                logger.warn('Failed to save execution artifact:', artErr.message);
            }
        }

        // Invalidate failure trends and intelligence cache for workspace
        failureTrendsService.invalidateCache(run.workspaceId);
        executionIntelligenceService.invalidateCache(run.workspaceId);

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        logger.error('Error recording test execution:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET attempt history for a specific case
 * GET /api/v1/runs/:id/cases/:caseId/executions
 */
exports.getCaseHistory = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const executions = await supabaseService.getCaseExecutions(caseId);
        res.json({
            success: true,
            data: executions
        });
    } catch (err) {
        logger.error('Error fetching case history:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET full chronological execution history across all runs for a test case ID
 * GET /api/v1/runs/cases/:caseId/history
 */
exports.getTestCaseHistoricalAttempts = async (req, res) => {
    try {
        const { caseId } = req.params;
        const executions = await supabaseService.getTestCaseAllExecutions(caseId);
        res.json({
            success: true,
            data: executions
        });
    } catch (err) {
        logger.error('Error fetching test case historical attempts:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * EXECUTE API Test Case genuinely via HTTP dispatch and assertions
 * POST /api/v1/runs/:id/cases/:caseId/execute-api
 */
exports.executeApiCase = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const userId = req.user._id || req.user.id;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        let runCase = await supabaseService.getRunCaseById(caseId);
        if (!runCase || runCase.runId !== id) {
            const allRunCases = await supabaseService.getRunCases(id);
            runCase = allRunCases.find(rc => rc.id === caseId || rc.testCaseId === caseId);
        }
        if (!runCase) {
            return res.status(404).json({ success: false, message: 'Test run case not found' });
        }

        const snap = runCase.caseSnapshot || {};
        const apiDef = snap.apiDefinition || snap.apiMapping || {};

        // Merge request configuration from body or snapshot
        const {
            url = apiDef.url || apiDef.endpoint || req.body.endpoint || run.targetEnvironment?.baseUrl || '/api/v1/health',
            method = req.body.method || apiDef.method || 'GET',
            headers = req.body.headers || apiDef.headers || {},
            body = req.body.body || apiDef.body || null,
            auth = req.body.auth || apiDef.auth || null,
            expectedStatus = req.body.expectedStatus || apiDef.expectedStatus || 200,
            assertions = req.body.assertions || apiDef.assertions || [],
            timeoutMs = req.body.timeoutMs || 15000
        } = req.body;

        // Perform actual HTTP execution
        const apiResult = await apiExecutionService.executeApiRequest({
            url,
            method,
            headers,
            body,
            auth,
            expectedStatus,
            assertions,
            timeoutMs,
            targetEnvironment: run.targetEnvironment || {}
        });

        // Record real execution evidence in persistent database
        const recorded = await supabaseService.recordTestExecution({
            runId: id,
            runCaseId: runCase.id,
            testCaseId: runCase.testCaseId,
            status: apiResult.status,
            actualResult: apiResult.actualResult,
            notes: apiResult.logs.join('\n'),
            errorMessage: apiResult.errorMessage || '',
            durationMs: apiResult.durationMs,
            executedBy: userId,
            executorType: 'api',
            environment: run.targetEnvironment?.name || 'API Runner'
        });

        res.json({
            success: true,
            data: {
                ...apiResult,
                execution: recorded.execution,
                runCase: recorded.runCase
            }
        });
    } catch (err) {
        logger.error('Error executing API test case:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * SAVE manual execution draft for a case
 * POST /api/v1/runs/:id/cases/:caseId/draft
 */
exports.saveCaseDraft = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        let runCase = await supabaseService.getRunCaseById(caseId);
        if (!runCase || runCase.runId !== id) {
            const allRunCases = await supabaseService.getRunCases(id);
            runCase = allRunCases.find(rc => rc.id === caseId || rc.testCaseId === caseId);
        }
        if (!runCase) {
            return res.status(404).json({ success: false, message: 'Test run case not found' });
        }

        const draftData = {
            stepOutcomes: req.body.stepOutcomes || {},
            stepObservations: req.body.stepObservations || {},
            actualResult: req.body.actualResult || '',
            notes: req.body.notes || '',
            durationMs: req.body.durationMs || 0,
            environmentId: req.body.environmentId || '',
            environment: req.body.environment || null,
            evidence: req.body.evidence || null,
            savedBy: req.user._id || req.user.id
        };

        const updated = await supabaseService.saveCaseDraft(runCase.id, draftData);

        res.json({
            success: true,
            message: 'Manual execution draft saved',
            data: updated?.caseSnapshot?.draftState || draftData
        });
    } catch (err) {
        logger.error('Error saving execution draft:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET manual execution draft for a case
 * GET /api/v1/runs/:id/cases/:caseId/draft
 */
exports.getCaseDraft = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        let runCase = await supabaseService.getRunCaseById(caseId);
        if (!runCase || runCase.runId !== id) {
            const allRunCases = await supabaseService.getRunCases(id);
            runCase = allRunCases.find(rc => rc.id === caseId || rc.testCaseId === caseId);
        }
        if (!runCase) {
            return res.status(404).json({ success: false, message: 'Test run case not found' });
        }

        const draft = runCase.caseSnapshot?.draftState || null;
        res.json({
            success: true,
            data: draft
        });
    } catch (err) {
        logger.error('Error fetching execution draft:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * UPLOAD and attach an artifact/screenshot to a case or run
 * POST /api/v1/runs/:id/cases/:caseId/artifacts
 */
exports.uploadArtifact = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const { name, data, mimeType, executionId, artifactType } = req.body;
        if (!name || !data) {
            return res.status(400).json({ success: false, message: 'Artifact name and data are required' });
        }

        const orgId = await usageMeteringService.resolveOrgForRequest(req, userId);
        if (orgId) {
            const approxBytes = Buffer.isBuffer(data) ? data.length : (typeof data === 'string' ? Math.round(data.length * 0.75) : 1024);
            try {
                await usageMeteringService.reserveQuota({
                    orgId,
                    workspaceId: run.workspaceId,
                    userId,
                    metric: 'storage.bytes',
                    quantity: approxBytes,
                    operationId: `art_${Date.now()}`
                });
            } catch (qErr) {
                if (qErr.code === 'QUOTA_EXCEEDED') {
                    return res.status(403).json({
                        success: false,
                        code: 'QUOTA_EXCEEDED',
                        message: qErr.message,
                        data: qErr.data
                    });
                }
                throw qErr;
            }
        }

        const saved = await saveArtifactBuffer({
            workspaceId: run.workspaceId,
            runId: id,
            name,
            data,
            mimeType: mimeType || 'image/png'
        });

        const artifactRecord = await supabaseService.saveArtifact({
            runId: id,
            runCaseId: caseId || null,
            executionId: executionId || null,
            name: saved.name,
            artifactType: artifactType || 'screenshot',
            mimeType: saved.mimeType,
            sizeBytes: saved.sizeBytes,
            storagePath: saved.storagePath,
            metadata: req.body.metadata || {}
        });

        if (orgId && saved.sizeBytes) {
            await usageMeteringService.recordStorageDelta(orgId, saved.sizeBytes, artifactRecord.id);
        }

        res.status(201).json({
            success: true,
            data: artifactRecord
        });
    } catch (err) {
        logger.error('Error uploading artifact:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET artifacts for a run
 * GET /api/v1/runs/:id/artifacts
 */
exports.listRunArtifacts = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const artifacts = await supabaseService.getRunArtifacts(id, req.query.caseId || null);
        res.json({
            success: true,
            data: artifacts
        });
    } catch (err) {
        logger.error('Error listing run artifacts:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DOWNLOAD/SERVE artifact file securely
 * GET /api/v1/runs/:id/artifacts/:artifactId/file
 */
exports.serveArtifactFile = async (req, res) => {
    try {
        const { id, artifactId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const artifacts = await supabaseService.getRunArtifacts(id);
        const art = artifacts.find(a => a.id === artifactId);
        if (!art || !art.storagePath) {
            return res.status(404).json({ success: false, message: 'Artifact record not found' });
        }

        const fileResult = getArtifactBuffer(art.storagePath);
        if (!fileResult) {
            return res.status(404).json({ success: false, message: 'Artifact file not found on disk' });
        }

        res.setHeader('Content-Type', art.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(art.name)}"`);
        res.send(fileResult.data);
    } catch (err) {
        logger.error('Error serving artifact file:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * LIST eligible workspace members for assignment
 * GET /api/v1/runs/members
 */
exports.listMembers = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.json({ success: true, data: [] });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const members = await supabaseService.getWorkspaceMembersList(workspaceId);
        res.json({
            success: true,
            data: members
        });
    } catch (err) {
        logger.error('Error listing workspace members:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * TRIGGER automated execution for a test run
 * POST /api/v1/runs/:id/execute-automated
 */
exports.triggerAutomatedRun = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id || req.user.id;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const { adapter = 'playwright', targetEnvironment } = req.body;

        const job = await jobQueue.submitJob({
            runId: id,
            workspaceId: run.workspaceId,
            adapter,
            targetEnvironment: targetEnvironment || run.targetEnvironment || {},
            requestedBy: userId
        });

        res.status(202).json({
            success: true,
            data: job,
            message: 'Automation job queued successfully'
        });
    } catch (err) {
        logger.error('Error triggering automated run:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * GET latest automation job for a test run
 * GET /api/v1/runs/:id/job
 */
exports.getRunJob = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        let latestJob = null;
        for (const j of supabaseService.inMemoryAutomationJobs.values()) {
            if (j.run_id === id) {
                if (!latestJob || new Date(j.created_at) > new Date(latestJob.createdAt)) {
                    latestJob = supabaseService._formatAutomationJob(j);
                }
            }
        }

        res.json({
            success: true,
            data: latestJob
        });
    } catch (err) {
        logger.error('Error fetching run job:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * LIST approved automation suites & tests inventory
 * GET /api/v1/runs/automation/inventory
 */
exports.listAutomationInventory = async (req, res) => {
    try {
        const inventory = automationInventory.listApprovedSuites();
        res.json({
            success: true,
            data: inventory
        });
    } catch (err) {
        logger.error('Error listing automation inventory:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * LIST registered automation projects / sources
 * GET /api/v1/runs/automation/sources
 */
exports.listAutomationSources = async (req, res) => {
    try {
        const suites = automationInventory.listApprovedSuites();
        const totalTests = suites.reduce((acc, s) => acc + (s.testsCount || 0), 0);
        const projects = [
            {
                id: 'proj_e2e_core',
                name: 'TestNexa Core E2E Suite',
                framework: 'Playwright (JavaScript/Node.js)',
                repository: 'tests/e2e',
                status: 'connected',
                isAvailable: true,
                lastDiscoveryAt: new Date().toISOString(),
                filesCount: suites.length,
                testsCount: totalTests,
                suites
            }
        ];
        res.json({
            success: true,
            data: projects
        });
    } catch (err) {
        logger.error('Error listing automation sources:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * STANDALONE VALIDATE automation mapping configuration
 * POST /api/v1/runs/automation/validate
 */
exports.validateAutomationConfig = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace not found' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const validation = scriptValidator.validateConfiguration({
            ...req.body,
            targetEnvironment: req.body.targetEnvironment || {}
        });

        res.json({
            success: true,
            data: validation
        });
    } catch (err) {
        logger.error('Error validating automation configuration:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * STANDALONE EXECUTE single Playwright test scenario
 * POST /api/v1/runs/automation/execute-single
 */
exports.executeSingleTest = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Active workspace not found' });
        }
        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const {
            testCaseId = 'TEST_SINGLE',
            title = 'Single Test Execution',
            scriptSource = 'existing',
            scriptRef = '',
            automationTestId = '',
            scriptCode = '',
            targetEnvironment = {},
            executionTimeout = 30000,
            browserName = 'chromium',
            headless = true
        } = req.body;

        const result = await executeSinglePlaywrightTest({
            testCaseId,
            title,
            scriptSource,
            scriptRef,
            automationTestId,
            scriptCode,
            targetEnvironment,
            timeoutMs: parseInt(executionTimeout || 30000, 10),
            browserName,
            headless
        });

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        logger.error('Error executing single Playwright test:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * VALIDATE a case Playwright automation script configuration
 * POST /api/v1/runs/:id/cases/:caseId/validate-script
 */
exports.validateCaseScript = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const validation = scriptValidator.validateConfiguration({
            ...req.body,
            targetEnvironment: req.body.targetEnvironment || run.targetEnvironment
        });

        // Audit log validation attempt
        await supabaseService.logAuditAction({
            workspace_id: run.workspaceId,
            user_id: req.user._id || req.user.id,
            user_name: req.user.name || req.user.email,
            user_email: req.user.email,
            action: 'AUTOMATION_SCRIPT_VALIDATE',
            resource_type: 'test_run_case',
            resource_id: caseId,
            metadata: {
                runId: id,
                valid: validation.valid,
                errorsCount: validation.errors.length,
                warningsCount: validation.warnings.length
            }
        }).catch(() => {});

        res.json({
            success: true,
            data: validation
        });
    } catch (err) {
        logger.error('Error validating automation script:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * DRY RUN test execution for single script inside modal
 * POST /api/v1/runs/:id/cases/:caseId/test-script
 */
exports.testCaseScript = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const caseItem = await supabaseService.getRunCaseById(caseId);
        const title = caseItem?.caseSnapshot?.title || 'Single Test Dry Run';
        const targetEnv = req.body.targetEnvironment || run.targetEnvironment || {};

        const dryRun = await executeSinglePlaywrightTest({
            testCaseId: caseItem?.testCaseId || caseId,
            title,
            scriptSource: req.body.scriptSource || 'custom',
            scriptRef: req.body.scriptRef || '',
            automationTestId: req.body.automationTestId || '',
            scriptCode: req.body.scriptCode || '',
            targetEnvironment: targetEnv,
            timeoutMs: parseInt(req.body.executionTimeout || 15000, 10)
        });

        // Audit log dry run execution
        await supabaseService.logAuditAction({
            workspace_id: run.workspaceId,
            user_id: req.user._id || req.user.id,
            user_name: req.user.name || req.user.email,
            user_email: req.user.email,
            action: 'AUTOMATION_SCRIPT_DRY_RUN',
            resource_type: 'test_run_case',
            resource_id: caseId,
            metadata: {
                runId: id,
                status: dryRun.status,
                durationMs: dryRun.durationMs,
                passed: dryRun.success
            }
        }).catch(() => {});

        res.json({
            success: true,
            data: dryRun
        });
    } catch (err) {
        logger.error('Error executing single script dry run:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * SUGGEST scenario-tailored Playwright template
 * POST /api/v1/runs/:id/cases/:caseId/suggest-template
 */
exports.suggestCaseTemplate = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const caseItem = await supabaseService.getRunCaseById(caseId);
        if (!caseItem) {
            return res.status(404).json({ success: false, message: 'Test run case not found' });
        }

        const template = templateGenerator.generateTemplate(
            caseItem.caseSnapshot || {},
            run.targetEnvironment || {}
        );

        res.json({
            success: true,
            data: template
        });
    } catch (err) {
        logger.error('Error suggesting template:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * UPDATE automation mapping for a test case
 * PUT /api/v1/runs/:id/cases/:caseId/automation-mapping
 */
exports.updateCaseAutomationMapping = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const {
            framework,
            automationTestId,
            scriptSource,
            scriptRef,
            scriptCode,
            scriptVersion,
            targetEnvironment,
            executionTimeout,
            mappingStatus
        } = req.body;

        // If attempting to enable the mapping, strictly validate first
        if (mappingStatus === 'enabled') {
            const validation = scriptValidator.validateConfiguration({
                framework,
                automationTestId,
                scriptSource,
                scriptRef,
                scriptCode,
                executionTimeout,
                targetEnvironment
            });

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_SCRIPT_CONFIGURATION',
                    message: `Cannot enable script mapping: ${validation.errors.join('; ')}`,
                    validation
                });
            }
        }

        const updated = await supabaseService.updateCaseAutomationMapping(caseId, {
            framework,
            automationTestId,
            scriptSource,
            scriptRef,
            scriptCode,
            scriptVersion,
            targetEnvironment,
            executionTimeout,
            mappingStatus: mappingStatus || 'configured',
            updatedBy: req.user.email || req.user.name || 'tester'
        });

        // Audit log mapping configuration save
        await supabaseService.logAuditAction({
            workspace_id: run.workspaceId,
            user_id: req.user._id || req.user.id,
            user_name: req.user.name || req.user.email,
            user_email: req.user.email,
            action: 'AUTOMATION_MAPPING_SAVE',
            resource_type: 'test_run_case',
            resource_id: caseId,
            metadata: {
                runId: id,
                automationTestId,
                scriptSource,
                scriptRef,
                mappingStatus
            }
        }).catch(() => {});

        res.json({
            success: true,
            data: updated,
            message: 'Automation mapping updated successfully'
        });
    } catch (err) {
        logger.error('Error updating case automation mapping:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * AUTO-CONFIGURE approved Playwright mappings for all unconfigured cases in a run
 * POST /api/v1/runs/:id/auto-configure-mappings
 */
exports.autoConfigureMappings = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const result = await supabaseService.autoConfigureApprovedMappings(id);

        res.json({
            success: true,
            data: result,
            message: `Successfully configured approved Playwright scripts for ${result.configuredCount} test cases`
        });
    } catch (err) {
        logger.error('Error auto-configuring mappings:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * RERUN failed test cases via Playwright
 * POST /api/v1/runs/:id/rerun-failed
 */
exports.rerunFailed = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id || req.user.id;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        // If explicitly requested to create a new execution record
        const shouldCreateNewRun = req.body?.createNewRun === true || req.body?.mode === 'new_run' || req.query?.mode === 'new_run';
        if (shouldCreateNewRun) {
            const result = await rerunExecution.createRerunExecution({
                runId: id,
                workspaceId: run.workspaceId,
                userId,
                scope: 'failed'
            });
            return res.status(202).json({
                success: true,
                data: result,
                message: result.message
            });
        }

        const allCases = await supabaseService.getRunCases(id);
        const failedCases = allCases.filter(c => c.status === 'failed' || c.status === 'blocked');

        if (failedCases.length === 0) {
            return res.status(400).json({ success: false, message: 'No failed test cases to rerun' });
        }

        // Reset failed cases status to not_run while preserving previous attempts in test_executions
        for (const fc of failedCases) {
            await supabaseService.updateRunCase(fc.id, {
                status: 'not_run',
                actual_result: '',
                notes: `Ready for retry attempt ${(fc.currentAttempt || 1) + 1}`
            });
        }

        // Enqueue automated job targeting only failed cases
        const job = await jobQueue.submitJob({
            runId: id,
            workspaceId: run.workspaceId,
            adapter: 'playwright',
            targetEnvironment: run.targetEnvironment || {},
            requestedBy: userId,
            caseIds: failedCases.map(c => c.id)
        });

        res.status(202).json({
            success: true,
            data: {
                job,
                failedCasesCount: failedCases.length
            },
            message: `Retrying ${failedCases.length} failed test cases via Playwright`
        });
    } catch (err) {
        logger.error('Error rerunning failed cases:', err);
        const status = err.statusCode || 400;
        res.status(status).json({ success: false, message: err.message, data: err.data || null });
    }
};

/**
 * Phase 2: GET unified execution report
 * GET /api/v1/runs/:id/report
 */
exports.getRunReport = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const report = await executionReport.generateRunReport(id, run.workspaceId);
        res.json({
            success: true,
            data: report
        });
    } catch (err) {
        logger.error('Error generating execution report:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Phase 2: GET compare two execution runs
 * GET /api/v1/runs/:id/compare/:baselineRunId
 */
exports.compareRuns = async (req, res) => {
    try {
        const { id, baselineRunId } = req.params;
        const [targetRun, baselineRun] = await Promise.all([
            supabaseService.getTestRunById(id),
            supabaseService.getTestRunById(baselineRunId)
        ]);

        if (!targetRun) {
            return res.status(404).json({ success: false, message: `Target run ${id} not found` });
        }
        if (!baselineRun) {
            return res.status(404).json({ success: false, message: `Baseline run ${baselineRunId} not found` });
        }

        // Verify workspace access for both runs
        const isAllowedTarget = await verifyAccess(req, res, targetRun.workspaceId);
        if (!isAllowedTarget) return;

        const isAllowedBaseline = await verifyAccess(req, res, baselineRun.workspaceId);
        if (!isAllowedBaseline) return;

        if (targetRun.workspaceId !== baselineRun.workspaceId) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'Cross-workspace run comparison is strictly prohibited'
            });
        }

        const comparison = await executionReport.compareRuns(id, baselineRunId, targetRun.workspaceId);
        res.json({
            success: true,
            data: comparison
        });
    } catch (err) {
        logger.error('Error comparing execution runs:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Phase 2: POST rerun with scope ('failed' | 'selected' | 'single' | 'all')
 * Creates a traceable new execution run record linked to the original run.
 * POST /api/v1/runs/:id/rerun
 */
exports.rerun = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id || req.user.id;
        const { scope = 'failed', caseIds = [], caseId = null, mode = 'new_run' } = req.body || {};

        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        if (mode === 'in_place') {
            const result = await executionReport.executeRerun({
                runId: id,
                workspaceId: run.workspaceId,
                userId,
                scope,
                caseIds
            });
            return res.status(202).json({
                success: true,
                data: result,
                message: result.message
            });
        }

        const result = await rerunExecution.createRerunExecution({
            runId: id,
            workspaceId: run.workspaceId,
            userId,
            scope,
            caseIds,
            caseId,
            mode
        });

        res.status(202).json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (err) {
        logger.error('Error executing rerun:', err);
        const status = err.statusCode || 400;
        res.status(status).json({ success: false, message: err.message, data: err.data || null });
    }
};

/**
 * Phase 2: POST rerun selected test cases
 * POST /api/v1/runs/:id/rerun-selected
 */
exports.rerunSelected = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id || req.user.id;
        const { caseIds = [] } = req.body || {};

        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const result = await rerunExecution.createRerunExecution({
            runId: id,
            workspaceId: run.workspaceId,
            userId,
            scope: 'selected',
            caseIds
        });

        res.status(202).json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (err) {
        logger.error('Error rerunning selected cases:', err);
        const status = err.statusCode || 400;
        res.status(status).json({ success: false, message: err.message, data: err.data || null });
    }
};

/**
 * Phase 2: POST rerun a single test case
 * POST /api/v1/runs/:id/rerun-case/:caseId
 */
exports.rerunSingleCase = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const userId = req.user._id || req.user.id;

        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const result = await rerunExecution.createRerunExecution({
            runId: id,
            workspaceId: run.workspaceId,
            userId,
            scope: 'single',
            caseId
        });

        res.status(202).json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (err) {
        logger.error('Error rerunning single case:', err);
        const status = err.statusCode || 400;
        res.status(status).json({ success: false, message: err.message, data: err.data || null });
    }
};

/**
 * Phase 2: GET rerun lineage history for an execution run
 * GET /api/v1/runs/:id/reruns
 */
exports.getRerunHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const history = await rerunExecution.getRerunHistory(id, run.workspaceId);
        res.json({
            success: true,
            data: history
        });
    } catch (err) {
        logger.error('Error getting rerun history:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Phase 2: GET hierarchical relationships (parent, original, children)
 * GET /api/v1/runs/:id/rerun-relationships
 */
exports.getRerunRelationships = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const relationships = await rerunExecution.getRerunRelationships(id, run.workspaceId);
        res.json({
            success: true,
            data: relationships
        });
    } catch (err) {
        logger.error('Error getting rerun relationships:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Phase 2: GET comparison between a rerun execution and its original run
 * GET /api/v1/runs/:id/rerun-comparison
 */
exports.getRerunComparison = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const { rerunId } = req.query;
        const comparison = await rerunExecution.compareRerun(id, run.workspaceId, rerunId);
        res.json({
            success: true,
            data: comparison
        });
    } catch (err) {
        logger.error('Error getting rerun comparison:', err);
        const status = err.statusCode || 500;
        res.status(status).json({ success: false, message: err.message });
    }
};

/**
 * Phase 2: GET requirement & execution coverage
 * GET /api/v1/runs/:id/coverage
 */
exports.getRunCoverage = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const report = await executionReport.generateRunReport(id, run.workspaceId);
        res.json({
            success: true,
            data: report.coverage
        });
    } catch (err) {
        logger.error('Error fetching run coverage:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Phase 2: Export execution report (JSON, CSV, PDF-HTML)
 * GET /api/v1/runs/:id/export/:format
 */
exports.exportReport = async (req, res) => {
    try {
        const { id, format = 'json' } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const exported = await executionReport.exportReport(id, run.workspaceId, format.toLowerCase());

        res.setHeader('Content-Type', exported.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
        res.send(exported.content);
    } catch (err) {
        logger.error('Error exporting report:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

// ==========================================
// FAILURE TREND ANALYSIS CONTROLLER METHODS
// ==========================================

const parseTrendFilters = (req, workspaceId) => {
    return {
        workspaceId,
        suiteId: req.query.suiteId || null,
        interval: req.query.interval === 'weekly' ? 'weekly' : 'daily',
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        browser: req.query.browser || 'all',
        environment: req.query.environment || 'all',
        executionMethod: req.query.executionMethod || 'all'
    };
};

/**
 * GET full failure trends analysis payload
 * GET /api/v1/runs/trends/full
 */
exports.getFullFailureTrends = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const filters = parseTrendFilters(req, workspaceId);
        const result = await failureTrendsService.analyzeFailureTrends(workspaceId, filters);

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        logger.error('Error fetching full failure trends:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET failure trends summary metrics
 * GET /api/v1/runs/trends/summary
 */
exports.getFailureTrendsSummary = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const filters = parseTrendFilters(req, workspaceId);
        const result = await failureTrendsService.analyzeFailureTrends(workspaceId, filters);

        res.json({
            success: true,
            data: result.summary,
            filters: result.filters
        });
    } catch (err) {
        logger.error('Error fetching failure trends summary:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET failure trends time-series data (daily or weekly)
 * GET /api/v1/runs/trends/time-series
 */
exports.getFailureTrendsTimeSeries = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const filters = parseTrendFilters(req, workspaceId);
        const result = await failureTrendsService.analyzeFailureTrends(workspaceId, filters);

        res.json({
            success: true,
            data: result.timeSeries,
            filters: result.filters
        });
    } catch (err) {
        logger.error('Error fetching failure trends time series:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET recurring and classified failure signatures with pagination & search
 * GET /api/v1/runs/trends/signatures
 */
exports.getFailureSignatures = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const filters = parseTrendFilters(req, workspaceId);
        const result = await failureTrendsService.analyzeFailureTrends(workspaceId, filters);

        let signatures = result.signatures || [];

        // Optional filtering by classification (new_failure, recurring, resolved, still_failing)
        if (req.query.classification && req.query.classification !== 'all') {
            signatures = signatures.filter(s => s.classification === req.query.classification);
        }

        // Optional filtering by errorType
        if (req.query.errorType && req.query.errorType !== 'all') {
            signatures = signatures.filter(s => s.errorType.toLowerCase() === req.query.errorType.toLowerCase());
        }

        // Optional search query
        if (req.query.search && req.query.search.trim()) {
            const q = req.query.search.trim().toLowerCase();
            signatures = signatures.filter(s =>
                s.normalizedMessage.toLowerCase().includes(q) ||
                s.sampleRawMessage.toLowerCase().includes(q) ||
                s.errorType.toLowerCase().includes(q) ||
                (s.affectedCases || []).some(c => (c.testCaseId || '').toLowerCase().includes(q) || (c.title || '').toLowerCase().includes(q))
            );
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
        const total = signatures.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const paginated = signatures.slice((page - 1) * limit, page * limit);

        res.json({
            success: true,
            data: paginated,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (err) {
        logger.error('Error fetching failure signatures:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET failure signature detail by ID
 * GET /api/v1/runs/trends/signatures/:signatureId
 */
exports.getFailureSignatureDetail = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const { signatureId } = req.params;
        const filters = parseTrendFilters(req, workspaceId);
        const detail = await failureTrendsService.getSignatureDetails(workspaceId, signatureId, filters);

        if (!detail.success) {
            return res.status(404).json(detail);
        }

        res.json(detail);
    } catch (err) {
        logger.error('Error fetching signature detail:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET failure classifications (New, Recurring, Resolved, Still Failing, Insufficient History)
 * GET /api/v1/runs/trends/classifications
 */
exports.getFailureClassifications = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const filters = parseTrendFilters(req, workspaceId);
        const result = await failureTrendsService.analyzeFailureTrends(workspaceId, filters);

        res.json({
            success: true,
            data: result.classifications
        });
    } catch (err) {
        logger.error('Error fetching failure classifications:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ==========================================
// EXECUTION INTELLIGENCE DASHBOARD METHODS
// ==========================================

/**
 * GET unified execution intelligence dashboard payload
 * GET /api/v1/runs/intelligence/dashboard
 */
exports.getIntelligenceDashboard = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const filters = {
            suiteId: req.query.suiteId || null,
            interval: req.query.interval === 'weekly' ? 'weekly' : 'daily',
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null,
            browser: req.query.browser || 'all',
            environment: req.query.environment || 'all',
            executionMethod: req.query.executionMethod || 'all'
        };

        const dashboardData = await executionIntelligenceService.getDashboardOverview(workspaceId, filters);

        res.json({
            success: true,
            data: dashboardData
        });
    } catch (err) {
        logger.error('Error getting intelligence dashboard:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET prioritized needs attention queue
 * GET /api/v1/runs/intelligence/attention
 */
exports.getIntelligenceAttentionQueue = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const filters = {
            suiteId: req.query.suiteId || null,
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null,
            browser: req.query.browser || 'all',
            environment: req.query.environment || 'all'
        };

        const dashboardData = await executionIntelligenceService.getDashboardOverview(workspaceId, filters);

        res.json({
            success: true,
            data: dashboardData.attentionQueue || []
        });
    } catch (err) {
        logger.error('Error getting intelligence attention queue:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET workspace requirement coverage overview
 * GET /api/v1/runs/intelligence/coverage
 */
exports.getIntelligenceCoverageOverview = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const suiteId = req.query.suiteId || null;
        const coverage = await executionIntelligenceService._aggregateWorkspaceCoverage(workspaceId, suiteId);

        res.json({
            success: true,
            data: coverage
        });
    } catch (err) {
        logger.error('Error getting intelligence coverage overview:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST trigger AI failure root cause analysis for a test execution
 * POST /api/v1/runs/:runId/cases/:runCaseId/analyze-root-cause
 */
exports.analyzeFailureRootCause = async (req, res) => {
    let quotaReservation = null;
    let targetOrgId = null;

    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const runId = req.params.runId || req.params.id;
        const runCaseId = req.params.runCaseId || req.params.caseId;
        const { forceFresh } = req.body || {};
        const userId = req.user._id || req.user.id;

        // Quota check and reservation for AI failure analysis
        targetOrgId = await usageMeteringService.resolveOrgForRequest(req, userId);
        if (targetOrgId) {
            try {
                quotaReservation = await usageMeteringService.reserveQuota({
                    orgId: targetOrgId,
                    workspaceId,
                    userId,
                    metric: 'ai.failure_analysis',
                    quantity: 1,
                    operationId: `fail_analysis_${runCaseId}_${Date.now()}`
                });
            } catch (qErr) {
                if (qErr.code === 'QUOTA_EXCEEDED') {
                    return res.status(403).json({
                        success: false,
                        code: 'QUOTA_EXCEEDED',
                        message: qErr.message,
                        data: qErr.data
                    });
                }
                throw qErr;
            }
        }

        const analysisRecord = await rootCauseAnalysisService.analyzeFailure(workspaceId, runId, runCaseId, {
            forceFresh: Boolean(forceFresh),
            userId
        });

        if (quotaReservation) {
            await usageMeteringService.commitUsage({
                reservationId: quotaReservation.id,
                orgId: targetOrgId,
                workspaceId,
                userId,
                resourceType: 'analysis',
                metric: 'ai.failure_analysis',
                quantity: 1,
                operationId: analysisRecord.id,
                metadata: { runId, runCaseId }
            }).catch(() => {});
            quotaReservation = null;
        }

        res.json({
            success: true,
            data: analysisRecord
        });
    } catch (err) {
        if (quotaReservation) {
            usageMeteringService.releaseReservation(quotaReservation.id);
            quotaReservation = null;
        }
        logger.error('Error analyzing failure root cause:', err);
        const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 500);
        res.status(statusCode).json({ success: false, message: err.message });
    }
};

/**
 * GET failure root cause analysis history for a test case
 * GET /api/v1/runs/:runId/cases/:runCaseId/root-cause-analyses
 */
exports.getFailureRootCauseAnalyses = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const runId = req.params.runId || req.params.id;
        const runCaseId = req.params.runCaseId || req.params.caseId;
        const history = await rootCauseAnalysisService.getAnalysesHistory(workspaceId, runId, runCaseId);

        res.json({
            success: true,
            data: history
        });
    } catch (err) {
        logger.error('Error fetching root cause analysis history:', err);
        const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 500);
        res.status(statusCode).json({ success: false, message: err.message });
    }
};

/**
 * POST submit user feedback for an AI root cause analysis
 * POST /api/v1/runs/root-cause-analyses/:analysisId/feedback
 */
exports.submitFailureAnalysisFeedback = async (req, res) => {
    try {
        const workspaceId = await resolveWorkspaceId(req);
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace ID required' });
        }

        const isAllowed = await verifyAccess(req, res, workspaceId);
        if (!isAllowed) return;

        const { analysisId } = req.params;
        const { rating, comment } = req.body || {};
        const userId = req.user._id || req.user.id;

        const updated = await rootCauseAnalysisService.submitFeedback(workspaceId, analysisId, {
            rating,
            comment,
            userId
        });

        res.json({
            success: true,
            data: updated
        });
    } catch (err) {
        logger.error('Error submitting analysis feedback:', err);
        const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 500);
        res.status(statusCode).json({ success: false, message: err.message });
    }
};

/**
 * Defect Management: Create defect linked to failed step / execution
 * POST /api/v1/runs/:id/cases/:caseId/defects
 */
exports.createCaseDefect = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const userId = req.user._id || req.user.id;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        let runCase = await supabaseService.getRunCaseById(caseId);
        if (!runCase || runCase.runId !== id) {
            const allRunCases = await supabaseService.getRunCases(id);
            runCase = allRunCases.find(rc => rc.id === caseId || rc.testCaseId === caseId);
        }
        if (!runCase) {
            return res.status(404).json({ success: false, message: 'Test run case not found' });
        }

        const {
            title,
            description,
            stepIndex,
            stepNumber,
            expectedResult,
            actualResult,
            severity,
            priority,
            evidence
        } = req.body;

        const defect = await defectService.createDefect({
            runId: id,
            runCaseId: runCase.id,
            testCaseId: runCase.testCaseId,
            stepIndex,
            stepNumber,
            title,
            description,
            expectedResult,
            actualResult,
            severity,
            priority,
            evidence,
            environment: run.targetEnvironment,
            createdBy: userId
        });

        res.status(201).json({
            success: true,
            data: defect
        });
    } catch (err) {
        logger.error('Error logging defect:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/**
 * List defects for a run
 * GET /api/v1/runs/:id/defects
 */
exports.listRunDefects = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const defects = await defectService.listDefects({ runId: id });
        res.json({
            success: true,
            data: defects
        });
    } catch (err) {
        logger.error('Error listing run defects:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * List defects for a specific run case
 * GET /api/v1/runs/:id/cases/:caseId/defects
 */
exports.listCaseDefects = async (req, res) => {
    try {
        const { id, caseId } = req.params;
        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const defects = await defectService.listDefects({ runId: id, runCaseId: caseId });
        res.json({
            success: true,
            data: defects
        });
    } catch (err) {
        logger.error('Error listing case defects:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
