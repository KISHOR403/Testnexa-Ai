const supabaseService = require('../services/supabaseData.service');
const traceabilityService = require('../services/traceability.service');
const logger = require('../utils/logger');
const {
    SUITE_CASE_KEYS,
    CATEGORY_LABELS,
    unwrapSuiteData,
    isValidGeneratedTestCase,
    isEligibleGeneratedSuite,
    extractValidTestCasesFromSession
} = require('../utils/testCaseManagement.validation');

/**
 * Controller for Traceability & Requirement Coverage
 * Single source of truth for:
 * - /api/v1/traceability/suites
 * - /api/v1/traceability/summary
 * - /api/v1/traceability/gaps
 * - /api/v1/traceability/matrix
 * - /api/v1/traceability/requirements
 * - /api/v1/traceability/export/:format
 */

const { getCaseApprovalStatus } = require('../services/qualityMetrics.service');

const EXECUTED_STATUSES = new Set(['passed', 'failed', 'blocked', 'skipped', 'timed_out', 'infrastructure_error']);

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
    } catch {
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
    testCases.forEach((tc, idx) => {
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
        }).catch(() => ({ runs: [] }));

        const runs = runsResult.runs || [];
        for (const run of runs) {
            const runCases = run.cases || [];
            for (const c of runCases) {
                const cid = String(c.testCaseId || c.caseSnapshot?.id || '');
                if (cid && !execMap.has(cid)) {
                    execMap.set(cid, {
                        status: String(c.status || 'not_run').toLowerCase(),
                        durationMs: Number(c.durationMs || 0),
                        executedAt: run.completedAt || run.startedAt || run.createdAt,
                        runId: run.id,
                        runName: run.name || `Run #${String(run.id).slice(-6)}`,
                        actualResult: c.actualResult || c.error || ''
                    });
                }
            }
        }
    } catch (err) {
        logger.warn('Failed to fetch test runs for traceability:', err.message);
    }
    return execMap;
};

/**
 * Build canonical requirement rows with linked test details and status
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
                approvalStatus: getCaseApprovalStatus(tc),
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
 * GET /api/v1/traceability/suites
 * List all eligible test suites with platform and counts
 */
