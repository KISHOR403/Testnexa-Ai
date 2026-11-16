const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');
const {
    SUITE_CASE_KEYS,
    CATEGORY_LABELS,
    unwrapSuiteData,
    isValidGeneratedTestCase,
    isEligibleGeneratedSuite,
    extractValidTestCasesFromSession,
    validateTestCaseMutation
} = require('../utils/testCaseManagement.validation');

/**
 * Controller for Genuine Generated Test Cases.
 * Enforces strict lifecycle rules:
 * - Requirement drafts, unsubmitted inputs, and incomplete jobs are strictly excluded.
 * - Test cases must have valid structured fields and non-empty IDs.
 * - Successfully generated test cases appear even when Not Executed.
 * - Execution status is independent and never automatically set to Passed.
 */

const getLatestExecutionsMap = async (workspaceId, userId) => {
    const execMap = {};
    try {
        const runsResult = await supabaseService.listTestRuns({
            workspaceId: workspaceId || null,
            userId: userId || null,
            page: 1,
            limit: 100,
            sort: 'newest'
        }).catch(() => ({ runs: [] }));

        const runs = runsResult.runs || [];
        for (const run of runs.slice(0, 30)) {
            const suiteId = String(run.suiteId || run.suite_id || '');
            const runDetail = await supabaseService.getTestRunById(run.id).catch(() => null);
            const cases = runDetail?.cases || run.cases || [];
            if (Array.isArray(cases)) {
                for (const c of cases) {
                    const cid = String(c.testCaseId || c.caseSnapshot?.id || '');
                    if (cid && suiteId) {
                        const key = `${suiteId}:${cid}`;
                        const executedAt = run.completedAt || run.startedAt || run.createdAt;
                        const rawStatus = String(c.status || 'not_executed').toLowerCase();
                        const normalizedStatus = rawStatus === 'not_run' ? 'not_executed' : rawStatus;
                        if (!execMap[key] || new Date(executedAt) > new Date(execMap[key].executedAt)) {
                            execMap[key] = {
                                status: normalizedStatus,
                                runId: run.id,
                                runName: run.name || `Run #${run.id.slice(-6)}`,
                                executedAt,
                                durationMs: c.durationMs || 0
                            };
                        }
                    }
                }
            }
        }
    } catch (err) {
        logger.warn('Non-fatal: could not resolve latest executions map:', err.message);
    }
    return execMap;
};

/**
 * LIST valid generated test cases for the authenticated user
 * GET /api/v1/test-cases
 */
