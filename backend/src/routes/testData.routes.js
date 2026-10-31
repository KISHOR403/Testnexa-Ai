const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const testDataController = require('../controllers/testData.controller');

const router = express.Router();

// All Test Data Management endpoints require authentication
router.use(protect);

// Validation utility endpoint
router.post('/validate', testDataController.validateTestData);

// Dataset Collection CRUD
router.get('/', testDataController.listDatasets);
router.post('/', testDataController.createDataset);

// Dataset Item Operations
router.get('/:id', testDataController.getDatasetById);
router.put('/:id', testDataController.updateDataset);
router.delete('/:id', testDataController.deleteDataset);
router.post('/:id/restore', testDataController.restoreDataset);
router.post('/:id/duplicate', testDataController.duplicateDataset);
router.post('/:id/associations', testDataController.updateAssociations);

// Versioning Operations
router.get('/:id/versions', testDataController.getDatasetVersions);
router.get('/:id/versions/:version', testDataController.getDatasetVersion);

module.exports = router;

