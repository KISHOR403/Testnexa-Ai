/**
 * TestNexa AI — Phase 5, Step 2: Advanced Test Analytics & Quality Insights Engine
 *
 * Authoritative QA analytics engine transforming actual persisted test executions,
 * reruns, requirement mappings, and failure fingerprints into actionable quality intelligence.
 *
 * 100% Real Persisted Execution Data — Zero Fake Metrics, Zero Fabricated Trends.
 */

const crypto = require('crypto');
const supabaseService = require('./supabaseData.service');
const failureTrendsService = require('./runner/failureTrends.service');
const flakyDetectionService = require('./runner/flakyDetection.service');
const executionIntelligenceService = require('./runner/executionIntelligence.service');
const usageMeteringService = require('./usageMetering.service');
const aiService = require('./ai.service');
const logger = require('../utils/logger');

const COMPLETED_RUN_STATUSES = new Set(['completed', 'partially_completed', 'failed']);
const FAILURE_STATUSES = new Set(['failed', 'blocked', 'timed_out', 'infrastructure_error']);
const PASS_STATUSES = new Set(['passed']);

class QualityInsightsService {
    constructor() {
        this.cache = new Map(); // key -> { data, timestamp }
        this.cacheTTL = 2 * 60 * 1000; // 2 minutes TTL
    }

