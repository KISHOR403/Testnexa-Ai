import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    normalizeRequirementKey,
    computeCanonicalSuiteMetrics
} from '../../frontend/utils/testSuiteSelectors.js';

import { caseReviewService } from '../../frontend/services/caseReviewService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Suite Detail Review & Test Case Actions', () => {

    describe('1. Requirement Key Normalization (ONE Format Everywhere: REQ_<SUITE>_<NNN>)', () => {
        it('normalizes legacy hyphen format REQ-001 to canonical REQ_REG_001', () => {
            assert.equal(normalizeRequirementKey('REQ-001'), 'REQ_REG_001');
            assert.equal(normalizeRequirementKey('REQ-005'), 'REQ_REG_005');
            assert.equal(normalizeRequirementKey('REQ-12'), 'REQ_REG_012');
        });

        it('normalizes suite-specific hyphen keys REQ-REG-001 or REQ-AUTH-002', () => {
            assert.equal(normalizeRequirementKey('REQ-REG-001'), 'REQ_REG_001');
            assert.equal(normalizeRequirementKey('REQ-AUTH-002'), 'REQ_AUTH_002');
            assert.equal(normalizeRequirementKey('REQ-BILL-042'), 'REQ_BILL_042');
        });

        it('preserves already canonical keys with underscores', () => {
            assert.equal(normalizeRequirementKey('REQ_REG_001'), 'REQ_REG_001');
            assert.equal(normalizeRequirementKey('REQ_CHECKOUT_003'), 'REQ_CHECKOUT_003');
        });

        it('normalizes plain prefix REG-001 or AUTH-005 to REQ_<PREFIX>_<NNN>', () => {
            assert.equal(normalizeRequirementKey('REG-001'), 'REQ_REG_001');
            assert.equal(normalizeRequirementKey('AUTH-005'), 'REQ_AUTH_005');
        });

        it('gracefully handles empty, null, or undefined keys with default REQ_REG_001', () => {
            assert.equal(normalizeRequirementKey(''), 'REQ_REG_001');
            assert.equal(normalizeRequirementKey(null), 'REQ_REG_001');
            assert.equal(normalizeRequirementKey(undefined), 'REQ_REG_001');
        });
    });

    describe('2. Canonical Suite Metrics (Approval, Verification, & Traceability)', () => {
        it('accurately computes pendingCases, rejectedCases, and isAllApproved flags', () => {
            const suite = {
                id: 'suite-101',
                testCases: [
                    { id: 'TC-001', approval_status: 'approved', version: 2 },
                    { id: 'TC-002', approval_status: 'pending', version: 1 },
                    { id: 'TC-003', approval_status: 'rejected', rejected_reason: 'Redundant step', version: 1 },
                    { id: 'TC-004', approval_status: 'approved', version: 1 }
                ]
            };

            const metrics = computeCanonicalSuiteMetrics(suite);
            assert.equal(metrics.totalCases, 4);
            assert.equal(metrics.approvedCases, 2);
            assert.equal(metrics.pendingCases, 1);
            assert.equal(metrics.rejectedCases, 1);
            assert.equal(metrics.isAllApproved, false);
            assert.equal(metrics.hasRejected, true);
        });

        it('flags isAllApproved as true when all cases are approved and none rejected', () => {
            const suite = {
                id: 'suite-102',
                testCases: [
                    { id: 'TC-001', approval_status: 'approved', version: 1 },
                    { id: 'TC-002', approval_status: 'approved', version: 3 }
                ]
            };

            const metrics = computeCanonicalSuiteMetrics(suite);
            assert.equal(metrics.isAllApproved, true);
            assert.equal(metrics.pendingCases, 0);
            assert.equal(metrics.rejectedCases, 0);
        });

        it('derives linked requirements and normalizes their keys in canonical metrics', () => {
            const suite = {
                id: 'suite-103',
                testCases: [
                    { id: 'TC-001', reqId: 'REQ-001', approval_status: 'approved' },
                    { id: 'TC-002', reqId: 'REQ-REG-002', approval_status: 'pending' },
                    { id: 'TC-003', reqId: 'REQ_REG_001', approval_status: 'approved' }
                ]
            };

            const metrics = computeCanonicalSuiteMetrics(suite);
            assert.ok(metrics.linkedRequirements.includes('REQ_REG_001'));
            assert.ok(metrics.linkedRequirements.includes('REQ_REG_002'));
            assert.equal(metrics.linkedRequirements.length, 2);
        });
    });

    describe('3. Case Review Service API Calls & Headers', () => {
        let originalFetch;
        let interceptedCalls = [];

        // Setup mock fetch
        beforeEach(() => {
            interceptedCalls = [];
            originalFetch = global.fetch;
            global.fetch = async (url, options = {}) => {
                interceptedCalls.push({ url, options });
                return {
                    ok: true,
                    status: 200,
                    headers: {
                        get: (h) => (h && h.toLowerCase() === 'content-type' ? 'application/json' : null)
                    },
                    json: async () => ({ success: true, data: { id: 'TC-001', version: 2 } })
                };
            };
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        it('approveCase dispatches PATCH /cases/:id/approval with current version', async () => {
            await caseReviewService.approveCase('TC-001', 1);

            assert.equal(interceptedCalls.length, 1);
            const call = interceptedCalls[0];
            assert.ok(call.url.includes('/api/v1/cases/TC-001/approval'));
            assert.equal(call.options.method, 'PATCH');
            const body = JSON.parse(call.options.body);
            assert.equal(body.action, 'approve');
            assert.equal(body.version, 1);
        });

        it('rejectCase validates required reason length between 5 and 500 characters', async () => {
            await assert.rejects(
                async () => caseReviewService.rejectCase('TC-001', 1, 'bad'),
                /between 5 and 500 characters/
            );

            await caseReviewService.rejectCase('TC-001', 1, 'Invalid assertion boundary specification');
            assert.equal(interceptedCalls.length, 1);
            const body = JSON.parse(interceptedCalls[0].options.body);
            assert.equal(body.action, 'reject');
            assert.equal(body.reason, 'Invalid assertion boundary specification');
        });

        it('resetApproval dispatches PATCH with action: reset', async () => {
            await caseReviewService.resetApproval('TC-001', 2);
            assert.equal(interceptedCalls.length, 1);
            const body = JSON.parse(interceptedCalls[0].options.body);
            assert.equal(body.action, 'reset');
            assert.equal(body.version, 2);
        });

        it('approveRemaining includes Idempotency-Key and sends caseIds with expectedCount', async () => {
            await caseReviewService.approveRemaining('suite-42', {
                caseIds: ['TC-001', 'TC-002'],
                expectedCount: 2
            });

            assert.equal(interceptedCalls.length, 1);
            const call = interceptedCalls[0];
            assert.ok(call.url.includes('/api/v1/suites/suite-42/approve-remaining'));
            assert.equal(call.options.method, 'POST');
            assert.ok(call.options.headers['Idempotency-Key']);
            const body = JSON.parse(call.options.body);
            assert.deepEqual(body.caseIds, ['TC-001', 'TC-002']);
            assert.equal(body.expectedCount, 2);
        });

        it('undoApproval dispatches POST /approvals/undo with batchId or caseIds', async () => {
            await caseReviewService.undoApproval({ batchId: 'batch-99' });
            assert.equal(interceptedCalls.length, 1);
            const call = interceptedCalls[0];
            assert.ok(call.url.includes('/api/v1/approvals/undo'));
            const body = JSON.parse(call.options.body);
            assert.equal(body.batchId, 'batch-99');
        });

        it('updateCase includes If-Match header with version and optionally confirmUnlinked', async () => {
            await caseReviewService.updateCase('TC-001', { title: 'Updated Test' }, {
                version: 3,
                confirmUnlinked: true
            });

            assert.equal(interceptedCalls.length, 1);
            const call = interceptedCalls[0];
            assert.ok(call.url.includes('/api/v1/cases/TC-001'));
            assert.equal(call.options.method, 'PUT');
            assert.equal(call.options.headers['If-Match'], '3');
            const body = JSON.parse(call.options.body);
            assert.equal(body.title, 'Updated Test');
            assert.equal(body.confirmUnlinked, true);
        });

        it('regeneratePreview requests in-memory preview without persisting database writes', async () => {
            await caseReviewService.regeneratePreview('TC-001', { instruction: 'Add edge variant' });
            assert.equal(interceptedCalls.length, 1);
            const call = interceptedCalls[0];
            assert.ok(call.url.includes('/api/v1/cases/TC-001/regenerate/preview'));
            assert.equal(call.options.method, 'POST');
            const body = JSON.parse(call.options.body);
            assert.equal(body.instruction, 'Add edge variant');
        });

        it('exportPlaywright passes approved filter query parameter', async () => {
            await caseReviewService.exportPlaywright('suite-42', { approved: 'only' });
            assert.equal(interceptedCalls.length, 1);
            assert.ok(interceptedCalls[0].url.includes('approved=only'));
        });
    });

    describe('4. Credential Detection Warning Pattern', () => {
        const CREDENTIAL_PATTERN = /(?:password|passwd|pwd|secret|api[_-]?key|bearer|token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{6,}['"]?|eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}|[0-9a-fA-F]{32,64}/i;

        it('detects password= and api_key= assignments in test steps or preconditions', () => {
            assert.ok(CREDENTIAL_PATTERN.test('Enter password=SuperSecretPassword123'));
            assert.ok(CREDENTIAL_PATTERN.test('Header Authorization: api_key=ak_live_abcdef123456789'));
            assert.ok(CREDENTIAL_PATTERN.test('Bearer token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0'));
        });

        it('does not trigger on standard placeholders like <valid_password> or {USER_TOKEN}', () => {
            assert.strictEqual(CREDENTIAL_PATTERN.test('Enter placeholder <valid_password> in input field'), false);
            assert.strictEqual(CREDENTIAL_PATTERN.test('Ensure token {JWT_TOKEN} is validated'), false);
        });
    });

    describe('5. Strict Black-and-White Theme Compliance (SuiteReviewActions.css)', () => {
        it('contains zero forbidden color names or hex codes (green, blue, red, amber, teal, cyan)', () => {
            const cssPath = path.resolve(__dirname, '../../frontend/styles/app/SuiteReviewActions.css');
            const cssContent = fs.readFileSync(cssPath, 'utf8');

            // Regex checking for color keywords (not inside comments or token definitions)
            const forbiddenColors = [
                /\bcolor:\s*green\b/i,
                /\bcolor:\s*blue\b/i,
                /\bcolor:\s*red\b/i,
                /\bcolor:\s*teal\b/i,
                /\bcolor:\s*cyan\b/i,
                /\bcolor:\s*amber\b/i,
                /\bbackground:\s*#34d399\b/i,
                /\bbackground:\s*#10b981\b/i,
                /\bbackground:\s*#ef4444\b/i,
                /\bbackground:\s*#3b82f6\b/i
            ];

            forbiddenColors.forEach(pattern => {
                assert.strictEqual(pattern.test(cssContent), false, `Found forbidden color pattern: ${pattern}`);
            });

            // Ensure canonical B&W tokens are defined
            assert.ok(cssContent.includes('--bw-bg: #000000;'));
            assert.ok(cssContent.includes('--bw-surface: #0a0a0a;'));
            assert.ok(cssContent.includes('--bw-line: rgba(255, 255, 255, 0.10);'));
            assert.ok(cssContent.includes('--bw-text-1: #ffffff;'));
        });
    });
});
