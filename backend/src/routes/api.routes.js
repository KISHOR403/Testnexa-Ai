const express = require('express');
const { generateTestCases } = require('../controllers/generate.controller');

const router = express.Router();

// POST /api/v1/generate - Generate test cases
router.post('/generate', generateTestCases);

module.exports = router;
