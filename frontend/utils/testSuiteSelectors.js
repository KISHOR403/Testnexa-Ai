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
 * Sanitizes test data and preconditions to replace realistic credentials,
 * passwords, and cards with standardized placeholders.
 */
export const sanitizeCredentialPlaceholders = (value) => {
    if (!value) return value;
    if (typeof value === 'string') {
        let str = value;
        // 1. Credit card numbers (13 to 16 digits, with optional spaces or dashes)
        str = str.replace(/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|(?:4[0-9]{3}|5[1-5][0-9]{2}|6011|7[0-9]{3})[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}|[0-9]{15,16})\b/g, '<mock_credit_card>');
        // 2. Realistic test passwords
        str = str.replace(/(password\s*(?:is|=|:)?\s*['"])(?:[^'"]+)(['"])/gi, "$1<valid_password>$2");
        str = str.replace(/SecurePass123!|ValidPass123!?|Pass123|Ab1@5678|Secret123!?|Password999!?/gi, '<valid_password>');
        str = str.replace(/WrongPass999!?|InvalidPass123!?/gi, '<invalid_password>');
        // 3. User emails in test scenarios
        str = str.replace(/[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|example\.com|mail\.com|test\.com|gmail\.com|corp\.io)/gi, '<test_user_email>');
        return str;
    }
    if (Array.isArray(value)) {
        return value.map(v => sanitizeCredentialPlaceholders(v));
    }
    if (typeof value === 'object') {
        const next = {};
        for (const [k, v] of Object.entries(value)) {
            next[k] = sanitizeCredentialPlaceholders(v);
        }
        return next;
    }
    return value;
};

export const SEVERITY_ALLOWLIST = ['Critical', 'Major', 'Minor', 'Trivial'];

/**
 * Validates that test case ID prefix, type, and title agree according to schema rules.
 * Enforces severity allow-list and repairs mismatches.
 * Sanitizes credentials to use placeholders.
 */
export const validateAndRepairTestCase = (tc, fallbackCategory = 'Functional') => {
    if (!tc || typeof tc !== 'object') return tc;

    const repaired = { ...tc };
    const id = String(repaired.id || repaired.testCaseId || '').trim();
    const title = String(repaired.title || repaired.testScenario || repaired.scenario || '').trim();

    // 1. Determine canonical type from ID prefix
    let canonicalType = repaired.type || fallbackCategory;
    if (/^TC[_-]?FUNC/i.test(id) || /(?:^|_)func(?:_|$)/i.test(id)) {
        canonicalType = 'Functional';
    } else if (/^TC[_-]?NEG/i.test(id) || /(?:^|_)neg(?:_|$)/i.test(id)) {
        canonicalType = 'Negative';
    } else if (/^TC[_-]?EDGE/i.test(id) || /(?:^|_)edge(?:_|$)/i.test(id)) {
        canonicalType = 'Edge Case';
    } else if (/^TC[_-]?SEC/i.test(id) || /(?:^|_)sec(?:_|$)/i.test(id)) {
        canonicalType = 'Security';
    } else if (/^TC[_-]?API/i.test(id) || /(?:^|_)api(?:_|$)/i.test(id)) {
        canonicalType = 'API';
    } else if (/^TC[_-]?NF/i.test(id) || /(?:^|_)nf(?:_|$)/i.test(id)) {
        canonicalType = 'Non-Functional';
    }

    // Happy-path functional flows must NOT be marked as Security
    if (/login|auth|sign\s*in/i.test(title) && /success|valid/i.test(title)) {
        if (/^TC[_-]?FUNC/i.test(id) || canonicalType === 'Functional') {
            canonicalType = 'Functional';
        }
    }

    repaired.type = canonicalType;

    // 2. Validate and repair severity against allow-list
    let rawSeverity = String(repaired.severity || '').trim();
    let normalizedSeverity = SEVERITY_ALLOWLIST.find(s => s.toLowerCase() === rawSeverity.toLowerCase());

    if (!normalizedSeverity) {
        const priority = String(repaired.priority || '').toLowerCase();
        if (canonicalType === 'Security' && (priority === 'high' || priority === 'critical')) {
            normalizedSeverity = 'Critical';
        } else if (priority === 'high' || priority === 'critical') {
            normalizedSeverity = 'Major';
        } else if (priority === 'low') {
            normalizedSeverity = 'Minor';
        } else {
            normalizedSeverity = 'Major';
        }
    }

    // Standard happy path functional scenarios must NOT be Critical
    if (canonicalType === 'Functional' && /success|valid credentials|happy path/i.test(title)) {
        if (normalizedSeverity === 'Critical') {
            normalizedSeverity = 'Major';
        }
    }

    repaired.severity = normalizedSeverity;

    // 3. Credential sanitization
    if (repaired.preconditions) {
        repaired.preconditions = sanitizeCredentialPlaceholders(repaired.preconditions);
    }
    if (repaired.testData) {
        repaired.testData = sanitizeCredentialPlaceholders(repaired.testData);
    }
    if (repaired.steps) {
        repaired.steps = sanitizeCredentialPlaceholders(repaired.steps);
    }
    if (repaired.expectedResult) {
        repaired.expectedResult = sanitizeCredentialPlaceholders(repaired.expectedResult);
    }

    return repaired;
};

