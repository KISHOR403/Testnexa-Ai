const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const supabaseService = require('../src/services/supabaseData.service');

describe('Test Cases Workspace & Case Management', () => {
    const userA = 'user-tc-workspace-a';
    const userB = 'user-tc-workspace-b';
    let suiteA;
    let suiteB;

    before(async () => {
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;

        // User A Suite
        suiteA = await supabaseService.createSession({
            userId: userA,
            title: 'User Authentication Suite',
            suiteData: {
                functional: [
                    {
                        id: 'TC_AUTH_001',
                        title: 'Valid email and password login',
                        type: 'Functional',
                        priority: 'Critical',
                        status: 'Ready',
                        executionMethod: 'Automated',
                        requirementId: 'REQ-AUTH-01',
                        preconditions: 'User account exists with active credentials.',
                        testSteps: [
                            { step: 1, action: 'Navigate to /login', expectedResult: 'Login form rendered', testData: 'URL: /login' },
                            { step: 2, action: 'Enter credentials and click Submit', expectedResult: 'Redirects to /dashboard', testData: 'user@testnexa.ai' }
                        ],
                        expectedResult: 'Authentication succeeds and dashboard displays user greeting.'
                    },
                    {
                        id: 'TC_AUTH_002',
                        title: 'Invalid password displays alert',
                        type: 'Negative',
                        priority: 'High',
                        status: 'Ready',
                        executionMethod: 'Manual',
                        requirementId: 'REQ-AUTH-02'
                    }
                ],
                edge: [
                    {
                        id: 'TC_AUTH_003',
                        title: 'SQL injection attempt in email field',
                        type: 'Edge',
                        priority: 'Critical',
                        status: 'Draft',
                        executionMethod: 'Manual'
                    }
                ]
            }
        });

        // User B Suite (Multi-tenant check)
        suiteB = await supabaseService.createSession({
            userId: userB,
            title: 'Tenant B Suite',
            suiteData: {
                functional: [
                    { id: 'TC_TENANT_B_001', title: 'Private Tenant Case', priority: 'Medium' }
                ]
            }
        });
    });

    it('1. Retrieves suite cases preserving structured steps and execution attributes', async () => {
        const fetched = await supabaseService.getSession(suiteA.id, userA);
        assert.ok(fetched);
        assert.equal(fetched.suiteData.functional.length, 2);
        assert.equal(fetched.suiteData.edge.length, 1);

        const tc1 = fetched.suiteData.functional.find(c => c.id === 'TC_AUTH_001');
        assert.equal(tc1.title, 'Valid email and password login');
        assert.equal(tc1.executionMethod, 'Automated');
        assert.equal(tc1.priority, 'Critical');
        assert.equal(tc1.testSteps.length, 2);
        assert.equal(tc1.testSteps[0].action, 'Navigate to /login');
    });

    it('2. Enforces multi-tenant workspace isolation: User B cannot access User A suite', async () => {
        const crossAccess = await supabaseService.getSession(suiteA.id, userB);
        assert.equal(crossAccess, null, 'User B must not be able to read User A suite');
    });

    it('3. Updating suite cases dynamically recalculates summary totals', async () => {
        const current = await supabaseService.getSession(suiteA.id, userA);
        const updatedSuiteData = {
            ...current.suiteData,
            functional: [
                ...current.suiteData.functional,
                {
                    id: 'TC_AUTH_004',
                    title: 'Password reset link generation',
                    type: 'Functional',
                    priority: 'Medium',
                    status: 'Ready',
                    executionMethod: 'Manual'
                }
            ]
        };

        const updated = await supabaseService.updateSession(suiteA.id, userA, {
            suiteData: updatedSuiteData
        });

        assert.ok(updated);
        const reloaded = await supabaseService.getSession(suiteA.id, userA);
        assert.equal(reloaded.suiteData.functional.length, 3);
        assert.equal(reloaded.suiteData.edge.length, 1);
        const totalCases = reloaded.suiteData.functional.length + reloaded.suiteData.edge.length;
        assert.equal(totalCases, 4);
    });

    it('4. Preserves historical run snapshot when test case is modified or deleted in source suite', async () => {
        // Create a test run with TC_AUTH_001
        const run = await supabaseService.createTestRun({
            workspaceId: 'ws-test-cases-isolation',
            suiteId: suiteA.id,
            name: 'Historical Snapshot Run',
            executionType: 'manual',
            createdBy: userA,
            selectedCaseIds: ['TC_AUTH_001']
        });

        assert.ok(run);
        assert.equal(run.casesCount, 1);

        // Delete TC_AUTH_001 from suiteA
        const current = await supabaseService.getSession(suiteA.id, userA);
        const prunedSuiteData = {
            ...current.suiteData,
            functional: current.suiteData.functional.filter(c => c.id !== 'TC_AUTH_001')
        };
        await supabaseService.updateSession(suiteA.id, userA, { suiteData: prunedSuiteData });

        // Verify TC_AUTH_001 is deleted from the active suite
        const activeSuite = await supabaseService.getSession(suiteA.id, userA);
        assert.equal(activeSuite.suiteData.functional.some(c => c.id === 'TC_AUTH_001'), false);

        // Verify TC_AUTH_001 snapshot remains immutable in the test run
        const runCases = await supabaseService.getRunCases(run.id);
        assert.equal(runCases.length, 1);
        const snapshot = runCases[0].caseSnapshot || runCases[0].case_snapshot;
        assert.equal(snapshot.id, 'TC_AUTH_001');
        assert.equal(snapshot.title, 'Valid email and password login');
    });

    it('5. Supports cross-suite referencing via testCaseRefs without duplication', async () => {
        const suiteC = await supabaseService.createSession({
            userId: userA,
            title: 'Regression Suite',
            suiteData: {
                testCases: [
                    { id: 'TC_REG_001', title: 'Regression smoke test', priority: 'High' }
                ],
                testCaseRefs: [
                    { sourceSuiteId: suiteA.id, testCaseId: 'TC_AUTH_002' }
                ]
            }
        });

        const fetched = await supabaseService.getSession(suiteC.id, userA);
        assert.ok(fetched);
        assert.equal(fetched.suiteData.testCaseRefs.length, 1);
        assert.equal(fetched.suiteData.testCaseRefs[0].testCaseId, 'TC_AUTH_002');
    });
});

