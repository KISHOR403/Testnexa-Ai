/**
 * TestNexa AI — Phase 2: Flaky Test Detection Engine
 *
 * Grounded statistical analysis across rolling completed execution history.
 * Detects intermittent failures, outcome flip-flops, repeated timeouts,
 * duration anomalies, browser-specific and environment-specific patterns.
 */

const supabaseService = require('../supabaseData.service');
const logger = require('../../utils/logger');

const DEFAULT_DETECTION_POLICY = {
    version: '1.0.0',
    minExecutions: 10,           // Minimum completed executions required in rolling window
    windowSize: 30,              // Rolling analysis window of latest N completed executions
    flakyFailureRateMin: 10,     // 10% minimum failure rate for flaky threshold
    flakyFailureRateMax: 80,     // 80% maximum failure rate (above 80% is consistently failing)
    flipRateThreshold: 0.15,     // Outcome flip-flop rate >= 15%
    flipCountThreshold: 2,       // State switched between Pass and Fail at least twice
    timeoutThresholdCount: 2     // At least 2 timeouts mixed with passes
};

class FlakyDetectionService {
    constructor() {
        this.cache = new Map(); // workspaceId -> { data, timestamp }
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
    }

    /**
     * Compute statistical standard deviation of an array of numbers
     */
    _calcStdDev(values, mean) {
        if (!values || values.length <= 1) return 0;
        const sumSquareDiffs = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
        return Math.round(Math.sqrt(sumSquareDiffs / (values.length - 1)));
    }

    /**
     * Normalize error message into a canonical cluster key
     */
    _normalizeErrorMessage(msg) {
        if (!msg || typeof msg !== 'string') return '';
        return msg
            .split('\n')[0]
            .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
            .replace(/\b0x[a-f0-9]+\b/gi, '<HEX>')
            .replace(/\d+/g, '<N>')
            .trim()
            .slice(0, 150);
    }

