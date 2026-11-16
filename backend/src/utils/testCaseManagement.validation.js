const SUITE_CASE_KEYS = ['testCases', 'tests', 'functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist', 'api'];
const CATEGORY_LABELS = {
    testCases: 'Functional',
    tests: 'Functional',
    functional: 'Functional',
    negative: 'Negative',
    edge: 'Edge',
    security: 'Security',
    nonFunctional: 'Non-functional',
    apiChecklist: 'API',
    api: 'API'
};
const REQUIREMENT_PATHS = [
    ['understanding', 'functional_requirements'],
    ['requirements'],
    ['traceability', 'matrix']
];

const unwrapSuiteData = (value) => value?.suiteData || value?.suite_data || value?.data || value?.suite || value || {};
const readPath = (object, path) => path.reduce((value, key) => value?.[key], object);
const collectCases = (suiteData) => {
    const suite = unwrapSuiteData(suiteData);
    return SUITE_CASE_KEYS.flatMap(category => (Array.isArray(suite?.[category]) ? suite[category] : []).map(testCase => ({ category, testCase })));
};
const caseId = (testCase) => String(testCase?.id || testCase?.testCaseId || '');
const caseRequirementId = (testCase) => String(testCase?.requirementId || testCase?.requirementRef || testCase?.reqId || '');
const requirementIds = (suiteData) => {
    const suite = unwrapSuiteData(suiteData);
    const ids = new Set();
    REQUIREMENT_PATHS.forEach(path => {
        const source = readPath(suite, path);
        if (Array.isArray(source)) source.forEach(item => {
            const id = item && typeof item === 'object' ? (item.id || item.reqId || item.requirementId) : '';
            if (id) ids.add(String(id));
        });
        else if (source && typeof source === 'object') Object.entries(source).forEach(([key, value]) => {
            const id = value && typeof value === 'object' ? (value.id || value.reqId || value.requirementId || key) : key;
            if (id) ids.add(String(id));
        });
    });
    return ids;
};

/**
 * Validates whether an individual test case record is a genuine, properly structured test case.
 * Disqualifies drafts, empty objects, placeholders, and temporary incomplete records.
 */
const isValidGeneratedTestCase = (tc) => {
    if (!tc || typeof tc !== 'object' || Array.isArray(tc)) return false;

    // Must have a valid, non-empty, non-placeholder ID
    const id = String(tc.id || tc.testCaseId || '').trim();
    if (!id || id.length < 2) return false;
    const lowerId = id.toLowerCase();
    if (['placeholder', 'temp', 'draft', 'null', 'undefined', 'none', 'n/a', 'tc_temp', 'tc_placeholder', '0'].includes(lowerId)) {
        return false;
    }

    // Must have a valid, non-empty, non-placeholder title or scenario
    const title = String(tc.title || tc.testScenario || tc.scenario || '').trim();
    if (!title || title.length < 3) return false;
    const lowerTitle = title.toLowerCase();
    if (['untitled', 'placeholder', 'draft', 'temp', 'scenario', 'test scenario', 'null', 'undefined', 'n/a'].includes(lowerTitle)) {
        return false;
    }

    // Must contain test structure: steps, expected result, preconditions, or scenario description
    const hasSteps = (Array.isArray(tc.steps) && tc.steps.length > 0) || (Array.isArray(tc.testSteps) && tc.testSteps.length > 0);
    const hasExpected = Boolean(tc.expectedResult || tc.expected);
    const hasPreconditions = Array.isArray(tc.preconditions) ? tc.preconditions.length > 0 : Boolean(tc.preconditions);
    const hasDescription = Boolean(tc.description || tc.testDescription);

    if (!hasSteps && !hasExpected && !hasPreconditions && !hasDescription) {
        return false;
    }

    return true;
};

/**
 * Determines whether a workspace session is an eligible test suite containing actual generated/persisted cases.
 * Excludes requirement drafts, unsubmitted inputs, incomplete generation jobs, and failed generation records.
 */
