const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    listTestCases,
    getTestCaseById
} = require('../controllers/testCase.controller');

const router = express.Router();

// All Test Case endpoints require authentication and enforce workspace boundaries
router.get('/', protect, listTestCases);
router.get('/:id', protect, getTestCaseById);

module.exports = router;
