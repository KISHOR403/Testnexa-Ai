/**
 * Testnexa AI — CI Results Ingestion Routes
 * Endpoint called by customer's GitHub Actions runner
 * Authenticated via Bearer <pipeline_token>
 * Strictly gated behind FEATURE_TEST_RUNS
 */

const express = require('express');
const { ingestCiResults } = require('../controllers/cicd.controller');

const router = express.Router();

// Result ingestion from customer runner
router.post('/results', ingestCiResults);

module.exports = router;
