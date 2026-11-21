/**
 * Centralized Single Source of Truth for Quality & Coverage Metrics
 * Authoritative service for:
 * - Approved test case counts (ONLY approval_status === 'approved')
 * - Requirement linkage and execution verification
 * - Deterministic gap discovery rules
 * - Canonical type and priority distributions
 * - Requirement provenance (extracted vs derived vs manual)
 *
 * Used uniformly by:
 * - /api/v1/intelligence/overview
 * - /api/v1/traceability/summary & /traceability/gaps
 * - /api/v1/sessions/:id & /test-suites/:id (Suite Detail)
 * - /api/v1/test-suites (Suites List)
 */

const supabaseService = require('./supabaseData.service');
const {
    unwrapSuiteData,
    isEligibleGeneratedSuite,
    extractValidTestCasesFromSession,
    resolvePlatform
} = require('../utils/testCaseManagement.validation');
const logger = require('../utils/logger');

const EXECUTED_STATUSES = new Set(['passed', 'failed', 'blocked', 'skipped', 'timed_out', 'infrastructure_error']);

/**
 * Normalizes test case approval status strictly.
 * 'approved' ONLY if explicit approval_status === 'approved' or approved === true / status === 'Approved'.
 * Never silently treat 'ready' or 'draft' or 'Not Executed' as approved!
 */
const getCaseApprovalStatus = (tc) => {
    if (!tc) return 'pending';
    const raw = tc.raw || tc;

    const explicit = String(
        tc.approval_status ||
        tc.approvalStatus ||
        raw.approval_status ||
        raw.approvalStatus ||
        ''
    ).toLowerCase().trim();

    if (explicit === 'approved') return 'approved';
    if (explicit === 'rejected') return 'rejected';
    if (explicit === 'pending') return 'pending';

    // Backwards compatibility for explicit boolean or uppercase 'Approved'
    if (tc.is_approved === true || tc.approved === true || raw.is_approved === true || raw.approved === true) {
        return 'approved';
    }
    const status = String(tc.status || raw.status || '').toLowerCase().trim();
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';

    // Strict rule: everything else defaults strictly to 'pending'
    return 'pending';
};

const { normalizeCanonicalTestType } = require('./riskScoring');

/**
 * Canonical test type classification
 * Enum: 'functional' | 'negative' | 'edge' | 'non_functional' | 'security' | 'api'
 */
const normalizeTestType = (tc) => {
    return normalizeCanonicalTestType(tc);
};

/**
 * Canonical priority classification
 * Enum: 'high' | 'medium' | 'low' | 'unset'
 */
const normalizeTestPriority = (tc) => {
    const raw = tc.raw || tc;
    const rawP = (raw && raw.priority !== undefined && raw.priority !== null) ? raw.priority : tc.priority;
    const p = String(rawP || '').toLowerCase().trim();

    if (p === 'critical' || p === 'high') return 'high';
    if (p === 'medium') return 'medium';
    if (p === 'low' || p === 'trivial') return 'low';
    return 'unset';
};

/**
 * Extracts and normalizes requirements from session records
 * Tracks provenance honestly: 'extracted' | 'derived' | 'manual'
 */
