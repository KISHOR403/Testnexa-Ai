/**
 * Traceability & Requirement Coverage Shared Service
 * Authoritative single source of truth for:
 * - Requirements extraction and normalization
 * - Test case linking and coverage status determination
 * - Canonical metrics calculation (Verified, Partial, Failing, Unverified, Uncovered)
 *
 * Used by:
 * - /api/v1/traceability (summary, gaps, matrix, requirements)
 * - /api/v1/intelligence (overview, quality overview)
 */

const supabaseService = require('./supabaseData.service');
const logger = require('../utils/logger');
const {
    unwrapSuiteData,
    isEligibleGeneratedSuite,
    extractValidTestCasesFromSession
} = require('../utils/testCaseManagement.validation');

const EXECUTED_STATUSES = new Set(['passed', 'failed', 'blocked', 'skipped', 'timed_out', 'infrastructure_error']);

/**
 * Fetch all user sessions in a Map keyed by id
 */
const getAllSessionsMap = async (userId) => {
    try {
        const result = await supabaseService.listSessions({
            userId,
            page: 1,
            limit: 100,
            hasCases: true
        });
        const map = new Map();
        (result.sessions || []).forEach(s => {
            map.set(String(s.id || s._id), s);
        });
        return map;
    } catch (err) {
        logger.warn('Failed to load session map:', err.message);
        return new Map();
    }
};

/**
 * Extract test cases from session record
 */
const getTestCasesForSession = (session, allSessionsMap = new Map()) => {
    return extractValidTestCasesFromSession(session, allSessionsMap);
};

/**
 * Extract requirements from session record and test cases
 */
const extractRequirementsFromSession = (session, testCases = []) => {
    const suite = unwrapSuiteData(session);
    const requirementsMap = new Map();

    const addRequirement = (id, title, category = 'Functional', priority = 'Medium', explicitCases = [], source = 'extracted', source_quote = '', description = '') => {
        const cleanId = String(id || '').trim();
        const cleanTitle = String(title || cleanId || 'Requirement specification').trim();
        if (!cleanId && !cleanTitle) return;

        const key = cleanId || cleanTitle.toLowerCase();
        if (requirementsMap.has(key)) {
            const existing = requirementsMap.get(key);
            explicitCases.forEach(cid => {
                if (!existing.explicitCaseRefs.includes(String(cid))) {
                    existing.explicitCaseRefs.push(String(cid));
                }
            });
            if (!existing.source_quote && source_quote) existing.source_quote = source_quote;
            return;
        }

        requirementsMap.set(key, {
            id: cleanId || key,
            key: cleanId || key,
            title: cleanTitle,
            description: description || cleanTitle,
            category: category || 'Functional',
            priority: priority || 'Medium',
            source: source || 'extracted',
            source_quote: source_quote || '',
            explicitCaseRefs: explicitCases.map(String)
        });
    };

    // 1. Direct suite.requirements array or object
    const rawReqs = suite?.requirements || suite?.understanding?.functional_requirements || suite?.traceability?.matrix;
    if (Array.isArray(rawReqs)) {
        rawReqs.forEach((item, idx) => {
            if (typeof item === 'string' && item.trim()) {
                addRequirement(`REQ-${String(idx + 1).padStart(3, '0')}`, item.trim(), 'Functional', 'Medium', [], 'extracted', item.trim());
            } else if (item && typeof item === 'object') {
                const id = item.id || item.reqId || item.requirementId || `REQ-${String(idx + 1).padStart(3, '0')}`;
                const title = item.title || item.description || item.text || item.requirement || `Requirement ${id}`;
                const cases = item.testCaseIds || item.linkedCases || item.testCases || [];
                const src = item.source || (item.source_quote ? 'extracted' : 'extracted');
                addRequirement(id, title, item.category || 'Functional', item.priority || 'Medium', Array.isArray(cases) ? cases : [], src, item.source_quote || '', item.description || title);
            }
        });
    } else if (rawReqs && typeof rawReqs === 'object') {
        Object.entries(rawReqs).forEach(([key, val]) => {
            if (typeof val === 'string' && val.trim()) {
                addRequirement(key, val.trim(), 'Functional', 'Medium', [], 'extracted', val.trim());
            } else if (val && typeof val === 'object') {
                const id = val.id || val.reqId || val.requirementId || key;
                const title = val.title || val.description || val.text || val.requirement || key;
                const cases = val.testCaseIds || val.linkedCases || val.testCases || [];
                const src = val.source || (val.source_quote ? 'extracted' : 'extracted');
                addRequirement(id, title, val.category || 'Functional', val.priority || 'Medium', Array.isArray(cases) ? cases : [], src, val.source_quote || '', val.description || title);
            }
        });
    }

    // 2. Scan test cases for requirementId / reqId / requirementRef
    testCases.forEach((tc) => {
        const reqRef = String(tc.requirementId || tc.reqId || tc.requirementRef || '').trim();
        if (reqRef) {
            if (!requirementsMap.has(reqRef)) {
                // Synthesize requirement if not explicitly declared in suite metadata — marked as 'derived'
                const title = tc.title ? `Requirement for ${tc.title}` : `Requirement ${reqRef}`;
                addRequirement(reqRef, title, tc.type || 'Functional', tc.priority || 'Medium', [tc.id], 'derived', '', title);
            } else {
                const req = requirementsMap.get(reqRef);
                if (!req.explicitCaseRefs.includes(String(tc.id))) {
                    req.explicitCaseRefs.push(String(tc.id));
                }
            }
        }
    });

    // 3. Fallback: If still zero requirements, synthesize from suite requirement text
    if (requirementsMap.size === 0) {
        const reqText = (session?.requirement || session?.rawRequirement || suite?.requirement || suite?.feature || '').trim();
        if (reqText) {
            const lines = reqText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 5 && !l.startsWith('#'));
            if (lines.length > 1 && lines.length <= 10) {
                lines.forEach((line, i) => {
                    const clean = line.replace(/^[0-9]+[.)]\s*/, '');
                    addRequirement(`REQ-${String(i + 1).padStart(3, '0')}`, clean, 'Functional', 'Medium', [], 'extracted', line, clean);
                });
            } else {
                addRequirement('REQ-001', reqText.slice(0, 140), 'Functional', 'High', [], 'extracted', reqText, reqText);
            }
        }
    }

    return Array.from(requirementsMap.values());
};

