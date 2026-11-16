/**
 * Test Suites Selector & Normalization Utilities
 * Strict Black-and-White Theme & Single Source of Truth
 */

const CASE_KEYS = [
    'testCases',
    'tests',
    'functional',
    'negative',
    'edge',
    'security',
    'nonFunctional',
    'apiChecklist',
    'api'
];

/**
 * Unwrap nested suite data structures from various database formats
 */
export const unwrapSuiteData = (record) => {
    const value = record?.suiteData || record?.suite_data || record?.suite || record?.data || {};
    return value?.suiteData || value?.suite_data || value?.data || value;
};

/**
 * Extract all unique test cases from a suite data object, resolving testCaseRefs
 */
export const extractSuiteCases = (data, recordsById = new Map()) => {
    const source = CASE_KEYS.flatMap(key => (Array.isArray(data?.[key]) ? data[key] : []));

    if (Array.isArray(data?.testCaseRefs)) {
        data.testCaseRefs.forEach(ref => {
            const sourceRecord = recordsById.get(String(ref.sourceSuiteId || ''));
            const sourceData = unwrapSuiteData(sourceRecord);
            const linked = CASE_KEYS.flatMap(key => (Array.isArray(sourceData?.[key]) ? sourceData[key] : []))
                .find(testCase => String(testCase?.id || testCase?.testCaseId || '') === String(ref.testCaseId || ''));
            if (linked) source.push(linked);
        });
    }

    const seen = new Set();
    return source.filter((item, index) => {
        if (!item || typeof item !== 'object') return false;
        const id = String(item.id || item.testCaseId || `${item.title || item.testScenario || 'case'}-${index}`);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

/**
 * Determine the primary platform/context tag for a suite
 */
export const resolvePlatform = (data, record) => {
    const rawContext = String(data?.context || record?.context || '').toLowerCase();
    const tags = Array.isArray(data?.tags) ? data.tags.map(t => String(t).toLowerCase()) : [];

    if (rawContext.includes('api') || tags.some(t => t.includes('api') || t.includes('backend') || t.includes('rest') || t.includes('graphql'))) {
        return 'API';
    }
    if (rawContext.includes('mobile') || tags.some(t => t.includes('mobile') || t.includes('ios') || t.includes('android'))) {
        return 'Mobile';
    }
    return 'Web';
};

/**
 * Normalize a single session record into a unified Test Suite model
 */
export const normalizeSuite = (record, runs = [], recordsById = new Map()) => {
    const data = unwrapSuiteData(record);
    const suiteId = String(record?.id || record?._id || record?.sessionId || '');
    const tests = extractSuiteCases(data, recordsById);
    const platform = resolvePlatform(data, record);

    // Filter matching execution runs for this suite
    const suiteRuns = runs.filter(run => String(run.suiteId || run.suite_id || '') === suiteId);
    
    // Most recent run
    const sortedRuns = [...suiteRuns].sort((a, b) => {
        const dateA = new Date(a.completedAt || a.completed_at || a.startedAt || a.started_at || a.createdAt || a.created_at || 0);
        const dateB = new Date(b.completedAt || b.completed_at || b.startedAt || b.started_at || b.createdAt || b.created_at || 0);
        return dateB - dateA;
    });
    const lastRunObj = sortedRuns[0] || null;

    const rawStatus = String(record?.status || data?.suiteStatus || '').trim();
    const isArchived = rawStatus.toLowerCase() === 'archived';

    let resolvedStatus = 'Active';
    if (isArchived) {
        resolvedStatus = 'Archived';
    } else if (rawStatus.toLowerCase() === 'draft') {
        resolvedStatus = 'Draft';
    } else if (rawStatus.toLowerCase() === 'failed') {
        resolvedStatus = 'Failed';
    }

    // Approved cases calculation
    const approvedCount = tests.filter(test => {
        const status = String(test?.status || test?.approvalStatus || '').toLowerCase();
        return status === 'approved' || status === 'completed' || test?.isApproved === true || test?.approved === true;
    }).length;

    // Execution mix: manual vs automated
    const automatedCount = tests.filter(test => {
        const method = String(test?.executionType || test?.executionMethod || test?.method || '').toLowerCase();
        return Boolean(test?.automationMapping || test?.playwrightBinding || test?.isAutomated || ['automated', 'automation', 'playwright'].includes(method));
    }).length;
    const manualCount = Math.max(0, tests.length - automatedCount);

    return {
        id: suiteId,
        rawId: suiteId,
        name: record?.title || record?.feature || data?.testSuiteName || data?.feature || 'Untitled suite',
        description: data?.description || record?.requirement || record?.rawRequirement || '',
        project: data?.projectName || data?.project || '',
        tags: Array.isArray(data?.tags) ? data.tags : [],
        platform,
        tests,
        totalCases: tests.length,
        approvedCases: approvedCount,
        manualCases: manualCount,
        automatedCases: automatedCount,
        runs: suiteRuns,
        lastRun: lastRunObj ? {
            id: String(lastRunObj.id || lastRunObj._id || ''),
            date: lastRunObj.completedAt || lastRunObj.completed_at || lastRunObj.startedAt || lastRunObj.started_at || lastRunObj.createdAt || lastRunObj.created_at,
            status: String(lastRunObj.status || 'completed').toLowerCase(),
            passed: lastRunObj.passedCount || lastRunObj.summary?.passed || 0,
            failed: lastRunObj.failedCount || lastRunObj.summary?.failed || 0
        } : null,
        status: resolvedStatus,
        archived: isArchived,
        updatedAt: record?.updatedAt || record?.updated_at || record?.createdAt || record?.created_at || null,
        createdAt: record?.createdAt || record?.created_at || null,
        data,
        record
    };
};

/**
 * Single source of truth selector for all header and overview stats
 */
export const computeSuiteMetrics = (suites = []) => {
    const totalSuites = suites.length;
    const activeSuites = suites.filter(s => s.status === 'Active' && !s.archived).length;
    const draftSuites = suites.filter(s => s.status === 'Draft').length;
    const archivedSuites = suites.filter(s => s.archived || s.status === 'Archived').length;
    const totalCases = suites.reduce((sum, s) => sum + s.totalCases, 0);
    const approvedCases = suites.reduce((sum, s) => sum + s.approvedCases, 0);
    const suitesWithRuns = suites.filter(s => s.runs.length > 0).length;

    return {
        all: totalSuites,
        active: activeSuites,
        draft: draftSuites,
        archived: archivedSuites,
        cases: totalCases,
        approved: approvedCases,
        withRuns: suitesWithRuns
    };
};

/**
 * Filter and sort suites deterministically
 */
export const filterAndSortSuites = (
    suites = [],
    { query = '', statusFilter = 'all', platformFilter = 'all', sort = 'updated_desc' } = {}
) => {
    const text = query.trim().toLowerCase();

    const filtered = suites.filter(suite => {
        // Text search covers: name, id, description, project, tags
        if (text) {
            const haystack = `${suite.name} ${suite.id} ${suite.description} ${suite.project} ${suite.tags.join(' ')}`.toLowerCase();
            if (!haystack.includes(text)) {
                return false;
            }
        }

        // Status filter
        if (statusFilter === 'active') {
            if (suite.status !== 'Active' || suite.archived) return false;
        } else if (statusFilter === 'draft') {
            if (suite.status !== 'Draft') return false;
        } else if (statusFilter === 'archived') {
            if (!suite.archived && suite.status !== 'Archived') return false;
        } else if (statusFilter === 'withCases') {
            if (suite.totalCases === 0) return false;
        } else if (statusFilter === 'withRuns') {
            if (suite.runs.length === 0) return false;
        }

        // Platform filter
        if (platformFilter !== 'all') {
            if (suite.platform.toLowerCase() !== platformFilter.toLowerCase()) {
                return false;
            }
        }

        return true;
    });

    // Sort order
    return filtered.sort((a, b) => {
        switch (sort) {
            case 'name_asc':
            case 'name':
                return a.name.localeCompare(b.name);
            case 'name_desc':
                return b.name.localeCompare(a.name);
            case 'cases_asc':
                return a.totalCases - b.totalCases;
            case 'cases_desc':
                return b.totalCases - a.totalCases;
            case 'last_run_asc': {
                const dateA = a.lastRun?.date ? new Date(a.lastRun.date).getTime() : 0;
                const dateB = b.lastRun?.date ? new Date(b.lastRun.date).getTime() : 0;
                return dateA - dateB;
            }
            case 'last_run_desc': {
                const dateA = a.lastRun?.date ? new Date(a.lastRun.date).getTime() : 0;
                const dateB = b.lastRun?.date ? new Date(b.lastRun.date).getTime() : 0;
                return dateB - dateA;
            }
            case 'status_asc':
            case 'status':
                return a.status.localeCompare(b.status);
            case 'status_desc':
                return b.status.localeCompare(a.status);
            case 'updated_asc':
                return new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
            case 'updated_desc':
            case 'updated':
            default:
                return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        }
    });
};

/**
 * Paginates an array of suites
 */
export const paginateSuites = (suites = [], page = 1, pageSize = 25) => {
    const totalCount = suites.length;
    const validPageSize = Math.max(1, pageSize);
    const totalPages = Math.max(1, Math.ceil(totalCount / validPageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const startIndex = (currentPage - 1) * validPageSize;
    const endIndex = Math.min(startIndex + validPageSize, totalCount);
    const rows = suites.slice(startIndex, endIndex);

    return {
        rows,
        page: currentPage,
        pageSize: validPageSize,
        totalPages,
        totalCount,
        startIndex: totalCount > 0 ? startIndex + 1 : 0,
        endIndex
    };
};