const isEligibleGeneratedSuite = (session) => {
    if (!session || typeof session !== 'object') return false;

    // Incomplete, processing, queued, or failed generation jobs are strictly excluded
    const status = String(session.status || '').toLowerCase().trim();
    if (['processing', 'generating', 'queued', 'pending_generation', 'failed'].includes(status)) {
        return false;
    }

    // Must have non-empty suite data
    const suite = unwrapSuiteData(session);
    if (!suite || typeof suite !== 'object' || Object.keys(suite).length === 0) {
        return false;
    }

    // If marked as 'draft' and summary total is 0 with no valid cases, it is purely a requirement draft
    let validCaseFound = false;
    for (const key of SUITE_CASE_KEYS) {
        const arr = suite[key];
        if (Array.isArray(arr)) {
            for (const tc of arr) {
                if (isValidGeneratedTestCase(tc)) {
                    validCaseFound = true;
                    break;
                }
            }
        }
        if (validCaseFound) break;
    }

    if (!validCaseFound && Array.isArray(suite.testCaseRefs) && suite.testCaseRefs.length > 0) {
        validCaseFound = true;
    }

    return validCaseFound;
};

const getMethod = (tc) => {
    const method = String(tc?.executionType || tc?.executionMethod || tc?.method || '').toLowerCase();
    if (method) return ['automated', 'automation', 'playwright'].includes(method) ? 'automated' : 'manual';
    const mapping = tc?.automationMapping || tc?.playwrightBinding || {};
    const configured = ['configured', 'enabled', 'ready'].includes(String(mapping.mappingStatus || mapping.status || '').toLowerCase());
    const hasCodeOrRef = Boolean(mapping.scriptCode || mapping.code || mapping.spec || mapping.script || mapping.scriptRef || mapping.testId || mapping.automationTestId);
    return tc?.isAutomated || (configured && hasCodeOrRef) ? 'automated' : 'manual';
};

const getLifecycle = (tc) => {
    if (tc?.archivedAt) return 'archived';
    const explicit = String(tc?.lifecycle || tc?.lifecycleStatus || tc?.reviewStatus || '').toLowerCase().trim();
    if (explicit === 'draft') return 'draft';
    if (['needs-review', 'needs_review', 'review'].includes(explicit)) return 'needs-review';
    if (explicit === 'archived') return 'archived';
    if (['ready', 'approved'].includes(explicit)) return 'ready';

    if (tc?.is_approved === false || tc?.approved === false || tc?.isApproved === false) return 'needs-review';
    if (tc?.is_approved === true || tc?.approved === true || tc?.isApproved === true) return 'ready';

    const status = String(tc?.status || '').toLowerCase().replaceAll('_', ' ').trim();
    if (status === 'archived') return 'archived';
    if (status === 'draft') return 'draft';
    if (['needs review', 'needs-review', 'review', 'generated', 'pending'].includes(status)) return 'needs-review';
    if (['ready', 'approved', 'active'].includes(status)) return 'ready';

    return 'ready';
};

/**
 * Extracts and formats all valid generated test cases from an eligible session.
 */