/**
 * Fetch execution runs and build case execution map
 */
const getExecutionStatusMap = async (suiteId, userId) => {
    const execMap = new Map();
    try {
        const runsResult = await supabaseService.listTestRuns({
            suiteId: suiteId || null,
            userId: userId || null,
            limit: 50,
            sort: 'newest'
        });

        const runs = runsResult.runs || [];
        for (const run of runs) {
            const runCases = await supabaseService.listRunCases(run.id).catch(() => []);
            for (const rc of runCases) {
                const cid = String(rc.testCaseId || rc.id);
                if (!execMap.has(cid)) {
                    execMap.set(cid, {
                        status: rc.status || 'not_run',
                        actualResult: rc.actualResult || '',
                        durationMs: rc.durationMs || 0,
                        executedAt: rc.executedAt || run.completedAt || run.createdAt
                    });
                }
            }
        }
    } catch (err) {
        logger.warn('Failed to fetch execution runs for traceability status map:', err.message);
    }
    return execMap;
};

/**
 * Build canonical traceability rows linking requirements to test cases
 */
const buildTraceabilityRows = (requirements, testCases, execMap) => {
    return requirements.map(req => {
        const reqId = String(req.id || req.key);
        const explicitRefs = new Set((req.explicitCaseRefs || []).map(String));

        // Find all test cases that link to this requirement
        const linkedCases = testCases.filter(tc => {
            const cid = String(tc.id);
            const tcReq = String(tc.requirementId || tc.reqId || tc.requirementRef || '');
            return (tcReq && tcReq === reqId) || explicitRefs.has(cid);
        });

        const linkedTests = linkedCases.map(tc => {
            const cid = String(tc.id);
            const exec = execMap.get(cid);
            const status = exec?.status || (tc.executionStatus === 'executed' ? 'passed' : 'not_run');
            return {
                id: cid,
                testCaseId: cid,
                title: tc.title || tc.testScenario || '',
                category: tc.type || tc.category || 'Functional',
                priority: tc.priority || 'Medium',
                severity: tc.severity || 'Major',
                executionType: tc.method || 'manual',
                approvalStatus: tc.lifecycle || tc.status || 'ready',
                status,
                durationMs: exec?.durationMs || 0,
                executedAt: exec?.executedAt || null,
                actualResult: exec?.actualResult || '',
                rationale: tc.reason || tc.priorityExplanation || tc.priority_rationale || tc.description || 'Validates requirement specifications.'
            };
        });

        const linkedCount = linkedTests.length;
        const executedCount = linkedTests.filter(t => EXECUTED_STATUSES.has(t.status) && t.status !== 'not_run').length;
        const passedCount = linkedTests.filter(t => t.status === 'passed').length;
        const failedCount = linkedTests.filter(t => ['failed', 'timed_out', 'infrastructure_error'].includes(t.status)).length;

        let status = 'uncovered';
        if (linkedCount > 0) {
            if (failedCount > 0) {
                status = 'failing';
            } else if (executedCount > 0 && passedCount === linkedCount) {
                status = 'verified';
            } else if (executedCount === 0) {
                status = 'unverified';
            } else {
                status = 'partial';
            }
        }

        const lastRun = linkedTests.map(t => t.executedAt).filter(Boolean).sort().reverse()[0] || null;

        return {
            id: req.id,
            key: req.key || req.id,
            title: req.title,
            description: req.description,
            category: req.category,
            priority: req.priority,
            source: req.source || 'extracted',
            source_quote: req.source_quote || '',
            status,
            linkedCount,
            executedCount,
            passedCount,
            failedCount,
            lastRun,
            linkedTests
        };
    });
};