const listTestCases = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const {
            suiteId,
            search,
            status,
            lifecycle,
            priority,
            type,
            method,
            executionStatus,
            page = 1,
            limit = 25,
            sort = 'updatedAt'
        } = req.query;

        // 1. Fetch user's test suite sessions
        const sessionRes = await supabaseService.listSessions({
            userId,
            page: 1,
            limit: 200,
            status: 'all'
        });

        const rawSessions = sessionRes.sessions || [];
        const allSessionsMap = new Map(rawSessions.map(s => [String(s.id || s._id), s]));

        // 2. Filter to only eligible test suites that have actually generated and persisted test cases
        // Excludes drafts, unsubmitted input, processing jobs, and failed generation records
        const eligibleSessions = rawSessions.filter(s => isEligibleGeneratedSuite(s));

        // 3. Resolve latest execution outcomes
        const execMap = await getLatestExecutionsMap(null, userId);

        // 4. Extract valid structured test cases from eligible suites
        const allCases = [];
        const suiteDescriptors = [];

        eligibleSessions.forEach(session => {
            const sid = String(session.id || session._id);
            const suiteCases = extractValidTestCasesFromSession(session, allSessionsMap);

            if (suiteCases.length === 0) return; // Disqualify if no valid cases extracted

            // Attach execution statuses
            suiteCases.forEach(tc => {
                const directKey = `${tc.suiteId}:${tc.id}`;
                const sourceKey = tc.sourceSuiteId ? `${tc.sourceSuiteId}:${tc.id}` : null;
                const match = execMap[directKey] || (sourceKey ? execMap[sourceKey] : null);

                if (match) {
                    tc.executionStatus = match.status;
                    tc.latestExecution = match;
                } else {
                    // Mandatory rule: freshly generated test case defaults strictly to not_executed
                    tc.executionStatus = 'not_executed';
                    tc.latestExecution = null;
                }
            });

            allCases.push(...suiteCases);

            // Calculate suite-level metrics for navigation
            const categoryBreakdown = {};
            let archivedCount = 0;
            suiteCases.forEach(tc => {
                const label = tc.type || 'Functional';
                categoryBreakdown[label] = (categoryBreakdown[label] || 0) + 1;
                if (tc.lifecycle === 'archived') archivedCount += 1;
            });

            suiteDescriptors.push({
                id: sid,
                name: session.title || session.feature || 'Untitled Suite',
                project: session.projectName || 'Default Project',
                context: (session.context || 'web').toLowerCase(),
                caseCount: suiteCases.length,
                activeCount: Math.max(0, suiteCases.length - archivedCount),
                archivedCount,
                categoryBreakdown: Object.entries(categoryBreakdown).map(([label, count]) => ({ label, count })),
                updatedAt: session.updatedAt || session.created_at || new Date().toISOString()
            });
        });

        // 5. Build global summary metrics from the genuine test cases
        const summary = {
            total: allCases.length,
            ready: allCases.filter(c => c.lifecycle === 'ready').length,
            needsReview: allCases.filter(c => c.lifecycle === 'needs-review').length,
            draft: allCases.filter(c => c.lifecycle === 'draft').length,
            archived: allCases.filter(c => c.lifecycle === 'archived').length,
            notExecuted: allCases.filter(c => c.executionStatus === 'not_executed').length,
            passed: allCases.filter(c => c.executionStatus === 'passed').length,
            failed: allCases.filter(c => c.executionStatus === 'failed').length,
            blocked: allCases.filter(c => c.executionStatus === 'blocked').length,
            skipped: allCases.filter(c => c.executionStatus === 'skipped').length,
            categories: {}
        };
        allCases.forEach(c => {
            const cat = c.type || 'Functional';
            summary.categories[cat] = (summary.categories[cat] || 0) + 1;
        });

        // 6. Apply server-side query filters
        let filtered = [...allCases];

        if (suiteId && suiteId.trim()) {
            filtered = filtered.filter(c => c.suiteId === String(suiteId.trim()));
        }

        const filterStatus = (lifecycle || status || '').toLowerCase().trim();
        if (filterStatus) {
            if (filterStatus === 'all') {
                filtered = filtered.filter(c => c.lifecycle !== 'archived');
            } else if (filterStatus === 'ready') {
                filtered = filtered.filter(c => c.lifecycle === 'ready');
            } else if (filterStatus === 'needs-review' || filterStatus === 'needs_review') {
                filtered = filtered.filter(c => c.lifecycle === 'needs-review');
            } else if (filterStatus === 'draft') {
                filtered = filtered.filter(c => c.lifecycle === 'draft');
            } else if (filterStatus === 'archived') {
                filtered = filtered.filter(c => c.lifecycle === 'archived');
            }
        }

        if (priority && priority.trim()) {
            filtered = filtered.filter(c => String(c.priority).toLowerCase() === priority.trim().toLowerCase());
        }

        if (type && type.trim()) {
            filtered = filtered.filter(c => String(c.type).toLowerCase() === type.trim().toLowerCase());
        }

        if (method && method.trim()) {
            filtered = filtered.filter(c => String(c.method).toLowerCase() === method.trim().toLowerCase());
        }

        if (executionStatus && executionStatus.trim()) {
            filtered = filtered.filter(c => String(c.executionStatus).toLowerCase() === executionStatus.trim().toLowerCase());
        }

        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(c =>
                c.id.toLowerCase().includes(q) ||
                c.title.toLowerCase().includes(q) ||
                (c.description && c.description.toLowerCase().includes(q)) ||
                (c.expectedResult && c.expectedResult.toLowerCase().includes(q)) ||
                (c.requirementId && c.requirementId.toLowerCase().includes(q))
            );
        }

        // 7. Sort
        if (sort === 'title') {
            filtered.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sort === 'id') {
            filtered.sort((a, b) => a.id.localeCompare(b.id));
        } else {
            filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        }

        // 8. Server-side pagination
        const p = Math.max(1, parseInt(page, 10) || 1);
        const l = Math.min(Math.max(1, parseInt(limit, 10) || 25), 500);
        const total = filtered.length;
        const totalPages = Math.ceil(total / l) || 1;
        const from = (p - 1) * l;
        const pagedData = filtered.slice(from, from + l);

        return res.json({
            success: true,
            data: pagedData,
            suites: suiteDescriptors,
            pagination: {
                page: p,
                limit: l,
                total,
                totalPages
            },
            summary
        });
    } catch (err) {
        logger.error('Error listing test cases:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET a single genuine test case by ID
 * GET /api/v1/test-cases/:id
 */
const getTestCaseById = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { id } = req.params;
        const { suiteId } = req.query;

        if (!id) {
            return res.status(400).json({ success: false, message: 'Test case ID is required.' });
        }

        const sessionRes = await supabaseService.listSessions({
            userId,
            page: 1,
            limit: 200,
            status: 'all'
        });

        const rawSessions = sessionRes.sessions || [];
        const allSessionsMap = new Map(rawSessions.map(s => [String(s.id || s._id), s]));
        const eligibleSessions = rawSessions.filter(s => isEligibleGeneratedSuite(s));

        for (const session of eligibleSessions) {
            if (suiteId && String(session.id || session._id) !== String(suiteId)) {
                continue;
            }
            const cases = extractValidTestCasesFromSession(session, allSessionsMap);
            const found = cases.find(c => c.id === id);
            if (found) {
                const execMap = await getLatestExecutionsMap(null, userId);
                const match = execMap[`${found.suiteId}:${found.id}`];
                if (match) {
                    found.executionStatus = match.status;
                    found.latestExecution = match;
                } else {
                    found.executionStatus = 'not_executed';
                    found.latestExecution = null;
                }
                return res.json({ success: true, data: found });
            }
        }

        return res.status(404).json({ success: false, message: `Test case ${id} not found.` });
    } catch (err) {
        logger.error('Error retrieving test case:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    listTestCases,
    getTestCaseById
};