const extractNormalizedRequirements = (session, testCases = []) => {
    const suite = unwrapSuiteData(session);
    const requirementsMap = new Map();

    const addReq = (id, title, category = 'Functional', priority = 'Medium', explicitCases = [], source = 'derived', source_quote = '', description = '') => {
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
            if (!existing.source_quote && source_quote) {
                existing.source_quote = source_quote;
                existing.source = source || 'extracted';
            }
            return;
        }

        requirementsMap.set(key, {
            id: cleanId || key,
            key: cleanId || key,
            title: cleanTitle,
            description: description || cleanTitle,
            category: category || 'Functional',
            priority: priority || 'Medium',
            source: source || 'derived',
            source_quote: source_quote || '',
            explicitCaseRefs: explicitCases.map(String)
        });
    };

    // 1. Explicit requirements in suite_data.requirements
    const rawReqs = suite?.requirements || suite?.understanding?.functional_requirements || suite?.traceability?.matrix;
    if (Array.isArray(rawReqs) && rawReqs.length > 0) {
        rawReqs.forEach((item, idx) => {
            if (typeof item === 'string' && item.trim()) {
                addReq(`REQ-${String(idx + 1).padStart(3, '0')}`, item.trim(), 'Functional', 'Medium', [], 'extracted', item.trim());
            } else if (item && typeof item === 'object') {
                const id = item.id || item.reqId || item.requirementId || `REQ-${String(idx + 1).padStart(3, '0')}`;
                const title = item.title || item.description || item.text || item.requirement || `Requirement ${id}`;
                const cases = item.testCaseIds || item.linkedCases || item.testCases || [];
                const src = item.source || (item.source_quote ? 'extracted' : 'extracted');
                addReq(id, title, item.category || 'Functional', item.priority || 'Medium', Array.isArray(cases) ? cases : [], src, item.source_quote || '', item.description || title);
            }
        });
    }

    // 2. Inferred / Derived requirements from test case tags
    testCases.forEach(tc => {
        const raw = tc.raw || tc;
        const reqId = String(tc.requirementId || tc.reqId || raw.requirementId || raw.reqId || '').trim();
        if (reqId) {
            const key = reqId;
            if (!requirementsMap.has(key)) {
                // Inferred requirements are strictly marked 'derived'
                addReq(
                    reqId,
                    `Requirement ${reqId}`,
                    tc.category || tc.type || 'Functional',
                    tc.priority || 'Medium',
                    [tc.id],
                    'derived',
                    '',
                    `Derived from test case references (${reqId}).`
                );
            } else {
                const existing = requirementsMap.get(key);
                if (!existing.explicitCaseRefs.includes(String(tc.id))) {
                    existing.explicitCaseRefs.push(String(tc.id));
                }
            }
        }
    });

    return Array.from(requirementsMap.values());
};

/**
 * Fetch execution run statuses map
 */
const getExecutionStatusMap = async (suiteId, userId) => {
    const map = new Map();
    try {
        const runsResult = await supabaseService.listTestRuns({
            suiteId: suiteId || null,
            userId: userId || null,
            page: 1,
            limit: 50,
            sort: 'newest'
        }).catch(() => ({ runs: [] }));

        const runs = runsResult.runs || [];
        for (const run of runs.slice(0, 20)) {
            const runDetail = await supabaseService.getTestRunById(run.id).catch(() => null);
            let cases = runDetail?.cases || run.cases || [];
            if (!cases || cases.length === 0) {
                try {
                    const results = await supabaseService.listTestRunResults(run.id);
                    if (Array.isArray(results) && results.length > 0) {
                        cases = results.map(r => ({
                            testCaseId: r.case_id,
                            status: r.outcome
                        }));
                    }
                } catch (e) {}
            }
            if (Array.isArray(cases)) {
                for (const c of cases) {
                    const cid = String(c.testCaseId || c.caseSnapshot?.id || '');
                    if (cid && !map.has(cid)) {
                        map.set(cid, {
                            status: String(c.status || 'not_run').toLowerCase(),
                            runId: run.id,
                            executedAt: run.completedAt || run.startedAt || run.createdAt
                        });
                    }
                }
            }
        }
    } catch (err) {
        logger.warn('Non-fatal: could not resolve execution status map:', err.message);
    }
    return map;
};

/**
 * Authoritative Quality Metrics Calculation Service
 * @param {object} params
 * @param {string} [params.suiteId='all']
 * @param {string} params.userId
 */
