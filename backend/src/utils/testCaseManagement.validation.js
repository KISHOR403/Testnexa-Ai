const SUITE_CASE_KEYS = ['testCases', 'tests', 'functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist', 'api'];
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

module.exports = { validateTestCaseMutation };
