/**
 * Execution Report Service — Phase 2: Unified Execution Intelligence & Analytics
 * 
 * Provides production-grade report aggregation, multi-run comparison, failure diagnostics,
 * requirement-to-test execution coverage, and multi-format exports (JSON, CSV, PDF-HTML).
 */

const supabaseService = require('../supabaseData.service');
const { getArtifactBuffer } = require('../../utils/artifactStorage');
const logger = require('../../utils/logger');

class ExecutionReportService {
    /**
     * Generates a comprehensive unified execution report combining manual and automated outcomes.
     * All metrics are strictly computed from actual persisted records in the database.
     */
    async generateRunReport(runId, workspaceId) {
        if (!runId || !workspaceId) {
            throw new Error('runId and workspaceId are required to generate report');
        }

        const run = await supabaseService.getTestRunById(runId, workspaceId);
        if (!run) {
            throw new Error(`Test run ${runId} not found in workspace`);
        }

        const cases = await supabaseService.getRunCases(runId);
        const artifacts = await supabaseService.getRunArtifacts(runId);

        // Fetch execution histories for all cases in run
        const caseExecutionMap = new Map();
        for (const c of cases) {
            const history = await supabaseService.getCaseExecutions(c.id);
            caseExecutionMap.set(c.id, history || []);
        }

        // Fetch parent suite details if available to map requirement traceability
        let suite = null;
        if (run.suiteId) {
            try {
                suite = await supabaseService.getSession(run.suiteId, run.createdBy);
            } catch (sErr) {
                logger.warn(`Could not load parent suite ${run.suiteId} for report:`, sErr.message);
            }
        }

        // 1. Core Summary Metrics
        let passed = 0;
        let failed = 0;
        let blocked = 0;
        let skipped = 0;
        let notRun = 0;

        let manualTotal = 0;
        let manualPassed = 0;
        let manualFailed = 0;
        let manualBlocked = 0;
        let manualSkipped = 0;
        let manualDurationMs = 0;

        let automatedTotal = 0;
        let automatedPassed = 0;
        let automatedFailed = 0;
        let automatedTimedOut = 0;
        let automatedInfraError = 0;
        let automatedDurationMs = 0;

        const detailedCases = [];
        const failureInvestigations = [];

        for (const c of cases) {
            const st = (c.status || 'not_run').toLowerCase();
            const attempts = caseExecutionMap.get(c.id) || [];
            const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
            const method = (c.executionType || run.executionType || 'manual').toLowerCase();
            const duration = c.durationMs || c.lastDurationMs || latestAttempt?.durationMs || latestAttempt?.duration_ms || 0;

            if (st === 'passed') passed++;
            else if (st === 'failed') failed++;
            else if (st === 'blocked') blocked++;
            else if (st === 'skipped') skipped++;
            else notRun++;

            if (method === 'automated') {
                automatedTotal++;
                automatedDurationMs += duration;
                if (st === 'passed') automatedPassed++;
                else if (st === 'failed') automatedFailed++;
                else if (st === 'timed_out') automatedTimedOut++;
                else if (st === 'infrastructure_error') automatedInfraError++;
            } else {
                manualTotal++;
                manualDurationMs += duration;
                if (st === 'passed') manualPassed++;
                else if (st === 'failed') manualFailed++;
                else if (st === 'blocked') manualBlocked++;
                else if (st === 'skipped') manualSkipped++;
            }

            // Find screenshot artifacts for this test case
            const caseArtifacts = artifacts.filter(a => a.run_case_id === c.id || a.runCaseId === c.id);

            const caseItem = {
                id: c.id,
                testCaseId: c.testCaseId,
                title: c.caseSnapshot?.title || c.title || 'Untitled Case',
                type: c.caseSnapshot?.type || c.type || 'Functional',
                module: c.caseSnapshot?.module || 'General',
                priority: c.caseSnapshot?.priority || 'Medium',
                executionType: method,
                status: st,
                actualResult: c.actualResult || latestAttempt?.actualResult || latestAttempt?.actual_result || '',
                notes: c.notes || latestAttempt?.notes || '',
                expectedResult: c.caseSnapshot?.expectedResult || '',
                currentAttempt: c.currentAttempt || attempts.length || 1,
                durationMs: duration,
                executedBy: c.executedBy || latestAttempt?.executedBy || latestAttempt?.executed_by || null,
                executedAt: c.executedAt || latestAttempt?.executedAt || latestAttempt?.executed_at || null,
                artifactsCount: caseArtifacts.length,
                attemptsCount: attempts.length,
                attempts: attempts.map(att => ({
                    id: att.id,
                    attemptNumber: att.attemptNumber || att.attempt_number,
                    status: att.status,
                    actualResult: att.actualResult || att.actual_result || '',
                    errorMessage: att.errorMessage || att.error_message || '',
                    durationMs: att.durationMs || att.duration_ms || 0,
                    executedBy: att.executedBy || att.executed_by,
                    executorType: att.executorType || att.executor_type,
                    executedAt: att.executedAt || att.executed_at
                }))
            };

            detailedCases.push(caseItem);

            // Failure Investigation payload
            if (['failed', 'blocked', 'timed_out', 'infrastructure_error'].includes(st)) {
                const isAutomated = method === 'automated';
                const failureArtifact = caseArtifacts.find(a => a.artifact_type === 'screenshot' || a.artifactType === 'screenshot') || caseArtifacts[0];
                
                failureInvestigations.push({
                    runCaseId: c.id,
                    testCaseId: c.testCaseId,
                    title: caseItem.title,
                    type: caseItem.type,
                    method,
                    status: st,
                    durationMs: duration,
                    failedAt: caseItem.executedAt || c.updatedAt,
                    expectedResult: c.caseSnapshot?.expectedResult || '',
                    actualResult: caseItem.actualResult,
                    // Automated failure specifics
                    errorMessage: latestAttempt?.errorMessage || latestAttempt?.error_message || '',
                    stackTrace: latestAttempt?.stackTrace || latestAttempt?.stack_trace || '',
                    failedStep: '',
                    browserInfo: '',
                    targetUrl: run.targetEnvironment?.baseUrl || '',
                    screenshotArtifact: failureArtifact ? {
                        id: failureArtifact.id,
                        name: failureArtifact.name,
                        mimeType: failureArtifact.mime_type || failureArtifact.mimeType || 'image/png',
                        sizeBytes: failureArtifact.size_bytes || failureArtifact.sizeBytes || 0,
                        url: `/api/v1/runs/${runId}/artifacts/${failureArtifact.id}/file`
                    } : null,
                    // Manual failure specifics
                    testerObservations: !isAutomated ? (caseItem.notes || caseItem.actualResult) : null,
                    testerUser: c.executedBy || run.assignedTo || 'Assigned QA Engineer'
                });
            }
        }

        const totalCases = cases.length;
        const diagnosticLogArtifacts = artifacts.filter(a => (a.artifact_type || a.artifactType) === 'log' || (a.mime_type || a.mimeType || '').startsWith('text/'));
        let warningCount = diagnosticLogArtifacts.length > 0 ? 0 : null;
        for (const artifact of diagnosticLogArtifacts) {
            const file = getArtifactBuffer(artifact.storage_path || artifact.storagePath);
            if (file?.data) warningCount += (file.data.toString('utf8').match(/\bwarn(?:ing)?\b/gi) || []).length;
        }
        const diagnosticSummary = {
            failures: failureInvestigations.length,
            errors: cases.filter(c => (c.status || '').toLowerCase() === 'infrastructure_error').length,
            timeouts: cases.filter(c => (c.status || '').toLowerCase() === 'timed_out').length,
            flaky: cases.filter(c => {
                const outcomes = (caseExecutionMap.get(c.id) || []).map(attempt => (attempt.status || '').toLowerCase());
                return outcomes.some(status => ['failed', 'timed_out', 'infrastructure_error'].includes(status)) && outcomes.includes('passed');
            }).length,
            warnings: warningCount
        };
        const totalDurationMs = manualDurationMs + automatedDurationMs;
        const overallPassRate = totalCases > 0 ? Math.round((passed / totalCases) * 100) : 0;
        const manualPassRate = manualTotal > 0 ? Math.round((manualPassed / manualTotal) * 100) : 0;
        const automatedPassRate = automatedTotal > 0 ? Math.round((automatedPassed / automatedTotal) * 100) : 0;
        const completionRate = totalCases > 0 ? Math.round(((totalCases - notRun) / totalCases) * 100) : 0;

        // 2. Requirement Traceability & Execution Coverage Analysis
        const coverageAnalysis = this.computeRunCoverage(cases, suite);

        // 3. Category Breakdown (Functional, Negative, Edge, Security, API)
        const categoryMap = new Map();
        for (const c of detailedCases) {
            const cat = c.type || 'Functional';
            if (!categoryMap.has(cat)) {
                categoryMap.set(cat, { total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, notRun: 0 });
            }
            const agg = categoryMap.get(cat);
            agg.total++;
            if (c.status === 'passed') agg.passed++;
            else if (c.status === 'failed') agg.failed++;
            else if (c.status === 'blocked') agg.blocked++;
            else if (c.status === 'skipped') agg.skipped++;
            else agg.notRun++;
        }

        const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, stats]) => ({
            category,
            ...stats,
            passRate: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0
        }));

        return {
            identifiers: {
                runId: run.id,
                runName: run.name,
                description: run.description || '',
                suiteId: run.suiteId || run.suite_id || null,
                suiteName: suite?.title || suite?.feature || 'Independent Test Suite',
                suiteVersion: run.suiteVersion || run.suite_version || 1,
                workspaceId: run.workspaceId || run.workspace_id,
                executionType: run.executionType || run.execution_type || 'manual',
                status: run.status || 'pending',
                createdBy: run.createdBy || run.created_by,
                assignedTo: run.assignedTo || run.assigned_to
            },
            timestamps: {
                createdAt: run.createdAt || run.created_at,
                startedAt: run.startedAt || run.started_at,
                completedAt: run.completedAt || run.completed_at,
                durationMs: totalDurationMs,
                formattedDuration: this.formatDuration(totalDurationMs)
            },
            environment: {
                name: run.targetEnvironment?.name || '',
                baseUrl: run.targetEnvironment?.baseUrl || run.targetEnvironment?.base_url || '',
                environmentId: run.environmentId || run.environment_id || null
            },
            summary: {
                total: totalCases,
                passed,
                failed,
                blocked,
                skipped,
                notRun,
                passRate: overallPassRate,
                completionRate
            },
            methodBreakdown: {
                manual: {
                    total: manualTotal,
                    passed: manualPassed,
                    failed: manualFailed,
                    blocked: manualBlocked,
                    skipped: manualSkipped,
                    passRate: manualPassRate,
                    durationMs: manualDurationMs,
                    formattedDuration: this.formatDuration(manualDurationMs)
                },
                automated: {
                    total: automatedTotal,
                    passed: automatedPassed,
                    failed: automatedFailed,
                    timedOut: automatedTimedOut,
                    infraError: automatedInfraError,
                    passRate: automatedPassRate,
                    durationMs: automatedDurationMs,
                    formattedDuration: this.formatDuration(automatedDurationMs)
                }
            },
            categoryBreakdown,
            coverage: coverageAnalysis,
            diagnosticsSummary: diagnosticSummary,
            failureInvestigations,
            cases: detailedCases,
            artifactsSummary: {
                totalArtifacts: artifacts.length,
                screenshots: artifacts.filter(a => (a.artifact_type || a.artifactType) === 'screenshot').length,
                traces: artifacts.filter(a => (a.artifact_type || a.artifactType) === 'trace').length,
                logs: artifacts.filter(a => (a.artifact_type || a.artifactType) === 'log').length
            }
        };
    }

    /**
     * Compute requirement-to-test execution coverage for a run
     */
    computeRunCoverage(cases, suite) {
        const sData = suite?.suiteData || suite?.suite_data || suite?.data || suite;
        const requirementSources = [sData?.understanding?.functional_requirements, sData?.requirements, sData?.traceability?.matrix];
        const rawSource = requirementSources.find(source => Array.isArray(source) ? source.length > 0 : source && Object.keys(source).length > 0) || [];
        const rawReqs = Array.isArray(rawSource) ? rawSource : Object.entries(rawSource).map(([id, value]) =>
            typeof value === 'object' && value !== null ? { ...value, id: value.id || value.reqId || id } : { id, description: String(value || '') }
        );

        const requirementMap = new Map();
        const requirementById = new Map();

        // Seed only requirements present in the suite specification. Internal keys are
        // generated for records without IDs, but those keys are never exposed as IDs.
        if (Array.isArray(rawReqs) && rawReqs.length > 0) {
            rawReqs.forEach((r, idx) => {
                const reqId = typeof r === 'object' && r !== null ? (r.id || r.reqId || r.requirementId || null) : null;
                const text = typeof r === 'string' ? r : (r && (r.description || r.requirement || r.text || r.title) || '');
                const key = reqId ? `id:${reqId}` : `source:${idx}:${text}`;
                const explicitRefs = typeof r === 'object' && r !== null ? (r.testCaseIds || r.linkedCases || r.testCases || []) : [];
                requirementMap.set(key, {
                    key,
                    id: reqId,
                    description: text,
                    category: typeof r === 'object' && r !== null ? (r.category || null) : null,
                    priority: typeof r === 'object' && r !== null ? (r.priority || r.importance || null) : null,
                    explicitCaseRefs: (Array.isArray(explicitRefs) ? explicitRefs : []).map(ref => typeof ref === 'object' ? (ref.testCaseId || ref.id) : ref).filter(Boolean).map(String),
                    linkedCases: [],
                    linkedTests: [],
                    passedCases: [],
                    failedCases: [],
                    status: 'uncovered'
                });
                if (reqId) requirementById.set(String(reqId), key);
            });
        }

        // A case links only through a persisted requirement reference or an explicit
        // test-case reference stored on the requirement itself.
        cases.forEach(c => {
            const snap = c.caseSnapshot || {};
            const caseRefs = [c.id, c.testCaseId].filter(Boolean).map(String);
            const reqRef = snap.requirementId || snap.requirementRef || snap.reqId || null;
            const keys = new Set();
            if (reqRef && requirementById.has(String(reqRef))) keys.add(requirementById.get(String(reqRef)));
            if (reqRef && !requirementById.has(String(reqRef))) {
                const key = `ref:${reqRef}`;
                if (!requirementMap.has(key)) {
                    requirementMap.set(key, {
                        key, id: String(reqRef), description: snap.requirementText || snap.requirement || '',
                        category: snap.requirementCategory || null, priority: snap.requirementPriority || null,
                        explicitCaseRefs: [], linkedCases: [], linkedTests: [], passedCases: [], failedCases: [], status: 'uncovered'
                    });
                    requirementById.set(String(reqRef), key);
                }
                keys.add(requirementById.get(String(reqRef)));
            }

            requirementMap.forEach((req, key) => {
                if (req.explicitCaseRefs.some(ref => caseRefs.includes(ref))) keys.add(key);
            });

            keys.forEach(key => {
                const req = requirementMap.get(key);
                const testId = c.testCaseId || c.id;
                const status = (c.status || 'not_run').toLowerCase();
                if (req.linkedTests.some(test => test.runCaseId === c.id)) return;
                req.linkedCases.push(testId);
                req.linkedTests.push({
                    runCaseId: c.id,
                    testCaseId: testId,
                    title: snap.title || c.title || '',
                    category: snap.type || null,
                    priority: snap.priority || null,
                    executionType: c.executionType || null,
                    status,
                    durationMs: Number(c.durationMs || c.lastDurationMs || 0),
                    executedAt: c.executedAt || null,
                    actualResult: c.actualResult || ''
                });
                if (status === 'passed') req.passedCases.push(testId);
                if (['failed', 'blocked', 'timed_out', 'infrastructure_error'].includes(status)) req.failedCases.push(testId);
            });
        });

        // Linkage and verification are separate: only all-linked-tests-passed verifies.
        let coveredRequirementsCount = 0;
        let verifiedRequirementsCount = 0;
        let failedRequirementsCount = 0;
        let partiallyCoveredRequirementsCount = 0;

        requirementMap.forEach(req => {
            const executedStatuses = req.linkedTests.map(test => test.status).filter(status =>
                !['not_run', 'pending', 'queued', 'running', 'in_progress'].includes(status)
            );
            if (req.linkedCases.length === 0) {
                req.status = 'uncovered';
            } else {
                coveredRequirementsCount++;
            }
            if (req.linkedCases.length > 0 && req.failedCases.length > 0) {
                req.status = 'failed';
                failedRequirementsCount++;
            } else if (req.linkedCases.length > 0 && req.passedCases.length === req.linkedCases.length) {
                req.status = 'verified';
                verifiedRequirementsCount++;
            } else if (req.linkedCases.length > 0 && executedStatuses.length === 0) {
                req.status = 'unverified';
            } else if (req.linkedCases.length > 0) {
                req.status = 'partial';
                partiallyCoveredRequirementsCount++;
            }
        });

        const totalReqs = requirementMap.size;
        const requirementsList = Array.from(requirementMap.values());

        return {
            totalRequirements: totalReqs,
            coveredRequirements: coveredRequirementsCount,
            verifiedRequirements: verifiedRequirementsCount,
            failedRequirements: failedRequirementsCount,
            partiallyCoveredRequirements: partiallyCoveredRequirementsCount,
            uncoveredRequirements: requirementsList.filter(req => req.status === 'uncovered').length,
            requirementCoveragePercentage: totalReqs > 0 ? Math.round((coveredRequirementsCount / totalReqs) * 100) : 0,
            requirementVerificationPercentage: totalReqs > 0 ? Math.round((verifiedRequirementsCount / totalReqs) * 100) : 0,
            requirements: requirementsList
        };
    }

    /**
     * Compares two test runs: Baseline vs Target Run
     * Detects regressions, fixes, unchanged cases, duration deltas, and outcome shifts.
     */
    async compareRuns(targetRunId, baselineRunId, workspaceId) {
        if (!targetRunId || !baselineRunId || !workspaceId) {
            throw new Error('targetRunId, baselineRunId, and workspaceId are required for comparison');
        }

        const [targetReport, baselineReport] = await Promise.all([
            this.generateRunReport(targetRunId, workspaceId),
            this.generateRunReport(baselineRunId, workspaceId)
        ]);

        const baselineCasesMap = new Map();
        baselineReport.cases.forEach(c => {
            baselineCasesMap.set(c.testCaseId || c.id, c);
        });

        const targetCasesMap = new Map();
        targetReport.cases.forEach(c => {
            targetCasesMap.set(c.testCaseId || c.id, c);
        });

        const regressions = []; // Passed in baseline -> Failed in target
        const fixes = [];       // Failed in baseline -> Passed in target
        const unchanged = [];   // Same outcome
        const outcomeShifts = [];
        const newCases = [];
        const removedCases = [];

        // Check target cases against baseline
        for (const [tcId, targetCase] of targetCasesMap.entries()) {
            if (!baselineCasesMap.has(tcId)) {
                newCases.push(targetCase);
                continue;
            }

            const baselineCase = baselineCasesMap.get(tcId);
            const bStatus = baselineCase.status;
            const tStatus = targetCase.status;
            const durationDiffMs = targetCase.durationMs - baselineCase.durationMs;

            const comparisonItem = {
                testCaseId: tcId,
                title: targetCase.title,
                type: targetCase.type,
                executionType: targetCase.executionType,
                baselineStatus: bStatus,
                targetStatus: tStatus,
                baselineDurationMs: baselineCase.durationMs,
                targetDurationMs: targetCase.durationMs,
                durationDiffMs,
                baselineAttempts: baselineCase.attemptsCount,
                targetAttempts: targetCase.attemptsCount
            };

            if (bStatus === 'passed' && (tStatus === 'failed' || tStatus === 'blocked')) {
                regressions.push({
                    ...comparisonItem,
                    severity: 'critical',
                    reason: targetCase.notes || targetCase.actualResult || 'Automated assertion regression'
                });
                outcomeShifts.push({ ...comparisonItem, type: 'regression' });
            } else if ((bStatus === 'failed' || bStatus === 'blocked') && tStatus === 'passed') {
                fixes.push(comparisonItem);
                outcomeShifts.push({ ...comparisonItem, type: 'fix' });
            } else if (bStatus === tStatus) {
                unchanged.push(comparisonItem);
            } else {
                outcomeShifts.push({ ...comparisonItem, type: 'shift' });
            }
        }

        // Check for removed cases
        for (const [tcId, baselineCase] of baselineCasesMap.entries()) {
            if (!targetCasesMap.has(tcId)) {
                removedCases.push(baselineCase);
            }
        }

        // Coverage Comparison
        const baseReqs = baselineReport.coverage?.requirements || [];
        const targetReqs = targetReport.coverage?.requirements || [];

        const baseReqMap = new Map();
        baseReqs.forEach(r => baseReqMap.set(r.id, r));

        const targetReqMap = new Map();
        targetReqs.forEach(r => targetReqMap.set(r.id, r));

        const newlyCovered = [];
        const newlyUncovered = [];
        const newlyFailing = [];
        const newlyPassing = [];

        targetReqMap.forEach((tr, id) => {
            const br = baseReqMap.get(id);
            if (!br || br.status === 'uncovered') {
                if (tr.status === 'verified' || tr.status === 'partial') {
                    newlyCovered.push(tr);
                }
            }
            if (br && br.status !== 'failed' && tr.status === 'failed') {
                newlyFailing.push(tr);
            }
            if (br && br.status === 'failed' && tr.status === 'verified') {
                newlyPassing.push(tr);
            }
        });

        baseReqMap.forEach((br, id) => {
            const tr = targetReqMap.get(id);
            if (!tr || tr.status === 'uncovered') {
                if (br.status !== 'uncovered') {
                    newlyUncovered.push(br);
                }
            }
        });

        const coverageComparison = {
            baselineVerificationPct: baselineReport.coverage?.requirementVerificationPercentage ?? 0,
            targetVerificationPct: targetReport.coverage?.requirementVerificationPercentage ?? 0,
            verificationDeltaPct: (targetReport.coverage?.requirementVerificationPercentage ?? 0) - (baselineReport.coverage?.requirementVerificationPercentage ?? 0),
            baselineVerifiedCount: baselineReport.coverage?.verifiedRequirements ?? 0,
            targetVerifiedCount: targetReport.coverage?.verifiedRequirements ?? 0,
            baselineUncoveredCount: baselineReport.coverage?.uncoveredRequirements ?? 0,
            targetUncoveredCount: targetReport.coverage?.uncoveredRequirements ?? 0,
            newlyCovered,
            newlyUncovered,
            newlyFailing,
            newlyPassing
        };

        // Summary Deltas
        const passRateDiff = targetReport.summary.passRate - baselineReport.summary.passRate;
        const durationDiffMs = targetReport.timestamps.durationMs - baselineReport.timestamps.durationMs;
        const totalCasesDiff = targetReport.summary.total - baselineReport.summary.total;
        const isSuiteVersionCompatible = (baselineReport.identifiers.suiteVersion || 1) === (targetReport.identifiers.suiteVersion || 1);

        return {
            baselineRun: {
                id: baselineReport.identifiers.runId,
                name: baselineReport.identifiers.runName,
                createdAt: baselineReport.timestamps.createdAt,
                passRate: baselineReport.summary.passRate,
                total: baselineReport.summary.total,
                passed: baselineReport.summary.passed,
                failed: baselineReport.summary.failed,
                durationMs: baselineReport.timestamps.durationMs,
                environment: baselineReport.environment.name,
                suiteId: baselineReport.identifiers.suiteId,
                suiteName: baselineReport.identifiers.suiteName,
                suiteVersion: baselineReport.identifiers.suiteVersion || 1
            },
            targetRun: {
                id: targetReport.identifiers.runId,
                name: targetReport.identifiers.runName,
                createdAt: targetReport.timestamps.createdAt,
                passRate: targetReport.summary.passRate,
                total: targetReport.summary.total,
                passed: targetReport.summary.passed,
                failed: targetReport.summary.failed,
                durationMs: targetReport.timestamps.durationMs,
                environment: targetReport.environment.name,
                suiteId: targetReport.identifiers.suiteId,
                suiteName: targetReport.identifiers.suiteName,
                suiteVersion: targetReport.identifiers.suiteVersion || 1
            },
            isSuiteVersionCompatible,
            deltas: {
                passRateDelta: passRateDiff,
                passRateFormatted: (passRateDiff >= 0 ? `+${passRateDiff}%` : `${passRateDiff}%`),
                durationDiffMs,
                durationFormatted: (durationDiffMs >= 0 ? `+${this.formatDuration(durationDiffMs)}` : `-${this.formatDuration(Math.abs(durationDiffMs))}`),
                totalCasesDiff,
                regressionsCount: regressions.length,
                fixesCount: fixes.length,
                unchangedCount: unchanged.length,
                newCasesCount: newCases.length,
                removedCasesCount: removedCases.length
            },
            coverageComparison,
            regressions,
            fixes,
            unchanged,
            outcomeShifts,
            newCases,
            removedCases
        };
    }

    /**
     * Executes Rerun with flexible scope: 'failed' | 'selected' | 'all'
     * Creates new historical execution attempts and preserves all previous history.
     */
    async executeRerun({ runId, workspaceId, userId, scope = 'failed', caseIds = [] }) {
        if (!runId || !workspaceId) {
            throw new Error('runId and workspaceId are required for rerun');
        }

        const run = await supabaseService.getTestRunById(runId, workspaceId);
        if (!run) throw new Error(`Test run ${runId} not found`);

        const allCases = await supabaseService.getRunCases(runId);
        let targetCases = [];

        if (scope === 'failed') {
            targetCases = allCases.filter(c => c.status === 'failed' || c.status === 'blocked');
        } else if (scope === 'selected' && Array.isArray(caseIds) && caseIds.length > 0) {
            const set = new Set(caseIds);
            targetCases = allCases.filter(c => set.has(c.id) || set.has(c.testCaseId));
        } else if (scope === 'all') {
            targetCases = allCases;
        } else {
            throw new Error(`Invalid rerun scope "${scope}". Supported: failed, selected, all`);
        }

        if (targetCases.length === 0) {
            throw new Error(`No test cases match rerun criteria for scope "${scope}"`);
        }

        // Reset status to 'pending' or 'in_progress' for selected cases to prepare new attempts
        const now = new Date().toISOString();
        for (const c of targetCases) {
            await supabaseService.updateRunCase(c.id, {
                status: 'in_progress',
                actual_result: '',
                notes: `Rerun attempt initiated via scope: ${scope}`,
                executed_at: now
            });
        }

        // Separate automated vs manual cases in rerun scope
        const automatedCases = targetCases.filter(c => {
            const snap = c.caseSnapshot || {};
            const map = snap.automationMapping;
            return c.executionType === 'automated' || run.executionType === 'automated' ||
                Boolean(map && map.mappingStatus === 'configured' && (map.scriptCode || map.scriptRef));
        });

        let job = null;
        if (automatedCases.length > 0) {
            const jobQueue = require('./jobQueue.service');
            job = await jobQueue.submitJob({
                runId: run.id,
                workspaceId: run.workspaceId,
                adapter: 'playwright',
                targetEnvironment: run.targetEnvironment || {},
                requestedBy: userId,
                caseIds: automatedCases.map(c => c.id)
            });
        }

        // Record audit event
        await supabaseService.recordWorkspaceAuditLog({
            workspaceId,
            actorId: userId,
            action: 'test_run.rerun_initiated',
            changes: {
                runId,
                scope,
                totalTargetCases: targetCases.length,
                automatedCasesQueued: automatedCases.length,
                jobId: job?.id || null
            }
        });

        return {
            runId: run.id,
            scope,
            rerunCasesCount: targetCases.length,
            automatedCasesCount: automatedCases.length,
            manualCasesCount: targetCases.length - automatedCases.length,
            jobId: job?.id || null,
            message: `Successfully initiated rerun for ${targetCases.length} test cases.`
        };
    }

    /**
     * Export execution report in JSON, CSV, or Print-Ready PDF HTML
     */
    async exportReport(runId, workspaceId, format = 'json') {
        const report = await this.generateRunReport(runId, workspaceId);

        if (format === 'json') {
            return {
                contentType: 'application/json',
                filename: `TestNexa_ExecutionReport_${report.identifiers.runId}.json`,
                content: JSON.stringify(report, null, 2)
            };
        }

        if (format === 'csv') {
            const csvRows = [
                ['Test Case ID', 'Title', 'Category', 'Method', 'Status', 'Duration (ms)', 'Attempts', 'Executed By', 'Executed At', 'Actual Result', 'Failure Notes', 'Artifacts Count']
            ];

            report.cases.forEach(c => {
                csvRows.push([
                    `"${c.testCaseId || ''}"`,
                    `"${(c.title || '').replace(/"/g, '""')}"`,
                    `"${c.type || 'Functional'}"`,
                    `"${c.executionType || 'manual'}"`,
                    `"${c.status || 'not_run'}"`,
                    c.durationMs || 0,
                    c.currentAttempt || 1,
                    `"${c.executedBy || ''}"`,
                    `"${c.executedAt || ''}"`,
                    `"${(c.actualResult || '').replace(/"/g, '""')}"`,
                    `"${(c.notes || '').replace(/"/g, '""')}"`,
                    c.artifactsCount || 0
                ]);
            });

            const csvContent = csvRows.map(r => r.join(',')).join('\n');
            return {
                contentType: 'text/csv',
                filename: `TestNexa_ExecutionReport_${report.identifiers.runId}.csv`,
                content: csvContent
            };
        }

        if (format === 'pdf' || format === 'html') {
            const htmlContent = this.generatePrintableHtmlReport(report);
            return {
                contentType: 'text/html',
                filename: `TestNexa_ExecutionReport_${report.identifiers.runId}.html`,
                content: htmlContent
            };
        }

        throw new Error(`Unsupported export format "${format}". Supported formats: json, csv, pdf`);
    }

    /**
     * Generates an editorial, print-ready, high-fidelity HTML report for PDF export/printing
     */
    generatePrintableHtmlReport(report) {
        const id = report.identifiers;
        const sum = report.summary;
        const mb = report.methodBreakdown;
        const time = report.timestamps;

        const failureRows = report.failureInvestigations.map((f, i) => `
            <div style="border: 1px solid #E06C75; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #FFF5F5;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 700; color: #C53030;">#${i + 1} [${f.testCaseId}] ${this.escapeHtml(f.title)}</span>
                    <span style="background: #FEB2B2; color: #9B2C2C; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${f.method} ${f.status}</span>
                </div>
                <div style="font-size: 12px; margin-bottom: 6px;"><strong>Failed Step / Assertion:</strong> ${this.escapeHtml(f.failedStep)}</div>
                <div style="font-size: 12px; margin-bottom: 6px; color: #C53030;"><strong>Error Message:</strong> <code>${this.escapeHtml(f.errorMessage || f.actualResult)}</code></div>
                ${f.stackTrace ? `<pre style="background: #2D3748; color: #E2E8F0; padding: 8px; border-radius: 4px; font-size: 10px; overflow-x: auto; white-space: pre-wrap;">${this.escapeHtml(f.stackTrace.slice(0, 800))}</pre>` : ''}
                <div style="font-size: 11px; color: #718096; margin-top: 6px;">Duration: ${f.durationMs}ms | Environment: ${this.escapeHtml(f.targetUrl)} | Verified By: ${this.escapeHtml(f.testerUser)}</div>
            </div>
        `).join('');

        const caseRows = report.cases.map(c => `
            <tr style="border-bottom: 1px solid #E2E8F0; font-size: 12px;">
                <td style="padding: 8px; font-family: monospace; font-weight: 600;">${this.escapeHtml(c.testCaseId)}</td>
                <td style="padding: 8px;">${this.escapeHtml(c.title)}</td>
                <td style="padding: 8px;">${this.escapeHtml(c.type)}</td>
                <td style="padding: 8px; text-transform: uppercase; font-size: 10px; font-weight: 600;">${c.executionType}</td>
                <td style="padding: 8px;">
                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: ${c.status === 'passed' ? '#C6F6D5; color: #22543D;' : c.status === 'failed' ? '#FED7D7; color: #742A2A;' : '#EDF2F7; color: #4A5568;'}">${c.status}</span>
                </td>
                <td style="padding: 8px; text-align: right;">${c.durationMs}ms</td>
                <td style="padding: 8px; text-align: center;">${c.currentAttempt}</td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>TestNexa AI — Execution Intelligence Report (${id.runId})</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1A202C; background: #FFFFFF; margin: 0; padding: 24px; line-height: 1.5; }
        .header { border-bottom: 2px solid #2D3748; padding-bottom: 16px; margin-bottom: 24px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .kpi-card { border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px; background: #F7FAFC; }
        .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #718096; }
        .kpi-val { font-size: 24px; font-weight: 800; color: #1A202C; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { background: #EDF2F7; padding: 8px; font-size: 11px; text-transform: uppercase; color: #4A5568; border-bottom: 2px solid #CBD5E0; }
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 16px; text-align: right;">
        <button onclick="window.print()" style="background: #2D3748; color: #FFF; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-weight: 600;">Print / Save to PDF</button>
    </div>

    <div class="header">
        <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #319795;">TESTNEXA AI — EXECUTIVE EXECUTION AUDIT</div>
        <h1 style="margin: 4px 0 6px 0; font-size: 22px;">${this.escapeHtml(id.runName)}</h1>
        <div style="font-size: 12px; color: #718096;">
            Run ID: <code>${id.runId}</code> | Suite: <strong>${this.escapeHtml(id.suiteName)}</strong> (v${id.suiteVersion}) | Environment: <strong>${this.escapeHtml(report.environment.name)}</strong> (${this.escapeHtml(report.environment.baseUrl)}) | Date: ${new Date(time.createdAt).toLocaleString()}
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-title">Overall Pass Rate</div>
            <div class="kpi-val" style="color: ${sum.passRate >= 90 ? '#38A169' : sum.passRate >= 70 ? '#DD6B20' : '#E53E3E'};">${sum.passRate}%</div>
            <div style="font-size: 11px; color: #718096;">${sum.passed} passed of ${sum.total} total</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Execution Mode Breakdown</div>
            <div style="font-size: 13px; font-weight: 700; margin-top: 6px;">
                Manual: ${mb.manual.total} (${mb.manual.passRate}%)<br/>
                Playwright: ${mb.automated.total} (${mb.automated.passRate}%)
            </div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Total Duration</div>
            <div class="kpi-val">${time.formattedDuration}</div>
            <div style="font-size: 11px; color: #718096;">Auto: ${mb.automated.formattedDuration} | Man: ${mb.manual.formattedDuration}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Requirement Coverage</div>
            <div class="kpi-val" style="color: #3182CE;">${report.coverage.requirementCoveragePercentage}%</div>
            <div style="font-size: 11px; color: #718096;">${report.coverage.verifiedRequirements} of ${report.coverage.totalRequirements} verified</div>
        </div>
    </div>

    ${report.failureInvestigations.length > 0 ? `
        <h2 style="font-size: 16px; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-top: 28px; color: #C53030;">Failure Investigation & Diagnostics (${report.failureInvestigations.length})</h2>
        ${failureRows}
    ` : ''}

    <h2 style="font-size: 16px; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-top: 28px;">Detailed Test Outcomes</h2>
    <table>
        <thead>
            <tr>
                <th>Test ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Method</th>
                <th>Outcome</th>
                <th style="text-align: right;">Duration</th>
                <th style="text-align: center;">Attempts</th>
            </tr>
        </thead>
        <tbody>
            ${caseRows}
        </tbody>
    </table>

    <div style="margin-top: 36px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #A0AEC0; text-align: center;">
        Generated by TestNexa AI Execution Intelligence Engine on ${new Date().toUTCString()} — Append-only immutable execution record.
    </div>
</body>
</html>`;
    }

    formatDuration(ms) {
        if (!ms || ms <= 0) return '0s';
        if (ms < 1000) return `${ms}ms`;
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        if (min === 0) return `${sec}s`;
        return `${min}m ${sec}s`;
    }

    escapeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

module.exports = new ExecutionReportService();

