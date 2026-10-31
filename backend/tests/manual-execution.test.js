const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabaseService = require('../src/services/supabaseData.service');
const executionController = require('../src/controllers/execution.controller');

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

test('Milestone 3: Manual Execution Engine, Retest Attempts & Evidence Suite', async (t) => {
    supabaseService.workspacesTableAvailable = false;
    supabaseService.sessionsTableAvailable = false;
    supabaseService.executionTablesAvailable = false;

    const timestamp = Date.now();
    const testerUser = {
        id: `usr_manual_${timestamp}`,
        _id: `usr_manual_${timestamp}`,
        name: 'QA Lead Rachel',
        email: `rachel_${timestamp}@testnexa.ai`
    };

    let workspace;
    let runId;
    let case1;
    let case2;

    await t.test('1. Setup: Create test run with 2 manual cases', async () => {
        workspace = await supabaseService.getUserPrimaryWorkspace(testerUser.id, testerUser.name);

        const customCases = [
            {
                id: 'TC_MANUAL_001',
                title: 'User Profile Name Change',
                module: 'Profile',
                priority: 'High',
                severity: 'Major',
                preconditions: 'User is logged in on account settings page',
                steps: [
                    'Click Edit Name',
                    'Enter "Alex Morgan"',
                    'Click Save Changes'
                ],
                expectedResult: 'Toast message confirms profile updated and new name appears'
            },
            {
                id: 'TC_MANUAL_002',
                title: 'Avatar File Size Validation',
                module: 'Profile',
                priority: 'Medium',
                severity: 'Minor',
                preconditions: 'User is on profile upload screen',
                steps: [
                    'Select avatar image file > 10MB',
                    'Click Upload'
                ],
                expectedResult: 'Client-side error banner warns file exceeds 10MB'
            }
        ];

        const req = {
            user: testerUser,
            body: {
                workspaceId: workspace.id,
                name: 'Profile Settings Manual Pass',
                executionType: 'manual',
                customCases
            },
            ip: '127.0.0.1',
            get: () => 'TestAgent'
        };
        const res = createMockRes();
        await executionController.createRun(req, res);

        assert.equal(res.statusCode, 201);
        runId = res.data.data.id;

        const cases = await supabaseService.getRunCases(runId);
        assert.equal(cases.length, 2);
        case1 = cases[0];
        case2 = cases[1];
    });

    await t.test('2. Execute Case 1 (Pass): verify status, actual result, notes, duration', async () => {
        const req = {
            user: testerUser,
            params: { id: runId, caseId: case1.id },
            body: {
                status: 'passed',
                actualResult: 'Profile name successfully changed to Alex Morgan and toast appeared',
                notes: 'Tested on Chrome 124. Smooth animation.',
                durationMs: 4200,
                executorType: 'manual'
            }
        };
        const res = createMockRes();
        await executionController.recordExecution(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.execution.status, 'passed');
        assert.equal(res.data.data.execution.attemptNumber, 1);
        assert.equal(res.data.data.execution.durationMs, 4200);
        assert.equal(res.data.data.runSummary.passed, 1);
        assert.equal(res.data.data.runSummary.not_run, 1);
        assert.ok(['in_progress', 'partially_completed', 'running'].includes(res.data.data.runStatus), 'Run status must reflect active or partial execution');

        const updatedCase = await supabaseService.getRunCaseById(case1.id);
        assert.equal(updatedCase.status, 'passed');
        assert.equal(updatedCase.currentAttempt, 1);
    });

    await t.test('3. Execute Case 2 (Fail) with screenshot artifact attachment', async () => {
        const sampleScreenshotBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const req = {
            user: testerUser,
            params: { id: runId, caseId: case2.id },
            body: {
                status: 'failed',
                actualResult: 'App crashed with uncaught out of memory error instead of friendly warning',
                notes: 'Reproduced on 15MB PNG image file',
                errorMessage: 'FATAL: Image buffer exceeded heap limit',
                durationMs: 3100,
                executorType: 'manual',
                artifact: {
                    name: 'crash-dump.png',
                    data: sampleScreenshotBase64,
                    mimeType: 'image/png'
                }
            }
        };
        const res = createMockRes();
        await executionController.recordExecution(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.execution.status, 'failed');
        assert.equal(res.data.data.execution.attemptNumber, 1);
        assert.equal(res.data.data.runSummary.passed, 1);
        assert.equal(res.data.data.runSummary.failed, 1);
        assert.equal(res.data.data.runSummary.not_run, 0);
        assert.ok(['completed', 'failed'].includes(res.data.data.runStatus), 'Run status must reflect completion or failure');

        // Check artifacts
        const artifacts = await supabaseService.getRunArtifacts(runId, case2.id);
        assert.ok(artifacts.length > 0, 'Artifact must be saved');
        assert.equal(artifacts[0].artifactType, 'screenshot');
    });

    await t.test('4. Retest Case 2: verify historical attempt 1 preserved, attempt 2 created', async () => {
        const req = {
            user: testerUser,
            params: { id: runId, caseId: case2.id },
            body: {
                status: 'passed',
                actualResult: 'Client-side check now blocks files >10MB before uploading',
                notes: 'Retested after hotfix commit #419bf',
                durationMs: 2500,
                executorType: 'manual'
            }
        };
        const res = createMockRes();
        await executionController.recordExecution(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.execution.attemptNumber, 2, 'Must increment to attempt 2');
        assert.equal(res.data.data.execution.status, 'passed');

        // Verify summary updated: 2 passed, 0 failed
        assert.equal(res.data.data.runSummary.passed, 2);
        assert.equal(res.data.data.runSummary.failed, 0);

        // Verify attempt history has BOTH attempt 1 (failed) and attempt 2 (passed)
        const historyReq = {
            user: testerUser,
            params: { id: runId, caseId: case2.id }
        };
        const historyRes = createMockRes();
        await executionController.getCaseHistory(historyReq, historyRes);

        assert.equal(historyRes.statusCode, 200);
        assert.equal(historyRes.data.data.length, 2, 'Both attempts must be preserved');
        assert.equal(historyRes.data.data[0].attemptNumber, 1);
        assert.equal(historyRes.data.data[0].status, 'failed');
        assert.equal(historyRes.data.data[1].attemptNumber, 2);
        assert.equal(historyRes.data.data[1].status, 'passed');

        // Verify parent case shows latest status and attempt 2
        const finalCase2 = await supabaseService.getRunCaseById(case2.id);
        assert.equal(finalCase2.status, 'passed');
        assert.equal(finalCase2.currentAttempt, 2);
        assert.equal(finalCase2.durationMs, 5600); // 3100 + 2500
    });

    await t.test('5. Support Blocked and Skipped statuses with reason notes', async () => {
        // Create 3rd case on the fly
        const trcId = 'trc_blocked_test';
        await supabaseService.inMemoryTestRunCases.set(trcId, {
            id: trcId,
            run_id: runId,
            test_case_id: 'TC_MANUAL_003',
            case_snapshot: { title: 'Third Party OAuth Link', steps: ['Click Google login'] },
            execution_type: 'manual',
            status: 'not_run',
            current_attempt: 1,
            duration_ms: 0
        });

        const req = {
            user: testerUser,
            params: { id: runId, caseId: trcId },
            body: {
                status: 'blocked',
                notes: 'Google OAuth provider credentials expired in staging environment',
                durationMs: 500
            }
        };
        const res = createMockRes();
        await executionController.recordExecution(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.execution.status, 'blocked');
        assert.equal(res.data.data.runSummary.blocked, 1);
    });
});

