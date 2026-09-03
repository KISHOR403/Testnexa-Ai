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

// All session routes require authentication
router.use(protect);

// Session CRUD
router.get('/', listSessions);
router.post('/', createSession);
router.get('/:id', getSession);
router.patch('/:id', updateSession);
router.delete('/:id', deleteSession);

// Version management
router.get('/:id/versions', getVersions);
router.post('/:id/versions', createVersion);

module.exports = router;
