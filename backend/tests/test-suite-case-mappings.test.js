const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const supabaseService = require('../src/services/supabaseData.service');

describe('suite case reference execution snapshots', () => {
    const userId = 'user-suite-mapping-test';
    let source;
    let target;

    before(async () => {
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;
        source = await supabaseService.createSession({
            userId,
            title: 'Source cases',
            suiteData: { functional: [{ id: 'TC_SOURCE_001', title: 'Referenced source case', priority: 'High', requirementId: 'REQ-1' }] }
        });
        target = await supabaseService.createSession({
            userId,
            title: 'Target suite',
            suiteData: {
                testCases: [{ id: 'TC_TARGET_001', title: 'Native suite case' }],
                testCaseRefs: [{ sourceSuiteId: source.id, testCaseId: 'TC_SOURCE_001' }]
            }
        });
    });

    it('resolves mapped cases into immutable run snapshots without duplicating source case records', async () => {
        const run = await supabaseService.createTestRun({
            workspaceId: 'ws-suite-mapping-test',
            suiteId: target.id,
            name: 'Suite mapping verification',
            executionType: 'manual',
            createdBy: userId,
            selectedCaseIds: ['TC_TARGET_001', 'TC_SOURCE_001']
        });
        assert.equal(run.casesCount, 2);
        const cases = await supabaseService.getRunCases(run.id);
        const snapshots = cases.map(testCase => testCase.caseSnapshot || testCase.case_snapshot);
        assert.deepEqual(new Set(snapshots.map(testCase => testCase.id)), new Set(['TC_TARGET_001', 'TC_SOURCE_001']));
        assert.equal(snapshots.find(testCase => testCase.id === 'TC_SOURCE_001').requirementId, 'REQ-1');
        const sourceAfterRun = await supabaseService.getSession(source.id, userId);
        assert.equal(sourceAfterRun.suiteData.functional.length, 1);
        assert.equal(sourceAfterRun.suiteData.functional[0].id, 'TC_SOURCE_001');
    });
});
