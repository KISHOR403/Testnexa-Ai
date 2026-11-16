const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { requireFeature } = require('../middleware/featureFlag.middleware');
const executionController = require('../controllers/execution.controller');

const router = express.Router();

// All execution engine routes strictly require authenticated sessions
router.use(protect);

// Workspace members list for tester assignment
router.get('/members', executionController.listMembers);

// Automation Inventory & Standalone Verification
router.get('/automation/inventory', executionController.listAutomationInventory);
router.get('/automation/sources', executionController.listAutomationSources);
router.post('/automation/validate', requireFeature('testRuns'), executionController.validateAutomationConfig);
router.post('/automation/execute-single', requireFeature('testRuns'), executionController.executeSingleTest);

// Phase 2: Failure Trend Analysis & Error Fingerprinting
router.get('/trends/full', requireFeature('testRuns'), executionController.getFullFailureTrends);
router.get('/trends/summary', requireFeature('testRuns'), executionController.getFailureTrendsSummary);
router.get('/trends/time-series', requireFeature('testRuns'), executionController.getFailureTrendsTimeSeries);
router.get('/trends/signatures', requireFeature('testRuns'), executionController.getFailureSignatures);
router.get('/trends/signatures/:signatureId', requireFeature('testRuns'), executionController.getFailureSignatureDetail);
router.get('/trends/classifications', requireFeature('testRuns'), executionController.getFailureClassifications);

// Phase 2: Execution Intelligence & Unified QA Health Dashboard
router.get('/intelligence/dashboard', requireFeature('testRuns'), executionController.getIntelligenceDashboard);
router.get('/intelligence/attention', requireFeature('testRuns'), executionController.getIntelligenceAttentionQueue);
router.get('/intelligence/coverage', requireFeature('testRuns'), executionController.getIntelligenceCoverageOverview);

// Test Run CRUD & Features
router.get('/features', executionController.getExecutionFeatures);
router.get('/', executionController.listRuns);
router.post('/', requireFeature('testRuns'), executionController.createRun);
router.get('/:id', executionController.getRun);
router.patch('/:id', requireFeature('testRuns'), executionController.updateRun);
router.post('/:id/cancel', requireFeature('testRuns'), executionController.cancelRun);
router.post('/:id/execute-automated', requireFeature('testRuns'), executionController.triggerAutomatedRun);
router.post('/:id/auto-configure-mappings', requireFeature('testRuns'), executionController.autoConfigureMappings);
router.post('/:id/rerun-failed', requireFeature('testRuns'), executionController.rerunFailed);
router.get('/:id/job', executionController.getRunJob);

// Phase 2: Unified Execution Intelligence, Comparison, Coverage & Exports
router.get('/:id/report', executionController.getRunReport);
router.get('/:id/compare/:baselineRunId', executionController.compareRuns);
router.post('/:id/rerun', requireFeature('testRuns'), executionController.rerun);
router.post('/:id/rerun-selected', requireFeature('testRuns'), executionController.rerunSelected);
router.post('/:id/rerun-case/:caseId', requireFeature('testRuns'), executionController.rerunSingleCase);
router.get('/:id/reruns', executionController.getRerunHistory);
router.get('/:id/rerun-relationships', executionController.getRerunRelationships);
router.get('/:id/rerun-comparison', executionController.getRerunComparison);
router.get('/:id/coverage', executionController.getRunCoverage);
router.get('/:id/export/:format', executionController.exportReport);

// Test Run Cases
router.get('/cases/:caseId/history', executionController.getTestCaseHistoricalAttempts);
router.get('/:id/cases', executionController.listRunCases);
router.get('/:id/cases/:caseId', executionController.getRunCase);
router.put('/:id/cases/:caseId/automation-mapping', requireFeature('testRuns'), executionController.updateCaseAutomationMapping);
router.post('/:id/cases/:caseId/validate-script', requireFeature('testRuns'), executionController.validateCaseScript);
router.post('/:id/cases/:caseId/test-script', requireFeature('testRuns'), executionController.testCaseScript);
router.post('/:id/cases/:caseId/suggest-template', requireFeature('testRuns'), executionController.suggestCaseTemplate);
router.post('/:id/cases/:caseId/execute', requireFeature('testRuns'), executionController.recordExecution);
router.post('/:id/cases/:caseId/execute-api', requireFeature('testRuns'), executionController.executeApiCase);
router.post('/:id/cases/:caseId/draft', requireFeature('testRuns'), executionController.saveCaseDraft);
router.get('/:id/cases/:caseId/draft', executionController.getCaseDraft);
router.get('/:id/cases/:caseId/executions', executionController.getCaseHistory);

// Defect Management
router.post('/:id/cases/:caseId/defects', requireFeature('testRuns'), executionController.createCaseDefect);
router.get('/:id/cases/:caseId/defects', executionController.listCaseDefects);
router.get('/:id/defects', executionController.listRunDefects);

// Artifacts
router.post('/:id/cases/:caseId/artifacts', requireFeature('testRuns'), executionController.uploadArtifact);
router.get('/:id/artifacts', executionController.listRunArtifacts);
router.get('/:id/artifacts/:artifactId/file', executionController.serveArtifactFile);

// AI Failure Root Cause Analysis
router.post('/:id/cases/:caseId/analyze-root-cause', executionController.analyzeFailureRootCause);
router.get('/:id/cases/:caseId/root-cause-analyses', executionController.getFailureRootCauseAnalyses);
router.post('/root-cause-analyses/:analysisId/feedback', executionController.submitFailureAnalysisFeedback);

module.exports = router;
