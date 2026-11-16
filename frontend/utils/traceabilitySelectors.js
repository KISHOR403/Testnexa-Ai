/**
 * Traceability & Requirement Coverage Selectors
 * Strict Black-and-White Theme & Single Source of Truth
 */

import {
    unwrapSuiteData,
    extractSuiteCases,
    resolvePlatform,
    sanitizeCredentialPlaceholders
} from './testSuiteSelectors.js';

const EXECUTED_STATUSES = new Set(['passed', 'failed', 'blocked', 'skipped', 'timed_out', 'infrastructure_error']);

/**
 * Extracts and synthesizes requirements from a suite record and its test cases.
 */
export const extractRequirements = (suiteOrRecord, testCases = []) => {
    const data = unwrapSuiteData(suiteOrRecord);
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
    const rawReqs = data?.requirements || data?.understanding?.functional_requirements || data?.traceability?.matrix;
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
                const cid = String(tc.id || tc.testCaseId);
                if (cid && !req.explicitCaseRefs.includes(cid)) {
                    req.explicitCaseRefs.push(cid);
                }
            }
        }
    });

    // 3. Fallback: If still zero requirements, synthesize from suite requirement text
    if (requirementsMap.size === 0) {
        const reqText = (suiteOrRecord?.requirement || suiteOrRecord?.rawRequirement || data?.requirement || data?.feature || '').trim();
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
 * Builds canonical requirement rows with linked test details and outcomes
 */
export const buildTraceabilityRows = (requirements = [], testCases = [], execMap = new Map()) => {
    return requirements.map(req => {
        const reqId = String(req.id || req.key);
        const explicitRefs = new Set((req.explicitCaseRefs || []).map(String));

        // Find all test cases that link to this requirement
        const linkedCases = testCases.filter(tc => {
            const cid = String(tc.id || tc.testCaseId);
            const tcReq = String(tc.requirementId || tc.reqId || tc.requirementRef || '');
            return (tcReq && tcReq === reqId) || explicitRefs.has(cid);
        });

        const linkedTests = linkedCases.map(tc => {
            const cid = String(tc.id || tc.testCaseId);
            const exec = execMap.get(cid);
            const rawStatus = (exec?.status || (tc.executionStatus === 'executed' ? 'passed' : 'not_run')).toLowerCase();
            const status = rawStatus === 'not_executed' ? 'not_run' : rawStatus;

            return {
                id: cid,
                testCaseId: cid,
                title: tc.title || tc.testScenario || tc.scenario || '',
                category: tc.type || tc.category || 'Functional',
                priority: tc.priority || 'Medium',
                severity: tc.severity || 'Major',
                executionType: tc.executionType || tc.method || 'manual',
                approvalStatus: tc.lifecycle || tc.status || 'ready',
                status,
                durationMs: exec?.durationMs || 0,
                executedAt: exec?.executedAt || null,
                actualResult: exec?.actualResult || '',
                rationale: tc.reason || tc.priorityExplanation || tc.priority_rationale || tc.description || 'Validates requirement specification.'
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
 * Single source of truth summary metrics calculator
 * 5 Mutually Exclusive Status Buckets:
 * Total === Verified + Partial + Failing + Unverified + Uncovered
 * Linked % and Verified % are distinct metrics.
 */
export const computeTraceabilitySummary = (rows = []) => {
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
        // Backward-compatibility aliases
        covered: linked,
        coveragePercent: linkedPercent
    };
};

/**
 * Computes actionable coverage gaps from rows and test cases
 */
export const computeTraceabilityGaps = (rows = [], testCases = []) => {
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

    const linkedTestIds = new Set(rows.flatMap(r => r.linkedTests.map(t => String(t.testCaseId))));
    const unlinkedTestsCount = testCases.filter(tc => !linkedTestIds.has(String(tc.id || tc.testCaseId))).length;

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

    return gaps;
};

/**
 * Filter and sort requirements rows without mutating summary counts
 */
export const filterRequirements = (
    rows = [],
    { query = '', statusFilter = 'all', priorityFilter = 'all', sort = 'id_asc' } = {}
) => {
    const text = query.trim().toLowerCase();

    const filtered = rows.filter(r => {
        if (text) {
            const haystack = `${r.id} ${r.title} ${r.description} ${r.category}`.toLowerCase();
            if (!haystack.includes(text)) return false;
        }

        if (statusFilter !== 'all') {
            if (statusFilter === 'covered') {
                if (r.linkedCount === 0) return false;
            } else if (r.status !== statusFilter) {
                return false;
            }
        }

        if (priorityFilter !== 'all') {
            if ((r.priority || '').toLowerCase() !== priorityFilter.toLowerCase()) {
                return false;
            }
        }

        return true;
    });

    return filtered.sort((a, b) => {
        switch (sort) {
            case 'id_desc':
                return b.id.localeCompare(a.id);
            case 'title_asc':
                return a.title.localeCompare(b.title);
            case 'title_desc':
                return b.title.localeCompare(a.title);
            case 'priority_desc': {
                const weights = { critical: 4, high: 3, medium: 2, low: 1 };
                return (weights[b.priority.toLowerCase()] || 0) - (weights[a.priority.toLowerCase()] || 0);
            }
            case 'priority_asc': {
                const weights = { critical: 4, high: 3, medium: 2, low: 1 };
                return (weights[a.priority.toLowerCase()] || 0) - (weights[b.priority.toLowerCase()] || 0);
            }
            case 'linked_desc':
                return b.linkedCount - a.linkedCount;
            case 'linked_asc':
                return a.linkedCount - b.linkedCount;
            case 'id_asc':
            default:
                return a.id.localeCompare(b.id);
        }
    });
};

/**
 * Builds the matrix structure for Table | Matrix toggle view
 */
export const buildTraceabilityMatrix = (rows = [], testCases = []) => {
    const requirementHeaders = rows.map(r => ({
        id: r.id,
        key: r.key,
        title: r.title,
        priority: r.priority,
        category: r.category,
        status: r.status,
        linkedCount: r.linkedCount
    }));

    const testCaseHeaders = testCases.map(tc => ({
        id: String(tc.id || tc.testCaseId),
        title: tc.title || tc.testScenario || '',
        type: tc.type || 'Functional',
        priority: tc.priority || 'Medium',
        executionStatus: tc.executionStatus || 'not_run'
    }));

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

    return {
        requirements: requirementHeaders,
        testCases: testCaseHeaders,
        cells
    };
};

/**
 * Format CSV report export
 */
export const formatTraceabilityCsv = (rows = []) => {
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

    return lines.join('\n');
};