const getQualityMetrics = async ({ suiteId = 'all', userId }) => {
    const targetSuiteId = (suiteId && String(suiteId).trim()) ? String(suiteId).trim() : 'all';

    // 1. Resolve Target Sessions
    let sessions = [];
    if (targetSuiteId && targetSuiteId !== 'all') {
        const session = await supabaseService.getSession(targetSuiteId, userId);
        if (session && isEligibleGeneratedSuite(session)) {
            sessions = [session];
        }
    } else {
        const result = await supabaseService.listSessions({
            userId,
            page: 1,
            limit: 100,
            hasCases: true
        });
        sessions = (result.sessions || []).filter(isEligibleGeneratedSuite);
    }

    if (sessions.length === 0) {
        return {
            suiteId: targetSuiteId,
            cases: 0,
            requirements: 0,
            approvedCount: 0,
            notApprovedCount: 0,
            approvalPct: 0,
            linkedRequirements: 0,
            linkedPct: 0,
            verifiedRequirements: 0,
            verifiedPct: 0,
            byType: { functional: 0, negative: 0, edge: 0, non_functional: 0, security: 0, api: 0 },
            byPriority: { high: 0, medium: 0, low: 0, unset: 0 },
            requirementsBySource: { extracted: 0, derived: 0, manual: 0 },
            gaps: [],
            rulesChecked: [
                'single_test_requirement',
                'no_negative_or_security_test',
                'unlinked_test_case',
                'review_backlog',
                'missing_priority'
            ],
            checkedAt: new Date().toISOString(),
            suites: [],
            updatedAt: null
        };
    }

    // 2. Load all sessions map for cross-suite references
    const allSessionsResult = await supabaseService.listSessions({ userId, page: 1, limit: 100, hasCases: true }).catch(() => ({ sessions: [] }));
    const allSessionsMap = new Map((allSessionsResult.sessions || []).map(s => [String(s.id || s._id), s]));

    // 3. Extract and normalize cases and requirements per suite
    const execMap = await getExecutionStatusMap(targetSuiteId !== 'all' ? targetSuiteId : null, userId);

    let allCases = [];
    const suiteMetricsList = [];

    for (const session of sessions) {
        const sid = String(session.id || session._id);
        const suiteCases = extractValidTestCasesFromSession(session, allSessionsMap);

        // Normalize approval status on each case, honoring inMemoryTestCases if present
        suiteCases.forEach(tc => {
            const memCase = supabaseService.inMemoryTestCases?.get(String(tc.id));
            if (memCase) {
                tc.approval_status = memCase.approval_status;
                tc.is_approved = memCase.approval_status === 'approved';
                tc.priority = memCase.priority || tc.priority;
                tc.type = memCase.type || tc.type;
            } else {
                tc.approval_status = getCaseApprovalStatus(tc);
                tc.is_approved = tc.approval_status === 'approved';
            }
            tc.canonicalType = normalizeTestType(tc);
            tc.canonicalPriority = normalizeTestPriority(tc);
        });

        let suiteReqs = [];
        if (supabaseService.inMemoryRequirements && supabaseService.inMemoryRequirements.size > 0) {
            const stored = Array.from(supabaseService.inMemoryRequirements.values())
                .filter(r => r.suite_id === sid);
            if (stored.length > 0) {
                suiteReqs = stored.map(r => ({
                    id: r.id,
                    key: r.key,
                    title: r.title,
                    description: r.description || r.title,
                    category: r.category || 'Functional',
                    priority: r.priority || 'Medium',
                    source: r.source || 'extracted',
                    source_quote: r.source_quote || '',
                    explicitCaseRefs: []
                }));
            }
        }
        if (suiteReqs.length === 0) {
            suiteReqs = extractNormalizedRequirements(session, suiteCases);
        }

        // Map requirements to cases
        const reqLinkMap = new Map();
        suiteReqs.forEach(r => {
            const directLinks = Array.from(supabaseService.inMemoryRequirementTestCases?.values() || [])
                .filter(rtc => (rtc.requirement_id === r.id || rtc.requirement_id === r.key) && rtc.suite_id === sid);
            const directCaseIds = new Set(directLinks.map(l => l.case_id));

            const linked = suiteCases.filter(tc => {
                const cid = String(tc.id);
                if (directCaseIds.has(cid)) return true;
                const reqRef = String(tc.requirementId || tc.reqId || (tc.raw && (tc.raw.requirementId || tc.raw.reqId)) || '');
                return reqRef === r.id || reqRef === r.key || r.explicitCaseRefs.includes(cid);
            });
            reqLinkMap.set(r.id, linked);
            if (r.key && r.key !== r.id) reqLinkMap.set(r.key, linked);
        });

        const suiteApproved = suiteCases.filter(tc => tc.approval_status === 'approved').length;
        const suiteLinked = suiteReqs.filter(r => (reqLinkMap.get(r.id) || []).length > 0).length;

        // Count gaps for this suite
        let suiteGapCount = 0;
        suiteReqs.forEach(r => {
            const lcases = reqLinkMap.get(r.id) || [];
            if (lcases.length === 1) suiteGapCount++;
            if ((r.priority === 'High' || r.priority === 'Critical') && !lcases.some(c => c.canonicalType === 'negative' || c.canonicalType === 'security' || c.canonicalType === 'edge')) {
                suiteGapCount++;
            }
        });
        const unlinkedInSuite = suiteCases.filter(tc => !suiteReqs.some(r => (reqLinkMap.get(r.id) || []).some(c => c.id === tc.id))).length;
        suiteGapCount += unlinkedInSuite;
        suiteGapCount += (suiteCases.length - suiteApproved);

        const sTitle = session.title || session.feature || 'Untitled Suite';
        const sPlatform = resolvePlatform ? resolvePlatform(session.suite_data, session) : 'Web';

        suiteMetricsList.push({
            id: sid,
            name: sTitle,
            platform: sPlatform,
            cases: suiteCases.length,
            approvedCount: suiteApproved,
            approvedPct: suiteCases.length > 0 ? Math.round((suiteApproved / suiteCases.length) * 100) : 0,
            linkedCount: suiteLinked,
            linkedPct: suiteReqs.length > 0 ? Math.round((suiteLinked / suiteReqs.length) * 100) : 0,
            gapCount: suiteGapCount,
            updatedAt: session.updatedAt || session.updated_at || session.createdAt || session.created_at || new Date().toISOString(),
            rawSession: session,
            casesList: suiteCases,
            reqsList: suiteReqs,
            reqLinkMap
        });

        allCases.push(...suiteCases);
    }

    // 4. Aggregate Global Metrics
    const totalCases = allCases.length;
    const totalApproved = allCases.filter(tc => tc.approval_status === 'approved').length;
    const totalNotApproved = totalCases - totalApproved;
    const approvalPct = totalCases > 0 ? Math.round((totalApproved / totalCases) * 100) : 0;

    // Combine unique requirements
    const combinedReqsMap = new Map();
    suiteMetricsList.forEach(sm => {
        sm.reqsList.forEach(r => {
            if (!combinedReqsMap.has(r.id)) {
                combinedReqsMap.set(r.id, {
                    ...r,
                    suiteId: sm.id,
                    suiteName: sm.name,
                    linkedCases: sm.reqLinkMap.get(r.id) || []
                });
            } else {
                const existing = combinedReqsMap.get(r.id);
                const extra = sm.reqLinkMap.get(r.id) || [];
                extra.forEach(c => {
                    if (!existing.linkedCases.some(ec => ec.id === c.id)) {
                        existing.linkedCases.push(c);
                    }
                });
            }
        });
    });

    const allReqs = Array.from(combinedReqsMap.values());
    const totalReqs = allReqs.length;

    const linkedReqs = allReqs.filter(r => r.linkedCases.length > 0).length;
    const linkedPct = totalReqs > 0 ? Math.round((linkedReqs / totalReqs) * 100) : 0;

    // Verified requirements: always 0 when FEATURE_TEST_RUNS is disabled
    let verifiedReqs = 0;
    if (process.env.FEATURE_TEST_RUNS === 'true') {
        verifiedReqs = allReqs.filter(r => {
            if (r.linkedCases.length === 0) return false;
            return r.linkedCases.every(c => {
                const st = execMap.get(String(c.id));
                return st && st.status === 'passed';
            });
        }).length;
    }
    const verifiedPct = totalReqs > 0 ? Math.round((verifiedReqs / totalReqs) * 100) : 0;

    // Type Breakdown (Canonical Enum)
    const byType = {
        functional: 0,
        negative: 0,
        edge: 0,
        non_functional: 0,
        security: 0,
        api: 0
    };
    allCases.forEach(tc => {
        byType[tc.canonicalType] = (byType[tc.canonicalType] || 0) + 1;
    });

    // Priority Breakdown (Canonical Enum)
    const byPriority = {
        high: 0,
        medium: 0,
        low: 0,
        unset: 0
    };
    allCases.forEach(tc => {
        byPriority[tc.canonicalPriority] = (byPriority[tc.canonicalPriority] || 0) + 1;
    });

    // Requirement Provenance Breakdown
    const requirementsBySource = {
        extracted: 0,
        derived: 0,
        manual: 0
    };
    allReqs.forEach(r => {
        const src = r.source === 'extracted' ? 'extracted' : (r.source === 'manual' ? 'manual' : 'derived');
        requirementsBySource[src] += 1;
    });

    // 5. Deterministic Gap Rules (STEP 4)
    const gaps = [];

    // Rule 1: single_test_requirement (requirements with exactly one linked test)
    const singleTestReqs = allReqs.filter(r => r.linkedCases.length === 1);
    if (singleTestReqs.length > 0) {
        gaps.push({
            key: 'single_test_requirement',
            label: 'Single-Test Requirements',
            count: singleTestReqs.length,
            severity: 'medium',
            description: `${singleTestReqs.length} requirement${singleTestReqs.length === 1 ? '' : 's'} rely on only 1 test case.`,
            items: singleTestReqs.slice(0, 5).map(r => ({
                id: r.id,
                title: r.title,
                priority: r.priority,
                linkedCaseId: r.linkedCases[0]?.id
            })),
            actionPath: `/app/traceability?suite=${targetSuiteId}&gap=single_test_requirement`
        });
    }

    // Rule 2: no_negative_or_security_test (high-priority requirements without negative or security test)
    const noNegSecReqs = allReqs.filter(r => {
        const p = String(r.priority || '').toLowerCase();
        if (p !== 'high' && p !== 'critical') return false;
        if (r.linkedCases.length === 0) return false;
        const hasNegOrSec = r.linkedCases.some(c => c.canonicalType === 'negative' || c.canonicalType === 'security' || c.canonicalType === 'edge');
        return !hasNegOrSec;
    });
    if (noNegSecReqs.length > 0) {
        gaps.push({
            key: 'no_negative_or_security_test',
            label: 'Missing Negative / Security Validation',
            count: noNegSecReqs.length,
            severity: 'high',
            description: `${noNegSecReqs.length} high priority requirement${noNegSecReqs.length === 1 ? '' : 's'} lack negative or security validation.`,
            items: noNegSecReqs.slice(0, 5).map(r => ({
                id: r.id,
                title: r.title,
                priority: r.priority
            })),
            actionPath: `/app/traceability?suite=${targetSuiteId}&gap=no_negative_or_security_test`
        });
    }

    // Rule 3: unlinked_test_case (test cases without a requirement link)
    const linkedCaseIds = new Set();
    allReqs.forEach(r => {
        r.linkedCases.forEach(c => linkedCaseIds.add(String(c.id)));
    });
    const unlinkedCases = allCases.filter(c => !linkedCaseIds.has(String(c.id)));
    if (unlinkedCases.length > 0) {
        gaps.push({
            key: 'unlinked_test_case',
            label: 'Unlinked Test Cases',
            count: unlinkedCases.length,
            severity: 'medium',
            description: `${unlinkedCases.length} test case${unlinkedCases.length === 1 ? '' : 's'} are not mapped to any requirement.`,
            items: unlinkedCases.slice(0, 5).map(c => ({
                id: c.id,
                title: c.title,
                suiteId: c.suiteId
            })),
            actionPath: `/app/test-cases?suiteId=${targetSuiteId}&linked=false`
        });
    }

    // Rule 4: review_backlog (cases with approval_status = 'pending')
    const pendingCases = allCases.filter(c => c.approval_status === 'pending');
    if (pendingCases.length > 0) {
        gaps.push({
            key: 'review_backlog',
            label: 'Review Backlog',
            count: pendingCases.length,
            severity: 'low',
            description: `${pendingCases.length} test case${pendingCases.length === 1 ? '' : 's'} awaiting review or approval before execution readiness.`,
            items: pendingCases.slice(0, 5).map(c => ({
                id: c.id,
                title: c.title,
                suiteId: c.suiteId
            })),
            actionPath: `/app/test-cases?suiteId=${targetSuiteId}&approvalStatus=pending`
        });
    }

    // Rule 5: missing_priority (cases without a priority)
    const missingPriorityCases = allCases.filter(c => c.canonicalPriority === 'unset');
    if (missingPriorityCases.length > 0) {
        gaps.push({
            key: 'missing_priority',
            label: 'Missing Priority',
            count: missingPriorityCases.length,
            severity: 'low',
            description: `${missingPriorityCases.length} test case${missingPriorityCases.length === 1 ? '' : 's'} without an assigned severity or priority.`,
            items: missingPriorityCases.slice(0, 5).map(c => ({
                id: c.id,
                title: c.title,
                suiteId: c.suiteId
            })),
            actionPath: `/app/test-cases?suiteId=${targetSuiteId}&priority=unset`
        });
    }

    // 6. Sort suites breakdown by gapCount desc then updatedAt desc
    const sortedSuites = suiteMetricsList
        .map(sm => ({
            id: sm.id,
            name: sm.name,
            platform: sm.platform,
            cases: sm.cases,
            approvedCount: sm.approvedCount,
            approvedPct: sm.approvedPct,
            linkedCount: sm.linkedCount,
            linkedPct: sm.linkedPct,
            gapCount: sm.gapCount,
            updatedAt: sm.updatedAt
        }))
        .sort((a, b) => {
            if (b.gapCount !== a.gapCount) return b.gapCount - a.gapCount;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

    const latestUpdated = sessions
        .map(s => s.updatedAt || s.updated_at || s.createdAt || s.created_at)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

    return {
        suiteId: targetSuiteId,
        cases: totalCases,
        requirements: totalReqs,
        approvedCount: totalApproved,
        notApprovedCount: totalNotApproved,
        approvalPct,
        linkedRequirements: linkedReqs,
        linkedPct,
        verifiedRequirements: verifiedReqs,
        verifiedPct,
        byType,
        byPriority,
        requirementsBySource,
        gaps,
        rulesChecked: [
            'single_test_requirement',
            'no_negative_or_security_test',
            'unlinked_test_case',
            'review_backlog',
            'missing_priority'
        ],
        checkedAt: new Date().toISOString(),
        suites: sortedSuites,
        updatedAt: latestUpdated
    };
};

const syncVerificationFromRuns = async (suiteId = 'all', userId = null) => {
    return getQualityMetrics({ suiteId, userId });
};

module.exports = {
    getQualityMetrics,
    syncVerificationFromRuns,
    getCaseApprovalStatus,
    normalizeTestType,
    normalizeTestPriority,
    extractNormalizedRequirements
};