    /**
     * Compute statistical metrics and classification for a single test case
     * across its rolling execution history
     */
    computeTestCaseMetrics(testCaseId, rawHistory, customPolicy = {}) {
        const policy = { ...DEFAULT_DETECTION_POLICY, ...customPolicy };

        // Exclude incomplete (not_run, in_progress, pending) and cancelled runs from denominator
        const validExecutions = rawHistory.filter(e => {
            const status = (e.status || '').toLowerCase();
            return ['passed', 'failed', 'blocked', 'skipped', 'timed_out'].includes(status);
        });

        // Chronological order: oldest to newest for timeline and transition analysis
        validExecutions.sort((a, b) => {
            const tA = new Date(a.executedAt || a.createdAt || 0).getTime();
            const tB = new Date(b.executedAt || b.createdAt || 0).getTime();
            return tA - tB;
        });

        // Sliced by rolling window size (latest N executions)
        const windowExecutions = validExecutions.slice(-policy.windowSize);
        const executionsAnalyzed = windowExecutions.length;

        // Metric tallies
        let passCount = 0;
        let failureCount = 0;
        let blockedCount = 0;
        let skippedCount = 0;
        let timeoutCount = 0;

        const durations = [];
        const browserMap = new Map();
        const envMap = new Map();
        const methodMap = { automated: { total: 0, passed: 0, failed: 0 }, manual: { total: 0, passed: 0, failed: 0 } };
        const errorClusters = new Map();

        // Single pass over executions in window
        windowExecutions.forEach(e => {
            const rawStatus = (e.status || '').toLowerCase();
            const isTimeout = rawStatus === 'timed_out' || /timeout|exceeded.*ms/i.test(e.errorMessage || e.notes || '');

            if (isTimeout) {
                timeoutCount++;
            }

            if (rawStatus === 'passed') {
                passCount++;
            } else if (rawStatus === 'failed' || rawStatus === 'timed_out') {
                failureCount++;
            } else if (rawStatus === 'blocked') {
                blockedCount++;
            } else if (rawStatus === 'skipped') {
                skippedCount++;
            }

            // Durations
            const dur = Number(e.durationMs) || 0;
            if (dur > 0) durations.push(dur);

            // Browser breakdown
            const browser = (e.browser || 'chromium').toLowerCase();
            if (!browserMap.has(browser)) {
                browserMap.set(browser, { browser, total: 0, passed: 0, failed: 0, failureRate: 0 });
            }
            const bStats = browserMap.get(browser);
            bStats.total++;
            if (rawStatus === 'passed') bStats.passed++;
            if (rawStatus === 'failed' || rawStatus === 'timed_out') bStats.failed++;

            // Environment breakdown
            const env = e.environmentName || e.environment || 'Default';
            if (!envMap.has(env)) {
                envMap.set(env, { environment: env, total: 0, passed: 0, failed: 0, failureRate: 0 });
            }
            const eStats = envMap.get(env);
            eStats.total++;
            if (rawStatus === 'passed') eStats.passed++;
            if (rawStatus === 'failed' || rawStatus === 'timed_out') eStats.failed++;

            // Execution Method breakdown
            const method = e.executionType === 'automated' ? 'automated' : 'manual';
            methodMap[method].total++;
            if (rawStatus === 'passed') methodMap[method].passed++;
            if (rawStatus === 'failed' || rawStatus === 'timed_out') methodMap[method].failed++;

            // Error Message Clustering
            const errMsg = e.errorMessage || e.actualResult;
            if ((rawStatus === 'failed' || rawStatus === 'timed_out') && errMsg) {
                const normKey = this._normalizeErrorMessage(errMsg);
                if (normKey) {
                    if (!errorClusters.has(normKey)) {
                        errorClusters.set(normKey, {
                            errorSignature: normKey,
                            rawSample: errMsg.slice(0, 300),
                            count: 0,
                            firstSeen: e.executedAt || e.createdAt,
                            lastSeen: e.executedAt || e.createdAt,
                            isTimeout
                        });
                    }
                    const cl = errorClusters.get(normKey);
                    cl.count++;
                    cl.lastSeen = e.executedAt || e.createdAt;
                }
            }
        });

        // Rates
        const failureRate = executionsAnalyzed > 0
            ? Number(((failureCount / executionsAnalyzed) * 100).toFixed(1))
            : 0;
        const passRate = executionsAnalyzed > 0
            ? Number(((passCount / executionsAnalyzed) * 100).toFixed(1))
            : 0;

        // Finalize browser and env failure rates
        browserMap.forEach(b => {
            b.failureRate = b.total > 0 ? Number(((b.failed / b.total) * 100).toFixed(1)) : 0;
        });
        envMap.forEach(env => {
            env.failureRate = env.total > 0 ? Number(((env.failed / env.total) * 100).toFixed(1)) : 0;
        });

        // Flip-Flop volatility count (consecutive state transitions between Pass <-> Fail)
        let flipCount = 0;
        let lastOutcome = null;

        windowExecutions.forEach(e => {
            const st = (e.status || '').toLowerCase();
            const normalized = st === 'passed' ? 'pass' : (st === 'failed' || st === 'timed_out') ? 'fail' : null;
            if (normalized) {
                if (lastOutcome !== null && lastOutcome !== normalized) {
                    flipCount++;
                }
                lastOutcome = normalized;
            }
        });

        const outcomePairCount = Math.max(0, (passCount + failureCount) - 1);
        const flipRate = outcomePairCount > 0 ? Number((flipCount / outcomePairCount).toFixed(2)) : 0;

        // Duration variance
        const avgDurationMs = durations.length > 0
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : 0;
        const minDurationMs = durations.length > 0 ? Math.min(...durations) : 0;
        const maxDurationMs = durations.length > 0 ? Math.max(...durations) : 0;
        const stdDevDurationMs = this._calcStdDev(durations, avgDurationMs);

        // Flakiness Score (0 to 100 statistical entropy calculation)
        let flakinessScore = 0;
        if (passCount > 0 && failureCount > 0) {
            // Outcome variance entropy factor: peaks at 50 for 50/50 balance
            const entropyFactor = 4 * (passCount / executionsAnalyzed) * (failureCount / executionsAnalyzed) * 50;
            // Alternating volatility factor: up to 35 pts
            const volatilityFactor = Math.min(1, flipRate * 2) * 35;
            // Timeout irregularity penalty: up to 15 pts
            const timeoutFactor = Math.min(1, timeoutCount / 2) * 15;
            flakinessScore = Math.min(100, Math.round(entropyFactor + volatilityFactor + timeoutFactor));
        }

        // Classification Assignment & Grounded Reasoning
        let classification = 'insufficient_history';
        let reason = '';

        if (executionsAnalyzed < policy.minExecutions) {
            classification = 'insufficient_history';
            reason = `Only ${executionsAnalyzed} completed execution(s) in analysis window (minimum required: ${policy.minExecutions}).`;
        } else if (failureCount === 0) {
            classification = 'consistently_passing';
            reason = `Passed consistently across all ${executionsAnalyzed} evaluated runs in rolling window (100% pass rate).`;
        } else if (failureRate >= policy.flakyFailureRateMax || passCount === 0) {
            classification = 'consistently_failing';
            reason = `Sustained high failure rate of ${failureRate}% across ${executionsAnalyzed} runs (${failureCount} failures / ${passCount} passes). Persistent failure.`;
        } else if (
            passCount > 0 && failureCount > 0 &&
            (flipCount >= policy.flipCountThreshold ||
             flipRate >= policy.flipRateThreshold ||
             timeoutCount >= policy.timeoutThresholdCount ||
             (failureRate >= policy.flakyFailureRateMin && failureRate < policy.flakyFailureRateMax))
        ) {
            classification = 'potentially_flaky';
            if (timeoutCount >= policy.timeoutThresholdCount) {
                reason = `Intermittent timeout pattern: ${timeoutCount} execution(s) timed out while ${passCount} passed cleanly.`;
            } else if (flipCount >= policy.flipCountThreshold) {
                reason = `Intermittent outcome flip-flop: State switched between pass and fail ${flipCount} times across ${executionsAnalyzed} runs (failure rate: ${failureRate}%).`;
            } else {
                reason = `Intermittent outcome variance: Failure rate of ${failureRate}% (${failureCount} fails / ${passCount} passes) under identical criteria.`;
            }
        } else if (blockedCount / executionsAnalyzed >= 0.5) {
            classification = 'requires_investigation';
            reason = `Frequent execution blocking: ${blockedCount} of ${executionsAnalyzed} runs were blocked by prerequisite or dependency barriers.`;
        } else {
            classification = 'requires_investigation';
            reason = `Unusual outcome distribution (${passCount} pass, ${failureCount} fail, ${blockedCount} blocked) warrants diagnostic review.`;
        }

        // Sequence string representation (e.g. "P P F P F P P")
        const outcomeSequence = windowExecutions.map(e => {
            const st = (e.status || '').toLowerCase();
            if (st === 'passed') return 'P';
            if (st === 'failed' || st === 'timed_out') return 'F';
            if (st === 'blocked') return 'B';
            if (st === 'skipped') return 'S';
            return '?';
        }).join(' ');

        // Latest execution entry
        const latestEntry = windowExecutions.length > 0 ? windowExecutions[windowExecutions.length - 1] : null;

        return {
            testCaseId,
            title: rawHistory[0]?.title || rawHistory[0]?.caseSnapshot?.title || testCaseId,
            suiteId: rawHistory[0]?.suiteId || rawHistory[0]?.suite_id || null,
            suiteName: rawHistory[0]?.suiteName || rawHistory[0]?.suiteTitle || 'Test Suite',
            category: rawHistory[0]?.category || rawHistory[0]?.caseSnapshot?.category || rawHistory[0]?.caseSnapshot?.type || 'Functional',
            priority: rawHistory[0]?.priority || rawHistory[0]?.caseSnapshot?.priority || 'Medium',
            executionType: rawHistory[0]?.executionType || 'automated',
            classification,
            reason,
            flakinessScore,
            failureRate,
            passRate,
            executionsAnalyzed,
            totalHistoricalExecutions: validExecutions.length,
            passCount,
            failureCount,
            blockedCount,
            skippedCount,
            timeoutCount,
            flipCount,
            flipRate,
            outcomeSequence,
            lastExecution: latestEntry ? {
                runId: latestEntry.runId,
                runName: latestEntry.runName,
                status: latestEntry.status,
                executedAt: latestEntry.executedAt || latestEntry.createdAt,
                durationMs: latestEntry.durationMs
            } : null,
            durationMetrics: {
                avgDurationMs,
                minDurationMs,
                maxDurationMs,
                stdDevDurationMs
            },
            browserBreakdown: Array.from(browserMap.values()),
            environmentBreakdown: Array.from(envMap.values()),
            methodBreakdown: [],
            errorPatterns: Array.from(errorClusters.values()).sort((a, b) => b.count - a.count),
            policyUsed: {
                version: policy.version,
                minExecutions: policy.minExecutions,
                windowSize: policy.windowSize
            },
            classifiedAt: new Date().toISOString()
        };
    }

