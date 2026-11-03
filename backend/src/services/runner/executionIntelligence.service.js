/**
 * TestNexa AI — Execution Intelligence & Unified QA Health Engine
 *
 * Consolidates real persisted test execution data, failure trends, flaky detection,
 * requirement verification coverage, and prioritized triage into a single authoritative dashboard.
 *
 * 100% Real Persisted Data — Zero Mock/Invented Insights.
 */

const supabaseService = require('../supabaseData.service');
const failureTrendsService = require('./failureTrends.service');
const flakyDetectionService = require('./flakyDetection.service');
const executionReportService = require('./executionReport.service');
const logger = require('../../utils/logger');

const COMPLETED_RUN_STATUSES = new Set(['completed', 'partially_completed', 'failed']);
const FAILURE_STATUSES = new Set(['failed', 'blocked', 'timed_out', 'infrastructure_error']);

class ExecutionIntelligenceService {
    constructor() {
        this.cache = new Map(); // workspaceId:filters -> { data, timestamp }
        this.cacheTTL = 3 * 60 * 1000; // 3 minutes TTL
    }

    /**
     * Invalidate cached intelligence data for a workspace
     */
    invalidateCache(workspaceId) {
        if (!workspaceId) {
            this.cache.clear();
            return;
        }
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${workspaceId}:`)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Aggregate workspace-wide requirement verification coverage
     */
    async _aggregateWorkspaceCoverage(workspaceId, suiteId = null) {
        try {
            // Get all completed runs in workspace to check verified pass status
            const completedRuns = await supabaseService.getWorkspaceRunsWithCases(workspaceId, {
                suiteId: suiteId !== 'all' ? suiteId : null,
                limit: 100
            }).catch(() => []);

            const suiteIdSet = new Set();
            if (suiteId && suiteId !== 'all') {
                suiteIdSet.add(String(suiteId));
            }
            completedRuns.forEach(r => {
                const sid = r.suiteId || r.suite_id;
                if (sid) suiteIdSet.add(String(sid));
            });

            // Fetch test suites belonging to workspace
            let suiteSessions = [];
            for (const sid of suiteIdSet) {
                try {
                    const s = await supabaseService.getSession(sid);
                    if (s && !suiteSessions.some(existing => String(existing.id || existing._id) === String(s.id || s._id))) {
                        suiteSessions.push(s);
                    }
                } catch (_) {}
            }

            if (suiteSessions.length === 0) {
                const sessionsRes = await supabaseService.listSessions(workspaceId, { limit: 100 }).catch(() => ({ sessions: [] }));
                suiteSessions = sessionsRes.sessions || [];
            }

            if (suiteSessions.length === 0 && supabaseService.inMemorySessions) {
                for (const s of supabaseService.inMemorySessions.values()) {
                    const sid = String(s.id || s._id);
                    if (suiteIdSet.has(sid) || s.workspaceId === workspaceId || s.workspace_id === workspaceId) {
                        suiteSessions.push(supabaseService._formatSession ? supabaseService._formatSession(s) : s);
                    }
                }
            }

            if (suiteId && suiteId !== 'all') {
                suiteSessions = suiteSessions.filter(s => String(s.id || s._id) === String(suiteId));
            }

            let totalRequirements = 0;
            let linkedRequirements = 0;
            let verifiedRequirements = 0;
            let uncoveredRequirements = 0;
            let failingRequirements = 0;
            const uncoveredList = [];

            // Build case status map: testCaseId -> latest status across runs
            const caseStatusMap = new Map();
            completedRuns.forEach(run => {
                const cases = run.cases || [];
                cases.forEach(c => {
                    const cid = String(c.testCaseId || c.caseSnapshot?.id || c.id);
                    const st = (c.status || '').toLowerCase();
                    if (!caseStatusMap.has(cid)) {
                        caseStatusMap.set(cid, st);
                    }
                });
            });

            for (const suite of suiteSessions) {
                const sData = suite.suiteData || suite.suite_data || suite.data || suite;
                const rawSource = [
                    sData?.understanding?.functional_requirements,
                    sData?.requirements,
                    sData?.traceability?.matrix
                ].find(source => Array.isArray(source) ? source.length > 0 : source && Object.keys(source).length > 0) || [];

                const reqItems = Array.isArray(rawSource)
                    ? rawSource
                    : Object.entries(rawSource).map(([id, val]) =>
                        typeof val === 'object' && val !== null ? { ...val, id: val.id || id } : { id, description: String(val || '') }
                    );

                // Collect all test cases in this suite
                const allSuiteCases = supabaseService._extractCasesFromSuiteData(sData) || [];

                reqItems.forEach((req, idx) => {
                    totalRequirements++;
                    const reqId = typeof req === 'object' && req !== null ? (req.id || req.reqId || req.requirementId || `REQ_${idx + 1}`) : `REQ_${idx + 1}`;
                    const desc = typeof req === 'string' ? req : (req.description || req.requirement || req.title || `Requirement ${reqId}`);
                    const priority = typeof req === 'object' && req !== null ? (req.priority || req.importance || 'Medium') : 'Medium';

                    // Find linked test cases
                    const explicitCaseRefs = (typeof req === 'object' && req !== null ? (req.testCaseIds || req.linkedCases || req.testCases || []) : [])
                        .map(ref => typeof ref === 'object' ? (ref.testCaseId || ref.id) : ref)
                        .filter(Boolean)
                        .map(String);

                    const linkedSuiteCases = allSuiteCases.filter(tc => {
                        const tcId = String(tc.id || tc.testCaseId || '');
                        if (explicitCaseRefs.includes(tcId)) return true;
                        const tcReqId = String(tc.requirementId || tc.requirementRef || tc.reqId || '');
                        return tcReqId && (tcReqId === String(reqId) || tcReqId.includes(String(reqId)));
                    });

                    if (linkedSuiteCases.length === 0) {
                        uncoveredRequirements++;
                        if (uncoveredList.length < 15) {
                            uncoveredList.push({
                                requirementId: reqId,
                                description: desc,
                                priority,
                                suiteId: suite.id,
                                suiteName: suite.title || sData.testSuiteName || 'Default Suite',
                                status: 'uncovered',
                                reason: 'No test cases linked to this requirement specification.'
                            });
                        }
                    } else {
                        linkedRequirements++;
                        // Check if all linked cases passed in recent executions
                        const statuses = linkedSuiteCases.map(tc => caseStatusMap.get(String(tc.id || tc.testCaseId || '')) || 'not_run');
                        const executedStatuses = statuses.filter(st => st !== 'not_run');
                        const hasFailure = executedStatuses.some(st => FAILURE_STATUSES.has(st));
                        const allPassed = (statuses.length > 0 && statuses.every(st => st === 'passed')) ||
                                          (executedStatuses.length > 0 && !hasFailure && executedStatuses.every(st => st === 'passed'));

                        if (allPassed) {
                            verifiedRequirements++;
                        } else if (hasFailure) {
                            failingRequirements++;
                            if (uncoveredList.length < 15) {
                                uncoveredList.push({
                                    requirementId: reqId,
                                    description: desc,
                                    priority,
                                    suiteId: suite.id,
                                    suiteName: suite.title || sData.testSuiteName || 'Default Suite',
                                    status: 'failing',
                                    reason: 'Linked test cases are currently failing execution.'
                                });
                            }
                        }
                    }
                });
            }

            const linkedCoveragePct = totalRequirements > 0
                ? Number(((linkedRequirements / totalRequirements) * 100).toFixed(1))
                : 0;

            const verifiedCoveragePct = totalRequirements > 0
                ? Number(((verifiedRequirements / totalRequirements) * 100).toFixed(1))
                : 0;

            return {
                totalRequirements,
                linkedRequirements,
                verifiedRequirements,
                uncoveredRequirements,
                failingRequirements,
                linkedCoveragePct,
                verifiedCoveragePct,
                uncoveredList
            };
        } catch (err) {
            logger.warn('Failed to aggregate workspace coverage:', err.message);
            return {
                totalRequirements: 0,
                linkedRequirements: 0,
                verifiedRequirements: 0,
                uncoveredRequirements: 0,
                failingRequirements: 0,
                linkedCoveragePct: 0,
                verifiedCoveragePct: 0,
                uncoveredList: []
            };
        }
    }

    /**
     * Compute comprehensive Execution Intelligence Dashboard payload
     */
    async getDashboardOverview(workspaceId, filters = {}) {
        if (!workspaceId) {
            throw new Error('workspaceId is required');
        }

        const cacheKey = `${workspaceId}:${JSON.stringify(filters)}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            return cached.data;
        }

