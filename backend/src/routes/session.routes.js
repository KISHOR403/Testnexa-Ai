const express = require('express');
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const {
    listSessions,
    createSession,
    getSession,
    updateSession,
    deleteSession,
    getVersions,
    createVersion,
    createShare,
    getShare,
    revokeShare
} = require('../controllers/session.controller');

const router = express.Router();

// Share management (strictly owner/authenticated)
router.get('/:id/share', protect, getShare);
router.post('/:id/share', protect, createShare);
router.delete('/:id/share', protect, revokeShare);

// Read session: supports authenticated users and shared links (guests & collaborators)
router.get('/:id', optionalProtect, getSession);

// Protected workspace routes
router.get('/', protect, listSessions);
router.post('/', protect, createSession);
router.patch('/:id', optionalProtect, updateSession); // Enforces owner / editor / reviewer / viewer roles
router.delete('/:id', protect, deleteSession);

// Version management
router.get('/:id/versions', protect, getVersions);
router.post('/:id/versions', protect, createVersion);

module.exports = router;
