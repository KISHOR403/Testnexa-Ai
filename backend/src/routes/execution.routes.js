const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const executionController = require('../controllers/execution.controller');

const router = express.Router();

// All execution engine routes strictly require authenticated sessions
router.use(protect);

// Workspace members list for tester assignment
router.get('/members', executionController.listMembers);

// Automation Inventory & Standalone Verification
router.get('/automation/inventory', executionController.listAutomationInventory);
router.get('/automation/sources', executionController.listAutomationSources);
router.post('/automation/validate', executionController.validateAutomationConfig);
router.post('/automation/execute-single', executionController.executeSingleTest);

// Phase 2: Failure Trend Analysis & Error Fingerprinting
router.get('/trends/full', executionController.getFullFailureTrends);
router.get('/trends/summary', executionController.getFailureTrendsSummary);
router.get('/trends/time-series', executionController.getFailureTrendsTimeSeries);
router.get('/trends/signatures', executionController.getFailureSignatures);
router.get('/trends/signatures/:signatureId', executionController.getFailureSignatureDetail);
router.get('/trends/classifications', executionController.getFailureClassifications);

// Phase 2: Execution Intelligence & Unified QA Health Dashboard
router.get('/intelligence/dashboard', executionController.getIntelligenceDashboard);
router.get('/intelligence/attention', executionController.getIntelligenceAttentionQueue);
router.get('/intelligence/coverage', executionController.getIntelligenceCoverageOverview);

// Test Run CRUD
router.get('/', executionController.listRuns);
router.post('/', executionController.createRun);
router.get('/:id', executionController.getRun);
router.patch('/:id', executionController.updateRun);
router.post('/:id/cancel', executionController.cancelRun);
router.post('/:id/execute-automated', executionController.triggerAutomatedRun);
router.post('/:id/auto-configure-mappings', executionController.autoConfigureMappings);
router.post('/:id/rerun-failed', executionController.rerunFailed);
router.get('/:id/job', executionController.getRunJob);

// Phase 2: Unified Execution Intelligence, Comparison, Coverage & Exports
router.get('/:id/report', executionController.getRunReport);
router.get('/:id/compare/:baselineRunId', executionController.compareRuns);
router.post('/:id/rerun', executionController.rerun);
router.post('/:id/rerun-selected', executionController.rerunSelected);
router.post('/:id/rerun-case/:caseId', executionController.rerunSingleCase);
router.get('/:id/reruns', executionController.getRerunHistory);
router.get('/:id/rerun-relationships', executionController.getRerunRelationships);
router.get('/:id/rerun-comparison', executionController.getRerunComparison);
router.get('/:id/coverage', executionController.getRunCoverage);
router.get('/:id/export/:format', executionController.exportReport);

// Test Run Cases
router.get('/:id/cases', executionController.listRunCases);
router.get('/:id/cases/:caseId', executionController.getRunCase);
router.put('/:id/cases/:caseId/automation-mapping', executionController.updateCaseAutomationMapping);
router.post('/:id/cases/:caseId/validate-script', executionController.validateCaseScript);
router.post('/:id/cases/:caseId/test-script', executionController.testCaseScript);
router.post('/:id/cases/:caseId/suggest-template', executionController.suggestCaseTemplate);
router.post('/:id/cases/:caseId/execute', executionController.recordExecution);
router.post('/:id/cases/:caseId/draft', executionController.saveCaseDraft);
router.get('/:id/cases/:caseId/draft', executionController.getCaseDraft);
router.get('/:id/cases/:caseId/executions', executionController.getCaseHistory);

// Artifacts
router.post('/:id/cases/:caseId/artifacts', executionController.uploadArtifact);
router.get('/:id/artifacts', executionController.listRunArtifacts);
router.get('/:id/artifacts/:artifactId/file', executionController.serveArtifactFile);

// AI Failure Root Cause Analysis
router.post('/:id/cases/:caseId/analyze-root-cause', executionController.analyzeFailureRootCause);
router.get('/:id/cases/:caseId/root-cause-analyses', executionController.getFailureRootCauseAnalyses);
router.post('/root-cause-analyses/:analysisId/feedback', executionController.submitFailureAnalysisFeedback);

module.exports = router;