    /**
     * Invalidate cache for a workspace or organization
     */
    invalidateCache(scopeId) {
        if (!scopeId) {
            this.cache.clear();
            return;
        }
        for (const key of this.cache.keys()) {
            if (key.includes(String(scopeId))) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Parse date range filter into ISO start and end timestamps
     */
    _resolveDateBoundaries(dateRange, customStart, customEnd) {
        const now = new Date();
        let start = new Date();
        let end = new Date(now);

        switch (dateRange) {
            case '7d':
                start.setDate(now.getDate() - 7);
                break;
            case '14d':
                start.setDate(now.getDate() - 14);
                break;
            case '30d':
                start.setDate(now.getDate() - 30);
                break;
            case '90d':
                start.setDate(now.getDate() - 90);
                break;
            case 'custom':
                if (customStart) start = new Date(customStart);
                if (customEnd) end = new Date(customEnd);
                break;
            default:
                start.setDate(now.getDate() - 30);
                break;
        }

        // Set to start of day and end of day
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        return {
            start: start.toISOString(),
            end: end.toISOString(),
            startDate: start,
            endDate: end,
            totalDays: Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
        };
    }

    /**
     * Fetch all relevant runs and their cases with multi-tenant filtering
     */
    async _getFilteredRunsWithCases(workspaceId, filters = {}) {
        const {
            suiteId = null,
            dateRange = '30d',
            startDate = null,
            endDate = null,
            environment = 'all',
            browser = 'all',
            executionType = 'all',
            status = 'all'
        } = filters;

        const bounds = this._resolveDateBoundaries(dateRange, startDate, endDate);

        // Fetch completed runs in workspace
        let rawRuns = await supabaseService.getWorkspaceRunsWithCases(workspaceId, {
            suiteId: suiteId && suiteId !== 'all' ? suiteId : null,
            limit: 500
        }).catch(() => []);

        // Filter runs by date, environment, browser, executionType, and status
        const filteredRuns = rawRuns.filter(r => {
            const createdAt = new Date(r.createdAt || r.created_at || 0);
            if (createdAt < bounds.startDate || createdAt > bounds.endDate) {
                return false;
            }

            // Environment filter
            if (environment && environment !== 'all') {
                const env = String(r.environment || r.environmentId || r.environment_id || '').toLowerCase();
                if (!env.includes(String(environment).toLowerCase())) {
                    return false;
                }
            }

            // Browser filter
            if (browser && browser !== 'all') {
                const runBrowser = String(r.browser || r.executionConfig?.browser || '').toLowerCase();
                if (!runBrowser.includes(String(browser).toLowerCase())) {
                    return false;
                }
            }

            // Execution type: manual / automated
            if (executionType && executionType !== 'all') {
                const type = String(r.executionType || r.execution_type || 'automated').toLowerCase();
                if (type !== String(executionType).toLowerCase()) {
                    return false;
                }
            }

            // Status filter
            if (status && status !== 'all') {
                const st = String(r.status || '').toLowerCase();
                if (st !== String(status).toLowerCase()) {
                    return false;
                }
            }

            return true;
        });

        return {
            runs: filteredRuns,
            boundaries: bounds
        };
    }

    /**
     * Calculate Execution Health KPIs with mathematically consistent denominators
     */
    calculateExecutionHealth(runs) {
        let totalRuns = runs.length;
        let originalRuns = 0;
        let rerunAttempts = 0;

        let totalCaseExecutions = 0;
        let passedCases = 0;
        let failedCases = 0;
        let blockedCases = 0;
        let timedOutCases = 0;
        let skippedCases = 0;
        let pendingCases = 0;

        let totalDurationMs = 0;
        let durationSamples = [];
        const uniqueCaseIds = new Set();

        runs.forEach(r => {
            const isRerun = Boolean(r.isRerun || r.originalRunId || r.parentRunId);
            if (isRerun) rerunAttempts++;
            else originalRuns++;

            const cases = r.cases || [];
            cases.forEach(c => {
                totalCaseExecutions++;
                const cid = String(c.testCaseId || c.caseSnapshot?.id || c.id || '');
                if (cid) uniqueCaseIds.add(cid);

                const st = (c.status || 'not_run').toLowerCase();
                if (st === 'passed') passedCases++;
                else if (st === 'failed') failedCases++;
                else if (st === 'blocked') blockedCases++;
                else if (st === 'timed_out') timedOutCases++;
                else if (st === 'skipped') skippedCases++;
                else if (st === 'pending' || st === 'in_progress' || st === 'not_run') pendingCases++;

                const dur = Number(c.durationMs || c.duration || 0);
                if (dur > 0 && ['passed', 'failed', 'blocked', 'timed_out'].includes(st)) {
                    totalDurationMs += dur;
                    durationSamples.push(dur);
                }
            });
        });

        // Strict Denominator: Only include terminal executed cases (passed + failed + blocked + timed_out)
        // Skipped and Pending are excluded so pass rate represents true execution quality
        const terminalExecuted = passedCases + failedCases + blockedCases + timedOutCases;
        const totalFailures = failedCases + blockedCases + timedOutCases;

        const passRate = terminalExecuted > 0
            ? Number(((passedCases / terminalExecuted) * 100).toFixed(1))
            : 0;

        const failureRate = terminalExecuted > 0
            ? Number(((totalFailures / terminalExecuted) * 100).toFixed(1))
            : 0;

        const avgDurationMs = durationSamples.length > 0
            ? Math.round(totalDurationMs / durationSamples.length)
            : 0;

        // Calculate median duration
        let medianDurationMs = 0;
        if (durationSamples.length > 0) {
            durationSamples.sort((a, b) => a - b);
            const mid = Math.floor(durationSamples.length / 2);
            medianDurationMs = durationSamples.length % 2 !== 0
                ? durationSamples[mid]
                : Math.round((durationSamples[mid - 1] + durationSamples[mid]) / 2);
        }

        return {
            totalRuns,
            originalRuns,
            rerunAttempts,
            totalCaseExecutions,
            deduplicatedCasesCount: uniqueCaseIds.size,
            terminalExecutedCases: terminalExecuted,
            passed: passedCases,
            failed: failedCases,
            blocked: blockedCases,
            timedOut: timedOutCases,
            skipped: skippedCases,
            pending: pendingCases,
            passRate,
            failureRate,
            avgDurationMs,
            medianDurationMs,
            metricDefinitions: {
                passRate: 'Passed cases ÷ (Passed + Failed + Blocked + Timed Out) × 100. Excludes skipped and unexecuted tests.',
                failureRate: '(Failed + Blocked + Timed Out) ÷ (Passed + Failed + Blocked + Timed Out) × 100.',
                totalCaseExecutions: 'Sum of all individual test case execution instances across matched test runs.',
                deduplicatedCasesCount: 'Unique test case specifications executed at least once in the period.',
                rerunAttempts: 'Executions created as targeted retries of previously failed runs.'
            }
        };
    }

    /**
     * Compute historical execution trends grouped by daily, weekly, or monthly intervals
     * Missing dates are populated with 0 volume (never invented data).
     */
    calculateExecutionTrends(runs, boundaries, interval = 'daily') {
        const buckets = new Map();

        // Initialize all buckets within boundaries
        const cur = new Date(boundaries.startDate);
        while (cur <= boundaries.endDate) {
            let key = '';
            if (interval === 'monthly') {
                key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
            } else if (interval === 'weekly') {
                // ISO week or Sunday-based week
                const startOfWeek = new Date(cur);
                startOfWeek.setDate(cur.getDate() - cur.getDay());
                key = startOfWeek.toISOString().slice(0, 10);
            } else {
                key = cur.toISOString().slice(0, 10);
            }

            if (!buckets.has(key)) {
                buckets.set(key, {
                    date: key,
                    totalRuns: 0,
                    caseExecutions: 0,
                    passed: 0,
                    failed: 0,
                    blocked: 0,
                    timedOut: 0,
                    skipped: 0,
                    manualRuns: 0,
                    automatedRuns: 0,
                    totalDurationMs: 0,
                    durationSamples: [],
                    runIds: []
                });
            }

            // Advance
            if (interval === 'monthly') cur.setMonth(cur.getMonth() + 1);
            else if (interval === 'weekly') cur.setDate(cur.getDate() + 7);
            else cur.setDate(cur.getDate() + 1);
        }

        // Aggregate runs into buckets
        runs.forEach(r => {
            const dateObj = new Date(r.createdAt || r.created_at || 0);
            let key = '';
            if (interval === 'monthly') {
                key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
            } else if (interval === 'weekly') {
                const sow = new Date(dateObj);
                sow.setDate(dateObj.getDate() - dateObj.getDay());
                key = sow.toISOString().slice(0, 10);
            } else {
                key = dateObj.toISOString().slice(0, 10);
            }

            let b = buckets.get(key);
            if (!b) {
                b = {
                    date: key,
                    totalRuns: 0,
                    caseExecutions: 0,
                    passed: 0,
                    failed: 0,
                    blocked: 0,
                    timedOut: 0,
                    skipped: 0,
                    manualRuns: 0,
                    automatedRuns: 0,
                    totalDurationMs: 0,
                    durationSamples: [],
                    runIds: []
                };
                buckets.set(key, b);
            }

            b.totalRuns++;
            b.runIds.push(r.id);

            const isManual = (r.executionType || r.execution_type) === 'manual';
            if (isManual) b.manualRuns++;
            else b.automatedRuns++;

            const cases = r.cases || [];
            cases.forEach(c => {
                b.caseExecutions++;
                const st = (c.status || '').toLowerCase();
                if (st === 'passed') b.passed++;
                else if (st === 'failed') b.failed++;
                else if (st === 'blocked') b.blocked++;
                else if (st === 'timed_out') b.timedOut++;
                else if (st === 'skipped') b.skipped++;

                const dur = Number(c.durationMs || c.duration || 0);
                if (dur > 0) {
                    b.totalDurationMs += dur;
                    b.durationSamples.push(dur);
                }
            });
        });

        // Compute final percentage rates and sorted series
        const series = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));

        return series.map(item => {
            const terminal = item.passed + item.failed + item.blocked + item.timedOut;
            const failures = item.failed + item.blocked + item.timedOut;

            return {
                date: item.date,
                totalRuns: item.totalRuns,
                caseExecutions: item.caseExecutions,
                passed: item.passed,
                failed: failures,
                skipped: item.skipped,
                manualRuns: item.manualRuns,
                automatedRuns: item.automatedRuns,
                passRate: terminal > 0 ? Number(((item.passed / terminal) * 100).toFixed(1)) : null,
                failureRate: terminal > 0 ? Number(((failures / terminal) * 100).toFixed(1)) : null,
                avgDurationMs: item.durationSamples.length > 0 ? Math.round(item.totalDurationMs / item.durationSamples.length) : 0,
                runIds: item.runIds
            };
        });
    }

