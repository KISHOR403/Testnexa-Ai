/**
 * QA Health & Authoring Intelligence Service
 * Single authoritative service for authoring, review, traceability, and quality health metrics.
 * Strictly adheres to black-and-white theme data models and testRuns feature flag states.
 */

const traceabilityService = require('./traceability.service');
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
 * Determine if a test case is marked as approved / ready
 */
const isCaseApproved = (tc) => {
    if (!tc) return false;
    const raw = tc.raw || {};
    if (tc.is_approved === false || tc.approved === false || tc.isApproved === false || raw.is_approved === false || raw.approved === false) return false;
    if (tc.is_approved === true || tc.approved === true || tc.isApproved === true || raw.is_approved === true || raw.approved === true) return true;
    const status = String(tc.status || tc.approvalStatus || raw.status || '').toLowerCase().trim();
    if (status === 'approved' || status === 'completed') return true;
    if (['needs-review', 'needs_review', 'pending', 'draft', 'archived'].includes(status)) return false;
    const lifecycle = String(tc.lifecycle || tc.lifecycleStatus || raw.lifecycle || '').toLowerCase().trim();
    return lifecycle === 'ready';
};

/**
 * Computes authoring, review, requirement traceability, and gap metrics
 * @param {string} [suiteId='all']
 * @param {string} userId
 */