        const {
            suiteId = null,
            interval = 'daily',
            startDate = null,
            endDate = null,
            browser = 'all',
            environment = 'all',
            executionMethod = 'all'
        } = filters;

        // 1. Fetch Failure Trends Analysis
        const trendReport = await failureTrendsService.analyzeFailureTrends(workspaceId, {
            suiteId: suiteId !== 'all' ? suiteId : null,
            interval,
            startDate,
            endDate,
            browser,
            environment,
            executionMethod
        });

        // 2. Fetch Flaky Tests Analysis
        const flakyReport = await flakyDetectionService.analyzeWorkspaceFlakyTests(workspaceId, {
            suiteId: suiteId !== 'all' ? suiteId : null,
            environmentId: environment !== 'all' ? environment : null
        }).catch(() => ({ summary: { flakyCount: 0 }, allTests: [] }));

        // 3. Fetch Coverage Overview
        const coverageOverview = await this._aggregateWorkspaceCoverage(workspaceId, suiteId);

        // 4. Fetch Recent Runs (both completed and in_progress)
        const allRunsWithCases = await supabaseService.getWorkspaceRunsWithCases(workspaceId, {
            suiteId: suiteId !== 'all' ? suiteId : null,
            limit: 50
        }).catch(() => []);

        // Sort all runs newest first
        allRunsWithCases.sort((a, b) => {
            const tA = new Date(a.createdAt || a.startedAt || 0).getTime();
            const tB = new Date(b.createdAt || b.startedAt || 0).getTime();
            return tB - tA;
        });

