import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    extractRequirements,
    buildTraceabilityRows,
    computeTraceabilitySummary,
    computeTraceabilityGaps,
    filterRequirements,
    buildTraceabilityMatrix,
    formatTraceabilityCsv
} from '../../frontend/utils/traceabilitySelectors.js';

describe('Traceability Selectors & Data Consistency', () => {

    // Mock suite with 19 cases and 5 linked requirements (matching real workspace suite)
    const mockCases = Array.from({ length: 19 }, (_, i) => ({
        id: `TC_FUNC_AUTH_${String(i + 1).padStart(3, '0')}`,
        title: `Auth Flow Scenario ${i + 1}`,
        type: i < 12 ? 'Functional' : i < 16 ? 'Negative' : 'Edge Case',
        priority: i < 5 ? 'High' : 'Medium',
        requirementId: i < 5 ? `REQ_AUTH_00${i + 1}` : undefined,
        reason: `Validates authentication rule ${i + 1}`
    }));

    const mockSuiteRecord = {
        id: 'sess_auth_test_123',
        title: 'User Authentication Suite',
        rawRequirement: 'User login with SSO, multi-factor auth, and session recovery',
        context: 'web',
        suiteData: {
            testCases: mockCases
        }
    };

    it('extracts all 5 requirements referenced by test cases when suite.requirements is empty', () => {
        const reqs = extractRequirements(mockSuiteRecord, mockCases);
        assert.equal(reqs.length, 5, 'Should synthesize exactly 5 requirements from test cases');
        assert.equal(reqs[0].id, 'REQ_AUTH_001');
        assert.equal(reqs[4].id, 'REQ_AUTH_005');
    });

    it('computes canonical traceability rows where total, covered and unverified agree', () => {
        const reqs = extractRequirements(mockSuiteRecord, mockCases);
        const rows = buildTraceabilityRows(reqs, mockCases, new Map());

        assert.equal(rows.length, 5, 'Should have 5 requirement rows');
        rows.forEach(r => {
            assert.equal(r.linkedCount, 1, 'Each requirement should link to 1 test case');
            assert.equal(r.status, 'unverified', 'Status must be unverified when no runs executed');
            assert.equal(r.source, 'derived', 'Inferred requirements must have source = derived');
        });

        const summary = computeTraceabilitySummary(rows);
        assert.equal(summary.total, 5, 'Total requirements must be 5');
        assert.equal(summary.linked, 5, 'Linked requirements must be 5');
        assert.equal(summary.linkedPercent, 100, 'Linked percent must be 100%');
        assert.equal(summary.verifiedPercent, 0, 'Verified percent must be 0% when unexecuted');
        assert.equal(summary.uncovered, 0, 'Uncovered requirements must be 0');
        assert.equal(summary.unverified, 5, 'Unverified requirements must be 5');
        assert.equal(summary.failing, 0, 'Failing requirements must be 0');
        assert.equal(summary.verified, 0, 'Verified requirements must be 0');

        // Mathematical invariant: Total MUST equal the sum of the 5 mutually exclusive buckets!
        assert.equal(
            summary.total,
            summary.verified + summary.partial + summary.failing + summary.unverified + summary.uncovered,
            'The 5 status tiles must be mutually exclusive and sum exactly to total requirements'
        );
    });

    it('verifies execution outcomes correctly update requirement status to verified, failing, or partial', () => {
        const reqs = extractRequirements(mockSuiteRecord, mockCases);
        const execMap = new Map();

        // Mark REQ_AUTH_001 test case as passed
        execMap.set('TC_FUNC_AUTH_001', { status: 'passed', executedAt: new Date().toISOString() });
        // Mark REQ_AUTH_002 test case as failed
        execMap.set('TC_FUNC_AUTH_002', { status: 'failed', executedAt: new Date().toISOString() });

        const rows = buildTraceabilityRows(reqs, mockCases, execMap);
        assert.equal(rows[0].status, 'verified', 'REQ_AUTH_001 must be verified');
        assert.equal(rows[1].status, 'failing', 'REQ_AUTH_002 must be failing');
        assert.equal(rows[2].status, 'unverified', 'REQ_AUTH_003 must be unverified');

        const summary = computeTraceabilitySummary(rows);
        assert.equal(summary.verified, 1);
        assert.equal(summary.failing, 1);
        assert.equal(summary.unverified, 3);
        assert.equal(summary.linked, 5);
        assert.equal(summary.total, 5);
        assert.equal(summary.linkedPercent, 100);
        assert.equal(summary.verifiedPercent, 20); // 1 of 5 = 20%

        // Invariant holds
        assert.equal(
            summary.total,
            summary.verified + summary.partial + summary.failing + summary.unverified + summary.uncovered
        );
    });

    it('filters requirements without mutating the single-source summary object', () => {
        const reqs = extractRequirements(mockSuiteRecord, mockCases);
        const rows = buildTraceabilityRows(reqs, mockCases, new Map());
        const canonicalSummary = computeTraceabilitySummary(rows);

        // Filter by search query "001"
        const filtered = filterRequirements(rows, { query: '001' });
        assert.equal(filtered.length, 1, 'Only 1 row should match search query');
        assert.equal(filtered[0].id, 'REQ_AUTH_001');

        // Summary numbers MUST remain unchanged!
        assert.equal(canonicalSummary.total, 5, 'Summary total must remain 5 even when filtered');
        assert.equal(canonicalSummary.covered, 5, 'Summary covered must remain 5 even when filtered');
    });

    it('detects unlinked test cases and coverage gaps correctly', () => {
        const reqs = extractRequirements(mockSuiteRecord, mockCases);
        const rows = buildTraceabilityRows(reqs, mockCases, new Map());
        const gaps = computeTraceabilityGaps(rows, mockCases);

        // 19 cases total, 5 linked -> exactly 14 unlinked test cases!
        const unlinkedGap = gaps.find(g => g.type === 'unlinked_tests');
        assert.ok(unlinkedGap, 'Should identify unlinked test cases gap');
        assert.equal(unlinkedGap.count, 14, 'Should count exactly 14 unlinked test cases');
        assert.equal(unlinkedGap.message, '14 tests have no requirement');
    });

    it('builds matrix data with correct rows, columns, and cell symbols', () => {
        const reqs = extractRequirements(mockSuiteRecord, mockCases);
        const rows = buildTraceabilityRows(reqs, mockCases, new Map());
        const matrix = buildTraceabilityMatrix(rows, mockCases);

        assert.equal(matrix.requirements.length, 5, 'Matrix must have 5 requirement rows');
        assert.equal(matrix.testCases.length, 19, 'Matrix must have 19 test case columns');

        // Check cell (REQ_AUTH_001, TC_FUNC_AUTH_001) is linked
        const linkedCell = matrix.cells['REQ_AUTH_001']['TC_FUNC_AUTH_001'];
        assert.ok(linkedCell.linked, 'Should be linked');
        assert.equal(linkedCell.status, 'not_run');

        // Check cell (REQ_AUTH_001, TC_FUNC_AUTH_002) is NOT linked
        const unlinkedCell = matrix.cells['REQ_AUTH_001']['TC_FUNC_AUTH_002'];
        assert.equal(unlinkedCell.linked, false, 'Should not be linked');
    });

    it('generates valid CSV report export', () => {
        const reqs = extractRequirements(mockSuiteRecord, mockCases);
        const rows = buildTraceabilityRows(reqs, mockCases, new Map());
        const csv = formatTraceabilityCsv(rows);

        assert.ok(csv.includes('Requirement ID,Requirement Title'), 'CSV should contain header row');
        assert.ok(csv.includes('REQ_AUTH_001'), 'CSV should contain requirement ID');
        assert.ok(csv.includes('TC_FUNC_AUTH_001'), 'CSV should list linked test case ID');
    });
});
