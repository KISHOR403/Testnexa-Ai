/**
 * TestNexa AI — Unified Rerun Execution Service (Phase 2)
 *
 * Implements production-grade test rerun capabilities:
 * 1. Rerun Failed Tests: creates a dedicated new run containing only failed/blocked cases.
 * 2. Rerun Selected Tests: creates a dedicated new run with user-chosen cases.
 * 3. Rerun Single Test: creates a dedicated new run for a single target case.
 *
 * Enforces:
 * - Immutable original execution preservation (never overwrites original runs or attempts).
 * - Complete lineage relationship tracking (newRunId, originalRunId, parentRunId, rerunType).
 * - Multi-tenant workspace isolation.
 * - Real Playwright worker queueing for automated cases.
 * - Clean manual execution workflow integration.
 * - Idempotency & duplicate submission locking.
 * - Terminal state comparison analysis (fixed, still failing, blocked, skipped, missing).
 */

const supabaseService = require('../supabaseData.service');
const jobQueue = require('./jobQueue.service');
const logger = require('../../utils/logger');

class RerunExecutionService {
    /**
     * Create a new execution run specifically for rerun scenarios
     */
    async createRerunExecution({
        runId,
        workspaceId,
        userId,
        scope = 'failed',
        caseIds = [],
        caseId = null,
        mode = 'new_run',
        force = false,
        allowConcurrent = false
    }) {
        if (!runId || !workspaceId) {
            const err = new Error('runId and workspaceId are required to initiate a rerun');
            err.statusCode = 400;
            throw err;
        }

        const normalizedScope = String(scope || 'failed').toLowerCase();
        if (!['failed', 'selected', 'single', 'all'].includes(normalizedScope)) {
            const err = new Error(`Invalid rerun scope "${scope}". Supported: failed, selected, single, all`);
            err.statusCode = 400;
            throw err;
        }

        // 1. Validate original run
        const originalRun = await supabaseService.getTestRunById(runId, workspaceId);
        if (!originalRun) {
            const err = new Error(`Test run not found (${runId})`);
            err.statusCode = 404;
            throw err;
        }

        if (String(originalRun.workspaceId) !== String(workspaceId)) {
            const err = new Error('Cross-workspace rerun is strictly prohibited');
            err.statusCode = 403;
            throw err;
        }

        // 2. Prevent duplicate submissions if an active rerun of the same type is already running
        if (!force && !allowConcurrent) {
            const activeRerun = await supabaseService.findActiveRerun(originalRun.id, normalizedScope);
            if (activeRerun) {
                const err = new Error(`A rerun with scope "${normalizedScope}" is already ${activeRerun.status} for this execution (Run ID: ${activeRerun.id})`);
                err.statusCode = 409;
                err.data = { activeRunId: activeRerun.id, status: activeRerun.status };
                throw err;
            }
        }

        // 3. Load all run cases from original execution
        const allOriginalCases = await supabaseService.getRunCases(originalRun.id);
        if (allOriginalCases.length === 0) {
            const err = new Error('Original test run contains 0 test cases to rerun');
            err.statusCode = 400;
            throw err;
        }

        // 4. Filter target test cases based on requested rerun scope
        let targetCases = [];
        if (normalizedScope === 'failed') {
            targetCases = allOriginalCases.filter(c => {
                const st = String(c.status || '').toLowerCase();
                return st === 'failed' || st === 'blocked';
            });
            if (targetCases.length === 0) {
                const err = new Error('No failed test cases to rerun');
                err.statusCode = 400;
                throw err;
            }
        } else if (normalizedScope === 'selected') {
            const candidateIds = Array.isArray(caseIds) ? caseIds.map(String) : [];
            if (candidateIds.length === 0) {
                const err = new Error('No test case IDs provided for selected rerun');
                err.statusCode = 400;
                throw err;
            }
            const idSet = new Set(candidateIds);
            targetCases = allOriginalCases.filter(c => idSet.has(String(c.id)) || idSet.has(String(c.testCaseId)) || idSet.has(String(c.caseSnapshot?.id)));
            if (targetCases.length === 0) {
                const err = new Error('None of the selected test case IDs belong to the original test run');
                err.statusCode = 400;
                throw err;
            }
        } else if (normalizedScope === 'single') {
            const targetCaseId = String(caseId || (Array.isArray(caseIds) ? caseIds[0] : '')).trim();
            if (!targetCaseId) {
                const err = new Error('A valid test case ID is required for single case rerun');
                err.statusCode = 400;
                throw err;
            }
            const found = allOriginalCases.find(c => String(c.id) === targetCaseId || String(c.testCaseId) === targetCaseId || String(c.caseSnapshot?.id) === targetCaseId);
            if (!found) {
                const err = new Error(`Test case "${targetCaseId}" not found in original test run`);
                err.statusCode = 404;
                throw err;
            }
            targetCases = [found];
        } else if (normalizedScope === 'all') {
            targetCases = allOriginalCases;
        }

        // 5. Build snapshot representations for the target cases
        const clonedCases = targetCases.map((origCase, idx) => {
            const snap = origCase.caseSnapshot || {};
            const existingMapping = snap.automationMapping || origCase.automationMapping || null;

            return {
                id: origCase.testCaseId || snap.id || `TC_${idx + 1}`,
                title: snap.title || origCase.title || 'Untitled Test Case',
                testScenario: snap.testScenario || origCase.testScenario || '',
                module: snap.module || 'General',
                type: snap.type || 'Functional',
                priority: snap.priority || 'Medium',
                severity: snap.severity || 'Major',
                preconditions: snap.preconditions || '',
                testData: snap.testData || 'N/A',
                steps: Array.isArray(snap.steps) ? snap.steps : (Array.isArray(origCase.steps) ? origCase.steps : []),
                expectedResult: snap.expectedResult || '',
                requirementId: snap.requirementId || origCase.requirementId || '',
                executionType: origCase.executionType || snap.executionType || 'manual',
                automationMapping: existingMapping
            };
        });

        // 6. Determine execution method for the new rerun
        const automatedCount = clonedCases.filter(c => {
            const map = c.automationMapping;
            const hasMapping = Boolean(
                map &&
                map.mappingStatus === 'configured' &&
                (map.scriptCode || map.code || map.spec || (map.scriptSource === 'existing' && map.scriptRef))
            );
            return (c.executionType === 'automated' || originalRun.executionType === 'automated') && hasMapping;
        }).length;

        let derivedExecutionType = 'manual';
        if (automatedCount === clonedCases.length) {
            derivedExecutionType = 'automated';
        } else if (automatedCount > 0) {
            derivedExecutionType = 'mixed';
        }

        // If user explicitly ran an automated rerun or single automated test, ensure automation mapping exists
        const requiresAutomation = originalRun.executionType === 'automated' || targetCases.some(c => c.executionType === 'automated');
        if (requiresAutomation && automatedCount === 0 && (normalizedScope === 'single' || normalizedScope === 'failed')) {
            const err = new Error(`Cannot rerun automated test case(s): No configured and valid Playwright scripts discovered for the targeted cases.`);
            err.statusCode = 400;
            throw err;
        }

        // 7. Create the NEW TestRun entity in the database
        const rerunName = `${originalRun.name} (Rerun - ${normalizedScope.toUpperCase()})`;
        const newRun = await supabaseService.createTestRun({
            workspaceId,
            suiteId: originalRun.suiteId,
            suiteVersion: originalRun.suiteVersion || 1,
            name: rerunName,
            description: `Automated rerun created from ${originalRun.name} (${originalRun.id}). Target scope: ${normalizedScope}`,
            executionType: derivedExecutionType,
            environmentId: originalRun.environmentId || null,
            targetEnvironment: originalRun.targetEnvironment || {},
            datasetId: originalRun.datasetId || null,
            datasetVersion: originalRun.datasetVersion || null,
            datasetName: originalRun.datasetName || null,
            createdBy: userId || originalRun.createdBy,
            originalRunId: originalRun.id,
            parentRunId: originalRun.id,
            rerunType: normalizedScope,
            rerunScope: normalizedScope,
            selectedCaseIds: targetCases.map(c => c.testCaseId || c.id),
            isRerun: true,
            customCases: clonedCases
        });

        // 8. If automated cases exist, queue them through the existing Playwright worker
        let queuedJob = null;
        let jobError = null;

        if (automatedCount > 0) {
            const newRunCases = await supabaseService.getRunCases(newRun.id);
            const eligibleNewRunCases = newRunCases.filter(c => {
                const map = c.caseSnapshot?.automationMapping;
                return Boolean(
                    map &&
                    map.mappingStatus === 'configured' &&
                    (map.scriptCode || map.code || map.spec || (map.scriptSource === 'existing' && map.scriptRef))
                );
            });

            if (eligibleNewRunCases.length > 0) {
                try {
                    queuedJob = await jobQueue.submitJob({
                        runId: newRun.id,
                        workspaceId,
                        adapter: 'playwright',
                        targetEnvironment: newRun.targetEnvironment || {},
                        requestedBy: userId,
                        caseIds: eligibleNewRunCases.map(c => c.id)
                    });
                } catch (qErr) {
                    logger.error(`JobQueue submission failed for rerun ${newRun.id}:`, qErr);
                    jobError = qErr.message;
                    // Update run status safely without crashing
                    await supabaseService.updateTestRun(newRun.id, workspaceId, {
                        status: 'failed'
                    });
                }
            }
        }

        // 9. Record audit event
        await supabaseService.recordWorkspaceAuditLog({
            workspaceId,
            actorId: userId || originalRun.createdBy,
            action: 'test_run.rerun_created',
            changes: {
                originalRunId: originalRun.id,
                newRunId: newRun.id,
                rerunType: normalizedScope,
                totalTargetCases: targetCases.length,
                automatedCasesQueued: automatedCount,
                jobId: queuedJob?.id || null
            }
        });

        const refreshedRun = await supabaseService.getTestRunById(newRun.id, workspaceId);

        return {
            newRunId: newRun.id,
            runId: newRun.id,
            originalRunId: originalRun.id,
            parentRunId: originalRun.id,
            rerunType: normalizedScope,
            rerunScope: normalizedScope,
            executionType: newRun.executionType,
            failedCasesCount: targetCases.length, // Backwards compatibility for existing test assertions
            rerunCasesCount: targetCases.length,
            automatedCasesCount: automatedCount,
            manualCasesCount: targetCases.length - automatedCount,
            job: queuedJob,
            jobError,
            run: refreshedRun || newRun,
            message: `Successfully created rerun execution ${newRun.id} targeting ${targetCases.length} case(s).`
        };
    }