        // Format recent 10 runs
        const recentRuns = allRunsWithCases.slice(0, 10).map(run => {
            const cases = run.cases || [];
            let passCount = 0;
            let failCount = 0;
            cases.forEach(c => {
                const st = (c.status || '').toLowerCase();
                if (st === 'passed') passCount++;
                if (FAILURE_STATUSES.has(st)) failCount++;
            });

            const durationMs = run.summary?.duration_ms || cases.reduce((acc, c) => acc + (c.durationMs || 0), 0);

            return {
                id: run.id,
                name: run.name || `Run #${run.id.slice(-6)}`,
                suiteId: run.suiteId,
                status: run.status || 'completed',
                executionType: run.executionType || 'manual',
                totalCases: cases.length,
                passCount,
                failCount,
                startedAt: run.startedAt || run.createdAt,
                completedAt: run.completedAt,
                durationMs,
                isRerun: Boolean(run.isRerun || run.originalRunId),
                reportUrl: `/app/runs/${run.id}?tab=report`
            };
        });

        // 5. Calculate Health Summary
        const trendSummary = trendReport.summary || {};
        const totalCompletedRuns = trendSummary.runsAnalyzed || 0;
        const totalExecutedCases = trendSummary.totalExecutions || 0;
        const totalFailures = trendSummary.totalFailures || 0;
        const uniqueFailingCases = trendSummary.uniqueFailingCases || 0;

        // Calculate pass counts from timeSeries
        let totalPasses = 0;
        let totalBlocked = 0;
        let totalSkipped = 0;
        (trendReport.timeSeries || []).forEach(b => {
            totalPasses += (b.passCount || 0);
            totalBlocked += (b.blockedCount || 0);
            totalSkipped += (b.skippedCount || 0);
        });

        const passRate = totalExecutedCases > 0
            ? Number(((totalPasses / totalExecutedCases) * 100).toFixed(1))
            : 0;

        const failureRate = trendSummary.overallFailureRate || (
            totalExecutedCases > 0 ? Number(((totalFailures / totalExecutedCases) * 100).toFixed(1)) : 0
        );

        // Trajectory mapping
        let qualityTrajectory = 'steady';
        if (trendSummary.trajectory === 'decreasing') qualityTrajectory = 'improving';
        else if (trendSummary.trajectory === 'increasing') qualityTrajectory = 'declining';

        const healthSummary = {
            totalCompletedRuns,
            totalExecutedCases,
            passedCases: totalPasses,
            failedCases: totalFailures,
            blockedCases: totalBlocked,
            skippedCases: totalSkipped,
            uniqueFailingCases,
            passRate,
            failureRate,
            qualityTrajectory,
            trajectoryDelta: trendSummary.trajectoryDelta || 0
        };

        // 6. Quality Signals
        const flakyTests = (flakyReport.allTests || []).filter(t => t.classification === 'potentially_flaky');
        const recurringSignatures = (trendReport.signatures || []).filter(s => s.classification === 'recurring' || s.classification === 'still_failing');
        const newFailures = trendReport.classifications?.newFailures || [];
        const resolvedFailures = trendReport.classifications?.resolvedFailures || [];

        // Calculate Rerun Fix Rate
        const totalReruns = allRunsWithCases.filter(r => r.isRerun || r.originalRunId).length;
        const rerunFixRate = resolvedFailures.length > 0
            ? Math.min(100, Number(((resolvedFailures.length / Math.max(1, resolvedFailures.length + uniqueFailingCases)) * 100).toFixed(1)))
            : 0;

        const qualitySignals = {
            flakyTestsCount: flakyTests.length,
            recurringSignaturesCount: recurringSignatures.length,
            newFailuresCount: newFailures.length,
            resolvedFailuresCount: resolvedFailures.length,
            rerunFixRate,
            totalRerunsCount: totalReruns,
            uncoveredRequirementsCount: coverageOverview.uncoveredRequirements,
            failingRequirementsCount: coverageOverview.failingRequirements
        };

