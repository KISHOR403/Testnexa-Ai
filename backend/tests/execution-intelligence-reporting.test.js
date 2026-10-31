/**
 * TestNexa AI — Phase 2: Unified Execution Intelligence & Reporting Test Suite
 *
 * Verifies:
 * 1. Unified execution reports combining manual and automated execution results.
 * 2. Real metrics persistence: Total, Passed, Failed, Blocked, Skipped, Not Run.
 * 3. Method breakdown (Manual, Playwright Automated, Mixed).
 * 4. Failure investigation: Automated stack traces & screenshots; manual tester observations.
 * 5. Multi-run comparison: Regressions (Passed -> Failed), Fixes (Failed -> Passed), Shifts, Duration & Pass Rate deltas.
 * 6. Rerun functionality: Flexible scopes ('failed', 'selected', 'all') preserving append-only attempt history.
 * 7. Requirement coverage analytics matching test cases to functional requirements.
 * 8. Export generation: JSON schema, CSV format, and printable HTML/PDF layout.
 * 9. Multi-tenant workspace isolation & authorization boundaries.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const supabaseService = require('../src/services/supabaseData.service');
const executionReportService = require('../src/services/runner/executionReport.service');

describe('Phase 2: Unified Execution Intelligence & Reporting System', () => {
    const testWorkspaceId = 'ws-phase2-reporting-001';
    const unauthorizedWorkspaceId = 'ws-phase2-unauthorized-999';
    const testUserId = 'usr-qa-lead-phase2';

    let parentSuite;
    let baselineRun;
    let targetRun;
    let tcCases = [];

    before(async () => {
        // Enforce disk fallback to guarantee offline deterministic test runs
        supabaseService.workspacesTableAvailable = false;
        supabaseService.sessionsTableAvailable = false;
        supabaseService.executionTablesAvailable = false;

        // 1. Create a parent test suite with functional requirements and 4 test cases
        parentSuite = await supabaseService.createSession({
            workspaceId: testWorkspaceId,
            userId: testUserId,
            title: 'E-Commerce Cart & Checkout Specifications',
            status: 'Approved',
            suiteData: {
                testSuiteName: 'Cart & Checkout Suite',
                feature: 'Cart & Checkout Flow',
                understanding: {
                    functional_requirements: [
                        { id: 'REQ-CHK-01', text: 'Apply valid promo discount coupon to cart total' },
                        { id: 'REQ-CHK-02', text: 'Validate shipping address format and zip code' },
                        { id: 'REQ-CHK-03', text: 'Calculate sales tax and shipping fee based on location' }
                    ]
                },
                functional: [
                    {
                        id: 'TC-CHK-001',
                        title: 'Successful checkout with valid promo coupon',
                        type: 'Functional',
                        priority: 'Critical',
                        requirementId: 'REQ-CHK-01',
                        expectedResult: 'Order summary updates total with 15% discount applied',
                        automationMapping: {
                            framework: 'playwright',
                            automationTestId: 'checkout-valid-coupon',
                            scriptSource: 'existing',
                            scriptRef: 'tests/e2e/checkout.spec.js#checkout-valid-coupon',
                            scriptVersion: '1.0.0',
                            mappingStatus: 'configured'
                        }
                    },
                    {
                        id: 'TC-CHK-002',
                        title: 'Checkout without coupon using express shipping',
                        type: 'Functional',
                        priority: 'High',
                        requirementId: 'REQ-CHK-03',
                        expectedResult: 'Express shipping rate of $15 added to grand total',
                        automationMapping: {
                            framework: 'playwright',
                            automationTestId: 'checkout-express-shipping',
                            scriptSource: 'existing',
                            scriptRef: 'tests/e2e/checkout.spec.js#checkout-express-shipping',
                            scriptVersion: '1.0.0',
                            mappingStatus: 'configured'
                        }
                    }
                ],
                negative: [
                    {
                        id: 'TC-CHK-003',
                        title: 'Invalid shipping address validation',
                        type: 'Negative',
                        priority: 'High',
                        requirementId: 'REQ-CHK-02',
                        expectedResult: 'Inline validation error prompts for valid zip code',
                        automationMapping: {
                            framework: 'playwright',
                            automationTestId: 'checkout-invalid-address',
                            scriptSource: 'existing',
                            scriptRef: 'tests/e2e/checkout.spec.js#checkout-invalid-address',
                            scriptVersion: '1.0.0',
                            mappingStatus: 'configured'
                        }
                    }
                ],
                edge: [
                    {
                        id: 'TC-CHK-004',
                        title: 'Manual touch screen gesture validation during payment',
                        type: 'Edge',
                        priority: 'Medium',
                        requirementId: 'REQ-CHK-01',
                        expectedResult: 'No layout distortion when mobile keyboard appears',
                        automationMapping: null // purely manual
                    }
                ]
            }
        });

        // 2. Create baseline test run (Run 1)
        baselineRun = await supabaseService.createTestRun({
            workspaceId: testWorkspaceId,
            suiteId: parentSuite._id || parentSuite.id,
            suiteVersion: 1,
            name: 'Sprint 42 Sanity Run (Baseline)',
            executionType: 'mixed',
            targetEnvironment: { name: 'Staging E-Commerce', baseUrl: 'https://staging.shop.example.com' },
            assignedTo: testUserId
        });

        // 3. Create target test run (Run 2)
        targetRun = await supabaseService.createTestRun({
            workspaceId: testWorkspaceId,
            suiteId: parentSuite._id || parentSuite.id,
            suiteVersion: 1,
            name: 'Sprint 43 Release Verification (Target)',
            executionType: 'mixed',
            targetEnvironment: { name: 'Staging E-Commerce', baseUrl: 'https://staging.shop.example.com' },
            assignedTo: testUserId
        });

        // 4. Record baseline run executions:
        // - TC-CHK-001 passed
        // - TC-CHK-002 passed
        // - TC-CHK-003 failed
        // - TC-CHK-004 passed
        const baseCases = await supabaseService.getRunCases(baselineRun.id);
        for (const bc of baseCases) {
            const tcId = bc.testCaseId || bc.caseSnapshot?.id;
            const status = tcId === 'TC-CHK-003' ? 'failed' : 'passed';
            await supabaseService.recordTestExecution({
                runId: baselineRun.id,
                runCaseId: bc.id,
                workspaceId: testWorkspaceId,
                attemptNumber: 1,
                status,
                executorType: bc.caseSnapshot?.automationMapping ? 'automated' : 'manual',
                durationMs: 1200,
                errorMessage: status === 'failed' ? 'AssertionError: Expected input to have error border' : null,
                executedBy: testUserId
            });
        }

        // 5. Record target run executions (designed to produce 1 Regression and 1 Fix):
        // - TC-CHK-001 failed (Regression: Passed -> Failed)
        // - TC-CHK-002 passed (Unchanged: Passed -> Passed)
        // - TC-CHK-003 passed (Fix: Failed -> Passed)
        // - TC-CHK-004 failed (Manual failure with observation: Passed -> Failed)
        tcCases = await supabaseService.getRunCases(targetRun.id);
        for (const tc of tcCases) {
            const tcId = tc.testCaseId || tc.caseSnapshot?.id;
            let status = 'passed';
            let errMsg = null;
            let actualRes = null;
            let stack = null;
            let artifactObj = null;

            if (tcId === 'TC-CHK-001') {
                status = 'failed';
                errMsg = 'TimeoutError: locator("button#apply-coupon") not visible after 15000ms';
                stack = 'Error: locator not visible\n  at Object.execute (tests/e2e/checkout.spec.js:42:15)';
                await supabaseService.saveArtifact({
                    runId: targetRun.id,
                    runCaseId: tc.id,
                    name: 'checkout_coupon_timeout.png',
                    artifactType: 'screenshot',
                    mimeType: 'image/png',
                    storagePath: '/evidence/checkout_coupon_timeout.png',
                    sizeBytes: 14200
                });
            } else if (tcId === 'TC-CHK-004') {
                status = 'failed';
                actualRes = 'Mobile keyboard overlaps credit card expiration date input.';
            }

            await supabaseService.recordTestExecution({
                runId: targetRun.id,
                runCaseId: tc.id,
                workspaceId: testWorkspaceId,
                attemptNumber: 1,
                status,
                executorType: tc.caseSnapshot?.automationMapping ? 'automated' : 'manual',
                durationMs: tcId === 'TC-CHK-001' ? 15200 : 2400,
                errorMessage: errMsg,
                stackTrace: stack,
                actualResult: actualRes,
                executedBy: testUserId
            });
        }
    });

    it('1. Generates unified report accurately combining manual and automated metrics', async () => {
        const report = await executionReportService.generateRunReport(targetRun.id, testWorkspaceId);

        assert.ok(report, 'Report should be returned');
        assert.equal(report.identifiers.runId, targetRun.id);
        assert.equal(report.identifiers.runName, 'Sprint 43 Release Verification (Target)');
        assert.equal(report.identifiers.executionType, 'mixed');

        // Metrics verification
        assert.equal(report.summary.total, 4, 'Total test cases must be 4');
        assert.equal(report.summary.passed, 2, '2 test cases passed');
        assert.equal(report.summary.failed, 2, '2 test cases failed (1 auto, 1 manual)');
        assert.equal(report.summary.passRate, 50, 'Pass rate must be exactly 50%');
        assert.ok(report.timestamps.durationMs > 0, 'Duration should be greater than 0');

        // Method breakdown verification
        assert.equal(report.methodBreakdown.automated.total, 3, '3 cases have Playwright mappings');
        assert.equal(report.methodBreakdown.manual.total, 1, '1 case is purely manual');
        assert.equal(report.methodBreakdown.automated.passRate, 67, '2/3 automated tests passed (67%)');
        assert.equal(report.methodBreakdown.manual.passRate, 0, '0/1 manual tests passed (0%)');
    });

    it('2. Captures honest failure investigation diagnostics without fabricated explanations', async () => {
        const report = await executionReportService.generateRunReport(targetRun.id, testWorkspaceId);
        assert.equal(report.failureInvestigations.length, 2, 'Must identify exactly 2 failures');

        const autoFail = report.failureInvestigations.find(f => f.testCaseId === 'TC-CHK-001');
        assert.ok(autoFail, 'Automated failure must be present in failure ledger');
        assert.ok(autoFail.errorMessage.includes('locator("button#apply-coupon")'), 'Must contain actual error message');
        assert.ok(autoFail.stackTrace.includes('tests/e2e/checkout.spec.js'), 'Must contain actual stack trace');
        assert.ok(autoFail.screenshotArtifact?.url, 'Must capture screenshot artifact URL');
        assert.equal(autoFail.method, 'automated');

        const manualFail = report.failureInvestigations.find(f => f.testCaseId === 'TC-CHK-004');
        assert.ok(manualFail, 'Manual failure must be present');
        assert.equal(manualFail.method, 'manual');
        assert.ok(manualFail.actualResult.includes('Mobile keyboard overlaps'), 'Must preserve tester actual observations');
    });

    it('3. Compares target run against baseline run (identifying regressions, fixes, and shifts)', async () => {
        const diff = await executionReportService.compareRuns(targetRun.id, baselineRun.id, testWorkspaceId);

        assert.ok(diff, 'Comparison object returned');
        assert.equal(diff.targetRun.id, targetRun.id);
        assert.equal(diff.baselineRun.id, baselineRun.id);

        // Delta calculations
        assert.equal(diff.deltas.regressionsCount, 2, 'Must detect 2 regressions (TC-CHK-001 & TC-CHK-004)');
        assert.equal(diff.deltas.fixesCount, 1, 'Must detect 1 fix (TC-CHK-003 passed in target after failing in baseline)');
        assert.equal(diff.deltas.unchangedCount, 1, 'Must detect 1 unchanged test (TC-CHK-002 passed in both)');

        // Specific outcome shifts
        const reg1 = diff.outcomeShifts.find(s => s.testCaseId === 'TC-CHK-001');
        assert.equal(reg1.baselineStatus, 'passed');
        assert.equal(reg1.targetStatus, 'failed');
        assert.equal(reg1.type, 'regression');

        const fix1 = diff.outcomeShifts.find(s => s.testCaseId === 'TC-CHK-003');
        assert.equal(fix1.baselineStatus, 'failed');
        assert.equal(fix1.targetStatus, 'passed');
        assert.equal(fix1.type, 'fix');
    });

    it('4. Handles flexible rerun (scope: "failed") preserving append-only attempt history', async () => {
        // Rerun only failed cases
        const rerunResult = await executionReportService.executeRerun({
            runId: targetRun.id,
            workspaceId: testWorkspaceId,
            userId: testUserId,
            scope: 'failed'
        });

        assert.equal(rerunResult.rerunCasesCount, 2, 'Must queue only the 2 failed cases');

        const tc1 = tcCases.find(c => (c.testCaseId || c.caseSnapshot?.id) === 'TC-CHK-001');

        // Simulate recording the rerun attempt (TC-CHK-001 now passes on attempt 2)
        await supabaseService.recordTestExecution({
            runId: targetRun.id,
            runCaseId: tc1.id,
            workspaceId: testWorkspaceId,
            attemptNumber: 2,
            status: 'passed',
            executorType: 'automated',
            durationMs: 3100,
            executedBy: testUserId
        });

        // Verify that current_attempt on the run cases was incremented to 2
        const updatedCase = await supabaseService.getRunCaseById(tc1.id);
        assert.equal(updatedCase.currentAttempt, 2, 'Current attempt must be incremented to 2');
        assert.equal(updatedCase.status, 'passed', 'Status of rerun case must be passed');

        // Verify that historical attempt 1 is STILL preserved in test_executions
        const caseHistory = await supabaseService.getCaseExecutions(tc1.id);
        assert.equal(caseHistory.length, 2, 'Must have exactly 2 historical execution attempts');
        assert.equal(caseHistory[0].status, 'failed', 'Attempt 1 was failed');
        assert.equal(caseHistory[1].status, 'passed', 'Attempt 2 passed');
    });

    it('5. Computes real requirement traceability coverage linked to execution outcomes', async () => {
        const report = await executionReportService.generateRunReport(targetRun.id, testWorkspaceId);
        const cov = report.coverage;

        assert.ok(cov, 'Requirement coverage must be present');
        assert.equal(cov.totalRequirements, 3, 'Parent suite had 3 functional requirements');
        assert.ok(cov.requirementCoveragePercentage > 0, 'Coverage percentage must be calculated');
        assert.ok(Array.isArray(cov.requirements), 'Requirements list should be array');
    });

    it('6. Enforces multi-tenant workspace isolation on reports, comparison, and exports', async () => {
        // Attempt to get report from unauthorized workspace
        await assert.rejects(
            async () => {
                await executionReportService.generateRunReport(targetRun.id, unauthorizedWorkspaceId);
            },
            /not found in workspace/,
            'Must block report generation across workspace boundaries'
        );

        // Attempt to compare runs across unauthorized workspace
        await assert.rejects(
            async () => {
                await executionReportService.compareRuns(targetRun.id, baselineRun.id, unauthorizedWorkspaceId);
            },
            /not found in workspace/,
            'Must block run comparison across workspace boundaries'
        );

        // Attempt to rerun across unauthorized workspace
        await assert.rejects(
            async () => {
                await executionReportService.executeRerun({
                    runId: targetRun.id,
                    workspaceId: unauthorizedWorkspaceId,
                    userId: 'hacker',
                    scope: 'all'
                });
            },
            /not found/,
            'Must block rerun across workspace boundaries'
        );
    });

    it('7. Exports execution reports in JSON, CSV, and high-fidelity printable HTML/PDF', async () => {
        // JSON Export
        const jsonExport = await executionReportService.exportReport(targetRun.id, testWorkspaceId, 'json');
        assert.equal(jsonExport.contentType, 'application/json');
        const parsedJson = JSON.parse(jsonExport.content);
        assert.ok(parsedJson.summary);
        assert.ok(parsedJson.methodBreakdown);

        // CSV Export
        const csvExport = await executionReportService.exportReport(targetRun.id, testWorkspaceId, 'csv');
        assert.equal(csvExport.contentType, 'text/csv');
        assert.ok(csvExport.content.includes('Test Case ID,Title,Category,Method,Status,Duration (ms)'), 'CSV must contain required headers');
        assert.ok(csvExport.content.includes('TC-CHK-001'), 'CSV must include test case rows');

        // HTML / PDF Print Export
        const pdfExport = await executionReportService.exportReport(targetRun.id, testWorkspaceId, 'pdf');
        assert.equal(pdfExport.contentType, 'text/html');
        assert.ok(pdfExport.content.includes('<!DOCTYPE html>'), 'Print export must be complete HTML');
        assert.ok(pdfExport.content.includes('@media print'), 'Print export must include print media queries');
        assert.ok(pdfExport.content.includes('TESTNEXA AI — EXECUTIVE EXECUTION AUDIT'), 'Must contain executive report heading');
    });
});