exports.listSuites = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const result = await supabaseService.listSessions({
            userId,
            page: 1,
            limit: 100,
            hasCases: true
        });

        const eligible = (result.sessions || []).filter(isEligibleGeneratedSuite);
        const allSessionsMap = new Map();
        (result.sessions || []).forEach(s => allSessionsMap.set(String(s.id || s._id), s));

        const suites = eligible.map(session => {
            const sid = String(session.id || session._id);
            const suite = unwrapSuiteData(session);
            const testCases = getTestCasesForSession(session, allSessionsMap);
            const requirements = extractRequirementsFromSession(session, testCases);
            const coveredReqs = requirements.filter(r => {
                const reqId = String(r.id || r.key);
                const explicit = new Set((r.explicitCaseRefs || []).map(String));
                return testCases.some(tc => String(tc.requirementId || tc.reqId || '') === reqId || explicit.has(String(tc.id)));
            });

            const context = String(session.context || suite.context || 'web').toLowerCase();
            let platform = 'Web';
            if (context.includes('api')) platform = 'API';
            else if (context.includes('mobile')) platform = 'Mobile';

            return {
                id: sid,
                sessionId: sid,
                title: session.title || session.feature || suite.testSuiteName || 'Test Suite',
                platform,
                totalCases: testCases.length,
                requirementsCount: requirements.length,
                coveredRequirementsCount: coveredReqs.length,
                updatedAt: session.updatedAt || session.updated_at || session.createdAt,
                createdAt: session.createdAt || session.created_at
            };
        });

        return res.json({ success: true, data: suites });
    } catch (error) {
        logger.error('Error in listSuites:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Resolve session by suiteId or load all suites
 */
const resolveTargetSessions = async (suiteId, userId) => {
    if (suiteId && suiteId !== 'all') {
        const session = await supabaseService.getSession(suiteId, userId);
        return session ? [session] : [];
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
 * GET /api/v1/traceability/summary
 */
exports.getSummary = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const suiteId = req.query.suite || req.query.suiteId;
        const summary = await traceabilityService.getTraceabilitySummary(suiteId, userId);

        return res.json({
            success: true,
            data: {
                suiteId: summary.suiteId,
                total: summary.total,
                verified: summary.verified,
                partial: summary.partial,
                failing: summary.failing,
                unverified: summary.unverified,
                uncovered: summary.uncovered,
                linked: summary.linked,
                linkedPercent: summary.linkedPercent,
                verifiedPercent: summary.verifiedPercent,
                covered: summary.covered,
                coveragePercent: summary.coveragePercent,
                updatedAt: summary.updatedAt
            }
        });
    } catch (error) {
        logger.error('Error in getSummary:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/traceability/gaps
 */
exports.getGaps = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const suiteId = req.query.suite || req.query.suiteId;
        const sessions = await resolveTargetSessions(suiteId, userId);

        if (sessions.length === 0) {
            return res.json({ success: true, data: { gaps: [] } });
        }

        const allSessionsMap = await getAllSessionsMap(userId);
        const allCases = sessions.flatMap(s => getTestCasesForSession(s, allSessionsMap));
        const allReqs = sessions.flatMap(s => extractRequirementsFromSession(s, getTestCasesForSession(s, allSessionsMap)));
        const execMap = await getExecutionStatusMap(suiteId !== 'all' ? suiteId : null, userId);
        const rows = buildTraceabilityRows(allReqs, allCases, execMap);

        const uncoveredCount = rows.filter(r => r.status === 'uncovered').length;
        const failingCount = rows.filter(r => r.status === 'failing').length;
        const unverifiedCount = rows.filter(r => r.status === 'unverified').length;

        // Requirements with only 1 test on high/critical priority
        const singleTestReqs = rows.filter(r => r.linkedCount === 1 && ['high', 'critical'].includes((r.priority || '').toLowerCase()));

        // Missing negative or security coverage on high/critical priority
        const missingNegOrSecReqs = rows.filter(r => {
            if (!['high', 'critical'].includes((r.priority || '').toLowerCase())) return false;
            if (r.linkedCount === 0) return false;
            const hasNegOrSec = r.linkedTests.some(t => {
                const cat = (t.category || t.type || '').toLowerCase();
                return cat.includes('negative') || cat.includes('security');
            });
            return !hasNegOrSec;
        });

        // Tests with no requirement linked
        const linkedTestIds = new Set(rows.flatMap(r => r.linkedTests.map(t => String(t.testCaseId))));
        const unlinkedTestsCount = allCases.filter(tc => !linkedTestIds.has(String(tc.id))).length;

        const gaps = [];
        if (uncoveredCount > 0) {
            gaps.push({
                type: 'uncovered',
                count: uncoveredCount,
                message: `${uncoveredCount} requirement${uncoveredCount > 1 ? 's have' : ' has'} no tests`,
                action: 'Generate tests'
            });
        }
        if (singleTestReqs.length > 0) {
            gaps.push({
                type: 'single_test',
                count: singleTestReqs.length,
                message: `${singleTestReqs.length} high-priority requirement${singleTestReqs.length > 1 ? 's have' : ' has'} only 1 test`,
                action: 'Review'
            });
        }
        if (missingNegOrSecReqs.length > 0) {
            gaps.push({
                type: 'missing_negative_or_security',
                count: missingNegOrSecReqs.length,
                message: `${missingNegOrSecReqs.length} high-priority requirement${missingNegOrSecReqs.length > 1 ? 's lack' : ' lacks'} negative or security coverage`,
                action: 'Add tests'
            });
        }
        if (unlinkedTestsCount > 0) {
            gaps.push({
                type: 'unlinked_tests',
                count: unlinkedTestsCount,
                message: `${unlinkedTestsCount} test${unlinkedTestsCount > 1 ? 's have' : ' has'} no requirement`,
                action: 'Link'
            });
        }
        if (failingCount > 0) {
            gaps.push({
                type: 'failing',
                count: failingCount,
                message: `${failingCount} requirement${failingCount > 1 ? 's have' : ' has'} failing tests`,
                action: 'Open'
            });
        }
        if (unverifiedCount > 0) {
            gaps.push({
                type: 'unverified',
                count: unverifiedCount,
                message: `${unverifiedCount} requirement${unverifiedCount > 1 ? 's need' : ' needs'} verification`,
                action: 'Run tests'
            });
        }

        return res.json({
            success: true,
            data: {
                suiteId: suiteId || (sessions.length === 1 ? sessions[0].id : 'all'),
                gaps
            }
        });
    } catch (error) {
        logger.error('Error in getGaps:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/traceability/requirements
 */
exports.getRequirements = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const suiteId = req.query.suite || req.query.suiteId;
        const sessions = await resolveTargetSessions(suiteId, userId);

        if (sessions.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const allSessionsMap = await getAllSessionsMap(userId);
        const allCases = sessions.flatMap(s => getTestCasesForSession(s, allSessionsMap));
        const allReqs = sessions.flatMap(s => extractRequirementsFromSession(s, getTestCasesForSession(s, allSessionsMap)));
        const execMap = await getExecutionStatusMap(suiteId !== 'all' ? suiteId : null, userId);
        const rows = buildTraceabilityRows(allReqs, allCases, execMap);

        return res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Error in getRequirements:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/traceability/matrix
 */
exports.getMatrix = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const suiteId = req.query.suite || req.query.suiteId;
        const sessions = await resolveTargetSessions(suiteId, userId);

        if (sessions.length === 0) {
            return res.json({
                success: true,
                data: {
                    requirements: [],
                    testCases: [],
                    cells: {}
                }
            });
        }

        const allSessionsMap = await getAllSessionsMap(userId);
        const allCases = sessions.flatMap(s => getTestCasesForSession(s, allSessionsMap));
        const allReqs = sessions.flatMap(s => extractRequirementsFromSession(s, getTestCasesForSession(s, allSessionsMap)));
        const execMap = await getExecutionStatusMap(suiteId !== 'all' ? suiteId : null, userId);
        const rows = buildTraceabilityRows(allReqs, allCases, execMap);

        // Group test cases by category/type
        const testCaseHeaders = allCases.map(tc => {
            const cid = String(tc.id);
            const exec = execMap.get(cid);
            return {
                id: cid,
                title: tc.title || tc.testScenario || '',
                type: tc.type || 'Functional',
                priority: tc.priority || 'Medium',
                executionStatus: exec?.status || 'not_run'
            };
        });

        // Cells mapping: [reqId][testCaseId] = { linked, status, rationale }
        const cells = {};
        rows.forEach(r => {
            const reqKey = String(r.id || r.key);
            cells[reqKey] = {};
            const linkedMap = new Map(r.linkedTests.map(t => [String(t.testCaseId), t]));

            testCaseHeaders.forEach(tc => {
                const tcId = String(tc.id);
                if (linkedMap.has(tcId)) {
                    const linked = linkedMap.get(tcId);
                    cells[reqKey][tcId] = {
                        linked: true,
                        status: linked.status || 'not_run',
                        rationale: linked.rationale || 'Linked requirement validation'
                    };
                } else {
                    cells[reqKey][tcId] = {
                        linked: false,
                        status: 'none',
                        rationale: ''
                    };
                }
            });
        });

        return res.json({
            success: true,
            data: {
                suiteId: suiteId || (sessions.length === 1 ? sessions[0].id : 'all'),
                requirements: rows.map(r => ({
                    id: r.id,
                    key: r.key,
                    title: r.title,
                    priority: r.priority,
                    category: r.category,
                    status: r.status,
                    linkedCount: r.linkedCount
                })),
                testCases: testCaseHeaders,
                cells
            }
        });
    } catch (error) {
        logger.error('Error in getMatrix:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/traceability/export/:format
 */
exports.exportReport = async (req, res) => {
    try {
        const { format } = req.params;
        const userId = req.user?._id || req.user?.id;
        const suiteId = req.query.suite || req.query.suiteId;
        const sessions = await resolveTargetSessions(suiteId, userId);

        if (sessions.length === 0) {
            return res.status(404).json({ success: false, message: 'No requirements data found to export.' });
        }

        const allSessionsMap = await getAllSessionsMap(userId);
        const allCases = sessions.flatMap(s => getTestCasesForSession(s, allSessionsMap));
        const allReqs = sessions.flatMap(s => extractRequirementsFromSession(s, getTestCasesForSession(s, allSessionsMap)));
        const execMap = await getExecutionStatusMap(suiteId !== 'all' ? suiteId : null, userId);
        const rows = buildTraceabilityRows(allReqs, allCases, execMap);

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="traceability-report-${Date.now()}.json"`);
            return res.json({
                generatedAt: new Date().toISOString(),
                suiteId: suiteId || 'all',
                totalRequirements: rows.length,
                requirements: rows
            });
        }

        if (format === 'csv') {
            const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
            const headers = ['Requirement ID', 'Requirement Title', 'Priority', 'Category', 'Status', 'Linked Tests Count', 'Linked Test IDs', 'Executed Count', 'Passed Count', 'Failed Count', 'Last Run'];
            const lines = [headers.join(',')];

            rows.forEach(r => {
                lines.push([
                    escapeCsv(r.id),
                    escapeCsv(r.title),
                    escapeCsv(r.priority),
                    escapeCsv(r.category),
                    escapeCsv(r.status),
                    r.linkedCount,
                    escapeCsv(r.linkedTests.map(t => t.testCaseId).join('; ')),
                    r.executedCount,
                    r.passedCount,
                    r.failedCount,
                    escapeCsv(r.lastRun || 'Never')
                ].join(','));
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="traceability-report-${Date.now()}.csv"`);
            return res.send(lines.join('\n'));
        }

        return res.status(400).json({ success: false, message: `Unsupported export format: ${format}` });
    } catch (error) {
        logger.error('Error in exportReport:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/v1/traceability/requirements/:id
 * Updates requirement title, description, or priority, setting source = 'manual' and recording an audit trail entry.
 */
exports.updateRequirement = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, priority, suiteId } = req.body;
        const userId = req.user?._id || req.user?.id;

        if (!id) {
            return res.status(400).json({ success: false, message: 'Requirement ID is required.' });
        }
        if (!suiteId) {
            return res.status(400).json({ success: false, message: 'Suite ID is required.' });
        }

        const session = await supabaseService.getSession(suiteId, userId);
        if (!session) {
            return res.status(404).json({ success: false, message: 'Suite not found.' });
        }

        const suiteData = unwrapSuiteData(session) || {};
        let requirements = Array.isArray(suiteData.requirements) ? [...suiteData.requirements] : [];

        // If suite.requirements was empty, synthesize existing
        if (requirements.length === 0) {
            const allSessionsMap = await getAllSessionsMap(userId);
            const testCases = getTestCasesForSession(session, allSessionsMap);
            requirements = extractRequirementsFromSession(session, testCases);
        }

        let targetReq = requirements.find(r => String(r.id) === String(id) || String(r.key) === String(id));
        const originalValues = targetReq ? { ...targetReq } : null;

        if (!targetReq) {
            targetReq = {
                id,
                key: id,
                title: title || `Requirement ${id}`,
                description: description || title || '',
                priority: priority || 'Medium',
                category: 'Functional',
                source: 'manual',
                updatedAt: new Date().toISOString()
            };
            requirements.push(targetReq);
        } else {
            if (title !== undefined) targetReq.title = String(title).trim();
            if (description !== undefined) targetReq.description = String(description).trim();
            if (priority !== undefined) targetReq.priority = String(priority).trim();
            targetReq.source = 'manual';
            targetReq.updatedAt = new Date().toISOString();
        }

        // Persist update in session suiteData
        const updatedSuiteData = {
            ...suiteData,
            requirements
        };

        await supabaseService.updateSession(session.id || session._id, userId, {
            suiteData: updatedSuiteData,
            updatedAt: new Date().toISOString()
        });

        // Record audit event
        try {
            await supabaseService.saveAuditEvent({
                id: 'audit_req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                orgId: session.orgId || session.workspaceId || 'workspace_default',
                actorId: userId || 'anonymous',
                action: 'requirement_updated',
                resourceType: 'requirement',
                resourceId: id,
                details: {
                    suiteId,
                    requirementId: id,
                    previous: originalValues,
                    updated: targetReq,
                    source: 'manual'
                },
                timestamp: new Date().toISOString()
            });
        } catch (auditErr) {
            logger.warn('Failed to record audit event for requirement update:', auditErr.message);
        }

        return res.json({
            success: true,
            data: targetReq
        });
    } catch (error) {
        logger.error('Error in updateRequirement:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
