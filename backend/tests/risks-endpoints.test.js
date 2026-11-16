const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const riskService = require('../src/services/risk.service');
const supabaseService = require('../src/services/supabaseData.service');
const { calculateRiskScore, normalizeCanonicalTestType } = require('../src/services/riskScoring');

describe('Risk Vectors & Threat Modeling Endpoints & Service', () => {
    const testUserId = 'test_qa_lead_risks_999';
    let testSuiteId1 = null;
    let testSuiteId2 = null;
    let createdRiskId = null;

    before(async () => {
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;
        supabaseService.risksTableAvailable = false;

        // Seed test suites for testUserId
        const s1 = await supabaseService.createSession({
            userId: testUserId,
            title: 'User Authentication Test Suite',
            status: 'active',
            requirement: 'Users must authenticate with email and password.',
            suiteData: {
                functional: [
                    {
                        id: 'TC_FUNC_LOGIN_001',
                        title: 'Successful Login with Valid Credentials',
                        type: 'Functional',
                        priority: 'High',
                        severity: 'Major',
                        approval_status: 'approved',
                        steps: [{ action: 'Submit valid credentials', expected: 'Session active' }],
                        expectedResult: 'Dashboard rendered successfully'
                    },
                    {
                        id: 'TC_FUNC_002',
                        title: 'User Views Profile After Login',
                        type: 'Functional',
                        priority: 'Medium',
                        severity: 'Minor',
                        approval_status: 'approved',
                        steps: [{ action: 'Click profile menu', expected: 'Profile loaded' }],
                        expectedResult: 'Profile information displayed'
                    }
                ],
                negative: [
                    {
                        id: 'TC_NEG_001',
                        title: 'Brute Force Login Password Attempt Throttled',
                        type: 'Negative',
                        priority: 'High',
                        severity: 'Critical',
                        requirementId: 'REQ-001',
                        approval_status: 'approved',
                        steps: [{ action: 'Send 10 failed login requests', expected: 'HTTP 429 Too Many Requests' }],
                        expectedResult: 'Account endpoint throttles brute force attack'
                    },
                    {
                        id: 'TC_NEG_002',
                        title: 'Login with SQL Injection in Email Field',
                        type: 'Negative',
                        priority: 'High',
                        severity: 'Critical',
                        requirementId: 'REQ-001',
                        approval_status: 'pending',
                        steps: [{ action: "Submit email with ' OR 1=1 --", expected: 'HTTP 400 Bad Request' }],
                        expectedResult: 'Input sanitized and injection rejected'
                    }
                ],
                edge: [
                    {
                        id: 'TC_EDGE_001',
                        title: 'Concurrent Login from Multiple Browsers',
                        type: 'Edge Case',
                        priority: 'Medium',
                        severity: 'Major',
                        requirementId: 'REQ-002',
                        approval_status: 'pending',
                        steps: [{ action: 'Log in from second device', expected: 'Previous session handled' }],
                        expectedResult: 'Concurrent session policy enforced'
                    }
                ],
                requirements: [
                    { id: 'REQ-001', title: 'Secure Authentication & Rate Limiting' },
                    { id: 'REQ-002', title: 'Session Concurrency Control' }
                ]
            }
        });
        testSuiteId1 = s1.id;

        const s2 = await supabaseService.createSession({
            userId: testUserId,
            title: 'Password Reset Suite',
            status: 'active',
            requirement: 'Users can reset their password using their registered email.',
            suiteData: {
                functional: [
                    {
                        id: 'TC_FUNC_003',
                        title: 'Submit Valid Registered Email for Reset',
                        type: 'Functional',
                        priority: 'High',
                        severity: 'Major',
                        approval_status: 'approved',
                        steps: [{ action: 'Submit registered email address', expected: 'Reset email sent' }],
                        expectedResult: 'Password reset link sent to verified address'
                    }
                ],
                negative: [
                    {
                        id: 'TC_NEG_003',
                        title: 'Expired Reset Token Invalidation and Rejection',
                        type: 'Negative',
                        priority: 'High',
                        severity: 'Major',
                        requirementId: 'REQ-003',
                        approval_status: 'approved',
                        steps: [{ action: 'Submit reset form with expired token', expected: 'HTTP 400 Expired Token' }],
                        expectedResult: 'Expired recovery tokens cannot reset password'
                    },
                    {
                        id: 'TC_NEG_004',
                        title: 'Password Reset Token Single-Use Reuse Prevention',
                        type: 'Negative',
                        priority: 'High',
                        severity: 'Critical',
                        requirementId: 'REQ-003',
                        approval_status: 'pending',
                        steps: [{ action: 'Submit token a second time after use', expected: 'HTTP 400 Token Invalid' }],
                        expectedResult: 'Single-use token invalidated after first password update'
                    }
                ],
                nonFunctional: [
                    {
                        id: 'TC_NF_001',
                        title: 'Password Reset Timing Attack Enumeration Resistance',
                        type: 'Non-Functional',
                        priority: 'High',
                        severity: 'Major',
                        requirementId: 'REQ-003',
                        approval_status: 'pending',
                        steps: [{ action: 'Measure response latency for registered vs unregistered email', expected: 'Delta <= 100ms' }],
                        expectedResult: 'Timing delta prevents user enumeration'
                    }
                ],
                requirements: [
                    { id: 'REQ-003', title: 'Password Recovery Token Security' }
                ]
            }
        });
        testSuiteId2 = s2.id;

        // Run backfill for testUserId
        await riskService.backfillDerivedRisks({ userId: testUserId, confirm: true });
    });

    describe('1. Derived Risks Ingestion from ALL Suites', () => {
        it('derives risks from both User Authentication AND Password Reset suites', async () => {
            const result = await riskService.listRisks({ userId: testUserId, limit: 100 });
            assert.ok(result.risks.length >= 5, `Expected at least 5 derived risks, got ${result.risks.length}`);

            const suiteIds = new Set(result.risks.map(r => r.suite_id));
            assert.ok(suiteIds.has(testSuiteId1), 'Must contain risks from User Authentication suite');
            assert.ok(suiteIds.has(testSuiteId2), 'Must contain risks from Password Reset suite');
        });

        it('strictly excludes functional happy paths from risk vectors', async () => {
            const result = await riskService.listRisks({ userId: testUserId, limit: 100 });
            const happyPathRisk = result.risks.find(r =>
                r.title.includes('Successful Login') ||
                r.title.includes('User Views Profile') ||
                r.source_case_id === 'TC_FUNC_LOGIN_001'
            );
            assert.equal(happyPathRisk, undefined, 'Functional happy paths must NEVER be created as risk vectors');
        });

        it('derives threats as security failure statements rather than test steps', async () => {
            const result = await riskService.listRisks({ userId: testUserId, limit: 100 });
            const bruteForceRisk = result.risks.find(r => r.source_case_id === 'TC_NEG_001');
            assert.ok(bruteForceRisk, 'Brute force risk vector must exist');
            assert.ok(bruteForceRisk.threat.includes('brute-force') || bruteForceRisk.threat.includes('credential stuffing'),
                'Threat statement must describe vulnerability threat');
            assert.equal(bruteForceRisk.category, 'rate_limiting');
        });
    });

    describe('2. Summary Metrics & Cross-Endpoint Equality', () => {
        it('guarantees total risks equals the sum of bySeverity buckets', async () => {
            const summary = await riskService.getSummary({ userId: testUserId });
            const sevSum = summary.bySeverity.critical + summary.bySeverity.high + summary.bySeverity.medium + summary.bySeverity.low;
            assert.equal(summary.total, sevSum, 'Sum of severity buckets must equal total risks');
        });

        it('guarantees total risks equals the sum of byStatus buckets', async () => {
            const summary = await riskService.getSummary({ userId: testUserId });
            const statusSum = summary.byStatus.open + summary.byStatus.mitigating + summary.byStatus.accepted + summary.byStatus.closed;
            assert.equal(summary.total, statusSum, 'Sum of status buckets must equal total risks');
        });

        it('guarantees total risks equals the sum of byMitigation buckets', async () => {
            const summary = await riskService.getSummary({ userId: testUserId });
            const mitSum = summary.byMitigation.unmitigated + summary.byMitigation.tests_planned + summary.byMitigation.tests_approved + summary.byMitigation.verified;
            assert.equal(summary.total, mitSum, 'Sum of mitigation buckets must equal total risks');
        });

        it('summary total equals paginated list total', async () => {
            const summary = await riskService.getSummary({ userId: testUserId });
            const list = await riskService.listRisks({ userId: testUserId, limit: 100 });
            assert.equal(summary.total, list.total, 'Summary total must match list total');
        });

        it('reports executionEnabled = false while test execution is disabled', async () => {
            const summary = await riskService.getSummary({ userId: testUserId });
            assert.equal(summary.executionEnabled, false, 'executionEnabled must be false');
            assert.equal(summary.byMitigation.verified, 0, 'verified count must be 0 while execution is off');
        });
    });

    describe('3. 5x5 Threat Matrix Distribution', () => {
        it('returns a 5x5 matrix where sum of cell counts equals total risks', async () => {
            const matrix = await riskService.getMatrix({ userId: testUserId });
            assert.ok(matrix.grid, 'Matrix grid must exist');

            let cellSum = 0;
            for (let l = 1; l <= 5; l++) {
                for (let i = 1; i <= 5; i++) {
                    const cell = matrix.grid[l][i];
                    assert.equal(cell.likelihood, l);
                    assert.equal(cell.impact, i);
                    assert.equal(cell.score, l * i);
                    cellSum += cell.count;
                    assert.equal(cell.count, cell.riskIds.length);
                }
            }

            assert.equal(cellSum, matrix.total, 'Sum of all matrix cells must equal matrix total');
        });
    });

    describe('4. Mitigation Status Dynamics', () => {
        it('computes tests_approved when linked test case has approval_status approved', async () => {
            const list = await riskService.listRisks({ userId: testUserId, limit: 100 });
            const approvedRisk = list.risks.find(r => r.source_case_id === 'TC_NEG_001');
            assert.ok(approvedRisk);
            assert.equal(approvedRisk.mitigation, 'tests_approved', 'Risk with approved linked test must be tests_approved');
        });

        it('computes tests_planned when linked test case is pending review', async () => {
            const list = await riskService.listRisks({ userId: testUserId, limit: 100 });
            const pendingRisk = list.risks.find(r => r.source_case_id === 'TC_NEG_002');
            assert.ok(pendingRisk);
            assert.equal(pendingRisk.mitigation, 'tests_planned', 'Risk with unapproved linked test must be tests_planned');
        });
    });

    describe('5. Status Transitions & Mandatory Acceptance Rationale', () => {
        it('rejects marking risk as accepted when acceptedReason is omitted', async () => {
            const list = await riskService.listRisks({ userId: testUserId, limit: 1 });
            const targetRisk = list.risks[0];

            await assert.rejects(
                async () => {
                    await riskService.updateStatus(targetRisk.id, testUserId, { status: 'accepted', acceptedReason: '' });
                },
                /accepted_reason is required/i
            );
        });

        it('successfully transitions to accepted when valid reason is provided and logs audit event', async () => {
            const list = await riskService.listRisks({ userId: testUserId, limit: 1 });
            const targetRisk = list.risks[0];

            const updated = await riskService.updateStatus(targetRisk.id, testUserId, {
                status: 'accepted',
                acceptedReason: 'Compensating controls implemented via Web Application Firewall (WAF) rate limiting rule.'
            });

            assert.equal(updated.status, 'accepted');
            assert.ok(updated.accepted_reason.includes('WAF'));

            // Check audit events
            const fullRisk = await riskService.getRiskById(targetRisk.id, testUserId);
            const statusEvent = fullRisk.events.find(e => e.type === 'status_changed');
            assert.ok(statusEvent, 'status_changed audit event must be recorded');
            assert.equal(statusEvent.to_value, 'accepted');
        });
    });

    describe('6. Manual Risk Creation & Test Linking', () => {
        it('creates a manual risk vector with Joi validation and audit trail', async () => {
            const created = await riskService.createManualRisk(testUserId, {
                suiteId: testSuiteId1,
                title: 'Unauthenticated API Key Leakage in Webpack Bundle',
                threat: 'Sensitive third-party API tokens are bundled into client-side production JavaScript, allowing anyone to impersonate the service.',
                category: 'data_exposure',
                likelihood: 4,
                impact: 4,
                requirementIds: ['REQ-001'],
                testCaseIds: ['TC_NEG_002']
            });

            createdRiskId = created.id;
            assert.ok(createdRiskId);
            assert.equal(created.source, 'manual');
            assert.equal(created.score, 16);
            assert.equal(created.severity, 'high');
            assert.equal(created.category, 'data_exposure');

            const event = created.events.find(e => e.type === 'risk_created');
            assert.ok(event, 'risk_created audit event must exist');
        });

        it('unlinks and links test cases with audit logging', async () => {
            assert.ok(createdRiskId);
            // Unlink
            const unlinked = await riskService.unlinkTest(createdRiskId, testUserId, 'TC_NEG_002');
            assert.equal(unlinked.testsCount, 0);
            assert.equal(unlinked.mitigation, 'unmitigated');

            // Re-link
            const relinked = await riskService.linkTests(createdRiskId, testUserId, [
                { testCaseId: 'TC_NEG_001', rationale: 'Verified brute force protection prevents key abuse' }
            ]);
            assert.equal(relinked.testsCount, 1);
            assert.equal(relinked.mitigation, 'tests_approved');
        });
    });

    describe('7. Tenant Isolation & Access Control', () => {
        it('returns null / 404 when querying another user\'s risk', async () => {
            assert.ok(createdRiskId);
            const foreignUserRisk = await riskService.getRiskById(createdRiskId, 'foreign_tenant_999');
            assert.equal(foreignUserRisk, null, 'Must NOT allow access to risks owned by another user');
        });
    });

    describe('8. Export Generation', () => {
        it('exports risks to CSV with proper headers', async () => {
            const csv = await riskService.exportRisks({ userId: testUserId, format: 'csv' });
            assert.ok(typeof csv === 'string');
            assert.ok(csv.startsWith('ID,Suite ID,Suite Name,Title,Threat,Category,Likelihood,Impact,Score,Severity,Status,Mitigation,Source,Linked Tests,Linked Requirements,Created At'));
            assert.ok(csv.includes('rate_limiting'));
        });

        it('exports risks to JSON', async () => {
            const json = await riskService.exportRisks({ userId: testUserId, format: 'json' });
            assert.ok(Array.isArray(json.risks));
            assert.ok(json.total > 0);
        });
    });
});
