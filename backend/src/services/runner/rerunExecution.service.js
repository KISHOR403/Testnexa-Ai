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
     * Supports querying by rerunId, or by originalRunId with explicit rerunIdQuery
     */
    async compareRerun(targetRunId, workspaceId, rerunIdQuery = null) {
        if (!targetRunId || !workspaceId) {
            throw new Error('targetRunId and workspaceId are required for rerun comparison');
        }

        let originalRun = null;
        let rerunRun = null;

        if (rerunIdQuery) {
            // Case A: Querying on original run with explicit ?rerunId=...
            const rawOrig = await supabaseService.getTestRunById(targetRunId);
            if (!rawOrig) {
                const err = new Error(`Original test run not found (${targetRunId})`);
                err.statusCode = 404;
                throw err;
            }
            if (String(rawOrig.workspaceId) !== String(workspaceId)) {
                const err = new Error('Cross-workspace comparison is prohibited');
                err.statusCode = 403;
                throw err;
            }
            originalRun = rawOrig;

            const rawRerun = await supabaseService.getTestRunById(rerunIdQuery);
            if (!rawRerun) {
                const err = new Error(`Rerun test run not found (${rerunIdQuery})`);
                err.statusCode = 404;
                throw err;
            }
            if (String(rawRerun.workspaceId) !== String(workspaceId)) {
                const err = new Error('Cross-workspace comparison is prohibited');
                err.statusCode = 403;
                throw err;
            }
            rerunRun = rawRerun;
        } else {
            // Case B: Querying on a test run ID
            const targetRun = await supabaseService.getTestRunById(targetRunId);
            if (!targetRun) {
                const err = new Error(`Test run not found (${targetRunId})`);
                err.statusCode = 404;
                throw err;
            }
            if (String(targetRun.workspaceId) !== String(workspaceId)) {
                const err = new Error('Cross-workspace comparison is prohibited');
                err.statusCode = 403;
                throw err;
            }

            if (targetRun.originalRunId) {
                // targetRun is the rerun
                rerunRun = targetRun;
                originalRun = await supabaseService.getTestRunById(targetRun.originalRunId);
                if (!originalRun) {
                    const err = new Error(`Original test run not found (${targetRun.originalRunId})`);
                    err.statusCode = 404;
                    throw err;
                }
            } else {
                // targetRun is an original run; check for child reruns
                const reruns = await supabaseService.getRerunHistory(targetRunId, workspaceId);
                if (reruns && reruns.length > 0) {
                    originalRun = targetRun;
                    rerunRun = await supabaseService.getTestRunById(reruns[0].id);
                    if (!rerunRun) {
                        const err = new Error(`Associated rerun test run not found (${reruns[0].id})`);
                        err.statusCode = 404;
                        throw err;
                    }
                } else {
                    const err = new Error(`Test run ${targetRunId} is not a rerun execution and has no associated reruns to compare.`);
                    err.statusCode = 400;
                    throw err;
                }
            }
        }

        // Workspace authorization validation
        if (String(rerunRun.workspaceId) !== String(workspaceId) || String(originalRun.workspaceId) !== String(workspaceId)) {
            const err = new Error('Cross-workspace comparison is prohibited');
            err.statusCode = 403;
            throw err;
        }

        // Lineage relationship validation: rerun must be directly linked to original run
        const isLinked = String(rerunRun.originalRunId) === String(originalRun.id) ||
                         String(rerunRun.parentRunId) === String(originalRun.id);

        if (!isLinked) {
            const err = new Error(`Rerun execution ${rerunRun.id} is not associated with original execution ${originalRun.id}.`);
            err.statusCode = 400;
            throw err;
        }

        // Fetch test cases, executions, and artifacts in parallel
        const [origCases, rerunCases, origExecs, rerunExecs, origArtifacts, rerunArtifacts] = await Promise.all([
            supabaseService.getRunCases(originalRun.id),
            supabaseService.getRunCases(rerunRun.id),
            supabaseService.getRunExecutions(originalRun.id).catch(() => []),
            supabaseService.getRunExecutions(rerunRun.id).catch(() => []),
            supabaseService.getRunArtifacts(originalRun.id).catch(() => []),
            supabaseService.getRunArtifacts(rerunRun.id).catch(() => [])
        ]);

        // Map executions and artifacts by runCaseId
        const origExecMap = new Map();
        origExecs.forEach(e => {
            const key = String(e.runCaseId || e.run_case_id);
            if (!origExecMap.has(key) || (e.attemptNumber || 1) >= (origExecMap.get(key).attemptNumber || 1)) {
                origExecMap.set(key, e);
            }
        });

        const rerunExecMap = new Map();
        rerunExecs.forEach(e => {
            const key = String(e.runCaseId || e.run_case_id);
            if (!rerunExecMap.has(key) || (e.attemptNumber || 1) >= (rerunExecMap.get(key).attemptNumber || 1)) {
                rerunExecMap.set(key, e);
            }
        });

        const origArtifactsMap = new Map();
        origArtifacts.forEach(a => {
            const key = String(a.runCaseId || a.run_case_id || '');
            if (!origArtifactsMap.has(key)) origArtifactsMap.set(key, []);
            origArtifactsMap.get(key).push(a);
        });

        const rerunArtifactsMap = new Map();
        rerunArtifacts.forEach(a => {
            const key = String(a.runCaseId || a.run_case_id || '');
            if (!rerunArtifactsMap.has(key)) rerunArtifactsMap.set(key, []);
            rerunArtifactsMap.get(key).push(a);
        });

        // Map original cases by stable testCaseId
        const origCasesMap = new Map();
        origCases.forEach(c => {
            origCasesMap.set(String(c.testCaseId || c.caseSnapshot?.id), c);
        });

        const terminalStatuses = ['completed', 'failed', 'partially_completed', 'cancelled'];
        const isRerunTerminal = terminalStatuses.includes(String(rerunRun.status).toLowerCase());

        let fixedCount = 0;
        let stillFailingCount = 0;
        let regressionCount = 0;
        let stillPassingCount = 0;
        let blockedCount = 0;
        let skippedCount = 0;
        let pendingCount = 0;
        let addedCount = 0;
        let omittedCount = 0;

        const rerunSeenCaseIds = new Set();

        const comparisons = rerunCases.map(rCase => {
            const tcId = String(rCase.testCaseId || rCase.caseSnapshot?.id);
            rerunSeenCaseIds.add(tcId);
            const oCase = origCasesMap.get(tcId);

            const origStatus = oCase ? (oCase.status || 'not_run').toLowerCase() : 'missing';
            const rerunStatus = (rCase.status || 'not_run').toLowerCase();

            let transition = 'pending';
            let transitionLabel = 'Pending';

            if (!oCase) {
                // Case exists in rerun but was not present in original run
                transition = 'added';
                transitionLabel = 'New Test';
                addedCount++;
            } else if (!isRerunTerminal && ['not_run', 'in_progress', 'pending'].includes(rerunStatus)) {
                transition = 'pending';
                transitionLabel = 'Pending';
                pendingCount++;
            } else if (['failed', 'blocked'].includes(origStatus) && rerunStatus === 'passed') {
                transition = 'fixed';
                transitionLabel = 'Fixed';
                fixedCount++;
            } else if (origStatus === 'failed' && rerunStatus === 'failed') {
                transition = 'still_failing';
                transitionLabel = 'Still Failing';
                stillFailingCount++;
            } else if (origStatus === 'passed' && rerunStatus === 'failed') {
                transition = 'regression';
                transitionLabel = 'Regression';
                regressionCount++;
            } else if (origStatus === 'passed' && rerunStatus === 'passed') {
                transition = 'still_passing';
                transitionLabel = 'Still Passing';
                stillPassingCount++;
            } else if (rerunStatus === 'blocked') {
                transition = 'blocked';
                transitionLabel = 'Blocked';
                blockedCount++;
            } else if (rerunStatus === 'skipped') {
                transition = 'skipped';
                transitionLabel = 'Skipped';
                skippedCount++;
            } else if (['not_run', 'in_progress', 'pending'].includes(rerunStatus)) {
                transition = 'pending';
                transitionLabel = 'Pending';
                pendingCount++;
            } else {
                transition = 'other';
                transitionLabel = `Shifted (${origStatus} -> ${rerunStatus})`;
            }

            // Extract failure & execution details
            const oExec = oCase ? origExecMap.get(String(oCase.id)) : null;
            const rExec = rerunExecMap.get(String(rCase.id));

            const origError = oExec?.errorMessage || (origStatus === 'failed' ? (oCase?.notes || oCase?.actualResult || '') : '');
            const rerunError = rExec?.errorMessage || (rerunStatus === 'failed' ? (rCase.notes || rCase.actualResult || '') : '');

            const origDetails = {
                status: origStatus,
                actualResult: oCase?.actualResult || oExec?.actualResult || '',
                notes: oCase?.notes || oExec?.notes || '',
                errorMessage: origError,
                stackTrace: oExec?.stackTrace || '',
                durationMs: oCase?.durationMs || oExec?.durationMs || 0,
                executedAt: oCase?.executedAt || oExec?.createdAt || null,
                executedBy: oCase?.executedBy || oExec?.executedBy || 'Tester',
                artifacts: origArtifactsMap.get(String(oCase?.id || '')) || [],
                stepOutcomes: oExec?.stepOutcomes || {},
                stepObservations: oExec?.stepObservations || {}
            };

            const rerunDetails = {
                status: rerunStatus,
                actualResult: rCase.actualResult || rExec?.actualResult || '',
                notes: rCase.notes || rExec?.notes || '',
                errorMessage: rerunError,
                stackTrace: rExec?.stackTrace || '',
                durationMs: rCase.durationMs || rExec?.durationMs || 0,
                executedAt: rCase.executedAt || rExec?.createdAt || null,
                executedBy: rCase.executedBy || rExec?.executedBy || 'Tester',
                artifacts: rerunArtifactsMap.get(String(rCase.id)) || [],
                stepOutcomes: rExec?.stepOutcomes || {},
                stepObservations: rExec?.stepObservations || {}
            };

            const isErrorDifferent = Boolean(
                origError && rerunError && origError.trim().toLowerCase() !== rerunError.trim().toLowerCase()
            );

            const durationDiffMs = (rerunDetails.durationMs || 0) - (origDetails.durationMs || 0);

            // Construct honest diagnostic comparison notes
            let diagnosticSummary = '';
            if (transition === 'fixed') {
                diagnosticSummary = 'Resolved: Test failed in original execution, but passed cleanly on rerun.';
            } else if (transition === 'regression') {
                diagnosticSummary = 'Regression: Test passed in original run, but failed upon rerun.';
            } else if (transition === 'still_failing') {
                if (isErrorDifferent) {
                    diagnosticSummary = `Failure unresolved: Error signature changed on rerun: "${rerunError.slice(0, 80)}" vs "${origError.slice(0, 80)}"`;
                } else {
                    diagnosticSummary = 'Persistent failure: Reproduced with identical error signature and assertions.';
                }
            } else if (transition === 'blocked') {
                diagnosticSummary = 'Blocked: Execution prevented by unresolved environmental or prerequisite barrier.';
            } else if (transition === 'skipped') {
                diagnosticSummary = 'Skipped: Execution was intentionally bypassed or excluded during this run.';
            } else if (transition === 'pending') {
                diagnosticSummary = 'Pending: Rerun execution has not yet concluded for this test case.';
            } else if (transition === 'added') {
                diagnosticSummary = 'New test case added to rerun that was not evaluated in the original execution.';
            } else {
                diagnosticSummary = `Status shifted from ${origStatus} to ${rerunStatus}.`;
            }

            return {
                testCaseId: tcId,
                title: rCase.caseSnapshot?.title || oCase?.caseSnapshot?.title || 'Untitled Test Case',
                category: rCase.caseSnapshot?.category || rCase.caseSnapshot?.type || oCase?.caseSnapshot?.category || 'Functional',
                priority: rCase.caseSnapshot?.priority || oCase?.caseSnapshot?.priority || 'Medium',
                executionType: rCase.executionType || 'manual',
                originalStatus: origStatus,
                rerunStatus: rerunStatus,
                originalDurationMs: origDetails.durationMs,
                rerunDurationMs: rerunDetails.durationMs,
                durationDiffMs,
                transition,
                transitionLabel,
                isFixed: transition === 'fixed',
                isRegression: transition === 'regression',
                isStillFailing: transition === 'still_failing',
                isPending: transition === 'pending',
                originalDetails: origDetails,
                rerunDetails: rerunDetails,
                diagnosticDifferences: {
                    isErrorDifferent,
                    isDurationDifferent: Math.abs(durationDiffMs) > 200,
                    summary: diagnosticSummary
                }
            };
        });

        // Also identify cases that were in original run but omitted from the rerun
        origCases.forEach(oCase => {
            const tcId = String(oCase.testCaseId || oCase.caseSnapshot?.id);
            if (!rerunSeenCaseIds.has(tcId)) {
                omittedCount++;
                const oExec = origExecMap.get(String(oCase.id));
                const origStatus = (oCase.status || 'not_run').toLowerCase();

                comparisons.push({
                    testCaseId: tcId,
                    title: oCase.caseSnapshot?.title || 'Untitled Test Case',
                    category: oCase.caseSnapshot?.category || 'Functional',
                    priority: oCase.caseSnapshot?.priority || 'Medium',
                    executionType: oCase.executionType || 'manual',
                    originalStatus: origStatus,
                    rerunStatus: 'omitted',
                    originalDurationMs: oCase.durationMs || 0,
                    rerunDurationMs: 0,
                    durationDiffMs: -(oCase.durationMs || 0),
                    transition: 'omitted',
                    transitionLabel: 'Omitted from Rerun',
                    isFixed: false,
                    isRegression: false,
                    isStillFailing: false,
                    isPending: false,
                    originalDetails: {
                        status: origStatus,
                        actualResult: oCase.actualResult || '',
                        notes: oCase.notes || '',
                        errorMessage: oExec?.errorMessage || '',
                        stackTrace: oExec?.stackTrace || '',
                        durationMs: oCase.durationMs || 0,
                        executedAt: oCase.executedAt || null,
                        executedBy: oCase.executedBy || 'Tester',
                        artifacts: origArtifactsMap.get(String(oCase.id)) || [],
                        stepOutcomes: oExec?.stepOutcomes || {},
                        stepObservations: oExec?.stepObservations || {}
                    },
                    rerunDetails: {
                        status: 'omitted',
                        actualResult: '',
                        notes: 'Test case was omitted from this rerun scope.',
                        errorMessage: '',
                        stackTrace: '',
                        durationMs: 0,
                        executedAt: null,
                        executedBy: null,
                        artifacts: [],
                        stepOutcomes: {},
                        stepObservations: {}
                    },
                    diagnosticDifferences: {
                        isErrorDifferent: false,
                        isDurationDifferent: false,
                        summary: 'Test case was part of the original execution but excluded from this rerun.'
                    }
                });
            }
        });

        // Compute overall verdict
        let verdict = 'IN_PROGRESS';
        if (isRerunTerminal) {
            if (regressionCount > 0) {
                verdict = 'REGRESSIONS_DETECTED';
            } else if (stillFailingCount === 0 && fixedCount > 0) {
                verdict = 'ALL_FIXED';
            } else if (fixedCount > 0 && stillFailingCount > 0) {
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
            suiteId: rerunRun.suiteId || originalRun.suiteId,
            suiteName: rerunRun.suiteName || originalRun.suiteName || rerunRun.name,
            targetEnvironment: rerunRun.targetEnvironment || originalRun.targetEnvironment || {},
            executionType: rerunRun.executionType || originalRun.executionType || 'manual',
            rerunType: rerunRun.rerunType || 'failed',
            rerunStatus: rerunRun.status,
            originalStatus: originalRun.status,
            rerunStartedAt: rerunRun.startedAt || rerunRun.createdAt,
            rerunCompletedAt: rerunRun.completedAt,
            originalStartedAt: originalRun.startedAt || originalRun.createdAt,
            originalCompletedAt: originalRun.completedAt,
            terminalStateReached: isRerunTerminal,
            summary: {
                totalCompared: rerunCases.length,
                totalSuiteCases: origCases.length,
                fixedCount,
                stillFailingCount,
                regressionCount,
                stillPassingCount,
                blockedCount,
                skippedCount,
                pendingCount,
                addedCount,
                omittedCount,
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