const extractValidTestCasesFromSession = (session, allSessionsMap = new Map()) => {
    if (!isEligibleGeneratedSuite(session)) return [];

    const suite = unwrapSuiteData(session);
    const sid = String(session.id || session._id || '');
    const suiteName = session.title || session.feature || suite.testSuiteName || suite.feature || 'Untitled Suite';
    const projectName = session.projectName || suite.projectName || suite.project || 'Default Project';
    const context = (session.context || suite.context || 'web').toLowerCase();
    const seenIds = new Set();
    const cases = [];

    // 1. Direct suite test cases
    for (const category of SUITE_CASE_KEYS) {
        const list = Array.isArray(suite[category]) ? suite[category] : [];
        list.forEach((tc, idx) => {
            if (!isValidGeneratedTestCase(tc)) return;
            const cid = String(tc.id || tc.testCaseId).trim();
            if (seenIds.has(cid)) return;
            seenIds.add(cid);

            cases.push({
                key: `${sid}:${category}:${cid}`,
                id: cid,
                title: tc.title || tc.testScenario || tc.scenario,
                description: tc.description || tc.testDescription || '',
                preconditions: Array.isArray(tc.preconditions) ? tc.preconditions : (tc.preconditions ? [tc.preconditions] : []),
                steps: Array.isArray(tc.steps) ? tc.steps : (Array.isArray(tc.testSteps) ? tc.testSteps : []),
                expectedResult: tc.expectedResult || tc.expected || '',
                priority: tc.priority || 'Medium',
                severity: tc.severity || 'Major',
                type: tc.type || CATEGORY_LABELS[category] || 'Functional',
                category,
                method: getMethod(tc),
                lifecycle: getLifecycle(tc),
                is_approved: getLifecycle(tc) === 'ready',
                status: tc.status || '',
                executionStatus: 'not_executed',
                requirementId: String(tc.requirementId || tc.requirementRef || tc.reqId || ''),
                automationMapping: tc.automationMapping || tc.playwrightBinding || null,
                updatedAt: tc.updatedAt || tc.updated_at || session.updatedAt || session.updated_at || new Date().toISOString(),
                createdAt: tc.createdAt || tc.created_at || session.createdAt || session.created_at || new Date().toISOString(),
                sourceIndex: idx,
                raw: tc,
                suiteId: sid,
                suiteName,
                projectName,
                context,
                isReference: false
            });
        });
    }

    // 2. Cross-suite references
    if (Array.isArray(suite.testCaseRefs)) {
        for (const ref of suite.testCaseRefs) {
            const srcSession = allSessionsMap.get(String(ref.sourceSuiteId));
            if (!srcSession || !isEligibleGeneratedSuite(srcSession)) continue;
            const srcSuite = unwrapSuiteData(srcSession);
            let matchedCase = null;
            for (const cat of SUITE_CASE_KEYS) {
                const arr = Array.isArray(srcSuite[cat]) ? srcSuite[cat] : [];
                matchedCase = arr.find(c => String(c.id || c.testCaseId) === String(ref.testCaseId));
                if (matchedCase) break;
            }
            if (!matchedCase || !isValidGeneratedTestCase(matchedCase)) continue;
            const cid = String(matchedCase.id || matchedCase.testCaseId).trim();
            if (seenIds.has(cid)) continue;
            seenIds.add(cid);

            cases.push({
                key: `${sid}:ref:${cid}`,
                id: cid,
                title: matchedCase.title || matchedCase.testScenario || matchedCase.scenario,
                description: matchedCase.description || matchedCase.testDescription || '',
                preconditions: Array.isArray(matchedCase.preconditions) ? matchedCase.preconditions : [],
                steps: Array.isArray(matchedCase.steps) ? matchedCase.steps : [],
                expectedResult: matchedCase.expectedResult || matchedCase.expected || '',
                priority: matchedCase.priority || 'Medium',
                severity: matchedCase.severity || 'Major',
                type: matchedCase.type || 'Functional',
                category: 'referenced',
                method: getMethod(matchedCase),
                lifecycle: getLifecycle(matchedCase),
                status: matchedCase.status || '',
                executionStatus: 'not_executed',
                requirementId: String(matchedCase.requirementId || ''),
                automationMapping: matchedCase.automationMapping || null,
                updatedAt: matchedCase.updatedAt || session.updatedAt || new Date().toISOString(),
                createdAt: matchedCase.createdAt || session.createdAt || new Date().toISOString(),
                sourceIndex: -1,
                raw: matchedCase,
                suiteId: sid,
                suiteName,
                projectName,
                context,
                isReference: true,
                sourceSuiteId: String(ref.sourceSuiteId),
                sourceSuiteName: srcSession.title || 'Source suite'
            });
        }
    }

    return cases;
};

const extractValidTestCasesFromSessions = (sessions = []) => {
    const sessionMap = new Map(sessions.map(s => [String(s.id || s._id), s]));
    return sessions.flatMap(s => extractValidTestCasesFromSession(s, sessionMap));
};

