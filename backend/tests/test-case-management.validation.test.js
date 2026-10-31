const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTestCaseMutation } = require('../src/utils/testCaseManagement.validation');

const baseSuite = () => ({
    requirements: [{ id: 'REQ-1', description: 'Login works' }],
    functional: [{ id: 'TC-1', title: 'Existing test', requirementId: 'REQ-1' }]
});

test('test case create accepts a unique ID with an existing requirement link', () => {
    const previousSuiteData = baseSuite();
    const suiteData = { ...previousSuiteData, functional: [...previousSuiteData.functional, { id: 'TC-2', title: 'New test', requirementId: 'REQ-1' }] };
    assert.deepEqual(validateTestCaseMutation({ previousSuiteData, suiteData, mutation: { action: 'create', testCaseId: 'TC-2' } }), { valid: true });
});

test('test case create rejects a duplicate ID', () => {
    const previousSuiteData = baseSuite();
    const suiteData = { ...previousSuiteData, functional: [...previousSuiteData.functional, { id: 'TC-1', title: 'Duplicate' }] };
    assert.equal(validateTestCaseMutation({ previousSuiteData, suiteData, mutation: { action: 'create', testCaseId: 'TC-1' } }).status, 409);
});

test('test case create rejects a requirement that is not in the suite', () => {
    const previousSuiteData = baseSuite();
    const suiteData = { ...previousSuiteData, functional: [...previousSuiteData.functional, { id: 'TC-2', title: 'New test', requirementId: 'REQ-UNKNOWN' }] };
    assert.equal(validateTestCaseMutation({ previousSuiteData, suiteData, mutation: { action: 'create', testCaseId: 'TC-2' } }).status, 400);
});

test('test case deletion validates removal while retaining historical records outside suite data', () => {
    const previousSuiteData = baseSuite();
    const suiteData = { ...previousSuiteData, functional: [] };
    assert.deepEqual(validateTestCaseMutation({ previousSuiteData, suiteData, mutation: { action: 'delete', testCaseId: 'TC-1' } }), { valid: true });
});