const getIntelligenceOverview = async (suiteId = 'all', userId) => {
    const targetSuiteId = (suiteId && String(suiteId).trim()) ? String(suiteId).trim() : 'all';
    const cacheKey = `${userId || 'all'}:${targetSuiteId}`;

    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
    }

    // Single source of truth: canonical traceability summary
    const summary = await traceabilityService.getTraceabilitySummary(targetSuiteId, userId);
    const sessions = summary.sessions || [];
    const allCases = summary.allCases || [];
    const rows = summary.rows || [];

    // 1. Totals
    const totals = {
        suites: sessions.length,
        cases: allCases.length,
        requirements: summary.total || 0
    };

    // 2. Review Progress
    let approvedCount = 0;
    allCases.forEach(c => {
        if (isCaseApproved(c)) approvedCount += 1;
    });
    const notApprovedCount = Math.max(0, allCases.length - approvedCount);
    const approvalPct = allCases.length > 0 ? Math.round((approvedCount / allCases.length) * 100) : 0;
    const review = {
        approved: approvedCount,
        notApproved: notApprovedCount,
        approvalPct
    };

    // 3. Traceability (exact canonical numbers from shared traceability service)
    const traceability = {
        linkedPct: summary.linkedPercent || 0,
        verifiedPct: summary.verifiedPercent || 0,
        requirementsLinked: summary.linked || 0,
        requirementsTotal: summary.total || 0
    };

    // 4. Test Types Breakdown
    const byType = {
        functional: 0,
        negative: 0,
        edge: 0,
        nonFunctional: 0,
        api: 0
    };
    allCases.forEach(tc => {
        const t = String(tc.type || tc.category || '').toLowerCase();
        if (t.includes('api')) {
            byType.api += 1;
        } else if (t.includes('negative')) {
            byType.negative += 1;
        } else if (t.includes('edge')) {
            byType.edge += 1;
        } else if (t.includes('non') || t.includes('performance') || t.includes('load') || t.includes('security') || t.includes('accessibility')) {
            byType.nonFunctional += 1;
        } else {
            byType.functional += 1;
        }
    });

    // 5. Test Priority Breakdown
    const byPriority = {
        high: 0,
        medium: 0,
        low: 0
    };
    allCases.forEach(tc => {
        const p = String(tc.priority || '').toLowerCase();
        if (p === 'critical' || p === 'high') {
            byPriority.high += 1;
        } else if (p === 'low' || p === 'trivial') {
            byPriority.low += 1;
        } else {
            byPriority.medium += 1;
        }
    });

    // 6. Gaps & Opportunities (Rules-based, execution-independent)
    const gaps = [];

    // Rule 1: single_test on High/Critical priority requirements
    const singleTestReqs = rows.filter(r => {
        const p = String(r.priority || '').toLowerCase();
        const count = r.linkedCount !== undefined ? r.linkedCount : (r.linkedTests || []).length;
        return (p === 'critical' || p === 'high') && count === 1;
    });
    if (singleTestReqs.length > 0) {
        gaps.push({
            type: 'single_test',
            title: 'Single test coverage',
            description: `${singleTestReqs.length} high/critical priority requirement${singleTestReqs.length === 1 ? '' : 's'} rely on only 1 test case.`,
            count: singleTestReqs.length,
            suiteId: targetSuiteId,
            suiteName: sessions.length === 1 ? (sessions[0].title || sessions[0].feature || 'Suite') : 'All suites',
            items: singleTestReqs.map(r => ({
                id: r.id,
                title: r.title,
                priority: r.priority,
                linkedTestsCount: r.linkedCount || (r.linkedTests || []).length,
                testCaseIds: (r.linkedTests || []).map(tc => tc.id || tc.testCaseId)
            }))
        });
    }

    // Rule 2: missing_negative_or_security on High/Critical requirements
    const missingNegSecReqs = rows.filter(r => {
        const p = String(r.priority || '').toLowerCase();
        if (p !== 'critical' && p !== 'high') return false;
        const count = r.linkedCount !== undefined ? r.linkedCount : (r.linkedTests || []).length;
        if (count === 0) return false;
        const hasNegOrSec = (r.linkedTests || []).some(tc => {
            const t = String(tc.category || tc.type || '').toLowerCase();
            return t.includes('negative') || t.includes('security') || t.includes('edge');
        });
        return !hasNegOrSec;
    });
    if (missingNegSecReqs.length > 0) {
        gaps.push({
            type: 'missing_negative_or_security',
            title: 'Missing negative or edge validation',
            description: `${missingNegSecReqs.length} high priority requirement${missingNegSecReqs.length === 1 ? '' : 's'} lack negative, edge or security tests.`,
            count: missingNegSecReqs.length,
            suiteId: targetSuiteId,
            suiteName: sessions.length === 1 ? (sessions[0].title || sessions[0].feature || 'Suite') : 'All suites',
            items: missingNegSecReqs.map(r => ({
                id: r.id,
                title: r.title,
                priority: r.priority,
                testCaseIds: (r.linkedTests || []).map(tc => tc.id || tc.testCaseId)
            }))
        });
    }

    // Rule 3: unlinked_tests
    const linkedCaseIdSet = new Set();
    rows.forEach(r => {
        (r.linkedTests || []).forEach(tc => linkedCaseIdSet.add(String(tc.id || tc.testCaseId)));
    });
    const unlinkedCases = allCases.filter(tc => !linkedCaseIdSet.has(String(tc.id)));
    if (unlinkedCases.length > 0) {
        gaps.push({
            type: 'unlinked_tests',
            title: 'Unlinked test cases',
            description: `${unlinkedCases.length} generated test case${unlinkedCases.length === 1 ? '' : 's'} not linked to any requirement.`,
            count: unlinkedCases.length,
            suiteId: targetSuiteId,
            suiteName: sessions.length === 1 ? (sessions[0].title || sessions[0].feature || 'Suite') : 'All suites',
            items: unlinkedCases.map(tc => ({
                id: tc.id,
                title: tc.title,
                suiteId: tc.suiteId,
                suiteName: tc.suiteName
            }))
        });
    }

    // Rule 4: review_target
    const unapprovedCases = allCases.filter(c => !isCaseApproved(c));
    if (unapprovedCases.length > 0) {
        gaps.push({
            type: 'review_target',
            title: 'Cases awaiting review',
            description: `${unapprovedCases.length} test case${unapprovedCases.length === 1 ? '' : 's'} awaiting review or approval before execution readiness.`,
            count: unapprovedCases.length,
            suiteId: targetSuiteId,
            suiteName: sessions.length === 1 ? (sessions[0].title || sessions[0].feature || 'Suite') : 'All suites',
            items: unapprovedCases.map(c => ({
                id: c.id,
                title: c.title,
                suiteId: c.suiteId,
                suiteName: c.suiteName
            }))
        });
    }

    // 7. Activity Array (Last 30 days)
    const activity = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        const suitesCreated = sessions.filter(s => {
            const created = s.createdAt || s.created_at;
            return created && String(created).startsWith(dateStr);
        }).length;

        const casesApproved = allCases.filter(c => {
            if (!isCaseApproved(c)) return false;
            const updated = c.updatedAt || c.updated_at || c.createdAt || c.created_at;
            return updated && String(updated).startsWith(dateStr);
        }).length;

        activity.push({
            date: dateStr,
            suitesCreated,
            casesApproved
        });
    }

    const payload = {
        suiteId: targetSuiteId,
        totals,
        review,
        traceability,
        byType,
        byPriority,
        gaps,
        activity,
        features: {
            testRuns: false
        },
        updatedAt: summary.updatedAt
    };

    cache.set(cacheKey, {
        timestamp: Date.now(),
        data: payload
    });

    return payload;
};

module.exports = {
    getIntelligenceOverview,
    invalidateIntelligenceCache
};
