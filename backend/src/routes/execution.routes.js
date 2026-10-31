const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const executionController = require('../controllers/execution.controller');

const router = express.Router();

// All execution engine routes strictly require authenticated sessions
router.use(protect);

// Workspace members list for tester assignment
router.get('/members', executionController.listMembers);

// Automation Inventory
router.get('/automation/inventory', executionController.listAutomationInventory);

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
router.get('/:id/cases/:caseId/executions', executionController.getCaseHistory);

// Artifacts
router.post('/:id/cases/:caseId/artifacts', executionController.uploadArtifact);
router.get('/:id/artifacts', executionController.listRunArtifacts);
router.get('/:id/artifacts/:artifactId/file', executionController.serveArtifactFile);

module.exports = router;