        // 7. Prioritized "Needs Attention" Triage Queue
        // Ranking hierarchy:
        // 1. High/Critical Failing Test Cases (highest failure urgency)
        // 2. High-Frequency Recurring Error Patterns (systemic issues)
        // 3. New Regressions / First-time Failures (unexpected breakages)
        // 4. Potentially Flaky Tests with High Flakiness Score (CI noise)
        // 5. Uncovered Critical Requirements (compliance / coverage risk)
        const attentionQueue = [];

        // Add Recurring & Critical Failures
        (trendReport.signatures || []).slice(0, 5).forEach(sig => {
            if (sig.classification === 'recurring' || sig.classification === 'still_failing') {
                attentionQueue.push({
                    id: `att_sig_${sig.signatureId}`,
                    type: 'recurring_error',
                    badge: 'RECURRING',
                    severity: 'High',
                    title: `${sig.errorType}: ${sig.normalizedMessage}`,
                    description: `Error pattern has recurred ${sig.occurrencesCount} times across ${sig.affectedCasesCount} test case(s).`,
                    targetId: sig.signatureId,
                    lastOccurred: sig.lastSeen,
                    affectedCount: sig.affectedCasesCount,
                    actionLabel: 'Investigate Signature',
                    actionUrl: `/app/failure-trends?signatureId=${sig.signatureId}`
                });
            }
        });

        // Add New Failure Regressions
        newFailures.slice(0, 5).forEach(nf => {
            attentionQueue.push({
                id: `att_new_${nf.testCaseId}`,
                type: 'new_regression',
                badge: 'NEW REGRESSION',
                severity: 'High',
                title: `New Failure: ${nf.testCaseId} — ${nf.title}`,
                description: `First failure occurrence observed in "${nf.firstFailedInRunName || 'recent run'}".`,
                targetId: nf.testCaseId,
                lastOccurred: nf.firstFailedAt,
                actionLabel: 'View Run Report',
                actionUrl: `/app/runs/${nf.firstFailedInRunId}?tab=report`
            });
        });

        // Add Potentially Flaky Tests
        flakyTests.slice(0, 5).forEach(ft => {
            attentionQueue.push({
                id: `att_flaky_${ft.testCaseId}`,
                type: 'flaky_test',
                badge: 'FLAKY',
                severity: 'Medium',
                title: `Unstable Test: ${ft.testCaseId} — ${ft.title}`,
                description: `Outcome flipped ${ft.flipCount} times (Flakiness Score: ${ft.flakinessScore}/100) across recent executions.`,
                targetId: ft.testCaseId,
                lastOccurred: ft.timeline?.[ft.timeline.length - 1]?.executedAt,
                actionLabel: 'Inspect Test Case',
                actionUrl: `/app/test-cases?caseId=${ft.testCaseId}`
            });
        });

        // Add Uncovered Critical Requirements
        coverageOverview.uncoveredList.slice(0, 4).forEach(req => {
            attentionQueue.push({
                id: `att_req_${req.requirementId}`,
                type: req.status === 'failing' ? 'failing_requirement' : 'uncovered_requirement',
                badge: req.status === 'failing' ? 'SPEC FAILING' : 'COVERAGE GAP',
                severity: req.priority === 'High' ? 'High' : 'Medium',
                title: `${req.requirementId}: ${req.description?.slice(0, 75)}...`,
                description: req.reason,
                targetId: req.requirementId,
                suiteName: req.suiteName,
                actionLabel: 'View Traceability',
                actionUrl: `/app/traceability?reqId=${req.requirementId}`
            });
        });

        const dashboardPayload = {
            success: true,
            workspaceId,
            filters: {
                suiteId: suiteId || 'all',
                interval,
                startDate: startDate || null,
                endDate: endDate || null,
                browser,
                environment,
                executionMethod
            },
            healthSummary,
            activityChart: {
                interval,
                timeSeries: trendReport.timeSeries || [],
                trajectory: healthSummary.qualityTrajectory,
                trajectoryDelta: healthSummary.trajectoryDelta
            },
            qualitySignals,
            attentionQueue,
            recentRuns,
            coverageOverview: {
                totalRequirements: coverageOverview.totalRequirements,
                linkedRequirements: coverageOverview.linkedRequirements,
                verifiedRequirements: coverageOverview.verifiedRequirements,
                uncoveredRequirements: coverageOverview.uncoveredRequirements,
                failingRequirements: coverageOverview.failingRequirements,
                linkedCoveragePct: coverageOverview.linkedCoveragePct,
                verifiedCoveragePct: coverageOverview.verifiedCoveragePct
            }
        };

        this.cache.set(cacheKey, { data: dashboardPayload, timestamp: Date.now() });
        return dashboardPayload;
    }
}

module.exports = new ExecutionIntelligenceService();