/**
 * Compute unified summary metrics
 * Mutually exclusive status buckets: verified, partial, failing, unverified, uncovered.
 * Total === verified + partial + failing + unverified + uncovered.
 * Linked === linked count and linkedPercent.
 * Verified === verified count and verifiedPercent.
 */
const computeSummaryMetrics = (rows) => {
    const total = rows.length;
    const verified = rows.filter(r => r.status === 'verified').length;
    const partial = rows.filter(r => r.status === 'partial').length;
    const failing = rows.filter(r => r.status === 'failing').length;
    const unverified = rows.filter(r => r.status === 'unverified').length;
    const uncovered = rows.filter(r => r.status === 'uncovered').length;

    const linked = rows.filter(r => r.linkedCount > 0).length;
    const linkedPercent = total > 0 ? Math.round((linked / total) * 100) : 0;
    const verifiedPercent = total > 0 ? Math.round((verified / total) * 100) : 0;

    return {
        total,
        verified,
        partial,
        failing,
        unverified,
        uncovered,
        linked,
        linkedPercent,
        verifiedPercent,
        // Backwards compatibility aliases
        covered: linked,
        coveragePercent: linkedPercent
    };
};

/**
 * Resolve target sessions according to suiteId filter
 */
const resolveTargetSessions = async (suiteId, userId) => {
    if (suiteId && suiteId !== 'all') {
        const session = await supabaseService.getSession(suiteId, userId);
        if (session && isEligibleGeneratedSuite(session)) {
            return [session];
        }
        return [];
    }

    const result = await supabaseService.listSessions({
        userId,
        page: 1,
        limit: 100,
        hasCases: true
    });
    return (result.sessions || []).filter(isEligibleGeneratedSuite);
};

/**
 * Authoritative single service function to compute canonical traceability metrics for a suite or workspace
 */
const getTraceabilitySummary = async (suiteId, userId) => {
    const sessions = await resolveTargetSessions(suiteId, userId);
    if (sessions.length === 0) {
        return {
            suiteId: suiteId || 'all',
            total: 0,
            covered: 0,
            uncovered: 0,
            partial: 0,
            failing: 0,
            unverified: 0,
            verified: 0,
            linked: 0,
            linkedPercent: 0,
            verifiedPercent: 0,
            coveragePercent: 0,
            updatedAt: null,
            sessions: []
        };
    }

    const allSessionsMap = await getAllSessionsMap(userId);
    const allCases = sessions.flatMap(s => getTestCasesForSession(s, allSessionsMap));
    const allReqs = sessions.flatMap(s => extractRequirementsFromSession(s, getTestCasesForSession(s, allSessionsMap)));
    const execMap = await getExecutionStatusMap(suiteId !== 'all' ? suiteId : null, userId);
    const rows = buildTraceabilityRows(allReqs, allCases, execMap);
    const metrics = computeSummaryMetrics(rows);

    const latestUpdated = sessions
        .map(s => s.updatedAt || s.updated_at || s.createdAt)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

    return {
        suiteId: suiteId || (sessions.length === 1 ? (sessions[0].id || sessions[0]._id) : 'all'),
        ...metrics,
        updatedAt: latestUpdated,
        sessions,
        allCases,
        allReqs,
        rows
    };
};

module.exports = {
    EXECUTED_STATUSES,
    getAllSessionsMap,
    getTestCasesForSession,
    extractRequirementsFromSession,
    getExecutionStatusMap,
    buildTraceabilityRows,
    computeSummaryMetrics,
    resolveTargetSessions,
    getTraceabilitySummary
};