/**
 * Unwrap nested suite data structures from various database formats
 */
export const unwrapSuiteData = (record) => {
    if (!record || typeof record !== 'object') return {};
    const wrapped = record.suiteData || record.suite_data || record.suite || record.data;
    if (wrapped && typeof wrapped === 'object') {
        return wrapped.suiteData || wrapped.suite_data || wrapped.data || wrapped;
    }
    return record;
};

/**
 * Extract all unique test cases from a suite data object, resolving testCaseRefs without duplicates
 */
export const extractSuiteCases = (data, recordsById = new Map()) => {
    if (!data || typeof data !== 'object') return [];

    let source = [];
    if (Array.isArray(data.testCases) && data.testCases.length > 0) {
        source = [...data.testCases];
    } else if (Array.isArray(data.tests) && data.tests.length > 0) {
        source = [...data.tests];
    } else {
        source = CASE_KEYS.slice(2).flatMap(key => (Array.isArray(data[key]) ? data[key] : []));
    }

    if (Array.isArray(data.testCaseRefs)) {
        data.testCaseRefs.forEach(ref => {
            const sourceRecord = recordsById.get(String(ref.sourceSuiteId || ''));
            const sourceData = unwrapSuiteData(sourceRecord);
            let candidates = [];
            if (Array.isArray(sourceData?.testCases) && sourceData.testCases.length > 0) {
                candidates = sourceData.testCases;
            } else if (Array.isArray(sourceData?.tests) && sourceData.tests.length > 0) {
                candidates = sourceData.tests;
            } else {
                candidates = CASE_KEYS.slice(2).flatMap(key => (Array.isArray(sourceData?.[key]) ? sourceData[key] : []));
            }
            const linked = candidates.find(testCase => String(testCase?.id || testCase?.testCaseId || '') === String(ref.testCaseId || ''));
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
    }).map((tc, idx) => validateAndRepairTestCase(tc, idx));
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
 * Determines if a test case is strictly approved
 * ONLY approval_status === 'approved' or explicit boolean true
 */
export const isTestCaseApproved = (test) => {
    if (!test) return false;
    const explicit = String(test?.approval_status || test?.approvalStatus || '').toLowerCase().trim();
    if (explicit === 'approved') return true;
    if (explicit === 'rejected' || explicit === 'pending') return false;
    if (test?.is_approved === true || test?.approved === true || test?.isApproved === true) return true;
    const status = String(test?.status || '').toLowerCase().trim();
    if (status === 'approved') return true;
    return false;
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

    // Approved cases calculation (strictly approval_status === 'approved')
    const approvedCount = tests.filter(isTestCaseApproved).length;

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
 * Queries only suites with at least one test case
 */
export const computeSuiteMetrics = (suites = []) => {
    const validSuites = suites.filter(s => (s.totalCases || s.tests?.length || 0) > 0);
    const totalSuites = validSuites.length;
    const activeSuites = validSuites.filter(s => s.status === 'Active' && !s.archived).length;
    const draftSuites = validSuites.filter(s => s.status === 'Draft').length;
    const archivedSuites = validSuites.filter(s => s.archived || s.status === 'Archived').length;
    const totalCases = validSuites.reduce((sum, s) => sum + s.totalCases, 0);
    const approvedCases = validSuites.reduce((sum, s) => sum + s.approvedCases, 0);
    const suitesWithRuns = validSuites.filter(s => s.runs.length > 0).length;

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
 * Filter and sort suites deterministically (strictly excludes zero-case suites)
 */
export const filterAndSortSuites = (
    suites = [],
    { query = '', statusFilter = 'all', platformFilter = 'all', sort = 'updated_desc' } = {}
) => {
    const text = query.trim().toLowerCase();

    const filtered = suites.filter(suite => {
        // Only suites with at least one test case
        if ((suite.totalCases || suite.tests?.length || 0) === 0) {
            return false;
        }

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

/**
 * Single source of truth calculation for a single test suite detail page.
 * Returns consistent canonical test cases, counts, and metrics used by
 * the page header, review progress, stats strip, card, tabs, and filters.
 */
export const computeCanonicalSuiteMetrics = (suiteOrRecord, runs = [], recordsById = new Map()) => {
    const data = unwrapSuiteData(suiteOrRecord);
    const suiteId = String(suiteOrRecord?.id || suiteOrRecord?._id || suiteOrRecord?.sessionId || data?.id || '');

    const tests = extractSuiteCases(data, recordsById);
    const totalCases = tests.length;

    const automatedCases = tests.filter(tc => {
        const method = String(tc?.executionType || tc?.executionMethod || tc?.method || '').toLowerCase();
        return Boolean(tc?.automationMapping || tc?.playwrightBinding || tc?.isAutomated || ['automated', 'automation', 'playwright'].includes(method));
    }).length;
    const manualCases = Math.max(0, totalCases - automatedCases);

    const approvedCases = tests.filter(isTestCaseApproved).length;

    const highPriorityCases = tests.filter(tc => {
        const p = String(tc?.priority || '').toLowerCase();
        return p === 'high' || p === 'critical';
    }).length;

    // Canonical requirement linkage calculation
    const suiteReqs = Array.isArray(data?.requirements) ? data.requirements : [];
    const declaredReqIds = suiteReqs.map((r, i) => String(typeof r === 'string' ? `REQ-${String(i + 1).padStart(3, '0')}` : (r?.id || r?.reqId || `REQ-${String(i + 1).padStart(3, '0')}`)));
    const taggedReqIds = tests.map(tc => String(tc.requirementId || tc.reqId || tc.requirementRef || '')).filter(Boolean);
    const allReqIdSet = new Set([...declaredReqIds, ...taggedReqIds]);
    const requirementsCount = allReqIdSet.size;

    const linkedReqIdSet = new Set(taggedReqIds);
    suiteReqs.forEach(r => {
        if (typeof r === 'object' && r) {
            const cases = r.testCaseIds || r.linkedCases || r.testCases || [];
            if (Array.isArray(cases) && cases.length > 0) {
                const id = String(r.id || r.reqId || '');
                if (id) linkedReqIdSet.add(id);
            }
        }
    });

    const linkedRequirements = Array.from(linkedReqIdSet);
    const linkedRequirementsCount = linkedRequirements.length;
    const coverage = requirementsCount > 0 ? Math.round((linkedRequirementsCount / requirementsCount) * 100) : (totalCases > 0 ? 100 : 0);

    const suiteRuns = Array.isArray(runs) ? runs.filter(r => String(r.suiteId || r.suite_id || '') === suiteId) : [];

    return {
        suiteId,
        tests,
        totalCases,
        manualCases,
        automatedCases,
        approvedCases,
        highPriorityCases,
        linkedRequirements,
        linkedRequirementsCount: linkedRequirements.length,
        runs: suiteRuns,
        runsCount: suiteRuns.length,
        coverage
    };
};