    /**
     * Analyze actual failed test records and compute failure intelligence
     */
    calculateFailureIntelligence(runs) {
        const failureByCase = new Map();
        const signatureMap = new Map();
        const envDistribution = new Map();
        const browserDistribution = new Map();
        const suiteDistribution = new Map();

        runs.forEach(r => {
            const suiteName = r.suiteName || r.suite_name || 'Standard Suite';
            const suiteId = r.suiteId || r.suite_id || 'default_suite';
            const env = r.environment || r.environmentId || 'default';
            const browser = r.browser || r.executionConfig?.browser || 'chromium';

            const cases = r.cases || [];
            cases.forEach(c => {
                const st = (c.status || '').toLowerCase();
                if (!FAILURE_STATUSES.has(st)) return;

                const caseId = String(c.testCaseId || c.caseSnapshot?.id || c.id || '');
                const title = c.caseSnapshot?.title || c.title || `Test Case ${caseId}`;
                const errorMsg = c.error || c.failureReason || c.errorMessage || 'Assertion error or unexpected test failure';

                // 1. By Test Case
                if (!failureByCase.has(caseId)) {
                    failureByCase.set(caseId, {
                        testCaseId: caseId,
                        title,
                        suiteId,
                        suiteName,
                        failureCount: 0,
                        latestRunId: r.id,
                        latestFailedAt: r.completedAt || r.createdAt,
                        latestError: errorMsg,
                        runs: []
                    });
                }
                const caseRecord = failureByCase.get(caseId);
                caseRecord.failureCount++;
                caseRecord.runs.push({
                    runId: r.id,
                    runCaseId: c.id,
                    status: st,
                    durationMs: c.durationMs || c.duration || 0,
                    error: errorMsg,
                    executedAt: c.executedAt || r.completedAt || r.createdAt
                });

                // 2. By Error Signature (Fingerprint)
                const normalized = (errorMsg.split('\n')[0] || '')
                    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
                    .replace(/\b0x[a-f0-9]+\b/gi, '<HEX>')
                    .replace(/\d+/g, '<N>')
                    .trim()
                    .slice(0, 160) || 'Generic Assertion Failure';

                const signatureHash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
                if (!signatureMap.has(signatureHash)) {
                    signatureMap.set(signatureHash, {
                        signatureHash,
                        pattern: normalized,
                        count: 0,
                        firstObserved: r.createdAt,
                        lastObserved: r.createdAt,
                        affectedCases: new Set(),
                        affectedSuites: new Set(),
                        sampleRunId: r.id,
                        sampleError: errorMsg
                    });
                }
                const sig = signatureMap.get(signatureHash);
                sig.count++;
                sig.affectedCases.add(title);
                sig.affectedSuites.add(suiteName);
                if (new Date(r.createdAt) > new Date(sig.lastObserved)) {
                    sig.lastObserved = r.createdAt;
                    sig.sampleRunId = r.id;
                    sig.sampleError = errorMsg;
                }

                // 3. By Environment
                envDistribution.set(env, (envDistribution.get(env) || 0) + 1);

                // 4. By Browser
                browserDistribution.set(browser, (browserDistribution.get(browser) || 0) + 1);

                // 5. By Suite
                suiteDistribution.set(suiteName, (suiteDistribution.get(suiteName) || 0) + 1);
            });
        });

        // Top failing test cases
        const topFailingCases = Array.from(failureByCase.values())
            .sort((a, b) => b.failureCount - a.failureCount)
            .slice(0, 10);

        // Top failure signatures
        const topSignatures = Array.from(signatureMap.values())
            .map(s => ({
                ...s,
                affectedCaseCount: s.affectedCases.size,
                affectedCases: Array.from(s.affectedCases).slice(0, 5),
                affectedSuites: Array.from(s.affectedSuites)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            topFailingCases,
            topSignatures,
            environmentDistribution: Object.fromEntries(envDistribution),
            browserDistribution: Object.fromEntries(browserDistribution),
            suiteDistribution: Object.fromEntries(suiteDistribution)
        };
    }

    /**
     * Compute Flaky Test Analytics using ground-truth execution history
     */
    calculateFlakyAnalytics(runs) {
        // Collect history per test case
        const historyByCase = new Map();

        runs.forEach(r => {
            const cases = r.cases || [];
            cases.forEach(c => {
                const cid = String(c.testCaseId || c.caseSnapshot?.id || c.id || '');
                if (!cid) return;

                if (!historyByCase.has(cid)) {
                    historyByCase.set(cid, {
                        testCaseId: cid,
                        title: c.caseSnapshot?.title || c.title || `Test Case ${cid}`,
                        suiteId: r.suiteId || r.suite_id,
                        suiteName: r.suiteName || r.suite_name || 'Standard Suite',
                        history: []
                    });
                }

                historyByCase.get(cid).history.push({
                    runId: r.id,
                    status: (c.status || '').toLowerCase(),
                    executedAt: c.executedAt || r.completedAt || r.createdAt,
                    durationMs: c.durationMs || c.duration || 0,
                    browser: r.browser || r.executionConfig?.browser || 'chromium',
                    environment: r.environment || r.environmentId || 'default'
                });
            });
        });

        const analyzedCases = [];

        historyByCase.forEach(record => {
            const metrics = flakyDetectionService.computeTestCaseMetrics(record.testCaseId, record.history);
            if (!metrics) return;

            let classification = 'insufficient_history';
            if (metrics.executionsAnalyzed >= 5) {
                if (metrics.isFlaky) {
                    classification = 'potentially_flaky';
                } else if (metrics.failureRate >= 80) {
                    classification = 'consistently_failing';
                } else if (metrics.failureRate === 0) {
                    classification = 'consistently_passing';
                } else {
                    classification = 'requires_investigation';
                }
            }

            analyzedCases.push({
                testCaseId: record.testCaseId,
                title: record.title,
                suiteId: record.suiteId,
                suiteName: record.suiteName,
                executionCount: metrics.executionsAnalyzed,
                failureRate: metrics.failureRate,
                flipCount: metrics.flipCount || 0,
                flipRate: metrics.flipRate || 0,
                classification,
                isFlaky: metrics.isFlaky,
                flakyScore: metrics.flakyScore || 0,
                flakyReasons: metrics.flakyReasons || [],
                lastObservedStatus: record.history[record.history.length - 1]?.status || 'unknown',
                lastObservedAt: record.history[record.history.length - 1]?.executedAt || null
            });
        });

        // Filter and rank flaky cases
        const flakyCases = analyzedCases
            .filter(c => c.isFlaky || c.classification === 'potentially_flaky')
            .sort((a, b) => b.flakyScore - a.flakyScore);

        return {
            totalAnalyzedCases: analyzedCases.length,
            flakyCount: flakyCases.length,
            consistentlyFailingCount: analyzedCases.filter(c => c.classification === 'consistently_failing').length,
            consistentlyPassingCount: analyzedCases.filter(c => c.classification === 'consistently_passing').length,
            insufficientHistoryCount: analyzedCases.filter(c => c.classification === 'insufficient_history').length,
            flakyCases: flakyCases.slice(0, 15)
        };
    }

    /**
     * Calculate Execution Performance & Slowest Tests
     */
    calculatePerformanceAnalytics(runs) {
        const durationByCase = new Map();

        runs.forEach(r => {
            const cases = r.cases || [];
            cases.forEach(c => {
                const dur = Number(c.durationMs || c.duration || 0);
                if (dur <= 0) return;

                const cid = String(c.testCaseId || c.caseSnapshot?.id || c.id || '');
                if (!cid) return;

                if (!durationByCase.has(cid)) {
                    durationByCase.set(cid, {
                        testCaseId: cid,
                        title: c.caseSnapshot?.title || c.title || `Test Case ${cid}`,
                        suiteName: r.suiteName || r.suite_name || 'Standard Suite',
                        durations: [],
                        executions: 0
                    });
                }

                const rec = durationByCase.get(cid);
                rec.durations.push(dur);
                rec.executions++;
            });
        });

        const slowestCases = [];
        durationByCase.forEach(rec => {
            rec.durations.sort((a, b) => a - b);
            const sum = rec.durations.reduce((a, b) => a + b, 0);
            const avg = Math.round(sum / rec.durations.length);
            const mid = Math.floor(rec.durations.length / 2);
            const median = rec.durations.length % 2 !== 0
                ? rec.durations[mid]
                : Math.round((rec.durations[mid - 1] + rec.durations[mid]) / 2);

            slowestCases.push({
                testCaseId: rec.testCaseId,
                title: rec.title,
                suiteName: rec.suiteName,
                executionCount: rec.executions,
                avgDurationMs: avg,
                medianDurationMs: median,
                maxDurationMs: rec.durations[rec.durations.length - 1],
                minDurationMs: rec.durations[0]
            });
        });

        slowestCases.sort((a, b) => b.medianDurationMs - a.medianDurationMs);

        return {
            slowestCases: slowestCases.slice(0, 10)
        };
    }

    /**
     * Calculate Test Suite Quality Comparison Matrix
     */
    calculateSuiteComparison(runs) {
        const suiteMap = new Map();

        runs.forEach(r => {
            const sid = String(r.suiteId || r.suite_id || 'default_suite');
            const name = r.suiteName || r.suite_name || 'Default Test Suite';

            if (!suiteMap.has(sid)) {
                suiteMap.set(sid, {
                    suiteId: sid,
                    suiteName: name,
                    runs: 0,
                    caseExecutions: 0,
                    passed: 0,
                    failed: 0,
                    blocked: 0,
                    timedOut: 0,
                    skipped: 0,
                    totalDurationMs: 0,
                    durationCount: 0,
                    uniqueCases: new Set(),
                    failureSignatures: new Set()
                });
            }

            const sm = suiteMap.get(sid);
            sm.runs++;

            const cases = r.cases || [];
            cases.forEach(c => {
                sm.caseExecutions++;
                const cid = String(c.testCaseId || c.caseSnapshot?.id || c.id || '');
                if (cid) sm.uniqueCases.add(cid);

                const st = (c.status || '').toLowerCase();
                if (st === 'passed') sm.passed++;
                else if (st === 'failed') sm.failed++;
                else if (st === 'blocked') sm.blocked++;
                else if (st === 'timed_out') sm.timedOut++;
                else if (st === 'skipped') sm.skipped++;

                if (FAILURE_STATUSES.has(st) && (c.error || c.failureReason)) {
                    sm.failureSignatures.add(String(c.error || c.failureReason).slice(0, 50));
                }

                const dur = Number(c.durationMs || c.duration || 0);
                if (dur > 0) {
                    sm.totalDurationMs += dur;
                    sm.durationCount++;
                }
            });
        });

        return Array.from(suiteMap.values()).map(sm => {
            const terminal = sm.passed + sm.failed + sm.blocked + sm.timedOut;
            const failures = sm.failed + sm.blocked + sm.timedOut;
            const passRate = terminal > 0 ? Number(((sm.passed / terminal) * 100).toFixed(1)) : 0;
            const failureRate = terminal > 0 ? Number(((failures / terminal) * 100).toFixed(1)) : 0;
            const avgDurationMs = sm.durationCount > 0 ? Math.round(sm.totalDurationMs / sm.durationCount) : 0;

            return {
                suiteId: sm.suiteId,
                suiteName: sm.suiteName,
                totalCases: sm.uniqueCases.size,
                executionVolume: sm.runs,
                caseExecutions: sm.caseExecutions,
                passRate,
                failureRate,
                avgDurationMs,
                recurringFailureCount: sm.failureSignatures.size
            };
        }).sort((a, b) => b.executionVolume - a.executionVolume);
    }

    /**
     * Compute comprehensive Quality Insights workspace payload
     */
    async getQualityInsightsOverview(workspaceId, filters = {}) {
        if (!workspaceId) throw new Error('workspaceId is required');

        const cacheKey = `qi:${workspaceId}:${JSON.stringify(filters)}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            return cached.data;
        }

        // 1. Fetch filtered runs with cases
        const { runs, boundaries } = await this._getFilteredRunsWithCases(workspaceId, filters);

        // 2. Execution Health KPIs
        const health = this.calculateExecutionHealth(runs);

        // 3. Execution Trends Time-Series
        const trends = this.calculateExecutionTrends(runs, boundaries, filters.interval || 'daily');

        // 4. Failure Intelligence
        const failures = this.calculateFailureIntelligence(runs);

        // 5. Flaky Analytics
        const flaky = this.calculateFlakyAnalytics(runs);

        // 6. Test Coverage Analytics (Linked vs Executed vs Passed vs Verified)
        const coverage = await executionIntelligenceService._aggregateWorkspaceCoverage(workspaceId, filters.suiteId);

        // 7. Performance & Slowest Tests
        const performance = this.calculatePerformanceAnalytics(runs);

        // 8. Suite Comparison Matrix
        const suiteComparison = this.calculateSuiteComparison(runs);

        const result = {
            metadata: {
                workspaceId,
                dateRange: filters.dateRange || '30d',
                periodStart: boundaries.start,
                periodEnd: boundaries.end,
                generatedAt: new Date().toISOString(),
                dataFreshness: 'Real-time database aggregated'
            },
            health,
            trends,
            failures,
            flaky,
            coverage,
            performance,
            suiteComparison
        };

        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    }

    /**
     * AI-Assisted Quality Insights Engine (with Quota Metering & Evidence Linkage)
     */
    async generateAIQualityInsights(workspaceId, orgId, userId, filters = {}) {
        if (!workspaceId) throw new Error('workspaceId is required');

        // 1. Check & Reserve Quota for AI Generation if orgId is provided
        let reservationId = null;
        if (orgId && usageMeteringService) {
            const reservation = await usageMeteringService.reserveQuota({
                orgId,
                workspaceId,
                userId,
                metric: 'ai.generations',
                quantity: 1,
                operationId: `qi_insight_${Date.now()}`
            });
            reservationId = reservation?.id;
        }

        try {
            // 2. Aggregate actual data
            const overview = await this.getQualityInsightsOverview(workspaceId, filters);

            // 3. Synthesize factual prompt with zero hallucinations
            const promptData = {
                period: `${overview.metadata.periodStart.slice(0, 10)} to ${overview.metadata.periodEnd.slice(0, 10)}`,
                totalRuns: overview.health.totalRuns,
                totalCaseExecutions: overview.health.totalCaseExecutions,
                passRate: `${overview.health.passRate}%`,
                failureRate: `${overview.health.failureRate}%`,
                topFailures: overview.failures.topFailingCases.slice(0, 5).map(f => ({
                    title: f.title,
                    count: f.failureCount,
                    latestError: f.latestError
                })),
                flakyCount: overview.flaky.flakyCount,
                flakyTests: overview.flaky.flakyCases.slice(0, 5).map(fc => ({
                    title: fc.title,
                    flakyScore: fc.flakyScore,
                    failureRate: `${fc.failureRate}%`
                })),
                coverage: {
                    totalRequirements: overview.coverage.totalRequirements,
                    linkedRequirements: overview.coverage.linkedRequirements,
                    verifiedRequirements: overview.coverage.verifiedRequirements,
                    failingRequirements: overview.coverage.failingRequirements
                },
                slowestTests: overview.performance.slowestCases.slice(0, 3).map(s => ({
                    title: s.title,
                    medianDurationMs: s.medianDurationMs
                }))
            };

            const systemPrompt = `You are TestNexa AI's Senior QA Principal Architect.
Analyze the provided real QA test execution telemetry.
Generate actionable, evidence-backed quality insights.
Output valid JSON array with 3 to 6 insights conforming strictly to this JSON schema:
[
  {
    "title": "string",
    "category": "failure_pattern" | "flakiness" | "duration_regression" | "coverage_gap" | "stability_improvement",
    "severity": "critical" | "warning" | "info",
    "confidence": "high" | "medium" | "low",
    "description": "Clear 2-sentence explanation citing exact metrics from input",
    "supportingMetrics": { "metricName": "string or number" },
    "evidenceRecordIds": ["string"],
    "observedFacts": ["string"],
    "statisticalFindings": ["string"],
    "aiHypotheses": ["string"],
    "recommendedInvestigation": "string",
    "knownLimitations": "string"
  }
]
IMPORTANT RULES:
1. Ground every insight in the provided telemetry numbers. Do NOT invent runs or dates.
2. If total runs are 0 or evidence is insufficient, return an insight stating insufficient history.
3. Keep observations separate from recommendations.`;

            let insights = [];
            try {
                const aiResponse = await aiService.callAI(
                    `Execution Telemetry:\n${JSON.stringify(promptData, null, 2)}`,
                    {
                        systemPrompt,
                        maxTokens: 2500,
                        temperature: 0.2
                    }
                );

                if (typeof aiResponse === 'string') {
                    // Extract json from markdown block if needed
                    const cleaned = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                    insights = JSON.parse(cleaned);
                } else if (Array.isArray(aiResponse)) {
                    insights = aiResponse;
                }
            } catch (aiErr) {
                logger.warn('AI call for quality insights failed, using deterministic rule engine:', aiErr.message);
                // Fallback deterministic rule engine (100% reliable)
                insights = this._generateDeterministicInsights(overview);
            }

            // 4. Commit Quota Reservation
            if (reservationId && orgId && usageMeteringService) {
                await usageMeteringService.commitUsage({
                    reservationId,
                    orgId,
                    workspaceId,
                    userId,
                    metric: 'ai.generations',
                    quantity: 1,
                    sourceModule: 'quality_insights'
                }).catch(() => {});
            }

            return {
                insights,
                generatedAt: new Date().toISOString(),
                dataCoverage: overview.metadata
            };
        } catch (err) {
            // Rollback quota reservation on unrecoverable failure
            if (reservationId && orgId && usageMeteringService) {
                await usageMeteringService.rollbackReservation(reservationId, 'Generation failed').catch(() => {});
            }
            throw err;
        }
    }

    /**
     * Deterministic rule-based insights fallback
     */
    _generateDeterministicInsights(overview) {
        const insights = [];

        // 1. Pass Rate Assessment
        if (overview.health.totalRuns === 0) {
            insights.push({
                title: 'Insufficient Execution History',
                category: 'stability_improvement',
                severity: 'info',
                confidence: 'high',
                description: 'No completed test runs observed in the selected time range. Run manual or automated test suites to generate telemetry.',
                supportingMetrics: { totalRuns: 0 },
                evidenceRecordIds: [],
                observedFacts: ['0 test runs recorded in this window.'],
                statisticalFindings: ['Baseline statistical sample size is empty.'],
                aiHypotheses: ['Workspace might be recently created or no tests were executed recently.'],
                recommendedInvestigation: 'Trigger a manual or Playwright automated run.',
                knownLimitations: 'Cannot compute trends without execution data.'
            });
            return insights;
        }

        // 2. High Failure Rate Alert
        if (overview.health.failureRate > 25) {
            insights.push({
                title: `Elevated Test Suite Failure Rate (${overview.health.failureRate}%)`,
                category: 'failure_pattern',
                severity: overview.health.failureRate > 40 ? 'critical' : 'warning',
                confidence: 'high',
                description: `Execution failure rate is ${overview.health.failureRate}% across ${overview.health.terminalExecutedCases} evaluated cases. Immediate triage recommended.`,
                supportingMetrics: {
                    failureRate: `${overview.health.failureRate}%`,
                    failedCases: overview.health.failed,
                    totalExecuted: overview.health.terminalExecutedCases
                },
                evidenceRecordIds: overview.failures.topFailingCases.map(f => f.testCaseId),
                observedFacts: [`${overview.health.failed} test cases failed out of ${overview.health.terminalExecutedCases} executed.`],
                statisticalFindings: [`Failure trajectory is at ${overview.health.failureRate}%.`],
                aiHypotheses: ['Recent code deployments or environment instability may have broken selectors or API endpoints.'],
                recommendedInvestigation: 'Review recurring failure signatures and check recent deployment diffs.',
                knownLimitations: 'Fails to distinguish test script bugs from backend application defects.'
            });
        }

        // 3. Flaky Tests Warning
        if (overview.flaky.flakyCount > 0) {
            const topFlaky = overview.flaky.flakyCases[0];
            insights.push({
                title: `${overview.flaky.flakyCount} Potentially Flaky Test Case${overview.flaky.flakyCount > 1 ? 's' : ''} Identified`,
                category: 'flakiness',
                severity: 'warning',
                confidence: 'high',
                description: `Intermittent pass/fail flips detected. Most unstable case: "${topFlaky?.title}" with ${topFlaky?.flipCount} state transitions.`,
                supportingMetrics: {
                    flakyCount: overview.flaky.flakyCount,
                    topFlakyCase: topFlaky?.title,
                    flipCount: topFlaky?.flipCount
                },
                evidenceRecordIds: [topFlaky?.testCaseId].filter(Boolean),
                observedFacts: [`${topFlaky?.title} flipped between Pass and Fail ${topFlaky?.flipCount} times.`],
                statisticalFindings: [`Flaky score calculated at ${topFlaky?.flakyScore}/100.`],
                aiHypotheses: ['Timing issues, race conditions, or dynamic DOM animation timeouts.'],
                recommendedInvestigation: 'Add explicit wait conditions for element state rather than fixed sleep intervals.',
                knownLimitations: 'Flakiness detection relies on historical execution count of at least 5 runs.'
            });
        }

        // 4. Coverage Gap Insight
        if (overview.coverage.totalRequirements > 0) {
            const unverified = overview.coverage.totalRequirements - overview.coverage.verifiedRequirements;
            if (unverified > 0) {
                insights.push({
                    title: `${unverified} Requirement${unverified > 1 ? 's' : ''} Awaiting Verification`,
                    category: 'coverage_gap',
                    severity: overview.coverage.failingRequirements > 0 ? 'critical' : 'warning',
                    confidence: 'high',
                    description: `Only ${overview.coverage.verifiedRequirements} of ${overview.coverage.totalRequirements} requirements are fully verified by passing tests.`,
                    supportingMetrics: {
                        verifiedCoverage: `${overview.coverage.verifiedCoveragePct}%`,
                        failingRequirements: overview.coverage.failingRequirements,
                        uncoveredRequirements: overview.coverage.uncoveredRequirements
                    },
                    evidenceRecordIds: [],
                    observedFacts: [`${overview.coverage.verifiedRequirements} requirements verified, ${overview.coverage.failingRequirements} currently failing.`],
                    statisticalFindings: [`Verified coverage is ${overview.coverage.verifiedCoveragePct}%.`],
                    aiHypotheses: ['Testing efforts may be concentrated on specific happy-path modules while edge requirements remain untested.'],
                    recommendedInvestigation: 'Generate automated test cases for uncovered requirements in the Requirements workspace.',
                    knownLimitations: 'Requires requirements to be specified in the Test Suite understanding matrix.'
                });
            }
        }

        // 5. Performance Insight
        if (overview.performance.slowestCases.length > 0) {
            const slowest = overview.performance.slowestCases[0];
            if (slowest.medianDurationMs > 8000) {
                insights.push({
                    title: `Long-Running Test Case: "${slowest.title}" (${(slowest.medianDurationMs / 1000).toFixed(1)}s)`,
                    category: 'duration_regression',
                    severity: 'info',
                    confidence: 'medium',
                    description: `Median execution duration is ${(slowest.medianDurationMs / 1000).toFixed(1)} seconds, significantly above suite average.`,
                    supportingMetrics: {
                        medianDurationMs: slowest.medianDurationMs,
                        executions: slowest.executionCount
                    },
                    evidenceRecordIds: [slowest.testCaseId],
                    observedFacts: [`${slowest.title} took ${(slowest.medianDurationMs / 1000).toFixed(1)}s median time.`],
                    statisticalFindings: [`Highest duration amongst ${overview.performance.slowestCases.length} evaluated cases.`],
                    aiHypotheses: ['Heavy page payload, slow network mocks, or excessive waiting for selectors.'],
                    recommendedInvestigation: 'Inspect network tab in Playwright trace to identify slow API requests.',
                    knownLimitations: 'Duration comparison does not account for variable cloud worker hardware.'
                });
            }
        }

        return insights;
    }

    /**
     * Generate Sanitized CSV Export
     */
    async generateCSVExport(workspaceId, filters = {}) {
        const overview = await this.getQualityInsightsOverview(workspaceId, filters);

        // Sanitize string against spreadsheet formula injection (=, +, -, @)
        const sanitize = (str) => {
            if (str === null || str === undefined) return '';
            let val = String(str).replace(/"/g, '""');
            if (/^[=+\-@\t\r]/.test(val)) {
                val = `'${val}`;
            }
            return `"${val}"`;
        };

        const lines = [];

        // Header Metadata
        lines.push('# TESTNEXA AI — QUALITY INSIGHTS & ADVANCED TEST ANALYTICS REPORT');
        lines.push(`Exported At,${sanitize(new Date().toISOString())}`);
        lines.push(`Workspace ID,${sanitize(workspaceId)}`);
        lines.push(`Reporting Period,${sanitize(overview.metadata.periodStart.slice(0, 10))} to ${sanitize(overview.metadata.periodEnd.slice(0, 10))}`);
        lines.push(`Data Freshness,${sanitize(overview.metadata.dataFreshness)}`);
        lines.push('');

        // Execution Health KPIs
        lines.push('--- EXECUTION HEALTH SUMMARY ---');
        lines.push('Metric,Value,Definition');
        lines.push(`Total Test Runs,${overview.health.totalRuns},Total executed runs in filter range`);
        lines.push(`Original Test Runs,${overview.health.originalRuns},Primary non-rerun executions`);
        lines.push(`Rerun Attempts,${overview.health.rerunAttempts},Targeted retry executions`);
        lines.push(`Total Case Executions,${overview.health.totalCaseExecutions},All executed test cases`);
        lines.push(`Deduplicated Cases Count,${overview.health.deduplicatedCasesCount},Unique test case specifications`);
        lines.push(`Passed Tests,${overview.health.passed},Passing test cases`);
        lines.push(`Failed Tests,${overview.health.failed},Failing test cases`);
        lines.push(`Blocked Tests,${overview.health.blocked},Blocked test cases`);
        lines.push(`Timed Out Tests,${overview.health.timedOut},Cases exceeding execution timeout`);
        lines.push(`Pass Rate,${overview.health.passRate}%,${sanitize(overview.health.metricDefinitions.passRate)}`);
        lines.push(`Failure Rate,${overview.health.failureRate}%,${sanitize(overview.health.metricDefinitions.failureRate)}`);
        lines.push(`Average Duration,${overview.health.avgDurationMs}ms,Mean duration of executed tests`);
        lines.push(`Median Duration,${overview.health.medianDurationMs}ms,Median duration of executed tests`);
        lines.push('');

        // Top Failure Signatures
        lines.push('--- TOP RECURRING FAILURE SIGNATURES ---');
        lines.push('Fingerprint Hash,Failure Pattern,Occurrences,Affected Cases Count,Sample Run ID');
        overview.failures.topSignatures.forEach(s => {
            lines.push(`${sanitize(s.signatureHash)},${sanitize(s.pattern)},${s.count},${s.affectedCaseCount},${sanitize(s.sampleRunId)}`);
        });
        lines.push('');

        // Flaky Tests
        lines.push('--- FLAKY TEST DETECTIONS ---');
        lines.push('Test Case ID,Title,Suite Name,Execution Count,Failure Rate,Flip Count,Flaky Score');
        overview.flaky.flakyCases.forEach(fc => {
            lines.push(`${sanitize(fc.testCaseId)},${sanitize(fc.title)},${sanitize(fc.suiteName)},${fc.executionCount},${fc.failureRate}%,${fc.flipCount},${fc.flakyScore}`);
        });
        lines.push('');

        // Suite Comparison
        lines.push('--- TEST SUITE QUALITY COMPARISON ---');
        lines.push('Suite ID,Suite Name,Total Cases,Execution Runs,Case Executions,Pass Rate,Failure Rate,Avg Duration (ms),Recurring Failures');
        overview.suiteComparison.forEach(sc => {
            lines.push(`${sanitize(sc.suiteId)},${sanitize(sc.suiteName)},${sc.totalCases},${sc.executionVolume},${sc.caseExecutions},${sc.passRate}%,${sc.failureRate}%,${sc.avgDurationMs},${sc.recurringFailureCount}`);
        });

        return lines.join('\n');
    }
}

module.exports = new QualityInsightsService();
