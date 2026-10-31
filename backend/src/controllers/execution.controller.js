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

        // Audit log
        await supabaseService.recordWorkspaceAuditLog({
            workspaceId,
            actorId: userId,
            action: 'test_run.created',
            changes: { runId: run.id, name: run.name, executionType: run.executionType },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
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

        const runCase = await supabaseService.getRunCaseById(caseId);
        if (!runCase || runCase.runId !== id) {
            return res.status(404).json({ success: false, message: 'Test run case not found' });
        }

        const executions = await supabaseService.getCaseExecutions(caseId);
        const artifacts = await supabaseService.getRunArtifacts(id, caseId);

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

        const runCase = await supabaseService.getRunCaseById(caseId);
        if (!runCase || runCase.runId !== id) {
            return res.status(404).json({ success: false, message: 'Test run case not found' });
        }

        const {
            status,
            actualResult,
            notes,
            errorMessage,
            stackTrace,
            durationMs,
            executorType = 'manual'
        } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Execution status is required' });
        }

        const result = await supabaseService.recordTestExecution({
            runId: id,
            runCaseId: caseId,
            testCaseId: runCase.testCaseId,
            status,
            actualResult: actualResult || '',
            notes: notes || '',
            errorMessage: errorMessage || '',
            stackTrace: stackTrace || '',
            durationMs: durationMs || 0,
            executedBy: userId,
            executorType
        });

        // If evidence screenshot or artifact was uploaded in same payload
        if (req.body.artifact && req.body.artifact.data) {
            try {
                const saved = await saveArtifactBuffer({
                    workspaceId: run.workspaceId,
                    runId: id,
                    name: req.body.artifact.name || `evidence_${caseId}.png`,
                    data: req.body.artifact.data,
                    mimeType: req.body.artifact.mimeType || 'image/png'
                });

                await supabaseService.saveArtifact({
                    runId: id,
                    runCaseId: caseId,
                    executionId: result.execution.id,
                    name: saved.name,
                    artifactType: 'screenshot',
                    mimeType: saved.mimeType,
                    sizeBytes: saved.sizeBytes,
                    storagePath: saved.storagePath,
                    metadata: { source: 'manual_execution_evidence' }
                });
            } catch (artErr) {
                logger.warn('Failed to save execution artifact:', artErr.message);
            }
        }

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

        const allCases = await supabaseService.getRunCases(id);
        const failedCases = allCases.filter(c => c.status === 'failed');

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
        res.status(400).json({ success: false, message: err.message });
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
 * Phase 2: POST rerun with scope ('failed' | 'selected' | 'all')
 * POST /api/v1/runs/:id/rerun
 */
exports.rerun = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id || req.user.id;
        const { scope = 'failed', caseIds = [] } = req.body;

        const run = await supabaseService.getTestRunById(id);
        if (!run) {
            return res.status(404).json({ success: false, message: 'Test run not found' });
        }

        const isAllowed = await verifyAccess(req, res, run.workspaceId);
        if (!isAllowed) return;

        const result = await executionReport.executeRerun({
            runId: id,
            workspaceId: run.workspaceId,
            userId,
            scope,
            caseIds
        });

        res.status(202).json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (err) {
        logger.error('Error executing rerun:', err);
        res.status(400).json({ success: false, message: err.message });
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
