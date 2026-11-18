/**
 * Testnexa AI — Pipelines Routes
 * Connects repositories to test suites, manages tokens, and generates workflows
 */

const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    createPipeline,
    listPipelines,
    getPipeline,
    updatePipeline,
    deletePipeline,
    rotatePipelineToken,
    getPipelineSetup,
    exportPipelinePlaywright
} = require('../controllers/cicd.controller');

const router = express.Router();

// Pipelines CRUD
router.post('/', protect, createPipeline);
router.get('/', protect, listPipelines);
router.get('/:id', protect, getPipeline);
router.patch('/:id', protect, updatePipeline);
router.put('/:id', protect, updatePipeline);
router.delete('/:id', protect, deletePipeline);

// Token rotation & setup
router.post('/:id/token', protect, rotatePipelineToken);
router.get('/:id/setup', protect, getPipelineSetup);
router.get('/:id/export', protect, exportPipelinePlaywright);

module.exports = router;
