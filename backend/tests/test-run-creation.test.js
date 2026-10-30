const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const executionController = require('../src/controllers/execution.controller');
const { saveArtifactBuffer, getArtifactBuffer } = require('../src/utils/artifactStorage');

// Mock Express req/res
const createMockRes = () => {
    const res = {
        statusCode: 200,
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        }
    };
    return res;
};

test('Milestone 2: Unified Test Run Creation, Snapshots & Isolation Suite', async (t) => {
    // Disable remote Supabase for fast deterministic unit test isolation
    supabaseService.workspacesTableAvailable = false;
    supabaseService.sessionsTableAvailable = false;
    supabaseService.executionTablesAvailable = false;

    const timestamp = Date.now();
    const userA = { id: `usr_exec_a_${timestamp}`, _id: `usr_exec_a_${timestamp}`, name: 'Tester Alice', email: `alice_${timestamp}@testnexa.ai` };
    const userB = { id: `usr_exec_b_${timestamp}`, _id: `usr_exec_b_${timestamp}`, name: 'Tester Bob', email: `bob_${timestamp}@testnexa.ai` };

    let workspaceA;
    let workspaceB;
    let suiteA;
    let runAId;
    let runCase1Id;

    await t.test('1. Setup: Initialize distinct workspaces for User A and User B', async () => {
        workspaceA = await supabaseService.getUserPrimaryWorkspace(userA.id, userA.name);
        workspaceB = await supabaseService.getUserPrimaryWorkspace(userB.id, userB.name);

        assert.ok(workspaceA && workspaceA.id, 'Workspace A must be initialized');
        assert.ok(workspaceB && workspaceB.id, 'Workspace B must be initialized');
        assert.notEqual(workspaceA.id, workspaceB.id, 'Workspaces must be isolated');
    });

    await t.test('2. Setup: Create approved Test Suite in Workspace A with 3 cases', async () => {
        const suiteData = {
            testSuiteName: 'Payment Gateway Integration',
            feature: 'Payment Flow',
            functional: [
                {
                    id: 'TC_FUNC_001',
                    title: 'Credit Card Payment Success',
                    module: 'Checkout',
                    priority: 'High',
                    severity: 'Critical',
                    steps: ['Navigate to checkout', 'Fill card details', 'Submit'],
                    expectedResult: 'Payment charged successfully',
                    automationMapping: {
                        spec: 'tests/checkout.spec.ts',
                        testName: 'should process valid card'
                    }
                },
                {
                    id: 'TC_FUNC_002',
                    title: 'PayPal Payment Success',
                    module: 'Checkout',
                    priority: 'Medium',
                    severity: 'Major',
                    steps: ['Click PayPal', 'Authenticate', 'Confirm'],
                    expectedResult: 'Redirects with confirmation'
                }
            ],
            negative: [
                {
                    id: 'TC_NEG_001',
                    title: 'Expired Card Rejection',
                    module: 'Checkout',
                    priority: 'High',
                    severity: 'Critical',
                    steps: ['Enter expired card', 'Submit'],
                    expectedResult: 'Error message shown'
                }
            ]
        };

        suiteA = await supabaseService.createSession({
            userId: userA.id,
            title: 'Payment Gateway Integration',
            requirement: 'Verify payment options including credit card and PayPal',
            context: 'web',
            depth: 'Standard',
            status: 'Approved',
            suiteData
        });

        assert.ok(suiteA && suiteA.id, 'Suite A must be created');
    });

    await t.test('3. Create Test Run with all cases: verify initial status and summary', async () => {
        const req = {
            user: userA,
            body: {
                workspaceId: workspaceA.id,
                suiteId: suiteA.id,
                name: 'Sprint 24 Staging Validation',
                description: 'Pre-release manual & automated verification run',
                executionType: 'mixed'
            },
            ip: '127.0.0.1',
            get: () => 'TestAgent'
        };
        const res = createMockRes();

        await executionController.createRun(req, res);

        assert.equal(res.statusCode, 201, 'Run creation must return 201');
        assert.equal(res.data.success, true);
        assert.ok(res.data.data.id, 'Run must have an ID');
        assert.equal(res.data.data.status, 'pending');
        assert.equal(res.data.data.executionType, 'mixed');
        assert.equal(res.data.data.summary.total, 3);
        assert.equal(res.data.data.summary.not_run, 3);
        assert.equal(res.data.data.summary.passed, 0);
        assert.equal(res.data.data.summary.failed, 0);

        runAId = res.data.data.id;
    });

    await t.test('4. Inspect Run Cases: verify automation classification and snapshots', async () => {
        const req = {
            user: userA,
            params: { id: runAId },
            query: {}
        };
        const res = createMockRes();

        await executionController.listRunCases(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.length, 3);

        const automatedCase = res.data.data.find(c => c.testCaseId === 'TC_FUNC_001');
        const manualCase = res.data.data.find(c => c.testCaseId === 'TC_FUNC_002');

        assert.ok(automatedCase, 'TC_FUNC_001 must exist');
        assert.equal(automatedCase.executionType, 'automated', 'TC_FUNC_001 has mapping so should be automated');
        assert.equal(automatedCase.caseSnapshot.title, 'Credit Card Payment Success');

        assert.ok(manualCase, 'TC_FUNC_002 must exist');
        assert.equal(manualCase.executionType, 'manual', 'TC_FUNC_002 has no mapping so should be manual');

        runCase1Id = automatedCase.id;
    });

    await t.test('5. Immutable Snapshots: Modifying original Test Suite does NOT affect historical Run', async () => {
        // Mutate the original test suite
        const mutatedSuiteData = {
            functional: [
                {
                    id: 'TC_FUNC_001',
                    title: 'MUTATED: Title changed after execution started',
                    module: 'MODIFIED',
                    priority: 'Low'
                }
            ]
        };
        await supabaseService.updateSession(suiteA.id, userA.id, {
            suiteData: mutatedSuiteData
        });

        // Inspect the run case snapshot
        const runCase = await supabaseService.getRunCaseById(runCase1Id);
        assert.equal(
            runCase.caseSnapshot.title,
            'Credit Card Payment Success',
            'Snapshot in historical run must remain immutable'
        );
        assert.equal(
            runCase.caseSnapshot.module,
            'Checkout',
            'Snapshot module must remain immutable'
        );
    });

    await t.test('6. Individual Case Selection: Create run with only subset of test cases', async () => {
        const req = {
            user: userA,
            body: {
                workspaceId: workspaceA.id,
                suiteId: suiteA.id,
                customCases: [
                    { id: 'TC_SUB_1', title: 'Subset Case 1', priority: 'High' },
                    { id: 'TC_SUB_2', title: 'Subset Case 2', priority: 'Medium' },
                    { id: 'TC_SUB_3', title: 'Subset Case 3', priority: 'Low' }
                ],
                selectedCaseIds: ['TC_SUB_1', 'TC_SUB_3'],
                name: 'Subset Targeted Run',
                executionType: 'manual'
            },
            ip: '127.0.0.1',
            get: () => 'TestAgent'
        };
        const res = createMockRes();

        await executionController.createRun(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.data.data.summary.total, 2, 'Only 2 selected cases must be included');

        const cases = await supabaseService.getRunCases(res.data.data.id);
        assert.equal(cases.length, 2);
        const ids = cases.map(c => c.testCaseId);
        assert.ok(ids.includes('TC_SUB_1'));
        assert.ok(ids.includes('TC_SUB_3'));
        assert.ok(!ids.includes('TC_SUB_2'));
    });

    await t.test('7. Workspace Isolation: User B in Workspace B cannot access or list User A runs', async () => {
        // User B tries to get User A's run
        const getReq = {
            user: userB,
            params: { id: runAId }
        };
        const getRes = createMockRes();

        await executionController.getRun(getReq, getRes);
        assert.equal(getRes.statusCode, 403, 'User B must receive 403 Forbidden for User A run');

        // User B lists runs in their own workspace
        const listReq = {
            user: userB,
            query: { workspaceId: workspaceB.id }
        };
        const listRes = createMockRes();

        await executionController.listRuns(listReq, listRes);
        assert.equal(listRes.statusCode, 200);
        assert.equal(listRes.data.data.length, 0, 'User B workspace must have 0 runs');
    });

    await t.test('8. Safe Cancellation: Eligible test run can be cancelled safely', async () => {
        const cancelReq = {
            user: userA,
            params: { id: runAId },
            ip: '127.0.0.1',
            get: () => 'TestAgent'
        };
        const cancelRes = createMockRes();

        await executionController.cancelRun(cancelReq, cancelRes);
        assert.equal(cancelRes.statusCode, 200);
        assert.equal(cancelRes.data.data.status, 'cancelled');
    });

    await t.test('9. Private Artifact Storage: Save and retrieve screenshot evidence securely', async () => {
        const sampleImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const saved = await saveArtifactBuffer({
            workspaceId: workspaceA.id,
            runId: runAId,
            name: 'failure-evidence.png',
            data: sampleImageBase64,
            mimeType: 'image/png'
        });

        assert.ok(saved.storagePath, 'Storage path must be generated');
        assert.ok(saved.sizeBytes > 0, 'Size must be greater than 0');

        const retrieved = getArtifactBuffer(saved.storagePath);
        assert.ok(retrieved && retrieved.data, 'Retrieved buffer must exist');
        assert.equal(retrieved.data.length, saved.sizeBytes);
    });
});
