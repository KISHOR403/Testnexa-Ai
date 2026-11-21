const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseService = require('../src/services/supabaseData.service');
const caseReviewService = require('../src/services/caseReview.service');
const caseReviewController = require('../src/controllers/caseReview.controller');
const qualityMetricsService = require('../src/services/qualityMetrics.service');
const intelligenceService = require('../src/services/intelligence.service');
const pipelineExportService = require('../src/services/integrations/pipelineExport.service');

const createMockRes = () => {
    const res = {
        statusCode: 200,
        data: null,
        headers: {},
        setHeader(name, val) {
            this.headers[name] = val;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        },
        send(payload) {
            this.data = payload;
            return this;
        }
    };
    return res;
};

describe('Test Case Review, Versioning, Approval & Requirements Test Suite', () => {
    const ownerUser = { id: 'usr_owner_101', _id: 'usr_owner_101', role: 'owner' };
    const editorUser = { id: 'usr_editor_102', _id: 'usr_editor_102', role: 'editor' };
    const viewerUser = { id: 'usr_viewer_103', _id: 'usr_viewer_103', role: 'viewer' };

    let suiteId = null;
    let crossSuiteId = null;
    let testCase1Id = 'TC_REV_001';
    let testCase2Id = 'TC_REV_002';
    let testCase3Id = 'TC_REV_003';
    let req1Id = null;

    before(async () => {
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;

        // Setup test suite 1
        const session1 = await supabaseService.createSession({
            userId: ownerUser.id,
            title: 'Payment Gateway Integration Suite',
            status: 'active',
            requirement: 'Handle credit card processing and charge validation.',
            context: 'web',
            depth: 'Standard',
            suiteData: {
                testSuiteName: 'Payment Gateway Integration Suite',
                requirements: [
                    { id: 'REQ-001', title: 'Tokenize Payment Card', priority: 'High', source: 'extracted' },
                    { id: 'REQ-002', title: 'Verify CVV Security', priority: 'Medium', source: 'extracted' }
                ],
                testCases: [
                    {
                        id: testCase1Id,
                        title: 'Authorize valid visa card',
                        type: 'Functional',
                        priority: 'High',
                        severity: 'Major',
                        steps: [{ action: 'Submit card details', expected: 'Token generated' }],
                        expectedResult: 'Payment authorized',
                        requirementId: 'REQ-001',
                        approval_status: 'pending',
                        version: 1
                    },
                    {
                        id: testCase2Id,
                        title: 'Reject expired card with invalid date',
                        type: 'Negative',
                        priority: 'Medium',
                        severity: 'Major',
                        steps: [{ action: 'Submit expired card', expected: 'Card expired error' }],
                        expectedResult: 'Payment rejected',
                        requirementId: 'REQ-001',
                        approval_status: 'pending',
                        version: 1
                    },
                    {
                        id: testCase3Id,
                        title: 'Boundary card length checks',
                        type: 'Edge Case',
                        priority: 'Low',
                        severity: 'Minor',
                        steps: [{ action: 'Submit 19 digit card', expected: 'Length validation error' }],
                        expectedResult: 'Validation error',
                        requirementId: 'REQ-002',
                        approval_status: 'pending',
                        version: 1
                    }
                ]
            }
        });
        suiteId = session1.id;

        // Setup cross-suite (Suite 2) to test cross-suite linking prevention
        const session2 = await supabaseService.createSession({
            userId: ownerUser.id,
            title: 'User Profile Suite',
            status: 'active',
            requirement: 'User profile management.',
            context: 'web',
            depth: 'Standard',
            suiteData: {
                testCases: [
                    { id: 'TC_PROF_001', title: 'Update avatar image', steps: ['Upload jpg'], approval_status: 'pending' }
                ]
            }
        });
        crossSuiteId = session2.id;
    });

    // =========================================================================
    // STEP 3 TESTS: APPROVAL ACTIONS
    // =========================================================================

    it('1. Viewer role is rejected with 403 when attempting to approve a test case', async () => {
        const req = {
            user: viewerUser,
            params: { id: testCase1Id },
            body: { action: 'approve', version: 1 }
        };
        const res = createMockRes();
        await caseReviewController.updateApproval(req, res);

        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(res.data.code, 'PERMISSION_DENIED');
    });

    it('2. Approve requires the current version; stale version returns 409 CASE_CHANGED with currentCase', async () => {
        const req = {
            user: editorUser,
            params: { id: testCase1Id },
            body: { action: 'approve', version: 99 } // Stale version
        };
        const res = createMockRes();
        await caseReviewController.updateApproval(req, res);

        assert.strictEqual(res.statusCode, 409);
        assert.strictEqual(res.data.code, 'CASE_CHANGED');
        assert.ok(res.data.currentCase, 'Must include current case in response');
        assert.strictEqual(res.data.currentCase.version, 1);
    });

    it('3. Reject requires a reason between 5 and 500 characters', async () => {
        const reqShort = {
            user: editorUser,
            params: { id: testCase1Id },
            body: { action: 'reject', version: 1, reason: 'bad' } // < 5 chars
        };
        const resShort = createMockRes();
        await caseReviewController.updateApproval(reqShort, resShort);

        assert.strictEqual(resShort.statusCode, 400);
        assert.strictEqual(resShort.data.code, 'VALIDATION_ERROR');

        const reqValid = {
            user: editorUser,
            params: { id: testCase1Id },
            body: { action: 'reject', version: 1, reason: 'Steps lack error message assertions.' }
        };
        const resValid = createMockRes();
        await caseReviewController.updateApproval(reqValid, resValid);

        assert.strictEqual(resValid.statusCode, 200);
        assert.strictEqual(resValid.data.data.approval_status, 'rejected');
        assert.strictEqual(resValid.data.data.rejected_reason, 'Steps lack error message assertions.');
    });

    it('4. Reset action reverts test case back to pending and clears approval metadata', async () => {
        const req = {
            user: editorUser,
            params: { id: testCase1Id },
            body: { action: 'reset', version: 1 }
        };
        const res = createMockRes();
        await caseReviewController.updateApproval(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.data.approval_status, 'pending');
        assert.strictEqual(res.data.data.rejected_reason, null);
        assert.strictEqual(res.data.data.approved_by, null);
    });

    it('5. Single approve succeeds when version matches, setting approved_by, approved_at, and approved_version', async () => {
        const req = {
            user: editorUser,
            params: { id: testCase1Id },
            body: { action: 'approve', version: 1 }
        };
        const res = createMockRes();
        await caseReviewController.updateApproval(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.data.approval_status, 'approved');
        assert.strictEqual(res.data.data.approved_by, editorUser.id);
        assert.strictEqual(res.data.data.approved_version, 1);
        assert.ok(res.data.data.approved_at);
    });

    it('6. POST /suites/:id/approve-remaining returns 409 when expectedCount does not match current pending count', async () => {
        // Currently testCase1 is approved, testCase2 and testCase3 are pending -> pendingCount = 2
        const reqMismatch = {
            user: ownerUser,
            params: { id: suiteId },
            body: { caseIds: [testCase2Id, testCase3Id], expectedCount: 10 } // expected 10, actual 2
        };
        const resMismatch = createMockRes();
        await caseReviewController.approveRemaining(reqMismatch, resMismatch);

        assert.strictEqual(resMismatch.statusCode, 409);
        assert.strictEqual(resMismatch.data.code, 'PENDING_COUNT_MISMATCH');
        assert.strictEqual(resMismatch.data.currentPendingCount, 2);
    });

    let bulkBatchId = null;
    it('7. approve-remaining approves pending cases atomically and supports Idempotency-Key', async () => {
        const req = {
            user: ownerUser,
            params: { id: suiteId },
            headers: { 'idempotency-key': 'idem_key_bulk_approve_1' },
            body: { caseIds: [testCase2Id, testCase3Id], expectedCount: 2 }
        };
        const res = createMockRes();
        await caseReviewController.approveRemaining(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.approved.length, 2);
        assert.ok(res.data.batchId);
        bulkBatchId = res.data.batchId;

        // Idempotency replay
        const resReplay = createMockRes();
        await caseReviewController.approveRemaining(req, resReplay);
        assert.strictEqual(resReplay.statusCode, 200);
        assert.strictEqual(resReplay.data.batchId, bulkBatchId);
    });

    it('8. POST /approvals/undo successfully reverts cases still at approved_version within 10-minute window', async () => {
        const req = {
            user: ownerUser,
            body: { batchId: bulkBatchId }
        };
        const res = createMockRes();
        await caseReviewController.undoApproval(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.undone.length, 2);
        assert.ok(res.data.undone.includes(testCase2Id));
        assert.ok(res.data.undone.includes(testCase3Id));
    });

    it('9. undoApproval refuses cases whose version has advanced since approval', async () => {
        // Re-approve testCase2 at v1
        await caseReviewService.updateCaseApproval({
            caseId: testCase2Id,
            action: 'approve',
            version: 1,
            user: ownerUser
        });

        // Simulate an edit on testCase2 that advances version to 2
        await caseReviewService.editTestCase({
            caseId: testCase2Id,
            ifMatchVersion: 1,
            payload: {
                title: 'Reject expired card with invalid expiration year',
                type: 'negative',
                priority: 'medium',
                severity: 'Major',
                steps: [{ action: 'Submit card expired 2 years ago', expected: 'Card expired error' }]
            },
            user: editorUser
        });

        // Attempt undo on testCase2
        const req = {
            user: ownerUser,
            body: { caseIds: [testCase2Id] }
        };
        const res = createMockRes();
        await caseReviewController.undoApproval(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.refused.length, 1);
        assert.ok(res.data.refused[0].reason.includes('approved status'));
    });

    // =========================================================================
    // STEP 4 TESTS: EDIT & OPTIMISTIC CONCURRENCY
    // =========================================================================

    it('10. Edit: optimistic concurrency check rejects stale If-Match header with 409 CASE_CHANGED', async () => {
        const req = {
            user: editorUser,
            params: { id: testCase3Id },
            headers: { 'if-match': '99' },
            body: {
                title: 'Updated title that should fail',
                type: 'functional',
                priority: 'medium',
                severity: 'Major',
                steps: [{ action: 'Do action', expected: 'See result' }]
            }
        };
        const res = createMockRes();
        await caseReviewController.editCase(req, res);

        assert.strictEqual(res.statusCode, 409);
        assert.strictEqual(res.data.code, 'CASE_CHANGED');
    });

    it('11. Edit: content change creates new version, resets approval to pending, and detects credential warnings', async () => {
        const req = {
            user: editorUser,
            params: { id: testCase3Id },
            headers: { 'if-match': '1' },
            body: {
                title: 'Validate boundary card length with secret password=MySecretPass123',
                type: 'edge',
                priority: 'low',
                severity: 'Minor',
                steps: [
                    { action: 'Submit payload with bearer token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisToken', expected: '400 length error' }
                ],
                expected: 'Correct rejection message'
            }
        };
        const res = createMockRes();
        await caseReviewController.editCase(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.data.version, 2);
        assert.strictEqual(res.data.data.approval_status, 'pending');
        assert.strictEqual(res.data.versionCreated, true);
        assert.ok(res.data.warnings.length > 0, 'Must warn about credential patterns in payload');
    });

    it('12. Edit: tag-only changes do not increment version and do not reset approval', async () => {
        // Approve testCase1 at v1
        await caseReviewService.updateCaseApproval({
            caseId: testCase1Id,
            action: 'approve',
            version: 1,
            user: ownerUser
        });

        const req = {
            user: editorUser,
            params: { id: testCase1Id },
            headers: { 'if-match': '1' },
            body: {
                title: 'Authorize valid visa card', // identical title
                type: 'functional',
                priority: 'high',
                severity: 'Major',
                steps: [{ action: 'Submit card details', expected: 'Token generated' }],
                expected: 'Payment authorized',
                tags: ['smoke', 'payments'] // new tags
            }
        };
        const res = createMockRes();
        await caseReviewController.editCase(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.data.version, 1, 'Version must NOT advance for tag-only changes');
        assert.strictEqual(res.data.data.approval_status, 'approved', 'Approval must NOT reset for tag-only changes');
        assert.strictEqual(res.data.versionCreated, false);
    });

    it('13. Edit: identical content returns 200 without creating a new version', async () => {
        const req = {
            user: editorUser,
            params: { id: testCase1Id },
            body: {
                title: 'Authorize valid visa card',
                type: 'functional',
                priority: 'high',
                severity: 'Major',
                steps: [{ action: 'Submit card details', expected: 'Token generated' }],
                expected: 'Payment authorized',
                tags: ['smoke', 'payments']
            }
        };
        const res = createMockRes();
        await caseReviewController.editCase(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.versionCreated, false);
    });

    it('14. Edit: removing last requirement link returns 422 LAST_LINK unless confirmUnlinked: true', async () => {
        const reqWithoutConfirm = {
            user: editorUser,
            params: { id: testCase1Id },
            body: {
                title: 'Authorize valid visa card with changed text',
                type: 'functional',
                priority: 'high',
                severity: 'Major',
                steps: [{ action: 'Action', expected: 'Result' }],
                requirement_ids: [] // removing link
            }
        };
        const resWithoutConfirm = createMockRes();
        await caseReviewController.editCase(reqWithoutConfirm, resWithoutConfirm);

        assert.strictEqual(resWithoutConfirm.statusCode, 422);
        assert.strictEqual(resWithoutConfirm.data.code, 'LAST_LINK');

        // With confirmUnlinked: true
        const reqWithConfirm = {
            user: editorUser,
            params: { id: testCase1Id },
            body: {
                title: 'Authorize valid visa card with changed text',
                type: 'functional',
                priority: 'high',
                severity: 'Major',
                steps: [{ action: 'Action', expected: 'Result' }],
                requirement_ids: [],
                confirmUnlinked: true
            }
        };
        const resWithConfirm = createMockRes();
        await caseReviewController.editCase(reqWithConfirm, resWithConfirm);

        assert.strictEqual(resWithConfirm.statusCode, 200);
        assert.strictEqual(resWithConfirm.data.versionCreated, true);
    });

    it('15. GET /cases/:id/versions and restore version creates new sequential version', async () => {
        const reqGet = { user: editorUser, params: { id: testCase1Id } };
        const resGet = createMockRes();
        await caseReviewController.getVersions(reqGet, resGet);

        assert.strictEqual(resGet.statusCode, 200);
        assert.ok(resGet.data.versions.length >= 1);

        // Restore version 1
        const beforeRestore = await caseReviewService.getCaseWithDetails(testCase1Id, editorUser.id);
        const reqRestore = { user: editorUser, params: { id: testCase1Id, v: '1' } };
        const resRestore = createMockRes();
        await caseReviewController.restoreVersion(reqRestore, resRestore);

        assert.strictEqual(resRestore.statusCode, 200);
        assert.strictEqual(resRestore.data.data.version, beforeRestore.version + 1, 'Restoring should create next sequential version');
        assert.strictEqual(resRestore.data.data.approval_status, 'pending');
        assert.strictEqual(resRestore.data.data.title, 'Authorize valid visa card');
    });

    // =========================================================================
    // STEP 5 TESTS: REGENERATE (PREVIEW & APPLY)
    // =========================================================================

    it('16. Regenerate preview writes zero rows to database or memory', async () => {
        const beforeVersionCount = supabaseService.inMemoryCaseVersions.size;
        const currentCase = await caseReviewService.getCaseWithDetails(testCase1Id, ownerUser.id);
        const beforeVersion = currentCase.version;

        const req = {
            user: editorUser,
            params: { id: testCase1Id },
            body: { instruction: 'Add assertion for 3DS authentication flow' }
        };
        const res = createMockRes();
        await caseReviewController.previewRegenerate(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.data.preview);
        assert.ok(Array.isArray(res.data.diffSummary));

        // Assert zero rows written
        const afterVersionCount = supabaseService.inMemoryCaseVersions.size;
        const afterCase = await caseReviewService.getCaseWithDetails(testCase1Id, ownerUser.id);
        assert.strictEqual(afterVersionCount, beforeVersionCount, 'Preview must write zero versions');
        assert.strictEqual(afterCase.version, beforeVersion, 'Preview must not advance case version');
    });

    it('17. Regenerate apply re-validates server-side and advances version with change_type = regenerated', async () => {
        const currentCase = await caseReviewService.getCaseWithDetails(testCase1Id, ownerUser.id);

        const req = {
            user: editorUser,
            params: { id: testCase1Id },
            headers: { 'idempotency-key': 'idem_regen_apply_1' },
            body: {
                version: currentCase.version,
                proposal: {
                    title: 'Authorize valid visa card with 3DS 2.0 challenge verification',
                    type: 'functional',
                    priority: 'high',
                    severity: 'Critical',
                    steps: [
                        { action: 'Submit card details requiring 3DS', expected: 'Prompt for OTP displayed' },
                        { action: 'Enter valid OTP code', expected: 'Authorization token issued' }
                    ],
                    expected: 'Payment successfully completed with authenticated token'
                }
            }
        };
        const res = createMockRes();
        await caseReviewController.applyRegenerate(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.data.version, currentCase.version + 1);
        assert.strictEqual(res.data.data.source, 'regenerated');
        assert.strictEqual(res.data.data.approval_status, 'pending');
    });

    // =========================================================================
    // STEP 6 TESTS: LINKED REQUIREMENTS & STALE FLAGGING
    // =========================================================================

    it('18. POST /requirements creates manual requirement with auto-generated canonical key REQ_<SUITE>_<NNN>', async () => {
        const req = {
            user: editorUser,
            body: {
                suiteId,
                title: 'PCI-DSS Compliance for PAN Data',
                description: 'Primary Account Numbers must never be logged or stored unencrypted.',
                priority: 'high'
            }
        };
        const res = createMockRes();
        await caseReviewController.createRequirement(req, res);

        assert.strictEqual(res.statusCode, 201);
        assert.ok(res.data.data.key.startsWith('REQ_'));
        assert.strictEqual(res.data.data.source, 'manual');
        req1Id = res.data.data.id;
    });

    it('19. Cross-suite linking between requirement in Suite 1 and test case in Suite 2 is rejected', async () => {
        const req = {
            user: editorUser,
            params: { id: req1Id },
            body: { caseId: 'TC_PROF_001' } // TC from Suite 2!
        };
        const res = createMockRes();
        await caseReviewController.linkRequirementCase(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.data.code, 'CROSS_SUITE_LINKING_PROHIBITED');
    });

    it('20. Linking within same suite succeeds and updateRequirement flags linked cases as stale', async () => {
        // Link req1 to testCase1
        const reqLink = {
            user: editorUser,
            params: { id: req1Id },
            body: { caseId: testCase1Id, rationale: 'Validates PAN encryption' }
        };
        const resLink = createMockRes();
        await caseReviewController.linkRequirementCase(reqLink, resLink);
        assert.strictEqual(resLink.statusCode, 201);

        // Edit requirement title/description
        const reqUpdate = {
            user: editorUser,
            params: { id: req1Id },
            body: { title: 'PCI-DSS Compliance for Cardholder Data (Updated Standards)' }
        };
        const resUpdate = createMockRes();
        await caseReviewController.updateRequirement(reqUpdate, resUpdate);
        assert.strictEqual(resUpdate.statusCode, 200);

        // Verify linked testCase1 was flagged stale
        const updatedCase = await caseReviewService.getCaseWithDetails(testCase1Id, ownerUser.id);
        assert.strictEqual(updatedCase.stale_reason, 'requirement_changed');
    });

    it('21. DELETE /requirements returns 409 REQUIREMENT_IN_USE when linked, but succeeds with force=true', async () => {
        const reqDeleteNoForce = {
            user: editorUser,
            params: { id: req1Id }
        };
        const resDeleteNoForce = createMockRes();
        await caseReviewController.deleteRequirement(reqDeleteNoForce, resDeleteNoForce);

        assert.strictEqual(resDeleteNoForce.statusCode, 409);
        assert.strictEqual(resDeleteNoForce.data.code, 'REQUIREMENT_IN_USE');

        // With force: true
        const reqDeleteForce = {
            user: editorUser,
            params: { id: req1Id },
            query: { force: 'true' }
        };
        const resDeleteForce = createMockRes();
        await caseReviewController.deleteRequirement(reqDeleteForce, resDeleteForce);

        assert.strictEqual(resDeleteForce.statusCode, 200);
    });

    // =========================================================================
    // STEP 7 TESTS: EXPORT & CI RULES
    // =========================================================================

    it('22. Playwright export with approved=only exports only approved cases and reports skipped count', async () => {
        // Prepare suite cases:
        // Set testCase1 = approved
        // Set testCase2 = pending
        // Set testCase3 = rejected
        const c1 = await caseReviewService.getCaseWithDetails(testCase1Id, ownerUser.id);
        const c2 = await caseReviewService.getCaseWithDetails(testCase2Id, ownerUser.id);
        const c3 = await caseReviewService.getCaseWithDetails(testCase3Id, ownerUser.id);
        await caseReviewService.updateCaseApproval({ caseId: testCase1Id, action: 'approve', version: c1.version, user: ownerUser });
        await caseReviewService.updateCaseApproval({ caseId: testCase2Id, action: 'reset', version: c2.version, user: ownerUser });
        await caseReviewService.updateCaseApproval({ caseId: testCase3Id, action: 'reject', version: c3.version, reason: 'Obsolete test', user: ownerUser });

        const session = await supabaseService.getSession(suiteId, ownerUser.id);

        // Export with approved=only (default)
        const exportOnly = pipelineExportService.generatePlaywrightSuiteCode(session, { approved: 'only' });
        assert.strictEqual(exportOnly.exportedCount, 1, 'Only approved case should be exported');
        assert.strictEqual(exportOnly.skippedCount, 2, 'Pending and rejected cases must be skipped');
        assert.ok(exportOnly.specCode.includes(`[${testCase1Id}]`));
        assert.ok(!exportOnly.specCode.includes(`[${testCase3Id}]`), 'Rejected case must NEVER appear');

        // Export with approved=include_pending
        const exportWithPending = pipelineExportService.generatePlaywrightSuiteCode(session, { approved: 'include_pending' });
        assert.strictEqual(exportWithPending.exportedCount, 2, 'Approved and pending cases should be exported');
        assert.strictEqual(exportWithPending.skippedCount, 1, 'Rejected case must be skipped');
        assert.ok(exportWithPending.specCode.includes(`[${testCase1Id}]`));
        assert.ok(exportWithPending.specCode.includes(`[${testCase2Id}]`));
        assert.ok(!exportWithPending.specCode.includes(`[${testCase3Id}]`), 'Rejected case must NEVER appear');
    });

    // =========================================================================
    // STEP 9 TESTS: CROSS-ENDPOINT CONSISTENCY
    // =========================================================================

    it('23. Cross-endpoint consistency: approvedCount matches across Suite metrics, QualityMetrics, and Intelligence', async () => {
        const qm = await qualityMetricsService.getQualityMetrics({ suiteId, userId: ownerUser.id });
        const intel = await intelligenceService.getIntelligenceOverview({ suiteId, userId: ownerUser.id });

        assert.strictEqual(qm.approvedCount, 1);
        assert.strictEqual(intel.review.approved, qm.approvedCount, 'Intelligence must match QualityMetrics approved count');
        assert.strictEqual(intel.review.notApproved, qm.notApprovedCount);
        assert.strictEqual(intel.review.approvalPct, qm.approvalPct);
    });
});
