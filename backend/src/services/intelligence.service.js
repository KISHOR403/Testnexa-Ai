/**
 * QA Health & Authoring Intelligence Service
 * Single authoritative service for authoring, review, traceability, and quality health metrics.
 * Strictly adheres to black-and-white theme data models and testRuns feature flag states.
 * Delegates canonical calculations to qualityMetrics.service.js and case_events audit log.
 */

const qualityMetricsService = require('./qualityMetrics.service');
const supabaseService = require('./supabaseData.service');
const logger = require('../utils/logger');

// 60-second in-memory cache keyed by `${userId}:${suiteId}`
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

/**
 * Invalidate intelligence cache entries
 * @param {string} [userId]
 * @param {string} [suiteId]
 */
const invalidateIntelligenceCache = (userId, suiteId) => {
    if (!userId) {
        cache.clear();
        return;
    }
    for (const key of cache.keys()) {
        if (key.startsWith(`${userId}:`)) {
            if (!suiteId || key === `${userId}:${suiteId}`) {
                cache.delete(key);
            }
        }
    }
};

/**
 * Safely format a timestamp to YYYY-MM-DD in the specified timezone
 */
const formatDateInTz = (dateInput, timeZone = 'UTC') => {
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return null;
        return new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
    } catch {
        // Fallback to UTC if timezone is invalid
        try {
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: 'UTC',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date(dateInput));
        } catch {
            return null;
        }
    }
};

/**
 * Get authoring activity time-series from immutable case_events
 * Grouped into timezone-adjusted daily buckets
 */
const getIntelligenceActivity = async ({ suiteId = 'all', userId, days = 30, tz = 'UTC' }) => {
    const numDays = Math.max(1, Math.min(365, parseInt(days, 10) || 30));
    const targetTz = (tz && typeof tz === 'string') ? tz.trim() : 'UTC';
    const targetSuiteId = (suiteId && String(suiteId).trim()) ? String(suiteId).trim() : 'all';

    // Build ordered list of date strings for the requested range
    const now = new Date();
    const dateMap = new Map();
    const dateList = [];

    for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = formatDateInTz(d, targetTz);
        if (dateStr && !dateMap.has(dateStr)) {
            const bucket = {
                date: dateStr,
                suitesCreated: 0,
                casesGenerated: 0,
                casesApproved: 0
            };
            dateMap.set(dateStr, bucket);
            dateList.push(bucket);
        }
    }

    const oldestDate = dateList[0]?.date;
    const startDateIso = oldestDate ? new Date(`${oldestDate}T00:00:00.000Z`).toISOString() : null;

    // Fetch case events from Postgres / memory
    const events = await supabaseService.listCaseEvents({
        userId,
        suiteId: targetSuiteId !== 'all' ? targetSuiteId : null,
        startDate: startDateIso
    });

    let totalSuitesCreated = 0;
    let totalCasesGenerated = 0;
    let totalCasesApproved = 0;

    for (const evt of events) {
        const eventDateStr = formatDateInTz(evt.createdAt, targetTz);
        if (!eventDateStr || !dateMap.has(eventDateStr)) continue;

        const bucket = dateMap.get(eventDateStr);
        if (evt.type === 'suite_created') {
            bucket.suitesCreated += 1;
            totalSuitesCreated += 1;
        } else if (evt.type === 'case_generated') {
            bucket.casesGenerated += 1;
            totalCasesGenerated += 1;
        } else if (evt.type === 'case_approved') {
            bucket.casesApproved += 1;
            totalCasesApproved += 1;
        }
    }

    return {
        suiteId: targetSuiteId,
        days: numDays,
        tz: targetTz,
        periodTotals: {
            suitesCreated: totalSuitesCreated,
            casesGenerated: totalCasesGenerated,
            casesApproved: totalCasesApproved
        },
        activity: dateList
    };
};

/**
 * Computes authoring, review, requirement traceability, and gap metrics
 * Uses canonical qualityMetrics.service.js
 * @param {string} [suiteId='all']
 * @param {string} userId
 */
const getIntelligenceOverview = async (suiteIdOrOpts = 'all', userIdArg) => {
    let rawSuiteId = 'all';
    let rawUserId = userIdArg;
    if (typeof suiteIdOrOpts === 'object' && suiteIdOrOpts !== null) {
        rawSuiteId = suiteIdOrOpts.suiteId || 'all';
        rawUserId = suiteIdOrOpts.userId || userIdArg;
    } else {
        rawSuiteId = suiteIdOrOpts || 'all';
    }

    const targetSuiteId = (rawSuiteId && String(rawSuiteId).trim()) ? String(rawSuiteId).trim() : 'all';
    const userId = rawUserId;
    const cacheKey = `${userId || 'all'}:${targetSuiteId}`;

    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
    }

    // Canonical Single Source of Truth
    const metrics = await qualityMetricsService.getQualityMetrics({
        suiteId: targetSuiteId,
        userId
    });

    // Activity timeseries from immutable case_events
    const activityData = await getIntelligenceActivity({
        suiteId: targetSuiteId,
        userId,
        days: 30,
        tz: 'UTC'
    });

    const payload = {
        suiteId: targetSuiteId,
        totals: {
            suites: metrics.suites ? metrics.suites.length : (metrics.suiteId !== 'all' && metrics.cases > 0 ? 1 : 0),
            cases: metrics.cases,
            requirements: metrics.requirements
        },
        review: {
            approved: metrics.approvedCount,
            notApproved: metrics.notApprovedCount,
            approvalPct: metrics.approvalPct
        },
        traceability: {
            linkedPct: metrics.linkedPct,
            verifiedPct: metrics.verifiedPct,
            requirementsLinked: metrics.linkedRequirements,
            requirementsTotal: metrics.requirements
        },
        byType: {
            functional: metrics.byType.functional || 0,
            negative: metrics.byType.negative || 0,
            edge: metrics.byType.edge || 0,
            nonFunctional: metrics.byType.non_functional || 0,
            security: metrics.byType.security || 0,
            api: metrics.byType.api || 0
        },
        byPriority: {
            high: metrics.byPriority.high || 0,
            medium: metrics.byPriority.medium || 0,
            low: metrics.byPriority.low || 0,
            unset: metrics.byPriority.unset || 0
        },
        requirementsBySource: metrics.requirementsBySource,
        gaps: metrics.gaps.map(g => {
            let legacyType = g.key;
            if (g.key === 'single_test_requirement') legacyType = 'single_test';
            else if (g.key === 'no_negative_or_security_test') legacyType = 'missing_negative_or_security';
            else if (g.key === 'unlinked_test_case') legacyType = 'unlinked_tests';
            else if (g.key === 'review_backlog') legacyType = 'review_target';

            return {
                key: g.key,
                type: legacyType,
                title: g.label || g.title,
                description: g.description,
                count: g.count,
                severity: g.severity,
                items: g.items || [],
                actionPath: g.actionPath
            };
        }),
        rulesChecked: metrics.rulesChecked,
        checkedAt: metrics.updatedAt || null,
        suites: metrics.suites,
        activity: activityData.activity,
        periodTotals: activityData.periodTotals,
        features: {
            testRuns: false
        },
        updatedAt: metrics.updatedAt
    };

    cache.set(cacheKey, {
        timestamp: Date.now(),
        data: payload
    });

    return payload;
};

module.exports = {
    getIntelligenceOverview,
    getIntelligenceActivity,
    invalidateIntelligenceCache
};
