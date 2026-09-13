const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
    listSessions,
    createSession,
    getSession,
    updateSession,
    deleteSession,
    getVersions,
    createVersion
} = require('../controllers/session.controller');

const router = express.Router();

// All test-suite routes strictly require authentication
router.use(protect);

// Test Suite CRUD — Scoped to authenticated user's workspace
router.get('/', listSessions);
router.post('/', createSession);
router.get('/:id', getSession);
router.patch('/:id', updateSession);
router.delete('/:id', deleteSession);

// Version management
router.get('/:id/versions', getVersions);
router.post('/:id/versions', createVersion);

module.exports = router;
