/**
 * Testnexa AI — Public Status Routes
 * Mounts GET /api/v1/status with 30s caching.
 */

const express = require('express');
const router = express.Router();
const statusController = require('../controllers/status.controller');

router.get('/', statusController.getPublicStatus);

module.exports = router;