const validateTestCaseMutation = ({ previousSuiteData, suiteData, mutation } = {}) => {
    if (!mutation || typeof mutation !== 'object') return { valid: false, status: 400, message: 'Test case mutation details are required.' };
    const action = String(mutation.action || '').toLowerCase();
    const id = String(mutation.testCaseId || '');
    const previousId = String(mutation.previousTestCaseId || '');
    if (!['create', 'update', 'delete'].includes(action)) return { valid: false, status: 400, message: 'Unsupported test case mutation.' };
    const before = collectCases(previousSuiteData);
    const after = collectCases(suiteData);

    if (action === 'create') {
        if (!id) return { valid: false, status: 400, message: 'A test case ID is required.' };
        if (before.some(item => caseId(item.testCase) === id)) return { valid: false, status: 409, message: `Test case ID ${id} already exists in this suite.` };
        if (after.filter(item => caseId(item.testCase) === id).length !== 1) return { valid: false, status: 400, message: 'The new test case must appear exactly once in the suite.' };
    }

    if (action === 'update' && id) {
        const beforeId = previousId || id;
        if (previousId && before.filter(item => caseId(item.testCase) === beforeId).length !== 1) return { valid: false, status: 409, message: 'The test case changed before this update. Refresh and try again.' };
        if (!previousId && before.some(item => caseId(item.testCase) === id)) return { valid: false, status: 409, message: `Test case ID ${id} already exists in this suite.` };
        if (after.filter(item => caseId(item.testCase) === id).length !== 1) return { valid: false, status: 400, message: 'The updated test case must appear exactly once in the suite.' };
        if (previousId && previousId !== id && after.some(item => caseId(item.testCase) === previousId)) return { valid: false, status: 400, message: 'The previous test case ID must be removed when an ID changes.' };
    }

    if (action === 'delete' && id) {
        if (before.filter(item => caseId(item.testCase) === id).length !== 1) return { valid: false, status: 404, message: 'Test case not found in this suite.' };
        if (after.some(item => caseId(item.testCase) === id)) return { valid: false, status: 400, message: 'The deleted test case is still present in the suite.' };
    }

    if (action !== 'delete' && id) {
        const nextCase = after.find(item => caseId(item.testCase) === id)?.testCase;
        const nextRequirementId = caseRequirementId(nextCase);
        const previousCase = before.find(item => caseId(item.testCase) === (previousId || id))?.testCase;
        const oldRequirementId = caseRequirementId(previousCase);
        if (nextRequirementId && nextRequirementId !== oldRequirementId && !requirementIds(suiteData).has(nextRequirementId)) {
            return { valid: false, status: 400, message: `Requirement ${nextRequirementId} is not part of this suite.` };
        }
    }

    return { valid: true };
};

/**
 * Sanitizes test data and preconditions to replace realistic credentials,
 * passwords, and cards with standardized placeholders.
 */
const sanitizeCredentialPlaceholders = (value) => {
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

const SEVERITY_ALLOWLIST = ['Critical', 'Major', 'Minor', 'Trivial'];

/**
 * Validates that test case ID prefix, type, and title agree according to schema rules.
 * Enforces severity allow-list and repairs mismatches.
 * Sanitizes credentials to use placeholders.
 */
const validateAndRepairTestCase = (tc, fallbackCategory = 'Functional') => {
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

    // 4. Ensure requirement link and rationale exist
    if (!repaired.rationale) {
        repaired.rationale = repaired.reason || repaired.priorityExplanation || repaired.priority_rationale || `Verifies ${canonicalType} specifications for ${title || id}.`;
    }

    return repaired;
};

module.exports = {
    SUITE_CASE_KEYS,
    CATEGORY_LABELS,
    SEVERITY_ALLOWLIST,
    unwrapSuiteData,
    collectCases,
    caseId,
    caseRequirementId,
    requirementIds,
    isValidGeneratedTestCase,
    isEligibleGeneratedSuite,
    getMethod,
    getLifecycle,
    extractValidTestCasesFromSession,
    extractValidTestCasesFromSessions,
    validateTestCaseMutation,
    sanitizeCredentialPlaceholders,
    validateAndRepairTestCase
};