    /**
     * Analyze workspace historical executions and compute flaky test intelligence
     */
    async analyzeWorkspaceFlakyTests(workspaceId, options = {}) {
        if (!workspaceId) {
            throw new Error('workspaceId is required for flaky test detection');
        }

        const {
            suiteId = null,
            environmentId = null,
            minExecutions = DEFAULT_DETECTION_POLICY.minExecutions,
            windowSize = DEFAULT_DETECTION_POLICY.windowSize,
            classification = 'all',
            search = '',
            page = 1,
            limit = 20,
            forceRefresh = false
        } = options;

        const cacheKey = `${workspaceId}:${suiteId || 'all'}:${environmentId || 'all'}:${minExecutions}:${windowSize}`;

        // Return from cache if fresh
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                return this._applyFiltersAndPagination(cached.data, { classification, search, page, limit });
            }
        }

        // Fetch all completed/evaluated runs and their cases for this workspace
        const runsWithCases = await supabaseService.getWorkspaceRunsWithCases(workspaceId, {
            suiteId,
            environmentId,
            limit: 150
        });

        // Group run cases by stable testCaseId
        const testCaseMap = new Map();

        runsWithCases.forEach(run => {
            const runCases = run.cases || [];
            const envName = run.targetEnvironment?.name || 'Default';
            const envId = run.environmentId || run.environment_id;
            const suiteName = run.suiteName || run.suiteTitle || run.name;
            const suiteId = run.suiteId || run.suite_id;

            runCases.forEach(rc => {
                const tcId = String(rc.testCaseId || rc.caseSnapshot?.id || rc.id);
                if (!tcId) return;

                if (!testCaseMap.has(tcId)) {
                    testCaseMap.set(tcId, []);
                }

                // Determine browser
                const browser = rc.caseSnapshot?.automationMapping?.browser ||
                                rc.caseSnapshot?.playwrightBinding?.browser ||
                                run.targetEnvironment?.browser ||
                                'chromium';

                testCaseMap.get(tcId).push({
                    runCaseId: rc.id,
                    runId: run.id,
                    runName: run.name,
                    suiteId,
                    suiteName,
                    environmentId: envId,
                    environmentName: envName,
                    browser,
                    status: rc.status,
                    actualResult: rc.actualResult,
                    notes: rc.notes,
                    errorMessage: rc.notes || rc.actualResult || '',
                    durationMs: rc.durationMs || 0,
                    executionType: rc.executionType || run.executionType || 'automated',
                    executedAt: rc.executedAt || run.completedAt || run.createdAt,
                    createdAt: rc.createdAt || run.createdAt,
                    caseSnapshot: rc.caseSnapshot || {},
                    title: rc.caseSnapshot?.title || rc.title || tcId,
                    category: rc.caseSnapshot?.category || rc.caseSnapshot?.type || 'Functional',
                    priority: rc.caseSnapshot?.priority || 'Medium'
                });
            });
        });

        const policy = {
            ...DEFAULT_DETECTION_POLICY,
            minExecutions: Number(minExecutions) || DEFAULT_DETECTION_POLICY.minExecutions,
            windowSize: Number(windowSize) || DEFAULT_DETECTION_POLICY.windowSize
        };

        // Compute metrics for every test case
        const analyzedTests = [];
        let potentiallyFlakyCount = 0;
        let consistentlyFailingCount = 0;
        let consistentlyPassingCount = 0;
        let insufficientHistoryCount = 0;
        let requiresInvestigationCount = 0;
        let totalScoreSum = 0;

        testCaseMap.forEach((history, tcId) => {
            const analysis = this.computeTestCaseMetrics(tcId, history, policy);
            analyzedTests.push(analysis);

            if (analysis.classification === 'potentially_flaky') potentiallyFlakyCount++;
            else if (analysis.classification === 'consistently_failing') consistentlyFailingCount++;
            else if (analysis.classification === 'consistently_passing') consistentlyPassingCount++;
            else if (analysis.classification === 'insufficient_history') insufficientHistoryCount++;
            else if (analysis.classification === 'requires_investigation') requiresInvestigationCount++;

            totalScoreSum += analysis.flakinessScore;
        });

        // Sort by flakiness score descending by default
        analyzedTests.sort((a, b) => {
            if (b.classification === 'potentially_flaky' && a.classification !== 'potentially_flaky') return 1;
            if (a.classification === 'potentially_flaky' && b.classification !== 'potentially_flaky') return -1;
            return b.flakinessScore - a.flakinessScore;
        });

        const averageFlakinessScore = analyzedTests.length > 0
            ? Number((totalScoreSum / analyzedTests.length).toFixed(1))
            : 0;

        const fullAnalysisResult = {
            summary: {
                totalTests: analyzedTests.length,
                potentiallyFlakyCount,
                consistentlyFailingCount,
                consistentlyPassingCount,
                insufficientHistoryCount,
                requiresInvestigationCount,
                averageFlakinessScore,
                detectionPolicy: policy,
                analyzedAt: new Date().toISOString()
            },
            allTests: analyzedTests
        };

        // Save in cache
        this.cache.set(cacheKey, {
            data: fullAnalysisResult,
            timestamp: Date.now()
        });

        return this._applyFiltersAndPagination(fullAnalysisResult, { classification, search, page, limit });
    }

    /**
     * Filter & paginate analyzed test results
     */
    _applyFiltersAndPagination(fullResult, { classification = 'all', search = '', page = 1, limit = 20 }) {
        let filtered = fullResult.allTests;

        // Classification filter
        if (classification && classification !== 'all') {
            const normCls = classification.toLowerCase().trim();
            filtered = filtered.filter(t => t.classification === normCls);
        }

        // Search filter (by testCaseId, title, or suiteName)
        if (search && search.trim()) {
            const q = search.toLowerCase().trim();
            filtered = filtered.filter(t =>
                (t.testCaseId && t.testCaseId.toLowerCase().includes(q)) ||
                (t.title && t.title.toLowerCase().includes(q)) ||
                (t.suiteName && t.suiteName.toLowerCase().includes(q))
            );
        }

        const total = filtered.length;
        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.max(1, Number(limit) || 20);
        const totalPages = Math.max(1, Math.ceil(total / limitNum));
        const offset = (pageNum - 1) * limitNum;
        const paginatedTests = filtered.slice(offset, offset + limitNum);

        return {
            summary: fullResult.summary,
            tests: paginatedTests,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages
            }
        };
    }

    /**
     * Get detailed flaky diagnostics and historical execution timeline for a single test case
     */
    async getTestCaseFlakyDetail(workspaceId, testCaseId, options = {}) {
        if (!workspaceId || !testCaseId) {
            throw new Error('workspaceId and testCaseId are required');
        }

        const {
            minExecutions = DEFAULT_DETECTION_POLICY.minExecutions,
            windowSize = DEFAULT_DETECTION_POLICY.windowSize
        } = options;

        // Fetch completed runs for workspace
        const runsWithCases = await supabaseService.getWorkspaceRunsWithCases(workspaceId, { limit: 150 });

        const history = [];
        const runCaseIds = [];

        runsWithCases.forEach(run => {
            const runCases = run.cases || [];
            const envName = run.targetEnvironment?.name || 'Default';
            const envId = run.environmentId || run.environment_id;
            const suiteName = run.suiteName || run.suiteTitle || run.name;
            const suiteId = run.suiteId || run.suite_id;

            runCases.forEach(rc => {
                const tcId = String(rc.testCaseId || rc.caseSnapshot?.id || rc.id);
                if (tcId.toLowerCase() === testCaseId.toLowerCase()) {
                    runCaseIds.push({ runId: run.id, runCaseId: rc.id });

                    const browser = rc.caseSnapshot?.automationMapping?.browser ||
                                    rc.caseSnapshot?.playwrightBinding?.browser ||
                                    run.targetEnvironment?.browser ||
                                    'chromium';

                    history.push({
                        runCaseId: rc.id,
                        runId: run.id,
                        runName: run.name,
                        suiteId,
                        suiteName,
                        environmentId: envId,
                        environmentName: envName,
                        browser,
                        status: rc.status,
                        actualResult: rc.actualResult,
                        notes: rc.notes,
                        errorMessage: rc.notes || rc.actualResult || '',
                        stackTrace: '',
                        artifacts: [],
                        durationMs: rc.durationMs || 0,
                        executionType: rc.executionType || run.executionType || 'automated',
                        executedAt: rc.executedAt || run.completedAt || run.createdAt,
                        createdAt: rc.createdAt || run.createdAt,
                        caseSnapshot: rc.caseSnapshot || {},
                        title: rc.caseSnapshot?.title || rc.title || tcId,
                        category: rc.caseSnapshot?.category || rc.caseSnapshot?.type || 'Functional',
                        priority: rc.caseSnapshot?.priority || 'Medium'
                    });
                }
            });
        });

        // Enrich executions with latest error messages, stack traces and artifacts
        for (const item of history) {
            try {
                const [execs, artifacts] = await Promise.all([
                    supabaseService.getCaseExecutions(item.runCaseId).catch(() => []),
                    supabaseService.getRunArtifacts(item.runId, item.runCaseId).catch(() => [])
                ]);

                if (execs.length > 0) {
                    const latest = execs[execs.length - 1];
                    if (latest.errorMessage) item.errorMessage = latest.errorMessage;
                    if (latest.stackTrace) item.stackTrace = latest.stackTrace;
                    if (latest.actualResult) item.actualResult = latest.actualResult;
                }

                item.artifacts = (artifacts || []).map(a => ({
                    id: a.id,
                    name: a.name,
                    artifactType: a.artifactType,
                    mimeType: a.mimeType
                }));
            } catch (err) {}
        }

        const policy = {
            ...DEFAULT_DETECTION_POLICY,
            minExecutions: Number(minExecutions) || DEFAULT_DETECTION_POLICY.minExecutions,
            windowSize: Number(windowSize) || DEFAULT_DETECTION_POLICY.windowSize
        };

        const metrics = this.computeTestCaseMetrics(testCaseId, history, policy);

        // Sort timeline chronologically descending for display (most recent first)
        const timeline = [...history].sort((a, b) => {
            return new Date(b.executedAt || b.createdAt || 0) - new Date(a.executedAt || a.createdAt || 0);
        });

        return {
            ...metrics,
            timeline
        };
    }

    /**
     * Clear workspace analysis cache
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
}

module.exports = new FlakyDetectionService();

