/**
 * TestNexa AI — Failure Trend Analysis & Error Fingerprinting Engine
 *
 * Production-ready QA analytics service analyzing historical completed executions.
 * Features:
 * - Aggregates completed executions (daily and weekly time-series)
 * - Identifies increasing or decreasing failure trajectory
 * - Stable error fingerprinting and signature clustering
 * - Robust failure classifications: New, Recurring, Resolved, Still Failing, Insufficient History
 * - Multi-tenant workspace isolation and in-memory TTL caching
 */

const crypto = require('crypto');
const supabaseService = require('../supabaseData.service');
const logger = require('../../utils/logger');

const COMPLETED_RUN_STATUSES = new Set(['completed', 'partially_completed', 'failed']);
const FAILURE_STATUSES = new Set(['failed', 'blocked', 'timed_out', 'infrastructure_error']);

class FailureTrendsService {
    constructor() {
        this.cache = new Map(); // key -> { data, timestamp }
        this.cacheTTL = 3 * 60 * 1000; // 3 minutes TTL
    }

    /**
     * Invalidate cached data for a workspace
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
     * Generate deterministic SHA-256 fingerprint hash
     */
    _generateSignatureHash(str) {
        return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
    }

    /**
     * Classify error type from error message and stack trace
     */
    _classifyErrorType(msg, stack, executorType) {
        const text = `${msg || ''} ${stack || ''}`.toLowerCase();

        if (/timeout|exceeded.*ms|waiting.*for.*timeout|navigation timeout/i.test(text)) {
            return 'TimeoutError';
        }
        if (/expect\(|expected.*to.*be|assertion.*failed|expected.*received|strict.*equal/i.test(text)) {
            return 'AssertionError';
        }
        if (/locator|waiting for selector|element not found|no such element|cannot find element/i.test(text)) {
            return 'ElementNotFoundError';
        }
        if (/net::err|econnrefused|enotfound|status 5\d\d|network.*error|fetch failed|failed to fetch/i.test(text)) {
            return 'NetworkError';
        }
        if (/typeerror|referenceerror|is not a function|cannot read properties of undefined|null is not an object/i.test(text)) {
            return 'TypeError';
        }
        if (executorType === 'manual' || !stack) {
            return 'StepFailure';
        }
        return 'RuntimeError';
    }

    /**
     * Normalize raw error message into a canonical fingerprint
     */
    _normalizeErrorMessage(rawMsg) {
        if (!rawMsg || typeof rawMsg !== 'string') return 'Unknown failure or assertion failure';

        return rawMsg
            // First line only
            .split('\n')[0]
            // Strip UUIDs
            .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
            // Strip Hex addresses
            .replace(/\b0x[a-f0-9]+\b/gi, '<HEX>')
            // Strip ISO Timestamps
            .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, '<TIMESTAMP>')
            // Strip specific durations (e.g. "waiting 30000ms", "5000ms")
            .replace(/\b\d+(?:\.\d+)?\s*(?:ms|seconds|sec|s|minutes|min)\b/gi, '<DURATION>')
            // Normalize URLs and Ports
            .replace(/https?:\/\/[^\s/$.?#].[^\s]*/gi, 'http://<HOST>')
            // Normalize line numbers like :42:15
            .replace(/:\d+:\d+/g, ':<LINE>:<COL>')
            // Normalize numbers
            .replace(/\b\d+\b/g, '<N>')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 180);
    }

    /**
     * Extract relevant application frame from stack trace
     */
    _extractRelevantStackFrame(stack) {
        if (!stack || typeof stack !== 'string') return null;
        const lines = stack.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('at ') &&
                !trimmed.includes('node:internal') &&
                !trimmed.includes('node_modules') &&
                !trimmed.includes('playwrightRunner')) {
                return trimmed;
            }
        }
        return lines.find(l => l.trim().startsWith('at '))?.trim() || null;
    }

    /**
     * Extract target browser and environment descriptors from run or execution
     */
    _resolveRunContext(run, exec = {}) {
        const targetEnv = run.targetEnvironment || {};
        const browser = (exec.browser || targetEnv.browser || 'Chromium').toString();
        const environment = (exec.environment || targetEnv.environment || targetEnv.name || run.environmentId || 'Default').toString();
        return {
            browser: browser.charAt(0).toUpperCase() + browser.slice(1).toLowerCase(),
            environment: environment.charAt(0).toUpperCase() + environment.slice(1).toLowerCase()
        };
    }

    /**
     * Filter and parse completed runs within date range and criteria
     */
    async _loadFilteredWorkspaceData(workspaceId, filters = {}) {
        const {
            suiteId = null,
            environment = null,
            browser = null,
            executionMethod = null,
            startDate = null,
            endDate = null
        } = filters;

        // Fetch completed and partially completed runs with their cases
        const allRunsWithCases = await supabaseService.getWorkspaceRunsWithCases(workspaceId, {
            suiteId,
            limit: 250
        });

        // Compute date boundaries
        const startTimestamp = startDate ? new Date(startDate).getTime() : Date.now() - (30 * 24 * 60 * 60 * 1000);
        const endTimestamp = endDate ? new Date(endDate).getTime() : Date.now() + (24 * 60 * 60 * 1000);

        // Filter valid completed runs only
        const completedRuns = allRunsWithCases.filter(r => {
            if (!COMPLETED_RUN_STATUSES.has((r.status || '').toLowerCase())) {
                return false;
            }

            const runTime = new Date(r.completedAt || r.startedAt || r.createdAt || 0).getTime();
            if (runTime < startTimestamp || runTime > endTimestamp) {
                return false;
            }

            if (executionMethod && executionMethod !== 'all') {
                if ((r.executionType || '').toLowerCase() !== executionMethod.toLowerCase()) {
                    return false;
                }
            }

            const ctx = this._resolveRunContext(r);
            if (browser && browser !== 'all') {
                if (ctx.browser.toLowerCase() !== browser.toLowerCase()) {
                    return false;
                }
            }

            if (environment && environment !== 'all') {
                if (ctx.environment.toLowerCase() !== environment.toLowerCase()) {
                    return false;
                }
            }

            return true;
        });

        // Chronological order: oldest to newest for timeline & resolution analysis
        completedRuns.sort((a, b) => {
            const tA = new Date(a.completedAt || a.startedAt || a.createdAt || 0).getTime();
            const tB = new Date(b.completedAt || b.startedAt || b.createdAt || 0).getTime();
            return tA - tB;
        });

        return completedRuns;
    }

    /**
     * Core Analysis Generator
     */
    async analyzeFailureTrends(workspaceId, filters = {}) {
        const cacheKey = `${workspaceId}:${JSON.stringify(filters)}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            return cached.data;
        }

        const interval = filters.interval === 'weekly' ? 'weekly' : 'daily';
        const completedRuns = await this._loadFilteredWorkspaceData(workspaceId, filters);

        // Track test case execution histories across entire loaded window
        // testCaseId -> Array<{ runId, runName, executedAt, status, durationMs, errorMessage, stackTrace, browser, environment, executorType }>
        const testCaseHistoryMap = new Map();

        // Fingerprint Signature Map
        // signatureHash -> { ...signatureData }
        const signatureMap = new Map();

        // Time-series buckets
        // bucketKey -> { date, timestamp, runsCount, totalExecutions, passCount, failureCount, blockedCount, skippedCount, uniqueFailingCases: Set }
        const timeSeriesBuckets = new Map();

        // Environment and Browser failure counters
        const browserStats = new Map();
        const envStats = new Map();

        let totalExecutions = 0;
        let totalFailureOccurrences = 0;
        const allUniqueFailingCases = new Set();
        const allUniquePassingCases = new Set();

        // 1. Process each completed run
        for (const run of completedRuns) {
            const runCompletedAt = run.completedAt || run.startedAt || run.createdAt;
            const runTime = new Date(runCompletedAt);
            const runContext = this._resolveRunContext(run);

            // Determine time-series bucket key
            let bucketKey;
            let bucketLabel;
            if (interval === 'weekly') {
                // Beginning of the week (Sunday/Monday)
                const d = new Date(runTime);
                const day = d.getUTCDay();
                const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                const weekStart = new Date(d.setUTCDate(diff));
                bucketKey = weekStart.toISOString().slice(0, 10);
                bucketLabel = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
            } else {
                bucketKey = runTime.toISOString().slice(0, 10);
                bucketLabel = runTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
            }

            if (!timeSeriesBuckets.has(bucketKey)) {
                timeSeriesBuckets.set(bucketKey, {
                    key: bucketKey,
                    label: bucketLabel,
                    date: bucketKey,
                    runsCount: 0,
                    totalExecutions: 0,
                    passCount: 0,
                    failureCount: 0,
                    blockedCount: 0,
                    skippedCount: 0,
                    uniqueFailingCases: new Set(),
                    errorTypes: {}
                });
            }
            const bucket = timeSeriesBuckets.get(bucketKey);
            bucket.runsCount++;

            // Load run executions if available for error messages
            const runExecutions = await supabaseService.getRunExecutions(run.id).catch(() => []);
            const execMapByCaseId = new Map();
            runExecutions.forEach(ex => {
                const tcId = ex.testCaseId || ex.test_case_id;
                if (tcId && (!execMapByCaseId.has(tcId) || (ex.attemptNumber || 1) >= (execMapByCaseId.get(tcId).attemptNumber || 1))) {
                    execMapByCaseId.set(tcId, ex);
                }
            });

            // Inspect cases for this run
            const cases = Array.isArray(run.cases) ? run.cases : [];
            for (const c of cases) {
                const testCaseId = String(c.testCaseId || c.caseSnapshot?.id || c.id);
                const title = c.caseSnapshot?.title || c.title || `Test Case ${testCaseId}`;
                const suiteName = c.caseSnapshot?.suiteName || run.name || 'Default Suite';
                const status = (c.status || 'not_run').toLowerCase();

                // Skip incomplete cases
                if (status === 'not_run' || status === 'in_progress' || status === 'pending') {
                    continue;
                }

                totalExecutions++;
                bucket.totalExecutions++;

                const matchedExec = execMapByCaseId.get(testCaseId) || {};
                const errorMessage = matchedExec.errorMessage || c.notes || c.actualResult || '';
                const stackTrace = matchedExec.stackTrace || '';
                const durationMs = matchedExec.durationMs || c.durationMs || 0;
                const executorType = c.executorType || run.executionType || 'manual';

                // Record historical trajectory entry for test case
                if (!testCaseHistoryMap.has(testCaseId)) {
                    testCaseHistoryMap.set(testCaseId, {
                        testCaseId,
                        title,
                        suiteId: run.suiteId,
                        suiteName,
                        executions: []
                    });
                }
                const tcRecord = testCaseHistoryMap.get(testCaseId);
                tcRecord.executions.push({
                    runId: run.id,
                    runName: run.name,
                    executedAt: runCompletedAt,
                    status,
                    durationMs,
                    errorMessage,
                    stackTrace,
                    browser: runContext.browser,
                    environment: runContext.environment,
                    executorType
                });

                // Status Categorization
                if (status === 'passed') {
                    bucket.passCount++;
                    allUniquePassingCases.add(testCaseId);
                } else if (FAILURE_STATUSES.has(status)) {
                    totalFailureOccurrences++;
                    bucket.failureCount++;
                    bucket.uniqueFailingCases.add(testCaseId);
                    allUniqueFailingCases.add(testCaseId);

                    // Track Environment & Browser
                    const bKey = runContext.browser;
                    browserStats.set(bKey, (browserStats.get(bKey) || 0) + 1);

                    const eKey = runContext.environment;
                    envStats.set(eKey, (envStats.get(eKey) || 0) + 1);

                    // Error Fingerprinting & Clustering
                    const errorType = this._classifyErrorType(errorMessage, stackTrace, executorType);
                    bucket.errorTypes[errorType] = (bucket.errorTypes[errorType] || 0) + 1;

                    const normalizedMsg = this._normalizeErrorMessage(errorMessage);
                    const stackFrame = this._extractRelevantStackFrame(stackTrace);
                    const signatureKey = `${errorType}::${normalizedMsg}`;
                    const signatureId = `sig_${this._generateSignatureHash(signatureKey)}`;

                    if (!signatureMap.has(signatureId)) {
                        signatureMap.set(signatureId, {
                            signatureId,
                            errorType,
                            normalizedMessage: normalizedMsg,
                            sampleRawMessage: errorMessage || 'No explicit error message provided',
                            sampleStackTrace: stackTrace || (stackFrame ? `at ${stackFrame}` : null),
                            firstSeen: runCompletedAt,
                            lastSeen: runCompletedAt,
                            occurrencesCount: 0,
                            affectedCasesMap: new Map(),
                            browsers: new Set(),
                            environments: new Set(),
                            executionMethods: { automated: 0, manual: 0 },
                            recentOccurrences: []
                        });
                    }

                    const sig = signatureMap.get(signatureId);
                    sig.occurrencesCount++;
                    sig.lastSeen = runCompletedAt;
                    sig.browsers.add(runContext.browser);
                    sig.environments.add(runContext.environment);
                    sig.executionMethods[executorType === 'automated' ? 'automated' : 'manual']++;

                    if (!sig.affectedCasesMap.has(testCaseId)) {
                        sig.affectedCasesMap.set(testCaseId, {
                            testCaseId,
                            title,
                            suiteId: run.suiteId,
                            suiteName,
                            failureCount: 0
                        });
                    }
                    sig.affectedCasesMap.get(testCaseId).failureCount++;

                    // Keep up to 20 recent occurrences
                    if (sig.recentOccurrences.length < 20) {
                        sig.recentOccurrences.push({
                            runId: run.id,
                            runName: run.name,
                            executedAt: runCompletedAt,
                            testCaseId,
                            title,
                            suiteName,
                            status,
                            durationMs,
                            errorMessage,
                            stackTrace,
                            browser: runContext.browser,
                            environment: runContext.environment,
                            executorType,
                            artifactUrl: `/api/v1/runs/${run.id}/cases/${c.id || testCaseId}/executions`
                        });
                    }
                } else if (status === 'blocked') {
                    bucket.blockedCount++;
                } else if (status === 'skipped') {
                    bucket.skippedCount++;
                }
            }
        }

        // 2. Classify Test Cases & Signatures
        // Categories: New Failure, Recurring Failure, Resolved Failure, Still Failing, Insufficient History
        const classifiedCases = {
            newFailures: [],
            recurringFailures: [],
            resolvedFailures: [],
            stillFailing: [],
            insufficientHistory: []
        };

        const resolvedTestCaseIds = new Set();
        const stillFailingTestCaseIds = new Set();

        testCaseHistoryMap.forEach((tc) => {
            const execs = tc.executions;
            const totalRuns = execs.length;
            const failures = execs.filter(e => FAILURE_STATUSES.has(e.status));

            // If never failed, skip failure classification
            if (failures.length === 0) return;

            // Track cases with limited history (< 2 completed executions)
            if (totalRuns < 2) {
                classifiedCases.insufficientHistory.push({
                    testCaseId: tc.testCaseId,
                    title: tc.title,
                    suiteName: tc.suiteName,
                    totalRuns,
                    failureCount: failures.length,
                    latestStatus: execs[execs.length - 1].status,
                    classification: 'insufficient_history',
                    classificationLabel: 'Insufficient History',
                    reason: 'Only 1 completed execution recorded. Additional runs required to establish long-term trend.'
                });
            }

            const latestExecution = execs[execs.length - 1];
            const latestStatus = latestExecution.status;

            // STRICT RESOLUTION RULE:
            // Must have failed previously, AND the most recent subsequent completed execution is PASSED.
            // A failure must NOT be considered resolved merely because it hasn't failed recently without a passing run.
            if (latestStatus === 'passed') {
                resolvedTestCaseIds.add(tc.testCaseId);
                const lastFailure = [...failures].reverse()[0];
                classifiedCases.resolvedFailures.push({
                    testCaseId: tc.testCaseId,
                    title: tc.title,
                    suiteName: tc.suiteName,
                    totalRuns,
                    failureCount: failures.length,
                    latestStatus: 'passed',
                    resolvedInRunId: latestExecution.runId,
                    resolvedInRunName: latestExecution.runName,
                    resolvedAt: latestExecution.executedAt,
                    lastFailedInRunId: lastFailure.runId,
                    lastFailedInRunName: lastFailure.runName,
                    lastFailedAt: lastFailure.executedAt,
                    classification: 'resolved',
                    classificationLabel: 'Resolved Failure',
                    reason: `Failed in "${lastFailure.runName}", but successfully PASSED in subsequent execution "${latestExecution.runName}".`
                });
            } else if (FAILURE_STATUSES.has(latestStatus)) {
                stillFailingTestCaseIds.add(tc.testCaseId);
                // Check if New or Recurring
                if (failures.length === 1) {
                    // First failure occurrence
                    classifiedCases.newFailures.push({
                        testCaseId: tc.testCaseId,
                        title: tc.title,
                        suiteName: tc.suiteName,
                        totalRuns,
                        failureCount: 1,
                        latestStatus,
                        firstFailedInRunId: latestExecution.runId,
                        firstFailedInRunName: latestExecution.runName,
                        firstFailedAt: latestExecution.executedAt,
                        classification: 'new_failure',
                        classificationLabel: 'New Failure',
                        reason: `First failure occurrence introduced in execution "${latestExecution.runName}".`
                    });
                } else {
                    // Recurring failure
                    classifiedCases.recurringFailures.push({
                        testCaseId: tc.testCaseId,
                        title: tc.title,
                        suiteName: tc.suiteName,
                        totalRuns,
                        failureCount: failures.length,
                        latestStatus,
                        lastFailedAt: latestExecution.executedAt,
                        classification: 'recurring',
                        classificationLabel: 'Recurring Failure',
                        reason: `Failure has recurred across ${failures.length} distinct executions.`
                    });
                }

                classifiedCases.stillFailing.push({
                    testCaseId: tc.testCaseId,
                    title: tc.title,
                    suiteName: tc.suiteName,
                    totalRuns,
                    failureCount: failures.length,
                    latestStatus,
                    latestRunId: latestExecution.runId,
                    latestRunName: latestExecution.runName,
                    latestRunAt: latestExecution.executedAt,
                    errorMessage: latestExecution.errorMessage,
                    classification: 'still_failing',
                    classificationLabel: 'Still Failing',
                    reason: `Test continues to fail in the latest execution "${latestExecution.runName}".`
                });
            }
        });

        // 3. Classify Signatures
        const formattedSignatures = Array.from(signatureMap.values()).map(sig => {
            const affectedCasesList = Array.from(sig.affectedCasesMap.values());
            const occurrences = sig.occurrencesCount;

            let classification = 'recurring';
            let classificationLabel = 'Recurring Failure';
            let classificationReason = `Error signature observed ${occurrences} times across test runs.`;

            // If only 1 occurrence, consider New Failure
            if (occurrences === 1) {
                classification = 'new_failure';
                classificationLabel = 'New Failure';
                classificationReason = 'New error signature first observed in recent execution.';
            } else {
                // If all affected test cases are now passing, signature is considered resolved
                const allAffectedAreResolved = affectedCasesList.length > 0 &&
                    affectedCasesList.every(ac => resolvedTestCaseIds.has(ac.testCaseId) && !stillFailingTestCaseIds.has(ac.testCaseId));

                if (allAffectedAreResolved) {
                    classification = 'resolved';
                    classificationLabel = 'Resolved Failure';
                    classificationReason = 'All affected test cases successfully passed in subsequent executions.';
                } else {
                    classification = 'still_failing';
                    classificationLabel = 'Still Failing';
                    classificationReason = `Error pattern actively failing across ${affectedCasesList.length} test case(s).`;
                }
            }

            return {
                signatureId: sig.signatureId,
                errorType: sig.errorType,
                normalizedMessage: sig.normalizedMessage,
                sampleRawMessage: sig.sampleRawMessage,
                sampleStackTrace: sig.sampleStackTrace,
                firstSeen: sig.firstSeen,
                lastSeen: sig.lastSeen,
                occurrencesCount: occurrences,
                affectedCasesCount: affectedCasesList.length,
                affectedCases: affectedCasesList,
                browsers: Array.from(sig.browsers),
                environments: Array.from(sig.environments),
                executionMethods: sig.executionMethods,
                classification,
                classificationLabel,
                classificationReason,
                recentOccurrences: sig.recentOccurrences
            };
        });

        // Sort signatures by occurrences count descending
        formattedSignatures.sort((a, b) => b.occurrencesCount - a.occurrencesCount);

        // 4. Format Time-Series Array
        const timeSeries = Array.from(timeSeriesBuckets.values()).map(b => {
            const fRate = b.totalExecutions > 0 ? Number(((b.failureCount / b.totalExecutions) * 100).toFixed(1)) : 0;
            return {
                key: b.key,
                label: b.label,
                date: b.date,
                runsCount: b.runsCount,
                totalExecutions: b.totalExecutions,
                passCount: b.passCount,
                failureCount: b.failureCount,
                blockedCount: b.blockedCount,
                skippedCount: b.skippedCount,
                failureRate: fRate,
                uniqueFailingCasesCount: b.uniqueFailingCases.size
            };
        });

        // Sort chronologically
        timeSeries.sort((a, b) => a.key.localeCompare(b.key));

        // 5. Compute Trajectory (Increasing, Decreasing, Stable)
        let trajectory = 'stable';
        let trajectoryDelta = 0;
        if (timeSeries.length >= 2) {
            const half = Math.floor(timeSeries.length / 2);
            const firstHalf = timeSeries.slice(0, half);
            const secondHalf = timeSeries.slice(half);

            const avgFirst = firstHalf.reduce((acc, t) => acc + t.failureRate, 0) / (firstHalf.length || 1);
            const avgSecond = secondHalf.reduce((acc, t) => acc + t.failureRate, 0) / (secondHalf.length || 1);

            trajectoryDelta = Number((avgSecond - avgFirst).toFixed(1));
            if (trajectoryDelta > 2.0) {
                trajectory = 'increasing';
            } else if (trajectoryDelta < -2.0) {
                trajectory = 'decreasing';
            } else {
                trajectory = 'stable';
            }
        }

        // 6. Summary metrics
        const overallFailureRate = totalExecutions > 0
            ? Number(((totalFailureOccurrences / totalExecutions) * 100).toFixed(1))
            : 0;

        const summary = {
            totalExecutions,
            totalFailures: totalFailureOccurrences,
            uniqueFailingCases: allUniqueFailingCases.size,
            overallFailureRate,
            trajectory,
            trajectoryDelta,
            newSignaturesCount: formattedSignatures.filter(s => s.classification === 'new_failure').length,
            recurringSignaturesCount: formattedSignatures.filter(s => s.classification === 'recurring' || s.classification === 'still_failing').length,
            resolvedFailuresCount: classifiedCases.resolvedFailures.length,
            stillFailingCount: classifiedCases.stillFailing.length,
            insufficientHistoryCount: classifiedCases.insufficientHistory.length,
            totalSignaturesCount: formattedSignatures.length,
            topBrowsers: Array.from(browserStats.entries()).map(([browser, count]) => ({ browser, count })),
            topEnvironments: Array.from(envStats.entries()).map(([environment, count]) => ({ environment, count })),
            runsAnalyzed: completedRuns.length
        };

        const result = {
            success: true,
            filters: {
                workspaceId,
                suiteId: filters.suiteId || null,
                interval,
                startDate: filters.startDate || null,
                endDate: filters.endDate || null,
                browser: filters.browser || 'all',
                environment: filters.environment || 'all',
                executionMethod: filters.executionMethod || 'all'
            },
            summary,
            timeSeries,
            signatures: formattedSignatures,
            classifications: classifiedCases
        };

        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    }

    /**
     * Get single signature details with occurrences and artifact references
     */
    async getSignatureDetails(workspaceId, signatureId, filters = {}) {
        const fullReport = await this.analyzeFailureTrends(workspaceId, filters);
        const signature = fullReport.signatures.find(s => s.signatureId === signatureId);

        if (!signature) {
            return {
                success: false,
                message: `Failure signature "${signatureId}" not found in current analysis window.`
            };
        }

        return {
            success: true,
            data: signature
        };
    }
}

module.exports = new FailureTrendsService();