    /**
     * Compare a rerun execution against its original execution
     */
    async compareRerun(rerunId, workspaceId) {
        if (!rerunId || !workspaceId) {
            throw new Error('rerunId and workspaceId are required for rerun comparison');
        }

        const rerunRun = await supabaseService.getTestRunById(rerunId, workspaceId);
        if (!rerunRun) {
            const err = new Error(`Rerun test run not found (${rerunId})`);
            err.statusCode = 404;
            throw err;
        }

        if (!rerunRun.originalRunId) {
            const err = new Error(`Test run ${rerunId} is not a rerun execution (no originalRunId linked)`);
            err.statusCode = 400;
            throw err;
        }

        const originalRun = await supabaseService.getTestRunById(rerunRun.originalRunId, workspaceId);
        if (!originalRun) {
            const err = new Error(`Original test run not found (${rerunRun.originalRunId})`);
            err.statusCode = 404;
            throw err;
        }

        if (String(rerunRun.workspaceId) !== String(originalRun.workspaceId)) {
            const err = new Error('Cross-workspace comparison is prohibited');
            err.statusCode = 403;
            throw err;
        }

        const [origCases, rerunCases] = await Promise.all([
            supabaseService.getRunCases(originalRun.id),
            supabaseService.getRunCases(rerunRun.id)
        ]);

        const origCasesMap = new Map();
        origCases.forEach(c => {
            origCasesMap.set(String(c.testCaseId || c.caseSnapshot?.id), c);
        });

        const terminalStatuses = ['completed', 'failed', 'partially_completed', 'cancelled'];
        const isRerunTerminal = terminalStatuses.includes(String(rerunRun.status).toLowerCase());

        let fixedCount = 0;
        let stillFailingCount = 0;
        let blockedCount = 0;
        let skippedCount = 0;
        let missingResultCount = 0;

        const comparisons = rerunCases.map(rCase => {
            const tcId = String(rCase.testCaseId || rCase.caseSnapshot?.id);
            const oCase = origCasesMap.get(tcId);

            const origStatus = oCase ? (oCase.status || 'not_run').toLowerCase() : 'unknown';
            const rerunStatus = (rCase.status || 'not_run').toLowerCase();

            let transition = 'missing_result';
            let transitionLabel = 'Incomplete';

            if (['not_run', 'in_progress'].includes(rerunStatus)) {
                transition = 'missing_result';
                transitionLabel = 'Pending or in progress';
                missingResultCount++;
            } else if (['failed', 'blocked'].includes(origStatus) && rerunStatus === 'passed') {
                transition = 'fixed';
                transitionLabel = 'Fixed';
                fixedCount++;
            } else if (origStatus === 'failed' && rerunStatus === 'failed') {
                transition = 'still_failing';
                transitionLabel = 'Still failing';
                stillFailingCount++;
            } else if (rerunStatus === 'blocked') {
                transition = 'blocked';
                transitionLabel = 'Blocked';
                blockedCount++;
            } else if (rerunStatus === 'skipped') {
                transition = 'skipped';
                transitionLabel = 'Skipped';
                skippedCount++;
            } else {
                transition = 'other';
                transitionLabel = `Shifted (${origStatus} -> ${rerunStatus})`;
            }

            return {
                testCaseId: tcId,
                title: rCase.caseSnapshot?.title || oCase?.caseSnapshot?.title || 'Untitled',
                executionType: rCase.executionType,
                originalStatus: origStatus,
                rerunStatus: rerunStatus,
                originalDurationMs: oCase?.durationMs || 0,
                rerunDurationMs: rCase.durationMs || 0,
                durationDiffMs: (rCase.durationMs || 0) - (oCase?.durationMs || 0),
                transition,
                transitionLabel,
                isFixed: transition === 'fixed',
                actualResult: rCase.actualResult || '',
                notes: rCase.notes || ''
            };
        });

        let verdict = 'IN_PROGRESS';
        if (isRerunTerminal) {
            if (fixedCount === rerunCases.length && rerunCases.length > 0) {
                verdict = 'ALL_FIXED';
            } else if (fixedCount > 0) {
                verdict = 'PARTIALLY_FIXED';
            } else if (stillFailingCount > 0) {
                verdict = 'UNRESOLVED';
            } else {
                verdict = 'COMPLETED';
            }
        }

        return {
            rerunId: rerunRun.id,
            originalRunId: originalRun.id,
            rerunName: rerunRun.name,
            originalName: originalRun.name,
            rerunType: rerunRun.rerunType,
            rerunStatus: rerunRun.status,
            originalStatus: originalRun.status,
            terminalStateReached: isRerunTerminal,
            summary: {
                totalCompared: comparisons.length,
                fixedCount,
                stillFailingCount,
                blockedCount,
                skippedCount,
                missingResultCount,
                verdict
            },
            comparisons
        };
    }

    /**
     * Retrieve all rerun executions linked to an original run
     */
    async getRerunHistory(runId, workspaceId) {
        return await supabaseService.getRerunHistory(runId, workspaceId);
    }

    /**
     * Retrieve hierarchical relationships for an execution run
     */
    async getRerunRelationships(runId, workspaceId) {
        return await supabaseService.getRerunRelationships(runId, workspaceId);
    }
}

module.exports = new RerunExecutionService();
